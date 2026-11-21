import { defineConfig } from '@playwright/test';
import original from './playwright.config';
if (process.env.SIARE_TEST_PDF) throw new Error('Release checks accept only the three local synthetic fixtures');
process.env.E2E_BASE_URL = 'http://127.0.0.1:3137';
process.env.E2E_TEST_SCOPE = 'production Next/BFF with loopback in-memory contract provider; no real Spring, external OIDC, SMTP or privileged identities';
export default defineConfig({
  ...original,
  timeout: 90_000,
  outputDir: '../.cache/h6-release/results',
  reporter: [['list'], ['json', { outputFile: '../.cache/h6-release/playwright.json' }]],
  use: { ...original.use, baseURL: 'http://127.0.0.1:3137', launchOptions: { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe' } },
  webServer: { command: 'node tests/release-fixture.mjs', url: 'http://127.0.0.1:3137/login', reuseExistingServer: false, timeout: 60_000 },
});
