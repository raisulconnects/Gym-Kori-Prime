import { test as base, type Page, type Route } from '@playwright/test';

export { expect, type Page } from '@playwright/test';

const FAR_FUTURE = 4102444800; // The year 2100, in seconds.

interface FakeProfile {
  id: string;
  display_name: string | null;
  language: string | null;
  theme: string | null;
  unit: string | null;
  gender?: string | null;
  height_cm?: number | null;
}

type FakeRow = Record<string, unknown>;

interface FakeUser {
  id: string;
  email: string;
  password: string;
}

function publicUser(user: FakeUser, profile: FakeProfile | undefined) {
  return {
    id: user.id,
    aud: 'authenticated',
    role: 'authenticated',
    email: user.email,
    app_metadata: {},
    user_metadata: { display_name: profile?.display_name ?? '' },
    identities: [{ id: user.id }],
    created_at: '2026-01-01T00:00:00.000Z',
  };
}

const SYNCED_TABLES = [
  'routines',
  'routine_exercises',
  'custom_exercises',
  'weekly_schedules',
  'workouts',
  'workout_exercises',
  'workout_sets',
  'body_weights',
];

/** An in-memory stand-in for Supabase, so tests never touch the real project. */
export class FakeBackend {
  users: FakeUser[] = [];
  profiles = new Map<string, FakeProfile>();
  requireConfirmation = false;
  resetRequests: string[] = [];
  failing = false;
  rejectRefresh = false;
  /** Backed-up rows per table, keyed by owner and row ID, like the real primary keys. */
  synced = new Map<string, Map<string, FakeRow>>();
  private syncClock = Date.parse('2026-01-01T00:00:00Z');

  /** Everything backed up to one table, for tests to check. */
  rows(table: string): FakeRow[] {
    return [...(this.synced.get(table)?.values() ?? [])];
  }

  /** Newest change wins, as the database trigger does. */
  private upsert(table: string, rows: FakeRow[]) {
    const store = this.synced.get(table) ?? new Map<string, FakeRow>();
    this.synced.set(table, store);
    for (const row of rows) {
      const key = `${row.user_id}:${row.id}`;
      const existing = store.get(key);
      if (existing && Date.parse(row.updated_at as string) <= Date.parse(existing.updated_at as string)) continue;
      this.syncClock += 1000;
      store.set(key, { ...row, synced_at: new Date(this.syncClock).toISOString() });
    }
  }

  private select(table: string, userId: string, since: string | undefined, limit: number) {
    return this.rows(table)
      .filter((row) => row.user_id === userId && (!since || (row.synced_at as string) > since))
      .sort((first, second) => (first.synced_at as string).localeCompare(second.synced_at as string))
      .slice(0, limit);
  }

  addUser(email: string, password: string, profile: Partial<FakeProfile> = {}) {
    const user = { id: `user-${this.users.length + 1}`, email, password };
    this.users.push(user);
    this.profiles.set(user.id, {
      id: user.id,
      display_name: null,
      language: null,
      theme: null,
      unit: null,
      ...profile,
    });
    return user;
  }

  session(user: FakeUser) {
    return {
      access_token: `token-${user.id}`,
      refresh_token: `refresh-${user.id}`,
      token_type: 'bearer',
      expires_in: 3600,
      expires_at: FAR_FUTURE,
      user: publicUser(user, this.profiles.get(user.id)),
    };
  }

  private userFromToken(route: Route) {
    const token = route.request().headers().authorization?.replace('Bearer ', '') ?? '';
    return this.users.find((user) => `token-${user.id}` === token);
  }

