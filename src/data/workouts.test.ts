import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { db, type Workout } from './db';
import {
  addExtraExercise,
  addSet,
  discardWorkout,
  finishWorkout,
  isStale,
  loadLastPerformance,
  startWorkout,
  suggestedMinutes,
  updateExercise,
  updateSet,
} from './workouts';

const pushDay = {
  id: 'push',
  name: 'Push Day',
  items: [
    { exerciseId: 'bench-press', sets: 3, reps: 8 },
    { exerciseId: 'cable-fly', sets: 2, reps: 12 },
  ],
};

const DAY_ONE = new Date(2026, 9, 21, 18, 0);
const DAY_TWO = new Date(2026, 9, 28, 18, 0);

async function setsOf(workoutId: string, exerciseId: string) {
  const entry = await db.workoutExercises.where('workoutId').equals(workoutId).filter((row) => row.exerciseId === exerciseId).first();
  if (!entry) throw new Error(`${exerciseId} not found`);
  const sets = await db.workoutSets.where('workoutExerciseId').equals(entry.id).sortBy('position');
  return { entry, sets };
}

async function workout(id: string): Promise<Workout> {
  const row = await db.workouts.get(id);
  if (!row) throw new Error('workout not found');
  return row;
}

/** Logs a finished workout where each bench set has the given weight and reps. */
async function logBench(when: Date, sets: [number, number][]) {
  const id = await startWorkout(pushDay, when);
  const { sets: rows } = await setsOf(id, 'bench-press');
  for (const [index, [weightKg, reps]] of sets.entries()) {
    const row = rows[index];
    if (row) await updateSet(row, { weightKg, reps, done: true });
  }
  await finishWorkout(await workout(id), 3000, '', when);
  return id;
}

beforeEach(async () => {
  await db.delete();
  await db.open();
});

describe('startWorkout', () => {
  it('copies the routine and prefills reps from its targets', async () => {
    const id = await startWorkout(pushDay, DAY_ONE);
    const started = await workout(id);
    expect(started.routineName).toBe('Push Day');
    expect(started.localDate).toBe('2026-10-21');

    const { sets } = await setsOf(id, 'bench-press');
    expect(sets).toHaveLength(3);
    expect(sets[0]?.reps).toBe(8);
    expect(sets[0]?.weightKg).toBeNull();
    expect(sets[0]?.done).toBe(false);
  });

  it('never runs two workouts at once', async () => {
    const first = await startWorkout(pushDay, DAY_ONE);
    const second = await startWorkout(pushDay, DAY_ONE);
    expect(second).toBe(first);
    expect(await db.workouts.count()).toBe(1);
  });

  it('prefills weights from last time, set by set', async () => {
    await logBench(DAY_ONE, [[60, 8], [62.5, 8], [65, 6]]);
    const id = await startWorkout(pushDay, DAY_TWO);
    const { sets } = await setsOf(id, 'bench-press');
    expect(sets.map((set) => set.weightKg)).toEqual([60, 62.5, 65]);
    expect(sets.map((set) => set.reps)).toEqual([8, 8, 8]);
  });

  it('uses the last known weight when this routine has more sets than last time', async () => {
    await logBench(DAY_ONE, [[60, 8]]);
    const id = await startWorkout(pushDay, DAY_TWO);
    const { sets } = await setsOf(id, 'bench-press');
    expect(sets.map((set) => set.weightKg)).toEqual([60, 60, 60]);
  });
});

describe('loadLastPerformance', () => {
  it('is empty for an exercise never done', async () => {
    expect(await loadLastPerformance('bench-press')).toBeNull();
  });

  it('uses the most recent workout and only sets marked done', async () => {
    await logBench(DAY_ONE, [[60, 8], [60, 8], [60, 7]]);
    await logBench(DAY_TWO, [[70, 5]]);
    expect(await loadLastPerformance('bench-press')).toEqual([{ weightKg: 70, reps: 5 }]);
  });

  it('skips over a workout where nothing was done for that exercise', async () => {
    await logBench(DAY_ONE, [[60, 8]]);
    await logBench(DAY_TWO, []);
    expect(await loadLastPerformance('bench-press')).toEqual([{ weightKg: 60, reps: 8 }]);
  });

  it('ignores running and discarded workouts', async () => {
    const running = await startWorkout(pushDay, DAY_ONE);
    const { sets } = await setsOf(running, 'bench-press');
    if (sets[0]) await updateSet(sets[0], { weightKg: 100, reps: 1, done: true });
    expect(await loadLastPerformance('bench-press')).toBeNull();

    await finishWorkout(await workout(running), 600, '', DAY_ONE);
    await discardWorkout(running);
    expect(await loadLastPerformance('bench-press')).toBeNull();
  });
});

