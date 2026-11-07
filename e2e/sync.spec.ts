import type { Browser, BrowserContext } from '@playwright/test';
import { type FakeBackend, expect, type Page, seedPreferences, test } from './support';

const USER_EMAIL = 'tester@example.com';

/** Opens the same account on a second device that shares the fake backend. */
async function openSecondDevice(browser: Browser, backend: FakeBackend, baseURL: string | undefined) {
  const context: BrowserContext = await browser.newContext({ baseURL, viewport: { width: 390, height: 844 } });
  await context.route('https://test.supabase.invalid/**', (route) => backend.handle(route));
  const user = backend.users.find((candidate) => candidate.email === USER_EMAIL);
  if (!user) throw new Error('The test account is missing');
  await context.addInitScript(
    ({ session, preferences }) => {
      if (localStorage.getItem('test:seeded')) return;
      localStorage.setItem('test:seeded', '1');
      localStorage.setItem('gym-kori-auth', session);
      localStorage.setItem('gym-kori:preferences', preferences);
    },
    {
      session: JSON.stringify(backend.session(user)),
      preferences: JSON.stringify({ language: 'en', theme: 'modern', unit: 'kg' }),
    },
  );
  return context.newPage();
}

async function buildWeek(page: Page) {
  await page.goto('/routines/new');
  await page.getByLabel('Routine name').fill('Push Day');
  await page.getByRole('button', { name: 'Add an exercise' }).click();
  await page.getByRole('button', { name: 'Bench Press', exact: true }).click();
  await page.getByRole('button', { name: 'Save' }).click();
  await expect(page).toHaveURL(/\/routines$/);
  const rows = page.locator('main section').first().getByRole('button');
  await expect(rows).toHaveCount(7);
  for (const row of await rows.all()) {
    await row.click();
    await page.getByRole('dialog').getByRole('button', { name: 'Push Day' }).click();
    await expect(page.getByRole('dialog')).toHaveCount(0);
  }
}

async function syncFromSettings(page: Page) {
  await page.goto('/settings');
  await page.getByRole('button', { name: 'Sync now' }).click();
  await expect(page.getByText('Everything is backed up.')).toBeVisible();
}

