// auth.js — Supabase email/password auth
import { Supabase } from './supabase';

export const Auth = {
  async register(email, password) {
    email = email.trim().toLowerCase();
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      throw new Error('Gecerli bir e-posta adresi girin.');
    }
    if (!password || password.length < 6) {
      throw new Error('Sifre en az 6 karakter olmalidir.');
    }
    await Supabase.auth.signUp(email, password);
    return 'confirmation_sent';
  },

  async login(email, password) {
    email = email.trim().toLowerCase();
    if (!email || !password) throw new Error('E-posta ve sifre zorunludur.');
    const session = await Supabase.auth.signInWithPassword(email, password);
    let displayName = null;
    try {
      const rows = await Supabase.db.select('profiles', {
        select: 'display_name',
        filters: { id: session.user.id },
      });
      if (rows && rows[0] && rows[0].display_name) displayName = rows[0].display_name;
    } catch {}
    if (!displayName) displayName = email.split('@')[0];
    return { session, displayName };
  },

  async logout() {
    try {
      await Supabase.auth.signOut();
    } catch {}
  },

  async getUserId() {
    const session = await Supabase.getSession();
    return session ? session.user?.id : null;
  },

  async isLoggedIn() {
    return await Supabase.hasSession();
  },
};
