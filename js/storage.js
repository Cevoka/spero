// storage.js - LocalStorage soyutlama katmanı
// Tüm anahtarlar "rr_" ön eki ile saklanır

const Storage = {
    PREFIX: 'rr_',

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
            localStorage.setItem(this._key(key), JSON.stringify(value));
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

    // --- API Key ---
    getApiKey() {
        return this._get('api_key');
    },

    setApiKey(key) {
        this._set('api_key', key);
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
        const convos = this.getConversations(username);
        const index = convos.findIndex(c => c.id === conversation.id);
        if (index >= 0) {
            convos[index] = conversation;
        } else {
            convos.unshift(conversation);
        }
        this.saveConversations(username, convos);
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
    },

    // --- Yardımcılar ---
    getStorageUsage() {
        let total = 0;
        for (let key in localStorage) {
            if (localStorage.hasOwnProperty(key) && key.startsWith(this.PREFIX)) {
                total += localStorage.getItem(key).length;
            }
        }
        return {
            usedBytes: total * 2, // UTF-16
            usedMB: ((total * 2) / (1024 * 1024)).toFixed(2),
            warningLevel: total * 2 > 4 * 1024 * 1024 // 4MB uyarı
        };
    },

    clearAllData() {
        const keys = [];
        for (let key in localStorage) {
            if (localStorage.hasOwnProperty(key) && key.startsWith(this.PREFIX)) {
                keys.push(key);
            }
        }
        keys.forEach(key => localStorage.removeItem(key));
    }
};
