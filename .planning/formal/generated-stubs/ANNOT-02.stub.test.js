#!/usr/bin/env node
// @requirement ANNOT-02
// Verifies all Alloy model files contain @requirement structured comments

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..', '..', '..');
const REGISTRY_PATH = path.join(ROOT, '.planning', 'formal', 'model-registry.json');

test('ANNOT-02: All Alloy model files contain @requirement annotations on assertions', () => {
  const registry = JSON.parse(fs.readFileSync(REGISTRY_PATH, 'utf8'));
  const alloyFiles = Object.keys(registry.models).filter(f =>
    f.endsWith('.als') && !f.startsWith('..') && !f.startsWith('/')
  );

  assert.ok(alloyFiles.length >= 8, `Expected at least 8 Alloy model files, got ${alloyFiles.length}`);

  const missing = [];
  for (const filePath of alloyFiles) {
    const absPath = path.join(ROOT, filePath);
    if (!fs.existsSync(absPath)) continue;
    const content = fs.readFileSync(absPath, 'utf8');
    // Alloy annotation pattern: -- @requirement REQ-ID
    if (!(/--\s*@requirement\s+[\w-]+/.test(content))) {
      missing.push(filePath);
    }
  }

  assert.strictEqual(
    missing.length, 0,
    `Alloy files missing @requirement annotations: ${missing.join(', ')}`
  );
});
