'use strict';

const fs = require('fs');
const path = require('path');
const MCR = require('monocart-coverage-reports');
const { options, THRESHOLDS, listExpectedSources } = require('./coverage-options');

function findShortfalls(label, summary) {
  return Object.keys(THRESHOLDS)
    .filter(function (metric) {
      const value = summary[metric];
      return value && value.total > 0 && value.pct < THRESHOLDS[metric];
    })
    .map(function (metric) {
      return label + ': ' + metric + ' ' + summary[metric].pct + '% < ' + THRESHOLDS[metric] + '%';
    });
}

module.exports = async function globalTeardown(config) {
  const gateEnabled = !!(config.metadata && config.metadata.coverageGate);
  const results = await MCR(options).generate();
  if (!gateEnabled) {
    return;
  }
  if (!results) {
    throw new Error('No coverage data was collected.');
  }

  // Gate on the Istanbul-style summary, the same numbers lcov tools report.
  const summaryPath = path.join(options.outputDir, 'coverage-summary.json');
  const summary = JSON.parse(fs.readFileSync(summaryPath, 'utf8'));
  const shortfalls = listExpectedSources()
    .filter(function (file) { return !summary[file]; })
    .map(function (file) { return file + ': no coverage collected (never loaded by any test)'; });
  Object.keys(summary).forEach(function (file) {
    shortfalls.push.apply(shortfalls, findShortfalls(file, summary[file]));
  });

  if (shortfalls.length) {
    throw new Error('Coverage below threshold:\n  ' + shortfalls.join('\n  '));
  }
  console.log('Coverage thresholds met (per file and total): ' + JSON.stringify(THRESHOLDS));
};
