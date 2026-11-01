import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: './tests/browser',
  use: { baseURL: 'http://127.0.0.1:4173', reducedMotion: 'reduce' },
  projects: ['chromium', 'firefox', 'webkit'].map(browserName => ({ name: browserName, use: { browserName } })),
  webServer: { command: 'node scripts/serve.js', url: 'http://127.0.0.1:4173/examples/modal.html', reuseExistingServer: !process.env.CI }
});
