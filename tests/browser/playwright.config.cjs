'use strict';
const path = require('node:path');
const {defineConfig} = require('@playwright/test');
if (!process.env.BANDIT_BROWSER_ARTIFACTS) throw Error('Use npm run test:browser so all artifacts stay in an isolated temporary directory.');
module.exports = defineConfig({
  testDir: __dirname,
  testMatch: '**/*.spec.cjs',
  outputDir: path.join(process.env.BANDIT_BROWSER_ARTIFACTS, 'results'),
  reporter: [[path.join(__dirname, 'summary-reporter.cjs')]],
  workers: 1,
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: 0,
  timeout: 90000,
  expect: {timeout: 10000},
  use: {
    browserName: 'chromium', headless: true, locale: 'zh-TW',
    viewport: {width: 1280, height: 800}, acceptDownloads: true,
    actionTimeout: 10000, navigationTimeout: 15000,
    trace: 'retain-on-failure', screenshot: 'only-on-failure', video: 'off'
  }
});
