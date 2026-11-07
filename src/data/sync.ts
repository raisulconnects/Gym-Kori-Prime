import { liveQuery } from 'dexie';
import type { GymKoriDatabase, Synced } from './db';

/**
 * Keeps this device and the server in step. The phone always saves first, so nothing here
 * ever holds up the app. Each row is compared on its own and the most recent change wins.
 */

type RemoteRow = Record<string, unknown>;
type LocalRow = Synced & Record<string, unknown>;

/** How the app reaches the server. Kept separate so tests can use a stand-in. */
export interface SyncRemote {
  push(table: string, rows: RemoteRow[]): Promise<void>;
  /** Rows received after `since`, oldest first. */
  pull(table: string, since: string | null, limit: number): Promise<RemoteRow[]>;
}

/** Thrown by a remote when the server can't be reached, as opposed to refusing a request. */
export class SyncOfflineError extends Error {}

const SYNCED_TABLES = [
  { local: 'routines', remote: 'routines', fields: ['name', 'createdAt'] },
  {
    local: 'routineExercises',
    remote: 'routine_exercises',
    fields: ['routineId', 'exerciseId', 'position', 'sets', 'reps'],
  },
  { local: 'customExercises', remote: 'custom_exercises', fields: ['name'] },
  { local: 'weeklySchedules', remote: 'weekly_schedules', fields: ['effectiveFrom', 'days'] },
  {
    local: 'workouts',
    remote: 'workouts',
    fields: [
      'localDate',
      'routineId',
      'routineName',
      'status',
      'startedAt',
      'lastActivityAt',
      'endedAt',
      'durationSeconds',
      'note',
    ],
  },
  {
    local: 'workoutExercises',
    remote: 'workout_exercises',
    fields: ['workoutId', 'exerciseId', 'position', 'skipped', 'extra', 'note'],
  },
  {
    local: 'workoutSets',
    remote: 'workout_sets',
    fields: ['workoutId', 'workoutExerciseId', 'position', 'weightKg', 'reps', 'done'],
  },
  { local: 'bodyWeights', remote: 'body_weights', fields: ['localDate', 'weightKg'] },
] as const;

type SyncedTable = (typeof SYNCED_TABLES)[number];

const PUSH_BATCH = 200;
const PULL_PAGE = 500;
/** Reads a little further back than needed, in case a slow write landed just behind the last read. */
const PULL_OVERLAP_MS = 60 * 1000;
const PUSH_DELAY_MS = 2000;
const CHECK_EVERY_MS = 60 * 1000;

const LAST_SYNCED_KEY = 'lastSyncedAt';

/** Fields the app leaves out when empty. Other empty fields are stored as null, like `reps`. */
const LEFT_OUT_WHEN_EMPTY = new Set(['deletedAt', 'endedAt', 'durationSeconds']);
const TIMESTAMP_FIELDS = new Set(['updatedAt', 'deletedAt', 'createdAt', 'startedAt', 'lastActivityAt', 'endedAt']);

