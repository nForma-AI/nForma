#!/usr/bin/env node
// @requirement ANNOT-02
// Structural test: Alloy model files contain @requirement structured comments

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..', '..', '..');
const ALLOY_DIR = path.join(ROOT, '.planning', 'formal', 'alloy');

test('ANNOT-02 — Alloy model files contain @requirement annotations on assertions', () => {
  const alsFiles = fs.readdirSync(ALLOY_DIR)
    .filter(f => f.endsWith('.als'));

  assert.ok(alsFiles.length >= 8, `Expected at least 8 Alloy model files, found ${alsFiles.length}`);

  let filesWithAnnotations = 0;
  const annotationPattern = /^--\s*@requirement\s+[\w-]+/m;

  for (const file of alsFiles) {
    const content = fs.readFileSync(path.join(ALLOY_DIR, file), 'utf8');
    if (annotationPattern.test(content)) {
      filesWithAnnotations++;
    }
  }

  // At least the original 8 Alloy files should have annotations
  assert.ok(
    filesWithAnnotations >= 8,
    `Expected at least 8 Alloy files with @requirement annotations, found ${filesWithAnnotations}`
  );
});
