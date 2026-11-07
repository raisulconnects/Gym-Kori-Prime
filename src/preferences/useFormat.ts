import { useMemo } from 'react';
import { toBanglaDigits } from '../lib/digits';
import { usePreferences } from './PreferencesContext';

/** Sunday first, matching Date.getDay(). The browser's Bangla short names are too long for the week strip. */
const BANGLA_SHORT_DAYS = ['রবি', 'সোম', 'মঙ্গল', 'বুধ', 'বৃহ', 'শুক্র', 'শনি'];

/** Formats numbers and dates for the user's language. */
export function useFormat() {
  const { language } = usePreferences();
  return useMemo(() => {
    const bangla = language === 'bn';
    const locale = bangla ? 'bn-BD' : 'en-US';
    const longDate = new Intl.DateTimeFormat(locale, {
      weekday: 'long',
      month: bangla ? 'long' : 'short',
      day: 'numeric',
    });
    const dayMonth = new Intl.DateTimeFormat(locale, { month: 'short', day: 'numeric' });
    const dateTime = new Intl.DateTimeFormat(locale, {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
    const longDay = new Intl.DateTimeFormat(locale, { weekday: 'long' });
    const shortDay = new Intl.DateTimeFormat('en-US', { weekday: 'narrow' });
    const mediumDay = new Intl.DateTimeFormat('en-US', { weekday: 'short' });
    return {
      number: (value: number | string) => (bangla ? toBanglaDigits(value) : String(value)),
      date: (date: Date) => longDate.format(date),
      dayMonth: (date: Date) => dayMonth.format(date),
      dateTime: (date: Date) => dateTime.format(date),
      dayName: (date: Date) => longDay.format(date),
      dayShort: (date: Date) => (bangla ? (BANGLA_SHORT_DAYS[date.getDay()] ?? '') : shortDay.format(date)),
      dayMedium: (date: Date) => (bangla ? (BANGLA_SHORT_DAYS[date.getDay()] ?? '') : mediumDay.format(date)),
    };
  }, [language]);
}
