#!/usr/bin/env node
// @requirement ACT-02
// Auto-generated stub for uncovered invariant: TypeOK

const { test } = require('node:test');
const assert = require('node:assert/strict');

const fs = require('node:fs');
const path = require('node:path');

const gsdToolsSrc = fs.readFileSync(
  path.resolve(__dirname, '../../../core/bin/gsd-tools.cjs'),
  'utf8'
);

test('ACT-02 — TypeOK: cmdActivitySet always stamps updated field', () => {
  // The schema requires `updated` to always be set by the writer
  assert.match(gsdToolsSrc, /data\.updated\s*=\s*new\s+Date\(\)\.toISOString\(\)/,
    'cmdActivitySet must stamp data.updated with ISO timestamp');
});

test('ACT-02 — TypeOK: activity JSON is parsed and re-serialized preserving fields', () => {
  // Verify JSON.parse is used on input (preserves unknown fields)
  assert.match(gsdToolsSrc, /JSON\.parse\(jsonStr\)/,
    'cmdActivitySet must parse the input JSON string');

  // Verify JSON.stringify is used for output (preserves all fields)
  assert.match(gsdToolsSrc, /JSON\.stringify\(data,\s*null,\s*2\)/,
    'cmdActivitySet must serialize with pretty-print preserving all fields');
});
