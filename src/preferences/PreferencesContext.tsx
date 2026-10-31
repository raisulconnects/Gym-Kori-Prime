import { createContext, type ReactNode, useContext, useEffect, useMemo, useState } from 'react';
import { i18n } from '../i18n';
import { loadPreferences, type Preferences, savePreferences, THEME_BAR_COLORS } from './preferences';

interface PreferencesValue extends Preferences {
  update: (changes: Partial<Preferences>) => void;
}

const PreferencesContext = createContext<PreferencesValue | null>(null);

export function PreferencesProvider({ children }: { children: ReactNode }) {
  const [preferences, setPreferences] = useState(loadPreferences);

  useEffect(() => {
    savePreferences(preferences);
    const root = document.documentElement;
    root.dataset.theme = preferences.theme;
    root.lang = preferences.language ?? 'en';
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', THEME_BAR_COLORS[preferences.theme]);
    void i18n.changeLanguage(preferences.language ?? 'en').then(() => {
      document.title = i18n.t('app.name');
    });
  }, [preferences]);

  const value = useMemo<PreferencesValue>(
    () => ({
      ...preferences,
      update: (changes) => setPreferences((current) => ({ ...current, ...changes })),
    }),
    [preferences],
  );

  return <PreferencesContext.Provider value={value}>{children}</PreferencesContext.Provider>;
}

export function usePreferences(): PreferencesValue {
  const value = useContext(PreferencesContext);
  if (!value) throw new Error('usePreferences must be used inside PreferencesProvider');
  return value;
}
