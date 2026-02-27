#!/usr/bin/env node
// hooks/qgsd-prompt-fan-out.test.cjs — Wave 0 test scaffold for FAN-04, FAN-06
// Integration tests for qgsd-prompt.js fan-out logic
// Uses node:test + node:assert/strict with child_process.spawnSync
//
// Purpose: Define test contracts for prompt hook adaptive fan-out before implementation.
// Tests verify that qgsd-prompt.js reads risk_level from context and emits --n N flag.

'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { spawnSync } = require('child_process');
const path = require('path');

// Path to the hook
const HOOK_PATH = path.join(__dirname, 'qgsd-prompt.js');

// Helper: spawn qgsd-prompt.js as child process with stdin
function runHook(stdinPayload) {
  const result = spawnSync('node', [HOOK_PATH], {
    input: JSON.stringify(stdinPayload),
    encoding: 'utf8',
    timeout: 5000,
  });
  return {
    stdout: result.stdout || '',
    stderr: result.stderr || '',
    exitCode: result.status,
  };
}

// Helper: parse JSON from hook output
function parseHookOutput(stdout) {
  try {
    return JSON.parse(stdout);
  } catch {
    return null;
  }
}

// FAN-PROMPT-TC1: routine risk_level in context → --n 2 emitted in additionalContext
test('FAN-PROMPT-TC1: routine risk_level in context → --n 2 emitted', () => {
  const { stdout } = runHook({
    prompt: '/qgsd:plan-phase',
    cwd: process.cwd(),
    context_yaml: 'risk_level: routine\n',
  });
  const output = parseHookOutput(stdout);
  assert.ok(output, 'Hook must return valid JSON');
  assert.ok(output.hookSpecificOutput, 'Must have hookSpecificOutput');
  const instructions = output.hookSpecificOutput.additionalContext || '';
  assert.match(instructions, /--n\s+2/, 'Instructions must contain --n 2 for routine risk_level');
});

// FAN-PROMPT-TC2: medium risk_level in context → --n 3 emitted
test('FAN-PROMPT-TC2: medium risk_level in context → --n 3 emitted', () => {
  const { stdout } = runHook({
    prompt: '/qgsd:plan-phase',
    cwd: process.cwd(),
    context_yaml: 'risk_level: medium\n',
  });
  const output = parseHookOutput(stdout);
  assert.ok(output, 'Hook must return valid JSON');
  assert.ok(output.hookSpecificOutput, 'Must have hookSpecificOutput');
  const instructions = output.hookSpecificOutput.additionalContext || '';
  assert.match(instructions, /--n\s+3/, 'Instructions must contain --n 3 for medium risk_level');
});

// FAN-PROMPT-TC3: --n 5 user override takes precedence over routine risk_level → --n 5 emitted
test('FAN-PROMPT-TC3: --n 5 user override takes precedence over routine risk_level', () => {
  const { stdout } = runHook({
    prompt: '/qgsd:plan-phase --n 5',
    cwd: process.cwd(),
    context_yaml: 'risk_level: routine\n',
  });
  const output = parseHookOutput(stdout);
  assert.ok(output, 'Hook must return valid JSON');
  assert.ok(output.hookSpecificOutput, 'Must have hookSpecificOutput');
  const instructions = output.hookSpecificOutput.additionalContext || '';
  assert.match(instructions, /--n\s+5/, 'Instructions must contain --n 5 (user override takes precedence)');
  assert.match(instructions, /OVERRIDE/, 'Instructions must indicate user override');
});

// FAN-PROMPT-TC4: missing risk_level → --n defaults to maxSize (fail-open)
test('FAN-PROMPT-TC4: missing risk_level → --n defaults to maxSize (fail-open)', () => {
  const { stdout } = runHook({
    prompt: '/qgsd:plan-phase',
    cwd: process.cwd(),
    context_yaml: '',
  });
  const output = parseHookOutput(stdout);
  assert.ok(output, 'Hook must return valid JSON');
  assert.ok(output.hookSpecificOutput, 'Must have hookSpecificOutput');
  const instructions = output.hookSpecificOutput.additionalContext || '';
  // Without risk_level, should default to maxSize (3 by default in code)
  assert.match(instructions, /--n\s+3/, 'Instructions must contain --n 3 (fail-open to default maxSize)');
});
