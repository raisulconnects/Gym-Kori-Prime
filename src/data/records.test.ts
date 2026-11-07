import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { db } from './db';
import {
  type ExerciseSession,
  estimateOneRepMax,
  exerciseRecords,
  groupSessions,
  loadExerciseSessions,
  newRecordsIn,
  sessionVolume,
  sessionsWithRecords,
} from './records';

let nextId = 0;

/** A session from [weightKg, reps] pairs. Null weight means a bodyweight set. */
function session(day: number, sets: [number | null, number][]): ExerciseSession {
  const date = `2026-11-${String(day).padStart(2, '0')}`;
  return {
    workoutId: `w${day}`,
    localDate: date,
    startedAt: `${date}T08:00:00.000Z`,
    routineName: 'Push Day',
    sets: sets.map(([weightKg, reps]) => ({ id: `s${nextId++}`, weightKg, reps })),
  };
}

describe('estimateOneRepMax', () => {
  it('uses the Epley formula, and a single rep is the weight itself', () => {
    expect(estimateOneRepMax(60, 8)).toBe(76);
    expect(estimateOneRepMax(100, 1)).toBe(100);
  });

  it('is not estimated from high-rep sets, bodyweight sets or empty sets', () => {
    expect(estimateOneRepMax(40, 13)).toBeNull();
    expect(estimateOneRepMax(null, 5)).toBeNull();
    expect(estimateOneRepMax(60, 0)).toBeNull();
  });
});

describe('exerciseRecords', () => {
  it('finds each record, and where it was set', () => {
    const records = exerciseRecords([
      session(1, [
        [60, 8],
        [60, 8],
      ]),
      session(3, [
        [70, 3],
        [40, 15],
      ]),
    ]);
    expect(records.heaviest).toMatchObject({ value: 70, workoutId: 'w3', set: { reps: 3 } });
    expect(records.oneRepMax?.value).toBeCloseTo(77);
    expect(records.mostReps).toMatchObject({ value: 15, workoutId: 'w3' });
    expect(records.volume).toMatchObject({ value: 960, workoutId: 'w1' });
  });

  it('keeps the first time a value was reached, so a tie is not a new record', () => {
    const records = exerciseRecords([session(1, [[60, 5]]), session(2, [[60, 5]])]);
    expect(records.heaviest?.workoutId).toBe('w1');
  });

  it('has only most reps for a bodyweight exercise', () => {
    const records = exerciseRecords([session(1, [[null, 10]]), session(2, [[null, 12]])]);
    expect(records).toEqual({ mostReps: expect.objectContaining({ value: 12, workoutId: 'w2' }) });
  });
});

describe('newRecordsIn', () => {
  const earlier = [session(1, [[60, 8]])];

  it('marks nothing the first time an exercise is done', () => {
    expect(newRecordsIn(session(2, [[100, 10]]), [])).toEqual({ bySet: {}, volume: false });
  });

  it('marks the sets that beat earlier workouts', () => {
    const today = session(2, [
      [65, 5],
      [50, 2],
    ]);
    const result = newRecordsIn(today, earlier);
    expect(result.bySet[today.sets[0]?.id ?? '']).toEqual(['heaviest']);
    expect(result.bySet[today.sets[1]?.id ?? '']).toBeUndefined();
    expect(result.volume).toBe(false);
  });

  it('does not mark a set that only equals the best', () => {
    const today = session(2, [[60, 8]]);
    expect(newRecordsIn(today, earlier).bySet).toEqual({});
  });

  it('marks a later set only if it also beats the earlier sets in the same workout', () => {
    const today = session(2, [
      [70, 5],
      [65, 5],
      [72, 5],
    ]);
    const marks = newRecordsIn(today, earlier).bySet;
    expect(marks[today.sets[0]?.id ?? '']).toContain('heaviest');
    expect(marks[today.sets[1]?.id ?? '']).toBeUndefined();
    expect(marks[today.sets[2]?.id ?? '']).toContain('heaviest');
  });

  it('notices a session volume record', () => {
    const today = session(2, [
      [60, 8],
      [60, 8],
    ]);
    expect(newRecordsIn(today, earlier).volume).toBe(true);
  });
});

