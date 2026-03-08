#!/usr/bin/env node
// @requirement DETECT-02
// Structural test: hook retrieves last N commits' changed files via git log --name-only
// (N = commit_window config) when detection is needed

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const SOURCE = path.resolve(__dirname, '../../../hooks/nf-circuit-breaker.js');

test('DETECT-02: hook defines getCommitHashes to retrieve last N commit hashes', () => {
  const content = fs.readFileSync(SOURCE, 'utf8');

  // Must define getCommitHashes function
  assert.match(content, /function\s+getCommitHashes/, 'should define getCommitHashes');

  // Must use git log to get commit hashes
  assert.match(content, /git.*log/, 'should invoke git log');

  // Must accept a window parameter for the number of commits
  assert.match(content, /getCommitHashes\(.*,\s*\w+/, 'should accept window parameter');
});

test('DETECT-02: hook defines getCommitFileSets to get changed files per commit', () => {
  const content = fs.readFileSync(SOURCE, 'utf8');

  // Must define getCommitFileSets function
  assert.match(content, /function\s+getCommitFileSets/, 'should define getCommitFileSets');

  // Must use git diff-tree --name-only to get changed files
  assert.match(content, /diff-tree/, 'should use git diff-tree for file listing');
  assert.match(content, /--name-only/, 'should use --name-only flag');
});

test('DETECT-02: hook uses commit_window from config', () => {
  const content = fs.readFileSync(SOURCE, 'utf8');

  // Must read commit_window from config
  assert.match(content, /commit_window/, 'should reference commit_window config');

  // Must pass commit_window to getCommitHashes
  assert.match(content, /getCommitHashes\(.*commit_window/, 'should pass commit_window to getCommitHashes');
});