  async handle(route: Route) {
    const headers = {
      'access-control-allow-origin': '*',
      'access-control-allow-headers': '*',
      'access-control-allow-methods': '*',
    };
    const request = route.request();
    if (request.method() === 'OPTIONS') return route.fulfill({ status: 204, headers });
    if (this.failing) return route.abort('internetdisconnected');
    const reply = (status: number, body?: unknown) =>
      route.fulfill({ status, headers, contentType: 'application/json', body: body === undefined ? '' : JSON.stringify(body) });
    const { pathname, searchParams } = new URL(request.url());
    const body = request.postDataJSON() ?? {};

    if (pathname === '/auth/v1/signup') {
      if (this.users.some((user) => user.email === body.email)) {
        return reply(422, { code: 422, error_code: 'user_already_exists', msg: 'User already registered' });
      }
      const user = this.addUser(body.email, body.password, { display_name: body.data?.display_name ?? null });
      if (this.requireConfirmation) return reply(200, publicUser(user, this.profiles.get(user.id)));
      return reply(200, this.session(user));
    }
    if (pathname === '/auth/v1/token') {
      if (this.rejectRefresh) {
        return reply(400, { code: 400, error_code: 'refresh_token_not_found', msg: 'Invalid Refresh Token' });
      }
      const user =this.users.find((candidate) => candidate.email === body.email && candidate.password === body.password);
      if (!user) return reply(400, { code: 400, error_code: 'invalid_credentials', msg: 'Invalid login credentials' });
      return reply(200, this.session(user));
    }
    if (pathname === '/auth/v1/recover') {
      this.resetRequests.push(body.email);
      return reply(200, {});
    }
    if (pathname === '/auth/v1/user') {
      const user = this.userFromToken(route);
      if (!user) return reply(401, { code: 401, error_code: 'bad_jwt', msg: 'Bad token' });
      if (body.password) user.password = body.password;
      return reply(200, publicUser(user, this.profiles.get(user.id)));
    }
    if (pathname === '/auth/v1/logout') return reply(204);

    const user = this.userFromToken(route);
    if (pathname === '/rest/v1/rpc/delete_own_account') {
      if (!user) return reply(401, { message: 'Not signed in' });
      this.users = this.users.filter((candidate) => candidate !== user);
      this.profiles.delete(user.id);
      return reply(200, null);
    }
    if (pathname === '/rest/v1/profiles') {
      const id = searchParams.get('id')?.replace('eq.', '');
      if (!user || id !== user.id) return reply(200, []);
      const profile = this.profiles.get(id);
      if (!profile) return reply(200, []);
      if (request.method() === 'PATCH') {
        Object.assign(profile, body);
        return reply(204);
      }
      return reply(200, [profile]);
    }
    const table = pathname.replace('/rest/v1/', '');
    if (SYNCED_TABLES.includes(table)) {
      if (!user) return reply(401, { message: 'Not signed in' });
      if (request.method() === 'POST') {
        const rows = (Array.isArray(body) ? body : [body]) as FakeRow[];
        if (rows.some((row) => row.user_id !== user.id)) return reply(403, { message: 'Row-level security' });
        this.upsert(table, rows);
        return reply(201);
      }
      const since = searchParams.get('synced_at')?.replace('gt.', '');
      return reply(200, this.select(table, user.id, since, Number(searchParams.get('limit') ?? 1000)));
    }
    return reply(404, { message: `Not faked: ${pathname}` });
  }
}

interface Fixtures {
  /** Whether the test starts logged in. On by default. */
  signedIn: boolean;
  backend: FakeBackend;
}

export const test = base.extend<Fixtures>({
  signedIn: [true, { option: true }],
  // Automatic, so every test gets the fake backend even if it doesn't mention it.
  backend: [
    async ({ context, signedIn }, use) => {
      const backend = new FakeBackend();
      await context.route('https://test.supabase.invalid/**', (route) => backend.handle(route));
      if (signedIn) {
        const user = backend.addUser('tester@example.com', 'correct-password', { display_name: 'Tester' });
        await context.addInitScript((session) => {
          // Only once, so logging out in a test stays logged out after a reload.
          if (localStorage.getItem('test:seeded')) return;
          localStorage.setItem('test:seeded', '1');
          localStorage.setItem('gym-kori-auth', JSON.stringify(session));
        }, backend.session(user));
      }
      await use(backend);
    },
    { auto: true },
  ],
});

/** Saves preferences before the app loads, without overwriting later changes. */
export async function seedPreferences(page: Page, language: string | null, theme = 'modern', unit = 'kg') {
  await page.addInitScript(
    ([savedLanguage, savedTheme, savedUnit]) => {
      if (localStorage.getItem('gym-kori:preferences')) return;
      localStorage.setItem(
        'gym-kori:preferences',
        JSON.stringify({ language: savedLanguage, theme: savedTheme, unit: savedUnit }),
      );
    },
    [language, theme, unit],
  );
}
