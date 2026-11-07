import { createId } from '../lib/ids';
import { toLocalDate } from '../lib/week';
import { type BodyWeight, db } from './db';

/** Saves today's weight. Saving again the same day corrects it rather than adding a second entry. */
export async function saveBodyWeight(weightKg: number, now: Date): Promise<void> {
  const localDate = toLocalDate(now);
  await db.transaction('rw', db.bodyWeights, async () => {
    const today = await db.bodyWeights
      .where('localDate')
      .equals(localDate)
      .filter((entry) => !entry.deletedAt)
      .first();
    await db.bodyWeights.put({
      ...today,
      id: today?.id ?? createId(),
      localDate,
      weightKg,
      updatedAt: now.toISOString(),
    });
  });
}

/** The most recent entry. Two devices can each add one on the same day, so the later change wins. */
export function latestBodyWeight(entries: BodyWeight[]): BodyWeight | null {
  let latest: BodyWeight | null = null;
  for (const entry of entries) {
    if (entry.deletedAt) continue;
    const isNewer =
      !latest ||
      entry.localDate > latest.localDate ||
      (entry.localDate === latest.localDate && entry.updatedAt > latest.updatedAt);
    if (isNewer) latest = entry;
  }
  return latest;
}
