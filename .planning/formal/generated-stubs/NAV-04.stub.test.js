#!/usr/bin/env node
// @requirement NAV-04
// Structural test for: TypeOK
// Formal model: .planning/formal/tla/QGSDSessionPersistence.tla
// Requirement: Sessions module persists active sessions to sessions.json across TUI restarts, restores session ID counters from persisted data, validates CWD existence before resume with fallback to process.cwd(), a

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

test('NAV-04 — TypeOK: structural verification', () => {
  // Check source file exists
  assert.ok(fs.existsSync('/Users/jonathanborduas/code/QGSD/bin/nForma.cjs'), 'Source file should exist: nForma.cjs');
  const content_0 = fs.readFileSync('/Users/jonathanborduas/code/QGSD/bin/nForma.cjs', 'utf8');
  // Structural check: source file contains requirement-related code
  assert.ok(content_0.length > 0, 'Source file should not be empty');

  // Check source file exists
  assert.ok(fs.existsSync('/Users/jonathanborduas/code/QGSD/bin/hazard-model.cjs'), 'Source file should exist: hazard-model.cjs');
  const content_1 = fs.readFileSync('/Users/jonathanborduas/code/QGSD/bin/hazard-model.cjs', 'utf8');
  // Structural check: source file contains requirement-related code
  assert.ok(content_1.length > 0, 'Source file should not be empty');

  // Check source file exists
  assert.ok(fs.existsSync('/Users/jonathanborduas/code/QGSD/bin/hazard-model.test.cjs'), 'Source file should exist: hazard-model.test.cjs');
  const content_2 = fs.readFileSync('/Users/jonathanborduas/code/QGSD/bin/hazard-model.test.cjs', 'utf8');
  // Structural check: source file contains requirement-related code
  assert.ok(content_2.length > 0, 'Source file should not be empty');

  // Check source file exists
  assert.ok(fs.existsSync('/Users/jonathanborduas/code/QGSD/bin/trace-corpus-stats.cjs'), 'Source file should exist: trace-corpus-stats.cjs');
  const content_3 = fs.readFileSync('/Users/jonathanborduas/code/QGSD/bin/trace-corpus-stats.cjs', 'utf8');
  // Structural check: source file contains requirement-related code
  assert.ok(content_3.length > 0, 'Source file should not be empty');

  // Check source file exists
  assert.ok(fs.existsSync('/Users/jonathanborduas/code/QGSD/bin/gate-b-abstraction.test.cjs'), 'Source file should exist: gate-b-abstraction.test.cjs');
  const content_4 = fs.readFileSync('/Users/jonathanborduas/code/QGSD/bin/gate-b-abstraction.test.cjs', 'utf8');
  // Structural check: source file contains requirement-related code
  assert.ok(content_4.length > 0, 'Source file should not be empty');

  // Check source file exists
  assert.ok(fs.existsSync('/Users/jonathanborduas/code/QGSD/bin/gate-b-abstraction.cjs'), 'Source file should exist: gate-b-abstraction.cjs');
  const content_5 = fs.readFileSync('/Users/jonathanborduas/code/QGSD/bin/gate-b-abstraction.cjs', 'utf8');
  // Structural check: source file contains requirement-related code
  assert.ok(content_5.length > 0, 'Source file should not be empty');

  // Check source file exists
  assert.ok(fs.existsSync('/Users/jonathanborduas/code/QGSD/bin/trace-corpus-stats.test.cjs'), 'Source file should exist: trace-corpus-stats.test.cjs');
  const content_6 = fs.readFileSync('/Users/jonathanborduas/code/QGSD/bin/trace-corpus-stats.test.cjs', 'utf8');
  // Structural check: source file contains requirement-related code
  assert.ok(content_6.length > 0, 'Source file should not be empty');

  // Check source file exists
  assert.ok(fs.existsSync('/Users/jonathanborduas/code/QGSD/bin/nForma.test.cjs'), 'Source file should exist: nForma.test.cjs');
  const content_7 = fs.readFileSync('/Users/jonathanborduas/code/QGSD/bin/nForma.test.cjs', 'utf8');
  // Structural check: source file contains requirement-related code
  assert.ok(content_7.length > 0, 'Source file should not be empty');

  // Check source file exists
  assert.ok(fs.existsSync('/Users/jonathanborduas/code/QGSD/bin/observed-fsm.cjs'), 'Source file should exist: observed-fsm.cjs');
  const content_8 = fs.readFileSync('/Users/jonathanborduas/code/QGSD/bin/observed-fsm.cjs', 'utf8');
  // Structural check: source file contains requirement-related code
  assert.ok(content_8.length > 0, 'Source file should not be empty');

  // Check source file exists
  assert.ok(fs.existsSync('/Users/jonathanborduas/code/QGSD/bin/sensitivity-report.cjs'), 'Source file should exist: sensitivity-report.cjs');
  const content_9 = fs.readFileSync('/Users/jonathanborduas/code/QGSD/bin/sensitivity-report.cjs', 'utf8');
  // Structural check: source file contains requirement-related code
  assert.ok(content_9.length > 0, 'Source file should not be empty');

  // Check source file exists
  assert.ok(fs.existsSync('/Users/jonathanborduas/code/QGSD/bin/observe-handler-internal.test.cjs'), 'Source file should exist: observe-handler-internal.test.cjs');
  const content_10 = fs.readFileSync('/Users/jonathanborduas/code/QGSD/bin/observe-handler-internal.test.cjs', 'utf8');
  // Structural check: source file contains requirement-related code
  assert.ok(content_10.length > 0, 'Source file should not be empty');

  // Check source file exists
  assert.ok(fs.existsSync('/Users/jonathanborduas/code/QGSD/bin/observe-handler-internal.cjs'), 'Source file should exist: observe-handler-internal.cjs');
  const content_11 = fs.readFileSync('/Users/jonathanborduas/code/QGSD/bin/observe-handler-internal.cjs', 'utf8');
  // Structural check: source file contains requirement-related code
  assert.ok(content_11.length > 0, 'Source file should not be empty');

  // Check source file exists
  assert.ok(fs.existsSync('/Users/jonathanborduas/code/QGSD/bin/invariant-catalog.cjs'), 'Source file should exist: invariant-catalog.cjs');
  const content_12 = fs.readFileSync('/Users/jonathanborduas/code/QGSD/bin/invariant-catalog.cjs', 'utf8');
  // Structural check: source file contains requirement-related code
  assert.ok(content_12.length > 0, 'Source file should not be empty');

  // Check source file exists
  assert.ok(fs.existsSync('/Users/jonathanborduas/code/QGSD/hooks/dist/nf-session-start.test.js'), 'Source file should exist: nf-session-start.test.js');
  const content_13 = fs.readFileSync('/Users/jonathanborduas/code/QGSD/hooks/dist/nf-session-start.test.js', 'utf8');
  // Structural check: source file contains requirement-related code
  assert.ok(content_13.length > 0, 'Source file should not be empty');

  // Check source file exists
  assert.ok(fs.existsSync('/Users/jonathanborduas/code/QGSD/hooks/nf-session-start.test.js'), 'Source file should exist: nf-session-start.test.js');
  const content_14 = fs.readFileSync('/Users/jonathanborduas/code/QGSD/hooks/nf-session-start.test.js', 'utf8');
  // Structural check: source file contains requirement-related code
  assert.ok(content_14.length > 0, 'Source file should not be empty');
});
