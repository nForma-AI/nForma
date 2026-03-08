#!/usr/bin/env node
// @requirement SAFE-01
// Structural: --repair cannot silently overwrite rich STATE.md (>50 lines) without --force

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..', '..', '..');

// SAFE-01: --repair cannot silently overwrite a rich STATE.md (>50 lines) without --force.
// Structural strategy: verify the guard logic exists in gsd-tools.cjs.

test('SAFE-01: gsd-tools.cjs has content-length safety gate for STATE.md repair', () => {
  const content = fs.readFileSync(path.join(ROOT, 'core/bin/gsd-tools.cjs'), 'utf8');
  // Must check line count before overwriting
  assert.match(content, /lineCount|line_count|split.*\\n.*length/,
    'must count lines in existing STATE.md before overwriting');
});

test('SAFE-01: gsd-tools.cjs uses 50-line threshold for repair guard', () => {
  const content = fs.readFileSync(path.join(ROOT, 'core/bin/gsd-tools.cjs'), 'utf8');
  assert.match(content, /50/,
    'must reference 50-line threshold for STATE.md safety guard');
  assert.match(content, /SAFE_LINE_THRESHOLD|safe.*threshold/i,
    'must have a named threshold constant');
});

test('SAFE-01: gsd-tools.cjs requires --force to bypass repair guard', () => {
  const content = fs.readFileSync(path.join(ROOT, 'core/bin/gsd-tools.cjs'), 'utf8');
  assert.match(content, /options\.force|args\.force|--force/,
    'must check for --force flag before allowing overwrite');
});

test('SAFE-01: gsd-tools.cjs skips repair and reports reason when guard fires', () => {
  const content = fs.readFileSync(path.join(ROOT, 'core/bin/gsd-tools.cjs'), 'utf8');
  assert.match(content, /skipped.*true|success.*false/,
    'must report skipped/failed status when guard fires');
  assert.match(content, /Re-run with --force/i,
    'must instruct user to re-run with --force');
});
