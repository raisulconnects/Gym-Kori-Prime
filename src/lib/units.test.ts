import { describe, expect, it } from 'vitest';
import { formatClock, formatWeight, parseReps, parseWeight } from './units';

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
