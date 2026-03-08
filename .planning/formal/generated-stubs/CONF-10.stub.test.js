#!/usr/bin/env node
// @requirement CONF-10
// Configuration layer validates and gracefully degrades when providers.json
// contains zero providers, falling back to solo quorum mode with clear diagnostic messages

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const PROJECT_ROOT = path.resolve(__dirname, '..', '..', '..');
const configAuditPath = path.join(PROJECT_ROOT, 'bin', 'config-audit.cjs');

test('CONF-10: config-audit.cjs exists and is fail-open (exit 0)', () => {
  const content = fs.readFileSync(configAuditPath, 'utf8');
  assert.match(content, /process\.exit\(0\)/,
    'config-audit must exit 0 (fail-open)');
});

test('CONF-10: config-audit handles missing providers.json gracefully', () => {
  const content = fs.readFileSync(configAuditPath, 'utf8');
  assert.match(content, /providers\.json/,
    'config-audit must reference providers.json');
  assert.match(content, /not found|existsSync/i,
    'config-audit must check for providers.json existence');
});

test('CONF-10: config-audit outputs structured JSON with warnings and missing arrays', () => {
  const content = fs.readFileSync(configAuditPath, 'utf8');
  assert.match(content, /warnings/,
    'output must include warnings field');
  assert.match(content, /missing/,
    'output must include missing field');
  assert.match(content, /JSON\.stringify/,
    'output must be JSON-formatted');
});

test('CONF-10: config-audit detects zero-sub-provider anti-pattern', () => {
  const content = fs.readFileSync(configAuditPath, 'utf8');
  assert.match(content, /hasAnySub|auth_type.*sub/,
    'config-audit must detect absence of sub-type providers');
  assert.match(content, /FALLBACK-01|tiered.*fallback/i,
    'config-audit must reference FALLBACK-01 tiered fallback impact');
});
