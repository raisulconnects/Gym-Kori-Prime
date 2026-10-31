import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import { bn } from './bn';
import { en } from './en';

export function setUpI18n(language: 'en' | 'bn') {
  void i18n.use(initReactI18next).init({
    lng: language,
    fallbackLng: 'en',
    resources: { en: { translation: en }, bn: { translation: bn } },
    interpolation: { escapeValue: false },
  });
}

export { i18n };
