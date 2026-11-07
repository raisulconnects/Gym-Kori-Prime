// Draws the app's home screen icons from the same dumbbell as the favicon.
// Run with: node scripts/generate-icons.mjs
import { mkdirSync } from 'node:fs';
import { chromium } from '@playwright/test';

const BACKGROUND = '#111827';
const MARK = '#F97316';
const DUMBBELL = 'M11 9v14M21 9v14M6.5 12.5v7M25.5 12.5v7M11 16h10';

/** `scale` shrinks the dumbbell, because phones crop maskable icons into their own shapes. */
function iconHtml(size, { rounded = false, scale = 1 } = {}) {
  const inset = (32 - 32 / scale) / 2;
  return `<!doctype html><body style="margin:0;background:transparent">
    <svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}"
      viewBox="${inset} ${inset} ${32 / scale} ${32 / scale}" style="display:block">
      <rect x="${inset}" y="${inset}" width="${32 / scale}" height="${32 / scale}"
        rx="${rounded ? 7 / scale : 0}" fill="${BACKGROUND}"/>
      <path d="${DUMBBELL}" fill="none" stroke="${MARK}" stroke-width="3" stroke-linecap="round"/>
    </svg></body>`;
}

const ICONS = [
  ['icon-192.png', 192, { rounded: true }],
  ['icon-512.png', 512, { rounded: true }],
  ['icon-maskable-512.png', 512, { scale: 0.7 }],
  // iPhones round the corners themselves, and show transparent corners as black.
  ['apple-touch-icon.png', 180, { scale: 0.85 }],
];

mkdirSync('public/icons', { recursive: true });
const browser = await chromium.launch();
for (const [name, size, options] of ICONS) {
  const page = await browser.newPage({ viewport: { width: size, height: size } });
  await page.setContent(iconHtml(size, options));
  await page.screenshot({ path: `public/icons/${name}`, omitBackground: true });
  await page.close();
}
await browser.close();
