import { defineConfig, devices } from '@playwright/test';

/**
 * Tests de bout en bout sur l'export web de l'app, en mode démo (backend simulé).
 *   npm run e2e:build && npm run e2e
 */
export default defineConfig({
  testDir: './e2e',
  timeout: 60_000,
  expect: { timeout: 10_000 },
  fullyParallel: true,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? 'github' : 'list',
  use: {
    baseURL: 'http://localhost:8090',
    ...devices['Pixel 7'],
    locale: 'fr-FR',
    trace: 'retain-on-failure',
  },
  projects: [{ name: 'mobile-chromium', use: { browserName: 'chromium' } }],
  webServer: {
    command: 'node e2e/serve.mjs dist-web 8090',
    url: 'http://localhost:8090',
    reuseExistingServer: !process.env.CI,
  },
});
