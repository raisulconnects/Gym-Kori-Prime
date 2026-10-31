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

export class GymKoriDatabase extends Dexie {
  routines!: EntityTable<Routine, 'id'>;
  routineExercises!: EntityTable<RoutineExercise, 'id'>;
  customExercises!: EntityTable<CustomExercise, 'id'>;
  weeklySchedules!: EntityTable<WeeklySchedule, 'id'>;
  workouts!: EntityTable<Workout, 'id'>;
  workoutExercises!: EntityTable<WorkoutExercise, 'id'>;
  workoutSets!: EntityTable<WorkoutSet, 'id'>;

  constructor(name: string) {
    super(name);
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

/** Holds data created on this device before accounts existed. */
const DEVICE_DATABASE = 'gym-kori';

/**
 * The signed-in user's database. Each account has its own on this device, so people sharing a
 * phone can't see each other's workouts, and logging out loses nothing.
 */
export let db = new GymKoriDatabase(DEVICE_DATABASE);

/** Moves data from before accounts existed into the first account to log in on this device. */
async function adoptDeviceData(target: GymKoriDatabase) {
  if (!(await Dexie.exists(DEVICE_DATABASE))) return;
  const source = new GymKoriDatabase(DEVICE_DATABASE);
  try {
    await source.open();
    // Read everything first, because waiting on another database would end the write below.
    const contents = await Promise.all(
      source.tables.map(async (table) => ({ name: table.name, rows: await table.toArray() })),
    );
    await target.transaction('rw', target.tables, async () => {
      for (const { name, rows } of contents) await target.table(name).bulkPut(rows);
    });
    await source.delete();
  } catch (error) {
    // Never block login over this. The old data stays put, and the next login tries again.
    console.error('Could not move device data into the account', error);
    source.close();
  }
}

export async function openUserDatabase(userId: string): Promise<void> {
  db.close();
  const userDatabase = new GymKoriDatabase(`${DEVICE_DATABASE}-${userId}`);
  await userDatabase.open();
  await adoptDeviceData(userDatabase);
  db = userDatabase;
}

/** Permanently removes the current account's data from this device. */
export async function deleteUserDatabase(): Promise<void> {
  await db.delete();
}

