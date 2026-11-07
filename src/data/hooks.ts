import { useLiveQuery } from 'dexie-react-hooks';
import { useEffect, useState, useSyncExternalStore } from 'react';
import { toLocalDate } from '../lib/week';
import { type AttendanceDay, weekAttendance } from './attendance';
import { latestBodyWeight } from './body';
import {
  type BodyWeight,
  db,
  type Routine,
  type RoutineExercise,
  type WeekPlan,
  type Workout,
  type WorkoutExercise,
  type WorkoutSet,
} from './db';
import { BUILT_IN_EXERCISES, type ExerciseOption } from './exerciseCatalog';
import {
  type ExerciseRecords,
  type ExerciseSession,
  exerciseRecords,
  groupSessions,
  loadExerciseSessions,
  newRecordsIn,
  type SessionRecords,
  sessionsBefore,
  sessionsWithRecords,
  toSession,
} from './records';
import { scheduleOn } from './store';
import { getSyncStatus, subscribeToSyncStatus, type SyncStatus } from './sync';
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
  /** The records to beat from earlier workouts. Null the first time this exercise is done. */
  best: ExerciseRecords | null;
  /** Records broken so far in this workout. */
  records: SessionRecords;
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
        .map(async (entry) => {
          const entrySets = sets
            .filter((set) => set.workoutExerciseId === entry.id && !set.deletedAt)
            .sort((first, second) => first.position - second.position);
          const earlier = sessionsBefore(await loadExerciseSessions(entry.exerciseId), workout.startedAt, workout.id);
          return {
            ...entry,
            sets: entrySets,
            last: await loadLastPerformance(entry.exerciseId, workout.id),
            best: earlier.length > 0 ? exerciseRecords(earlier) : null,
            records: newRecordsIn(toSession(workout, entrySets), earlier),
          };
        }),
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

export interface WorkoutCounts {
  /** Exercises with at least one set marked done. */
  done: number;
  total: number;
  notes: number;
  extras: number;
}

export interface WeekHistory {
  days: AttendanceDay[];
  /** Includes deleted routines, because past days can still refer to them. */
  routineNames: Map<string, string>;
  counts: Map<string, WorkoutCounts>;
  /** The first date with a schedule or workout. Null when there's nothing to show yet. */
  firstDate: string | null;
}

/** Attendance and workout summaries for a week. Undefined while loading. */
export function useWeekHistory(weekDate: Date, today: string): WeekHistory | undefined {
  const weekKey = toLocalDate(weekDate);
  return useLiveQuery(async () => {
    const [schedules, allWorkouts, routines, entries, sets] = await Promise.all([
      db.weeklySchedules.toArray(),
      db.workouts.toArray(),
      db.routines.toArray(),
      db.workoutExercises.toArray(),
      db.workoutSets.toArray(),
    ]);
    const workouts = allWorkouts.filter((workout) => !workout.deletedAt);
    const days = weekAttendance(weekDate, today, schedules, workouts);

    const doneEntryIds = new Set(sets.filter((set) => set.done && !set.deletedAt).map((set) => set.workoutExerciseId));
    const counts = new Map<string, WorkoutCounts>();
    for (const day of days) {
      for (const workout of day.workouts) {
        const rows = entries.filter((entry) => entry.workoutId === workout.id && !entry.deletedAt);
        counts.set(workout.id, {
          done: rows.filter((entry) => doneEntryIds.has(entry.id)).length,
          total: rows.filter((entry) => !entry.extra).length,
          notes: rows.filter((entry) => entry.note.trim() !== '').length + (workout.note ? 1 : 0),
          extras: rows.filter((entry) => entry.extra).length,
        });
      }
    }

    const knownDates = [
      ...schedules.filter((schedule) => !schedule.deletedAt).map((schedule) => schedule.effectiveFrom),
      ...workouts.map((workout) => workout.localDate),
    ].sort();

    return {
      days,
      routineNames: new Map(routines.map((routine) => [routine.id, routine.name])),
      counts,
      firstDate: knownDates[0] ?? null,
    };
  }, [weekKey, today]);
}