const toColumn = (field: string) => field.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`);
const allFields = (table: SyncedTable): string[] => ['id', 'updatedAt', 'deletedAt', ...table.fields];

function toRemoteRow(table: SyncedTable, row: LocalRow): RemoteRow {
  return Object.fromEntries(allFields(table).map((field) => [toColumn(field), row[field] ?? null]));
}

function toLocalRow(table: SyncedTable, remote: RemoteRow): LocalRow {
  const row: Record<string, unknown> = {};
  for (const field of allFields(table)) {
    const value = remote[toColumn(field)] ?? null;
    if (value === null && LEFT_OUT_WHEN_EMPTY.has(field)) continue;
    // The server writes times differently, and rows are compared by their exact text.
    row[field] = value !== null && TIMESTAMP_FIELDS.has(field) ? new Date(value as string).toISOString() : value;
  }
  const local = row as LocalRow;
  local.syncedUpdatedAt = local.updatedAt;
  return local;
}

const needsPush = (row: Synced) => row.syncedUpdatedAt !== row.updatedAt;

function localTable(database: GymKoriDatabase, table: SyncedTable) {
  return database.table<LocalRow, string>(table.local);
}

async function pushTable(database: GymKoriDatabase, remote: SyncRemote, table: SyncedTable) {
  const store = localTable(database, table);
  const pending = await store.filter(needsPush).toArray();
  for (let start = 0; start < pending.length; start += PUSH_BATCH) {
    const batch = pending.slice(start, start + PUSH_BATCH);
    await remote.push(
      table.remote,
      batch.map((row) => toRemoteRow(table, row)),
    );
    const pushedAt = new Map(batch.map((row) => [row.id, row.updatedAt]));
    await database.transaction('rw', store, async () => {
      const current = await store.bulkGet([...pushedAt.keys()]);
      // A row changed again while this was being sent still has to go out next time.
      const unchanged = current.filter((row): row is LocalRow => row?.updatedAt === pushedAt.get(row?.id ?? ''));
      await store.bulkPut(unchanged.map((row) => ({ ...row, syncedUpdatedAt: row.updatedAt })));
    });
  }
}

/** Saves rows from the server, keeping whichever version of each row is most recent. */
async function mergeRows(database: GymKoriDatabase, table: SyncedTable, rows: RemoteRow[]) {
  const store = localTable(database, table);
  const incoming = rows.map((row) => toLocalRow(table, row));
  await database.transaction('rw', store, async () => {
    const current = await store.bulkGet(incoming.map((row) => row.id));
    const changes = incoming.flatMap((row, index) => {
      const existing = current[index];
      if (!existing || row.updatedAt > existing.updatedAt) return [row];
      if (row.updatedAt === existing.updatedAt && needsPush(existing)) {
        return [{ ...existing, syncedUpdatedAt: row.updatedAt }];
      }
      return [];
    });
    await store.bulkPut(changes);
  });
}

async function pullTable(database: GymKoriDatabase, remote: SyncRemote, table: SyncedTable) {
  const cursorKey = `cursor:${table.remote}`;
  const saved = await database.syncState.get(cursorKey);
  let since = saved ? new Date(new Date(saved.value).getTime() - PULL_OVERLAP_MS).toISOString() : null;
  for (;;) {
    const rows = await remote.pull(table.remote, since, PULL_PAGE);
    if (rows.length === 0) return;
    await mergeRows(database, table, rows);
    since = rows[rows.length - 1]?.synced_at as string;
    await database.syncState.put({ key: cursorKey, value: since });
    if (rows.length < PULL_PAGE) return;
  }
}

/** Sends this device's changes, then fetches everyone else's. Safe to repeat at any time. */
export async function syncOnce(database: GymKoriDatabase, remote: SyncRemote): Promise<void> {
  let failure: unknown = null;
  for (const table of SYNCED_TABLES) {
    try {
      await pushTable(database, remote, table);
      await pullTable(database, remote, table);
    } catch (error) {
      if (error instanceof SyncOfflineError) throw error;
      // One table's problem shouldn't stop the others from backing up.
      failure ??= error;
    }
  }
  if (failure) throw failure;
  await database.syncState.put({ key: LAST_SYNCED_KEY, value: new Date().toISOString() });
}

/** How many changes on this device haven't reached the server yet. */
export async function countPending(database: GymKoriDatabase): Promise<number> {
  const counts = await Promise.all(SYNCED_TABLES.map((table) => localTable(database, table).filter(needsPush).count()));
  return counts.reduce((total, count) => total + count, 0);
}

export type SyncPhase = 'idle' | 'syncing' | 'offline' | 'error';

export interface SyncStatus {
  phase: SyncPhase;
  pending: number;
  /** Null until this device has finished its first sync. */
  lastSyncedAt: string | null;
}

const NOT_STARTED: SyncStatus = { phase: 'idle', pending: 0, lastSyncedAt: null };

let status = NOT_STARTED;
let syncNowHandler: (() => Promise<void>) | null = null;
const listeners = new Set<() => void>();

function setStatus(changes: Partial<SyncStatus>) {
  status = { ...status, ...changes };
  for (const listener of listeners) listener();
}

export const getSyncStatus = () => status;

export function subscribeToSyncStatus(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** Syncs right away, and finishes when that attempt ends. Does nothing when logged out. */
export function syncNow(): Promise<void> {
  return syncNowHandler?.() ?? Promise.resolve();
}

/**
 * Keeps one account's data in step until the returned function is called. It's given the
 * database directly, so a sync still running after a logout can't touch another account's data.
 */
export function startSync(database: GymKoriDatabase, remote: SyncRemote): () => void {
  let stopped = false;
  let current: Promise<void> | null = null;
  let runAgain = false;
  let pushTimer: ReturnType<typeof setTimeout> | undefined;

  const run = (): Promise<void> => {
    if (current) {
      runAgain = true;
      return current;
    }
    setStatus({ phase: 'syncing' });
    current = (async () => {
      try {
        do {
          runAgain = false;
          await syncOnce(database, remote);
        } while (runAgain && !stopped);
        if (stopped) return;
        const saved = await database.syncState.get(LAST_SYNCED_KEY);
        setStatus({ phase: 'idle', lastSyncedAt: saved?.value ?? null });
      } catch (error) {
        if (stopped) return;
        const offline = error instanceof SyncOfflineError;
        if (!offline) console.error('Could not sync', error);
        setStatus({ phase: offline ? 'offline' : 'error' });
      } finally {
        current = null;
      }
    })();
    return current;
  };

  setStatus(NOT_STARTED);
  void database.syncState
    .get(LAST_SYNCED_KEY)
    .then((saved) => {
      if (!stopped && saved) setStatus({ lastSyncedAt: saved.value });
    })
    .catch(() => {});

  // Each change waits briefly, so a run of quick ticks goes out together.
  const subscription = liveQuery(() => countPending(database)).subscribe({
    next: (pending) => {
      if (stopped) return;
      setStatus({ pending });
      if (pending > 0 && !pushTimer) {
        pushTimer = setTimeout(() => {
          pushTimer = undefined;
          if (!stopped && status.pending > 0) void run();
        }, PUSH_DELAY_MS);
      }
    },
    error: () => {},
  });

  const whenVisible = () => {
    if (document.visibilityState === 'visible') void run();
  };
  const onOnline = () => void run();
  const checkTimer = setInterval(whenVisible, CHECK_EVERY_MS);
  document.addEventListener('visibilitychange', whenVisible);
  window.addEventListener('online', onOnline);

  syncNowHandler = run;
  void run();

  return () => {
    stopped = true;
    syncNowHandler = null;
    subscription.unsubscribe();
    clearTimeout(pushTimer);
    clearInterval(checkTimer);
    document.removeEventListener('visibilitychange', whenVisible);
    window.removeEventListener('online', onOnline);
    setStatus(NOT_STARTED);
  };
}
