'use strict';

const MCR = require('monocart-coverage-reports');
const { options } = require('./coverage-options');

module.exports = async function globalSetup() {
  // Start every run from an empty coverage cache.
  MCR(options).cleanCache();
};
