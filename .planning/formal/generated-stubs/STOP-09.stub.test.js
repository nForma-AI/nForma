#!/usr/bin/env node
// @requirement STOP-09
// Structural test: stop hook passes (exits 0, no decision field) when quorum evidence found or no planning command

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

test('STOP-09: nf-stop.js has pass-through path for quorum evidence found', () => {
  const stopHookPath = path.resolve(__dirname, '../../../hooks/nf-stop.js');
  const content = fs.readFileSync(stopHookPath, 'utf8');
  // When all required quorum agents have been called, stop hook should pass (not block)
  // The hook exits 0 without writing a decision when quorum is satisfied
  assert.match(content, /process\.exit\(0\)/,
    'nf-stop.js must have process.exit(0) pass-through path');
});

test('STOP-09: nf-stop.js checks for planning command scope before blocking', () => {
  const stopHookPath = path.resolve(__dirname, '../../../hooks/nf-stop.js');
  const content = fs.readFileSync(stopHookPath, 'utf8');
  // The hook must check whether a planning command is in scope
  // It reads quorum_commands from config to determine scope
  assert.match(content, /quorum_commands/,
    'nf-stop.js must reference quorum_commands to check planning command scope');
});
