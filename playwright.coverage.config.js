'use strict';

// Same as playwright.config.js, but fails the run when coverage drops below
// the thresholds in e2e/support/coverage-options.js. Run the full suite with
// `npm run test:coverage`; single spec files should use the default config.
const baseConfig = require('./playwright.config');

module.exports = {
  ...baseConfig,
  metadata: {
    ...baseConfig.metadata,
    coverageGate: true
  }
};
