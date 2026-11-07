import { createId } from '../lib/ids';
import { type CustomExercise, db, type RoutineExercise, type WeekPlan, type WeeklySchedule } from './db';
import { BUILT_IN_EXERCISES, type ExerciseOption, exerciseKey } from './exerciseCatalog';

const REST_WEEK: WeekPlan = [null, null, null, null, null, null, null];

const now = () => new Date().toISOString();

export interface RoutineDraftItem {
  /** Missing for an exercise that was just added to the routine. */
  id?: string;
  exerciseId: string;
  sets: number;
  reps: number;
}

export interface RoutineDraft {
  /** Missing for a new routine. */
  id?: string;
  name: string;
  items: RoutineDraftItem[];
}

/** Creates or updates a routine with its exercises, as one all-or-nothing change. */
export async function saveRoutine(draft: RoutineDraft): Promise<string> {
  const timestamp = now();
  const routineId = draft.id ?? createId();
  await db.transaction('rw', db.routines, db.routineExercises, async () => {
    const existing = await db.routines.get(routineId);
    await db.routines.put({
      id: routineId,
      name: draft.name.trim(),
      createdAt: existing?.createdAt ?? timestamp,
      updatedAt: timestamp,
    });

    const keptIds = new Set(draft.items.flatMap((item) => (item.id ? [item.id] : [])));
    const previous = await db.routineExercises.where('routineId').equals(routineId).toArray();
    const removed = previous
      .filter((row) => !row.deletedAt && !keptIds.has(row.id))
      .map((row): RoutineExercise => ({ ...row, deletedAt: timestamp, updatedAt: timestamp }));
    const saved = draft.items.map(
      (item, position): RoutineExercise => ({
        id: item.id ?? createId(),
        routineId,
        exerciseId: item.exerciseId,
        position,
        sets: item.sets,
        reps: item.reps,
        updatedAt: timestamp,
      }),
    );
    await db.routineExercises.bulkPut([...removed, ...saved]);
  });
  return routineId;
}

/** Deletes a routine and takes it off the schedule from `today`. Earlier weeks are left alone. */
export async function deleteRoutine(routineId: string, today: string): Promise<void> {
  const timestamp = now();
  await db.transaction('rw', db.routines, db.routineExercises, db.weeklySchedules, async () => {
    await db.routines.update(routineId, { deletedAt: timestamp, updatedAt: timestamp });
    const rows = await db.routineExercises.where('routineId').equals(routineId).toArray();
    await db.routineExercises.bulkPut(rows.map((row) => ({ ...row, deletedAt: timestamp, updatedAt: timestamp })));

    const schedules = await db.weeklySchedules.toArray();
    const days = scheduleOn(schedules, today);
    if (days.includes(routineId)) {
      await writeWeek(
        schedules,
        days.map((day) => (day === routineId ? null : day)),
        today,
        timestamp,
      );
    }
  });
}

/** Finds the plan in force on a date. Before any schedule exists, every day is rest. */
export function scheduleOn(schedules: WeeklySchedule[], date: string): WeekPlan {
  let latest: WeeklySchedule | undefined;
  for (const schedule of schedules) {
    if (schedule.deletedAt || schedule.effectiveFrom > date) continue;
    // Two devices can each start a new version on the same day. The later change wins.
    const isNewer =
      !latest ||
      schedule.effectiveFrom > latest.effectiveFrom ||
      (schedule.effectiveFrom === latest.effectiveFrom && schedule.updatedAt > latest.updatedAt);
    if (isNewer) latest = schedule;
  }
  return latest?.days ?? REST_WEEK;
}

async function writeWeek(schedules: WeeklySchedule[], days: WeekPlan, today: string, timestamp: string) {
  const startedToday = schedules.find((schedule) => schedule.effectiveFrom === today && !schedule.deletedAt);
  await db.weeklySchedules.put({
    id: startedToday?.id ?? createId(),
    effectiveFrom: today,
    days,
    updatedAt: timestamp,
  });
}

/**
 * Changes one weekday's plan from `today` onwards by adding a new version of the week.
 * Older versions are kept so past attendance is still judged by the plan at that time.
 */
export async function setWeekday(weekday: number, routineId: string | null, today: string): Promise<void> {
  await db.transaction('rw', db.weeklySchedules, async () => {
    const schedules = await db.weeklySchedules.toArray();
    const days = scheduleOn(schedules, today).map((day, index) => (index === weekday ? routineId : day));
    await writeWeek(schedules, days, today, now());
  });
}

/** Adds the user's own exercise, or reuses an existing one with the same name. */
export async function addCustomExercise(name: string): Promise<ExerciseOption> {
  const trimmed = name.trim();
  const key = exerciseKey(trimmed);
  const builtIn = BUILT_IN_EXERCISES.find((exercise) => exerciseKey(exercise.name) === key);
  if (builtIn) return builtIn;

  return db.transaction('rw', db.customExercises, async () => {
    const custom = await db.customExercises.toArray();
    const existing = custom.find((exercise) => !exercise.deletedAt && exerciseKey(exercise.name) === key);
    if (existing) return { id: existing.id, name: existing.name };
    const created: CustomExercise = { id: createId(), name: trimmed, updatedAt: now() };
    await db.customExercises.add(created);
    return { id: created.id, name: created.name };
  });
}
