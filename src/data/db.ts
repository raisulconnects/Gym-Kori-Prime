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

class GymKoriDatabase extends Dexie {
  routines!: EntityTable<Routine, 'id'>;
  routineExercises!: EntityTable<RoutineExercise, 'id'>;
  customExercises!: EntityTable<CustomExercise, 'id'>;
  weeklySchedules!: EntityTable<WeeklySchedule, 'id'>;

  constructor() {
    super('gym-kori');
    this.version(1).stores({
      routines: 'id',
      routineExercises: 'id, routineId',
      customExercises: 'id',
      weeklySchedules: 'id, effectiveFrom',
    });
  }
}

export const db = new GymKoriDatabase();
