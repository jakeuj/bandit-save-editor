#!/usr/bin/env node
'use strict';
// Native follow-up actions after editing, for disposable states created by verify-game. The follow-up copy covers
// equip cycle, profession transfer and research/training start-stop; the batch-two copy covers pills and rebirth.
// `ascend` alone prepares an ascended base save; with `pills` the same block only tells rebirth to check the cleanup.
const {evaluate, waitMain} = require('./verify-game.cjs');
const {createNativeLifecycle} = require('./native-lifecycle/index.cjs');
const {actions, run} = createNativeLifecycle({evaluate, waitMain, scriptDir: __dirname});
const args = process.argv.slice(2), opt = k => args[args.indexOf(k) + 1];

if (require.main === module) run(opt('--state'), opt('--scenario')).catch(e => { console.error(e.stack); process.exitCode = 1; });
module.exports = actions;
