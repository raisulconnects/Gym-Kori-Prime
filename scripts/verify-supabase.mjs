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
