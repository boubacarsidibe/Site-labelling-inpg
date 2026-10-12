import { defineConfig } from '@playwright/test';
import { randomBytes } from 'crypto';

// Mot de passe des comptes de test : jamais versionné, généré à chaque exécution si absent.
process.env['E2E_PASSWORD'] ||= 'E2e-' + randomBytes(12).toString('base64url');
const API_PORT = 8100, WEB_PORT = 4300;

export default defineConfig({
  testDir: './e2e',
  timeout: 60_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  workers: 1,
  retries: process.env['CI'] ? 1 : 0,
  reporter: process.env['CI'] ? [['list'], ['html', { open: 'never' }]] : 'list',
  globalSetup: './e2e/global-setup.ts',
  use: {
    baseURL: `http://127.0.0.1:${WEB_PORT}`,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    launchOptions: process.env['PW_CHROMIUM_PATH'] ? { executablePath: process.env['PW_CHROMIUM_PATH'] } : {},
  },
  webServer: [
    { command: 'bash e2e/start-backend.sh', url: `http://127.0.0.1:${API_PORT}/api/v1/meta/`, reuseExistingServer: !process.env['CI'], timeout: 120_000,
      env: { E2E_PASSWORD: process.env['E2E_PASSWORD']!, API_PORT: String(API_PORT), FRONTEND_URL: `http://127.0.0.1:${WEB_PORT}` } },
    { command: `npx ng serve --port ${WEB_PORT} --proxy-config e2e/proxy.e2e.json`, url: `http://127.0.0.1:${WEB_PORT}/`, reuseExistingServer: !process.env['CI'], timeout: 180_000 },
  ],
});