describe('sessionsWithRecords', () => {
  it('lists sessions newest first, with the records each broke at the time', () => {
    const list = sessionsWithRecords([session(1, [[60, 8]]), session(2, [[65, 8]]), session(3, [[62, 8]])]);
    expect(list.map((entry) => entry.workoutId)).toEqual(['w3', 'w2', 'w1']);
    expect(Object.keys(list[0]?.records.bySet ?? {})).toHaveLength(0);
    expect(Object.values(list[1]?.records.bySet ?? {})[0]).toContain('heaviest');
    expect(list[2]?.records).toEqual({ bySet: {}, volume: false });
  });
});

describe('sessionVolume', () => {
  it('adds up weighted sets only', () => {
    expect(
      sessionVolume([
        { id: 'a', weightKg: 50, reps: 10 },
        { id: 'b', weightKg: null, reps: 10 },
      ]),
    ).toBe(500);
    expect(sessionVolume([{ id: 'a', weightKg: null, reps: 10 }])).toBeNull();
  });
});

describe('groupSessions and loadExerciseSessions', () => {
  const T = '2026-11-01T08:00:00.000Z';
  const workout = (id: string, startedAt: string, extra: object = {}) => ({
    id,
    localDate: startedAt.slice(0, 10),
    routineId: null,
    routineName: 'Push Day',
    status: 'finished' as const,
    startedAt,
    lastActivityAt: startedAt,
    note: '',
    updatedAt: T,
    ...extra,
  });
  const entry = (id: string, workoutId: string, extra: object = {}) => ({
    id,
    workoutId,
    exerciseId: 'bench-press',
    position: 0,
    skipped: false,
    extra: false,
    note: '',
    updatedAt: T,
    ...extra,
  });
  const set = (id: string, workoutId: string, workoutExerciseId: string, position: number, done = true) => ({
    id,
    workoutId,
    workoutExerciseId,
    position,
    weightKg: 60,
    reps: 8,
    done,
    updatedAt: T,
  });

  beforeEach(async () => {
    await db.delete();
    await db.open();
  });

  it('only counts done sets from finished, kept workouts, oldest first', async () => {
    await db.workouts.bulkPut([
      workout('new', '2026-11-05T08:00:00.000Z'),
      workout('old', '2026-11-01T08:00:00.000Z'),
      workout('running', '2026-11-06T08:00:00.000Z', { status: 'active' }),
      workout('discarded', '2026-11-04T08:00:00.000Z', { deletedAt: T }),
      workout('skipped', '2026-11-03T08:00:00.000Z'),
    ]);
    await db.workoutExercises.bulkPut([
      entry('e-new', 'new'),
      entry('e-old', 'old'),
      entry('e-running', 'running'),
      entry('e-discarded', 'discarded'),
      entry('e-skipped', 'skipped', { skipped: true }),
    ]);
    await db.workoutSets.bulkPut([
      set('s2', 'new', 'e-new', 1),
      set('s1', 'new', 'e-new', 0),
      set('s-undone', 'new', 'e-new', 2, false),
      set('s-old', 'old', 'e-old', 0),
      set('s-running', 'running', 'e-running', 0),
      set('s-discarded', 'discarded', 'e-discarded', 0),
      set('s-skipped', 'skipped', 'e-skipped', 0),
    ]);

    const sessions = await loadExerciseSessions('bench-press');
    expect(sessions.map((entry) => entry.workoutId)).toEqual(['old', 'new']);
    expect(sessions[1]?.sets.map((entry) => entry.id)).toEqual(['s1', 's2']);
  });

  it('separates exercises', () => {
    const grouped = groupSessions(
      [workout('w', T)],
      [entry('a', 'w'), entry('b', 'w', { exerciseId: 'squat' })],
      [set('s-a', 'w', 'a', 0), set('s-b', 'w', 'b', 0)],
    );
    expect([...grouped.keys()].sort()).toEqual(['bench-press', 'squat']);
  });
});
