#!/usr/bin/env node
// @requirement OBS-06
// Structural test: observe-handler-internal scans local project state for
// unfinished quick tasks, stale debug sessions, and unverified milestone phases

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const handlerPath = path.resolve(__dirname, '../../../bin/observe-handler-internal.cjs');
const handlerSrc = fs.readFileSync(handlerPath, 'utf8');

test('OBS-06: handleInternal is exported', () => {
  const mod = require(handlerPath);
  assert.equal(typeof mod.handleInternal, 'function');
});

test('OBS-06: scans for unfinished quick tasks (PLAN without SUMMARY)', () => {
  // Category 1: unfinished quick tasks detection
  assert.match(handlerSrc, /PLAN\.md/);
  assert.match(handlerSrc, /SUMMARY\.md/);
  assert.match(handlerSrc, /Unfinished quick task/);
});

test('OBS-06: scans for stale debug sessions', () => {
  // Category 2: stale debug sessions detection
  assert.match(handlerSrc, /quorum-debug-latest/);
});

test('OBS-06: scans for unverified milestone phases', () => {
  // Category 4: active milestone phases without verification
  assert.match(handlerSrc, /VERIFICATION\.md|VALIDATION\.md|unverified/i);
});

test('OBS-06: returns standard observe schema with issues array', () => {
  // The handler returns { source_label, source_type, status, issues[] }
  assert.match(handlerSrc, /source_label/);
  assert.match(handlerSrc, /source_type/);
  assert.match(handlerSrc, /issues/);
  assert.match(handlerSrc, /status/);
});

test('OBS-06: requires no configuration (always-on)', () => {
  // Handler uses projectRoot with cwd() default, no config required
  assert.match(handlerSrc, /process\.cwd\(\)/);
  // Default label shows it works without configuration
  assert.match(handlerSrc, /Internal Work/);
});
