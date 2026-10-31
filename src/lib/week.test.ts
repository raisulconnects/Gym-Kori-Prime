import { describe, expect, it } from 'vitest';
import { daysOfWeek, isSameDay } from './week';

describe('daysOfWeek', () => {
  it('starts on Saturday and ends on Friday', () => {
    const days = daysOfWeek(new Date(2026, 9, 28));
    expect(days).toHaveLength(7);
    expect(days[0]?.getDay()).toBe(6);
    expect(days[0]?.getDate()).toBe(24);
    expect(days[6]?.getDay()).toBe(5);
    expect(days[6]?.getDate()).toBe(30);
  });

  it('treats Saturday and Friday as part of the same week', () => {
    const fromSaturday = daysOfWeek(new Date(2026, 9, 24));
    const fromFriday = daysOfWeek(new Date(2026, 9, 30));
    expect(fromSaturday.map((day) => day.getDate())).toEqual(fromFriday.map((day) => day.getDate()));
  });

  it('crosses month and year boundaries', () => {
    const days = daysOfWeek(new Date(2027, 0, 1));
    expect(days[0]?.getFullYear()).toBe(2026);
    expect(days[0]?.getMonth()).toBe(11);
    expect(days[0]?.getDate()).toBe(26);
    expect(days[6]?.getDate()).toBe(1);
  });
});

describe('isSameDay', () => {
  it('ignores the time of day', () => {
    expect(isSameDay(new Date(2026, 9, 28, 1), new Date(2026, 9, 28, 23))).toBe(true);
    expect(isSameDay(new Date(2026, 9, 28), new Date(2026, 9, 29))).toBe(false);
  });
});
