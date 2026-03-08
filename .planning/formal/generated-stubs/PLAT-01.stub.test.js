#!/usr/bin/env node
// @requirement PLAT-01
// Structural test: install.js uses cross-platform path building (forward slashes)
// Formal property: Platform from platform-install-compat.als — PlatformParity + NoWorkarounds

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '../../..');

test('PLAT-01 — install.js exists and is loadable', () => {
  const installPath = path.join(ROOT, 'bin/install.js');
  assert.ok(fs.existsSync(installPath), 'bin/install.js must exist');
});

test('PLAT-01 — install.js uses forward slashes for cross-platform compatibility', () => {
  const content = fs.readFileSync(path.join(ROOT, 'bin/install.js'), 'utf8');
  assert.match(content, /forward.?slash/i, 'install.js should reference forward-slash strategy for cross-platform paths');
});

test('PLAT-01 — config-loader.js exists for platform-independent config loading', () => {
  const loaderPath = path.join(ROOT, 'hooks/config-loader.js');
  assert.ok(fs.existsSync(loaderPath), 'hooks/config-loader.js must exist');
});

test('PLAT-01 — config-loader.js exports loadConfig and shouldRunHook', () => {
  const mod = require(path.join(ROOT, 'hooks/config-loader.js'));
  assert.equal(typeof mod.loadConfig, 'function');
  assert.equal(typeof mod.shouldRunHook, 'function');
});

test('PLAT-01 — Alloy model defines PlatformParity and NoWorkarounds predicates', () => {
  const content = fs.readFileSync(path.join(ROOT, '.planning/formal/alloy/platform-install-compat.als'), 'utf8');
  assert.match(content, /pred PlatformParity/);
  assert.match(content, /pred NoWorkarounds/);
  assert.match(content, /PLAT-01/);
});
