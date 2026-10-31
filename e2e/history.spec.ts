import { expect, type Page, test } from './support';

const WEDNESDAY = new Date('2026-10-28T10:00:00+06:00');
const DAY_MS = 24 * 60 * 60 * 1000;

test.use({ timezoneId: 'Asia/Dhaka' });

async function start(page: Page, language = 'en', theme = 'modern') {
  await page.clock.install({ time: WEDNESDAY });
  await page.addInitScript(
    ([savedLanguage, savedTheme]) => {
      if (localStorage.getItem('gym-kori:preferences')) return;
      localStorage.setItem(
        'gym-kori:preferences',
        JSON.stringify({ language: savedLanguage, theme: savedTheme, unit: 'kg' }),
      );
    },
    [language, theme],
  );
}

/** Creates Push Day and schedules it for every day. */
async function setUpEveryDay(page: Page, labels = { name: 'Routine name', add: 'Add an exercise', save: 'Save' }) {
  await page.goto('/routines/new');
  await page.getByLabel(labels.name).fill('Push Day');
  for (const exercise of ['Bench Press', 'Cable Fly']) {
    await page.getByRole('button', { name: labels.add }).click();
    await page.getByRole('button', { name: exercise, exact: true }).click();
  }
  await page.getByRole('button', { name: labels.save }).click();
  await expect(page).toHaveURL(/\/routines$/);

  const rows = page.locator('main section').first().getByRole('button');
  await expect(rows).toHaveCount(7);
  for (const row of await rows.all()) {
    await row.click();
    await page.getByRole('dialog').getByRole('button', { name: 'Push Day' }).click();
    await expect(page.getByRole('dialog')).toHaveCount(0);
  }
}

async function logWorkout(page: Page, minutes = '47', note = '') {
  await page.goto('/today');
  await page.locator('main button.cta').click();
  await expect(page).toHaveURL(/\/workout$/);
  await page.locator('input[inputmode="decimal"]').first().fill('60');
  await page.locator('input[inputmode="numeric"]').first().fill('8');
  await page.locator('main section button[aria-pressed]').first().click();
  await page.locator('header button').click();
  await expect(page).toHaveURL(/\/finish$/);
  await page.locator('input[inputmode="numeric"]').fill(minutes);
  if (note) await page.locator('textarea').fill(note);
  await page.locator('main button.cta').click();
  await expect(page).toHaveURL(/\/today$/);
  await expect(page.locator('main button.cta')).toHaveCount(0);
}

test('History starts empty, before anything is planned or logged', async ({ page }) => {
  await start(page);
  await page.goto('/history');
  await expect(page.getByText('No workouts yet')).toBeVisible();
});

test('a saved workout appears in History with the right numbers', async ({ page }) => {
  await start(page);
  await setUpEveryDay(page);
  await logWorkout(page);

  await page.goto('/history');
  await expect(page.getByRole('heading', { name: 'This week' })).toBeVisible();
  await expect(page.getByText('1 of 3 gym days')).toBeVisible();
  const row = page.getByRole('link', { name: /Push Day/ });
  await expect(row).toContainText('Wed');
  await expect(row).toContainText('Oct 28');
  await expect(row).toContainText('1 of 2 exercises');
  await expect(row).toContainText('47 min');
});

test('workout details show exactly what was logged', async ({ page }) => {
  await start(page);
  await setUpEveryDay(page);
  await logWorkout(page, '47', 'Felt strong');

  await page.goto('/history');
  await page.getByRole('link', { name: /Push Day/ }).click();
  await expect(page.getByRole('heading', { name: 'Push Day' })).toBeVisible();
  await expect(page.getByText('47 min')).toBeVisible();
  await expect(page.getByText('Felt strong')).toBeVisible();
  const bench = page.locator('section').filter({ hasText: 'Bench Press' });
  await expect(bench).toContainText('60 kg × 8');
  await expect(bench).toContainText('Not done');
});

test('a skipped gym day shows as missed, and today does not', async ({ page }) => {
  await start(page);
  await setUpEveryDay(page);
  await logWorkout(page);

  await page.clock.fastForward(2 * DAY_MS);
  await page.goto('/history');
  await expect(page.getByText('1 of 3 gym days')).toBeVisible();
  const list = page.getByRole('list', { name: 'Workouts this week' });
  await expect(list.getByRole('listitem').filter({ hasText: 'Thu' })).toContainText('Missed');
  await expect(list.getByRole('listitem').filter({ hasText: 'Fri' })).toHaveCount(0);
  await expect(page.getByRole('img', { name: 'Thursday, missed' })).toBeVisible();
  await expect(page.getByRole('img', { name: 'Friday, today' })).toBeVisible();
});

test('Today’s week strip ticks off finished days', async ({ page }) => {
  await start(page);
  await setUpEveryDay(page);
  await logWorkout(page);
  await expect(page.getByRole('img', { name: 'Wednesday, today, done' })).toBeVisible();
});

