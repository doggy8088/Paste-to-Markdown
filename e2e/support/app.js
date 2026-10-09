'use strict';

const fs = require('fs');
const path = require('path');

const REPO_ROOT = path.resolve(__dirname, '../..');

/**
 * Opens the app. `hash` is appended to the URL (e.g. '#z:...').
 * `storage` is written to localStorage before any page script runs.
 * @param {import('@playwright/test').Page} page
 * @param {{ hash?: string, storage?: Record<string, string> }} [options]
 */
async function gotoApp(page, options) {
  const settings = options || {};
  if (settings.storage) {
    await page.addInitScript(function (entries) {
      Object.keys(entries).forEach(function (key) {
        window.localStorage.setItem(key, entries[key]);
      });
    }, settings.storage);
  }
  await page.goto('/index.html' + (settings.hash || ''));
  await page.waitForFunction(function () {
    return !!(window.i18n && document.querySelector('.tab-button.active'));
  });
}

/**
 * Simulates a paste into the hidden #pastebin, the same element the app
 * listens on. Browsers block tests from writing the system clipboard, so a
 * synthetic ClipboardEvent carries the data instead.
 * By default the editor is emptied first so the result is the pasted text only.
 * @param {import('@playwright/test').Page} page
 * @param {{ html?: string, text?: string, rtf?: string, vscode?: string|object }} data
 * @param {{ keepExisting?: boolean }} [options]
 */
async function pasteContent(page, data, options) {
  const keepExisting = !!(options && options.keepExisting);
  await page.evaluate(function (args) {
    var payload = args.payload;
    var output = document.querySelector('#output');
    if (!args.keepExisting) {
      output.value = '';
    }
    var transfer = new DataTransfer();
    if (payload.vscode != null) {
      transfer.setData('vscode-editor-data',
        typeof payload.vscode === 'string' ? payload.vscode : JSON.stringify(payload.vscode));
    }
    if (payload.rtf != null) transfer.setData('text/rtf', payload.rtf);
    if (payload.html != null) transfer.setData('text/html', payload.html);
    if (payload.text != null) transfer.setData('text/plain', payload.text);

    var event = new ClipboardEvent('paste', {
      clipboardData: transfer,
      bubbles: true,
      cancelable: true
    });
    document.querySelector('#pastebin').dispatchEvent(event);
  }, { payload: data, keepExisting: keepExisting });
}

/** Pastes `data` and returns the resulting Markdown from the editor. */
async function convertPaste(page, data, options) {
  await pasteContent(page, data, options);
  return getMarkdown(page);
}

/** Current editor (#output) value. */
function getMarkdown(page) {
  return page.locator('#output').inputValue();
}

/** Replaces the editor content as if the user typed it (fires `input`). */
async function setMarkdown(page, markdown) {
  await page.locator('#output').fill(markdown);
}

/** Clicks the Edit or Preview tab. */
async function switchTab(page, tab) {
  await page.locator('.tab-button[data-tab="' + tab + '"]').click();
}

/** Reads a file from the repo's tests/ fixture folder. */
function readFixture(name) {
  return fs.readFileSync(path.join(REPO_ROOT, 'tests', name), 'utf8');
}

module.exports = {
  gotoApp: gotoApp,
  pasteContent: pasteContent,
  convertPaste: convertPaste,
  getMarkdown: getMarkdown,
  setMarkdown: setMarkdown,
  switchTab: switchTab,
  readFixture: readFixture
};
