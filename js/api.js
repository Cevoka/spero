// api.js - Claude API entegrasyonu ve ayet seçimi

const API = {
    MODEL: 'claude-sonnet-4-20250514',
    API_URL: 'https://api.anthropic.com/v1/messages',

    // Kullanıcı mesajından anahtar kelime eşleştirme
    KEYWORD_MAP: {
        'kaygi': ['kaygi', 'teselli'],
        'kaygı': ['kaygi', 'teselli'],
        'endise': ['kaygi', 'teselli'],
        'korku': ['kaygi', 'guven'],
        'korkuyorum': ['kaygi', 'guven'],
        'stres': ['kaygi', 'sabir'],
        'uzgun': ['teselli', 'umut'],
        'uzgunluk': ['teselli', 'umut'],
        'uzuluyorum': ['teselli', 'umut'],
        'mutsuz': ['teselli', 'umut'],
        'depresyon': ['teselli', 'umut', 'kaygi'],
        'yalniz': ['teselli', 'sevgi'],
        'yalnızlık': ['teselli', 'sevgi'],
        'umut': ['umut', 'guven'],
        'umutsuz': ['umut', 'teselli'],
        'sabir': ['sabir', 'hikmet'],
        'ofke': ['sabir', 'baris'],
        'kızgın': ['sabir', 'baris'],
        'sinirli': ['sabir', 'baris'],
        'sukur': ['sukur', 'guven'],
        'tesekkur': ['sukur'],
        'sevgi': ['sevgi', 'merhamet'],
        'ask': ['sevgi', 'merhamet'],
        'merhamet': ['merhamet', 'sevgi'],
        'adalet': ['adalet', 'hikmet'],
        'haksizlik': ['adalet', 'sabir'],
        'baris': ['baris', 'merhamet'],
        'dua': ['dua', 'guven'],
        'ibadet': ['dua', 'iman'],
        'gunah': ['tovbe', 'merhamet'],
        'pismanlik': ['tovbe', 'umut'],
        'tovbe': ['tovbe', 'merhamet'],
        'zorluk': ['zorluk', 'sabir'],
        'zor': ['zorluk', 'sabir'],
        'sikintu': ['zorluk', 'teselli'],
        'problem': ['zorluk', 'hikmet'],
        'hastalik': ['teselli', 'dua', 'sabir'],
        'hasta': ['teselli', 'dua'],
        'olum': ['teselli', 'umut', 'sabir'],
        'kayip': ['teselli', 'sabir'],
        'iman': ['iman', 'guven'],
        'inanc': ['iman', 'guven'],
        'anlam': ['hikmet', 'genel'],
        'neden': ['hikmet', 'sabir'],
        'mutluluk': ['sukur', 'umut'],
        'huzur': ['baris', 'guven', 'dua'],
        'guven': ['guven', 'iman'],
        'basari': ['umut', 'guven', 'sukur'],
        'basarisiz': ['umut', 'sabir', 'guven']
    },

    // Tüm ayet verilerini yükle
    _scriptureCache: null,

    async loadScriptures() {
        if (this._scriptureCache) return this._scriptureCache;

        try {
            const [quranRes, bibleRes, torahRes] = await Promise.all([
                fetch('data/quran.json'),
                fetch('data/bible.json'),
                fetch('data/torah.json')
            ]);

            const quran = await quranRes.json();
            const bible = await bibleRes.json();
            const torah = await torahRes.json();

            this._scriptureCache = { quran, bible, torah };
            return this._scriptureCache;
        } catch (e) {
            console.error('Ayet verileri yuklenemedi:', e);
            return null;
        }
    },

    // Kullanıcı mesajına göre ilgili ayetleri bul
    findRelevantVerses(userMessage, scriptures) {
        if (!scriptures) return [];

        const msg = userMessage.toLowerCase();
        const matchedTags = new Set();

        // Anahtar kelime eşleştirme
        for (const [keyword, tags] of Object.entries(this.KEYWORD_MAP)) {
            if (msg.includes(keyword)) {
                tags.forEach(t => matchedTags.add(t));
            }
        }

        // Eşleşme yoksa genel etiket kullan
        if (matchedTags.size === 0) {
            matchedTags.add('genel');
            matchedTags.add('umut');
        }

        const allSources = [scriptures.quran, scriptures.bible, scriptures.torah];
        const selected = [];

        // Her kaynaktan 1-2 ayet seç
        for (const source of allSources) {
            const matching = source.verses.filter(v =>
                v.tags.some(t => matchedTags.has(t))
            );

            if (matching.length > 0) {
                // Rastgele 1-2 ayet seç
                const shuffled = matching.sort(() => Math.random() - 0.5);
                selected.push(...shuffled.slice(0, 2));
            }
        }

        return selected.slice(0, 6); // Maksimum 6 ayet
    },

    // Sistem promptunu oluştur
    buildSystemPrompt(scriptureContext) {
        let verseText = '';
        if (scriptureContext && scriptureContext.length > 0) {
            verseText = scriptureContext.map(v =>
                `[${v.source || 'Kaynak'}] ${v.reference}: "${v.text}"`
            ).join('\n');
        }

        return `Sen "Spero" adinda, sefkatli ve bilge bir manevi danismansin.

Gorevlerin:
1. Kullanicinin duygusal ve manevi ihtiyaclarina karsilik vermek.
2. Uc buyuk ilahi gelenegden (Islam, Hristiyanlik, Yahudilik) ayetler ve ogretilerle rehberlik etmek.
3. Her zaman saygiyla, yargilamadan ve sevecenlikle yaklasmak.
4. Profesyonel psikolojik tedavinin yerini almadigini gerektiginde hatirlatmak.
5. Turkce konusmak.

Yaklasim ilkelerin:
- Kullanicinin ruh halini anla ve empati goster.
- Ilgili kutsal kitap ayetlerini paylasirken kaynak belirt (Kuran, Incil, Tevrat).
- Pratik manevi tavsiyeler sun (dua, meditasyon, sukur pratigi, nefes egzersizi vb.).
- Kullaniciyi olumlu dusunmeye ve ic huzura yonlendir.
- Asla belirli bir dini dayatma veya din degistirmeye tesvik etme.
- Uc dini gelenegi esit saygiyla ele al.
- Yanitlarin sicak, insani ve dogal olsun. Robotik veya kalipsal konusma.
- Gerektiginde "Bu konuda profesyonel bir uzmana danismanizi tavsiye ederim" de.

${verseText ? 'Asagida konuyla ilgili kutsal kitap ayetleri verilmistir. Uygun gordugunde yanitlarinda kullanabilirsin:\n\n' + verseText : ''}`;
    },

    // Claude API'ye mesaj gönder
    async sendMessage(apiKey, messages, scriptureContext) {
        if (!apiKey) {
            throw new Error('API anahtari bulunamadi. Lutfen Ayarlar sayfasindan API anahtarinizi girin.');
        }

        const systemPrompt = this.buildSystemPrompt(scriptureContext);

        // Son 20 mesajı al (token sınırı için)
        const recentMessages = messages.slice(-20);

        const response = await fetch(this.API_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-api-key': apiKey,
                'anthropic-version': '2023-06-01',
                'anthropic-dangerous-direct-browser-access': 'true'
            },
            body: JSON.stringify({
                model: this.MODEL,
                max_tokens: 1024,
                system: systemPrompt,
                messages: recentMessages.map(m => ({
                    role: m.role,
                    content: m.content
                }))
            })
        });

        if (!response.ok) {
            const err = await response.json().catch(() => ({}));
            if (response.status === 401) {
                throw new Error('Gecersiz API anahtari. Lutfen Ayarlar sayfasindan kontrol edin.');
            } else if (response.status === 429) {
                throw new Error('Cok fazla istek gonderildi. Lutfen biraz bekleyin.');
            } else {
                throw new Error(err.error?.message || 'API hatasi: ' + response.status);
            }
        }

        const data = await response.json();
        return data.content[0].text;
    },

    // API key test et
    async testApiKey(apiKey) {
        const response = await fetch(this.API_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-api-key': apiKey,
                'anthropic-version': '2023-06-01',
                'anthropic-dangerous-direct-browser-access': 'true'
            },
            body: JSON.stringify({
                model: this.MODEL,
                max_tokens: 10,
                messages: [{ role: 'user', content: 'test' }]
            })
        });

        return response.ok;
    },

    // Günlük içerik üret
    async generateDailyContent(apiKey) {
        const systemPrompt = `Sen manevi bir rehbersin. Kullaniciya gunluk motivasyon ve manevi destek mesaji uretiyorsun.
Turkce yaz. Kisa ve etkili bir mesaj ver (2-3 cumle). Ardindan Kuran, Incil veya Tevrat'tan uygun bir ayet paylasm.
JSON formatinda yanit ver:
{"content": "mesaj", "verse": {"source": "kaynak", "reference": "referans", "text": "ayet metni"}}`;

        const today = new Date().toLocaleDateString('tr-TR', { weekday: 'long', day: 'numeric', month: 'long' });

        const response = await fetch(this.API_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-api-key': apiKey,
                'anthropic-version': '2023-06-01',
                'anthropic-dangerous-direct-browser-access': 'true'
            },
            body: JSON.stringify({
                model: this.MODEL,
                max_tokens: 300,
                system: systemPrompt,
                messages: [{ role: 'user', content: 'Bugun ' + today + '. Gunun manevi mesajini ver.' }]
            })
        });

        if (!response.ok) return null;

        const data = await response.json();
        try {
            const text = data.content[0].text;
            const jsonMatch = text.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
                return JSON.parse(jsonMatch[0]);
            }
        } catch {}
        return null;
    }
};
