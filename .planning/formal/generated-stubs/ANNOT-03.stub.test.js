#!/usr/bin/env node
// @requirement ANNOT-03
// Verifies all PRISM .props files contain @requirement structured comments

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..', '..', '..');
const REGISTRY_PATH = path.join(ROOT, '.planning', 'formal', 'model-registry.json');

test('ANNOT-03: All PRISM .props files contain @requirement annotations on properties', () => {
  const registry = JSON.parse(fs.readFileSync(REGISTRY_PATH, 'utf8'));
  // .props files are siblings of .pm files in the registry
  const pmFiles = Object.keys(registry.models).filter(f =>
    f.endsWith('.pm') && !f.startsWith('..') && !f.startsWith('/')
  );

  const propsFiles = [];
  for (const pm of pmFiles) {
    const propsPath = pm.replace(/\.pm$/, '.props');
    const absPath = path.join(ROOT, propsPath);
    if (fs.existsSync(absPath)) {
      propsFiles.push(propsPath);
    }
  }

  assert.ok(propsFiles.length >= 3, `Expected at least 3 PRISM .props files, got ${propsFiles.length}`);

  const missing = [];
  for (const filePath of propsFiles) {
    const absPath = path.join(ROOT, filePath);
    const content = fs.readFileSync(absPath, 'utf8');
    // PRISM annotation pattern: // @requirement REQ-ID
    if (!(/@requirement\s+[\w-]+/.test(content))) {
      missing.push(filePath);
    }
  }

  assert.strictEqual(
    missing.length, 0,
    `PRISM .props files missing @requirement annotations: ${missing.join(', ')}`
  );
});
