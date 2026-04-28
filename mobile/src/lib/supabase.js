// Supabase wrapper — AsyncStorage backed session
import AsyncStorage from '@react-native-async-storage/async-storage';

const SUPABASE_URL = 'https://kehkxgouyjceypxmtvip.supabase.co';
const SUPABASE_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtlaGt4Z291eWpjZXlweG10dmlwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY1MjY0MTAsImV4cCI6MjA5MjEwMjQxMH0.MV72tv-63uoV-cBEa0aCF5rgfR4BKufQO1F7zKwjvd8';
const REST_URL = SUPABASE_URL + '/rest/v1';
const AUTH_URL = SUPABASE_URL + '/auth/v1';
const SESSION_KEY = 'rr_sb_session';

export { SUPABASE_URL, SUPABASE_ANON_KEY };

export class SupabaseError extends Error {
  constructor(status, code, message) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

let _sessionCache = null;
let _refreshPromise = null;

async function _readRaw() {
  try {
    const raw = await AsyncStorage.getItem(SESSION_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

async function _writeRaw(session) {
  await AsyncStorage.setItem(SESSION_KEY, JSON.stringify(session));
  _sessionCache = session;
}

async function _clear() {
  await AsyncStorage.removeItem(SESSION_KEY);
  _sessionCache = null;
}

async function _saveSession(data) {
  const session = {
    access_token: data.access_token,
    refresh_token: data.refresh_token,
    expires_at: Date.now() + ((data.expires_in || 3600) * 1000),
    user: data.user,
  };
  await _writeRaw(session);
  return session;
}

export const Supabase = {
  async getSession() {
    if (_sessionCache) {
      const s = _sessionCache;
      if (s.expires_at && Date.now() > s.expires_at - 300000) return null;
      return s;
    }
    const session = await _readRaw();
    if (!session || !session.access_token) return null;
    _sessionCache = session;
    if (session.expires_at && Date.now() > session.expires_at - 300000) return null;
    return session;
  },

  async hasSession() {
    const s = _sessionCache || (await _readRaw());
    return !!(s && s.refresh_token);
  },

  async _refreshSession() {
    if (_refreshPromise) return _refreshPromise;
    _refreshPromise = (async () => {
      try {
        const stored = _sessionCache || (await _readRaw());
        if (!stored || !stored.refresh_token) return null;
        const res = await fetch(`${AUTH_URL}/token?grant_type=refresh_token`, {
          method: 'POST',
          headers: { apikey: SUPABASE_ANON_KEY, 'Content-Type': 'application/json' },
          body: JSON.stringify({ refresh_token: stored.refresh_token }),
        });
        if (!res.ok) {
          await _clear();
          return null;
        }
        const data = await res.json();
        return await _saveSession(data);
      } catch {
        await _clear();
        return null;
      } finally {
        _refreshPromise = null;
      }
    })();
    return _refreshPromise;
  },

  async ensureSession() {
    const s = await this.getSession();
    if (s) return s;
    return await this._refreshSession();
  },

  async _headers(session) {
    const h = { apikey: SUPABASE_ANON_KEY, 'Content-Type': 'application/json' };
    if (session && session.access_token) h.Authorization = 'Bearer ' + session.access_token;
    return h;
  },

  auth: {
    async signUp(email, password) {
      const res = await fetch(`${AUTH_URL}/signup`, {
        method: 'POST',
        headers: { apikey: SUPABASE_ANON_KEY, 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        const msg = data.msg || data.message || 'Kayit basarisiz.';
        if (data.error_code === 'user_already_exists' || (msg && msg.toLowerCase().includes('already'))) {
          throw new SupabaseError(res.status, 'user_exists', 'Bu e-posta zaten kayitli. Giris yapin.');
        }
        throw new SupabaseError(res.status, data.error_code, msg);
      }
      if (data.identities && data.identities.length === 0) {
        throw new SupabaseError(400, 'user_exists', 'Bu e-posta zaten kayitli. Giris yapin.');
      }
      // Bazı projelerde onay kapalıdır — session doğrudan döner
      if (data.access_token) await _saveSession(data);
      return data;
    },

    async signInWithPassword(email, password) {
      const res = await fetch(`${AUTH_URL}/token?grant_type=password`, {
        method: 'POST',
        headers: { apikey: SUPABASE_ANON_KEY, 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        const code = data.error_code || data.error || '';
        const msg = data.msg || data.message || '';
        if (code === 'invalid_credentials' || code === 'bad_json' || (msg && msg.toLowerCase().includes('invalid'))) {
          throw new SupabaseError(400, 'invalid_credentials', 'E-posta veya sifre hatali.');
        }
        if (code === 'email_not_confirmed') {
          throw new SupabaseError(400, 'email_not_confirmed', 'E-posta adresiniz henuz onaylanmamis. Gelen kutunuzu kontrol edin.');
        }
        throw new SupabaseError(res.status, code, msg || 'Giris basarisiz.');
      }
      return await _saveSession(data);
    },

    async signOut() {
      const session = await Supabase.getSession();
      if (session) {
        try {
          await fetch(`${AUTH_URL}/logout`, {
            method: 'POST',
            headers: await Supabase._headers(session),
          });
        } catch {}
      }
      await _clear();
    },

    async resetPasswordRequest(email) {
      const res = await fetch(`${AUTH_URL}/recover`, {
        method: 'POST',
        headers: { apikey: SUPABASE_ANON_KEY, 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      return res.ok;
    },

    async getUser() {
      const session = await Supabase.ensureSession();
      if (!session) return null;
      const res = await fetch(`${AUTH_URL}/user`, {
        headers: await Supabase._headers(session),
      });
      if (!res.ok) return null;
      return await res.json();
    },
  },

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
      const res = await fetch(`${REST_URL}/${table}?${params.toString()}`, {
        headers: await Supabase._headers(session),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new SupabaseError(res.status, err.code, err.message || 'Veri okunamadi');
      }
      return await res.json();
    },

    async insert(table, row) {
      const session = await Supabase.ensureSession();
      const res = await fetch(`${REST_URL}/${table}`, {
        method: 'POST',
        headers: { ...(await Supabase._headers(session)), Prefer: 'return=representation' },
        body: JSON.stringify(row),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new SupabaseError(res.status, err.code, err.message || 'Kayit eklenemedi');
      }
      const data = await res.json();
      return Array.isArray(data) ? data[0] : data;
    },

    async update(table, row, filters) {
      const session = await Supabase.ensureSession();
      const query = this._buildQuery(filters);
      const res = await fetch(`${REST_URL}/${table}?${query}`, {
        method: 'PATCH',
        headers: { ...(await Supabase._headers(session)), Prefer: 'return=representation' },
        body: JSON.stringify(row),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new SupabaseError(res.status, err.code, err.message || 'Kayit guncellenemedi');
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
          ...(await Supabase._headers(session)),
          Prefer: 'return=representation,resolution=merge-duplicates',
        },
        body: JSON.stringify(row),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new SupabaseError(res.status, err.code, err.message || 'Upsert basarisiz');
      }
      const data = await res.json();
      return Array.isArray(data) ? data[0] : data;
    },

    async delete(table, filters) {
      const session = await Supabase.ensureSession();
      const query = this._buildQuery(filters);
      const res = await fetch(`${REST_URL}/${table}?${query}`, {
        method: 'DELETE',
        headers: await Supabase._headers(session),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new SupabaseError(res.status, err.code, err.message || 'Kayit silinemedi');
      }
    },
  },
};
