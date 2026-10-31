import { createId } from '../lib/ids';
import { toLocalDate } from '../lib/week';
import { db, type Workout, type WorkoutExercise, type WorkoutSet } from './db';

/** After this long with nothing logged, assume the user forgot to tap Finish. */
export const STALE_AFTER_MS = 3 * 60 * 60 * 1000;

const EXTRA_EXERCISE_SETS = 3;
const EXTRA_EXERCISE_REPS = 10;

/** A function because `db` changes when a different account logs in. */
const workoutTables = () => [db.workouts, db.workoutExercises, db.workoutSets];

export interface PastSet {
  weightKg: number | null;
  reps: number | null;
}

interface RoutineToStart {
  id: string;
  name: string;
  items: { exerciseId: string; sets: number; reps: number }[];
}

/** The sets done the most recent time this exercise was logged, or null if never. */
export async function loadLastPerformance(exerciseId: string, excludeWorkoutId?: string): Promise<PastSet[] | null> {
  const entries = await db.workoutExercises.where('exerciseId').equals(exerciseId).toArray();
  const candidates = entries.filter((entry) => !entry.deletedAt && entry.workoutId !== excludeWorkoutId);
  const workouts = await db.workouts.bulkGet(candidates.map((entry) => entry.workoutId));
  const startedAt = new Map(
    workouts.flatMap((workout) =>
      workout && workout.status === 'finished' && !workout.deletedAt ? [[workout.id, workout.startedAt] as const] : [],
    ),
  );

  const newestFirst = candidates
    .filter((entry) => startedAt.has(entry.workoutId))
    .sort((first, second) => (startedAt.get(second.workoutId) ?? '').localeCompare(startedAt.get(first.workoutId) ?? ''));

  for (const entry of newestFirst) {
    const sets = await db.workoutSets.where('workoutExerciseId').equals(entry.id).toArray();
    const done = sets
      .filter((set) => set.done && !set.deletedAt)
      .sort((first, second) => first.position - second.position);
    if (done.length > 0) return done.map(({ weightKg, reps }) => ({ weightKg, reps }));
  }
  return null;
}

/**
 * Starts today's workout. Weight comes from last time, and reps from the routine's target,
 * so one tap confirms a set. If a workout is already running, that one is returned instead.
 */
export async function startWorkout(routine: RoutineToStart, now: Date): Promise<string> {
  return db.transaction('rw', workoutTables(), async () => {
    const running = await db.workouts
      .where('status')
      .equals('active')
      .filter((workout) => !workout.deletedAt)
      .first();
    if (running) return running.id;

    const timestamp = now.toISOString();
    const workoutId = createId();
    await db.workouts.add({
      id: workoutId,
      localDate: toLocalDate(now),
      routineId: routine.id,
      routineName: routine.name,
      status: 'active',
      startedAt: timestamp,
      lastActivityAt: timestamp,
      note: '',
      updatedAt: timestamp,
    });

    for (const [position, item] of routine.items.entries()) {
      const last = await loadLastPerformance(item.exerciseId, workoutId);
      await addExerciseRows(workoutId, item.exerciseId, position, false, item.sets, item.reps, last, timestamp);
    }
    return workoutId;
  });
}

async function addExerciseRows(
  workoutId: string,
  exerciseId: string,
  position: number,
  extra: boolean,
  setCount: number,
  reps: number,
  last: PastSet[] | null,
  timestamp: string,
): Promise<string> {
  const workoutExerciseId = createId();
  await db.workoutExercises.add({
    id: workoutExerciseId,
    workoutId,
    exerciseId,
    position,
    skipped: false,
    extra,
    note: '',
    updatedAt: timestamp,
  });
  const lastWeight = last?.[last.length - 1]?.weightKg ?? null;
  await db.workoutSets.bulkAdd(
    Array.from(
      { length: setCount },
      (_, index): WorkoutSet => ({
        id: createId(),
        workoutId,
        workoutExerciseId,
        position: index,
        weightKg: last?.[index]?.weightKg ?? lastWeight,
        reps,
        done: false,
        updatedAt: timestamp,
      }),
    ),
  );
  return workoutExerciseId;
}

