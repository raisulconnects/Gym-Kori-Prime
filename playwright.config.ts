import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  reporter: 'list',
  use: {
    baseURL: 'http://localhost:5174',
    viewport: { width: 390, height: 844 },
    hasTouch: true,
    isMobile: true,
    deviceScaleFactor: 2,
    trace: 'retain-on-failure',
  },
  webServer: [
    {
      // Test mode reads .env.test, which points at a fake Supabase.
      command: 'npx vite --mode test --port 5174 --strictPort',
      url: 'http://localhost:5174',
      reuseExistingServer: true,
    },
    {
      // The offline tests need the real build, because the service worker isn't part of the dev server.
      command:
        'npx vite build --mode test --outDir dist-test && npx vite preview --mode test --outDir dist-test --port 5175 --strictPort',
      url: 'http://localhost:5175',
      reuseExistingServer: true,
      timeout: 120000,
    },
  ],
});
