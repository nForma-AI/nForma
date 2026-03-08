#!/usr/bin/env node
// @requirement ANNOT-01
// Structural test: TLA+ model files contain @requirement structured comments

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..', '..', '..');
const TLA_DIR = path.join(ROOT, '.planning', 'formal', 'tla');

test('ANNOT-01 — TLA+ model files contain @requirement annotations on properties', () => {
  // Get all non-trace TLA+ files
  const tlaFiles = fs.readdirSync(TLA_DIR)
    .filter(f => f.endsWith('.tla') && !f.includes('_TTrace_'));

  assert.ok(tlaFiles.length >= 11, `Expected at least 11 TLA+ model files, found ${tlaFiles.length}`);

  let filesWithAnnotations = 0;
  const annotationPattern = /\\?\*\s*@requirement\s+[\w-]+/;

  for (const file of tlaFiles) {
    const content = fs.readFileSync(path.join(TLA_DIR, file), 'utf8');
    if (annotationPattern.test(content)) {
      filesWithAnnotations++;
    }
  }

  // At least the original 11 model files should have annotations
  assert.ok(
    filesWithAnnotations >= 11,
    `Expected at least 11 TLA+ files with @requirement annotations, found ${filesWithAnnotations}`
  );
});
