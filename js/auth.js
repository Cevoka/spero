// auth.js - Email + Şifre kimlik doğrulama (Supabase)

const Auth = {

    async register(email, password) {
        email = email.trim().toLowerCase();
        if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
            throw new Error('Geçerli bir e-posta adresi girin.');
        }
        if (!password || password.length < 6) {
            throw new Error('Şifre en az 6 karakter olmalıdır.');
        }
        await Supabase.auth.signUp(email, password);
        // Başarı: kullanıcıya onay maili gönderildi, session yok henüz
        return 'confirmation_sent';
    },

    async login(email, password) {
        email = email.trim().toLowerCase();
        if (!email || !password) {
            throw new Error('E-posta ve şifre zorunludur.');
        }
        const session = await Supabase.auth.signInWithPassword(email, password);
        // display_name profil tablosundan al
        let displayName = null;
        try {
            const rows = await Supabase.db.select('profiles', {
                select: 'display_name',
                filters: { id: session.user.id }
            });
            if (rows && rows[0] && rows[0].display_name) {
                displayName = rows[0].display_name;
            }
        } catch {}
        if (!displayName) displayName = email.split('@')[0];
        Storage.setCurrentUser(displayName);
        return { session, displayName };
    },

    // Onay linkinden dönen URL hash'ini işle
    async handleEmailConfirmation() {
        const result = Supabase.handleRedirect();
        if (!result) return null;
        // Kullanıcı bilgilerini çek ve kaydet
        try {
            const user = await Supabase.auth.getUser();
            if (user) {
                const displayName = user.user_metadata?.display_name || user.email.split('@')[0];
                Storage.setCurrentUser(displayName);
                return { type: result.type, displayName };
            }
        } catch {}
        return { type: result.type, displayName: null };
    },

    logout() {
        Supabase.auth.signOut().catch(() => {});
        Storage.removeCurrentUser();
        window.location.href = 'index.html';
    },

    getCurrentUser() {
        const cached = Storage.getCurrentUser();
        if (cached) return cached;
        const session = Supabase.getSession();
        if (!session) return null;
        return session.user?.user_metadata?.display_name
            || session.user?.email?.split('@')[0]
            || null;
    },

    getUserId() {
        const session = Supabase.getSession();
        return session ? session.user?.id : null;
    },

    isLoggedIn() {
        return !!(Storage.getCurrentUser() || Supabase.hasSession());
    },

    requireAuth() {
        if (!this.isLoggedIn()) {
            window.location.href = 'index.html';
            return false;
        }
        return true;
    }
};
