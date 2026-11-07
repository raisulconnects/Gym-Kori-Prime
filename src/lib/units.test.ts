import { describe, expect, it } from 'vitest';
import {
  formatClock,
  formatWeight,
  parseBodyWeight,
  parseFeetInches,
  parseHeightCm,
  parseReps,
  parseWeight,
  toFeetInches,
} from './units';

describe('weights', () => {
  it('keeps kg values as typed, including half plates', () => {
    expect(parseWeight('62.5', 'kg')).toBe(62.5);
    expect(formatWeight(62.5, 'kg')).toBe('62.5');
    expect(formatWeight(60, 'kg')).toBe('60');
  });

  it('stores lb entries as kg', () => {
    expect(parseWeight('135', 'lb')).toBeCloseTo(61.235, 3);
  });

  it('shows the same lb number after saving it', () => {
    for (const pounds of ['5', '45', '135', '225', '137.5']) {
      expect(formatWeight(parseWeight(pounds, 'lb'), 'lb')).toBe(pounds);
    }
  });

  it('treats empty and impossible values as no weight', () => {
    expect(parseWeight('', 'kg')).toBeNull();
    expect(parseWeight('abc', 'kg')).toBeNull();
    expect(parseWeight('-5', 'kg')).toBeNull();
    expect(parseWeight('5000', 'kg')).toBeNull();
    expect(formatWeight(null, 'kg')).toBe('');
  });

  it('allows zero for bodyweight', () => {
    expect(parseWeight('0', 'kg')).toBe(0);
  });
});

describe('parseReps', () => {
  it('accepts whole numbers only', () => {
    expect(parseReps('8')).toBe(8);
    expect(parseReps('')).toBeNull();
    expect(parseReps('8.5')).toBeNull();
  });
});

describe('formatClock', () => {
  it('shows minutes and seconds', () => {
    expect(formatClock(0)).toBe('0:00');
    expect(formatClock(72)).toBe('1:12');
    expect(formatClock(768)).toBe('12:48');
  });

  it('adds hours from one hour', () => {
    expect(formatClock(3725)).toBe('1:02:05');
  });

  it('never goes below zero', () => {
    expect(formatClock(-5)).toBe('0:00');
  });
});

describe('body details', () => {
  it('accepts a believable body weight in either unit, stored as kg', () => {
    expect(parseBodyWeight('72.5', 'kg')).toBe(72.5);
    expect(parseBodyWeight('160', 'lb')).toBeCloseTo(72.575, 3);
  });

  it('rejects a body weight nobody could have', () => {
    expect(parseBodyWeight('', 'kg')).toBeNull();
    expect(parseBodyWeight('5', 'kg')).toBeNull();
    expect(parseBodyWeight('720', 'kg')).toBeNull();
  });

  it('converts feet and inches to centimetres and back without drifting', () => {
    const height = parseFeetInches('5', '7');
    expect(height).toBe(170.2);
    expect(toFeetInches(height ?? 0)).toEqual({ feet: 5, inches: 7 });
  });

  it('treats blank inches as zero and carries a rounded 12 inches into feet', () => {
    expect(parseFeetInches('6', '')).toBe(182.9);
    expect(toFeetInches(182.5)).toEqual({ feet: 6, inches: 0 });
  });

  it('rejects impossible heights', () => {
    expect(parseFeetInches('', '7')).toBeNull();
    expect(parseFeetInches('5', '12')).toBeNull();
    expect(parseFeetInches('50', '0')).toBeNull();
    expect(parseHeightCm('10')).toBeNull();
    expect(parseHeightCm('170.25')).toBe(170.3);
  });
});
