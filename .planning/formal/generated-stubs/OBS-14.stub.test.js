#!/usr/bin/env node
// @requirement OBS-14
// Structural test: Observe handlers accept execFn and basePath options for dependency injection.
// All subprocess calls use the injected execFn (defaulting to execFileSync) and all
// filesystem paths resolve relative to basePath.

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..', '..', '..');

test('OBS-14: observe-handlers.cjs accepts execFn option for DI', () => {
  const content = fs.readFileSync(path.join(ROOT, 'bin', 'observe-handlers.cjs'), 'utf8');
  // handleGitHub and handleBash accept options.execFn
  assert.match(content, /options\.execFn\s*\|\|\s*execFileSync/, 'handleGitHub should use options.execFn || execFileSync');
  // detectRepoFromGit accepts execFn parameter
  assert.match(content, /function\s+detectRepoFromGit\s*\(\s*execFn\s*\)/, 'detectRepoFromGit should accept execFn parameter');
});

test('OBS-14: observe-handler-deps.cjs accepts execFn and basePath for DI', () => {
  const content = fs.readFileSync(path.join(ROOT, 'bin', 'observe-handler-deps.cjs'), 'utf8');
  // Functions accept basePath parameter
  assert.match(content, /options\.basePath\s*\|\|\s*process\.cwd\(\)/, 'should default basePath to process.cwd()');
  // Functions accept execFn parameter
  assert.match(content, /options\.execFn\s*\|\|\s*execFileSync/, 'should default execFn to execFileSync');
  // Individual functions accept basePath
  assert.match(content, /function\s+detectEcosystems\s*\(\s*basePath\s*\)/, 'detectEcosystems should accept basePath');
  assert.match(content, /function\s+checkNpmOutdated\s*\(\s*basePath\s*,\s*execFn\s*\)/, 'checkNpmOutdated should accept basePath and execFn');
});

test('OBS-14: observe-handler-upstream.cjs accepts execFn and basePath for DI', () => {
  const content = fs.readFileSync(path.join(ROOT, 'bin', 'observe-handler-upstream.cjs'), 'utf8');
  // handleUpstream accepts options.execFn and options.basePath
  assert.match(content, /options\.execFn\s*\|\|\s*execFileSync/, 'should default execFn to execFileSync');
  assert.match(content, /options\.basePath\s*\|\|\s*process\.cwd\(\)/, 'should default basePath to process.cwd()');
  // fetchReleases and fetchNotablePRs accept execFn
  assert.match(content, /function\s+fetchReleases\s*\([^)]*execFn/, 'fetchReleases should accept execFn');
  assert.match(content, /function\s+fetchNotablePRs\s*\([^)]*execFn/, 'fetchNotablePRs should accept execFn');
});
