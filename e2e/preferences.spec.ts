import { expect, type Page, test } from '@playwright/test';

const THEMES = [
  ['modern', 'Modern', 'rgb(17, 24, 39)'],
  ['kantha', 'Nakshi Kantha', 'rgb(247, 239, 220)'],
  ['rickshaw', 'Rickshaw Art', 'rgb(18, 35, 90)'],
] as const;

const SCREENS = ['/welcome', '/today', '/routines', '/history', '/settings'];

async function setPreferences(page: Page, language: string | null, theme: string) {
  await page.addInitScript(
    ([savedLanguage, savedTheme]) => {
      // This runs on every page load, so it must not overwrite what the app saved before a reload.
      if (localStorage.getItem('gym-kori:preferences')) return;
      localStorage.setItem(
        'gym-kori:preferences',
        JSON.stringify({ language: savedLanguage, theme: savedTheme, unit: 'kg' }),
      );
    },
    [language, theme],
  );
}

function pageBackground(page: Page) {
  return page.evaluate(() => getComputedStyle(document.body).backgroundColor);
}

test('first launch asks for a language, then remembers it', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveURL(/\/welcome$/);
  await page.getByRole('button', { name: 'বাংলা' }).click();
  await expect(page).toHaveURL(/\/today$/);
  await expect(page.locator('html')).toHaveAttribute('lang', 'bn');
  await expect(page.getByRole('link', { name: 'রুটিন' })).toBeVisible();

  await page.reload();
  await expect(page).toHaveURL(/\/today$/);
  await expect(page.getByRole('link', { name: 'রুটিন' })).toBeVisible();
});

test('language changes the app and survives a reload', async ({ page }) => {
  await setPreferences(page, 'en', 'modern');
  await page.goto('/settings');
  await expect(page.getByRole('heading', { name: 'Settings' })).toBeVisible();

  await page.getByRole('button', { name: 'বাংলা' }).click();
  await expect(page.getByRole('heading', { name: 'সেটিংস' })).toBeVisible();
  await expect(page).toHaveTitle('জিম করি');

  await page.reload();
  await expect(page.getByRole('heading', { name: 'সেটিংস' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'বাংলা' })).toHaveAttribute('aria-pressed', 'true');
});

test('all three themes apply and survive a reload', async ({ page }) => {
  await page.goto('/welcome');
  await page.getByRole('button', { name: 'English' }).click();
  await page.goto('/settings');

  for (const [theme, label, background] of THEMES) {
    await page.getByRole('button', { name: label }).click();
    await expect(page.locator('html')).toHaveAttribute('data-theme', theme);
    await expect.poll(() => pageBackground(page)).toBe(background);
    await page.reload();
    await expect(page.locator('html')).toHaveAttribute('data-theme', theme);
    await expect(page.getByRole('button', { name: label })).toHaveAttribute('aria-pressed', 'true');
  }
});

test('weight unit choice survives a reload', async ({ page }) => {
  await setPreferences(page, 'en', 'modern');
  await page.goto('/settings');
  await page.getByRole('button', { name: 'Pounds (lb)' }).click();
  await page.reload();
  await expect(page.getByRole('button', { name: 'Pounds (lb)' })).toHaveAttribute('aria-pressed', 'true');
});

test('the week strip starts on Saturday and marks one day as today', async ({ page }) => {
  await setPreferences(page, 'en', 'modern');
  await page.goto('/today');
  const days = page.getByRole('list', { name: 'This week' }).getByRole('img');
  await expect(days).toHaveCount(7);
  await expect(days.first()).toHaveAccessibleName(/^Saturday/);
  await expect(days.last()).toHaveAccessibleName(/^Friday/);
  await expect(page.locator('[aria-current="date"]')).toHaveCount(1);
});

test('the Bangla week strip uses the short day names from the design', async ({ page }) => {
  await setPreferences(page, 'bn', 'modern');
  await page.goto('/today');
  await expect(page.getByRole('list', { name: 'এই সপ্তাহ' })).toContainText('শনিরবিসোমমঙ্গলবুধবৃহশুক্র');
});

test('a theme title never runs into its decoration', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 740 });
  await setPreferences(page, 'en', 'kantha');
  await page.goto('/today');
  await page.evaluate(() => document.fonts.ready);
  const title = await page.getByRole('heading', { level: 1 }).evaluate((heading) => {
    const range = document.createRange();
    range.selectNodeContents(heading);
    return range.getBoundingClientRect();
  });
  const motif = await page.locator('section svg').boundingBox();
  expect(motif).not.toBeNull();
  const separatedSideways = title.right <= (motif?.x ?? 0);
  const separatedDownwards = title.top >= (motif?.y ?? 0) + (motif?.height ?? 0);
  expect(separatedSideways || separatedDownwards).toBe(true);
});

for (const [theme] of THEMES) {
  for (const language of ['en', 'bn']) {
    test(`${theme} in ${language} fits a small phone with no sideways scrolling`, async ({ page }) => {
      await setPreferences(page, language, theme);
      await page.setViewportSize({ width: 360, height: 740 });
      for (const screen of SCREENS.slice(1)) {
        await page.goto(screen);
        await page.evaluate(() => document.fonts.ready);
        const overflow = await page.evaluate(
          () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
        );
        expect(overflow, `${screen} overflows sideways`).toBeLessThanOrEqual(0);
      }
    });

    test(`screenshots: ${theme} in ${language}`, async ({ page }, info) => {
      await setPreferences(page, language, theme);
      for (const screen of ['/welcome', '/today', '/routines', '/settings']) {
        await page.goto(screen);
        await page.evaluate(() => document.fonts.ready);
        await page.screenshot({ path: info.outputPath(`${theme}-${language}${screen.replace('/', '-')}.png`) });
      }
    });
  }
}
