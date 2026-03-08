#!/usr/bin/env node
// @requirement SCHEMA-04
// Structural test: requirements.json envelope gains an optional formal_models array
// (string[]) per requirement, listing model file paths that verify it

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const REQUIREMENTS_PATH = path.resolve(__dirname, '../../../.planning/formal/requirements.json');
const REQUIREMENTS_CORE_SRC = path.resolve(__dirname, '../../../bin/requirements-core.cjs');

test('SCHEMA-04: requirements.json exists and has requirements array', () => {
  assert.ok(fs.existsSync(REQUIREMENTS_PATH), 'requirements.json must exist');
  const data = JSON.parse(fs.readFileSync(REQUIREMENTS_PATH, 'utf8'));
  assert.ok(Array.isArray(data.requirements), 'must have requirements array');
  assert.ok(data.requirements.length > 0, 'must have at least one requirement');
});

test('SCHEMA-04: at least one requirement has formal_models array', () => {
  const data = JSON.parse(fs.readFileSync(REQUIREMENTS_PATH, 'utf8'));
  const withModels = data.requirements.filter(
    r => Array.isArray(r.formal_models) && r.formal_models.length > 0
  );
  assert.ok(withModels.length > 0, 'at least one requirement must have formal_models');
});

test('SCHEMA-04: formal_models entries are strings (model file paths)', () => {
  const data = JSON.parse(fs.readFileSync(REQUIREMENTS_PATH, 'utf8'));
  for (const r of data.requirements) {
    if (Array.isArray(r.formal_models)) {
      for (const modelPath of r.formal_models) {
        assert.equal(typeof modelPath, 'string',
          `formal_models in ${r.id} must contain strings`);
        assert.ok(modelPath.length > 0,
          `formal_models path in ${r.id} must not be empty`);
      }
    }
  }
});

test('SCHEMA-04: requirements-core.cjs handles formal_models field', () => {
  const content = fs.readFileSync(REQUIREMENTS_CORE_SRC, 'utf8');
  assert.match(content, /formal_models/,
    'requirements-core.cjs must reference formal_models');
  assert.match(content, /Array\.isArray\(r\.formal_models\)|Array\.isArray\(requirement\.formal_models\)/,
    'must validate formal_models is an array');
});
