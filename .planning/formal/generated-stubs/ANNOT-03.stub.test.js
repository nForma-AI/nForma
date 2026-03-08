#!/usr/bin/env node
// @requirement ANNOT-03
// Structural test: PRISM .props files contain @requirement structured comments

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..', '..', '..');
const PRISM_DIR = path.join(ROOT, '.planning', 'formal', 'prism');

test('ANNOT-03 — PRISM .props files contain @requirement annotations on properties', () => {
  const propsFiles = fs.readdirSync(PRISM_DIR)
    .filter(f => f.endsWith('.props'));

  assert.ok(propsFiles.length >= 3, `Expected at least 3 PRISM .props files, found ${propsFiles.length}`);

  let filesWithAnnotations = 0;
  const annotationPattern = /^\/\/\s*@requirement\s+[\w-]+/m;

  for (const file of propsFiles) {
    const content = fs.readFileSync(path.join(PRISM_DIR, file), 'utf8');
    if (annotationPattern.test(content)) {
      filesWithAnnotations++;
    }
  }

  // At least 3 PRISM .props files should have annotations
  assert.ok(
    filesWithAnnotations >= 3,
    `Expected at least 3 PRISM .props files with @requirement annotations, found ${filesWithAnnotations}`
  );
});
