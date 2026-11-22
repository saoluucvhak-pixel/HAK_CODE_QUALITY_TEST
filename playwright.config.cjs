module.exports = {
  testDir: './tests',
  testMatch: '**/dashboard.spec.js',
  timeout: 15000,
  retries: 1,
  use: { browserName: 'chromium', headless: true },
  projects: [{ name: 'chromium', use: { browserName: 'chromium' } }]
};
