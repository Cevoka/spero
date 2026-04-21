// supabase.js - Supabase REST API wrapper (npm gerektirmez, saf fetch)

const SUPABASE_URL = 'https://kehkxgouyjceypxmtvip.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtlaGt4Z291eWpjZXlweG10dmlwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY1MjY0MTAsImV4cCI6MjA5MjEwMjQxMH0.MV72tv-63uoV-cBEa0aCF5rgfR4BKufQO1F7zKwjvd8';
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
            // Süresi dolmuşsa null döner (refresh async gerektirir)
            if (session.expires_at && Date.now() > session.expires_at - 30000) return null;
            return session;
        } catch {
            return null;
        }
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

    async _refreshSession() {
        const raw = localStorage.getItem(SESSION_KEY);
        if (!raw) return null;
        try {
            const { refresh_token } = JSON.parse(raw);
            if (!refresh_token) return null;
            const res = await fetch(`${AUTH_URL}/token?grant_type=refresh_token`, {
                method: 'POST',
                headers: { 'apikey': SUPABASE_ANON_KEY, 'Content-Type': 'application/json' },
                body: JSON.stringify({ refresh_token })
            });
            if (!res.ok) { this._clearSession(); return null; }
            const data = await res.json();
            return this._saveSession(data);
        } catch {
            this._clearSession();
            return null;
        }
    },

    async ensureSession() {
        const session = this.getSession();
        if (session) return session;
        return await this._refreshSession();
    },

    _headers(session) {
        const h = {
            'apikey': SUPABASE_ANON_KEY,
            'Content-Type': 'application/json'
        };
        if (session && session.access_token) {
            h['Authorization'] = 'Bearer ' + session.access_token;
        }
        return h;
    },

    // --- Auth ---

    auth: {
        async requestOtp(email) {
            const res = await fetch(`${AUTH_URL}/otp`, {
                method: 'POST',
                headers: { 'apikey': SUPABASE_ANON_KEY, 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, create_user: true })
            });
            if (!res.ok) {
                const err = await res.json().catch(() => ({}));
                throw new SupabaseError(res.status, err.error_code, err.msg || 'OTP gönderilemedi');
            }
        },

        async verifyOtp(email, token) {
            const res = await fetch(`${AUTH_URL}/verify`, {
                method: 'POST',
                headers: { 'apikey': SUPABASE_ANON_KEY, 'Content-Type': 'application/json' },
                body: JSON.stringify({ type: 'email', email, token })
            });
            if (!res.ok) {
                const err = await res.json().catch(() => ({}));
                throw new SupabaseError(res.status, err.error_code, 'Geçersiz veya süresi dolmuş kod.');
            }
            const data = await res.json();
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

        async getUser() {
            const session = await Supabase.ensureSession();
            if (!session) return null;
            const res = await fetch(`${AUTH_URL}/user`, {
                headers: Supabase._headers(session)
            });
            if (!res.ok) return null;
            return await res.json();
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
            const prefer = onConflict
                ? `return=representation,resolution=merge-duplicates`
                : 'return=representation,resolution=merge-duplicates';
            const params = onConflict ? `?on_conflict=${onConflict}` : '';
            const res = await fetch(`${REST_URL}/${table}${params}`, {
                method: 'POST',
                headers: { ...Supabase._headers(session), 'Prefer': prefer },
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
