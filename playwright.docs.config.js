import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: './tests/docs',
  use: { baseURL: 'http://127.0.0.1:4173', reducedMotion: 'reduce' },
  projects: [{ name: 'chromium', use: { browserName: 'chromium' } }],
  webServer: { command: 'node scripts/serve.js', url: 'http://127.0.0.1:4173/site-dist/', reuseExistingServer: !process.env.CI }
});
