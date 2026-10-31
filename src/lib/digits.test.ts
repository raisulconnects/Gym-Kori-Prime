import { describe, expect, it } from 'vitest';
import { normalizeDigits, toBanglaDigits } from './digits';

describe('toBanglaDigits', () => {
  it('converts numbers', () => {
    expect(toBanglaDigits(60)).toBe('৬০');
    expect(toBanglaDigits(1234567890)).toBe('১২৩৪৫৬৭৮৯০');
  });

  it('keeps everything that is not a digit', () => {
    expect(toBanglaDigits('12:48')).toBe('১২:৪৮');
    expect(toBanglaDigits('62.5')).toBe('৬২.৫');
  });
});

describe('normalizeDigits', () => {
  it('turns Bangla digits into English digits', () => {
    expect(normalizeDigits('৬০')).toBe('60');
    expect(normalizeDigits('৬২.৫')).toBe('62.5');
  });

  it('leaves English digits and mixed input readable', () => {
    expect(normalizeDigits('60')).toBe('60');
    expect(normalizeDigits('৬0')).toBe('60');
    expect(normalizeDigits('')).toBe('');
  });
});
