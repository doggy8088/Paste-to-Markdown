'use strict';

const { defineConfig, devices } = require('@playwright/test');

// E2E_PORT and E2E_OUTPUT_DIR let several runs share one machine.
const PORT = Number(process.env.E2E_PORT || 4173);
const IS_CI = !!process.env.CI;

module.exports = defineConfig({
  testDir: './e2e',
  testMatch: /.*\.spec\.js$/,
  outputDir: process.env.E2E_OUTPUT_DIR || 'test-results',
  fullyParallel: true,
  forbidOnly: IS_CI,
  retries: 0,
  workers: IS_CI ? 2 : undefined,
  reporter: IS_CI
    ? [['github'], ['list'], ['html', { open: 'never' }]]
    : [['list']],
  globalSetup: require.resolve('./e2e/support/global-setup.js'),
  globalTeardown: require.resolve('./e2e/support/global-teardown.js'),
  metadata: {
    coverageGate: false
  },
  use: {
    baseURL: 'http://127.0.0.1:' + PORT,
    locale: 'en-US',
    colorScheme: 'light',
    trace: 'retain-on-failure'
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] }
    }
  ],
  webServer: {
    command: 'node e2e/server.js ' + PORT,
    url: 'http://127.0.0.1:' + PORT + '/index.html',
    reuseExistingServer: !IS_CI,
    timeout: 30000
  }
});
