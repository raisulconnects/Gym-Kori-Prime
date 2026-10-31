import { test as base, type Page, type Route } from '@playwright/test';

export { expect, type Page } from '@playwright/test';

const FAR_FUTURE = 4102444800; // The year 2100, in seconds.

interface FakeProfile {
  id: string;
  display_name: string | null;
  language: string | null;
  theme: string | null;
  unit: string | null;
}

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

/** An in-memory stand-in for Supabase, so tests never touch the real project. */
export class FakeBackend {
  users: FakeUser[] = [];
  profiles = new Map<string, FakeProfile>();
  requireConfirmation = false;
  resetRequests: string[] = [];
  failing = false;

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
      const user = this.users.find((candidate) => candidate.email === body.email && candidate.password === body.password);
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
