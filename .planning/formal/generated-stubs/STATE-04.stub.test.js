#!/usr/bin/env node
// @requirement STATE-04
// Verifies CreateSilently: state file created silently if absent;
// failure to write logs to stderr but never blocks execution (structural strategy).

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const CB_SOURCE = path.resolve(__dirname, '..', '..', '..', 'hooks', 'nf-circuit-breaker.js');

test('STATE-04: writeState creates directory silently with mkdirSync recursive', () => {
  const content = fs.readFileSync(CB_SOURCE, 'utf8');

  assert.match(content, /mkdirSync\([^)]+,\s*\{\s*recursive:\s*true\s*\}/,
    'writeState must use mkdirSync with recursive:true to create parent dirs silently');
});

test('STATE-04: writeState wraps in try/catch and logs to stderr on failure', () => {
  const content = fs.readFileSync(CB_SOURCE, 'utf8');

  // Extract the writeState function body
  const fnStart = content.indexOf('function writeState(');
  const fnBody = content.slice(fnStart, fnStart + 600);

  assert.match(fnBody, /try\s*\{/,
    'writeState must be wrapped in try block');
  assert.match(fnBody, /catch/,
    'writeState must have catch block');
  assert.match(fnBody, /process\.stderr\.write/,
    'writeState must log failures to stderr');
});

test('STATE-04: writeState never throws — fail-open pattern', () => {
  const content = fs.readFileSync(CB_SOURCE, 'utf8');

  // The catch block in writeState must not re-throw
  const fnStart = content.indexOf('function writeState(');
  const nextFnStart = content.indexOf('\nfunction ', fnStart + 1);
  const fnBody = content.slice(fnStart, nextFnStart > 0 ? nextFnStart : fnStart + 800);

  // Verify no throw statement in the function body after the catch
  const catchIdx = fnBody.indexOf('catch');
  assert.ok(catchIdx > 0, 'catch must exist');
  const afterCatch = fnBody.slice(catchIdx);
  assert.ok(!afterCatch.includes('throw '),
    'writeState catch block must not re-throw (fail-open)');
});

test('STATE-04: TLA+ model defines CreateSilently action', () => {
  const tlaPath = path.resolve(__dirname, '..', 'tla', 'QGSDBreakerState.tla');
  const content = fs.readFileSync(tlaPath, 'utf8');

  assert.match(content, /CreateSilently\s*==/,
    'TLA+ model must define CreateSilently action');
  // CreateSilently transitions fileExists from FALSE to TRUE
  assert.match(content, /fileExists\s*=\s*FALSE/,
    'CreateSilently precondition: fileExists = FALSE');
  assert.match(content, /fileExists'\s*=\s*TRUE/,
    'CreateSilently postcondition: fileExists\' = TRUE');
});
