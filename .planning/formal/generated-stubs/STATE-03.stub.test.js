#!/usr/bin/env node
// @requirement STATE-03
// Verifies HookReadsState: hook reads existing state first — if active,
// applies enforcement immediately without re-running git log detection (structural strategy).

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const CB_SOURCE = path.resolve(__dirname, '..', '..', '..', 'hooks', 'nf-circuit-breaker.js');

test('STATE-03: hook reads state file before git log detection', () => {
  const content = fs.readFileSync(CB_SOURCE, 'utf8');

  // The main function must call readState BEFORE getCommitHashes
  const readStateIdx = content.indexOf('readState(statePath)');
  const getHashesIdx = content.indexOf('getCommitHashes(gitRoot');

  assert.ok(readStateIdx > 0, 'readState call must exist');
  assert.ok(getHashesIdx > 0, 'getCommitHashes call must exist');
  assert.ok(readStateIdx < getHashesIdx,
    'readState must be called BEFORE getCommitHashes (reads state first)');
});

test('STATE-03: active state short-circuits to deny without git log', () => {
  const content = fs.readFileSync(CB_SOURCE, 'utf8');

  // When state.active is true, the hook emits deny decision directly
  assert.match(content, /if\s*\(\s*state\s*&&\s*state\.active\s*\)/,
    'Hook must check state.active');
  assert.match(content, /permissionDecision.*deny/,
    'Active breaker must produce deny decision');
});

test('STATE-03: readState handles missing file gracefully', () => {
  const content = fs.readFileSync(CB_SOURCE, 'utf8');

  // readState checks existsSync before reading
  assert.match(content, /existsSync\(statePath\)/,
    'readState must check if file exists before reading');
});
