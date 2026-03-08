#!/usr/bin/env node
// @requirement EVID-04
// Behavioral test for CommitCategory assertion from git-history-evidence.als
// Verifies git-history-evidence.cjs classifies commits into exactly 7 categories
// (feat/fix/refactor/docs/test/build/chore) and exports drift detection.

const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

const ghePath = path.resolve(__dirname, '../../../bin/git-history-evidence.cjs');

test('EVID-04: COMMIT_TYPES contains exactly 7 categories', () => {
  const { COMMIT_TYPES } = require(ghePath);
  assert.ok(Array.isArray(COMMIT_TYPES), 'COMMIT_TYPES must be an array');
  assert.equal(COMMIT_TYPES.length, 7, 'must have exactly 7 categories');
  const expected = ['feat', 'fix', 'refactor', 'docs', 'test', 'build', 'chore'];
  assert.deepStrictEqual(COMMIT_TYPES, expected);
});

test('EVID-04: classifyCommit categorizes conventional commit prefixes', () => {
  const { classifyCommit } = require(ghePath);
  assert.equal(classifyCommit('feat(auth): add login'), 'feat');
  assert.equal(classifyCommit('fix: null pointer'), 'fix');
  assert.equal(classifyCommit('refactor(core): simplify'), 'refactor');
  assert.equal(classifyCommit('docs: update README'), 'docs');
  assert.equal(classifyCommit('test: add unit tests'), 'test');
  assert.equal(classifyCommit('build: update webpack'), 'build');
});

test('EVID-04: classifyCommit falls back to chore for unknown messages', () => {
  const { classifyCommit } = require(ghePath);
  assert.equal(classifyCommit('random commit message'), 'chore');
  assert.equal(classifyCommit(''), 'chore');
  assert.equal(classifyCommit(null), 'chore');
});

test('EVID-04: exports TLA+ drift detection functions', () => {
  const mod = require(ghePath);
  assert.ok(typeof mod.buildTlaCoverageReverseMap === 'function',
    'must export buildTlaCoverageReverseMap for spec cross-referencing');
  assert.ok(typeof mod.findTlaDriftCandidates === 'function',
    'must export findTlaDriftCandidates for drift detection');
  assert.ok(typeof mod.getTlaCrossRefs === 'function',
    'must export getTlaCrossRefs');
});
