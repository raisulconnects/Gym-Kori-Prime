export const THEMES = ['modern', 'kantha', 'rickshaw'] as const;
export const LANGUAGES = ['en', 'bn'] as const;
export const UNITS = ['kg', 'lb'] as const;
export const GENDERS = ['male', 'female', 'prefer_not_to_say'] as const;

export type Theme = (typeof THEMES)[number];
export type Language = (typeof LANGUAGES)[number];
export type Unit = (typeof UNITS)[number];
export type Gender = (typeof GENDERS)[number];

export interface Preferences {
  /** Stays null until the user picks a language at first launch. */
  language: Language | null;
  theme: Theme;
  unit: Unit;
}

export const DEFAULT_PREFERENCES: Preferences = { language: null, theme: 'modern', unit: 'kg' };

/** Colors for the phone's browser bar, matching each theme's page background. */
export const THEME_BAR_COLORS: Record<Theme, string> = {
  modern: '#111827',
  kantha: '#F7EFDC',
  rickshaw: '#12235A',
};

const STORAGE_KEY = 'gym-kori:preferences';

function isOneOf<T extends string>(options: readonly T[], value: unknown): value is T {
  return options.includes(value as T);
}

/** Keeps only valid saved values, so old or damaged data can't break the app. */
export function parsePreferences(saved: string | null): Preferences {
  if (!saved) return DEFAULT_PREFERENCES;
  try {
    const value = JSON.parse(saved) as Record<string, unknown> | null;
    return {
      language: isOneOf(LANGUAGES, value?.language) ? value.language : null,
      theme: isOneOf(THEMES, value?.theme) ? value.theme : DEFAULT_PREFERENCES.theme,
      unit: isOneOf(UNITS, value?.unit) ? value.unit : DEFAULT_PREFERENCES.unit,
    };
  } catch {
    return DEFAULT_PREFERENCES;
  }
}

export function loadPreferences(): Preferences {
  try {
    return parsePreferences(localStorage.getItem(STORAGE_KEY));
  } catch {
    return DEFAULT_PREFERENCES;
  }
}

export function savePreferences(preferences: Preferences): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(preferences));
  } catch {
    // Storage can be blocked in private browsing. The choice still applies until the page closes.
  }
}
