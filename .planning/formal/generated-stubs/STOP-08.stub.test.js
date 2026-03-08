#!/usr/bin/env node
// @requirement STOP-08
// Structural test: block reason message format contains "QUORUM REQUIRED:"

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

test('STOP-08: nf-stop.js block reason contains QUORUM REQUIRED prefix', () => {
  const stopHookPath = path.resolve(__dirname, '../../../hooks/nf-stop.js');
  const content = fs.readFileSync(stopHookPath, 'utf8');
  // The block reason must start with "QUORUM REQUIRED:" per requirement STOP-08
  assert.match(content, /QUORUM REQUIRED:/,
    'nf-stop.js must contain block reason with "QUORUM REQUIRED:" prefix');
});

test('STOP-08: block reason includes missing agents list', () => {
  const stopHookPath = path.resolve(__dirname, '../../../hooks/nf-stop.js');
  const content = fs.readFileSync(stopHookPath, 'utf8');
  // The message must reference missing tool calls / agents
  assert.match(content, /Missing tool calls for/,
    'Block reason must reference missing tool calls');
});