test('changing the schedule does not rewrite past attendance', async ({ page }) => {
  await start(page);
  await setUpEveryDay(page);
  await page.clock.fastForward(2 * DAY_MS);

  await page.goto('/routines');
  await page.getByRole('button', { name: /^Thursday:/ }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Rest' }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);

  await page.goto('/history');
  await expect(page.getByRole('img', { name: 'Thursday, missed' })).toBeVisible();
  await expect(page.getByRole('img', { name: 'Wednesday, missed' })).toBeVisible();
});

test('deleting a routine keeps its past workouts and names', async ({ page }) => {
  await start(page);
  await setUpEveryDay(page);
  await logWorkout(page);
  await page.clock.fastForward(2 * DAY_MS);

  await page.goto('/routines');
  await page.getByRole('link', { name: /Push Day/ }).click();
  page.once('dialog', (dialog) => dialog.accept());
  await page.getByRole('button', { name: 'Delete routine' }).click();
  await expect(page.getByRole('link', { name: /Push Day/ })).toHaveCount(0);

  await page.goto('/history');
  await expect(page.getByRole('link', { name: /Push Day/ })).toBeVisible();
  await expect(page.getByRole('list', { name: 'Workouts this week' }).getByText('Push Day')).toHaveCount(2);
});

test('a workout with several notes says so correctly', async ({ page }) => {
  await start(page);
  await setUpEveryDay(page);
  await page.goto('/today');
  await page.locator('main button.cta').click();
  await page.getByRole('button', { name: 'Note', exact: true }).click();
  await page.getByRole('textbox', { name: 'Note' }).fill('Shoulder felt tight');
  await page.locator('main section button[aria-pressed]').first().click();
  await page.locator('header button').click();
  await page.locator('textarea').fill('Good session');
  await page.locator('main button.cta').click();
  await expect(page).toHaveURL(/\/today$/);

  await page.goto('/history');
  await expect(page.getByRole('link', { name: /Push Day/ })).toContainText('2 notes');
});

test('week arrows move through time and stop at the ends', async ({ page }) => {
  await start(page);
  await setUpEveryDay(page);
  await logWorkout(page);
  await page.clock.fastForward(7 * DAY_MS);

  await page.goto('/history');
  await expect(page.getByRole('button', { name: 'Next week' })).toBeDisabled();
  await page.getByRole('button', { name: 'Previous week' }).click();
  await expect(page.getByRole('heading', { name: 'Last week' })).toBeVisible();
  await expect(page.getByRole('link', { name: /Push Day/ })).toContainText('47 min');
  await expect(page.getByRole('button', { name: 'Previous week' })).toBeDisabled();

  await page.getByRole('button', { name: 'Next week' }).click();
  await expect(page.getByRole('heading', { name: 'This week' })).toBeVisible();
});

test('history uses the chosen unit and language', async ({ page }) => {
  await start(page, 'bn');
  await setUpEveryDay(page, { name: 'রুটিনের নাম', add: 'ব্যায়াম যোগ করুন', save: 'সংরক্ষণ' });
  await logWorkout(page);

  await page.goto('/history');
  await expect(page.getByText('৩ দিনের মধ্যে ১ দিন')).toBeVisible();
  await page.getByRole('link', { name: /Push Day/ }).click();
  await expect(page.locator('section').filter({ hasText: 'Bench Press' })).toContainText('৬০ কেজি × ৮');

  await page.goto('/settings');
  await page.getByRole('button', { name: 'পাউন্ড (lb)' }).click();
  await page.goBack();
  await expect(page.locator('section').filter({ hasText: 'Bench Press' })).toContainText('১৩২.৩ পাউন্ড × ৮');
});

for (const theme of ['modern', 'kantha', 'rickshaw']) {
  for (const language of ['en', 'bn']) {
    test(`history screens fit a small phone: ${theme} in ${language}`, async ({ page }, info) => {
      await start(page, language, theme);
      await page.setViewportSize({ width: 360, height: 740 });
      const labels =
        language === 'bn'
          ? { name: 'রুটিনের নাম', add: 'ব্যায়াম যোগ করুন', save: 'সংরক্ষণ' }
          : { name: 'Routine name', add: 'Add an exercise', save: 'Save' };
      await setUpEveryDay(page, labels);
      await logWorkout(page, '47', 'Felt strong');
      await page.clock.fastForward(2 * DAY_MS);
      const overflow = () =>
        page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);

      await page.goto('/today');
      await page.evaluate(() => document.fonts.ready);
      await page.screenshot({ path: info.outputPath(`${theme}-${language}-today.png`) });

      await page.goto('/history');
      await page.evaluate(() => document.fonts.ready);
      expect(await overflow(), 'History overflows sideways').toBeLessThanOrEqual(0);
      await page.screenshot({ path: info.outputPath(`${theme}-${language}-history.png`), fullPage: true });

      await page.locator('main ul a').first().click();
      await expect(page).toHaveURL(/\/history\/.+/);
      await page.evaluate(() => document.fonts.ready);
      expect(await overflow(), 'details overflow sideways').toBeLessThanOrEqual(0);
      await page.screenshot({ path: info.outputPath(`${theme}-${language}-detail.png`), fullPage: true });
    });
  }
}
