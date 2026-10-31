import 'fake-indexeddb/auto';
import Dexie from 'dexie';
import { beforeEach, describe, expect, it } from 'vitest';
import { db, deleteUserDatabase, GymKoriDatabase, openUserDatabase } from './db';
import { saveRoutine } from './store';

const routine = { name: 'Push Day', items: [{ exerciseId: 'squat', sets: 3, reps: 8 }] };

beforeEach(async () => {
  db.close();
  for (const name of await Dexie.getDatabaseNames()) await Dexie.delete(name);
});

describe('per-account databases', () => {
  it('keeps each account’s data separate', async () => {
    await openUserDatabase('alice');
    await saveRoutine(routine);
    expect(await db.routines.count()).toBe(1);

    await openUserDatabase('bob');
    expect(await db.routines.count()).toBe(0);

    await openUserDatabase('alice');
    expect(await db.routines.count()).toBe(1);
  });

  it('moves data from before accounts into the first login, then removes the old copy', async () => {
    const deviceData = new GymKoriDatabase('gym-kori');
    await deviceData.routines.put({ id: 'old', name: 'Push Day', createdAt: 'then', updatedAt: 'then' });
    await deviceData.routineExercises.put({
      id: 'old-row',
      routineId: 'old',
      exerciseId: 'squat',
      position: 0,
      sets: 3,
      reps: 8,
      updatedAt: 'then',
    });
    deviceData.close();

    await openUserDatabase('alice');
    expect((await db.routines.get('old'))?.name).toBe('Push Day');
    expect(await db.routineExercises.where('routineId').equals('old').count()).toBe(1);
    expect(await Dexie.exists('gym-kori')).toBe(false);

    await openUserDatabase('bob');
    expect(await db.routines.count()).toBe(0);
  });

  it('moves workouts too, and login still works when there is nothing to move', async () => {
    await openUserDatabase('empty-device');
    expect(await db.routines.count()).toBe(0);

    const deviceData = new GymKoriDatabase('gym-kori');
    await deviceData.workouts.put({
      id: 'old-workout',
      localDate: '2026-10-28',
      routineId: null,
      routineName: 'Push Day',
      status: 'finished',
      startedAt: 'then',
      lastActivityAt: 'then',
      note: '',
      updatedAt: 'then',
    });
    deviceData.close();

    await openUserDatabase('alice');
    expect((await db.workouts.get('old-workout'))?.routineName).toBe('Push Day');
  });

  it('removes only the current account’s data', async () => {
    await openUserDatabase('alice');
    await saveRoutine(routine);
    await openUserDatabase('bob');
    await saveRoutine(routine);

    await deleteUserDatabase();
    expect(await Dexie.exists('gym-kori-bob')).toBe(false);
    expect(await Dexie.exists('gym-kori-alice')).toBe(true);
  });
});
