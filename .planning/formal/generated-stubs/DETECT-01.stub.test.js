#!/usr/bin/env node
// @requirement DETECT-01
// Structural test: PreToolUse hook intercepts Bash tool calls and checks active
// circuit breaker state before running detection

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const SOURCE = path.resolve(__dirname, '../../../hooks/nf-circuit-breaker.js');

test('DETECT-01: hook is a PreToolUse hook that reads stdin JSON', () => {
  const content = fs.readFileSync(SOURCE, 'utf8');

  // Must reference PreToolUse hook event
  assert.match(content, /PreToolUse/, 'should handle PreToolUse hook event');

  // Must read JSON from stdin
  assert.match(content, /process\.stdin/, 'should read from stdin');
  assert.match(content, /JSON\.parse/, 'should parse JSON input');
});

test('DETECT-01: hook extracts tool_name and checks for Bash tool calls', () => {
  const content = fs.readFileSync(SOURCE, 'utf8');

  // Must extract tool name from input
  assert.match(content, /tool_name|toolName/, 'should extract tool_name from input');

  // Must extract command from tool_input
  assert.match(content, /tool_input/, 'should read tool_input for command extraction');
});

test('DETECT-01: hook checks active circuit breaker state before detection', () => {
  const content = fs.readFileSync(SOURCE, 'utf8');

  // Must read existing state file
  assert.match(content, /readState/, 'should read existing circuit breaker state');

  // Must check state.active before proceeding with detection
  assert.match(content, /state\.active/, 'should check if breaker is already active');

  // Must check state.disabled to skip when breaker is disabled
  assert.match(content, /state\.disabled/, 'should check if breaker is disabled');

  // When active, must emit deny decision
  assert.match(content, /permissionDecision.*deny/, 'should deny when breaker is active');
});

test('DETECT-01: hook uses fail-open pattern', () => {
  const content = fs.readFileSync(SOURCE, 'utf8');

  // Must use try/catch with process.exit(0) for fail-open
  assert.match(content, /catch/, 'should have catch block for fail-open');
  assert.match(content, /process\.exit\(0\)/, 'should exit 0 on error (fail-open)');
});
