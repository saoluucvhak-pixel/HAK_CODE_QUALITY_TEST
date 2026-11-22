const { test, expect } = require('@playwright/test');
const { htmlReport } = require('../src/report');

function fixture(overrides = {}) {
  return {
    root: 'sample-project',
    summary: { status: 'PASS', incomplete: false, files: 3, findings: 1, error: 0, warning: 1, cycles: 0, skipped: 0 },
    findings: [{ severity: 'warning', rule: 'long-file', file: 'src/main.js', line: 42, message: 'Long file' }],
    coverage: { parsedUnits: 3, excludedEntries: 0 },
    appsScript: { serverSymbols: 0, links: [], unresolved: [] },
    gate: { failed: false, failOn: 'error' },
    limitations: ['Static checks only'],
    ...overrides
  };
}

test('dashboard renders repository summary, gate and finding', async ({ page }) => {
  await page.setContent(htmlReport(fixture()));
  await expect(page.getByRole('heading', { name: 'HAK Code Quality Dashboard' })).toBeVisible();
  await expect(page.getByText('Repository: sample-project')).toBeVisible();
  await expect(page.getByText(/CI gate: PASS/)).toBeVisible();
  await expect(page.getByRole('cell', { name: 'src/main.js' })).toBeVisible();
  await expect(page.getByRole('cell', { name: 'Long file' })).toBeVisible();
});

test('dashboard escapes finding content instead of executing HTML', async ({ page }) => {
  const report = fixture({ findings: [{
    severity: 'error', rule: 'injection', file: 'a.js', line: 1,
    message: '<img src=x onerror="window.hakInjected=1">'
  }] });
  await page.setContent(htmlReport(report));
  await expect(page.getByRole('cell', { name: /<img src=x/ })).toBeVisible();
  expect(await page.evaluate(() => window.hakInjected)).toBeUndefined();
  expect(await page.locator('img').count()).toBe(0);
});

test('dashboard exposes skipped and unresolved checks', async ({ page }) => {
  const report = fixture({
    coverage: { parsedUnits: 2, excludedEntries: 1, skippedFiles: [{ file: 'src/unknown.ts', reason: 'Unsupported syntax' }] },
    appsScript: { serverSymbols: 0, links: [], unresolved: [{ file: 'index.html', line: 8, kind: 'rpc', name: 'missingHandler', reason: 'Unknown target' }] }
  });
  await page.setContent(htmlReport(report));
  await expect(page.getByText(/src\/unknown.ts: Unsupported syntax/)).toBeVisible();
  await expect(page.getByText(/missingHandler Unknown target/)).toBeVisible();
});
