import { useLiveQuery } from 'dexie-react-hooks';
import { useEffect, useState } from 'react';
import { type Routine, type RoutineExercise, db, type WeekPlan } from './db';
import { BUILT_IN_EXERCISES, type ExerciseOption } from './exerciseCatalog';
import { scheduleOn } from './store';

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
