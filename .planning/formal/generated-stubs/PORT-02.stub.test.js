#!/usr/bin/env node
// @requirement PORT-02
// Formal property: StartImport — import validates schema, prompts for redacted keys

const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

const { _pure } = require(path.resolve(__dirname, '..', '..', '..', 'bin', 'manage-agents-core.cjs'));
const { validateImportSchema } = _pure;

test('PORT-02: validateImportSchema exists as a function', () => {
  assert.equal(typeof validateImportSchema, 'function');
});

test('PORT-02: validateImportSchema rejects non-object root', () => {
  const errors = validateImportSchema(null);
  assert.ok(errors.length > 0, 'should return errors for null input');
  assert.ok(errors.some(e => /root|object/i.test(e)), 'should mention root must be object');
});

test('PORT-02: validateImportSchema accepts valid structure', () => {
  const valid = {
    mcpServers: {
      'slot-1': { command: 'node', args: ['server.mjs'] },
    },
  };
  const errors = validateImportSchema(valid);
  assert.equal(errors.length, 0, 'valid import should have no errors');
});

test('PORT-02: validateImportSchema rejects invalid command', () => {
  const invalid = {
    mcpServers: {
      'slot-1': { command: 'python', args: ['/Users/test/server.py'] },
    },
  };
  const errors = validateImportSchema(invalid);
  assert.ok(errors.length > 0, 'should reject disallowed command');
});
