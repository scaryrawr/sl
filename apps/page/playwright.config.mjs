import { defineConfig } from '@playwright/test';

const port = Number(process.env.PLAYWRIGHT_PORT ?? 4173);

export default defineConfig({
  testDir: './playwright',
  testMatch: '**/*.e2e.js',
  reporter: 'line',
  workers: 1,
  use: {
    baseURL: `http://127.0.0.1:${port}`,
    browserName: 'chromium',
    headless: true,
    screenshot: 'off',
    serviceWorkers: 'allow',
    trace: 'off',
    video: 'off'
  },
  webServer: {
    command: 'bun run serve:playwright',
    port,
    reuseExistingServer: !process.env.CI,
    timeout: 120000
  }
});
