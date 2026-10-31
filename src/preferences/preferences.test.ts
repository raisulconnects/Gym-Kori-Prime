import { describe, expect, it } from 'vitest';
import { DEFAULT_PREFERENCES, parsePreferences } from './preferences';

describe('parsePreferences', () => {
  it('uses defaults when nothing is saved', () => {
    expect(parsePreferences(null)).toEqual(DEFAULT_PREFERENCES);
  });

  it('reads saved choices', () => {
    const saved = JSON.stringify({ language: 'bn', theme: 'rickshaw', unit: 'lb' });
    expect(parsePreferences(saved)).toEqual({ language: 'bn', theme: 'rickshaw', unit: 'lb' });
  });

  it('replaces unknown values with defaults', () => {
    const saved = JSON.stringify({ language: 'fr', theme: 'jamdani', unit: 'stone' });
    expect(parsePreferences(saved)).toEqual(DEFAULT_PREFERENCES);
  });

  it('survives damaged data', () => {
    expect(parsePreferences('{not json')).toEqual(DEFAULT_PREFERENCES);
    expect(parsePreferences('null')).toEqual(DEFAULT_PREFERENCES);
  });
});
