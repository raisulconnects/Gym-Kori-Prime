import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { db } from './db';
import { addCustomExercise, deleteRoutine, type RoutineDraft, saveRoutine, scheduleOn, setWeekday } from './store';

const MONDAY = 1;
const TUESDAY = 2;

const pushDay: RoutineDraft = {
  name: '  Push Day  ',
  items: [
    { exerciseId: 'bench-press', sets: 3, reps: 8 },
    { exerciseId: 'cable-fly', sets: 3, reps: 12 },
  ],
};

async function activeRows(routineId: string) {
  const rows = await db.routineExercises.where('routineId').equals(routineId).toArray();
  return rows.filter((row) => !row.deletedAt).sort((a, b) => a.position - b.position);
}

beforeEach(async () => {
  await db.delete();
  await db.open();
});

describe('saveRoutine', () => {
  it('stores a trimmed name and exercises in order', async () => {
    const id = await saveRoutine(pushDay);
    expect((await db.routines.get(id))?.name).toBe('Push Day');
    expect((await activeRows(id)).map((row) => row.exerciseId)).toEqual(['bench-press', 'cable-fly']);
  });

  it('keeps removed exercises as deleted rows, so the delete can sync later', async () => {
    const id = await saveRoutine(pushDay);
    const [bench] = await activeRows(id);
    await saveRoutine({ id, name: 'Push Day', items: [{ id: bench?.id, exerciseId: 'bench-press', sets: 3, reps: 8 }] });

    expect(await activeRows(id)).toHaveLength(1);
    expect(await db.routineExercises.where('routineId').equals(id).count()).toBe(2);
  });

  it('keeps the original creation time when editing', async () => {
    const id = await saveRoutine(pushDay);
    const createdAt = (await db.routines.get(id))?.createdAt;
    await saveRoutine({ id, name: 'Renamed', items: [] });
    const updated = await db.routines.get(id);
    expect(updated?.createdAt).toBe(createdAt);
    expect(updated?.name).toBe('Renamed');
  });
});

describe('schedule', () => {
  it('is all rest before anything is set', async () => {
    expect(scheduleOn(await db.weeklySchedules.toArray(), '2026-10-01').every((day) => day === null)).toBe(true);
  });

  it('changing the schedule does not rewrite earlier dates', async () => {
    await setWeekday(MONDAY, 'push', '2026-10-01');
    await setWeekday(MONDAY, 'pull', '2026-10-20');
    const schedules = await db.weeklySchedules.toArray();

    expect(scheduleOn(schedules, '2026-09-30')[MONDAY]).toBeNull();
    expect(scheduleOn(schedules, '2026-10-19')[MONDAY]).toBe('push');
    expect(scheduleOn(schedules, '2026-10-20')[MONDAY]).toBe('pull');
  });

  it('keeps the other weekdays when one changes', async () => {
    await setWeekday(MONDAY, 'push', '2026-10-01');
    await setWeekday(TUESDAY, 'pull', '2026-10-02');
    const days = scheduleOn(await db.weeklySchedules.toArray(), '2026-10-02');
    expect(days[MONDAY]).toBe('push');
    expect(days[TUESDAY]).toBe('pull');
  });

  it('several changes on one day make only one new version', async () => {
    await setWeekday(MONDAY, 'push', '2026-10-01');
    await setWeekday(TUESDAY, 'pull', '2026-10-01');
    expect(await db.weeklySchedules.count()).toBe(1);
  });
});

describe('deleteRoutine', () => {
  it('hides the routine and takes it off the schedule from today only', async () => {
    const id = await saveRoutine(pushDay);
    await setWeekday(MONDAY, id, '2026-10-01');
    await deleteRoutine(id, '2026-10-20');

    expect((await db.routines.get(id))?.deletedAt).toBeDefined();
    expect(await activeRows(id)).toEqual([]);
    const schedules = await db.weeklySchedules.toArray();
    expect(scheduleOn(schedules, '2026-10-19')[MONDAY]).toBe(id);
    expect(scheduleOn(schedules, '2026-10-20')[MONDAY]).toBeNull();
  });
});

describe('addCustomExercise', () => {
  it('adds a new exercise', async () => {
    const exercise = await addCustomExercise('  Tire Flip ');
    expect(exercise.name).toBe('Tire Flip');
    expect(await db.customExercises.count()).toBe(1);
  });

  it('reuses a built-in exercise instead of making a duplicate', async () => {
    const exercise = await addCustomExercise('bench-press');
    expect(exercise.id).toBe('bench-press');
    expect(await db.customExercises.count()).toBe(0);
  });

  it('reuses an existing custom exercise', async () => {
    const first = await addCustomExercise('Tire Flip');
    const second = await addCustomExercise('tire flip');
    expect(second.id).toBe(first.id);
    expect(await db.customExercises.count()).toBe(1);
  });
});
