#!/usr/bin/env node
// @requirement ANNOT-01
// Verifies all TLA+ model files contain @requirement structured comments

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..', '..', '..');
const REGISTRY_PATH = path.join(ROOT, '.planning', 'formal', 'model-registry.json');

test('ANNOT-01: All TLA+ model files contain @requirement annotations on properties', () => {
  const registry = JSON.parse(fs.readFileSync(REGISTRY_PATH, 'utf8'));
  const tlaFiles = Object.keys(registry.models).filter(f =>
    f.endsWith('.tla') && !f.includes('_TTrace_') && !f.startsWith('..') && !f.startsWith('/')
  );

  assert.ok(tlaFiles.length >= 11, `Expected at least 11 TLA+ model files, got ${tlaFiles.length}`);

  const filesWithAnnotations = [];
  for (const filePath of tlaFiles) {
    const absPath = path.join(ROOT, filePath);
    if (!fs.existsSync(absPath)) continue;
    const content = fs.readFileSync(absPath, 'utf8');
    if (/@requirement\s+[\w-]+/.test(content)) {
      filesWithAnnotations.push(filePath);
    }
  }

  // Every TLA+ model file must have at least one @requirement annotation
  const missing = tlaFiles.filter(f => {
    const absPath = path.join(ROOT, f);
    if (!fs.existsSync(absPath)) return false;
    return !filesWithAnnotations.includes(f);
  });

  assert.strictEqual(
    missing.length, 0,
    `TLA+ files missing @requirement annotations: ${missing.join(', ')}`
  );
});