test('a workout logged with no signal reaches a second device after reconnecting', async ({
  page,
  backend,
  browser,
  baseURL,
}) => {
  await seedPreferences(page, 'en');
  await buildWeek(page);
  await syncFromSettings(page);

  backend.failing = true;
  await page.goto('/today');
  await page.getByRole('button', { name: 'Check in' }).click();
  await page.getByRole('button', { name: 'Mark set 1 as done' }).click();
  await page.getByRole('button', { name: 'Finish' }).click();
  await page.getByRole('button', { name: 'Save workout' }).click();
  await expect(page).toHaveURL(/\/today$/);

  // With no signal, the app says clearly that it hasn't been backed up, and keeps the workout.
  await expect(page.getByRole('status').filter({ hasText: 'not backed up yet' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Push Day' })).toBeVisible();
  expect(backend.rows('workouts')).toHaveLength(0);

  backend.failing = false;
  await syncFromSettings(page);
  expect(backend.rows('workouts')).toHaveLength(1);
  expect(backend.rows('workouts')[0]).toMatchObject({ routine_name: 'Push Day', status: 'finished' });

  const secondDevice = await openSecondDevice(browser, backend, baseURL);
  await secondDevice.goto('/history');
  await expect(secondDevice.getByRole('link', { name: /Push Day/ })).toHaveCount(1);
  await secondDevice.getByRole('link', { name: /Push Day/ }).click();
  await expect(secondDevice.getByText('Bench Press')).toBeVisible();

  // Syncing again changes nothing, so nothing is duplicated.
  await syncFromSettings(secondDevice);
  await syncFromSettings(page);
  expect(backend.rows('workouts')).toHaveLength(1);
  await page.goto('/history');
  await expect(page.getByRole('link', { name: /Push Day/ })).toHaveCount(1);
  await secondDevice.context().close();
});

test('routines and the week follow the account to a new device', async ({ page, backend, browser, baseURL }) => {
  await seedPreferences(page, 'en');
  await buildWeek(page);
  await syncFromSettings(page);

  const secondDevice = await openSecondDevice(browser, backend, baseURL);
  await secondDevice.goto('/today');
  await expect(secondDevice.getByRole('heading', { name: 'Push Day' })).toBeVisible();
  await expect(secondDevice.getByRole('button', { name: 'Check in' })).toBeVisible();
  await secondDevice.context().close();
});

test('one account never receives another account’s rows', async ({ page, backend }) => {
  await seedPreferences(page, 'en');
  const other = backend.addUser('other@example.com', 'another-password');
  backend.synced.set(
    'routines',
    new Map([
      [
        `${other.id}:theirs`,
        {
          user_id: other.id,
          id: 'theirs',
          name: 'Their Secret Routine',
          created_at: '2026-01-01T00:00:00.000Z',
          updated_at: '2026-01-01T00:00:00.000Z',
          deleted_at: null,
          synced_at: '2026-01-01T00:00:00.000Z',
        },
      ],
    ]),
  );
  await page.goto('/routines');
  await syncFromSettings(page);
  await page.goto('/routines');
  await expect(page.getByRole('heading', { name: 'No routines yet' })).toBeVisible();
  await expect(page.getByText('Their Secret Routine')).toHaveCount(0);
});

test.describe('settings', () => {
  test.beforeEach(async ({ page }) => {
    await seedPreferences(page, 'en');
  });

  test('gender and height save to the profile, and are optional', async ({ page, backend }) => {
    await page.goto('/settings');
    const profile = () => backend.profiles.get('user-1');

    await page.getByRole('button', { name: 'Female' }).click();
    await expect(page.getByRole('button', { name: 'Female' })).toHaveAttribute('aria-pressed', 'true');
    expect(profile()?.gender).toBe('female');

    // Tapping again clears it.
    await page.getByRole('button', { name: 'Female' }).click();
    await expect(page.getByRole('button', { name: 'Female' })).toHaveAttribute('aria-pressed', 'false');
    expect(profile()?.gender).toBeNull();

    await page.getByLabel('Height, feet').fill('5');
    await page.getByLabel('Height, inches').fill('7');
    await page.locator('form', { has: page.getByLabel('Height, feet') }).getByRole('button', { name: 'Save' }).click();
    await expect(page.getByText('Height saved.')).toBeVisible();
    expect(profile()?.height_cm).toBe(170.2);

    await page.getByRole('button', { name: 'Centimetres' }).click();
    await expect(page.getByLabel('Height, centimetres')).toHaveValue('170.2');

    await page.reload();
    await expect(page.getByLabel('Height, feet')).toHaveValue('5');
    await expect(page.getByLabel('Height, inches')).toHaveValue('7');
  });

  test('an impossible height is explained next to the field', async ({ page, backend }) => {
    await page.goto('/settings');
    await page.getByLabel('Height, feet').fill('5');
    await page.getByLabel('Height, inches').fill('15');
    await page.locator('form', { has: page.getByLabel('Height, feet') }).getByRole('button', { name: 'Save' }).click();
    await expect(page.getByRole('alert')).toHaveText('Enter a real height, like 5 ft 7 in or 170 cm.');
    expect(backend.profiles.get('user-1')?.height_cm).toBeUndefined();
  });

  test('body weight saves with no signal, in the chosen unit, and backs up later', async ({ page, backend }) => {
    await page.goto('/settings');
    await expect(page.getByText('Everything is backed up.')).toBeVisible();
    backend.failing = true;

    const form = page.locator('form', { has: page.getByLabel('Body weight, in kg') });
    await page.getByLabel('Body weight, in kg').fill('5');
    await form.getByRole('button', { name: 'Save' }).click();
    await expect(page.getByRole('alert')).toHaveText('Enter a real body weight, like 72.');

    await page.getByLabel('Body weight, in kg').fill('72.5');
    await form.getByRole('button', { name: 'Save' }).click();
    await expect(page.getByText('Weight saved.')).toBeVisible();
    await expect(page.getByText(/Last saved: 72\.5 kg/)).toBeVisible();

    await page.getByRole('button', { name: 'Sync now' }).click();
    await expect(page.getByText('No connection. 1 change will back up when you’re online.')).toBeVisible();

    backend.failing = false;
    await page.getByRole('button', { name: 'Sync now' }).click();
    await expect(page.getByText('Everything is backed up.')).toBeVisible();
    expect(backend.rows('body_weights')).toHaveLength(1);
    expect(backend.rows('body_weights')[0]).toMatchObject({ weight_kg: 72.5 });

    await page.getByRole('button', { name: 'Pounds (lb)' }).click();
    await expect(page.getByText(/Last saved: 159\.8 lb/)).toBeVisible();
  });

  test('gender and height wait for a connection, while weight still works', async ({ page, backend }) => {
    backend.failing = true;
    await page.goto('/settings');
    await expect(page.getByText('Your gender and height couldn’t be loaded, so they can’t be changed right now.')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Male', exact: true })).toBeDisabled();
    await expect(page.getByLabel('Height, feet')).toBeDisabled();
    await expect(page.getByLabel('Body weight, in kg')).toBeEnabled();
  });
});
