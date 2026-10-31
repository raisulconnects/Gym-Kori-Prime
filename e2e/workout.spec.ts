import { expect, type Page, test } from '@playwright/test';

const WEDNESDAY = new Date('2026-10-28T10:00:00+06:00');
const DAY_MS = 24 * 60 * 60 * 1000;

test.use({ timezoneId: 'Asia/Dhaka' });

async function start(page: Page, language = 'en', theme = 'modern', unit = 'kg') {
  await page.clock.install({ time: WEDNESDAY });
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

/** Creates Push Day with two exercises and schedules it for every weekday. */
async function setUpPushDay(page: Page, labels = { name: 'Routine name', add: 'Add an exercise', save: 'Save' }) {
  await page.goto('/routines/new');
  await page.getByLabel(labels.name).fill('Push Day');
  for (const exercise of ['Bench Press', 'Cable Fly']) {
    await page.getByRole('button', { name: labels.add }).click();
    await page.getByRole('button', { name: exercise, exact: true }).click();
  }
  await page.getByRole('button', { name: labels.save }).click();
  await expect(page).toHaveURL(/\/routines$/);

  // all() doesn't wait, so make sure the week has loaded before collecting its rows.
  const rows = page.locator('main section').first().getByRole('button');
  await expect(rows).toHaveCount(7);
  for (const row of await rows.all()) {
    await row.click();
    await page.getByRole('dialog').getByRole('button', { name: 'Push Day' }).click();
    await expect(page.getByRole('dialog')).toHaveCount(0);
  }
}

async function checkIn(page: Page, label = 'Check in') {
  await page.goto('/today');
  await page.getByRole('button', { name: label }).click();
  await expect(page).toHaveURL(/\/workout$/);
}

test('a full workout: check in, log sets, finish, and Today shows it done', async ({ page }) => {
  await start(page);
  await setUpPushDay(page);
  await checkIn(page);

  await expect(page.getByRole('heading', { name: 'Bench Press' })).toBeVisible();
  await expect(page.getByText('First time doing this')).toBeVisible();
  await expect(page.getByLabel('Set 1 reps')).toHaveValue('10');

  await page.getByLabel('Set 1 weight').fill('60');
  await page.getByLabel('Set 1 reps').fill('8');
  await page.getByRole('button', { name: 'Mark set 1 as done' }).click();
  await expect(page.getByRole('button', { name: 'Mark set 1 as done' })).toHaveAttribute('aria-pressed', 'true');

  await page.getByRole('button', { name: 'Finish' }).click();
  await expect(page).toHaveURL(/\/workout\/finish$/);
  await expect(page.getByText('1 of 2 exercises logged')).toBeVisible();

  await page.getByLabel('Duration (minutes)').fill('47');
  await page.getByLabel('Note (optional)').fill('Felt strong');
  await page.getByRole('button', { name: 'Save workout' }).click();

  await expect(page).toHaveURL(/\/today$/);
  await expect(page.getByText('47 min · 1 of 2 exercises')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Check in' })).toHaveCount(0);
});

test('next time shows last session and prefills its weights', async ({ page }) => {
  await start(page);
  await setUpPushDay(page);
  await checkIn(page);
  await page.getByLabel('Set 1 weight').fill('60');
  await page.getByLabel('Set 1 reps').fill('8');
  await page.getByRole('button', { name: 'Mark set 1 as done' }).click();
  await page.getByLabel('Set 2 weight').fill('60');
  await page.getByLabel('Set 2 reps').fill('7');
  await page.getByRole('button', { name: 'Mark set 2 as done' }).click();
  await page.getByRole('button', { name: 'Finish' }).click();
  await page.getByRole('button', { name: 'Save workout' }).click();
  await expect(page.getByRole('button', { name: 'Save workout' })).toHaveCount(0);

  await page.clock.fastForward(DAY_MS);
  await checkIn(page);
  await expect(page.getByText('Last time: 60 kg × 8, 7')).toBeVisible();
  await expect(page.getByLabel('Set 1 weight')).toHaveValue('60');
  await expect(page.getByLabel('Set 3 weight')).toHaveValue('60');
  await expect(page.getByLabel('Set 1 reps')).toHaveValue('10');
});

test('the workout survives closing the app, and reopening returns to it', async ({ page }) => {
  await start(page);
  await setUpPushDay(page);
  await checkIn(page);
  await page.getByLabel('Set 1 weight').fill('62.5');
  await page.getByRole('button', { name: 'Mark set 1 as done' }).click();
  await expect(page.getByRole('button', { name: 'Mark set 1 as done' })).toHaveAttribute('aria-pressed', 'true');

  await page.goto('/');
  await expect(page).toHaveURL(/\/workout$/);
  await expect(page.getByLabel('Set 1 weight')).toHaveValue('62.5');
  await expect(page.getByRole('button', { name: 'Mark set 1 as done' })).toHaveAttribute('aria-pressed', 'true');
});

test('logging works with no connection', async ({ page, context }) => {
  await start(page);
  await setUpPushDay(page);
  await page.goto('/today');
  await expect(page.getByRole('button', { name: 'Check in' })).toBeVisible();

  await context.setOffline(true);
  await page.getByRole('button', { name: 'Check in' }).click();
  await page.getByLabel('Set 1 weight').fill('60');
  await page.getByRole('button', { name: 'Mark set 1 as done' }).click();
  await page.getByRole('button', { name: 'Finish' }).click();
  await page.getByRole('button', { name: 'Save workout' }).click();
  await expect(page.getByText(/1 of 2 exercises/)).toBeVisible();

  await context.setOffline(false);
  await page.reload();
  await expect(page.getByText(/1 of 2 exercises/)).toBeVisible();
});

test('a forgotten Finish opens the finish screen with a sensible duration', async ({ page }) => {
  await start(page);
  await setUpPushDay(page);
  await checkIn(page);
  await page.clock.fastForward(50 * 60 * 1000);
  await page.getByRole('button', { name: 'Mark set 1 as done' }).click();
  await expect(page.getByRole('button', { name: 'Mark set 1 as done' })).toHaveAttribute('aria-pressed', 'true');

  await page.clock.fastForward(9 * 60 * 60 * 1000);
  await page.goto('/');
  await expect(page).toHaveURL(/\/workout\/finish$/);
  await expect(page.getByText('This workout was never finished')).toBeVisible();
  await expect(page.getByLabel('Duration (minutes)')).toHaveValue('50');
});

test('the rest timer starts on a tick, adjusts, keeps time and ends with a message', async ({ page }) => {
  await start(page);
  await setUpPushDay(page);
  await checkIn(page);
  const timer = page.getByRole('region', { name: 'Rest' });
  await expect(timer).toHaveCount(0);

  await page.getByRole('button', { name: 'Mark set 1 as done' }).click();
  await expect(timer).toContainText('1:30');

  await page.clock.fastForward(30_000);
  await expect(timer).toContainText('1:00');

  await page.getByRole('button', { name: '+30s' }).click();
  await expect(timer).toContainText('1:30');

  await page.reload();
  await expect(timer).toContainText(/1:\d\d/);

  await page.clock.fastForward(120_000);
  await expect(page.getByRole('status')).toHaveText('Rest over. Next set!');
  await expect(timer).toHaveCount(0);

  await page.getByRole('button', { name: 'Mark set 2 as done' }).click();
  await expect(timer).toBeVisible();
  await page.getByRole('button', { name: 'Skip', exact: true }).first().click();
  await expect(timer).toHaveCount(0);
});

test('unticking a set does not restart the rest timer', async ({ page }) => {
  await start(page);
  await setUpPushDay(page);
  await checkIn(page);
  await page.getByRole('button', { name: 'Mark set 1 as done' }).click();
  await page.getByRole('button', { name: 'Skip', exact: true }).first().click();
  await page.getByRole('button', { name: 'Mark set 1 as done' }).click();
  await expect(page.getByRole('button', { name: 'Mark set 1 as done' })).toHaveAttribute('aria-pressed', 'false');
  await expect(page.getByRole('region', { name: 'Rest' })).toHaveCount(0);
});

test('add a set, write a note, skip, undo the skip, and add an extra exercise', async ({ page }) => {
  await start(page);
  await setUpPushDay(page);
  await checkIn(page);

  await page.getByLabel('Set 3 weight').fill('50');
  await page.getByRole('button', { name: 'Add set' }).click();
  await expect(page.getByLabel('Set 4 weight')).toHaveValue('50');

  await page.getByRole('button', { name: 'Note', exact: true }).click();
  await page.getByRole('textbox', { name: 'Note' }).fill('Shoulder felt tight');

  await page.getByRole('button', { name: 'Skip', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Cable Fly' })).toBeVisible();
  const benchRow = page.getByRole('button', { name: /Bench Press/ });
  await expect(benchRow).toContainText('Skipped');

  await benchRow.click();
  await expect(page.getByRole('textbox', { name: 'Note' })).toHaveValue('Shoulder felt tight');
  await page.getByRole('button', { name: 'Undo skip' }).click();
  await expect(page.getByRole('button', { name: 'Skip', exact: true })).toBeVisible();

  await page.getByRole('button', { name: 'Add an exercise' }).click();
  await page.getByRole('button', { name: 'Plank', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Plank' })).toBeVisible();
});

test('discarding removes the workout, and leaving it is possible', async ({ page }) => {
  await start(page);
  await setUpPushDay(page);
  await checkIn(page);

  await page.getByRole('link', { name: 'Today' }).click();
  await expect(page.getByRole('link', { name: 'Continue workout' })).toBeVisible();
  await page.getByRole('link', { name: 'Continue workout' }).click();

  await page.getByRole('button', { name: 'Finish' }).click();
  page.once('dialog', (dialog) => dialog.accept());
  await page.getByRole('button', { name: 'Discard workout' }).click();
  await expect(page).toHaveURL(/\/today$/);
  await expect(page.getByRole('button', { name: 'Check in' })).toBeVisible();
});

test('a duration has to be sensible', async ({ page }) => {
  await start(page);
  await setUpPushDay(page);
  await checkIn(page);
  await page.getByRole('button', { name: 'Finish' }).click();
  await page.getByLabel('Duration (minutes)').fill('0');
  await page.getByRole('button', { name: 'Save workout' }).click();
  await expect(page.getByRole('alert')).toHaveText('Enter a duration from 1 to 600 minutes.');
  await expect(page).toHaveURL(/\/workout\/finish$/);
});

test('pounds are shown in lb and stay the same after reopening', async ({ page }) => {
  await start(page, 'en', 'modern', 'lb');
  await setUpPushDay(page);
  await checkIn(page);
  await page.getByLabel('Set 1 weight').fill('135');
  await page.getByRole('button', { name: 'Mark set 1 as done' }).click();
  await page.getByRole('button', { name: 'Finish' }).click();
  await page.getByRole('button', { name: 'Save workout' }).click();
  await expect(page.getByRole('button', { name: 'Save workout' })).toHaveCount(0);

  await page.clock.fastForward(DAY_MS);
  await checkIn(page);
  await expect(page.getByText('Last time: 135 lb × 10')).toBeVisible();
  await expect(page.getByLabel('Set 1 weight')).toHaveValue('135');
});

test('Bangla mode takes Bangla digits and half weights in a workout', async ({ page }) => {
  await start(page, 'bn');
  await setUpPushDay(page, { name: 'রুটিনের নাম', add: 'ব্যায়াম যোগ করুন', save: 'সংরক্ষণ' });
  await checkIn(page, 'চেক ইন');

  const weight = page.getByLabel('সেট ১, ওজন');
  await weight.pressSequentially('৬২.৫');
  await expect(weight).toHaveValue('৬২.৫');
  await page.getByRole('button', { name: 'সেট ১ হয়েছে' }).click();
  await expect(page.getByRole('region', { name: 'বিশ্রাম' })).toContainText('১:৩০');

  await page.goto('/');
  await expect(page).toHaveURL(/\/workout$/);
  await expect(page.getByLabel('সেট ১, ওজন')).toHaveValue('৬২.৫');
});

test('asks the browser to keep the screen on during a workout only', async ({ page }) => {
  await page.addInitScript(() => {
    const state = { requests: 0, releases: 0 };
    (window as unknown as { wakeLockState: typeof state }).wakeLockState = state;
    Object.defineProperty(navigator, 'wakeLock', {
      value: {
        request: async () => {
          state.requests += 1;
          return {
            release: async () => {
              state.releases += 1;
            },
          };
        },
      },
    });
  });
  await start(page);
  await setUpPushDay(page);
  await checkIn(page);
  const read = () =>
    page.evaluate(() => (window as unknown as { wakeLockState: { requests: number; releases: number } }).wakeLockState);
  await expect.poll(async () => (await read()).requests).toBeGreaterThan(0);

  await page.getByRole('link', { name: 'Today' }).click();
  await expect.poll(async () => {
    const state = await read();
    return state.releases === state.requests;
  }).toBe(true);
});

for (const theme of ['modern', 'kantha', 'rickshaw']) {
  for (const language of ['en', 'bn']) {
    test(`workout screens fit a small phone: ${theme} in ${language}`, async ({ page }, info) => {
      await start(page, language, theme);
      await page.setViewportSize({ width: 360, height: 740 });
      const labels =
        language === 'bn'
          ? { name: 'রুটিনের নাম', add: 'ব্যায়াম যোগ করুন', save: 'সংরক্ষণ' }
          : { name: 'Routine name', add: 'Add an exercise', save: 'Save' };
      await setUpPushDay(page, labels);
      await page.goto('/today');
      await page.evaluate(() => document.fonts.ready);
      await page.screenshot({ path: info.outputPath(`${theme}-${language}-today.png`) });

      await page.locator('main button.cta').click();
      await expect(page).toHaveURL(/\/workout$/);
      await page.locator('main section button[aria-pressed]').first().click();
      await expect(page.locator('main section[aria-label]').first()).toBeVisible();
      await page.evaluate(() => document.fonts.ready);
      const overflow = () =>
        page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      expect(await overflow(), 'the workout overflows sideways').toBeLessThanOrEqual(0);
      await page.screenshot({ path: info.outputPath(`${theme}-${language}-workout.png`), fullPage: true });

      await page.locator('header button').click();
      await expect(page).toHaveURL(/\/finish$/);
      await page.evaluate(() => document.fonts.ready);
      expect(await overflow(), 'the finish screen overflows sideways').toBeLessThanOrEqual(0);
      await page.screenshot({ path: info.outputPath(`${theme}-${language}-finish.png`), fullPage: true });
    });
  }
}
