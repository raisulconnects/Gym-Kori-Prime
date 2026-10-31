import Dexie, { type EntityTable } from 'dexie';

/** Deleted rows are kept with `deletedAt` so the delete can sync to other devices later. */
interface Synced {
  id: string;
  updatedAt: string;
  deletedAt?: string;
}

export interface Routine extends Synced {
  name: string;
  createdAt: string;
}

export interface RoutineExercise extends Synced {
  routineId: string;
  exerciseId: string;
  position: number;
  sets: number;
  reps: number;
}

export interface CustomExercise extends Synced {
  name: string;
}

/** What to do on each weekday. Index 0 is Sunday, matching Date.getDay(). Null means rest. */
export type WeekPlan = (string | null)[];

/** One version of the week, used from `effectiveFrom` until a newer version starts. */
export interface WeeklySchedule extends Synced {
  effectiveFrom: string;
  days: WeekPlan;
}

export interface Workout extends Synced {
  /** The date on the user's calendar when it started. The workout belongs to this day. */
  localDate: string;
  routineId: string | null;
  /** Kept separately so history still reads correctly if the routine is renamed or deleted. */
  routineName: string;
  status: 'active' | 'finished';
  startedAt: string;
  /** The last time anything was logged, used to spot a forgotten Finish. */
  lastActivityAt: string;
  endedAt?: string;
  durationSeconds?: number;
  note: string;
}

export interface WorkoutExercise extends Synced {
  workoutId: string;
  exerciseId: string;
  position: number;
  skipped: boolean;
  /** True when it was added during the workout rather than coming from the routine. */
  extra: boolean;
  note: string;
}

export interface WorkoutSet extends Synced {
  workoutId: string;
  workoutExerciseId: string;
  position: number;
  /** Always kg. Null means no weight was entered, as with bodyweight exercises. */
  weightKg: number | null;
  reps: number | null;
  done: boolean;
}

class GymKoriDatabase extends Dexie {
  routines!: EntityTable<Routine, 'id'>;
  routineExercises!: EntityTable<RoutineExercise, 'id'>;
  customExercises!: EntityTable<CustomExercise, 'id'>;
  weeklySchedules!: EntityTable<WeeklySchedule, 'id'>;
  workouts!: EntityTable<Workout, 'id'>;
  workoutExercises!: EntityTable<WorkoutExercise, 'id'>;
  workoutSets!: EntityTable<WorkoutSet, 'id'>;

  constructor() {
    super('gym-kori');
    this.version(1).stores({
      routines: 'id',
      routineExercises: 'id, routineId',
      customExercises: 'id',
      weeklySchedules: 'id, effectiveFrom',
    });
    this.version(2).stores({
      workouts: 'id, localDate, status',
      workoutExercises: 'id, workoutId, exerciseId',
      workoutSets: 'id, workoutId, workoutExerciseId',
    });
  }
}

export const db = new GymKoriDatabase();
