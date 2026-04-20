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
        'basarisiz': ['umut', 'sabir', 'guven'],
        'ask': ['ask', 'sevgi', 'merhamet'],
        'asik': ['ask', 'sevgi'],
        'nefis': ['nefis', 'tevazu', 'marifet'],
        'nefsim': ['nefis', 'tevazu'],
        'kibir': ['tevazu', 'nefis'],
        'benlik': ['nefis', 'tevazu'],
        'ego': ['nefis', 'tevazu'],
        'tasavvuf': ['marifet', 'hikmet', 'vahdet'],
        'tarikat': ['marifet', 'hikmet'],
        'gonul': ['ask', 'sevgi', 'marifet'],
        'ruh': ['marifet', 'hikmet', 'vahdet'],
        'vahdet': ['vahdet', 'iman'],
        'mevlana': ['ask', 'hikmet', 'sevgi'],
        'yunus': ['ask', 'sevgi', 'tevazu'],
        'hakikat': ['marifet', 'hikmet', 'iman'],
        'zikir': ['dua', 'iman', 'marifet'],
        'fenafillah': ['nefis', 'vahdet', 'marifet'],
        'murakabe': ['dua', 'marifet', 'hikmet']
    },

    // Tüm ayet verilerini yükle
    _scriptureCache: null,

    async loadScriptures() {
        if (this._scriptureCache) return this._scriptureCache;

        try {
            const [quranRes, bibleRes, torahRes, ustadRes] = await Promise.all([
                fetch('data/quran.json'),
                fetch('data/bible.json'),
                fetch('data/torah.json'),
                fetch('data/ustadlar.json')
            ]);

            const quran = await quranRes.json();
            const bible = await bibleRes.json();
            const torah = await torahRes.json();
            const ustadlar = await ustadRes.json();

            // Her verse'e kaynak bilgisini yerlestir (ekranda gosterim icin)
            const stampSource = (data) => {
                data.verses.forEach(v => {
                    if (!v.source) v.source = data.source;
                });
                return data;
            };

            this._scriptureCache = {
                quran: stampSource(quran),
                bible: stampSource(bible),
                torah: stampSource(torah),
                ustadlar: stampSource(ustadlar)
            };
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

        const allSources = [scriptures.quran, scriptures.bible, scriptures.torah, scriptures.ustadlar];
        const selected = [];

        // Her kaynaktan 1-2 ayet/hikmet sec
        for (const source of allSources) {
            if (!source || !source.verses) continue;
            const matching = source.verses.filter(v =>
                v.tags.some(t => matchedTags.has(t))
            );

            if (matching.length > 0) {
                const shuffled = matching.sort(() => Math.random() - 0.5);
                selected.push(...shuffled.slice(0, 2));
            }
        }

        return selected.slice(0, 8); // Maksimum 8 kaynak (3 kutsal kitap + ustalar)
    },

    // Sistem promptunu oluştur
    buildSystemPrompt(scriptureContext) {
        let verseText = '';
        if (scriptureContext && scriptureContext.length > 0) {
            verseText = scriptureContext.map(v =>
                `[${v.source || 'Kaynak'}] ${v.reference}: "${v.text}"`
            ).join('\n');
        }

        return `Sen "JESSE" adinda, sefkatli ve bilge bir manevi danismansin.

Gorevlerin:
1. Kullanicinin duygusal ve manevi ihtiyaclarina karsilik vermek.
2. Uc buyuk ilahi gelenegden (Islam, Hristiyanlik, Yahudilik) ayetlerle rehberlik etmek.
3. Tasavvuf-i Islamin buyuk usta ve mursidlerinin (Yunus Emre, Mevlana Celaleddin Rumi, Imam Gazali, Fuzuli, Esrefoglu Rumi, Lutfi Filiz gibi) hikmetli sozleri ve ogretileriyle gonul yolunu aydinlatmak.
4. Her zaman saygiyla, yargilamadan ve sevecenlikle yaklasmak.
5. Profesyonel psikolojik tedavinin yerini almadigini gerektiginde hatirlatmak.
6. Turkce konusmak.

Yaklasim ilkelerin:
- Kullanicinin ruh halini anla ve empati goster.
- Kaynaklari acikca belirt: ayet paylastiginda "Kuran", "Incil", "Tevrat"; tasavvuf sozu paylastiginda ustat adini ve eserini (ornegin "Mevlana, Mesnevi" veya "Yunus Emre, Divan") belirt.
- Kutsal kitap ayetlerini ve tasavvuf ustalarinin sozlerini bir arada kullanabilirsin; ikisi birbirini tamamlar. Bazen yalniz bir ayet, bazen yalniz bir hikmet, bazen ikisini birlikte sun.
- Pratik manevi tavsiyeler sun (dua, meditasyon, zikir, sukur pratigi, nefes egzersizi, murakabe vb.).
- Kullaniciyi olumlu dusunmeye ve ic huzura yonlendir.
- Asla belirli bir dini dayatma veya din degistirmeye tesvik etme.
- Uc dini gelenegi esit saygiyla ele al; tasavvuf mirasini ise Islam gelenegi icinde sunarken evrensel hikmet olarak da degerlendir.
- Yanitlarin sicak, insani ve dogal olsun. Robotik veya kalipsal konusma.
- Alinti yaparken sadakat goster; bir sozun kime ait olduguna dair suphen varsa "bu anlamda soylenen bir sozdur" gibi nazik bir ifadeyle aktar.
- Gerektiginde "Bu konuda profesyonel bir uzmana danismanizi tavsiye ederim" de.

${verseText ? 'Asagida konuyla ilgili kutsal kitap ayetleri ve tasavvuf ustalarinin hikmetli sozleri verilmistir. Uygun gordugunde yanitlarinda kullanabilirsin:\n\n' + verseText : ''}`;
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
