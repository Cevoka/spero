// storage.js - LocalStorage soyutlama katmanı
// Tüm anahtarlar "rr_" ön eki ile saklanır

const Storage = {
    PREFIX: 'rr_',
    STORAGE_VERSION: 2,

    // --- Özel Tipler: Merkezi serialize/deserialize ---

    serialize(value) {
        // Date → ISO string, undefined alanları temizle
        try {
            return JSON.parse(JSON.stringify(value, (k, v) => {
                if (v instanceof Date) return v.toISOString();
                return v === undefined ? undefined : v;
            }));
        } catch {
            return value;
        }
    },

    deserialize(raw, schema) {
        // ISO tarih alanlarını string olarak bırak (tutarlılık için)
        // Hata durumunda null döner, asla throw etmez
        if (!raw) return null;
        try {
            const dateFields = ['createdAt', 'updatedAt', 'timestamp', 'created_at', 'updated_at'];
            if (typeof raw === 'object' && raw !== null) {
                const out = Array.isArray(raw) ? [...raw] : { ...raw };
                dateFields.forEach(f => {
                    if (out[f] && typeof out[f] === 'string') {
                        // ISO string olarak koru; görüntüleme katmanı çevirir
                    }
                });
                return out;
            }
            return raw;
        } catch {
            return null;
        }
    },

    // --- Güvenlik: API key log'a düşmesin ---

    sanitizeForLog(str) {
        if (typeof str !== 'string') return str;
        // sk-ant- ile başlayan Claude API keylerini maskele
        return str.replace(/sk-ant-[A-Za-z0-9_-]{10,}/g, '[GİZLİ-API-KEY]');
    },

    // --- Dahili yardımcılar ---

    _key(name) {
        return this.PREFIX + name;
    },

    _get(key) {
        try {
            const data = localStorage.getItem(this._key(key));
            return data ? JSON.parse(data) : null;
        } catch {
            return null;
        }
    },

    _set(key, value) {
        try {
            localStorage.setItem(this._key(key), JSON.stringify(this.serialize(value)));
            return true;
        } catch (e) {
            if (e.name === 'QuotaExceededError') {
                alert('Depolama alanı doldu! Lütfen eski konuşmalarınızı silin.');
            }
            return false;
        }
    },

    _remove(key) {
        localStorage.removeItem(this._key(key));
    },

    // --- Versiyonlama: Schema migration ---

    migrate() {
        const stored = parseInt(localStorage.getItem(this._key('storage_version')) || '1', 10);
        if (stored < this.STORAGE_VERSION) {
            // v1 → v2: conv ID'leri 'conv_' prefix ile başlıyor; upload flag ekle
            if (stored < 2) {
                localStorage.setItem(this._key('needs_upload'), 'true');
            }
        }
        localStorage.setItem(this._key('storage_version'), String(this.STORAGE_VERSION));
    },

    // --- Kullanıcı ---

    getCurrentUser() {
        return this._get('current_user');
    },

    setCurrentUser(username) {
        this._set('current_user', username);
    },

    removeCurrentUser() {
        this._remove('current_user');
    },

    // --- API Key (güvenli) ---

    getApiKey() {
        return this._get('api_key');
    },

    setApiKey(key) {
        // API key asla log'a düşmesin
        this._set('api_key', key);
        // Supabase'de de güncelle (fire-and-forget)
        const userId = typeof Auth !== 'undefined' ? Auth.getUserId() : null;
        if (userId) {
            Supabase.db.update('profiles', { api_key: key }, { id: userId }).catch(() => {});
        }
    },

    // --- Supabase Senkronizasyonu ---

    async pullFromSupabase(userId) {
        if (!userId) return;
        try {
            // Profil
            const profiles = await Supabase.db.select('profiles', {
                select: 'display_name,api_key',
                filters: { id: userId }
            });
            if (profiles && profiles[0]) {
                if (profiles[0].display_name) this.setCurrentUser(profiles[0].display_name);
                if (profiles[0].api_key && !this.getApiKey()) {
                    this._set('api_key', profiles[0].api_key);
                }
            }

            // Konuşmalar (meta, mesajsız, son 50)
            const convos = await Supabase.db.select('conversations', {
                select: 'id,title,preview,created_at,updated_at',
                filters: { user_id: userId },
                order: 'updated_at.desc',
                limit: 50
            });
            if (convos && convos.length > 0) {
                const username = this.getCurrentUser();
                const local = this.getConversations(username);
                // Supabase kayıtları local'e yansıt (ID yoksa ekle)
                const localIds = new Set(local.map(c => c.id));
                convos.forEach(c => {
                    if (!localIds.has(c.id)) {
                        local.push({ id: c.id, preview: c.preview || '', messages: [], createdAt: c.created_at, updatedAt: c.updated_at });
                    }
                });
                this.saveConversations(username, local);
            }

            // Günlük içerik
            const today = new Date().toISOString().split('T')[0];
            const daily = await Supabase.db.select('daily_content', {
                filters: { user_id: userId, date: today }
            });
            if (daily && daily[0]) {
                const username = this.getCurrentUser();
                this._set('daily_content_' + username, {
                    date: today,
                    content: daily[0].content,
                    verses: daily[0].verses || [],
                    generated: daily[0].generated
                });
            }

            document.dispatchEvent(new CustomEvent('jesse:synced'));
        } catch {
            // Sync hatası sessizce geçilir; uygulama localStorage ile çalışmaya devam eder
        }
    },

    async syncConversation(conversation, userId) {
        if (!userId || !conversation) return;
        try {
            const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-/.test(conversation.id);
            const convData = {
                user_id: userId,
                title: conversation.preview ? conversation.preview.substring(0, 60) : 'Sohbet',
                preview: conversation.preview || '',
                updated_at: new Date().toISOString()
            };

            if (isUuid) {
                await Supabase.db.update('conversations', convData, { id: conversation.id });
            } else {
                const created = await Supabase.db.insert('conversations', {
                    ...convData,
                    created_at: conversation.createdAt || new Date().toISOString()
                });
                if (created && created.id) {
                    // UUID ile yeniden anahtarla
                    const username = this.getCurrentUser();
                    const convos = this.getConversations(username);
                    const idx = convos.findIndex(c => c.id === conversation.id);
                    if (idx >= 0) convos[idx].id = created.id;
                    this.saveConversations(username, convos);
                    conversation.id = created.id;
                }
            }

            // Yeni mesajları ekle
            if (Array.isArray(conversation.messages) && conversation.messages.length > 0) {
                const msgs = conversation.messages.slice(-20).map(m => ({
                    conversation_id: conversation.id,
                    role: m.role,
                    content: m.content,
                    created_at: m.timestamp || new Date().toISOString()
                }));
                await Supabase.db.insert('messages', msgs).catch(() => {});
            }
        } catch {
            // Senkronizasyon hatası UI'yi etkilemesin
        }
    },

    // --- Konuşmalar ---

    getConversations(username) {
        return this._get('conversations_' + username) || [];
    },

    saveConversations(username, conversations) {
        this._set('conversations_' + username, conversations);
    },

    getActiveConvoId(username) {
        return this._get('active_convo_' + username);
    },

    setActiveConvoId(username, convoId) {
        this._set('active_convo_' + username, convoId);
    },

    getConversation(username, convoId) {
        const convos = this.getConversations(username);
        return convos.find(c => c.id === convoId) || null;
    },

    saveConversation(username, conversation) {
        // Performans: mesaj listesini son 100 ile sınırla
        const conv = { ...conversation };
        if (Array.isArray(conv.messages) && conv.messages.length > 100) {
            conv.messages = conv.messages.slice(-100);
        }

        const convos = this.getConversations(username);
        const index = convos.findIndex(c => c.id === conv.id);
        if (index >= 0) {
            convos[index] = conv;
        } else {
            convos.unshift(conv);
        }
        this.saveConversations(username, convos);

        // Supabase'e fire-and-forget sync
        const userId = typeof Auth !== 'undefined' ? Auth.getUserId() : null;
        if (userId) this.syncConversation(conv, userId);
    },

    deleteConversation(username, convoId) {
        const convos = this.getConversations(username);
        const filtered = convos.filter(c => c.id !== convoId);
        this.saveConversations(username, filtered);
        if (this.getActiveConvoId(username) === convoId) {
            this._remove('active_convo_' + username);
        }
    },

    // --- Günlük İçerik ---

    getDailyContent(username) {
        return this._get('daily_content_' + username);
    },

    setDailyContent(username, content) {
        this._set('daily_content_' + username, content);
        // Supabase upsert (fire-and-forget)
        const userId = typeof Auth !== 'undefined' ? Auth.getUserId() : null;
        if (userId && content) {
            Supabase.db.upsert('daily_content', {
                user_id: userId,
                date: content.date,
                content: content.content,
                verses: content.verses || [],
                generated: content.generated || false
            }, 'user_id,date').catch(() => {});
        }
    },

    // --- Yardımcılar ---

    getStorageUsage() {
        let total = 0;
        for (let key in localStorage) {
            if (Object.prototype.hasOwnProperty.call(localStorage, key) && key.startsWith(this.PREFIX)) {
                total += localStorage.getItem(key).length;
            }
        }
        const usedBytes = total * 2; // UTF-16
        const warningLevel = usedBytes > 4 * 1024 * 1024;
        if (warningLevel) {
            console.warn('Depolama uyarısı: 4MB limitine yaklaşıldı (' +
                ((usedBytes / (1024 * 1024)).toFixed(2)) + ' MB)');
        }
        return {
            usedBytes,
            usedMB: (usedBytes / (1024 * 1024)).toFixed(2),
            warningLevel
        };
    },

    clearAllData() {
        const keys = [];
        for (let key in localStorage) {
            if (Object.prototype.hasOwnProperty.call(localStorage, key) && key.startsWith(this.PREFIX)) {
                keys.push(key);
            }
        }
        keys.forEach(key => localStorage.removeItem(key));
    }
};
