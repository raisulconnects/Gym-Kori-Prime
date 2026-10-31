import { expect, type Page, seedPreferences, test } from './support';

test.describe('signed out', () => {
  test.use({ signedIn: false });

  async function fillLogin(page: Page, email: string, password: string) {
    await page.getByLabel('Email').fill(email);
    await page.getByLabel('Password', { exact: true }).fill(password);
  }

  test('first launch goes from language, to login, to the app', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveURL(/\/welcome$/);
    await page.getByRole('button', { name: 'English' }).click();
    await expect(page).toHaveURL(/\/login$/);
    await expect(page.getByRole('heading', { name: 'Log in' })).toBeVisible();
  });

  test('every app screen needs an account', async ({ page }) => {
    await seedPreferences(page, 'en');
    for (const path of ['/today', '/routines', '/history', '/settings', '/workout']) {
      await page.goto(path);
      await expect(page).toHaveURL(/\/login$/);
    }
  });

  test('creating an account signs in and saves the choices already made', async ({ page, backend }) => {
    await seedPreferences(page, 'bn', 'kantha', 'lb');
    await page.goto('/login');
    await page.getByRole('button', { name: 'নতুন? অ্যাকাউন্ট খুলুন' }).click();
    await page.getByLabel('নাম').fill('Raisa');
    await page.getByLabel('ইমেইল').fill('raisa@example.com');
    await page.getByLabel('পাসওয়ার্ড', { exact: true }).fill('long-enough');
    await page.getByRole('button', { name: 'অ্যাকাউন্ট খুলুন', exact: true }).click();

    await expect(page).toHaveURL(/\/today$/);
    await expect.poll(() => backend.profiles.get('user-1')?.theme).toBe('kantha');
    expect(backend.profiles.get('user-1')).toMatchObject({ language: 'bn', unit: 'lb', display_name: 'Raisa' });
  });

  test('sign-up problems are explained where they happen', async ({ page, backend }) => {
    backend.addUser('taken@example.com', 'whatever-it-is');
    await seedPreferences(page, 'en');
    await page.goto('/login');
    await page.getByRole('button', { name: 'New here? Create an account' }).click();
    const submit = page.getByRole('button', { name: 'Create account', exact: true });

    await submit.click();
    await expect(page.getByRole('alert')).toHaveText('Enter your name.');

    await page.getByLabel('Name').fill('Raisa');
    await fillLogin(page, 'new@example.com', 'short');
    await submit.click();
    await expect(page.getByRole('alert')).toHaveText('Use a stronger password with at least 8 characters.');

    await fillLogin(page, 'taken@example.com', 'long-enough');
    await submit.click();
    await expect(page.getByRole('alert')).toHaveText('This email already has an account. Log in instead.');
  });

  test('when email confirmation is on, sign-up says to check email', async ({ page, backend }) => {
    backend.requireConfirmation = true;
    await seedPreferences(page, 'en');
    await page.goto('/login');
    await page.getByRole('button', { name: 'New here? Create an account' }).click();
    await page.getByLabel('Name').fill('Raisa');
    await fillLogin(page, 'raisa@example.com', 'long-enough');
    await page.getByRole('button', { name: 'Create account', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Check your email' })).toBeVisible();
    await expect(page.getByText('raisa@example.com')).toBeVisible();
    await expect(page).toHaveURL(/\/login$/);
  });

  test('a wrong password shows a clear message, and the right one logs in', async ({ page, backend }) => {
    backend.addUser('raisa@example.com', 'correct-password', { language: 'en', theme: 'modern', unit: 'kg' });
    await seedPreferences(page, 'en');
    await page.goto('/login');

    await fillLogin(page, 'raisa@example.com', 'wrong-password');
    await page.getByRole('button', { name: 'Log in' }).click();
    await expect(page.getByRole('alert')).toHaveText('That email or password is wrong. Check them and try again.');

    await fillLogin(page, 'raisa@example.com', 'correct-password');
    await page.getByRole('button', { name: 'Log in' }).click();
    await expect(page).toHaveURL(/\/today$/);
  });

  test('having no connection at login says so', async ({ page, backend }) => {
    await seedPreferences(page, 'en');
    await page.goto('/login');
    backend.failing = true;
    await fillLogin(page, 'raisa@example.com', 'correct-password');
    await page.getByRole('button', { name: 'Log in' }).click();
    await expect(page.getByRole('alert')).toHaveText('No connection. Check your internet and try again.');
  });

  test('saved preferences follow the account to a new device', async ({ page, backend }) => {
    backend.addUser('raisa@example.com', 'correct-password', {
      display_name: 'Raisa',
      language: 'bn',
      theme: 'rickshaw',
      unit: 'lb',
    });
    await seedPreferences(page, 'en');
    await page.goto('/login');
    await fillLogin(page, 'raisa@example.com', 'correct-password');
    await page.getByRole('button', { name: 'Log in' }).click();

    await expect(page.locator('html')).toHaveAttribute('data-theme', 'rickshaw');
    await expect(page.locator('html')).toHaveAttribute('lang', 'bn');
    await page.goto('/settings');
    await expect(page.getByRole('button', { name: 'পাউন্ড (lb)' })).toHaveAttribute('aria-pressed', 'true');
    await expect(page.getByLabel('নাম')).toHaveValue('Raisa');
  });

  test('forgot password sends a reset link', async ({ page, backend }) => {
    await seedPreferences(page, 'en');
    await page.goto('/login');
    await page.getByRole('link', { name: 'Forgot password?' }).click();
    await page.getByLabel('Email').fill('raisa@example.com');
    await page.getByRole('button', { name: 'Send reset link' }).click();
    await expect(page.getByRole('status')).toContainText('raisa@example.com');
    expect(backend.resetRequests).toEqual(['raisa@example.com']);
  });

  test('two accounts on one phone keep separate data, and logging out loses nothing', async ({ page, backend }) => {
    backend.addUser('one@example.com', 'password-one', { language: 'en' });
    backend.addUser('two@example.com', 'password-two', { language: 'en' });
    await seedPreferences(page, 'en');

    await page.goto('/login');
    await fillLogin(page, 'one@example.com', 'password-one');
    await page.getByRole('button', { name: 'Log in' }).click();
    await expect(page).toHaveURL(/\/today$/);
    await page.goto('/routines/new');
    await page.getByLabel('Routine name').fill('First person routine');
    await page.getByRole('button', { name: 'Add an exercise' }).click();
    await page.getByRole('button', { name: 'Squat', exact: true }).click();
    await page.getByRole('button', { name: 'Save' }).click();
    await expect(page.getByRole('link', { name: /First person routine/ })).toBeVisible();

    await page.goto('/settings');
    await page.getByRole('button', { name: 'Log out' }).click();
    await expect(page).toHaveURL(/\/login$/);

    await fillLogin(page, 'two@example.com', 'password-two');
    await page.getByRole('button', { name: 'Log in' }).click();
    await expect(page).toHaveURL(/\/today$/);
    await page.goto('/routines');
    await expect(page.getByText('No routines yet')).toBeVisible();

    await page.goto('/settings');
    await page.getByRole('button', { name: 'Log out' }).click();
    await expect(page).toHaveURL(/\/login$/);
    await fillLogin(page, 'one@example.com', 'password-one');
    await page.getByRole('button', { name: 'Log in' }).click();
    await expect(page).toHaveURL(/\/today$/);
    await page.goto('/routines');
    await expect(page.getByRole('link', { name: /First person routine/ })).toBeVisible();
  });

  test('routines made before accounts move into the first login', async ({ page, backend }) => {
    backend.addUser('raisa@example.com', 'correct-password', { language: 'en' });
    await seedPreferences(page, 'en');
    await page.goto('/login');
    await page.evaluate(
      () =>
        new Promise<void>((resolve, reject) => {
          const request = indexedDB.open('gym-kori', 20);
          request.onupgradeneeded = () => {
            const database = request.result;
            database.createObjectStore('routines', { keyPath: 'id' });
            database.createObjectStore('routineExercises', { keyPath: 'id' }).createIndex('routineId', 'routineId');
            database.createObjectStore('customExercises', { keyPath: 'id' });
            database.createObjectStore('weeklySchedules', { keyPath: 'id' }).createIndex('effectiveFrom', 'effectiveFrom');
            database.createObjectStore('workouts', { keyPath: 'id' }).createIndex('localDate', 'localDate');
            database.createObjectStore('workoutExercises', { keyPath: 'id' }).createIndex('workoutId', 'workoutId');
            database.createObjectStore('workoutSets', { keyPath: 'id' }).createIndex('workoutId', 'workoutId');
          };
          request.onsuccess = () => {
            const database = request.result;
            const write = database.transaction('routines', 'readwrite');
            write.objectStore('routines').put({
              id: 'old-routine',
              name: 'Made before accounts',
              createdAt: '2026-01-01T00:00:00.000Z',
              updatedAt: '2026-01-01T00:00:00.000Z',
            });
            write.oncomplete = () => {
              database.close();
              resolve();
            };
            write.onerror = () => reject(write.error);
          };
          request.onerror = () => reject(request.error);
        }),
    );
    await page.getByLabel('Email').fill('raisa@example.com');
    await page.getByLabel('Password', { exact: true }).fill('correct-password');
    await page.getByRole('button', { name: 'Log in' }).click();
    await expect(page).toHaveURL(/\/today$/);
    await page.goto('/routines');
    await expect(page.getByRole('link', { name: /Made before accounts/ })).toBeVisible();
  });

  for (const theme of ['modern', 'kantha', 'rickshaw']) {
    for (const language of ['en', 'bn']) {
      test(`login screens fit a small phone: ${theme} in ${language}`, async ({ page }, info) => {
        await seedPreferences(page, language, theme);
        await page.setViewportSize({ width: 360, height: 740 });
        await page.goto('/login');
        await page.evaluate(() => document.fonts.ready);
        const overflow = await page.evaluate(
          () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
        );
        expect(overflow).toBeLessThanOrEqual(0);
        await page.screenshot({ path: info.outputPath(`${theme}-${language}-login.png`), fullPage: true });
      });
    }
  }
});

test.describe('signed in', () => {
  test.beforeEach(async ({ page }) => {
    await seedPreferences(page, 'en');
  });

  test('stays logged in after a reload', async ({ page }) => {
    await page.goto('/today');
    await expect(page.getByRole('button', { name: 'Log out' })).toHaveCount(0);
    await page.reload();
    await expect(page).toHaveURL(/\/today$/);
  });

  test('login screens send signed-in people to the app', async ({ page }) => {
    await page.goto('/login');
    await expect(page).toHaveURL(/\/today$/);
  });

  test('the app still opens and works with no connection', async ({ page, backend }) => {
    await page.goto('/today');
    await expect(page.getByText('No plan yet')).toBeVisible();
    backend.failing = true;
    await page.reload();
    await expect(page).toHaveURL(/\/today$/);
    await expect(page.getByText('No plan yet')).toBeVisible();
  });

  test('profile shows the name and email, and the name can be changed', async ({ page, backend }) => {
    await page.goto('/settings');
    await expect(page.getByText('tester@example.com')).toBeVisible();
    await expect(page.getByLabel('Name')).toHaveValue('Tester');

    await page.getByLabel('Name').fill('New Name');
    await page.getByRole('button', { name: 'Save' }).click();
    await expect(page.getByRole('status')).toHaveText('Name saved.');
    expect(backend.profiles.get('user-1')?.display_name).toBe('New Name');

    await page.reload();
    await expect(page.getByLabel('Name')).toHaveValue('New Name');
  });

  test('changing theme, language and unit saves to the profile', async ({ page, backend }) => {
    await page.goto('/settings');
    await expect(page.getByLabel('Name')).toHaveValue('Tester');
    await page.getByRole('button', { name: 'Rickshaw Art' }).click();
    await expect.poll(() => backend.profiles.get('user-1')?.theme).toBe('rickshaw');
    await page.getByRole('button', { name: 'Pounds (lb)' }).click();
    await expect.poll(() => backend.profiles.get('user-1')?.unit).toBe('lb');
    await page.getByRole('button', { name: 'বাংলা' }).click();
    await expect.poll(() => backend.profiles.get('user-1')?.language).toBe('bn');
  });

  test('a change made with no connection reaches the profile later', async ({ page, backend }) => {
    await page.goto('/settings');
    await expect(page.getByLabel('Name')).toHaveValue('Tester');
    backend.failing = true;
    await page.getByRole('button', { name: 'Rickshaw Art' }).click();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'rickshaw');
    await expect.poll(() => page.evaluate(() => localStorage.getItem('gym-kori:preferences-pending'))).toBe('1');

    backend.failing = false;
    await page.evaluate(() => window.dispatchEvent(new Event('online')));
    await expect.poll(() => backend.profiles.get('user-1')?.theme).toBe('rickshaw');
    await expect.poll(() => page.evaluate(() => localStorage.getItem('gym-kori:preferences-pending'))).toBeNull();
  });

  test('logging out needs a login again, and works with no connection', async ({ page, backend }) => {
    await page.goto('/settings');
    await expect(page.getByLabel('Name')).toHaveValue('Tester');
    backend.failing = true;
    await page.getByRole('button', { name: 'Log out' }).click();
    await expect(page).toHaveURL(/\/login$/);
    await page.reload();
    await expect(page).toHaveURL(/\/login$/);
  });

  test('logging out during a workout warns first and keeps the workout', async ({ page }) => {
    await page.goto('/routines/new');
    await page.getByLabel('Routine name').fill('Push Day');
    await page.getByRole('button', { name: 'Add an exercise' }).click();
    await page.getByRole('button', { name: 'Squat', exact: true }).click();
    await page.getByRole('button', { name: 'Save' }).click();
    const rows = page.locator('main section').first().getByRole('button');
    await expect(rows).toHaveCount(7);
    for (const row of await rows.all()) {
      await row.click();
      await page.getByRole('dialog').getByRole('button', { name: 'Push Day' }).click();
      await expect(page.getByRole('dialog')).toHaveCount(0);
    }
    await page.goto('/today');
    await page.getByRole('button', { name: 'Check in' }).click();
    await expect(page).toHaveURL(/\/workout$/);

    await page.getByRole('link', { name: 'Today' }).click();
    await page.getByRole('link', { name: 'Open settings' }).click();
    page.once('dialog', (dialog) => {
      expect(dialog.message()).toContain('workout running');
      void dialog.accept();
    });
    await page.getByRole('button', { name: 'Log out' }).click();
    await expect(page).toHaveURL(/\/login$/);

    await page.getByLabel('Email').fill('tester@example.com');
    await page.getByLabel('Password', { exact: true }).fill('correct-password');
    await page.getByRole('button', { name: 'Log in' }).click();
    await expect(page).toHaveURL(/\/workout$/);
  });

  test('deleting an account asks first, then removes it and its data', async ({ page, backend }) => {
    await page.goto('/routines/new');
    await page.getByLabel('Routine name').fill('Push Day');
    await page.getByRole('button', { name: 'Add an exercise' }).click();
    await page.getByRole('button', { name: 'Squat', exact: true }).click();
    await page.getByRole('button', { name: 'Save' }).click();
    await expect(page.getByRole('link', { name: /Push Day/ })).toBeVisible();

    await page.goto('/settings');
    await expect(page.getByLabel('Name')).toHaveValue('Tester');
    page.once('dialog', (dialog) => dialog.dismiss());
    await page.getByRole('button', { name: 'Delete account' }).click();
    expect(backend.users).toHaveLength(1);

    page.once('dialog', (dialog) => dialog.accept());
    await page.getByRole('button', { name: 'Delete account' }).click();
    await expect(page).toHaveURL(/\/login$/);
    expect(backend.users).toHaveLength(0);
    const databases = await page.evaluate(async () => (await indexedDB.databases()).map((database) => database.name));
    expect(databases).not.toContain('gym-kori-user-1');
  });

  test('deleting an account with no connection fails safely', async ({ page, backend }) => {
    await page.goto('/settings');
    await expect(page.getByLabel('Name')).toHaveValue('Tester');
    backend.failing = true;
    page.once('dialog', (dialog) => dialog.accept());
    await page.getByRole('button', { name: 'Delete account' }).click();
    await expect(page.getByRole('alert')).toContainText('wasn’t deleted');
    await expect(page).toHaveURL(/\/settings$/);
  });

  test('the new-password screen saves a password', async ({ page, backend }) => {
    await page.goto('/reset-password');
    await page.getByLabel('New password').fill('short');
    await page.getByRole('button', { name: 'Save password' }).click();
    await expect(page.getByRole('alert')).toHaveText('Use a stronger password with at least 8 characters.');

    await page.getByLabel('New password').fill('a-brand-new-password');
    await page.getByRole('button', { name: 'Save password' }).click();
    await expect(page).toHaveURL(/\/today$/);
    expect(backend.users[0]?.password).toBe('a-brand-new-password');
  });

  for (const theme of ['modern', 'kantha', 'rickshaw']) {
    test(`settings fits a small phone in Bangla: ${theme}`, async ({ page }, info) => {
      await page.setViewportSize({ width: 360, height: 740 });
      await page.goto('/settings');
      await page.getByRole('button', { name: 'বাংলা' }).click();
      await page.getByRole('button', { name: new RegExp(theme === 'kantha' ? 'নকশী' : theme === 'rickshaw' ? 'রিকশা' : 'মডার্ন') }).click();
      await page.evaluate(() => document.fonts.ready);
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      );
      expect(overflow).toBeLessThanOrEqual(0);
      await page.screenshot({ path: info.outputPath(`${theme}-settings.png`), fullPage: true });
    });
  }
});
