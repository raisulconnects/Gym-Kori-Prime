import { useLiveQuery } from 'dexie-react-hooks';
import { useEffect, useState } from 'react';
import {
  db,
  type Routine,
  type RoutineExercise,
  type WeekPlan,
  type Workout,
  type WorkoutExercise,
  type WorkoutSet,
} from './db';
import { BUILT_IN_EXERCISES, type ExerciseOption } from './exerciseCatalog';
import { scheduleOn } from './store';
import { loadLastPerformance, type PastSet } from './workouts';

export interface RoutineWithItems extends Routine {
  items: RoutineExercise[];
}

/** Saved routines, oldest first. Undefined while loading. */
export function useRoutines(): RoutineWithItems[] | undefined {
  return useLiveQuery(async () => {
    const [routines, rows] = await Promise.all([db.routines.toArray(), db.routineExercises.toArray()]);
    return routines
      .filter((routine) => !routine.deletedAt)
      .sort((first, second) => first.createdAt.localeCompare(second.createdAt))
      .map((routine) => ({
        ...routine,
        items: rows
          .filter((row) => row.routineId === routine.id && !row.deletedAt)
          .sort((first, second) => first.position - second.position),
      }));
  });
}

/** The week's plan in force on a date. Undefined while loading. */
export function useSchedule(date: string): WeekPlan | undefined {
  return useLiveQuery(async () => scheduleOn(await db.weeklySchedules.toArray(), date), [date]);
}

/** All built-in and custom exercises. Undefined while loading. */
export function useExercises(): ExerciseOption[] | undefined {
  return useLiveQuery(async () => {
    const custom = await db.customExercises.toArray();
    return [
      ...BUILT_IN_EXERCISES,
      ...custom.filter((exercise) => !exercise.deletedAt).map(({ id, name }) => ({ id, name })),
    ];
  });
}

export interface SessionExercise extends WorkoutExercise {
  sets: WorkoutSet[];
  last: PastSet[] | null;
}

export interface ActiveSession {
  workout: Workout;
  exercises: SessionExercise[];
}

/** The workout in progress with everything logged so far. Null if none, undefined while loading. */
export function useActiveWorkout(): ActiveSession | null | undefined {
  return useLiveQuery(async () => {
    const workout = await db.workouts
      .where('status')
      .equals('active')
      .filter((row) => !row.deletedAt)
      .first();
    if (!workout) return null;

    const [entries, sets] = await Promise.all([
      db.workoutExercises.where('workoutId').equals(workout.id).toArray(),
      db.workoutSets.where('workoutId').equals(workout.id).toArray(),
    ]);
    const exercises = await Promise.all(
      entries
        .filter((entry) => !entry.deletedAt)
        .sort((first, second) => first.position - second.position)
        .map(async (entry) => ({
          ...entry,
          sets: sets
            .filter((set) => set.workoutExerciseId === entry.id && !set.deletedAt)
            .sort((first, second) => first.position - second.position),
          last: await loadLastPerformance(entry.exerciseId, workout.id),
        })),
    );
    return { workout, exercises };
  });
}

export interface FinishedSummary {
  workout: Workout;
  /** Exercises with at least one set marked done. */
  doneCount: number;
  totalCount: number;
}

/** The workout finished on a date. Null if none, undefined while loading. */
export function useFinishedWorkoutOn(date: string): FinishedSummary | null | undefined {
  return useLiveQuery(async () => {
    const workout = await db.workouts
      .where('localDate')
      .equals(date)
      .filter((row) => row.status === 'finished' && !row.deletedAt)
      .first();
    if (!workout) return null;
    const [entries, sets] = await Promise.all([
      db.workoutExercises.where('workoutId').equals(workout.id).toArray(),
      db.workoutSets.where('workoutId').equals(workout.id).toArray(),
    ]);
    const doneIds = new Set(sets.filter((set) => set.done && !set.deletedAt).map((set) => set.workoutExerciseId));
    const active = entries.filter((entry) => !entry.deletedAt);
    return { workout, doneCount: active.filter((entry) => doneIds.has(entry.id)).length, totalCount: active.length };
  }, [date]);
}

/** The current time, updated every interval while a screen needs a running clock. */
export function useTicker(intervalMs: number): Date {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), intervalMs);
    return () => clearInterval(timer);
  }, [intervalMs]);
  return now;
}

/** The current date, refreshed when someone returns to an app left open overnight. */
export function useNow(): Date {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const refresh = () => {
      if (document.visibilityState === 'visible') setNow(new Date());
    };
    document.addEventListener('visibilitychange', refresh);
    return () => document.removeEventListener('visibilitychange', refresh);
  }, []);
  return now;
}
