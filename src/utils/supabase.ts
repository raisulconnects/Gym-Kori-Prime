import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  throw new Error('Supabase settings are missing. Copy .env.example to .env.local and fill it in.');
}

export const AUTH_STORAGE_KEY = 'gym-kori-auth';

export const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: { storageKey: AUTH_STORAGE_KEY },
});
