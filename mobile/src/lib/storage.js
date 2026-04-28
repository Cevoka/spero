// storage.js — AsyncStorage wrapper, rr_ prefix
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Supabase } from './supabase';
import { Auth } from './auth';

const PREFIX = 'rr_';
const _key = (n) => PREFIX + n;

async function _get(key) {
  try {
    const raw = await AsyncStorage.getItem(_key(key));
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

async function _set(key, value) {
  try {
    await AsyncStorage.setItem(_key(key), JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

async function _remove(key) {
  try {
    await AsyncStorage.removeItem(_key(key));
  } catch {}
}

export const Storage = {
  async getCurrentUser() {
    return await _get('current_user');
  },
  async setCurrentUser(username) {
    await _set('current_user', username);
  },
  async removeCurrentUser() {
    await _remove('current_user');
  },

  async getConversations(username) {
    return (await _get('conversations_' + username)) || [];
  },
  async saveConversations(username, conversations) {
    await _set('conversations_' + username, conversations);
  },
  async getActiveConvoId(username) {
    return await _get('active_convo_' + username);
  },
  async setActiveConvoId(username, convoId) {
    await _set('active_convo_' + username, convoId);
  },
  async getConversation(username, convoId) {
    const list = await this.getConversations(username);
    return list.find((c) => c.id === convoId) || null;
  },
  async saveConversation(username, conversation) {
    const conv = { ...conversation };
    if (Array.isArray(conv.messages) && conv.messages.length > 100) {
      conv.messages = conv.messages.slice(-100);
    }
    const convos = await this.getConversations(username);
    const idx = convos.findIndex((c) => c.id === conv.id);
    if (idx >= 0) convos[idx] = conv;
    else convos.unshift(conv);
    await this.saveConversations(username, convos);

    const userId = await Auth.getUserId();
    if (userId) this.syncConversation(conv, userId);
  },
  async deleteConversation(username, convoId) {
    const convos = await this.getConversations(username);
    await this.saveConversations(
      username,
      convos.filter((c) => c.id !== convoId)
    );
    const active = await this.getActiveConvoId(username);
    if (active === convoId) await _remove('active_convo_' + username);

    const userId = await Auth.getUserId();
    if (userId) {
      try {
        const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-/.test(convoId);
        if (isUuid) await Supabase.db.delete('conversations', { id: convoId });
      } catch {}
    }
  },

  async getDailyContent(username) {
    return await _get('daily_content_' + username);
  },
  async setDailyContent(username, content) {
    await _set('daily_content_' + username, content);
    const userId = await Auth.getUserId();
    if (userId && content) {
      Supabase.db
        .upsert(
          'daily_content',
          {
            user_id: userId,
            date: content.date,
            content: content.content,
            verses: content.verses || [],
            generated: content.generated || false,
          },
          'user_id,date'
        )
        .catch(() => {});
    }
  },

  async pullFromSupabase(userId) {
    if (!userId) return;
    try {
      const profiles = await Supabase.db.select('profiles', {
        select: 'display_name',
        filters: { id: userId },
      });
      if (profiles && profiles[0] && profiles[0].display_name) {
        await this.setCurrentUser(profiles[0].display_name);
      }

      const convos = await Supabase.db.select('conversations', {
        select: 'id,title,preview,created_at,updated_at',
        filters: { user_id: userId },
        order: 'updated_at.desc',
        limit: 50,
      });
      if (convos && convos.length > 0) {
        const username = await this.getCurrentUser();
        if (username) {
          const local = await this.getConversations(username);
          const localIds = new Set(local.map((c) => c.id));
          convos.forEach((c) => {
            if (!localIds.has(c.id)) {
              local.push({
                id: c.id,
                preview: c.preview || '',
                messages: [],
                createdAt: c.created_at,
                updatedAt: c.updated_at,
              });
            }
          });
          await this.saveConversations(username, local);
        }
      }

      const today = new Date().toISOString().split('T')[0];
      const daily = await Supabase.db.select('daily_content', {
        filters: { user_id: userId, date: today },
      });
      if (daily && daily[0]) {
        const username = await this.getCurrentUser();
        if (username) {
          await _set('daily_content_' + username, {
            date: today,
            content: daily[0].content,
            verses: daily[0].verses || [],
            generated: daily[0].generated,
          });
        }
      }
    } catch {}
  },

  async syncConversation(conversation, userId) {
    if (!userId || !conversation) return;
    try {
      const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-/.test(conversation.id);
      const convData = {
        user_id: userId,
        title: conversation.preview ? conversation.preview.substring(0, 60) : 'Sohbet',
        preview: conversation.preview || '',
        updated_at: new Date().toISOString(),
      };
      if (isUuid) {
        await Supabase.db.update('conversations', convData, { id: conversation.id });
      } else {
        const created = await Supabase.db.insert('conversations', {
          ...convData,
          created_at: conversation.createdAt || new Date().toISOString(),
        });
        if (created && created.id) {
          const username = await this.getCurrentUser();
          if (username) {
            const convos = await this.getConversations(username);
            const idx = convos.findIndex((c) => c.id === conversation.id);
            if (idx >= 0) convos[idx].id = created.id;
            await this.saveConversations(username, convos);
            conversation.id = created.id;
          }
        }
      }
      if (Array.isArray(conversation.messages) && conversation.messages.length > 0) {
        const msgs = conversation.messages.slice(-20).map((m) => ({
          conversation_id: conversation.id,
          role: m.role,
          content: m.content,
          created_at: m.timestamp || new Date().toISOString(),
        }));
        await Supabase.db.insert('messages', msgs).catch(() => {});
      }
    } catch {}
  },
};