export interface WorkoutDetail {
  workout: Workout;
  /** Each exercise with its sets, and the records it broke compared with earlier workouts. */
  exercises: (WorkoutExercise & { sets: WorkoutSet[]; records: SessionRecords })[];
}

/** A saved workout with everything logged in it. Null if not found, undefined while loading. */
export function useWorkoutDetail(workoutId: string): WorkoutDetail | null | undefined {
  return useLiveQuery(async () => {
    const workout = await db.workouts.get(workoutId);
    if (!workout || workout.deletedAt) return null;
    const [entries, sets] = await Promise.all([
      db.workoutExercises.where('workoutId').equals(workoutId).toArray(),
      db.workoutSets.where('workoutId').equals(workoutId).toArray(),
    ]);
    const exercises = await Promise.all(
      entries
        .filter((entry) => !entry.deletedAt)
        .sort((first, second) => first.position - second.position)
        .map(async (entry) => {
          const entrySets = sets
            .filter((set) => set.workoutExerciseId === entry.id && !set.deletedAt)
            .sort((first, second) => first.position - second.position);
          const earlier = sessionsBefore(await loadExerciseSessions(entry.exerciseId), workout.startedAt, workout.id);
          const records = entry.skipped
            ? { bySet: {}, volume: false }
            : newRecordsIn(toSession(workout, entrySets), earlier);
          return { ...entry, sets: entrySets, records };
        }),
    );
    return { workout, exercises };
  }, [workoutId]);
}

export interface ExerciseProgress {
  exerciseId: string;
  name: string;
  records: ExerciseRecords;
  /** The last day this exercise was done. */
  lastDate: string;
}

/** Names for every exercise, including custom ones deleted later, since old workouts still use them. */
async function exerciseNames(): Promise<Map<string, string>> {
  const custom = await db.customExercises.toArray();
  return new Map([...BUILT_IN_EXERCISES, ...custom].map((exercise) => [exercise.id, exercise.name]));
}

/** Every exercise done at least once, with its records, most recently done first. Undefined while loading. */
export function useExerciseProgressList(): ExerciseProgress[] | undefined {
  return useLiveQuery(async () => {
    const [workouts, entries, sets, names] = await Promise.all([
      db.workouts.toArray(),
      db.workoutExercises.toArray(),
      db.workoutSets.toArray(),
      exerciseNames(),
    ]);
    return [...groupSessions(workouts, entries, sets)]
      .map(([exerciseId, sessions]) => ({
        exerciseId,
        name: names.get(exerciseId) ?? '',
        records: exerciseRecords(sessions),
        lastDate: sessions[sessions.length - 1]?.localDate ?? '',
      }))
      .sort((first, second) => second.lastDate.localeCompare(first.lastDate));
  });
}

export interface ExerciseHistory {
  name: string;
  records: ExerciseRecords;
  /** Newest first, each with the records it broke at the time. */
  sessions: (ExerciseSession & { records: SessionRecords })[];
}

/** One exercise's records and past sessions. Undefined while loading. */
export function useExerciseHistory(exerciseId: string): ExerciseHistory | undefined {
  return useLiveQuery(async () => {
    const [sessions, names] = await Promise.all([loadExerciseSessions(exerciseId), exerciseNames()]);
    return {
      name: names.get(exerciseId) ?? '',
      records: exerciseRecords(sessions),
      sessions: sessionsWithRecords(sessions),
    };
  }, [exerciseId]);
}

/** The most recent saved body weight. Null if none, undefined while loading. */
export function useLatestBodyWeight(): BodyWeight | null | undefined {
  return useLiveQuery(async () => latestBodyWeight(await db.bodyWeights.toArray()));
}

/** Whether this device's changes have reached the server. */
export function useSyncStatus(): SyncStatus {
  return useSyncExternalStore(subscribeToSyncStatus, getSyncStatus);
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
