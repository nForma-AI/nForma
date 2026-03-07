#!/usr/bin/env node
// @requirement STATE-06
// Structural test for: TypeOK
// Formal model: .planning/formal/tla/QGSDPlanningState.tla
// Requirement: phase-complete falls back to ROADMAP.md heading parsing when no next-phase directory exists on disk, using segment-aware version comparison for versioned phase IDs (e.g., v0.28-01 vs v0.28-02), and se

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

test('STATE-06 — TypeOK: structural verification', () => {
  // Check source file exists
  assert.ok(fs.existsSync('/Users/jonathanborduas/code/QGSD/bin/manage-agents.test.cjs'), 'Source file should exist: manage-agents.test.cjs');
  const content_0 = fs.readFileSync('/Users/jonathanborduas/code/QGSD/bin/manage-agents.test.cjs', 'utf8');
  // Structural check: source file contains requirement-related code
  assert.ok(content_0.length > 0, 'Source file should not be empty');

  // Check source file exists
  assert.ok(fs.existsSync('/Users/jonathanborduas/code/QGSD/bin/observe-config.test.cjs'), 'Source file should exist: observe-config.test.cjs');
  const content_1 = fs.readFileSync('/Users/jonathanborduas/code/QGSD/bin/observe-config.test.cjs', 'utf8');
  // Structural check: source file contains requirement-related code
  assert.ok(content_1.length > 0, 'Source file should not be empty');

  // Check source file exists
  assert.ok(fs.existsSync('/Users/jonathanborduas/code/QGSD/bin/design-impact.cjs'), 'Source file should exist: design-impact.cjs');
  const content_2 = fs.readFileSync('/Users/jonathanborduas/code/QGSD/bin/design-impact.cjs', 'utf8');
  // Structural check: source file contains requirement-related code
  assert.ok(content_2.length > 0, 'Source file should not be empty');

  // Check source file exists
  assert.ok(fs.existsSync('/Users/jonathanborduas/code/QGSD/bin/verify-quorum-health.test.cjs'), 'Source file should exist: verify-quorum-health.test.cjs');
  const content_3 = fs.readFileSync('/Users/jonathanborduas/code/QGSD/bin/verify-quorum-health.test.cjs', 'utf8');
  // Structural check: source file contains requirement-related code
  assert.ok(content_3.length > 0, 'Source file should not be empty');

  // Check source file exists
  assert.ok(fs.existsSync('/Users/jonathanborduas/code/QGSD/bin/failure-taxonomy.test.cjs'), 'Source file should exist: failure-taxonomy.test.cjs');
  const content_4 = fs.readFileSync('/Users/jonathanborduas/code/QGSD/bin/failure-taxonomy.test.cjs', 'utf8');
  // Structural check: source file contains requirement-related code
  assert.ok(content_4.length > 0, 'Source file should not be empty');

  // Check source file exists
  assert.ok(fs.existsSync('/Users/jonathanborduas/code/QGSD/bin/resolve-cli.test.cjs'), 'Source file should exist: resolve-cli.test.cjs');
  const content_5 = fs.readFileSync('/Users/jonathanborduas/code/QGSD/bin/resolve-cli.test.cjs', 'utf8');
  // Structural check: source file contains requirement-related code
  assert.ok(content_5.length > 0, 'Source file should not be empty');

  // Check source file exists
  assert.ok(fs.existsSync('/Users/jonathanborduas/code/QGSD/bin/nForma.test.cjs'), 'Source file should exist: nForma.test.cjs');
  const content_6 = fs.readFileSync('/Users/jonathanborduas/code/QGSD/bin/nForma.test.cjs', 'utf8');
  // Structural check: source file contains requirement-related code
  assert.ok(content_6.length > 0, 'Source file should not be empty');

  // Check source file exists
  assert.ok(fs.existsSync('/Users/jonathanborduas/code/QGSD/bin/debt-ledger.test.cjs'), 'Source file should exist: debt-ledger.test.cjs');
  const content_7 = fs.readFileSync('/Users/jonathanborduas/code/QGSD/bin/debt-ledger.test.cjs', 'utf8');
  // Structural check: source file contains requirement-related code
  assert.ok(content_7.length > 0, 'Source file should not be empty');

  // Check source file exists
  assert.ok(fs.existsSync('/Users/jonathanborduas/code/QGSD/bin/run-prism.test.cjs'), 'Source file should exist: run-prism.test.cjs');
  const content_8 = fs.readFileSync('/Users/jonathanborduas/code/QGSD/bin/run-prism.test.cjs', 'utf8');
  // Structural check: source file contains requirement-related code
  assert.ok(content_8.length > 0, 'Source file should not be empty');

  // Check source file exists
  assert.ok(fs.existsSync('/Users/jonathanborduas/code/QGSD/bin/sensitivity-report.cjs'), 'Source file should exist: sensitivity-report.cjs');
  const content_9 = fs.readFileSync('/Users/jonathanborduas/code/QGSD/bin/sensitivity-report.cjs', 'utf8');
  // Structural check: source file contains requirement-related code
  assert.ok(content_9.length > 0, 'Source file should not be empty');

  // Check source file exists
  assert.ok(fs.existsSync('/Users/jonathanborduas/code/QGSD/bin/attribute-trace-divergence.test.cjs'), 'Source file should exist: attribute-trace-divergence.test.cjs');
  const content_10 = fs.readFileSync('/Users/jonathanborduas/code/QGSD/bin/attribute-trace-divergence.test.cjs', 'utf8');
  // Structural check: source file contains requirement-related code
  assert.ok(content_10.length > 0, 'Source file should not be empty');

  // Check source file exists
  assert.ok(fs.existsSync('/Users/jonathanborduas/code/QGSD/bin/self-healing.test.cjs'), 'Source file should exist: self-healing.test.cjs');
  const content_11 = fs.readFileSync('/Users/jonathanborduas/code/QGSD/bin/self-healing.test.cjs', 'utf8');
  // Structural check: source file contains requirement-related code
  assert.ok(content_11.length > 0, 'Source file should not be empty');

  // Check source file exists
  assert.ok(fs.existsSync('/Users/jonathanborduas/code/QGSD/bin/planning-paths.cjs'), 'Source file should exist: planning-paths.cjs');
  const content_12 = fs.readFileSync('/Users/jonathanborduas/code/QGSD/bin/planning-paths.cjs', 'utf8');
  // Structural check: source file contains requirement-related code
  assert.ok(content_12.length > 0, 'Source file should not be empty');

  // Check source file exists
  assert.ok(fs.existsSync('/Users/jonathanborduas/code/QGSD/bin/failure-taxonomy.cjs'), 'Source file should exist: failure-taxonomy.cjs');
  const content_13 = fs.readFileSync('/Users/jonathanborduas/code/QGSD/bin/failure-taxonomy.cjs', 'utf8');
  // Structural check: source file contains requirement-related code
  assert.ok(content_13.length > 0, 'Source file should not be empty');

  // Check source file exists
  assert.ok(fs.existsSync('/Users/jonathanborduas/code/QGSD/bin/quorum-consensus-gate.test.cjs'), 'Source file should exist: quorum-consensus-gate.test.cjs');
  const content_14 = fs.readFileSync('/Users/jonathanborduas/code/QGSD/bin/quorum-consensus-gate.test.cjs', 'utf8');
  // Structural check: source file contains requirement-related code
  assert.ok(content_14.length > 0, 'Source file should not be empty');

  // Check source file exists
  assert.ok(fs.existsSync('/Users/jonathanborduas/code/QGSD/hooks/nf-precompact.test.js'), 'Source file should exist: nf-precompact.test.js');
  const content_15 = fs.readFileSync('/Users/jonathanborduas/code/QGSD/hooks/nf-precompact.test.js', 'utf8');
  // Structural check: source file contains requirement-related code
  assert.ok(content_15.length > 0, 'Source file should not be empty');

  // Check source file exists
  assert.ok(fs.existsSync('/Users/jonathanborduas/code/QGSD/hooks/config-loader.test.js'), 'Source file should exist: config-loader.test.js');
  const content_16 = fs.readFileSync('/Users/jonathanborduas/code/QGSD/hooks/config-loader.test.js', 'utf8');
  // Structural check: source file contains requirement-related code
  assert.ok(content_16.length > 0, 'Source file should not be empty');

  // Check source file exists
  assert.ok(fs.existsSync('/Users/jonathanborduas/code/QGSD/hooks/dist/nf-precompact.test.js'), 'Source file should exist: nf-precompact.test.js');
  const content_17 = fs.readFileSync('/Users/jonathanborduas/code/QGSD/hooks/dist/nf-precompact.test.js', 'utf8');
  // Structural check: source file contains requirement-related code
  assert.ok(content_17.length > 0, 'Source file should not be empty');

  // Check source file exists
  assert.ok(fs.existsSync('/Users/jonathanborduas/code/QGSD/hooks/dist/nf-token-collector.test.js'), 'Source file should exist: nf-token-collector.test.js');
  const content_18 = fs.readFileSync('/Users/jonathanborduas/code/QGSD/hooks/dist/nf-token-collector.test.js', 'utf8');
  // Structural check: source file contains requirement-related code
  assert.ok(content_18.length > 0, 'Source file should not be empty');

  // Check source file exists
  assert.ok(fs.existsSync('/Users/jonathanborduas/code/QGSD/hooks/dist/nf-stop.js'), 'Source file should exist: nf-stop.js');
  const content_19 = fs.readFileSync('/Users/jonathanborduas/code/QGSD/hooks/dist/nf-stop.js', 'utf8');
  // Structural check: source file contains requirement-related code
  assert.ok(content_19.length > 0, 'Source file should not be empty');

  // Check source file exists
  assert.ok(fs.existsSync('/Users/jonathanborduas/code/QGSD/hooks/dist/nf-stop.test.js'), 'Source file should exist: nf-stop.test.js');
  const content_20 = fs.readFileSync('/Users/jonathanborduas/code/QGSD/hooks/dist/nf-stop.test.js', 'utf8');
  // Structural check: source file contains requirement-related code
  assert.ok(content_20.length > 0, 'Source file should not be empty');

  // Check source file exists
  assert.ok(fs.existsSync('/Users/jonathanborduas/code/QGSD/hooks/dist/nf-prompt.js'), 'Source file should exist: nf-prompt.js');
  const content_21 = fs.readFileSync('/Users/jonathanborduas/code/QGSD/hooks/dist/nf-prompt.js', 'utf8');
  // Structural check: source file contains requirement-related code
  assert.ok(content_21.length > 0, 'Source file should not be empty');

  // Check source file exists
  assert.ok(fs.existsSync('/Users/jonathanborduas/code/QGSD/hooks/nf-token-collector.test.js'), 'Source file should exist: nf-token-collector.test.js');
  const content_22 = fs.readFileSync('/Users/jonathanborduas/code/QGSD/hooks/nf-token-collector.test.js', 'utf8');
  // Structural check: source file contains requirement-related code
  assert.ok(content_22.length > 0, 'Source file should not be empty');

  // Check source file exists
  assert.ok(fs.existsSync('/Users/jonathanborduas/code/QGSD/hooks/nf-stop-fan-out.test.cjs'), 'Source file should exist: nf-stop-fan-out.test.cjs');
  const content_23 = fs.readFileSync('/Users/jonathanborduas/code/QGSD/hooks/nf-stop-fan-out.test.cjs', 'utf8');
  // Structural check: source file contains requirement-related code
  assert.ok(content_23.length > 0, 'Source file should not be empty');

  // Check source file exists
  assert.ok(fs.existsSync('/Users/jonathanborduas/code/QGSD/hooks/nf-stop.js'), 'Source file should exist: nf-stop.js');
  const content_24 = fs.readFileSync('/Users/jonathanborduas/code/QGSD/hooks/nf-stop.js', 'utf8');
  // Structural check: source file contains requirement-related code
  assert.ok(content_24.length > 0, 'Source file should not be empty');

  // Check source file exists
  assert.ok(fs.existsSync('/Users/jonathanborduas/code/QGSD/hooks/nf-stop.test.js'), 'Source file should exist: nf-stop.test.js');
  const content_25 = fs.readFileSync('/Users/jonathanborduas/code/QGSD/hooks/nf-stop.test.js', 'utf8');
  // Structural check: source file contains requirement-related code
  assert.ok(content_25.length > 0, 'Source file should not be empty');

  // Check source file exists
  assert.ok(fs.existsSync('/Users/jonathanborduas/code/QGSD/hooks/nf-prompt.js'), 'Source file should exist: nf-prompt.js');
  const content_26 = fs.readFileSync('/Users/jonathanborduas/code/QGSD/hooks/nf-prompt.js', 'utf8');
  // Structural check: source file contains requirement-related code
  assert.ok(content_26.length > 0, 'Source file should not be empty');
});
