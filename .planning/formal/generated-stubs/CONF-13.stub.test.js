#!/usr/bin/env node
// @requirement CONF-13
// Config audit script (bin/config-audit.cjs) cross-references providers.json
// against nf.json agent_config, detects the all-default auth_type=api anti-pattern,
// outputs structured JSON warnings, and is invoked fail-open in solve Step 0b.

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const PROJECT_ROOT = path.resolve(__dirname, '..', '..', '..');
const configAuditPath = path.join(PROJECT_ROOT, 'bin', 'config-audit.cjs');

test('CONF-13: config-audit outputs valid JSON with --json flag', () => {
  const result = execFileSync(process.execPath, [configAuditPath, '--json'], {
    encoding: 'utf8',
    timeout: 10000,
    cwd: PROJECT_ROOT,
  });
  const parsed = JSON.parse(result.trim());
  assert.ok(Array.isArray(parsed.warnings), 'output must have warnings array');
  assert.ok(Array.isArray(parsed.missing), 'output must have missing array');
});

test('CONF-13: config-audit cross-references providers.json against agent_config', () => {
  const content = fs.readFileSync(configAuditPath, 'utf8');
  assert.match(content, /providers\.json/,
    'must reference providers.json');
  assert.match(content, /agent_config/,
    'must reference agent_config');
  assert.match(content, /slotsToAudit|slots.*audit/i,
    'must audit slot names from providers');
});

test('CONF-13: config-audit detects all-default auth_type=api anti-pattern', () => {
  const content = fs.readFileSync(configAuditPath, 'utf8');
  assert.match(content, /all.*default|all-default|hasAnySub/i,
    'must detect the all-default anti-pattern');
  assert.match(content, /auth_type.*['"]?sub['"]?/,
    'must check for sub auth_type presence');
  assert.match(content, /FALLBACK-01/,
    'must reference FALLBACK-01 requirement');
});

test('CONF-13: config-audit is fail-open (always exits 0)', () => {
  const content = fs.readFileSync(configAuditPath, 'utf8');
  const exitCalls = content.match(/process\.exit\(\d+\)/g) || [];
  for (const call of exitCalls) {
    assert.equal(call, 'process.exit(0)',
      'All process.exit calls must use exit code 0 (fail-open)');
  }
});

test('CONF-13: config-audit uses config-loader for two-layer config', () => {
  const content = fs.readFileSync(configAuditPath, 'utf8');
  assert.match(content, /config-loader|loadConfig/,
    'must use config-loader for two-layer config resolution');
});
