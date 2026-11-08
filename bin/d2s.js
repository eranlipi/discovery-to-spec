#!/usr/bin/env node
'use strict';
const { main } = require('../src/cli.js');
// main returns an exit code, or a promise of one when it has to ask GitHub (check --verify-approvals).
Promise.resolve(main(process.argv.slice(2))).then((code) => {
  process.exitCode = code;
});
