import { expect, type Page, test } from '@playwright/test';

async function start(page: Page, language: string, theme = 'modern') {
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

async function createRoutine(page: Page, name: string, exercises: string[]) {
  await page.goto('/routines/new');
  await page.getByLabel('Routine name').fill(name);
  for (const exercise of exercises) {
    await page.getByRole('button', { name: 'Add an exercise' }).click();
    await page.getByRole('button', { name: exercise, exact: true }).click();
  }
  await page.getByRole('button', { name: 'Save' }).click();
  await expect(page).toHaveURL(/\/routines$/);
}

function todayName() {
  return new Intl.DateTimeFormat('en-US', { weekday: 'long' }).format(new Date());
}

async function assignToday(page: Page, routine: string) {
  await page.getByRole('button', { name: new RegExp(`^${todayName()}:`) }).click();
  await page.getByRole('dialog').getByRole('button', { name: routine }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
}

test('builds a routine, schedules it for today and shows it on Today', async ({ page }) => {
  await start(page, 'en');
  await createRoutine(page, 'Push Day', ['Bench Press', 'Cable Fly']);
  await expect(page.getByRole('link', { name: /Push Day/ })).toContainText('2 exercises');

  await assignToday(page, 'Push Day');
  await expect(page.getByRole('button', { name: `${todayName()}: Push Day` })).toBeVisible();

  await page.getByRole('link', { name: 'Today' }).click();
  await expect(page.getByRole('heading', { name: 'Push Day' })).toBeVisible();
  const list = page.getByRole('list', { name: 'Today’s exercises' });
  await expect(list).toContainText('Bench Press');
  await expect(list).toContainText('3 × 10');
  await expect(page.getByText('2 exercises · about 20 min')).toBeVisible();
});

test('saved routines and the schedule survive a reload', async ({ page }) => {
  await start(page, 'en');
  await createRoutine(page, 'Push Day', ['Bench Press']);
  await assignToday(page, 'Push Day');
  await page.reload();
  await expect(page.getByRole('button', { name: `${todayName()}: Push Day` })).toBeVisible();
  await page.goto('/today');
  await expect(page.getByRole('heading', { name: 'Push Day' })).toBeVisible();
});

test('a day without a routine shows as a rest day', async ({ page }) => {
  await start(page, 'en');
  await createRoutine(page, 'Push Day', ['Bench Press']);
  const otherDay = todayName() === 'Monday' ? 'Tuesday' : 'Monday';
  await page.getByRole('button', { name: new RegExp(`^${otherDay}:`) }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Push Day' }).click();

  await page.goto('/today');
  await expect(page.getByRole('heading', { name: 'Rest day' })).toBeVisible();
  await expect(page.locator('[aria-current="date"]')).toHaveAccessibleName(/rest day/);
});

test('search finds exercises however they are typed, and custom exercises can be added', async ({ page }) => {
  await start(page, 'en');
  await page.goto('/routines/new');
  await page.getByRole('button', { name: 'Add an exercise' }).click();
  await page.getByRole('searchbox').fill('pushup');
  await expect(page.getByRole('button', { name: 'Push Up', exact: true })).toBeVisible();

  await page.getByRole('searchbox').fill('Tire Flip');
  await expect(page.getByText('No match found.')).toBeVisible();
  await page.getByRole('button', { name: /Tire Flip/ }).click();
  await expect(page.getByText('Tire Flip')).toBeVisible();

  await page.getByRole('button', { name: 'Add an exercise' }).click();
  await page.getByRole('searchbox').fill('tire');
  await expect(page.getByRole('button', { name: 'Tire Flip', exact: true })).toBeVisible();
});

test('a routine cannot be saved until it is complete', async ({ page }) => {
  await start(page, 'en');
  await page.goto('/routines/new');
  await page.getByRole('button', { name: 'Save' }).click();
  await expect(page.getByRole('alert')).toHaveText('Give this routine a name.');

  await page.getByLabel('Routine name').fill('Push Day');
  await page.getByRole('button', { name: 'Save' }).click();
  await expect(page.getByRole('alert')).toHaveText('Add at least one exercise.');

  await page.getByRole('button', { name: 'Add an exercise' }).click();
  await page.getByRole('button', { name: 'Squat', exact: true }).click();
  await page.getByLabel('Squat, sets').fill('0');
  await page.getByRole('button', { name: 'Save' }).click();
  await expect(page.getByRole('alert')).toHaveText('Sets and reps must be at least 1.');
  await expect(page).toHaveURL(/\/routines\/new$/);
});

test('editing changes a routine, and leaving with changes asks first', async ({ page }) => {
  await start(page, 'en');
  await createRoutine(page, 'Push Day', ['Bench Press', 'Cable Fly']);
  await page.getByRole('link', { name: /Push Day/ }).click();

  await page.getByRole('button', { name: 'Remove Cable Fly' }).click();
  page.once('dialog', (dialog) => dialog.dismiss());
  await page.getByRole('button', { name: 'Routines' }).click();
  await expect(page).not.toHaveURL(/\/routines$/);

  await page.getByRole('button', { name: 'Save' }).click();
  await expect(page.getByRole('link', { name: /Push Day/ })).toContainText('1 exercise');
});

test('deleting a routine removes it from the week', async ({ page }) => {
  await start(page, 'en');
  await createRoutine(page, 'Push Day', ['Bench Press']);
  await createRoutine(page, 'Pull Day', ['Pull Up']);
  await assignToday(page, 'Push Day');

  await page.getByRole('link', { name: /Push Day/ }).click();
  page.once('dialog', (dialog) => dialog.accept());
  await page.getByRole('button', { name: 'Delete routine' }).click();

  await expect(page.getByRole('link', { name: /Push Day/ })).toHaveCount(0);
  await expect(page.getByRole('button', { name: `${todayName()}: Rest` })).toBeVisible();
});

test('Bangla mode accepts Bangla and English digits and saves them as numbers', async ({ page }) => {
  await start(page, 'bn');
  await page.goto('/routines/new');
  await page.getByLabel('রুটিনের নাম').fill('পুশ ডে');
  await page.getByRole('button', { name: 'ব্যায়াম যোগ করুন' }).click();
  await page.getByRole('button', { name: 'Squat', exact: true }).click();

  const sets = page.getByLabel('Squat, সেট');
  const reps = page.getByLabel('Squat, রেপ');
  await sets.fill('৪');
  await reps.fill('12');
  await expect(sets).toHaveValue('৪');
  await expect(reps).toHaveValue('১২');

  await page.getByRole('button', { name: 'সংরক্ষণ' }).click();
  await page.getByRole('link', { name: /পুশ ডে/ }).click();
  await expect(page.getByLabel('Squat, সেট')).toHaveValue('৪');
  await expect(page.getByLabel('Squat, রেপ')).toHaveValue('১২');
});

test('the app works without crypto.randomUUID, as on a phone over plain HTTP', async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(Crypto.prototype, 'randomUUID', { value: undefined });
  });
  await start(page, 'en');
  await createRoutine(page, 'Push Day', ['Bench Press']);
  await expect(page.getByRole('link', { name: /Push Day/ })).toBeVisible();
});

