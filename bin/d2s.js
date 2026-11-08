#!/usr/bin/env node
'use strict';
const { main } = require('../src/cli.js');
process.exitCode = main(process.argv.slice(2));
