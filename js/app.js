// app.js - Ortak yardımcılar, navigasyon, günlük içerik

const App = {
    formatDate(dateStr) {
        const d = new Date(dateStr);
        return d.toLocaleDateString('tr-TR', {
            day: 'numeric', month: 'long', year: 'numeric'
        });
    },

    formatTime(dateStr) {
        const d = new Date(dateStr);
        return d.toLocaleTimeString('tr-TR', {
            hour: '2-digit', minute: '2-digit'
        });
    },

    formatDateTime(dateStr) {
        return this.formatDate(dateStr) + ' ' + this.formatTime(dateStr);
    },

    generateId() {
        return 'conv_' + Date.now() + '_' + Math.random().toString(36).substring(2, 8);
    },

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    },

    renderNav() {
        const nav = document.getElementById('main-nav');
        if (!nav) return;

        const user = Auth.getCurrentUser();
        if (!user) {
            nav.style.display = 'none';
            return;
        }

        nav.innerHTML = `
            <div class="nav-inner">
                <a href="index.html" class="nav-logo"><img src="assets/jesse-logo.jpg" alt="JESSE" class="nav-logo-img"></a>
                <div class="nav-links">
                    <a href="chat.html" class="nav-link">Sohbet</a>
                    <a href="history.html" class="nav-link">Gecmis</a>
                    <a href="settings.html" class="nav-link">Ayarlar</a>
                </div>
                <div class="nav-user">
                    <span class="nav-username">${App.escapeHtml(user)}</span>
                    <button onclick="Auth.logout()" class="nav-logout">Cikis</button>
                </div>
            </div>
        `;
    },

    // Statik fallback günlük mesajlar
    fallbackMessages: [
        { content: "Sabır, kalbin huzura ulaşma yolculuğudur. Bugün sabrınla güçlen.", verse: { source: "Kuran", reference: "Bakara 153", text: "Ey iman edenler! Sabır ve namaz ile Allah'tan yardım isteyin." } },
        { content: "Sevgi, tüm dinlerin ortak dilidir. Bugün etrafına sevgi saç.", verse: { source: "İncil", reference: "1. Korintliler 13:4", text: "Sevgi sabırlıdır, sevgi şefkatlidir." } },
        { content: "Şükür, bereketin anahtarıdır. Sahip olduklarına şükret.", verse: { source: "Kuran", reference: "İbrahim 7", text: "Eğer şükrederseniz, elbette size nimetimi artırırım." } },
        { content: "Umut, karanlıktaki ışıktır. Asla umudunu kaybetme.", verse: { source: "Tevrat", reference: "Mezmurlar 46:1", text: "Allah bizim sığınağımız ve kuvvetimizdir." } },
        { content: "Merhamet göstermek, ruhun en güzel ibadetidir.", verse: { source: "Kuran", reference: "Enbiya 107", text: "Seni ancak alemlere rahmet olarak gönderdik." } },
        { content: "İç huzur, dışarıda değil kalbinde bulunur.", verse: { source: "İncil", reference: "Yuhanna 14:27", text: "Size esenlik bırakıyorum, size kendi esenliğimi veriyorum." } },
        { content: "Her yeni gün, yeni bir başlangıçtır.", verse: { source: "Tevrat", reference: "Ağıtlar 3:22-23", text: "Rabbin iyilikleri tükenmez, her sabah yenidir." } },
        { content: "Kendini bilmek, en büyük ilimdir. Bugün bir an durup içine bak.", verse: { source: "Yunus Emre", reference: "Divan", text: "İlim ilim bilmektir, ilim kendin bilmektir. Sen kendini bilmezsin, ya nice okumaktır." } },
        { content: "Samimiyet, ruhun temizliğinin alametidir. Olduğun gibi görün.", verse: { source: "Mevlana", reference: "Divan-ı Kebir", text: "Ya olduğun gibi görün, ya göründüğün gibi ol." } },
        { content: "Kalbini sevgiyle doldur; yaratılanı Yaratan'dan ötürü sev.", verse: { source: "Yunus Emre", reference: "Divan", text: "Yaratılanı severiz Yaratan'dan ötürü." } },
        { content: "Nefsi tanımak, manevi yolculuğun ilk adımıdır.", verse: { source: "İmam Gazali", reference: "İhya-u Ulumi'd-din", text: "İnsanın en büyük düşmanı kendi nefsidir; onu tanımayan hayatını tanımamış olur." } },
        { content: "Aşk, varlığın özü ve bütün dinlerin ortak dilidir.", verse: { source: "Fuzuli", reference: "Divan Önsözü", text: "Aşk imiş her ne var âlemde; ilim bir kıl u kâl imiş ancak." } },
        { content: "Dünü bırak, bugünü aç bir sayfa olarak karşıla.", verse: { source: "Mevlana", reference: "Mesnevi", text: "Dünle beraber gitti dün, ne kadar söz varsa düne ait. Şimdi yeni şeyler söylemek lazım." } },
        { content: "Dünyaya gönlünü kaptırma; geçici olan şeylere kalıcı değer verme.", verse: { source: "Esrefoglu Rumi", reference: "Divan", text: "Bu dünyaya verme gönül, dünya sana kalmaz." } },
        { content: "Kalbi bulmak, tüm arayışların sonudur. Bugün içine dön.", verse: { source: "Lutfi Filiz", reference: "Noktanın Sonsuzluğu", text: "İnsan, Allah'ı kalbinde bulabilirse miraç etmiş olur." } }
    ],

    getDailyContent(username) {
        const today = new Date().toISOString().split('T')[0];
        const cached = Storage.getDailyContent(username);

        if (cached && cached.date === today) {
            return cached;
        }

        // Güne göre sabit bir fallback mesaj seç
        const dayIndex = new Date().getDate() % this.fallbackMessages.length;
        const msg = this.fallbackMessages[dayIndex];
        const content = {
            date: today,
            content: msg.content,
            verses: [msg.verse],
            generated: false
        };

        Storage.setDailyContent(username, content);
        return content;
    },

    init() {
        Storage.migrate();
        this.renderNav();
    }
};

// Sayfa yüklendiğinde init çalıştır
document.addEventListener('DOMContentLoaded', () => {
    App.init();
});
