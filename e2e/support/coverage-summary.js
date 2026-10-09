'use strict';

// Prints the last run's coverage as a Markdown table, e.g. for the
// GitHub Actions job summary: node e2e/support/coverage-summary.js >> "$GITHUB_STEP_SUMMARY"
const fs = require('fs');
const path = require('path');
const { THRESHOLDS } = require('./coverage-options');

const coverageDir = path.resolve(__dirname, '../..', process.env.E2E_COVERAGE_DIR || 'coverage');
const summaryPath = path.join(coverageDir, 'coverage-summary.json');

if (!fs.existsSync(summaryPath)) {
  console.log('## E2E coverage\n\nNo coverage report was produced.');
  process.exit(0);
}

const summary = JSON.parse(fs.readFileSync(summaryPath, 'utf8'));
const metrics = ['lines', 'statements', 'functions', 'branches'];

function cell(metric, value) {
  const gated = Object.prototype.hasOwnProperty.call(THRESHOLDS, metric);
  const passed = !gated || value.total === 0 || value.pct >= THRESHOLDS[metric];
  return (passed ? '' : '❌ ') + value.pct + '%';
}

const rows = Object.keys(summary).map(function (file) {
  return '| ' + (file === 'total' ? '**Total**' : '`' + file + '`') + ' | ' +
    metrics.map(function (metric) { return cell(metric, summary[file][metric]); }).join(' | ') + ' |';
});

console.log([
  '## E2E coverage',
  '',
  'Minimum per file and total: ' + Object.keys(THRESHOLDS).map(function (metric) {
    return metric + ' ' + THRESHOLDS[metric] + '%';
  }).join(', ') + ' (branches are reported only).',
  '',
  '| File | Lines | Statements | Functions | Branches |',
  '|---|---|---|---|---|'
].concat(rows).join('\n'));
