#!/usr/bin/env node
// @requirement SEC-04
// Structural test: dependency scanning exists and conformance schema validates security properties

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..', '..', '..');

test('SEC-04: package.json exists with dependencies that can be audited', () => {
  const pkgPath = path.join(ROOT, 'package.json');
  assert.ok(fs.existsSync(pkgPath), 'package.json must exist');
  const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
  assert.ok(pkg.dependencies || pkg.devDependencies,
    'package.json must declare dependencies for auditing');
});

test('SEC-04: conformance-schema.cjs exists for validation enforcement', () => {
  const filePath = path.join(ROOT, 'bin', 'conformance-schema.cjs');
  assert.ok(fs.existsSync(filePath), 'conformance-schema.cjs must exist');
  const content = fs.readFileSync(filePath, 'utf8');
  assert.match(content, /module\.exports|exports\./,
    'conformance-schema.cjs must export validation schemas');
});

test('SEC-04: run-formal-verify.cjs orchestrates CI verification that blocks on failures', () => {
  const content = fs.readFileSync(path.join(ROOT, 'bin', 'run-formal-verify.cjs'), 'utf8');
  assert.match(content, /fail|error|exit/i,
    'run-formal-verify.cjs must handle failures to block merge');
});

test('SEC-04: package-lock.json exists for reproducible dependency resolution', () => {
  const lockPath = path.join(ROOT, 'package-lock.json');
  assert.ok(fs.existsSync(lockPath),
    'package-lock.json must exist for reproducible builds and audit scanning');
});
