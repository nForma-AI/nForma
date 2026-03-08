#!/usr/bin/env node
// @requirement INST-08
// Structural test for BreakerAlwaysRegistered:
// Installer registers PreToolUse circuit breaker hook in settings.json.

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const installSource = fs.readFileSync(
  path.join(__dirname, '..', '..', '..', 'bin', 'install.js'),
  'utf8'
);

test('INST-08: installer creates PreToolUse array if absent', () => {
  assert.match(installSource, /if\s*\(!settings\.hooks\.PreToolUse\)\s*settings\.hooks\.PreToolUse\s*=\s*\[\]/);
});

test('INST-08: installer checks for existing circuit breaker hook before adding', () => {
  assert.match(installSource, /hasCircuitBreakerHook/);
  assert.match(installSource, /nf-circuit-breaker/);
});

test('INST-08: installer pushes circuit breaker entry to PreToolUse with correct structure', () => {
  // Must register with type command and timeout 10
  assert.match(installSource, /PreToolUse\.push\(/);
  assert.match(installSource, /nf-circuit-breaker\.js/);
  assert.match(installSource, /timeout:\s*10/);
});

test('INST-08: INST-08 requirement tag is present in install.js', () => {
  assert.match(installSource, /INST-08/);
});
