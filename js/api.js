// api.js - Claude API entegrasyonu ve ayet seçimi

const API = {
    MODEL: 'claude-sonnet-4-6',
    API_URL: 'https://kehkxgouyjceypxmtvip.supabase.co/functions/v1/chat-proxy',

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
        'ask': ['ask', 'sevgi', 'merhamet'],
        'asik': ['ask', 'sevgi'],
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
        'huzur': ['baris', 'guven', 'dua', 'huzur'],
        'guven': ['guven', 'iman'],
        'basari': ['umut', 'guven', 'sukur'],
        'basarisiz': ['umut', 'sabir', 'guven'],
        'nefis': ['nefis', 'tevazu', 'marifet'],
        'nefsim': ['nefis', 'tevazu'],
        'kibir': ['tevazu', 'nefis'],
        'benlik': ['nefis', 'tevazu'],
        'ego': ['nefis', 'tevazu'],
        'tasavvuf': ['marifet', 'hikmet', 'vahdet', 'tasavvuf'],
        'tarikat': ['marifet', 'hikmet', 'tasavvuf'],
        'gonul': ['ask', 'sevgi', 'marifet', 'gonul'],
        'ruh': ['marifet', 'hikmet', 'vahdet'],
        'vahdet': ['vahdet', 'iman', 'marifet'],
        'mevlana': ['ask', 'hikmet', 'sevgi'],
        'yunus': ['ask', 'sevgi', 'tevazu'],
        'hakikat': ['marifet', 'hikmet', 'iman'],
        'zikir': ['dua', 'iman', 'marifet'],
        'fenafillah': ['nefis', 'vahdet', 'marifet'],
        'murakabe': ['dua', 'marifet', 'hikmet'],
        'esrefoglu': ['ask', 'nefis', 'tasavvuf'],
        'muzekkin': ['nefis', 'marifet', 'tasavvuf'],
        'lutfi': ['gonul', 'vahdet', 'marifet'],
        'filiz': ['gonul', 'vahdet', 'marifet'],
        'noktanin': ['vahdet', 'marifet', 'hikmet'],
        'geylani': ['iman', 'nefis', 'sabir'],
        'abdulkadir': ['iman', 'nefis', 'tovbe'],
        'sems': ['hikmet', 'ask', 'marifet'],
        'tebrizi': ['hikmet', 'ask', 'marifet'],
        'hudai': ['dua', 'iman', 'gonul'],
        'ibnarabi': ['vahdet', 'marifet', 'ask'],
        'arabi': ['vahdet', 'marifet', 'ask'],
        'gazali': ['nefis', 'hikmet', 'iman'],
        'abdulaziz': ['ask', 'marifet', 'gonul'],
        'kenzi': ['ask', 'marifet', 'gonul'],
        'makalat': ['hikmet', 'ask', 'marifet'],
        'mesnevi': ['ask', 'hikmet', 'sevgi'],
        'divan': ['ask', 'sevgi', 'hikmet'],
        'dunya': ['tevazu', 'hikmet', 'dunya'],
        'gonlum': ['gonul', 'ask', 'teselli'],
        'ozlem': ['ask', 'sevgi', 'teselli'],
        'teslimiyet': ['guven', 'sabir', 'iman'],
        'tevekkul': ['guven', 'iman', 'hikmet'],
        'riza': ['sabir', 'iman', 'sukur'],
        'manevi': ['marifet', 'hikmet', 'iman'],
        'ruhsal': ['marifet', 'hikmet', 'iman']
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

        for (const [keyword, tags] of Object.entries(this.KEYWORD_MAP)) {
            if (msg.includes(keyword)) {
                tags.forEach(t => matchedTags.add(t));
            }
        }

        if (matchedTags.size === 0) {
            matchedTags.add('genel');
            matchedTags.add('umut');
            matchedTags.add('hikmet');
        }

        const shuffle = arr => arr.slice().sort(() => Math.random() - 0.5);

        // Kutsal kitaplardan 1-2 ayet
        const holyBooks = [scriptures.quran, scriptures.bible, scriptures.torah];
        const holySelected = [];
        for (const source of holyBooks) {
            if (!source || !source.verses) continue;
            const matching = source.verses.filter(v => v.tags.some(t => matchedTags.has(t)));
            if (matching.length > 0) holySelected.push(shuffle(matching)[0]);
        }

        // Ustadlardan her zaman en az 2 söz garantili seç
        const ustadVerses = scriptures.ustadlar && scriptures.ustadlar.verses
            ? scriptures.ustadlar.verses : [];

        const matchingUstad = ustadVerses.filter(v => v.tags.some(t => matchedTags.has(t)));
        const nonMatchingUstad = ustadVerses.filter(v => !v.tags.some(t => matchedTags.has(t)));

        // Eşleşenleri önce al, eksik kalırsa diğerlerinden tamamla
        const ustadPool = shuffle(matchingUstad).concat(shuffle(nonMatchingUstad));
        const ustadSelected = ustadPool.slice(0, Math.max(2, Math.min(3, matchingUstad.length)));

        const combined = [...holySelected, ...ustadSelected];

        return combined.slice(0, 9).map(v => ({
            source: v.source,
            reference: v.reference,
            text: v.text
        }));
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
3. Asagidaki tasavvuf ustadlarinin hikmetli sozleri ve ogretileriyle gonul yolunu aydinlatmak:
   - Mevlana Celaleddin Rumi (Mesnevi, Divan-i Kebir)
   - Abdulkadir Geylani (Hakki Arayanlarin Kitabi)
   - Esrefoglu Rumi (Muzekkin Nefis, Divan)
   - Sems-i Tebrizi (Makalat)
   - Aziz Mahmut Hudai (Divan)
   - Lutfi Filiz (Noktanin Sonsuzlugu)
   - Imam Gazali (Abidler Yolu, Ihya-u Ulumi'd-din)
   - Abdulaziz Senol (Kenzi Divani)
   - Ibn Arabi (Ogutler Pinari)
   - Yunus Emre (Divan)
4. Her zaman saygiyla, yargilamadan ve sevecenlikle yaklasmak.
5. Profesyonel psikolojik tedavinin yerini almadigini gerektiginde hatirlatmak.
6. Turkce konusmak.

ZORUNLU KURAL — Her yanıtında mutlaka şunları yap:
- Kullanicinin ilk mesajindan itibaren HER YANITINA en az bir tasavvuf ustadi sozü ekle. Sozu tırnak icinde ver, ustadin adini ve eserini belirt. Ornek: "Mevlana der ki (Mesnevi): '...'"
- Buna ek olarak uygun oldugunda kutsal kitaplardan (Kuran, Incil veya Tevrat) en az bir ayet paylas.
- Her seferinde FARKLI bir ustadin sozunu sec; ayni ustad veya ayni soz tekrar etmesin.
- Sozler ve ayetler, kullanicinin anlattigi konuyla dogrudan ilgili olsun.

Yaklasim ilkelerin:
- Kullanicinin ruh halini anla, empati goster, sonra alinti sun — once insan sonra alinti.
- Kaynaklari acikca belirt: kutsal kitap ayeti paylasirken "Kuran", "Incil", "Tevrat"; tasavvuf sozu paylasirken ustad adini ve eserini (ornegin "Abdulkadir Geylani, Hakki Arayanlarin Kitabi") belirt.
- Pratik manevi tavsiyeler sun (dua, zikir, sukur pratigi, nefes egzersizi, murakabe vb.).
- Kullaniciyi ic huzura yonlendir.
- Asla belirli bir dini dayatma veya din degistirmeye tesvik etme.
- Uc dini gelenegi esit saygiyla ele al.
- Yanitlarin sicak, insani ve dogal olsun; robotik konusma.
- Alinti yaparken sadakat goster; bir sozun kime ait olduguna dair suphen varsa "bu anlamda soylenen bir sozdur" diye belirt.
- Gerektiginde "Bu konuda profesyonel bir uzmana danismanizi tavsiye ederim" de.

${verseText ? 'Asagida bu konuyla ilgili kutsal kitap ayetleri ve tasavvuf ustadlarinin hikmetli sozleri verilmistir. Bunlari yanıtinda kullan:\n\n' + verseText : ''}`;
    },

    // Supabase oturum token'ını al
    _getAuthHeader() {
        const session = Supabase.getSession();
        if (!session) throw new Error('Oturum bulunamadi. Lutfen tekrar giris yapin.');
        return 'Bearer ' + session.access_token;
    },

    // Claude API'ye mesaj gönder (Edge Function üzerinden)
    async sendMessage(messages, scriptureContext) {
        const systemPrompt = this.buildSystemPrompt(scriptureContext);
        const recentMessages = messages.slice(-20);

        const response = await fetch(this.API_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': this._getAuthHeader(),
                'apikey': 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtlaGt4Z291eWpjZXlweG10dmlwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY1MjY0MTAsImV4cCI6MjA5MjEwMjQxMH0.MV72tv-63uoV-cBEa0aCF5rgfR4BKufQO1F7zKwjvd8'
            },
            body: JSON.stringify({
                model: this.MODEL,
                max_tokens: 1024,
                system: systemPrompt,
                messages: recentMessages.map(m => ({ role: m.role, content: m.content }))
            })
        });

        if (!response.ok) {
            const err = await response.json().catch(() => ({}));
            if (response.status === 401) throw new Error('Oturum suresi doldu. Lutfen tekrar giris yapin.');
            if (response.status === 429) throw new Error('Cok fazla istek gonderildi. Lutfen biraz bekleyin.');
            throw new Error(err.error?.message || 'Baglanti hatasi: ' + response.status);
        }

        const data = await response.json();
        return data.content[0].text;
    },

    // Bağlantı testi (Edge Function)
    async testApiKey(apiKey) {
        try {
            const response = await fetch(this.API_URL, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': this._getAuthHeader(),
                    'apikey': 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtlaGt4Z291eWpjZXlweG10dmlwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY1MjY0MTAsImV4cCI6MjA5MjEwMjQxMH0.MV72tv-63uoV-cBEa0aCF5rgfR4BKufQO1F7zKwjvd8'
                },
                body: JSON.stringify({ model: this.MODEL, max_tokens: 10, messages: [{ role: 'user', content: 'test' }] })
            });
            return response.ok;
        } catch { return false; }
    },

    // Günlük içerik üret (Edge Function üzerinden)
    async generateDailyContent(apiKey) {
        const systemPrompt = `Sen manevi bir rehbersin. Kullaniciya gunluk motivasyon ve manevi destek mesaji uretiyorsun.
Turkce yaz. Kisa ve etkili bir mesaj ver (2-3 cumle). Ardindan Kuran, Incil veya Tevrat'tan uygun bir ayet paylasm.
JSON formatinda yanit ver:
{"content": "mesaj", "verse": {"source": "kaynak", "reference": "referans", "text": "ayet metni"}}`;

        const today = new Date().toLocaleDateString('tr-TR', { weekday: 'long', day: 'numeric', month: 'long' });

        let authHeader;
        try { authHeader = this._getAuthHeader(); } catch { return null; }

        const response = await fetch(this.API_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': authHeader,
                'apikey': 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtlaGt4Z291eWpjZXlweG10dmlwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY1MjY0MTAsImV4cCI6MjA5MjEwMjQxMH0.MV72tv-63uoV-cBEa0aCF5rgfR4BKufQO1F7zKwjvd8'
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