for (const theme of ['modern', 'kantha', 'rickshaw']) {
  for (const language of ['en', 'bn']) {
    test(`routine screens fit a small phone: ${theme} in ${language}`, async ({ page }, info) => {
      await start(page, 'en', theme);
      await page.setViewportSize({ width: 360, height: 740 });
      await createRoutine(page, 'A long routine name to test wrapping here', ['Overhead Triceps Extension', 'Squat']);
      await assignToday(page, 'A long routine name');

      await page.getByRole('link', { name: 'Today' }).click();
      await page.getByRole('button', { name: 'Routines' }).or(page.getByRole('link', { name: 'Routines' })).first().click();
      await page.getByRole('link', { name: /A long routine/ }).click();
      await expect(page.getByLabel('Routine name')).toBeVisible();
      await page.goto('/settings');
      if (language === 'bn') await page.getByRole('button', { name: 'বাংলা' }).click();

      for (const path of ['/today', '/routines']) {
        await page.goto(path);
        await page.evaluate(() => document.fonts.ready);
        const overflow = await page.evaluate(
          () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
        );
        expect(overflow, `${path} overflows sideways`).toBeLessThanOrEqual(0);
        await page.screenshot({
          path: info.outputPath(`${theme}-${language}${path.replace('/', '-')}.png`),
          fullPage: true,
        });
      }

      await page.getByRole('list').or(page.locator('main')).first().waitFor();
      await page.locator('main section button').first().click();
      await expect(page.getByRole('dialog')).toBeVisible();
      await page.screenshot({ path: info.outputPath(`${theme}-${language}-day-sheet.png`) });
      await page.getByRole('dialog').getByRole('button').last().click();

      await page.getByRole('link', { name: /A long routine/ }).click();
      await page.evaluate(() => document.fonts.ready);
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      );
      expect(overflow, 'the editor overflows sideways').toBeLessThanOrEqual(0);
      await page.screenshot({ path: info.outputPath(`${theme}-${language}-editor.png`), fullPage: true });

      await page.locator('main button').filter({ has: page.locator('.lucide-plus') }).click();
      await page.evaluate(() => document.fonts.ready);
      await page.screenshot({ path: info.outputPath(`${theme}-${language}-picker.png`) });
    });
  }
}
