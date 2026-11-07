// Checks the real Supabase project: two temporary accounts must not be able to reach each
// other's data, and deleting an account must remove it. It cleans up after itself.
// Run with: npm run verify:supabase
// It needs the migration applied and "Confirm email" turned off while it runs.
import { readFileSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';

const env = Object.fromEntries(
  readFileSync('.env.local', 'utf8')
    .split(/\r?\n/)
    .filter((line) => line.includes('='))
    .map((line) => {
      const index = line.indexOf('=');
      return [line.slice(0, index), line.slice(index + 1)];
    }),
);

const newClient = () =>
  createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_PUBLISHABLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

let failures = 0;
function check(name, passed, detail = '') {
  console.log(`${passed ? 'PASS' : 'FAIL'}  ${name}${detail ? ` (${detail})` : ''}`);
  if (!passed) failures += 1;
}

async function createAccount(label) {
  const client = newClient();
  const email = `gym-kori-verify-${label}-${Date.now()}@example.com`;
  const password = `Verify-${crypto.randomUUID()}`;
  const { data, error } = await client.auth.signUp({ email, password, options: { data: { display_name: label } } });
  if (error) throw new Error(`Could not create ${label}: ${error.message}`);
  if (!data.session) throw new Error('No session returned. Turn off "Confirm email" while this runs.');
  return { client, id: data.user.id, email, password };
}

const EARLIER = '2026-01-01T08:00:00.000Z';
const NOW = '2026-01-01T09:00:00.000Z';
const LATER = '2026-01-01T10:00:00.000Z';

/** The fields each backed-up table needs, besides the ones they all share. */
const SYNCED_TABLES = {
  routines: { name: 'Test', created_at: NOW },
  routine_exercises: { routine_id: 'r', exercise_id: 'e', position: 0, sets: 3, reps: 8 },
  custom_exercises: { name: 'Test' },
  weekly_schedules: { effective_from: '2026-01-01', days: [null, null, null, null, null, null, null] },
  workouts: {
    local_date: '2026-01-01',
    routine_name: 'Test',
    status: 'finished',
    started_at: NOW,
    last_activity_at: NOW,
  },
  workout_exercises: { workout_id: 'w', exercise_id: 'e', position: 0 },
  workout_sets: { workout_id: 'w', workout_exercise_id: 'x', position: 0, weight_kg: 62.5, reps: 8 },
  body_weights: { local_date: '2026-01-01', weight_kg: 72.5 },
};

/** Every table must keep each account's rows private, and let the most recent change win. */
async function checkSyncedTable(table, fields, owner, other, anonymous) {
  const id = crypto.randomUUID();
  const row = { ...fields, id, user_id: owner.id, updated_at: NOW };
  const upsert = (client, values) => client.from(table).upsert(values, { onConflict: 'user_id,id' });
  const read = (client) => client.from(table).select('*').eq('id', id);

  const saved = await upsert(owner.client, row);
  check(`${table}: people can back up their own rows`, !saved.error, saved.error?.message);
  const own = await read(owner.client);
  check(`${table}: people can read their own rows`, own.data?.length === 1, own.error?.message);
  const firstSyncedAt = own.data?.[0]?.synced_at;

  const signedOut = await read(anonymous);
  check(`${table}: signed-out visitors cannot read rows`, Boolean(signedOut.error) || signedOut.data?.length === 0);
  const signedOutWrite = await upsert(anonymous, { ...row, id: crypto.randomUUID() });
  check(`${table}: signed-out visitors cannot add rows`, Boolean(signedOutWrite.error));

  const seen = await read(other.client);
  check(`${table}: another account cannot read the row`, seen.data?.length === 0, seen.error?.message);
  const everything = await other.client.from(table).select('id');
  check(`${table}: another account sees none of it`, everything.data?.length === 0, everything.error?.message);

  const planted = await upsert(other.client, { ...row, id: crypto.randomUUID() });
  check(`${table}: an account cannot add rows for someone else`, Boolean(planted.error));
  const changed = await other.client.from(table).update({ updated_at: LATER }).eq('id', id).select();
  check(`${table}: another account cannot change the row`, (changed.data?.length ?? 0) === 0);
  const removedByOther = await other.client.from(table).delete().eq('id', id).select();
  check(`${table}: another account cannot erase the row`, (removedByOther.data?.length ?? 0) === 0);
  const removedByOwner = await owner.client.from(table).delete().eq('id', id).select();
  check(`${table}: rows can't be erased, only marked as deleted`, (removedByOwner.data?.length ?? 0) === 0);

  // The same ID in another account must be a separate row, not a clash with this one.
  const sameId = await upsert(other.client, { ...row, user_id: other.id });
  check(`${table}: two accounts can use the same ID separately`, !sameId.error, sameId.error?.message);

  await upsert(owner.client, { ...row, updated_at: EARLIER, deleted_at: EARLIER });
  const afterOlder = await read(owner.client);
  check(`${table}: an older change does not overwrite a newer one`, afterOlder.data?.[0]?.deleted_at === null);
  check(`${table}: an ignored change is not sent to other devices`, afterOlder.data?.[0]?.synced_at === firstSyncedAt);

  await upsert(owner.client, { ...row, updated_at: LATER, deleted_at: LATER });
  const afterNewer = await read(owner.client);
  check(`${table}: a newer change wins`, Boolean(afterNewer.data?.[0]?.deleted_at));
  check(`${table}: a newer change is sent to other devices`, afterNewer.data?.[0]?.synced_at > firstSyncedAt);
}

const anonymous = newClient();
const anonymousRead = await anonymous.from('profiles').select('id');
check('signed-out visitors see no profiles', !anonymousRead.error ? anonymousRead.data.length === 0 : true);

const first = await createAccount('first');
const second = await createAccount('second');

try {
  const own = await first.client.from('profiles').select('*').eq('id', first.id).maybeSingle();
  check('a new account gets a profile', own.data?.id === first.id, own.error?.message);
  check('the profile keeps the sign-up name', own.data?.display_name === 'first');

  const saved = await first.client
    .from('profiles')
    .update({ language: 'bn', theme: 'rickshaw', unit: 'lb' })
    .eq('id', first.id)
    .select();
  check('people can save their own preferences', saved.data?.[0]?.theme === 'rickshaw', saved.error?.message);

  const rereadClient = newClient();
  await rereadClient.auth.signInWithPassword({ email: first.email, password: first.password });
  const reread = await rereadClient.from('profiles').select('*').eq('id', first.id).maybeSingle();
  check('preferences follow the user to a new login', reread.data?.language === 'bn' && reread.data?.unit === 'lb');

  const everything = await second.client.from('profiles').select('id');
  check(
    'an account sees only its own profile',
    everything.data?.length === 1 && everything.data[0].id === second.id,
    everything.error?.message,
  );

  const targeted = await second.client.from('profiles').select('*').eq('id', first.id);
  check('an account cannot read another profile', targeted.data?.length === 0, targeted.error?.message);

  const attack = await second.client.from('profiles').update({ display_name: 'hacked' }).eq('id', first.id).select();
  const afterAttack = await first.client.from('profiles').select('display_name').eq('id', first.id).single();
  check(
    'an account cannot change another profile',
    (attack.data?.length ?? 0) === 0 && afterAttack.data?.display_name === 'first',
  );

  const inserted = await second.client.from('profiles').insert({ id: crypto.randomUUID() });
  check('accounts cannot create extra profiles', Boolean(inserted.error));

  const removed = await second.client.from('profiles').delete().eq('id', first.id).select();
  check('an account cannot delete another profile', (removed.data?.length ?? 0) === 0);

  const signedOutDelete = await anonymous.rpc('delete_own_account');
  check('signed-out visitors cannot call account deletion', Boolean(signedOutDelete.error));

  const details = await first.client
    .from('profiles')
    .update({ gender: 'female', height_cm: 170.2 })
    .eq('id', first.id)
    .select();
  check('people can save their gender and height', details.data?.[0]?.height_cm === 170.2, details.error?.message);
  const badHeight = await first.client.from('profiles').update({ height_cm: 5 }).eq('id', first.id);
  check('impossible heights are refused', Boolean(badHeight.error));

  for (const [table, fields] of Object.entries(SYNCED_TABLES)) {
    await checkSyncedTable(table, fields, first, second, anonymous);
  }
} finally {
  for (const account of [first, second]) {
    const { error } = await account.client.rpc('delete_own_account');
    check(`deleting the ${account === first ? 'first' : 'second'} test account works`, !error, error?.message);
    const login = await newClient().auth.signInWithPassword({ email: account.email, password: account.password });
    check('a deleted account can no longer log in', Boolean(login.error));
  }
}

console.log(failures === 0 ? '\nAll checks passed.' : `\n${failures} check(s) failed.`);
process.exit(failures === 0 ? 0 : 1);
