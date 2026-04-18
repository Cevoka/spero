// chat.js - Sohbet UI mantığı

const Chat = {
    currentConvo: null,
    username: null,
    scriptures: null,
    isLoading: false,

    async init() {
        this.username = Auth.getCurrentUser();
        if (!this.username) return;

        // Ayetleri yükle
        this.scriptures = await API.loadScriptures();

        // Mevcut konuşmayı yükle veya yeni başlat
        const activeId = Storage.getActiveConvoId(this.username);
        if (activeId) {
            this.currentConvo = Storage.getConversation(this.username, activeId);
        }

        if (!this.currentConvo) {
            this.startNewConversation(false);
        }

        this.renderMessages();
        this.setupEventListeners();
        this.checkApiKey();
        this.scrollToBottom();
    },

    startNewConversation(archiveCurrent) {
        if (archiveCurrent && this.currentConvo && this.currentConvo.messages.length > 0) {
            // Mevcut konuşmayı kaydet (zaten kaydedilmiş ama emin ol)
            Storage.saveConversation(this.username, this.currentConvo);
        }

        this.currentConvo = {
            id: App.generateId(),
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            preview: '',
            messages: []
        };

        Storage.setActiveConvoId(this.username, this.currentConvo.id);
        Storage.saveConversation(this.username, this.currentConvo);

        const messagesDiv = document.getElementById('chat-messages');
        if (messagesDiv) {
            messagesDiv.innerHTML = this.getWelcomeMessage();
        }
    },

    getWelcomeMessage() {
        return `
            <div class="message message-assistant">
                <div>Merhaba! Ben JESSE. Sana manevi ve duygusal destek sunmak icin buradayim.
                <br><br>Bugun nasil hissediyorsun? Icini acmak istedigin bir konu var mi?</div>
                <div class="message-time">JESSE</div>
            </div>
        `;
    },

    checkApiKey() {
        const apiKey = Storage.getApiKey();
        const warning = document.getElementById('api-warning');
        if (!apiKey && warning) {
            warning.style.display = '';
        } else if (warning) {
            warning.style.display = 'none';
        }
    },

    renderMessages() {
        const messagesDiv = document.getElementById('chat-messages');
        if (!messagesDiv) return;

        if (!this.currentConvo || this.currentConvo.messages.length === 0) {
            messagesDiv.innerHTML = this.getWelcomeMessage();
            return;
        }

        messagesDiv.innerHTML = this.currentConvo.messages.map(m =>
            this.createMessageHtml(m.role, m.content, m.timestamp)
        ).join('');
    },

    createMessageHtml(role, content, timestamp) {
        const cssClass = role === 'user' ? 'message-user' : 'message-assistant';
        const timeStr = timestamp ? App.formatTime(timestamp) : '';
        const escapedContent = App.escapeHtml(content).replace(/\n/g, '<br>');

        return `
            <div class="message ${cssClass}">
                <div>${escapedContent}</div>
                <div class="message-time">${timeStr}</div>
            </div>
        `;
    },

    addMessageToUI(role, content, timestamp) {
        const messagesDiv = document.getElementById('chat-messages');
        if (!messagesDiv) return;

        // Hoş geldin mesajını kaldır (ilk mesajsa)
        if (this.currentConvo.messages.length <= 1 && role === 'user') {
            const welcomeMsg = messagesDiv.querySelector('.message-assistant');
            if (welcomeMsg && messagesDiv.children.length === 1) {
                messagesDiv.innerHTML = '';
            }
        }

        messagesDiv.insertAdjacentHTML('beforeend',
            this.createMessageHtml(role, content, timestamp)
        );
        this.scrollToBottom();
    },

    showTypingIndicator() {
        const messagesDiv = document.getElementById('chat-messages');
        if (!messagesDiv) return;

        const indicator = document.createElement('div');
        indicator.className = 'typing-indicator';
        indicator.id = 'typing-indicator';
        indicator.innerHTML = '<div class="typing-dot"></div><div class="typing-dot"></div><div class="typing-dot"></div>';
        messagesDiv.appendChild(indicator);
        this.scrollToBottom();
    },

    hideTypingIndicator() {
        const indicator = document.getElementById('typing-indicator');
        if (indicator) indicator.remove();
    },

    scrollToBottom() {
        const messagesDiv = document.getElementById('chat-messages');
        if (messagesDiv) {
            messagesDiv.scrollTop = messagesDiv.scrollHeight;
        }
    },

    async sendMessage() {
        if (this.isLoading) return;

        const input = document.getElementById('chat-input');
        const text = input.value.trim();
        if (!text) return;

        const apiKey = Storage.getApiKey();
        if (!apiKey) {
            this.showToast('Lutfen once Ayarlar sayfasindan API anahtarinizi girin.', 'error');
            return;
        }

        // Kullanıcı mesajını ekle
        const timestamp = new Date().toISOString();
        const userMsg = { role: 'user', content: text, timestamp };
        this.currentConvo.messages.push(userMsg);

        // Preview güncelle (ilk mesaj)
        if (this.currentConvo.messages.length === 1) {
            this.currentConvo.preview = text.substring(0, 80);
        }

        this.currentConvo.updatedAt = timestamp;
        Storage.saveConversation(this.username, this.currentConvo);

        // UI güncelle
        this.addMessageToUI('user', text, timestamp);
        input.value = '';
        input.style.height = 'auto';

        // Yükleniyor göster
        this.isLoading = true;
        this.updateSendButton();
        this.showTypingIndicator();

        try {
            // İlgili ayetleri bul
            const verses = API.findRelevantVerses(text, this.scriptures);

            // Format scripture context with source info
            const scriptureContext = verses.map(v => ({
                source: this.getSourceName(v),
                reference: v.reference,
                text: v.text
            }));

            // API'ye gönder
            const response = await API.sendMessage(
                apiKey,
                this.currentConvo.messages,
                scriptureContext
            );

            // AI yanıtını ekle
            const aiTimestamp = new Date().toISOString();
            const aiMsg = { role: 'assistant', content: response, timestamp: aiTimestamp };
            this.currentConvo.messages.push(aiMsg);
            this.currentConvo.updatedAt = aiTimestamp;
            Storage.saveConversation(this.username, this.currentConvo);

            this.hideTypingIndicator();
            this.addMessageToUI('assistant', response, aiTimestamp);

        } catch (error) {
            this.hideTypingIndicator();
            this.showToast(error.message, 'error');
        } finally {
            this.isLoading = false;
            this.updateSendButton();
        }
    },

    getSourceName(verse) {
        // Ayetin hangi kaynaktan geldiğini bul
        if (!this.scriptures) return '';
        if (this.scriptures.quran.verses.some(v => v.id === verse.id)) return 'Kuran';
        if (this.scriptures.bible.verses.some(v => v.id === verse.id)) return 'Incil';
        if (this.scriptures.torah.verses.some(v => v.id === verse.id)) return 'Tevrat';
        return '';
    },

    updateSendButton() {
        const btn = document.getElementById('send-btn');
        if (btn) btn.disabled = this.isLoading;
    },

    showToast(msg, type) {
        // Basit toast bildirimi
        let toast = document.getElementById('toast');
        if (!toast) {
            toast = document.createElement('div');
            toast.id = 'toast';
            toast.className = 'toast';
            document.body.appendChild(toast);
        }
        toast.textContent = msg;
        toast.className = 'toast ' + (type || '');
        toast.classList.add('show');
        setTimeout(() => toast.classList.remove('show'), 4000);
    },

    setupEventListeners() {
        const input = document.getElementById('chat-input');
        const sendBtn = document.getElementById('send-btn');
        const newConvoBtn = document.getElementById('new-convo-btn');

        // Gönder butonu
        if (sendBtn) {
            sendBtn.addEventListener('click', () => this.sendMessage());
        }

        // Textarea
        if (input) {
            // Enter ile gönder (Shift+Enter yeni satır)
            input.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    this.sendMessage();
                }
            });

            // Auto-resize
            input.addEventListener('input', () => {
                input.style.height = 'auto';
                input.style.height = Math.min(input.scrollHeight, 120) + 'px';
            });
        }

        // Yeni konuşma
        if (newConvoBtn) {
            newConvoBtn.addEventListener('click', () => {
                if (this.currentConvo.messages.length === 0 ||
                    confirm('Yeni bir konusma baslatmak istiyor musunuz? Mevcut konusma gecmiste saklanacaktir.')) {
                    this.startNewConversation(true);
                }
            });
        }
    }
};

// Sayfa yüklendiğinde başlat
document.addEventListener('DOMContentLoaded', () => {
    if (!Auth.requireAuth()) return;
    App.renderNav();
    Chat.init();
});
