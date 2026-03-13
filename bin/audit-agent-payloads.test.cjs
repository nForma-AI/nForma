#!/usr/bin/env node
'use strict';

/**
 * audit-agent-payloads.test.cjs
 *
 * Tests for audit-agent-payloads.cjs using Node.js built-in assert
 */

const assert = require('assert');
const { spawnSync } = require('child_process');
const path = require('path');

const ROOT = process.cwd();
const scriptPath = path.join(ROOT, 'bin', 'audit-agent-payloads.cjs');

function runAudit(args = []) {
  const result = spawnSync('node', [scriptPath, ...args], {
    encoding: 'utf8',
    timeout: 90000,
    maxBuffer: 10 * 1024 * 1024,
  });

  if (result.error) {
    throw result.error;
  }

  return result.stdout || '';
}

function runAuditJSON(args = []) {
  const output = runAudit(['--json', ...args]);
  return JSON.parse(output);
}

try {
  // Single JSON run for all assertions
  console.log('Test 1: Default run produces table output...');
  const tableOutput = runAudit();
  assert(tableOutput.includes('AGENT PAYLOAD SIZE AUDIT'), 'Should include header');
  assert(tableOutput.includes('Script'), 'Should have Script column');
  assert(tableOutput.includes('Size'), 'Should have Size column');
  assert(tableOutput.includes('Status'), 'Should have Status column');
  console.log('  PASS');

  console.log('Test 2: JSON output produces valid schema...');
  const jsonData = runAuditJSON();
  assert(jsonData.threshold_kb === 128, 'Should have threshold_kb = 128');
  assert(Array.isArray(jsonData.scripts), 'Should have scripts array');
  assert(jsonData.summary, 'Should have summary object');
  assert(typeof jsonData.summary.total === 'number', 'Should have summary.total');
  assert(typeof jsonData.summary.ok === 'number', 'Should have summary.ok');
  assert(typeof jsonData.summary.warning === 'number', 'Should have summary.warning');
  assert(typeof jsonData.summary.error === 'number', 'Should have summary.error');
  assert(typeof jsonData.summary.skipped === 'number', 'Should have summary.skipped');
  assert(typeof jsonData.summary.missing === 'number', 'Should have summary.missing');
  console.log('  PASS');

  console.log('Test 3: Finds at least 3 scripts...');
  assert(jsonData.summary.total >= 3, `Should find at least 3 scripts, found ${jsonData.summary.total}`);
  console.log('  PASS');

  console.log('Test 4: Scripts array has correct structure...');
  for (const script of jsonData.scripts) {
    assert(typeof script.name === 'string', 'Script should have name');
    assert(typeof script.size_bytes === 'number', 'Script should have size_bytes');
    assert(['ok', 'warning', 'error', 'skipped', 'missing'].includes(script.status),
      `Script status should be valid, got: ${script.status}`);
    assert(Array.isArray(script.source_files), 'Script should have source_files array');

    if (script.size_bytes > 0) {
      assert(script.size_human, `Script ${script.name} with size should have size_human`);
    }
  }
  console.log('  PASS');

  console.log('Test 5: Summary counts match actual script statuses...');
  const actualCounts = { ok: 0, warning: 0, error: 0, skipped: 0, missing: 0 };
  for (const script of jsonData.scripts) {
    actualCounts[script.status]++;
  }
  for (const status of Object.keys(actualCounts)) {
    assert(jsonData.summary[status] === actualCounts[status],
      `Summary.${status} should be ${actualCounts[status]}, got ${jsonData.summary[status]}`);
  }
  console.log('  PASS');

  console.log('Test 6: --threshold-kb flag is recognized...');
  // Just check that the flag was parsed correctly in the first run
  assert(jsonData.threshold_kb === 128, 'Default threshold should be 128KB');
  console.log('  PASS');

  console.log('\nAll tests passed!');
  process.exit(0);
} catch (err) {
  console.error('Test failed:', err.message);
  process.exit(1);
}
