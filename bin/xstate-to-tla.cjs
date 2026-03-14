#!/usr/bin/env node
'use strict';
// bin/xstate-to-tla.cjs
// Thin backward-compat wrapper. Delegates to bin/fsm-to-tla.cjs --framework=xstate-v5
//
// All XState-to-TLA+ transpilation logic now lives in the multi-adapter pipeline:
//   bin/adapters/xstate-v5.cjs  (adapter)
//   bin/adapters/emitter-tla.cjs (TLA+ emitter)
//   bin/fsm-to-tla.cjs          (unified CLI)
//
// This wrapper preserves backward compatibility for existing scripts and hooks.

const { spawnSync } = require('child_process');
const path = require('path');

const fsmToTla = path.join(__dirname, 'fsm-to-tla.cjs');
const args = ['--framework=xstate-v5', ...process.argv.slice(2)];

const result = spawnSync(process.execPath, [fsmToTla, ...args], {
  stdio: 'inherit',
  cwd: process.cwd(),
});

process.exit(result.status || 0);
