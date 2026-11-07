import 'fake-indexeddb/auto';
import Dexie from 'dexie';
import { beforeEach, describe, expect, it } from 'vitest';
import { GymKoriDatabase } from './db';
import { countPending, SyncOfflineError, type SyncRemote, syncOnce } from './sync';

type Row = Record<string, unknown>;

/** Behaves like the real tables: the newest change wins, and rows come back in the order received. */
class FakeServer implements SyncRemote {
  tables = new Map<string, Map<string, Row>>();
  offline = false;
  refused = new Set<string>();
  /** Runs partway through a push, to imitate a change made while it's being sent. */
  duringPush: (() => Promise<void>) | null = null;
  private clock = Date.parse('2026-10-31T00:00:00Z');

  private table(name: string) {
    const existing = this.tables.get(name);
    if (existing) return existing;
    const created = new Map<string, Row>();
    this.tables.set(name, created);
    return created;
  }

  async push(name: string, rows: Row[]) {
    if (this.offline) throw new SyncOfflineError('offline');
    if (this.refused.has(name)) throw new Error('refused');
    const hook = this.duringPush;
    this.duringPush = null;
    await hook?.();
    const table = this.table(name);
    for (const row of rows) {
      const existing = table.get(row.id as string);
      if (existing && Date.parse(row.updated_at as string) <= Date.parse(existing.updated_at as string)) continue;
      this.clock += 1000;
      table.set(row.id as string, {
        ...row,
        // The server writes times in its own format.
        updated_at: new Date(row.updated_at as string).toISOString().replace('Z', '+00:00'),
        synced_at: new Date(this.clock).toISOString(),
      });
    }
  }

  async pull(name: string, since: string | null, limit: number) {
    if (this.offline) throw new SyncOfflineError('offline');
    if (this.refused.has(name)) throw new Error('refused');
    return [...this.table(name).values()]
      .filter((row) => !since || (row.synced_at as string) > since)
      .sort((first, second) => (first.synced_at as string).localeCompare(second.synced_at as string))
      .slice(0, limit);
  }

  row(table: string, id: string) {
    return this.tables.get(table)?.get(id);
  }
}

const T1 = '2026-10-31T08:00:00.000Z';
const T2 = '2026-10-31T09:00:00.000Z';
const T3 = '2026-10-31T10:00:00.000Z';

const routine = (id: string, name: string, updatedAt: string) => ({ id, name, createdAt: T1, updatedAt });

let server: FakeServer;
let phone: GymKoriDatabase;
let laptop: GymKoriDatabase;

beforeEach(async () => {
  for (const name of await Dexie.getDatabaseNames()) await Dexie.delete(name);
  server = new FakeServer();
  phone = new GymKoriDatabase('phone');
  laptop = new GymKoriDatabase('laptop');
});

