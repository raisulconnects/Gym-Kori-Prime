import { supabase } from '../utils/supabase';
import { SyncOfflineError, type SyncRemote } from './sync';

/** A status of 0 means the request never got an answer, so the server couldn't be reached. */
function check({ error, status }: { error: { message: string } | null; status: number }) {
  if (!error) return;
  throw status === 0 ? new SyncOfflineError(error.message) : new Error(error.message);
}

export function createSupabaseRemote(userId: string): SyncRemote {
  return {
    async push(table, rows) {
      const owned = rows.map((row) => ({ ...row, user_id: userId }));
      check(await supabase.from(table).upsert(owned, { onConflict: 'user_id,id' }));
    },
    async pull(table, since, limit) {
      let query = supabase.from(table).select('*').eq('user_id', userId).order('synced_at').limit(limit);
      if (since) query = query.gt('synced_at', since);
      // Sync tries again by itself, so the app can say it's offline right away.
      const result = await query.retry(false);
      check(result);
      return result.data ?? [];
    },
  };
}
