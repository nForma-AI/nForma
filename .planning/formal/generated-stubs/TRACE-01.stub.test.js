#!/usr/bin/env node
// @requirement TRACE-01
// Behavioral test: generate-traceability-matrix.cjs reads model-registry, requirements.json,
// and check-results.ndjson to produce traceability-matrix.json with property-level links.

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '../../..');
const SCRIPT = path.join(ROOT, 'bin', 'generate-traceability-matrix.cjs');

test('TRACE-01: generate-traceability-matrix.cjs produces JSON with requirements and properties sections', () => {
  const result = spawnSync(process.execPath, [SCRIPT, '--json', '--project-root=' + ROOT], {
    encoding: 'utf8',
    cwd: ROOT,
    timeout: 30000,
  });

  // Script should exit successfully
  assert.equal(result.status, 0, 'Script should exit 0; stderr: ' + (result.stderr || '').slice(0, 500));

  const matrix = JSON.parse(result.stdout);

  // Must have requirements index (reqId -> { id, properties })
  assert.ok(matrix.requirements, 'Matrix must have a requirements section');
  assert.equal(typeof matrix.requirements, 'object', 'requirements must be an object');

  // Must have properties index (key -> { model_file, property_name, requirement_ids })
  assert.ok(matrix.properties, 'Matrix must have a properties section');
  assert.equal(typeof matrix.properties, 'object', 'properties must be an object');

  // Verify property-level links: at least one property entry should have requirement_ids
  const propKeys = Object.keys(matrix.properties);
  assert.ok(propKeys.length > 0, 'Should have at least one property entry');

  const firstProp = matrix.properties[propKeys[0]];
  assert.ok(Array.isArray(firstProp.requirement_ids), 'Property entries must have requirement_ids array');
  assert.ok(firstProp.model_file, 'Property entries must have model_file');
});
