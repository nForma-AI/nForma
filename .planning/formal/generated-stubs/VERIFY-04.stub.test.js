#!/usr/bin/env node
// @requirement VERIFY-04
// Structural test: JVM-spawning runners include -Xms64m and -Xmx heap flags,
// default to 512MB via NF_JAVA_HEAP_MAX env var, and run-formal-verify.cjs
// runs tool groups sequentially by default with --concurrent opt-in.

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..', '..', '..');

test('VERIFY-04: run-formal-verify.cjs defaults to sequential and supports --concurrent opt-in', () => {
  const src = fs.readFileSync(path.join(ROOT, 'bin', 'run-formal-verify.cjs'), 'utf8');
  // Sequential by default
  assert.match(src, /sequential/, 'should mention sequential as default mode');
  // --concurrent opt-in flag
  assert.match(src, /--concurrent/, 'should support --concurrent flag');
  // Reads NF_FORMAL_CONCURRENT env var
  assert.match(src, /NF_FORMAL_CONCURRENT/, 'should read NF_FORMAL_CONCURRENT env var');
});

test('VERIFY-04: run-alloy.cjs includes -Xms64m and -Xmx heap flags with 512m default', () => {
  const src = fs.readFileSync(path.join(ROOT, 'bin', 'run-alloy.cjs'), 'utf8');
  assert.match(src, /-Xms64m/, 'should include -Xms64m flag');
  assert.match(src, /-Xmx/, 'should include -Xmx flag');
  assert.match(src, /NF_JAVA_HEAP_MAX/, 'should read NF_JAVA_HEAP_MAX env var');
  assert.match(src, /512m/, 'should default heap to 512m');
});

test('VERIFY-04: TLC runners include -Xms64m and -Xmx heap flags', () => {
  const src = fs.readFileSync(path.join(ROOT, 'bin', 'run-stop-hook-tlc.cjs'), 'utf8');
  assert.match(src, /-Xms64m/, 'should include -Xms64m flag');
  assert.match(src, /-Xmx/, 'should include -Xmx flag');
  assert.match(src, /NF_JAVA_HEAP_MAX/, 'should read NF_JAVA_HEAP_MAX env var');
});
