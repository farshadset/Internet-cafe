import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  timeout: 60000,
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'line',
  use: {
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'on-first-retry',
    ...(process.env.HTTP_PROXY || process.env.http_proxy ? {
      proxy: {
        server: process.env.HTTP_PROXY || process.env.http_proxy,
        bypass: 'localhost,127.0.0.1,::1',
      },
    } : {}),
  },
});