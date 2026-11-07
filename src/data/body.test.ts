import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { latestBodyWeight, saveBodyWeight } from './body';
import { db } from './db';

beforeEach(async () => {
  await db.delete();
  await db.open();
});

describe('saveBodyWeight', () => {
  it('keeps one entry per day, so history builds up over time', async () => {
    await saveBodyWeight(72, new Date(2026, 9, 30, 8));
    await saveBodyWeight(71.5, new Date(2026, 9, 31, 8));
    expect(await db.bodyWeights.count()).toBe(2);
  });

  it('corrects the entry when saved twice on one day', async () => {
    await saveBodyWeight(720, new Date(2026, 9, 31, 8));
    await saveBodyWeight(72, new Date(2026, 9, 31, 9));
    const entries = await db.bodyWeights.toArray();
    expect(entries).toHaveLength(1);
    expect(entries[0]?.weightKg).toBe(72);
  });
});

describe('latestBodyWeight', () => {
  const entry = (id: string, localDate: string, updatedAt: string, deletedAt?: string) => ({
    id,
    localDate,
    weightKg: 70,
    updatedAt,
    deletedAt,
  });

  it('is null with nothing saved', () => {
    expect(latestBodyWeight([])).toBeNull();
  });

  it('picks the latest day, ignoring deleted entries', () => {
    const entries = [
      entry('a', '2026-10-29', '2026-10-29T08:00:00.000Z'),
      entry('b', '2026-10-30', '2026-10-30T08:00:00.000Z'),
      entry('c', '2026-10-31', '2026-10-31T08:00:00.000Z', '2026-10-31T09:00:00.000Z'),
    ];
    expect(latestBodyWeight(entries)?.id).toBe('b');
  });

  it('picks the later change when two devices saved on the same day', () => {
    const entries = [
      entry('later', '2026-10-31', '2026-10-31T09:00:00.000Z'),
      entry('earlier', '2026-10-31', '2026-10-31T08:00:00.000Z'),
    ];
    expect(latestBodyWeight(entries)?.id).toBe('later');
  });
});