describe('syncOnce', () => {
  it('brings a full workout from one device to another, exactly as logged', async () => {
    await phone.workouts.put({
      id: 'w1',
      localDate: '2026-10-31',
      routineId: null,
      routineName: 'Push Day',
      status: 'finished',
      startedAt: T1,
      lastActivityAt: T2,
      endedAt: T2,
      durationSeconds: 3600,
      note: 'Felt strong',
      updatedAt: T2,
    });
    await phone.workoutSets.bulkPut([
      { id: 's1', workoutId: 'w1', workoutExerciseId: 'e1', position: 0, weightKg: 62.5, reps: 8, done: true, updatedAt: T2 },
      { id: 's2', workoutId: 'w1', workoutExerciseId: 'e1', position: 1, weightKg: null, reps: null, done: false, updatedAt: T2 },
    ]);

    await syncOnce(phone, server);
    await syncOnce(laptop, server);

    const { syncedUpdatedAt: _a, ...workout } = (await laptop.workouts.get('w1')) ?? {};
    const { syncedUpdatedAt: _b, ...original } = (await phone.workouts.get('w1')) ?? {};
    expect(workout).toEqual(original);
    expect(await laptop.workoutSets.get('s1')).toMatchObject({ weightKg: 62.5, reps: 8, done: true });
    expect(await laptop.workoutSets.get('s2')).toMatchObject({ weightKg: null, reps: null, done: false });
  });

  it('leaves optional fields out rather than filling them with null', async () => {
    await phone.workouts.put({
      id: 'w1',
      localDate: '2026-10-31',
      routineId: 'r1',
      routineName: 'Push Day',
      status: 'active',
      startedAt: T1,
      lastActivityAt: T1,
      note: '',
      updatedAt: T1,
    });
    await syncOnce(phone, server);
    await syncOnce(laptop, server);
    const synced = await laptop.workouts.get('w1');
    expect(synced).not.toHaveProperty('deletedAt');
    expect(synced).not.toHaveProperty('endedAt');
    expect(synced).not.toHaveProperty('durationSeconds');
  });

  it('counts what is waiting, and nothing once it has been sent', async () => {
    await phone.routines.put(routine('r1', 'Push Day', T1));
    await phone.bodyWeights.put({ id: 'b1', localDate: '2026-10-31', weightKg: 72, updatedAt: T1 });
    expect(await countPending(phone)).toBe(2);
    await syncOnce(phone, server);
    expect(await countPending(phone)).toBe(0);
  });

  it('keeps everything and reports offline when the server cannot be reached', async () => {
    await phone.routines.put(routine('r1', 'Push Day', T1));
    server.offline = true;
    await expect(syncOnce(phone, server)).rejects.toBeInstanceOf(SyncOfflineError);
    expect(await countPending(phone)).toBe(1);
    expect((await phone.routines.get('r1'))?.name).toBe('Push Day');

    server.offline = false;
    await syncOnce(phone, server);
    expect(await countPending(phone)).toBe(0);
  });

  it('does not duplicate anything when synced repeatedly', async () => {
    await phone.routines.put(routine('r1', 'Push Day', T1));
    await syncOnce(phone, server);
    await syncOnce(phone, server);
    await syncOnce(laptop, server);
    await syncOnce(laptop, server);
    await syncOnce(phone, server);
    expect(await phone.routines.count()).toBe(1);
    expect(await laptop.routines.count()).toBe(1);
    expect(await countPending(laptop)).toBe(0);
  });

  it('lets the most recent change win, even if the older one arrives last', async () => {
    await phone.routines.put(routine('r1', 'Original', T1));
    await syncOnce(phone, server);
    await syncOnce(laptop, server);

    // The laptop makes the newer change first. The phone was offline and reconnects later.
    await laptop.routines.update('r1', { name: 'Newer', updatedAt: T3 });
    await phone.routines.update('r1', { name: 'Older', updatedAt: T2 });
    await syncOnce(laptop, server);
    await syncOnce(phone, server);
    await syncOnce(laptop, server);

    expect((await phone.routines.get('r1'))?.name).toBe('Newer');
    expect((await laptop.routines.get('r1'))?.name).toBe('Newer');
    expect(await countPending(phone)).toBe(0);
  });

  it('keeps edits to different rows of the same workout from both devices', async () => {
    const set = { workoutId: 'w1', workoutExerciseId: 'e1', weightKg: 50, reps: 8, done: false, updatedAt: T1 };
    await phone.workoutSets.bulkPut([
      { ...set, id: 's1', position: 0 },
      { ...set, id: 's2', position: 1 },
    ]);
    await syncOnce(phone, server);
    await syncOnce(laptop, server);

    await phone.workoutSets.update('s1', { done: true, updatedAt: T2 });
    await laptop.workoutSets.update('s2', { reps: 12, updatedAt: T3 });
    await syncOnce(phone, server);
    await syncOnce(laptop, server);
    await syncOnce(phone, server);

    for (const device of [phone, laptop]) {
      expect((await device.workoutSets.get('s1'))?.done).toBe(true);
      expect((await device.workoutSets.get('s2'))?.reps).toBe(12);
    }
  });

  it('carries deletes to other devices', async () => {
    await phone.routines.put(routine('r1', 'Push Day', T1));
    await syncOnce(phone, server);
    await syncOnce(laptop, server);

    await phone.routines.update('r1', { deletedAt: T2, updatedAt: T2 });
    await syncOnce(phone, server);
    await syncOnce(laptop, server);

    expect((await laptop.routines.get('r1'))?.deletedAt).toBe(T2);
  });

  it('sends a change made while an older version was on its way', async () => {
    await phone.routines.put(routine('r1', 'First', T1));
    server.duringPush = async () => {
      await phone.routines.update('r1', { name: 'Second', updatedAt: T2 });
    };
    await syncOnce(phone, server);
    expect(await countPending(phone)).toBe(1);
    expect((await phone.routines.get('r1'))?.name).toBe('Second');

    await syncOnce(phone, server);
    expect(await countPending(phone)).toBe(0);
    expect(server.row('routines', 'r1')?.name).toBe('Second');
  });

  it('reads every page when a new device has a lot to catch up on', async () => {
    const rows = Array.from({ length: 1234 }, (_, index) => routine(`r${index}`, `Routine ${index}`, T1));
    await phone.routines.bulkPut(rows);
    await syncOnce(phone, server);
    await syncOnce(laptop, server);
    expect(await laptop.routines.count()).toBe(1234);
  });

  it('picks up changes made soon after the last read', async () => {
    await phone.routines.put(routine('r1', 'One', T1));
    await syncOnce(phone, server);
    await syncOnce(laptop, server);
    await phone.routines.put(routine('r2', 'Two', T2));
    await syncOnce(phone, server);
    await syncOnce(laptop, server);
    expect((await laptop.routines.get('r2'))?.name).toBe('Two');
  });

  it('still backs up the other tables when the server refuses one', async () => {
    await phone.routines.put(routine('r1', 'Push Day', T1));
    await phone.bodyWeights.put({ id: 'b1', localDate: '2026-10-31', weightKg: 72, updatedAt: T1 });
    server.refused.add('routines');

    await expect(syncOnce(phone, server)).rejects.toThrow('refused');

    expect(server.row('body_weights', 'b1')).toBeDefined();
    expect(await countPending(phone)).toBe(1);
  });
});
