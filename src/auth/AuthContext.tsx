import type { Session } from '@supabase/supabase-js';
import { createContext, type ReactNode, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { db, deleteUserDatabase, openUserDatabase } from '../data/db';
import { LANGUAGES, type Language, type Theme, THEMES, type Unit, UNITS } from '../preferences/preferences';
import { usePreferences } from '../preferences/PreferencesContext';
import { supabase } from '../utils/supabase';
import { authErrorKey } from './authErrors';

/** Set when a preference change couldn't reach the server, so it's retried later. */
const PENDING_KEY = 'gym-kori:preferences-pending';

function setPending(pending: boolean) {
  try {
    if (pending) localStorage.setItem(PENDING_KEY, '1');
    else localStorage.removeItem(PENDING_KEY);
  } catch {
    // Storage can be blocked in private browsing. The next change will try again.
  }
}

function isPending() {
  try {
    return localStorage.getItem(PENDING_KEY) === '1';
  } catch {
    return false;
  }
}

export type AuthStatus = 'loading' | 'signedOut' | 'signedIn';

/** A failed action gives back a translation key for its message. */
type Result = { error: string | null };

interface AuthValue {
  status: AuthStatus;
  userId: string | null;
  email: string;
  displayName: string;
  signIn: (email: string, password: string) => Promise<Result>;
  signUp: (name: string, email: string, password: string) => Promise<Result & { needsConfirmation: boolean }>;
  signOut: () => Promise<void>;
  sendPasswordReset: (email: string) => Promise<Result>;
  updatePassword: (password: string) => Promise<Result>;
  updateDisplayName: (name: string) => Promise<Result>;
  deleteAccount: () => Promise<Result>;
}

const AuthContext = createContext<AuthValue | null>(null);

const asResult = (error: Parameters<typeof authErrorKey>[0] | null): Result => ({
  error: error ? authErrorKey(error) : null,
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const navigate = useNavigate();
  const preferences = usePreferences();
  const { language, theme, unit } = preferences;
  // Lets the first sync, which runs once per login, read the current choices.
  const latestPreferences = useRef(preferences);
  latestPreferences.current = preferences;
  // Undefined until the saved session has been read from this device.
  const [session, setSession] = useState<Session | null | undefined>(undefined);
  const [openedUserId, setOpenedUserId] = useState<string | null>(null);
  const [profileName, setProfileName] = useState<string | null>(null);
  const syncedPreferences = useRef<string | null>(null);

  const user = session?.user ?? null;
  const userId = user?.id ?? null;
  const preferencesKey = JSON.stringify({ language, theme, unit });

  useEffect(() => {
    void supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data } = supabase.auth.onAuthStateChange((event, nextSession) => {
      setSession(nextSession);
      if (event === 'PASSWORD_RECOVERY') navigate('/reset-password');
    });
    return () => data.subscription.unsubscribe();
  }, [navigate]);

  // Open this account's data before showing any screen that reads it.
  useEffect(() => {
    let cancelled = false;
    syncedPreferences.current = null;
    setOpenedUserId(null);
    setProfileName(null);
    if (!userId) return;
    void openUserDatabase(userId).then(() => {
      if (!cancelled) setOpenedUserId(userId);
    });
    return () => {
      cancelled = true;
    };
  }, [userId]);

  // The first sync never holds up the app, because the phone may have no signal at the gym.
  useEffect(() => {
    if (!openedUserId) return;
    let cancelled = false;
    const { language, theme, unit, update } = latestPreferences.current;
    const currentKey = JSON.stringify({ language, theme, unit });

    async function push(id: string) {
      const { error } = await supabase.from('profiles').update({ language, theme, unit }).eq('id', id);
      if (error) throw error;
      setPending(false);
    }

    void (async () => {
      try {
        if (isPending()) {
          await push(openedUserId);
          if (!cancelled) syncedPreferences.current = currentKey;
          return;
        }
        const { data, error } = await supabase.from('profiles').select('*').eq('id', openedUserId).maybeSingle();
        if (error) throw error;
        if (cancelled) return;
        setProfileName(data?.display_name ?? null);
        if (LANGUAGES.includes(data?.language)) {
          const saved = {
            language: data?.language as Language,
            theme: THEMES.includes(data?.theme) ? (data?.theme as Theme) : theme,
            unit: UNITS.includes(data?.unit) ? (data?.unit as Unit) : unit,
          };
          syncedPreferences.current = JSON.stringify(saved);
          update(saved);
        } else {
          // A new account has no saved choices yet, so keep the ones just made on this device.
          syncedPreferences.current = currentKey;
          await push(openedUserId);
        }
      } catch {
        if (!cancelled) syncedPreferences.current = currentKey;
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [openedUserId]);

  useEffect(() => {
    if (!openedUserId || syncedPreferences.current === null || syncedPreferences.current === preferencesKey) return;
    syncedPreferences.current = preferencesKey;
    const changes = JSON.parse(preferencesKey);
    void supabase
      .from('profiles')
      .update(changes)
      .eq('id', openedUserId)
      .then(({ error }) => setPending(Boolean(error)));
  }, [openedUserId, preferencesKey]);

  // Retry a preference change that was made with no signal.
  useEffect(() => {
    if (!openedUserId) return;
    const retry = () => {
      if (!isPending()) return;
      void supabase
        .from('profiles')
        .update(JSON.parse(preferencesKey))
        .eq('id', openedUserId)
        .then(({ error }) => {
          if (!error) setPending(false);
        });
    };
    window.addEventListener('online', retry);
    return () => window.removeEventListener('online', retry);
  }, [openedUserId, preferencesKey]);

  const value = useMemo<AuthValue>(() => {
    let status: AuthStatus = 'loading';
    if (session === null) status = 'signedOut';
    else if (session && openedUserId === session.user.id) status = 'signedIn';

    const metadataName = typeof user?.user_metadata?.display_name === 'string' ? user.user_metadata.display_name : '';

    return {
      status,
      userId,
      email: user?.email ?? '',
      displayName: profileName ?? metadataName,
      signIn: async (email, password) => {
        setPending(false);
        const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
        return asResult(error);
      },
      signUp: async (name, email, password) => {
        setPending(false);
        const { data, error } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: { data: { display_name: name.trim() } },
        });
        return { ...asResult(error), needsConfirmation: !error && !data.session };
      },
      signOut: async () => {
        // Local scope means this works with no signal, and leaves other devices logged in.
        await supabase.auth.signOut({ scope: 'local' });
        setPending(false);
        db.close();
      },
      sendPasswordReset: async (email) => {
        const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
          redirectTo: `${window.location.origin}/reset-password`,
        });
        return asResult(error);
      },
      updatePassword: async (password) => {
        const { error } = await supabase.auth.updateUser({ password });
        return asResult(error);
      },
      updateDisplayName: async (name) => {
        const trimmed = name.trim();
        if (!userId) return { error: 'auth.errorGeneric' };
        const { error } = await supabase.from('profiles').update({ display_name: trimmed }).eq('id', userId);
        if (error) return { error: 'auth.errorNetwork' };
        setProfileName(trimmed);
        // Also stored with the session, so the name still shows with no signal.
        void supabase.auth.updateUser({ data: { display_name: trimmed } });
        return { error: null };
      },
      deleteAccount: async () => {
        const { error } = await supabase.rpc('delete_own_account');
        if (error) return { error: 'auth.errorDelete' };
        await deleteUserDatabase();
        setPending(false);
        await supabase.auth.signOut({ scope: 'local' });
        return { error: null };
      },
    };
  }, [session, openedUserId, profileName, user, userId]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthValue {
  const value = useContext(AuthContext);
  if (!value) throw new Error('useAuth must be used inside AuthProvider');
  return value;
}
