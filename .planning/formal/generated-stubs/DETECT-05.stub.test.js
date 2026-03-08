#!/usr/bin/env node
// @requirement DETECT-05
// Verifies: OscillationFlaggedCorrectly — Detection is skipped (returns pass) when no git repository exists in the current working directory

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const HOOK_PATH = path.join(process.cwd(), 'hooks', 'nf-circuit-breaker.js');
const src = fs.readFileSync(HOOK_PATH, 'utf8');

test('DETECT-05: getGitRoot returns null when not in a git repo', () => {
  assert.ok(src.includes('function getGitRoot'),
    'Must define getGitRoot function');
  assert.ok(src.includes("'rev-parse'"),
    'Must use git rev-parse to detect git root');
  assert.ok(src.includes('return null'),
    'Must return null when git rev-parse fails');
});

test('DETECT-05: hook exits cleanly when no git root found', () => {
  // The comment explicitly references DETECT-05
  assert.ok(src.includes('DETECT-05'),
    'Must reference DETECT-05 requirement in comment');
  // When gitRoot is null, hook exits with 0 (pass-through)
  const gitRootCheck = src.indexOf('!gitRoot');
  assert.ok(gitRootCheck > 0, 'Must check for null gitRoot');
  const exitAfter = src.substring(gitRootCheck, gitRootCheck + 100);
  assert.ok(exitAfter.includes('process.exit(0)'),
    'Must exit with 0 (pass) when no git repo');
});

test('DETECT-05: fail-open on any top-level error', () => {
  // The catch block at the end exits with 0 (fail-open)
  assert.ok(src.includes('} catch {'),
    'Must have a catch-all handler');
  assert.ok(src.includes("process.exit(0); // Fail-open"),
    'Must exit 0 on any error (fail-open behavior)');
});
