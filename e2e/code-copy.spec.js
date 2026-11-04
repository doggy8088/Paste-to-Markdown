'use strict';

const { test, expect } = require('./support/fixtures');
const { gotoApp, setMarkdown, switchTab } = require('./support/app');

const SAMPLE = [
  'Inline `cargo build` stays plain.',
  '',
  '```sh',
  'ls',
  'echo hi',
  '```',
  '',
  '```mermaid',
  'graph TD',
  '  A --> B',
  '```',
  ''
].join('\n');

/**
 * Stubs navigator.clipboard.writeText and document.execCommand before any
 * page script runs so copy clicks can be asserted deterministically.
 * Must be called before gotoApp.
 * @param {import('@playwright/test').Page} page
 * @param {{ writeTextFails?: boolean, execThrows?: boolean, execResult?: boolean, noClipboard?: boolean }} [options]
 */
async function setupCopyStubs(page, options) {
  const opts = options || {};
  await page.addInitScript(function (o) {
    window.__copied = [];
    window.__execCalls = [];
    Object.defineProperty(navigator, 'clipboard', {
      value: o.noClipboard ? undefined : {
        writeText: async function (text) {
          if (o.writeTextFails) {
            throw new Error('writeText failed');
          }
          window.__copied.push(text);
        }
      },
      configurable: true
    });
    document.execCommand = function (command) {
      window.__execCalls.push(command);
      if (o.execThrows) {
        throw new Error('execCommand failed');
      }
      return o.execResult !== false;
    };
  }, opts);
}

/** Opens the app with the sample document shown in the Preview tab. */
async function openPreview(page) {
  await gotoApp(page);
  await setMarkdown(page, SAMPLE);
  await switchTab(page, 'preview');
}

test.describe('code block copy icon', function () {
  test('wraps every code block and skips inline code and mermaid', async function ({ page }) {
    await openPreview(page);
    await expect(page.locator('#preview .code-copy-wrap > pre')).toHaveCount(1);
    await expect(page.locator('#preview .code-copy')).toHaveCount(1);
    // Ondine swaps the mermaid pre for an SVG; either way it gets no button.
    await expect(page.locator('#preview .mermaid-diagram')).toHaveCount(1);
    await expect(page.locator('#preview .mermaid-diagram .code-copy')).toHaveCount(0);
    // Inline code spans never get a button.
    await expect(page.locator('#preview p code')).toHaveCount(1);
    await expect(page.locator('#preview p .code-copy')).toHaveCount(0);
  });

  test('stays hidden until the block is hovered or the button is focused', async function ({ page }) {
    await openPreview(page);
    const btn = page.locator('#preview .code-copy');
    const wrap = page.locator('#preview .code-copy-wrap');
    expect(await btn.evaluate(function (el) { return getComputedStyle(el).opacity; })).toBe('0');
    await wrap.hover();
    await expect.poll(function () {
      return btn.evaluate(function (el) { return getComputedStyle(el).opacity; });
    }).toBe('1');
    await page.mouse.move(2, 2);
    await expect.poll(function () {
      return btn.evaluate(function (el) { return getComputedStyle(el).opacity; });
    }).toBe('0');
    await btn.evaluate(function (el) { el.focus(); });
    await expect.poll(function () {
      return btn.evaluate(function (el) { return getComputedStyle(el).opacity; });
    }).toBe('1');
  });

  test('copies the code text exactly and shows the check feedback', async function ({ page }) {
    await setupCopyStubs(page);
    await openPreview(page);
    const btn = page.locator('#preview .code-copy');
    await page.locator('#preview .code-copy-wrap').hover();
    await btn.click();
    // Exact source text, without the trailing newline.
    expect(await page.evaluate(function () { return window.__copied; })).toEqual(['ls\necho hi']);
    await expect(btn).toHaveClass(/is-copied/);
    await expect(btn).toHaveAttribute('aria-label', 'Copied ✓');
    await expect(btn.locator('svg polyline')).toHaveCount(1);
  });

  test('restores the copy glyph 1.6 seconds later', async function ({ page }) {
    await setupCopyStubs(page);
    await openPreview(page);
    const btn = page.locator('#preview .code-copy');
    await page.locator('#preview .code-copy-wrap').hover();
    await btn.click();
    await expect(btn).toHaveClass(/is-copied/);
    await page.waitForFunction(function () {
      return !document.querySelector('.code-copy').classList.contains('is-copied');
    }, undefined, { timeout: 4000 });
    await expect(btn).toHaveAttribute('aria-label', 'Copy code');
    await expect(btn.locator('svg rect')).toHaveCount(1);
  });

  test('falls back to execCommand when the Clipboard API fails', async function ({ page }) {
    await setupCopyStubs(page, { writeTextFails: true, execResult: true });
    await openPreview(page);
    const btn = page.locator('#preview .code-copy');
    await page.locator('#preview .code-copy-wrap').hover();
    await btn.click();
    expect(await page.evaluate(function () { return window.__execCalls; })).toEqual(['copy']);
    await expect(btn).toHaveClass(/is-copied/);
  });

  test('falls back to execCommand when the Clipboard API is missing', async function ({ page }) {
    await setupCopyStubs(page, { noClipboard: true, execResult: true });
    await openPreview(page);
    const btn = page.locator('#preview .code-copy');
    await page.locator('#preview .code-copy-wrap').hover();
    await btn.click();
    expect(await page.evaluate(function () { return window.__execCalls; })).toEqual(['copy']);
    await expect(btn).toHaveClass(/is-copied/);
  });

  test('stays quiet when even execCommand fails', async function ({ page }) {
    await setupCopyStubs(page, { writeTextFails: true, execResult: false });
    await openPreview(page);
    const btn = page.locator('#preview .code-copy');
    await page.locator('#preview .code-copy-wrap').hover();
    await btn.click();
    expect(await page.evaluate(function () { return window.__execCalls; })).toEqual(['copy']);
    await expect(btn).not.toHaveClass(/is-copied/);
  });

  test('survives a throwing execCommand without breaking the page', async function ({ page }) {
    await setupCopyStubs(page, { writeTextFails: true, execThrows: true });
    await openPreview(page);
    const btn = page.locator('#preview .code-copy');
    await page.locator('#preview .code-copy-wrap').hover();
    await btn.click();
    await expect(btn).not.toHaveClass(/is-copied/);
    await expect(page.locator('#preview .code-copy')).toHaveCount(1);
  });

  test('keeps one button per block across re-renders', async function ({ page }) {
    await openPreview(page);
    // #output is hidden outside the Edit tab, so switch back before filling.
    await switchTab(page, 'edit');
    await setMarkdown(page, '```\nfirst\n```\n\n```\nsecond\n```');
    await switchTab(page, 'preview');
    await expect(page.locator('#preview .code-copy-wrap > pre')).toHaveCount(2);
    await expect(page.locator('#preview .code-copy')).toHaveCount(2);
    await switchTab(page, 'edit');
    await setMarkdown(page, 'no code here');
    await switchTab(page, 'preview');
    await expect(page.locator('#preview .code-copy')).toHaveCount(0);
  });
});