describe('during a workout', () => {
  it('adds a set using the previous numbers', async () => {
    const id = await startWorkout(pushDay, DAY_ONE);
    const { entry, sets } = await setsOf(id, 'bench-press');
    const last = sets[sets.length - 1];
    if (last) await updateSet(last, { weightKg: 60 });
    await addSet(entry, (await setsOf(id, 'bench-press')).sets.at(-1));

    const updated = (await setsOf(id, 'bench-press')).sets;
    expect(updated).toHaveLength(4);
    expect(updated[3]?.weightKg).toBe(60);
    expect(updated[3]?.position).toBe(3);
  });

  it('skips and notes an exercise', async () => {
    const id = await startWorkout(pushDay, DAY_ONE);
    const { entry } = await setsOf(id, 'cable-fly');
    await updateExercise(entry, { skipped: true, note: 'Machine taken' });
    const updated = await db.workoutExercises.get(entry.id);
    expect(updated?.skipped).toBe(true);
    expect(updated?.note).toBe('Machine taken');
  });

  it('adds an extra exercise after the others', async () => {
    const id = await startWorkout(pushDay, DAY_ONE);
    const extraId = await addExtraExercise(id, 'plank');
    const extra = await db.workoutExercises.get(extraId);
    expect(extra?.extra).toBe(true);
    expect(extra?.position).toBe(2);
    expect(await db.workoutSets.where('workoutExerciseId').equals(extraId).count()).toBe(3);
  });

  it('logging something counts as activity', async () => {
    const id = await startWorkout(pushDay, DAY_ONE);
    const before = (await workout(id)).lastActivityAt;
    const { sets } = await setsOf(id, 'bench-press');
    if (sets[0]) await updateSet(sets[0], { done: true });
    expect((await workout(id)).lastActivityAt).not.toBe(before);
  });
});

describe('finishing', () => {
  it('stores the duration and a trimmed note', async () => {
    const id = await startWorkout(pushDay, DAY_ONE);
    await finishWorkout(await workout(id), 2940, '  Felt strong ', new Date(2026, 9, 21, 19, 0));
    const done = await workout(id);
    expect(done.status).toBe('finished');
    expect(done.durationSeconds).toBe(2940);
    expect(done.note).toBe('Felt strong');
  });

  it('a workout past midnight stays on the day it started', async () => {
    const id = await startWorkout(pushDay, new Date(2026, 9, 21, 23, 50));
    await finishWorkout(await workout(id), 1800, '', new Date(2026, 9, 22, 0, 20));
    expect((await workout(id)).localDate).toBe('2026-10-21');
  });
});

describe('forgotten workouts', () => {
  const base = {
    id: 'w',
    localDate: '2026-10-21',
    routineId: 'push',
    routineName: 'Push Day',
    status: 'active',
    note: '',
    startedAt: '2026-10-21T10:00:00.000Z',
    lastActivityAt: '2026-10-21T10:50:00.000Z',
    updatedAt: '2026-10-21T10:50:00.000Z',
  } satisfies Workout;

  it('is not stale during normal rest gaps', () => {
    expect(isStale(base, new Date('2026-10-21T12:00:00.000Z'))).toBe(false);
  });

  it('becomes stale after three quiet hours', () => {
    expect(isStale(base, new Date('2026-10-21T13:51:00.000Z'))).toBe(true);
  });

  it('uses the time until now for a normal finish', () => {
    expect(suggestedMinutes(base, new Date('2026-10-21T11:00:00.000Z'))).toBe(60);
  });

  it('uses the time until the last log for a forgotten one, not 9 hours', () => {
    expect(suggestedMinutes(base, new Date('2026-10-21T19:00:00.000Z'))).toBe(50);
  });

  it('never suggests less than a minute', () => {
    expect(suggestedMinutes(base, new Date(base.startedAt))).toBe(1);
  });
});
