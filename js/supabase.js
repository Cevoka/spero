// supabase.js - Supabase REST API wrapper (npm gerektirmez, saf fetch)

const SUPABASE_URL = 'https://kehkxgouyjceypxmtvip.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtlaGt4Z291eWpjZXlweG10dmlwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY1MjY0MTAsImV4cCI6MjA5MjEwMjQxMH0.MV72tv-63uoV-cBEa0aCF5rgfR4BKufQO1F7zKwjvd8';
const SITE_URL = 'https://cevoka.github.io/spero/';
const REST_URL = SUPABASE_URL + '/rest/v1';
const AUTH_URL = SUPABASE_URL + '/auth/v1';
const SESSION_KEY = 'rr_sb_session';

class SupabaseError extends Error {
    constructor(status, code, message) {
        super(message);
        this.status = status;
        this.code = code;
    }
}

const Supabase = {

    // --- Session yönetimi ---

    getSession() {
        try {
            const raw = localStorage.getItem(SESSION_KEY);
            if (!raw) return null;
            const session = JSON.parse(raw);
            if (!session || !session.access_token) return null;
            if (session.expires_at && Date.now() > session.expires_at - 300000) return null;
            return session;
        } catch {
            return null;
        }
    },

    // Süresi dolmuş olsa bile yenilenebilir bir oturum var mı?
    hasSession() {
        try {
            const raw = localStorage.getItem(SESSION_KEY);
            if (!raw) return false;
            const s = JSON.parse(raw);
            return !!(s && s.refresh_token);
        } catch { return false; }
    },

    _saveSession(data) {
        const session = {
            access_token: data.access_token,
            refresh_token: data.refresh_token,
            expires_at: Date.now() + ((data.expires_in || 3600) * 1000),
            user: data.user
        };
        localStorage.setItem(SESSION_KEY, JSON.stringify(session));
        return session;
    },

    _clearSession() {
        localStorage.removeItem(SESSION_KEY);
    },

    _refreshPromise: null,

    async _refreshSession() {
        // Eş zamanlı refresh isteklerini tek promise'e indir (token rotation race condition önlemi)
        if (this._refreshPromise) return this._refreshPromise;
        this._refreshPromise = (async () => {
            try {
                const raw = localStorage.getItem(SESSION_KEY);
                if (!raw) return null;
                const stored = JSON.parse(raw);
                if (!stored.refresh_token) return null;
                const res = await fetch(`${AUTH_URL}/token?grant_type=refresh_token`, {
                    method: 'POST',
                    headers: { 'apikey': SUPABASE_ANON_KEY, 'Content-Type': 'application/json' },
                    body: JSON.stringify({ refresh_token: stored.refresh_token })
                });
                if (!res.ok) { this._clearSession(); return null; }
                const data = await res.json();
                return this._saveSession(data);
            } catch {
                this._clearSession();
                return null;
            } finally {
                this._refreshPromise = null;
            }
        })();
        return this._refreshPromise;
    },

    async ensureSession() {
        const session = this.getSession();
        if (session) return session;
        return await this._refreshSession();
    },

    // Onay linkinden gelen URL fragment'ını işle (#access_token=...&type=signup)
    handleRedirect() {
        const hash = window.location.hash.substring(1);
        if (!hash) return null;
        const params = new URLSearchParams(hash);
        const accessToken = params.get('access_token');
        const refreshToken = params.get('refresh_token');
        const type = params.get('type'); // 'signup' | 'recovery' | null
        if (!accessToken) return null;

        const expiresIn = parseInt(params.get('expires_in') || '3600', 10);
        const session = this._saveSession({
            access_token: accessToken,
            refresh_token: refreshToken,
            expires_in: expiresIn,
            user: null // getUser() ile doldurulur
        });

        // URL'den hash'i temizle (güvenlik + görünüm)
        window.history.replaceState(null, '', window.location.pathname + window.location.search);
        return { session, type };
    },

    _headers(session) {
        const h = { 'apikey': SUPABASE_ANON_KEY, 'Content-Type': 'application/json' };
        if (session && session.access_token) {
            h['Authorization'] = 'Bearer ' + session.access_token;
        }
        return h;
    },

    // --- Auth ---

    auth: {
        async signUp(email, password) {
            // redirect_to query param olarak verilmeli (body içinde değil)
            const url = `${AUTH_URL}/signup?redirect_to=${encodeURIComponent(SITE_URL)}`;
            const res = await fetch(url, {
                method: 'POST',
                headers: { 'apikey': SUPABASE_ANON_KEY, 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password })
            });
            const data = await res.json();
            if (!res.ok) {
                const msg = data.msg || data.message || 'Kayıt başarısız.';
                if (data.error_code === 'user_already_exists' || msg.toLowerCase().includes('already')) {
                    throw new SupabaseError(res.status, 'user_exists', 'Bu e-posta zaten kayıtlı. Giriş yapın.');
                }
                throw new SupabaseError(res.status, data.error_code, msg);
            }
            // identities boşsa e-posta zaten kayıtlı ama onaysız
            if (data.identities && data.identities.length === 0) {
                throw new SupabaseError(400, 'user_exists', 'Bu e-posta zaten kayıtlı. Giriş yapın.');
            }
            return data;
        },

        async signInWithPassword(email, password) {
            const res = await fetch(`${AUTH_URL}/token?grant_type=password`, {
                method: 'POST',
                headers: { 'apikey': SUPABASE_ANON_KEY, 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password })
            });
            const data = await res.json();
            if (!res.ok) {
                // Supabase hata alanı: data.error_code ve data.msg
                const code = data.error_code || data.error || '';
                const msg = data.msg || data.message || '';
                if (code === 'invalid_credentials' || code === 'bad_json' || msg.toLowerCase().includes('invalid')) {
                    throw new SupabaseError(400, 'invalid_credentials', 'E-posta veya şifre hatalı.');
                }
                if (code === 'email_not_confirmed') {
                    throw new SupabaseError(400, 'email_not_confirmed', 'E-posta adresiniz henüz onaylanmamış. Gelen kutunuzu kontrol edin.');
                }
                throw new SupabaseError(res.status, code, msg || 'Giriş başarısız.');
            }
            return Supabase._saveSession(data);
        },

        async signOut() {
            const session = Supabase.getSession();
            if (session) {
                await fetch(`${AUTH_URL}/logout`, {
                    method: 'POST',
                    headers: Supabase._headers(session)
                }).catch(() => {});
            }
            Supabase._clearSession();
        },

        async resetPasswordRequest(email) {
            const res = await fetch(`${AUTH_URL}/recover`, {
                method: 'POST',
                headers: { 'apikey': SUPABASE_ANON_KEY, 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, options: { redirectTo: SITE_URL } })
            });
            // Her zaman başarılı gibi döner (e-posta varsa gönderir, yoksa sessiz)
            return res.ok;
        },

        async getUser() {
            const session = await Supabase.ensureSession();
            if (!session) return null;
            const res = await fetch(`${AUTH_URL}/user`, {
                headers: Supabase._headers(session)
            });
            if (!res.ok) return null;
            const user = await res.json();
            // Session'daki user'ı da güncelle
            const stored = localStorage.getItem(SESSION_KEY);
            if (stored) {
                try {
                    const s = JSON.parse(stored);
                    s.user = user;
                    localStorage.setItem(SESSION_KEY, JSON.stringify(s));
                } catch {}
            }
            return user;
        }
    },

    // --- DB (PostgREST) ---

    db: {
        _buildQuery(filters) {
            if (!filters) return '';
            return Object.entries(filters)
                .map(([k, v]) => `${k}=eq.${encodeURIComponent(v)}`)
                .join('&');
        },

        async select(table, { select = '*', filters, order, limit, offset } = {}) {
            const session = await Supabase.ensureSession();
            const params = new URLSearchParams();
            params.set('select', select);
            if (filters) Object.entries(filters).forEach(([k, v]) => params.set(k, `eq.${v}`));
            if (order) params.set('order', order);
            if (limit) params.set('limit', String(limit));
            if (offset) params.set('offset', String(offset));

            const res = await fetch(`${REST_URL}/${table}?${params}`, {
                headers: Supabase._headers(session)
            });
            if (!res.ok) {
                const err = await res.json().catch(() => ({}));
                throw new SupabaseError(res.status, err.code, err.message || 'Veri okunamadı');
            }
            return await res.json();
        },

        async insert(table, row) {
            const session = await Supabase.ensureSession();
            const res = await fetch(`${REST_URL}/${table}`, {
                method: 'POST',
                headers: { ...Supabase._headers(session), 'Prefer': 'return=representation' },
                body: JSON.stringify(row)
            });
            if (!res.ok) {
                const err = await res.json().catch(() => ({}));
                throw new SupabaseError(res.status, err.code, err.message || 'Kayıt eklenemedi');
            }
            const data = await res.json();
            return Array.isArray(data) ? data[0] : data;
        },

        async update(table, row, filters) {
            const session = await Supabase.ensureSession();
            const query = this._buildQuery(filters);
            const res = await fetch(`${REST_URL}/${table}?${query}`, {
                method: 'PATCH',
                headers: { ...Supabase._headers(session), 'Prefer': 'return=representation' },
                body: JSON.stringify(row)
            });
            if (!res.ok) {
                const err = await res.json().catch(() => ({}));
                throw new SupabaseError(res.status, err.code, err.message || 'Kayıt güncellenemedi');
            }
            const data = await res.json();
            return Array.isArray(data) ? data[0] : data;
        },

        async upsert(table, row, onConflict) {
            const session = await Supabase.ensureSession();
            const params = onConflict ? `?on_conflict=${onConflict}` : '';
            const res = await fetch(`${REST_URL}/${table}${params}`, {
                method: 'POST',
                headers: {
                    ...Supabase._headers(session),
                    'Prefer': 'return=representation,resolution=merge-duplicates'
                },
                body: JSON.stringify(row)
            });
            if (!res.ok) {
                const err = await res.json().catch(() => ({}));
                throw new SupabaseError(res.status, err.code, err.message || 'Upsert başarısız');
            }
            const data = await res.json();
            return Array.isArray(data) ? data[0] : data;
        },

        async delete(table, filters) {
            const session = await Supabase.ensureSession();
            const query = this._buildQuery(filters);
            const res = await fetch(`${REST_URL}/${table}?${query}`, {
                method: 'DELETE',
                headers: Supabase._headers(session)
            });
            if (!res.ok) {
                const err = await res.json().catch(() => ({}));
                throw new SupabaseError(res.status, err.code, err.message || 'Kayıt silinemedi');
            }
        }
    }
};
