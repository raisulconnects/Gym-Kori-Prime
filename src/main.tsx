import '@fontsource/barlow/400.css';
import '@fontsource/barlow/500.css';
import '@fontsource/barlow/600.css';
import '@fontsource/barlow/700.css';
import '@fontsource/barlow-condensed/700.css';
import '@fontsource/galada/400.css';
import '@fontsource/hind-siliguri/400.css';
import '@fontsource/hind-siliguri/500.css';
import '@fontsource/hind-siliguri/600.css';
import '@fontsource/hind-siliguri/700.css';
import '@fontsource/noto-serif-bengali/700.css';
import './styles/index.css';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { setUpI18n } from './i18n';
import { loadPreferences, THEME_BAR_COLORS } from './preferences/preferences';
import { PreferencesProvider } from './preferences/PreferencesContext';

const preferences = loadPreferences();
setUpI18n(preferences.language ?? 'en');

// Apply the theme before the first paint so the screen doesn't flash the wrong colors.
document.documentElement.dataset.theme = preferences.theme;
document.documentElement.lang = preferences.language ?? 'en';
document.querySelector('meta[name="theme-color"]')?.setAttribute('content', THEME_BAR_COLORS[preferences.theme]);

// Ask the browser not to clear saved workouts when the phone runs low on space. It may say no.
void navigator.storage?.persist?.();

const root = document.getElementById('root');
if (!root) throw new Error('Missing root element');

createRoot(root).render(
  <StrictMode>
    <PreferencesProvider>
      <App />
    </PreferencesProvider>
  </StrictMode>,
);
