import session from 'express-session';
import { supabase } from './supabaseClient.js';

// Express's default MemoryStore loses every signed-in user on restart and cannot
// be shared by multiple Render instances. This store keeps only encrypted session
// identifiers in cookies; the session payload itself lives in Supabase.
export class SupabaseSessionStore extends session.Store {
  constructor({ ttlMs = 24 * 60 * 60 * 1000 } = {}) {
    super();
    this.ttlMs = ttlMs;
  }

  expiresAt(sess) {
    const candidate = sess?.cookie?.expires ? new Date(sess.cookie.expires) : null;
    return candidate && !Number.isNaN(candidate.getTime())
      ? candidate.toISOString()
      : new Date(Date.now() + this.ttlMs).toISOString();
  }

  get(sid, callback) {
    (async () => {
      try {
        const { data, error } = await supabase
          .from('app_sessions')
          .select('data, expires_at')
          .eq('sid', sid)
          .maybeSingle();
        if (error) {
          if (error.code === '42P01') {
            console.warn('[SupabaseSessionStore] Table "app_sessions" does not exist yet. Please run backend/multi_auction_hardening_migration.sql in Supabase SQL editor.');
          } else {
            console.error('[SupabaseSessionStore] get error:', error.message);
          }
          return callback(null, null);
        }
        if (!data) return callback(null, null);

        if (new Date(data.expires_at).getTime() <= Date.now()) {
          await supabase.from('app_sessions').delete().eq('sid', sid).catch(() => {});
          return callback(null, null);
        }
        return callback(null, data.data);
      } catch (err) {
        console.error('[SupabaseSessionStore] unexpected get error:', err.message);
        return callback(null, null);
      }
    })().catch(() => callback(null, null));
  }

  set(sid, sess, callback = () => {}) {
    supabase
      .from('app_sessions')
      .upsert({ sid, data: sess, expires_at: this.expiresAt(sess) }, { onConflict: 'sid' })
      .then(({ error }) => {
        if (error && error.code !== '42P01') {
          console.error('[SupabaseSessionStore] set error:', error.message);
        }
        callback(null);
      })
      .catch((err) => {
        console.error('[SupabaseSessionStore] unexpected set error:', err.message);
        callback(null);
      });
  }

  destroy(sid, callback = () => {}) {
    supabase
      .from('app_sessions')
      .delete()
      .eq('sid', sid)
      .then(({ error }) => {
        if (error && error.code !== '42P01') {
          console.error('[SupabaseSessionStore] destroy error:', error.message);
        }
        callback(null);
      })
      .catch((err) => {
        console.error('[SupabaseSessionStore] unexpected destroy error:', err.message);
        callback(null);
      });
  }

  touch(sid, sess, callback = () => {}) {
    supabase
      .from('app_sessions')
      .update({ expires_at: this.expiresAt(sess) })
      .eq('sid', sid)
      .then(({ error }) => {
        if (error && error.code !== '42P01') {
          console.error('[SupabaseSessionStore] touch error:', error.message);
        }
        callback(null);
      })
      .catch((err) => {
        console.error('[SupabaseSessionStore] unexpected touch error:', err.message);
        callback(null);
      });
  }
}
