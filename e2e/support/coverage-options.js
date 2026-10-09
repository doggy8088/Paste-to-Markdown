'use strict';

const fs = require('fs');
const path = require('path');

const REPO_ROOT = path.resolve(__dirname, '../..');

// First-party application code only; vendor libraries are excluded.
const APP_SOURCE_PATTERN = /^\/(?:index\.html|assets\/(?:clipboard2markdown|to-markdown)\.js|i18n\/[a-z-]+\.js)$/;

// Minimum percentages enforced by `npm run test:coverage`, both for the
// combined total and for every individual file.
const THRESHOLDS = {
  lines: 90,
  statements: 90,
  functions: 90
};

// Every first-party source the gate must see, listed from disk so a file
// that no test loads fails the gate instead of silently dropping out.
function listExpectedSources() {
  const scripts = function (dir) {
    return fs.readdirSync(path.join(REPO_ROOT, dir))
      .filter(function (name) { return name.endsWith('.js'); })
      .map(function (name) { return dir + '/' + name; });
  };
  return ['index.html'].concat(scripts('assets'), scripts('i18n')).sort();
}

function getPathname(url) {
  try {
    const pathname = new URL(url).pathname;
    return pathname === '/' ? '/index.html' : pathname;
  } catch (error) {
    return '';
  }
}

module.exports = {
  THRESHOLDS: THRESHOLDS,
  listExpectedSources: listExpectedSources,
  options: {
    name: 'Paste to Markdown E2E Coverage',
    outputDir: path.resolve(REPO_ROOT, process.env.E2E_COVERAGE_DIR || 'coverage'),
    reports: [
      ['console-summary'],
      ['v8'],
      ['json-summary'],
      ['lcovonly']
    ],
    entryFilter: function (entry) {
      return APP_SOURCE_PATTERN.test(getPathname(entry.url));
    },
    sourcePath: function (filePath) {
      // Drop the server host and the cache-busting query string, which the
      // report keeps as a suffix:
      // "127.0.0.1-4173/assets/clipboard2markdown.js-v=20261009-print" -> "assets/clipboard2markdown.js"
      return filePath
        .replace(/^[^/]*127\.0\.0\.1[^/]*\//, '')
        .replace(/(?:\?|-)v=[^/]*$/, '');
    }
  }
};
