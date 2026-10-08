'use strict';

// Lists uncovered line ranges from the last run's lcov report.
// Usage: node e2e/support/uncovered.js [file-substring] [--from N] [--to N]
// e.g.   node e2e/support/uncovered.js clipboard2markdown --from 1359 --to 1468
const fs = require('fs');
const path = require('path');

const args = process.argv.slice(2);
const filter = args[0] && !args[0].startsWith('--') ? args[0] : '';
function option(name, fallback) {
  const index = args.indexOf(name);
  return index >= 0 ? Number(args[index + 1]) : fallback;
}
const from = option('--from', 1);
const to = option('--to', Infinity);

const coverageDir = path.resolve(__dirname, '../..', process.env.E2E_COVERAGE_DIR || 'coverage');
const lcov = fs.readFileSync(path.join(coverageDir, 'lcov.info'), 'utf8');

lcov.split('end_of_record').forEach(function (record) {
  const fileMatch = record.match(/^SF:(.+)$/m);
  if (!fileMatch || fileMatch[1].indexOf(filter) === -1) {
    return;
  }
  const missed = [];
  record.replace(/^DA:(\d+),(\d+)/gm, function (match, line, hits) {
    const lineNumber = Number(line);
    if (Number(hits) === 0 && lineNumber >= from && lineNumber <= to) {
      missed.push(lineNumber);
    }
    return match;
  });
  const ranges = [];
  missed.forEach(function (line) {
    const last = ranges[ranges.length - 1];
    if (last && line === last[1] + 1) {
      last[1] = line;
    } else {
      ranges.push([line, line]);
    }
  });
  console.log(fileMatch[1] + ': ' + missed.length + ' uncovered lines');
  if (ranges.length) {
    console.log('  ' + ranges.map(function (range) {
      return range[0] === range[1] ? String(range[0]) : range[0] + '-' + range[1];
    }).join(', '));
  }
});
