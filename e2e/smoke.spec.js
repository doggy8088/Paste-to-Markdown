'use strict';

const { test, expect } = require('./support/fixtures');
const { gotoApp, convertPaste, switchTab } = require('./support/app');

test.describe('smoke', function () {
  test('loads the app and converts pasted HTML', async function ({ page }) {
    await gotoApp(page);
    await expect(page.locator('#output')).toBeVisible();

    const markdown = await convertPaste(page, { html: '<h1>Hello</h1><p>A <strong>bold</strong> word.</p>' });
    expect(markdown).toContain('# Hello');
    expect(markdown).toContain('**bold**');

    await switchTab(page, 'preview');
    await expect(page.locator('#preview h1')).toHaveText('Hello');
  });
});
