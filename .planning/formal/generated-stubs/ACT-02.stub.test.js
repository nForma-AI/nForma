#!/usr/bin/env node
// @requirement ACT-02
// Structural test: Activity schema has required/optional fields per ACT-02

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const GSD_TOOLS = path.join(process.env.HOME, '.claude/nf/bin/gsd-tools.cjs');

test('ACT-02: activity-set always injects `updated` timestamp', () => {
  const content = fs.readFileSync(GSD_TOOLS, 'utf8');
  // cmdActivitySet must set data.updated = new Date().toISOString()
  assert.match(content, /data\.updated\s*=\s*new\s+Date\(\)\.toISOString\(\)/, 'must inject updated timestamp');
});

test('ACT-02: activity-set accepts arbitrary JSON (unknown fields preserved)', () => {
  const content = fs.readFileSync(GSD_TOOLS, 'utf8');
  // Should parse the JSON and write it back — not filter fields
  assert.match(content, /JSON\.parse\(jsonStr\)/, 'must parse input JSON generically');
  assert.match(content, /JSON\.stringify\(data/, 'must stringify entire data object (preserving all fields)');
});

test('ACT-02: TLA+ TypeOK invariant defines valid state types for ACT-02', () => {
  const tlaPath = path.join(__dirname, '../tla/QGSDActivityTracking.tla');
  const content = fs.readFileSync(tlaPath, 'utf8');
  assert.match(content, /TypeOK\s*==/, 'TLA+ model must define TypeOK invariant');
  assert.match(content, /@requirement ACT-02/, 'TLA+ model must tag ACT-02 requirement');
  assert.match(content, /activity\s+\\in\s+Activities/, 'TypeOK must constrain activity to Activities set');
});
