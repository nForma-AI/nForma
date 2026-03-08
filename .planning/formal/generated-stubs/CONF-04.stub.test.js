#!/usr/bin/env node
// @requirement CONF-04
// Fail-open behavior: when a quorum model is unavailable, Stop hook passes and logs reduced quorum notification
// Strategy: structural — verify nf-stop.js wraps main logic in try/catch with fail-open exit(0)

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const STOP_HOOK = path.join(__dirname, '..', '..', '..', 'hooks', 'nf-stop.js');

test('CONF-04: nf-stop.js has fail-open try/catch wrapper with process.exit(0) in catch', () => {
  const content = fs.readFileSync(STOP_HOOK, 'utf8');
  // The hook must use try/catch to wrap its main logic
  assert.match(content, /try\s*\{/, 'nf-stop.js must contain try/catch blocks for fail-open');
  // On catch, it must exit 0 (pass through) rather than crash
  assert.match(content, /catch[\s\S]*?process\.exit\(0\)/, 'nf-stop.js must call process.exit(0) in catch for fail-open');
});

test('CONF-04: nf-stop.js detects available MCP servers to handle unavailable models', () => {
  const content = fs.readFileSync(STOP_HOOK, 'utf8');
  // The hook must check which MCP servers are available
  assert.match(content, /getAvailableMcpPrefixes/, 'nf-stop.js must check available MCP prefixes');
  // Must handle unavailable classification with fail-open behavior
  assert.match(content, /unavailable.*fail-open|fail-open.*unavailable/i,
    'nf-stop.js must document fail-open behavior for unavailable models');
});

test('CONF-04: nf-stop.js imports config-loader for quorum configuration', () => {
  const content = fs.readFileSync(STOP_HOOK, 'utf8');
  assert.match(content, /require\(['"]\.\/config-loader['"]\)/, 'nf-stop.js must import config-loader');
  assert.match(content, /loadConfig/, 'nf-stop.js must use loadConfig');
});