async function touchWorkout(workoutId: string, timestamp: string) {
  await db.workouts.update(workoutId, { lastActivityAt: timestamp, updatedAt: timestamp });
}

export async function updateSet(
  set: WorkoutSet,
  changes: Partial<Pick<WorkoutSet, 'weightKg' | 'reps' | 'done'>>,
): Promise<void> {
  const timestamp = new Date().toISOString();
  await db.transaction('rw', workoutTables(), async () => {
    await db.workoutSets.update(set.id, { ...changes, updatedAt: timestamp });
    await touchWorkout(set.workoutId, timestamp);
  });
}

/** Adds another set, starting from the numbers in the previous one. */
export async function addSet(exercise: WorkoutExercise, previous: WorkoutSet | undefined): Promise<void> {
  const timestamp = new Date().toISOString();
  await db.transaction('rw', workoutTables(), async () => {
    await db.workoutSets.add({
      id: createId(),
      workoutId: exercise.workoutId,
      workoutExerciseId: exercise.id,
      position: (previous?.position ?? -1) + 1,
      weightKg: previous?.weightKg ?? null,
      reps: previous?.reps ?? null,
      done: false,
      updatedAt: timestamp,
    });
    await touchWorkout(exercise.workoutId, timestamp);
  });
}

export async function updateExercise(
  exercise: WorkoutExercise,
  changes: Partial<Pick<WorkoutExercise, 'skipped' | 'note'>>,
): Promise<void> {
  const timestamp = new Date().toISOString();
  await db.transaction('rw', workoutTables(), async () => {
    await db.workoutExercises.update(exercise.id, { ...changes, updatedAt: timestamp });
    await touchWorkout(exercise.workoutId, timestamp);
  });
}

/** Adds an exercise that wasn't in the routine. */
export async function addExtraExercise(workoutId: string, exerciseId: string): Promise<string> {
  const timestamp = new Date().toISOString();
  return db.transaction('rw', workoutTables(), async () => {
    const position = await db.workoutExercises.where('workoutId').equals(workoutId).count();
    const last = await loadLastPerformance(exerciseId, workoutId);
    const id = await addExerciseRows(
      workoutId,
      exerciseId,
      position,
      true,
      EXTRA_EXERCISE_SETS,
      EXTRA_EXERCISE_REPS,
      last,
      timestamp,
    );
    await touchWorkout(workoutId, timestamp);
    return id;
  });
}

export async function finishWorkout(workout: Workout, durationSeconds: number, note: string, now: Date): Promise<void> {
  const timestamp = now.toISOString();
  await db.workouts.update(workout.id, {
    status: 'finished',
    endedAt: timestamp,
    durationSeconds,
    note: note.trim(),
    updatedAt: timestamp,
  });
}

/** Removes a workout started by mistake. It won't count towards attendance or last-time numbers. */
export async function discardWorkout(workoutId: string): Promise<void> {
  const changes = { deletedAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
  await db.transaction('rw', workoutTables(), async () => {
    await db.workouts.update(workoutId, changes);
    await db.workoutExercises.where('workoutId').equals(workoutId).modify(changes);
    await db.workoutSets.where('workoutId').equals(workoutId).modify(changes);
  });
}

/** True when a running workout has had nothing logged for so long that it was probably forgotten. */
export function isStale(workout: Workout, now: Date): boolean {
  return workout.status === 'active' && now.getTime() - new Date(workout.lastActivityAt).getTime() > STALE_AFTER_MS;
}

/** A forgotten workout is timed up to the last thing logged, not up to now. */
export function suggestedMinutes(workout: Workout, now: Date): number {
  const end = isStale(workout, now) ? new Date(workout.lastActivityAt) : now;
  return Math.max(1, Math.round((end.getTime() - new Date(workout.startedAt).getTime()) / 60000));
}
