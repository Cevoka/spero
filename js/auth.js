// auth.js - Email + OTP kimlik doğrulama (Supabase)

const Auth = {
    _pendingEmail: null,

    async requestOtp(email) {
        email = email.trim().toLowerCase();
        if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
            throw new Error('Geçerli bir e-posta adresi girin.');
        }

        // Geçerli oturum varsa doğrulama atla
        const existing = await Supabase.ensureSession();
        if (existing) {
            const storedEmail = existing.user && existing.user.email;
            if (storedEmail === email) return 'already_logged_in';
        }

        await Supabase.auth.requestOtp(email);
        this._pendingEmail = email;
        return 'otp_sent';
    },

    async verifyOtp(token) {
        if (!this._pendingEmail) throw new Error('Önce e-posta adresinizi girin.');
        token = token.trim();
        if (!token || !/^\d{6}$/.test(token)) {
            throw new Error('6 haneli kodu doğru girin.');
        }

        const session = await Supabase.auth.verifyOtp(this._pendingEmail, token);

        // Display name: profil tablosundan al, yoksa email prefix
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

        if (!displayName) {
            displayName = this._pendingEmail.split('@')[0];
        }

        Storage.setCurrentUser(displayName);
        this._pendingEmail = null;
        return { session, displayName };
    },

    logout() {
        Supabase.auth.signOut().catch(() => {});
        Storage.removeCurrentUser();
        window.location.href = 'index.html';
    },

    getCurrentUser() {
        // Önce localStorage cache'e bak (sync, hızlı)
        const cached = Storage.getCurrentUser();
        if (cached) return cached;
        // Supabase session'dan türet
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
        return !!(Storage.getCurrentUser() || Supabase.getSession());
    },

    requireAuth() {
        if (!this.isLoggedIn()) {
            window.location.href = 'index.html';
            return false;
        }
        return true;
    }
};
