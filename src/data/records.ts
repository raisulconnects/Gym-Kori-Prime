import { db, type Workout, type WorkoutExercise, type WorkoutSet } from './db';

/**
 * Personal records are worked out from the sets already logged, rather than stored. That way
 * they can never disagree with the workouts, they need nothing extra to sync, and deleting a
 * workout removes its records too.
 */

export type RecordKind = 'heaviest' | 'oneRepMax' | 'mostReps' | 'volume';

/** Records a single set can break. Volume belongs to a whole session instead. */
const SET_KINDS = ['heaviest', 'oneRepMax', 'mostReps'] as const;

/** The Epley estimate gets unreliable beyond this many reps, so higher-rep sets don't count. */
const MAX_ONE_REP_MAX_REPS = 12;

/** Weights are saved to 3 decimal places, so smaller differences are just rounding. */
const MARGIN = 0.001;

export interface RecordSet {
  id: string;
  weightKg: number | null;
  reps: number | null;
}

/** One workout's done sets for one exercise, in the order they were done. */
export interface ExerciseSession {
  workoutId: string;
  localDate: string;
  startedAt: string;
  routineName: string;
  sets: RecordSet[];
}

export interface RecordValue {
  /** Kg for weight records, a count for reps. */
  value: number;
  /** The set that set the record. Missing for volume, which comes from a whole session. */
  set?: RecordSet;
  workoutId: string;
  localDate: string;
}

export type ExerciseRecords = Partial<Record<RecordKind, RecordValue>>;

/** Which records each set broke, by set ID, plus whether the session set a volume record. */
export interface SessionRecords {
  bySet: Record<string, RecordKind[]>;
  volume: boolean;
}

/** The most someone could likely lift once, from a set of 12 reps or fewer. Null when it can't be estimated. */
export function estimateOneRepMax(weightKg: number | null, reps: number | null): number | null {
  if (weightKg === null || weightKg <= 0 || reps === null || reps < 1 || reps > MAX_ONE_REP_MAX_REPS) return null;
  return reps === 1 ? weightKg : weightKg * (1 + reps / 30);
}

function setValue(kind: (typeof SET_KINDS)[number], set: RecordSet): number | null {
  if (set.reps === null || set.reps < 1) return null;
  if (kind === 'mostReps') return set.reps;
  if (kind === 'oneRepMax') return estimateOneRepMax(set.weightKg, set.reps);
  return set.weightKg !== null && set.weightKg > 0 ? set.weightKg : null;
}

/** The total weight moved in a session. Null for bodyweight work, which has no weight to add up. */
export function sessionVolume(sets: RecordSet[]): number | null {
  let total = 0;
  for (const set of sets) {
    if (set.weightKg !== null && set.weightKg > 0 && set.reps !== null && set.reps > 0) total += set.weightKg * set.reps;
  }
  return total > 0 ? total : null;
}

const beats = (value: number | null, best: RecordValue | undefined): value is number =>
  value !== null && (!best || value > best.value + MARGIN);

/** Adds one session to the running records. The first session to reach a value keeps it, so ties don't move it. */
function addSession(records: ExerciseRecords, session: ExerciseSession): SessionRecords {
  const bySet: Record<string, RecordKind[]> = {};
  for (const set of session.sets) {
    for (const kind of SET_KINDS) {
      const value = setValue(kind, set);
      if (!beats(value, records[kind])) continue;
      records[kind] = { value, set, workoutId: session.workoutId, localDate: session.localDate };
      bySet[set.id] = [...(bySet[set.id] ?? []), kind];
    }
  }
  const volume = sessionVolume(session.sets);
  const volumeRecord = beats(volume, records.volume);
  if (volumeRecord) records.volume = { value: volume, workoutId: session.workoutId, localDate: session.localDate };
  return { bySet, volume: volumeRecord };
}

/** The best of everything across these sessions, which must be oldest first. */
export function exerciseRecords(sessions: ExerciseSession[]): ExerciseRecords {
  const records: ExerciseRecords = {};
  for (const session of sessions) addSession(records, session);
  return records;
}

