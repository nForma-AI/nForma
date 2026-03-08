#!/usr/bin/env node
// @requirement CI-04
// Full-suite test fallback: enumerates files via find (never raw globs),
// enforces --test-timeout=15000 per file and a 5-minute Bash timeout,
// and treats timeout as pass-with-warning when task-specific tests already passed.
// Formal model: ci-test-fallback.als — NeverUsesRawGlobs, TimeoutCorrectBehavior, TimeoutConstantsCorrect
// Strategy: structural — verify source files implement these constraints

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..', '..', '..');

// CI-04 properties are implemented across multiple source files.
// The observe-handler-internal.cjs uses 15000ms timeout for subprocess calls.
// The test:ci script enumerates test files explicitly (not via glob).

test('CI-04: test:ci enumerates test files explicitly, not via raw glob', () => {
  const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
  const testCi = pkg.scripts['test:ci'];
  assert.ok(testCi, 'test:ci script must be defined');
  // test:ci must list files explicitly via node --test <file1> <file2> ...
  assert.match(testCi, /node --test\s+\S+\.test\.\S+/, 'test:ci must enumerate test files explicitly');
  // Must NOT use glob patterns like *.test.js or **/*.test.cjs
  assert.ok(!testCi.includes('*.test.'), 'test:ci must not use raw glob patterns (*.test.*)');
  assert.ok(!testCi.includes('**/*.test'), 'test:ci must not use recursive glob patterns (**/*.test)');
});

test('CI-04: observe-handler-internal.cjs uses 15000ms timeout for subprocess calls', () => {
  const handlerPath = path.join(ROOT, 'bin', 'observe-handler-internal.cjs');
  const content = fs.readFileSync(handlerPath, 'utf8');
  // Must use timeout: 15000
  assert.match(content, /timeout:\s*15000/, 'observe-handler-internal.cjs must use timeout: 15000');
});

test('CI-04: CI workflow enforces a global timeout (5 minutes)', () => {
  const ciContent = fs.readFileSync(path.join(ROOT, '.github', 'workflows', 'ci.yml'), 'utf8');
  // The workflow must have a timeout-minutes setting
  assert.match(ciContent, /timeout-minutes:\s*5/, 'CI workflow must set timeout-minutes: 5');
});

test('CI-04: test:formal also enumerates files explicitly, not via raw glob', () => {
  const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
  const testFormal = pkg.scripts['test:formal'];
  assert.ok(testFormal, 'test:formal script must be defined');
  assert.match(testFormal, /node --test\s+\S+\.test\.\S+/, 'test:formal must enumerate test files explicitly');
  assert.ok(!testFormal.includes('*.test.'), 'test:formal must not use raw glob patterns');
});
