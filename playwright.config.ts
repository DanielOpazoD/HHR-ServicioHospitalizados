import { defineConfig, devices } from '@playwright/test';

const configuredBrowsers = (process.env.E2E_BROWSERS || 'chromium')
  .split(',')
  .map(browser => browser.trim().toLowerCase())
  .filter(Boolean);

const projects = [];

if (configuredBrowsers.includes('chromium')) {
  projects.push({
    name: 'chromium',
    use: { ...devices['Desktop Chrome'] },
  });
}

if (configuredBrowsers.includes('firefox')) {
  projects.push({
    name: 'firefox',
    use: { ...devices['Desktop Firefox'] },
  });
}

if (configuredBrowsers.includes('webkit')) {
  projects.push({
    name: 'webkit',
    use: { ...devices['Desktop Safari'] },
  });
}

if (projects.length === 0) {
  projects.push({
    name: 'chromium',
    use: { ...devices['Desktop Chrome'] },
  });
}

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : 4,
  reporter: 'html',

  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },

  projects,

  webServer: {
    command: 'VITE_E2E_MODE=true npm run dev',
    url: 'http://localhost:3000',
    reuseExistingServer: false,
    env: {
      VITE_E2E_MODE: 'true',
    },
  },
});