const NO_RECORDS: SessionRecords = { bySet: {}, volume: false };

/**
 * Which records `session` broke, compared with the sessions before it (oldest first). Nothing
 * counts the first time, because every set would be a record. Within the session, a set only
 * counts if it also beats the sets done earlier in it.
 */
export function newRecordsIn(session: ExerciseSession, earlier: ExerciseSession[]): SessionRecords {
  if (earlier.length === 0) return NO_RECORDS;
  return addSession(exerciseRecords(earlier), session);
}

/** Every session with the records it broke at the time, newest first, as the Exercise screen shows them. */
export function sessionsWithRecords(sessions: ExerciseSession[]): (ExerciseSession & { records: SessionRecords })[] {
  const records: ExerciseRecords = {};
  const result = sessions.map((session, index) => {
    const broken = addSession(records, session);
    return { ...session, records: index === 0 ? NO_RECORDS : broken };
  });
  return result.reverse();
}

/**
 * Groups logged sets into sessions per exercise, oldest first. Only done sets from finished,
 * kept workouts count, and skipped exercises are left out.
 */
export function groupSessions(
  workouts: Workout[],
  entries: WorkoutExercise[],
  sets: WorkoutSet[],
): Map<string, ExerciseSession[]> {
  const finished = new Map(
    workouts.filter((workout) => workout.status === 'finished' && !workout.deletedAt).map((workout) => [workout.id, workout]),
  );
  const setsByEntry = new Map<string, WorkoutSet[]>();
  for (const set of sets) {
    if (!set.done || set.deletedAt) continue;
    setsByEntry.set(set.workoutExerciseId, [...(setsByEntry.get(set.workoutExerciseId) ?? []), set]);
  }

  const byExercise = new Map<string, ExerciseSession[]>();
  for (const entry of entries) {
    const workout = finished.get(entry.workoutId);
    const done = setsByEntry.get(entry.id);
    if (!workout || !done || entry.deletedAt || entry.skipped) continue;
    const session: ExerciseSession = {
      workoutId: workout.id,
      localDate: workout.localDate,
      startedAt: workout.startedAt,
      routineName: workout.routineName,
      sets: done
        .sort((first, second) => first.position - second.position)
        .map(({ id, weightKg, reps }) => ({ id, weightKg, reps })),
    };
    byExercise.set(entry.exerciseId, [...(byExercise.get(entry.exerciseId) ?? []), session]);
  }
  for (const sessions of byExercise.values()) {
    sessions.sort((first, second) => first.startedAt.localeCompare(second.startedAt));
  }
  return byExercise;
}

/** Every finished session of one exercise, oldest first. */
export async function loadExerciseSessions(exerciseId: string): Promise<ExerciseSession[]> {
  const entries = await db.workoutExercises.where('exerciseId').equals(exerciseId).toArray();
  const workoutIds = [...new Set(entries.map((entry) => entry.workoutId))];
  const [workouts, sets] = await Promise.all([
    db.workouts.bulkGet(workoutIds),
    db.workoutSets.where('workoutId').anyOf(workoutIds).toArray(),
  ]);
  const found = workouts.filter((workout): workout is Workout => workout !== undefined);
  return groupSessions(found, entries, sets).get(exerciseId) ?? [];
}

/** A workout's done sets for one exercise, in order, ready to compare with earlier sessions. */
export function toSession(workout: Workout, sets: WorkoutSet[]): ExerciseSession {
  return {
    workoutId: workout.id,
    localDate: workout.localDate,
    startedAt: workout.startedAt,
    routineName: workout.routineName,
    sets: sets
      .filter((set) => set.done && !set.deletedAt)
      .sort((first, second) => first.position - second.position)
      .map(({ id, weightKg, reps }) => ({ id, weightKg, reps })),
  };
}

/** Sessions that started before a given workout, which are the ones its records are judged against. */
export function sessionsBefore(sessions: ExerciseSession[], startedAt: string, workoutId: string): ExerciseSession[] {
  return sessions.filter((session) => session.workoutId !== workoutId && session.startedAt < startedAt);
}
