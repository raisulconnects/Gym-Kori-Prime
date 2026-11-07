import { expect, seedPreferences, test } from './support';

// Uses the production build, because the part that opens the app offline only runs there.
test.use({ baseURL: 'http://localhost:5175' });

async function waitForOfflineReady(page: import('@playwright/test').Page) {
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
    if (navigator.serviceWorker.controller) return;
    await new Promise((resolve) => navigator.serviceWorker.addEventListener('controllerchange', resolve));
  });
}

test('the app can be installed', async ({ page, request }) => {
  await seedPreferences(page, 'en');
  await page.goto('/today');
  const href = await page.locator('link[rel="manifest"]').getAttribute('href');
  const manifest = await (await request.get(`http://localhost:5175/${href?.replace(/^\//, '')}`)).json();
  expect(manifest).toMatchObject({ name: 'Gym Kori', display: 'standalone', start_url: '/today' });
  const sizes = manifest.icons.map((icon: { sizes: string }) => icon.sizes);
  expect(sizes).toEqual(expect.arrayContaining(['192x192', '512x512']));
  for (const icon of manifest.icons) {
    const response = await request.get(`http://localhost:5175${icon.src}`);
    expect(response.ok(), `${icon.src} should exist`).toBe(true);
  }
});

test('the app opens with no signal, on any screen, with a workout still reachable', async ({ page, context }) => {
  await seedPreferences(page, 'en');
  await page.goto('/routines/new');
  await waitForOfflineReady(page);
  await page.getByLabel('Routine name').fill('Push Day');
  await page.getByRole('button', { name: 'Add an exercise' }).click();
  await page.getByRole('button', { name: 'Bench Press', exact: true }).click();
  await page.getByRole('button', { name: 'Save' }).click();
  await expect(page).toHaveURL(/\/routines$/);

  await context.setOffline(true);
  await page.reload();
  await expect(page.getByText('Push Day').first()).toBeVisible();

  for (const [path, heading] of [
    ['/history', 'No workouts yet'],
    ['/settings', 'Settings'],
  ] as const) {
    await page.goto(path);
    await expect(page.getByRole('heading', { name: heading })).toBeVisible();
  }
  await context.setOffline(false);
});

test('with no signal and an expired login, the app stays logged in', async ({ page, context }) => {
  await seedPreferences(page, 'en');
  await page.goto('/today');
  await waitForOfflineReady(page);

  // Login tokens last an hour, so this is the normal state on a return visit to a gym with no signal.
  await page.evaluate(() => {
    const session = JSON.parse(localStorage.getItem('gym-kori-auth') ?? '{}');
    session.expires_at = Math.floor(Date.now() / 1000) - 3600;
    localStorage.setItem('gym-kori-auth', JSON.stringify(session));
  });
  await context.setOffline(true);
  await page.reload();

  await expect(page).toHaveURL(/\/today$/);
  await expect(page.getByRole('link', { name: 'Routines' })).toBeVisible();
  await context.setOffline(false);
});

test('a login the server has really ended goes back to the login screen', async ({ page, backend }) => {
  await seedPreferences(page, 'en');
  await page.goto('/today');
  await expect(page.getByRole('link', { name: 'Routines' })).toBeVisible();

  await page.evaluate(() => {
    const session = JSON.parse(localStorage.getItem('gym-kori-auth') ?? '{}');
    session.expires_at = Math.floor(Date.now() / 1000) - 3600;
    session.refresh_token = 'revoked';
    localStorage.setItem('gym-kori-auth', JSON.stringify(session));
  });
  backend.rejectRefresh = true;
  await page.reload();
  await expect(page).toHaveURL(/\/login$/);
});
