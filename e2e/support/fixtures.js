'use strict';

// Every spec imports `test` and `expect` from here instead of
// '@playwright/test'. The extended `page` fixture records V8 JavaScript
// coverage (Chromium only) and hands it to monocart-coverage-reports.
const base = require('@playwright/test');
const MCR = require('monocart-coverage-reports');
const { options } = require('./coverage-options');

// Pages whose coverage has not been collected yet.
const pendingCoverage = new WeakSet();

async function stopCoverage(page) {
  if (!pendingCoverage.has(page) || page.isClosed()) {
    return;
  }
  pendingCoverage.delete(page);
  const coverage = await page.coverage.stopJSCoverage();
  await MCR(options).add(coverage);
}

async function startCoverage(page, browserName) {
  if (browserName !== 'chromium') {
    return false;
  }
  await page.coverage.startJSCoverage({ resetOnNavigation: false });
  pendingCoverage.add(page);

  // Coverage can no longer be read once a page is closed, so collect it
  // first when a test closes the page itself.
  const close = page.close.bind(page);
  page.close = async function (closeOptions) {
    await stopCoverage(page);
    return close(closeOptions);
  };
  return true;
}

const test = base.test.extend({
  page: async function ({ page, browserName }, use) {
    const collecting = await startCoverage(page, browserName);
    await use(page);
    if (collecting) {
      await stopCoverage(page);
    }
  },

  // Opens an extra page in the given context (or the default context) with
  // coverage collection, e.g. to load a share URL in a fresh tab.
  openPage: async function ({ context, browserName }, use) {
    const opened = [];
    await use(async function (targetContext) {
      const page = await (targetContext || context).newPage();
      if (await startCoverage(page, browserName)) {
        opened.push(page);
      }
      return page;
    });
    for (const page of opened) {
      await stopCoverage(page);
    }
  }
});

module.exports = { test: test, expect: base.expect };
