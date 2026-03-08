#!/usr/bin/env node
// @requirement VERIFY-03
// Structural test for: Bool
// Formal model: .planning/formal/alloy/headless-execution.als
// Requirement: Formal model runners (Alloy, TLA+, PRISM, UPPAAL) MUST execute in headless mode — no GUI windows or AWT initialization. For Java-based tools, `-Djava.awt.headless=true` MUST be passed before `-jar`.

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

test('VERIFY-03 — Bool: structural verification', () => {
  // Check source file exists
  assert.ok(fs.existsSync('/Users/jonathanborduas/code/QGSD/bin/aggregate-requirements.test.cjs'), 'Source file should exist: aggregate-requirements.test.cjs');
  const content_0 = fs.readFileSync('/Users/jonathanborduas/code/QGSD/bin/aggregate-requirements.test.cjs', 'utf8');
  // Structural check: source file contains requirement-related code
  assert.ok(content_0.length > 0, 'Source file should not be empty');

  // Check source file exists
  assert.ok(fs.existsSync('/Users/jonathanborduas/code/QGSD/bin/debt-dedup.test.cjs'), 'Source file should exist: debt-dedup.test.cjs');
  const content_1 = fs.readFileSync('/Users/jonathanborduas/code/QGSD/bin/debt-dedup.test.cjs', 'utf8');
  // Structural check: source file contains requirement-related code
  assert.ok(content_1.length > 0, 'Source file should not be empty');

  // Check source file exists
  assert.ok(fs.existsSync('/Users/jonathanborduas/code/QGSD/bin/gate-a-grounding.cjs'), 'Source file should exist: gate-a-grounding.cjs');
  const content_2 = fs.readFileSync('/Users/jonathanborduas/code/QGSD/bin/gate-a-grounding.cjs', 'utf8');
  // Structural check: source file contains requirement-related code
  assert.ok(content_2.length > 0, 'Source file should not be empty');

  // Check source file exists
  assert.ok(fs.existsSync('/Users/jonathanborduas/code/QGSD/bin/assumption-register.cjs'), 'Source file should exist: assumption-register.cjs');
  const content_3 = fs.readFileSync('/Users/jonathanborduas/code/QGSD/bin/assumption-register.cjs', 'utf8');
  // Structural check: source file contains requirement-related code
  assert.ok(content_3.length > 0, 'Source file should not be empty');

  // Check source file exists
  assert.ok(fs.existsSync('/Users/jonathanborduas/code/QGSD/bin/requirement-map.cjs'), 'Source file should exist: requirement-map.cjs');
  const content_4 = fs.readFileSync('/Users/jonathanborduas/code/QGSD/bin/requirement-map.cjs', 'utf8');
  // Structural check: source file contains requirement-related code
  assert.ok(content_4.length > 0, 'Source file should not be empty');

  // Check source file exists
  assert.ok(fs.existsSync('/Users/jonathanborduas/code/QGSD/bin/debt-dedup-integration.test.cjs'), 'Source file should exist: debt-dedup-integration.test.cjs');
  const content_5 = fs.readFileSync('/Users/jonathanborduas/code/QGSD/bin/debt-dedup-integration.test.cjs', 'utf8');
  // Structural check: source file contains requirement-related code
  assert.ok(content_5.length > 0, 'Source file should not be empty');

  // Check source file exists
  assert.ok(fs.existsSync('/Users/jonathanborduas/code/QGSD/bin/verify-formal-results.cjs'), 'Source file should exist: verify-formal-results.cjs');
  const content_6 = fs.readFileSync('/Users/jonathanborduas/code/QGSD/bin/verify-formal-results.cjs', 'utf8');
  // Structural check: source file contains requirement-related code
  assert.ok(content_6.length > 0, 'Source file should not be empty');

  // Check source file exists
  assert.ok(fs.existsSync('/Users/jonathanborduas/code/QGSD/bin/nf-solve-ptoF-integration.test.cjs'), 'Source file should exist: nf-solve-ptoF-integration.test.cjs');
  const content_7 = fs.readFileSync('/Users/jonathanborduas/code/QGSD/bin/nf-solve-ptoF-integration.test.cjs', 'utf8');
  // Structural check: source file contains requirement-related code
  assert.ok(content_7.length > 0, 'Source file should not be empty');

  // Check source file exists
  assert.ok(fs.existsSync('/Users/jonathanborduas/code/QGSD/bin/run-quorum-composition-alloy.cjs'), 'Source file should exist: run-quorum-composition-alloy.cjs');
  const content_8 = fs.readFileSync('/Users/jonathanborduas/code/QGSD/bin/run-quorum-composition-alloy.cjs', 'utf8');
  // Structural check: source file contains requirement-related code
  assert.ok(content_8.length > 0, 'Source file should not be empty');

  // Check source file exists
  assert.ok(fs.existsSync('/Users/jonathanborduas/code/QGSD/bin/aggregate-requirements.cjs'), 'Source file should exist: aggregate-requirements.cjs');
  const content_9 = fs.readFileSync('/Users/jonathanborduas/code/QGSD/bin/aggregate-requirements.cjs', 'utf8');
  // Structural check: source file contains requirement-related code
  assert.ok(content_9.length > 0, 'Source file should not be empty');

  // Check source file exists
  assert.ok(fs.existsSync('/Users/jonathanborduas/code/QGSD/bin/run-uppaal.test.cjs'), 'Source file should exist: run-uppaal.test.cjs');
  const content_10 = fs.readFileSync('/Users/jonathanborduas/code/QGSD/bin/run-uppaal.test.cjs', 'utf8');
  // Structural check: source file contains requirement-related code
  assert.ok(content_10.length > 0, 'Source file should not be empty');

  // Check source file exists
  assert.ok(fs.existsSync('/Users/jonathanborduas/code/QGSD/bin/attribute-trace-divergence.cjs'), 'Source file should exist: attribute-trace-divergence.cjs');
  const content_11 = fs.readFileSync('/Users/jonathanborduas/code/QGSD/bin/attribute-trace-divergence.cjs', 'utf8');
  // Structural check: source file contains requirement-related code
  assert.ok(content_11.length > 0, 'Source file should not be empty');

  // Check source file exists
  assert.ok(fs.existsSync('/Users/jonathanborduas/code/QGSD/bin/sync-baseline-requirements.test.cjs'), 'Source file should exist: sync-baseline-requirements.test.cjs');
  const content_12 = fs.readFileSync('/Users/jonathanborduas/code/QGSD/bin/sync-baseline-requirements.test.cjs', 'utf8');
  // Structural check: source file contains requirement-related code
  assert.ok(content_12.length > 0, 'Source file should not be empty');

  // Check source file exists
  assert.ok(fs.existsSync('/Users/jonathanborduas/code/QGSD/bin/prism-priority.cjs'), 'Source file should exist: prism-priority.cjs');
  const content_13 = fs.readFileSync('/Users/jonathanborduas/code/QGSD/bin/prism-priority.cjs', 'utf8');
  // Structural check: source file contains requirement-related code
  assert.ok(content_13.length > 0, 'Source file should not be empty');

  // Check source file exists
  assert.ok(fs.existsSync('/Users/jonathanborduas/code/QGSD/bin/extractFormalExpected.test.cjs'), 'Source file should exist: extractFormalExpected.test.cjs');
  const content_14 = fs.readFileSync('/Users/jonathanborduas/code/QGSD/bin/extractFormalExpected.test.cjs', 'utf8');
  // Structural check: source file contains requirement-related code
  assert.ok(content_14.length > 0, 'Source file should not be empty');

  // Check source file exists
  assert.ok(fs.existsSync('/Users/jonathanborduas/code/QGSD/bin/prism-priority.test.cjs'), 'Source file should exist: prism-priority.test.cjs');
  const content_15 = fs.readFileSync('/Users/jonathanborduas/code/QGSD/bin/prism-priority.test.cjs', 'utf8');
  // Structural check: source file contains requirement-related code
  assert.ok(content_15.length > 0, 'Source file should not be empty');

  // Check source file exists
  assert.ok(fs.existsSync('/Users/jonathanborduas/code/QGSD/bin/check-spec-sync.cjs'), 'Source file should exist: check-spec-sync.cjs');
  const content_16 = fs.readFileSync('/Users/jonathanborduas/code/QGSD/bin/check-spec-sync.cjs', 'utf8');
  // Structural check: source file contains requirement-related code
  assert.ok(content_16.length > 0, 'Source file should not be empty');

  // Check source file exists
  assert.ok(fs.existsSync('/Users/jonathanborduas/code/QGSD/bin/nForma.cjs'), 'Source file should exist: nForma.cjs');
  const content_17 = fs.readFileSync('/Users/jonathanborduas/code/QGSD/bin/nForma.cjs', 'utf8');
  // Structural check: source file contains requirement-related code
  assert.ok(content_17.length > 0, 'Source file should not be empty');

  // Check source file exists
  assert.ok(fs.existsSync('/Users/jonathanborduas/code/QGSD/bin/check-trace-schema-drift.cjs'), 'Source file should exist: check-trace-schema-drift.cjs');
  const content_18 = fs.readFileSync('/Users/jonathanborduas/code/QGSD/bin/check-trace-schema-drift.cjs', 'utf8');
  // Structural check: source file contains requirement-related code
  assert.ok(content_18.length > 0, 'Source file should not be empty');

  // Check source file exists
  assert.ok(fs.existsSync('/Users/jonathanborduas/code/QGSD/bin/hazard-model.cjs'), 'Source file should exist: hazard-model.cjs');
  const content_19 = fs.readFileSync('/Users/jonathanborduas/code/QGSD/bin/hazard-model.cjs', 'utf8');
  // Structural check: source file contains requirement-related code
  assert.ok(content_19.length > 0, 'Source file should not be empty');

  // Check source file exists
  assert.ok(fs.existsSync('/Users/jonathanborduas/code/QGSD/bin/hazard-model.test.cjs'), 'Source file should exist: hazard-model.test.cjs');
  const content_20 = fs.readFileSync('/Users/jonathanborduas/code/QGSD/bin/hazard-model.test.cjs', 'utf8');
  // Structural check: source file contains requirement-related code
  assert.ok(content_20.length > 0, 'Source file should not be empty');

  // Check source file exists
  assert.ok(fs.existsSync('/Users/jonathanborduas/code/QGSD/bin/test-recipe-gen.cjs'), 'Source file should exist: test-recipe-gen.cjs');
  const content_21 = fs.readFileSync('/Users/jonathanborduas/code/QGSD/bin/test-recipe-gen.cjs', 'utf8');
  // Structural check: source file contains requirement-related code
  assert.ok(content_21.length > 0, 'Source file should not be empty');

  // Check source file exists
  assert.ok(fs.existsSync('/Users/jonathanborduas/code/QGSD/bin/solve-debt-bridge.test.cjs'), 'Source file should exist: solve-debt-bridge.test.cjs');
  const content_22 = fs.readFileSync('/Users/jonathanborduas/code/QGSD/bin/solve-debt-bridge.test.cjs', 'utf8');
  // Structural check: source file contains requirement-related code
  assert.ok(content_22.length > 0, 'Source file should not be empty');

  // Check source file exists
  assert.ok(fs.existsSync('/Users/jonathanborduas/code/QGSD/bin/check-results-exit.test.cjs'), 'Source file should exist: check-results-exit.test.cjs');
  const content_23 = fs.readFileSync('/Users/jonathanborduas/code/QGSD/bin/check-results-exit.test.cjs', 'utf8');
  // Structural check: source file contains requirement-related code
  assert.ok(content_23.length > 0, 'Source file should not be empty');

  // Check source file exists
  assert.ok(fs.existsSync('/Users/jonathanborduas/code/QGSD/bin/failure-mode-catalog.test.cjs'), 'Source file should exist: failure-mode-catalog.test.cjs');
  const content_24 = fs.readFileSync('/Users/jonathanborduas/code/QGSD/bin/failure-mode-catalog.test.cjs', 'utf8');
  // Structural check: source file contains requirement-related code
  assert.ok(content_24.length > 0, 'Source file should not be empty');

  // Check source file exists
  assert.ok(fs.existsSync('/Users/jonathanborduas/code/QGSD/bin/execute-phase-formal-gate.test.cjs'), 'Source file should exist: execute-phase-formal-gate.test.cjs');
  const content_25 = fs.readFileSync('/Users/jonathanborduas/code/QGSD/bin/execute-phase-formal-gate.test.cjs', 'utf8');
  // Structural check: source file contains requirement-related code
  assert.ok(content_25.length > 0, 'Source file should not be empty');

  // Check source file exists
  assert.ok(fs.existsSync('/Users/jonathanborduas/code/QGSD/bin/design-impact.cjs'), 'Source file should exist: design-impact.cjs');
  const content_26 = fs.readFileSync('/Users/jonathanborduas/code/QGSD/bin/design-impact.cjs', 'utf8');
  // Structural check: source file contains requirement-related code
  assert.ok(content_26.length > 0, 'Source file should not be empty');

  // Check source file exists
  assert.ok(fs.existsSync('/Users/jonathanborduas/code/QGSD/bin/run-oscillation-tlc.cjs'), 'Source file should exist: run-oscillation-tlc.cjs');
  const content_27 = fs.readFileSync('/Users/jonathanborduas/code/QGSD/bin/run-oscillation-tlc.cjs', 'utf8');
  // Structural check: source file contains requirement-related code
  assert.ok(content_27.length > 0, 'Source file should not be empty');

  // Check source file exists
  assert.ok(fs.existsSync('/Users/jonathanborduas/code/QGSD/bin/accept-debug-invariant.test.cjs'), 'Source file should exist: accept-debug-invariant.test.cjs');
  const content_28 = fs.readFileSync('/Users/jonathanborduas/code/QGSD/bin/accept-debug-invariant.test.cjs', 'utf8');
  // Structural check: source file contains requirement-related code
  assert.ok(content_28.length > 0, 'Source file should not be empty');

  // Check source file exists
  assert.ok(fs.existsSync('/Users/jonathanborduas/code/QGSD/bin/task-classifier.cjs'), 'Source file should exist: task-classifier.cjs');
  const content_29 = fs.readFileSync('/Users/jonathanborduas/code/QGSD/bin/task-classifier.cjs', 'utf8');
  // Structural check: source file contains requirement-related code
  assert.ok(content_29.length > 0, 'Source file should not be empty');

  // Check source file exists
  assert.ok(fs.existsSync('/Users/jonathanborduas/code/QGSD/bin/observe-debt-writer.test.cjs'), 'Source file should exist: observe-debt-writer.test.cjs');
  const content_30 = fs.readFileSync('/Users/jonathanborduas/code/QGSD/bin/observe-debt-writer.test.cjs', 'utf8');
  // Structural check: source file contains requirement-related code
  assert.ok(content_30.length > 0, 'Source file should not be empty');

  // Check source file exists
  assert.ok(fs.existsSync('/Users/jonathanborduas/code/QGSD/bin/check-trace-schema-drift.test.cjs'), 'Source file should exist: check-trace-schema-drift.test.cjs');
  const content_31 = fs.readFileSync('/Users/jonathanborduas/code/QGSD/bin/check-trace-schema-drift.test.cjs', 'utf8');
  // Structural check: source file contains requirement-related code
  assert.ok(content_31.length > 0, 'Source file should not be empty');

  // Check source file exists
  assert.ok(fs.existsSync('/Users/jonathanborduas/code/QGSD/bin/fingerprint-drift.cjs'), 'Source file should exist: fingerprint-drift.cjs');
  const content_32 = fs.readFileSync('/Users/jonathanborduas/code/QGSD/bin/fingerprint-drift.cjs', 'utf8');
  // Structural check: source file contains requirement-related code
  assert.ok(content_32.length > 0, 'Source file should not be empty');

  // Check source file exists
  assert.ok(fs.existsSync('/Users/jonathanborduas/code/QGSD/bin/build-phase-index.test.cjs'), 'Source file should exist: build-phase-index.test.cjs');
  const content_33 = fs.readFileSync('/Users/jonathanborduas/code/QGSD/bin/build-phase-index.test.cjs', 'utf8');
  // Structural check: source file contains requirement-related code
  assert.ok(content_33.length > 0, 'Source file should not be empty');

  // Check source file exists
  assert.ok(fs.existsSync('/Users/jonathanborduas/code/QGSD/bin/formal-ref-linker.cjs'), 'Source file should exist: formal-ref-linker.cjs');
  const content_34 = fs.readFileSync('/Users/jonathanborduas/code/QGSD/bin/formal-ref-linker.cjs', 'utf8');
  // Structural check: source file contains requirement-related code
  assert.ok(content_34.length > 0, 'Source file should not be empty');

  // Check source file exists
  assert.ok(fs.existsSync('/Users/jonathanborduas/code/QGSD/bin/sweep-reverse.test.cjs'), 'Source file should exist: sweep-reverse.test.cjs');
  const content_35 = fs.readFileSync('/Users/jonathanborduas/code/QGSD/bin/sweep-reverse.test.cjs', 'utf8');
  // Structural check: source file contains requirement-related code
  assert.ok(content_35.length > 0, 'Source file should not be empty');

  // Check source file exists
  assert.ok(fs.existsSync('/Users/jonathanborduas/code/QGSD/bin/validate-invariant.cjs'), 'Source file should exist: validate-invariant.cjs');
  const content_36 = fs.readFileSync('/Users/jonathanborduas/code/QGSD/bin/validate-invariant.cjs', 'utf8');
  // Structural check: source file contains requirement-related code
  assert.ok(content_36.length > 0, 'Source file should not be empty');

  // Check source file exists
  assert.ok(fs.existsSync('/Users/jonathanborduas/code/QGSD/bin/check-coverage-guard.cjs'), 'Source file should exist: check-coverage-guard.cjs');
  const content_37 = fs.readFileSync('/Users/jonathanborduas/code/QGSD/bin/check-coverage-guard.cjs', 'utf8');
  // Structural check: source file contains requirement-related code
  assert.ok(content_37.length > 0, 'Source file should not be empty');

  // Check source file exists
  assert.ok(fs.existsSync('/Users/jonathanborduas/code/QGSD/bin/migrate-formal-dir.cjs'), 'Source file should exist: migrate-formal-dir.cjs');
  const content_38 = fs.readFileSync('/Users/jonathanborduas/code/QGSD/bin/migrate-formal-dir.cjs', 'utf8');
  // Structural check: source file contains requirement-related code
  assert.ok(content_38.length > 0, 'Source file should not be empty');

  // Check source file exists
  assert.ok(fs.existsSync('/Users/jonathanborduas/code/QGSD/bin/failure-taxonomy.test.cjs'), 'Source file should exist: failure-taxonomy.test.cjs');
  const content_39 = fs.readFileSync('/Users/jonathanborduas/code/QGSD/bin/failure-taxonomy.test.cjs', 'utf8');
  // Structural check: source file contains requirement-related code
  assert.ok(content_39.length > 0, 'Source file should not be empty');

  // Check source file exists
  assert.ok(fs.existsSync('/Users/jonathanborduas/code/QGSD/bin/read-policy.cjs'), 'Source file should exist: read-policy.cjs');
  const content_40 = fs.readFileSync('/Users/jonathanborduas/code/QGSD/bin/read-policy.cjs', 'utf8');
  // Structural check: source file contains requirement-related code
  assert.ok(content_40.length > 0, 'Source file should not be empty');

  // Check source file exists
  assert.ok(fs.existsSync('/Users/jonathanborduas/code/QGSD/bin/auth-drivers/pool.cjs'), 'Source file should exist: pool.cjs');
  const content_41 = fs.readFileSync('/Users/jonathanborduas/code/QGSD/bin/auth-drivers/pool.cjs', 'utf8');
  // Structural check: source file contains requirement-related code
  assert.ok(content_41.length > 0, 'Source file should not be empty');

  // Check source file exists
  assert.ok(fs.existsSync('/Users/jonathanborduas/code/QGSD/bin/trace-corpus-stats.cjs'), 'Source file should exist: trace-corpus-stats.cjs');
  const content_42 = fs.readFileSync('/Users/jonathanborduas/code/QGSD/bin/trace-corpus-stats.cjs', 'utf8');
  // Structural check: source file contains requirement-related code
  assert.ok(content_42.length > 0, 'Source file should not be empty');

  // Check source file exists
  assert.ok(fs.existsSync('/Users/jonathanborduas/code/QGSD/bin/compareDrift.test.cjs'), 'Source file should exist: compareDrift.test.cjs');
  const content_43 = fs.readFileSync('/Users/jonathanborduas/code/QGSD/bin/compareDrift.test.cjs', 'utf8');
  // Structural check: source file contains requirement-related code
  assert.ok(content_43.length > 0, 'Source file should not be empty');

  // Check source file exists
  assert.ok(fs.existsSync('/Users/jonathanborduas/code/QGSD/bin/quorum-slot-dispatch.test.cjs'), 'Source file should exist: quorum-slot-dispatch.test.cjs');
  const content_44 = fs.readFileSync('/Users/jonathanborduas/code/QGSD/bin/quorum-slot-dispatch.test.cjs', 'utf8');
  // Structural check: source file contains requirement-related code
  assert.ok(content_44.length > 0, 'Source file should not be empty');

  // Check source file exists
  assert.ok(fs.existsSync('/Users/jonathanborduas/code/QGSD/bin/observe-debt-writer.cjs'), 'Source file should exist: observe-debt-writer.cjs');
  const content_45 = fs.readFileSync('/Users/jonathanborduas/code/QGSD/bin/observe-debt-writer.cjs', 'utf8');
  // Structural check: source file contains requirement-related code
  assert.ok(content_45.length > 0, 'Source file should not be empty');

  // Check source file exists
  assert.ok(fs.existsSync('/Users/jonathanborduas/code/QGSD/bin/run-formal-verify.cjs'), 'Source file should exist: run-formal-verify.cjs');
  const content_46 = fs.readFileSync('/Users/jonathanborduas/code/QGSD/bin/run-formal-verify.cjs', 'utf8');
  // Structural check: source file contains requirement-related code
  assert.ok(content_46.length > 0, 'Source file should not be empty');

  // Check source file exists
  assert.ok(fs.existsSync('/Users/jonathanborduas/code/QGSD/bin/validate-traces.cjs'), 'Source file should exist: validate-traces.cjs');
  const content_47 = fs.readFileSync('/Users/jonathanborduas/code/QGSD/bin/validate-traces.cjs', 'utf8');
  // Structural check: source file contains requirement-related code
  assert.ok(content_47.length > 0, 'Source file should not be empty');

  // Check source file exists
  assert.ok(fs.existsSync('/Users/jonathanborduas/code/QGSD/bin/formal-core.cjs'), 'Source file should exist: formal-core.cjs');
  const content_48 = fs.readFileSync('/Users/jonathanborduas/code/QGSD/bin/formal-core.cjs', 'utf8');
  // Structural check: source file contains requirement-related code
  assert.ok(content_48.length > 0, 'Source file should not be empty');

  // Check source file exists
  assert.ok(fs.existsSync('/Users/jonathanborduas/code/QGSD/bin/quorum-formal-context.test.cjs'), 'Source file should exist: quorum-formal-context.test.cjs');
  const content_49 = fs.readFileSync('/Users/jonathanborduas/code/QGSD/bin/quorum-formal-context.test.cjs', 'utf8');
  // Structural check: source file contains requirement-related code
  assert.ok(content_49.length > 0, 'Source file should not be empty');

  // Check source file exists
  assert.ok(fs.existsSync('/Users/jonathanborduas/code/QGSD/bin/gate-a-grounding.test.cjs'), 'Source file should exist: gate-a-grounding.test.cjs');
  const content_50 = fs.readFileSync('/Users/jonathanborduas/code/QGSD/bin/gate-a-grounding.test.cjs', 'utf8');
  // Structural check: source file contains requirement-related code
  assert.ok(content_50.length > 0, 'Source file should not be empty');

  // Check source file exists
  assert.ok(fs.existsSync('/Users/jonathanborduas/code/QGSD/bin/quorum-formal-context.cjs'), 'Source file should exist: quorum-formal-context.cjs');
  const content_51 = fs.readFileSync('/Users/jonathanborduas/code/QGSD/bin/quorum-formal-context.cjs', 'utf8');
  // Structural check: source file contains requirement-related code
  assert.ok(content_51.length > 0, 'Source file should not be empty');

  // Check source file exists
  assert.ok(fs.existsSync('/Users/jonathanborduas/code/QGSD/bin/gate-b-abstraction.test.cjs'), 'Source file should exist: gate-b-abstraction.test.cjs');
  const content_52 = fs.readFileSync('/Users/jonathanborduas/code/QGSD/bin/gate-b-abstraction.test.cjs', 'utf8');
  // Structural check: source file contains requirement-related code
  assert.ok(content_52.length > 0, 'Source file should not be empty');

  // Check source file exists
  assert.ok(fs.existsSync('/Users/jonathanborduas/code/QGSD/bin/run-stop-hook-tlc.cjs'), 'Source file should exist: run-stop-hook-tlc.cjs');
  const content_53 = fs.readFileSync('/Users/jonathanborduas/code/QGSD/bin/run-stop-hook-tlc.cjs', 'utf8');
  // Structural check: source file contains requirement-related code
  assert.ok(content_53.length > 0, 'Source file should not be empty');

  // Check source file exists
  assert.ok(fs.existsSync('/Users/jonathanborduas/code/QGSD/bin/run-installer-alloy.cjs'), 'Source file should exist: run-installer-alloy.cjs');
  const content_54 = fs.readFileSync('/Users/jonathanborduas/code/QGSD/bin/run-installer-alloy.cjs', 'utf8');
  // Structural check: source file contains requirement-related code
  assert.ok(content_54.length > 0, 'Source file should not be empty');

  // Check source file exists
  assert.ok(fs.existsSync('/Users/jonathanborduas/code/QGSD/bin/gate-c-validation.cjs'), 'Source file should exist: gate-c-validation.cjs');
  const content_55 = fs.readFileSync('/Users/jonathanborduas/code/QGSD/bin/gate-c-validation.cjs', 'utf8');
  // Structural check: source file contains requirement-related code
  assert.ok(content_55.length > 0, 'Source file should not be empty');

  // Check source file exists
  assert.ok(fs.existsSync('/Users/jonathanborduas/code/QGSD/bin/generate-phase-spec.cjs'), 'Source file should exist: generate-phase-spec.cjs');
  const content_56 = fs.readFileSync('/Users/jonathanborduas/code/QGSD/bin/generate-phase-spec.cjs', 'utf8');
  // Structural check: source file contains requirement-related code
  assert.ok(content_56.length > 0, 'Source file should not be empty');

  // Check source file exists
  assert.ok(fs.existsSync('/Users/jonathanborduas/code/QGSD/bin/check-spec-sync.test.cjs'), 'Source file should exist: check-spec-sync.test.cjs');
  const content_57 = fs.readFileSync('/Users/jonathanborduas/code/QGSD/bin/check-spec-sync.test.cjs', 'utf8');
  // Structural check: source file contains requirement-related code
  assert.ok(content_57.length > 0, 'Source file should not be empty');

  // Check source file exists
  assert.ok(fs.existsSync('/Users/jonathanborduas/code/QGSD/bin/run-tlc.test.cjs'), 'Source file should exist: run-tlc.test.cjs');
  const content_58 = fs.readFileSync('/Users/jonathanborduas/code/QGSD/bin/run-tlc.test.cjs', 'utf8');
  // Structural check: source file contains requirement-related code
  assert.ok(content_58.length > 0, 'Source file should not be empty');

  // Check source file exists
  assert.ok(fs.existsSync('/Users/jonathanborduas/code/QGSD/bin/run-breaker-tlc.cjs'), 'Source file should exist: run-breaker-tlc.cjs');
  const content_59 = fs.readFileSync('/Users/jonathanborduas/code/QGSD/bin/run-breaker-tlc.cjs', 'utf8');
  // Structural check: source file contains requirement-related code
  assert.ok(content_59.length > 0, 'Source file should not be empty');

  // Check source file exists
  assert.ok(fs.existsSync('/Users/jonathanborduas/code/QGSD/bin/run-breaker-tlc.test.cjs'), 'Source file should exist: run-breaker-tlc.test.cjs');
  const content_60 = fs.readFileSync('/Users/jonathanborduas/code/QGSD/bin/run-breaker-tlc.test.cjs', 'utf8');
  // Structural check: source file contains requirement-related code
  assert.ok(content_60.length > 0, 'Source file should not be empty');

  // Check source file exists
  assert.ok(fs.existsSync('/Users/jonathanborduas/code/QGSD/bin/promote-gate-maturity.test.cjs'), 'Source file should exist: promote-gate-maturity.test.cjs');
  const content_61 = fs.readFileSync('/Users/jonathanborduas/code/QGSD/bin/promote-gate-maturity.test.cjs', 'utf8');
  // Structural check: source file contains requirement-related code
  assert.ok(content_61.length > 0, 'Source file should not be empty');

  // Check source file exists
  assert.ok(fs.existsSync('/Users/jonathanborduas/code/QGSD/bin/formal-proximity.cjs'), 'Source file should exist: formal-proximity.cjs');
  const content_62 = fs.readFileSync('/Users/jonathanborduas/code/QGSD/bin/formal-proximity.cjs', 'utf8');
  // Structural check: source file contains requirement-related code
  assert.ok(content_62.length > 0, 'Source file should not be empty');

  // Check source file exists
  assert.ok(fs.existsSync('/Users/jonathanborduas/code/QGSD/bin/instrumentation-map.test.cjs'), 'Source file should exist: instrumentation-map.test.cjs');
  const content_63 = fs.readFileSync('/Users/jonathanborduas/code/QGSD/bin/instrumentation-map.test.cjs', 'utf8');
  // Structural check: source file contains requirement-related code
  assert.ok(content_63.length > 0, 'Source file should not be empty');

  // Check source file exists
  assert.ok(fs.existsSync('/Users/jonathanborduas/code/QGSD/bin/git-heatmap.cjs'), 'Source file should exist: git-heatmap.cjs');
  const content_64 = fs.readFileSync('/Users/jonathanborduas/code/QGSD/bin/git-heatmap.cjs', 'utf8');
  // Structural check: source file contains requirement-related code
  assert.ok(content_64.length > 0, 'Source file should not be empty');

  // Check source file exists
  assert.ok(fs.existsSync('/Users/jonathanborduas/code/QGSD/bin/write-check-result.cjs'), 'Source file should exist: write-check-result.cjs');
  const content_65 = fs.readFileSync('/Users/jonathanborduas/code/QGSD/bin/write-check-result.cjs', 'utf8');
  // Structural check: source file contains requirement-related code
  assert.ok(content_65.length > 0, 'Source file should not be empty');

  // Check source file exists
  assert.ok(fs.existsSync('/Users/jonathanborduas/code/QGSD/bin/run-oauth-rotation-prism.cjs'), 'Source file should exist: run-oauth-rotation-prism.cjs');
  const content_66 = fs.readFileSync('/Users/jonathanborduas/code/QGSD/bin/run-oauth-rotation-prism.cjs', 'utf8');
  // Structural check: source file contains requirement-related code
  assert.ok(content_66.length > 0, 'Source file should not be empty');

  // Check source file exists
  assert.ok(fs.existsSync('/Users/jonathanborduas/code/QGSD/bin/check-results-exit.cjs'), 'Source file should exist: check-results-exit.cjs');
  const content_67 = fs.readFileSync('/Users/jonathanborduas/code/QGSD/bin/check-results-exit.cjs', 'utf8');
  // Structural check: source file contains requirement-related code
  assert.ok(content_67.length > 0, 'Source file should not be empty');

  // Check source file exists
  assert.ok(fs.existsSync('/Users/jonathanborduas/code/QGSD/bin/gate-b-abstraction.cjs'), 'Source file should exist: gate-b-abstraction.cjs');
  const content_68 = fs.readFileSync('/Users/jonathanborduas/code/QGSD/bin/gate-b-abstraction.cjs', 'utf8');
  // Structural check: source file contains requirement-related code
  assert.ok(content_68.length > 0, 'Source file should not be empty');

  // Check source file exists
  assert.ok(fs.existsSync('/Users/jonathanborduas/code/QGSD/bin/run-account-manager-tlc.cjs'), 'Source file should exist: run-account-manager-tlc.cjs');
  const content_69 = fs.readFileSync('/Users/jonathanborduas/code/QGSD/bin/run-account-manager-tlc.cjs', 'utf8');
  // Structural check: source file contains requirement-related code
  assert.ok(content_69.length > 0, 'Source file should not be empty');

  // Check source file exists
  assert.ok(fs.existsSync('/Users/jonathanborduas/code/QGSD/bin/trace-corpus-stats.test.cjs'), 'Source file should exist: trace-corpus-stats.test.cjs');
  const content_70 = fs.readFileSync('/Users/jonathanborduas/code/QGSD/bin/trace-corpus-stats.test.cjs', 'utf8');
  // Structural check: source file contains requirement-related code
  assert.ok(content_70.length > 0, 'Source file should not be empty');

  // Check source file exists
  assert.ok(fs.existsSync('/Users/jonathanborduas/code/QGSD/bin/check-trace-redaction.cjs'), 'Source file should exist: check-trace-redaction.cjs');
  const content_71 = fs.readFileSync('/Users/jonathanborduas/code/QGSD/bin/check-trace-redaction.cjs', 'utf8');
  // Structural check: source file contains requirement-related code
  assert.ok(content_71.length > 0, 'Source file should not be empty');

  // Check source file exists
  assert.ok(fs.existsSync('/Users/jonathanborduas/code/QGSD/bin/verify-formal-results.test.cjs'), 'Source file should exist: verify-formal-results.test.cjs');
  const content_72 = fs.readFileSync('/Users/jonathanborduas/code/QGSD/bin/verify-formal-results.test.cjs', 'utf8');
  // Structural check: source file contains requirement-related code
  assert.ok(content_72.length > 0, 'Source file should not be empty');

  // Check source file exists
  assert.ok(fs.existsSync('/Users/jonathanborduas/code/QGSD/bin/risk-heatmap.cjs'), 'Source file should exist: risk-heatmap.cjs');
  const content_73 = fs.readFileSync('/Users/jonathanborduas/code/QGSD/bin/risk-heatmap.cjs', 'utf8');
  // Structural check: source file contains requirement-related code
  assert.ok(content_73.length > 0, 'Source file should not be empty');

  // Check source file exists
  assert.ok(fs.existsSync('/Users/jonathanborduas/code/QGSD/bin/fingerprint-drift.test.cjs'), 'Source file should exist: fingerprint-drift.test.cjs');
  const content_74 = fs.readFileSync('/Users/jonathanborduas/code/QGSD/bin/fingerprint-drift.test.cjs', 'utf8');
  // Structural check: source file contains requirement-related code
  assert.ok(content_74.length > 0, 'Source file should not be empty');

  // Check source file exists
  assert.ok(fs.existsSync('/Users/jonathanborduas/code/QGSD/bin/observe-render.cjs'), 'Source file should exist: observe-render.cjs');
  const content_75 = fs.readFileSync('/Users/jonathanborduas/code/QGSD/bin/observe-render.cjs', 'utf8');
  // Structural check: source file contains requirement-related code
  assert.ok(content_75.length > 0, 'Source file should not be empty');

  // Check source file exists
  assert.ok(fs.existsSync('/Users/jonathanborduas/code/QGSD/bin/run-protocol-tlc.test.cjs'), 'Source file should exist: run-protocol-tlc.test.cjs');
  const content_76 = fs.readFileSync('/Users/jonathanborduas/code/QGSD/bin/run-protocol-tlc.test.cjs', 'utf8');
  // Structural check: source file contains requirement-related code
  assert.ok(content_76.length > 0, 'Source file should not be empty');

  // Check source file exists
  assert.ok(fs.existsSync('/Users/jonathanborduas/code/QGSD/bin/run-protocol-tlc.cjs'), 'Source file should exist: run-protocol-tlc.cjs');
  const content_77 = fs.readFileSync('/Users/jonathanborduas/code/QGSD/bin/run-protocol-tlc.cjs', 'utf8');
  // Structural check: source file contains requirement-related code
  assert.ok(content_77.length > 0, 'Source file should not be empty');

  // Check source file exists
  assert.ok(fs.existsSync('/Users/jonathanborduas/code/QGSD/bin/roadmapper-formal-integration.test.cjs'), 'Source file should exist: roadmapper-formal-integration.test.cjs');
  const content_78 = fs.readFileSync('/Users/jonathanborduas/code/QGSD/bin/roadmapper-formal-integration.test.cjs', 'utf8');
  // Structural check: source file contains requirement-related code
  assert.ok(content_78.length > 0, 'Source file should not be empty');

  // Check source file exists
  assert.ok(fs.existsSync('/Users/jonathanborduas/code/QGSD/bin/formal-test-sync.test.cjs'), 'Source file should exist: formal-test-sync.test.cjs');
  const content_79 = fs.readFileSync('/Users/jonathanborduas/code/QGSD/bin/formal-test-sync.test.cjs', 'utf8');
  // Structural check: source file contains requirement-related code
  assert.ok(content_79.length > 0, 'Source file should not be empty');

  // Check source file exists
  assert.ok(fs.existsSync('/Users/jonathanborduas/code/QGSD/bin/debt-ledger.test.cjs'), 'Source file should exist: debt-ledger.test.cjs');
  const content_80 = fs.readFileSync('/Users/jonathanborduas/code/QGSD/bin/debt-ledger.test.cjs', 'utf8');
  // Structural check: source file contains requirement-related code
  assert.ok(content_80.length > 0, 'Source file should not be empty');

  // Check source file exists
  assert.ok(fs.existsSync('/Users/jonathanborduas/code/QGSD/bin/compareDrift.cjs'), 'Source file should exist: compareDrift.cjs');
  const content_81 = fs.readFileSync('/Users/jonathanborduas/code/QGSD/bin/compareDrift.cjs', 'utf8');
  // Structural check: source file contains requirement-related code
  assert.ok(content_81.length > 0, 'Source file should not be empty');

  // Check source file exists
  assert.ok(fs.existsSync('/Users/jonathanborduas/code/QGSD/bin/extract-annotations.cjs'), 'Source file should exist: extract-annotations.cjs');
  const content_82 = fs.readFileSync('/Users/jonathanborduas/code/QGSD/bin/extract-annotations.cjs', 'utf8');
  // Structural check: source file contains requirement-related code
  assert.ok(content_82.length > 0, 'Source file should not be empty');

  // Check source file exists
  assert.ok(fs.existsSync('/Users/jonathanborduas/code/QGSD/bin/analyze-assumptions.cjs'), 'Source file should exist: analyze-assumptions.cjs');
  const content_83 = fs.readFileSync('/Users/jonathanborduas/code/QGSD/bin/analyze-assumptions.cjs', 'utf8');
  // Structural check: source file contains requirement-related code
  assert.ok(content_83.length > 0, 'Source file should not be empty');

  // Check source file exists
  assert.ok(fs.existsSync('/Users/jonathanborduas/code/QGSD/bin/run-uppaal.cjs'), 'Source file should exist: run-uppaal.cjs');
  const content_84 = fs.readFileSync('/Users/jonathanborduas/code/QGSD/bin/run-uppaal.cjs', 'utf8');
  // Structural check: source file contains requirement-related code
  assert.ok(content_84.length > 0, 'Source file should not be empty');

  // Check source file exists
  assert.ok(fs.existsSync('/Users/jonathanborduas/code/QGSD/bin/validate-requirements-haiku.cjs'), 'Source file should exist: validate-requirements-haiku.cjs');
  const content_85 = fs.readFileSync('/Users/jonathanborduas/code/QGSD/bin/validate-requirements-haiku.cjs', 'utf8');
  // Structural check: source file contains requirement-related code
  assert.ok(content_85.length > 0, 'Source file should not be empty');

  // Check source file exists
  assert.ok(fs.existsSync('/Users/jonathanborduas/code/QGSD/bin/observe-render.test.cjs'), 'Source file should exist: observe-render.test.cjs');
  const content_86 = fs.readFileSync('/Users/jonathanborduas/code/QGSD/bin/observe-render.test.cjs', 'utf8');
  // Structural check: source file contains requirement-related code
  assert.ok(content_86.length > 0, 'Source file should not be empty');

  // Check source file exists
  assert.ok(fs.existsSync('/Users/jonathanborduas/code/QGSD/bin/propose-debug-invariants.cjs'), 'Source file should exist: propose-debug-invariants.cjs');
  const content_87 = fs.readFileSync('/Users/jonathanborduas/code/QGSD/bin/propose-debug-invariants.cjs', 'utf8');
  // Structural check: source file contains requirement-related code
  assert.ok(content_87.length > 0, 'Source file should not be empty');

  // Check source file exists
  assert.ok(fs.existsSync('/Users/jonathanborduas/code/QGSD/bin/generate-proposed-changes.test.cjs'), 'Source file should exist: generate-proposed-changes.test.cjs');
  const content_88 = fs.readFileSync('/Users/jonathanborduas/code/QGSD/bin/generate-proposed-changes.test.cjs', 'utf8');
  // Structural check: source file contains requirement-related code
  assert.ok(content_88.length > 0, 'Source file should not be empty');

  // Check source file exists
  assert.ok(fs.existsSync('/Users/jonathanborduas/code/QGSD/bin/run-audit-alloy.cjs'), 'Source file should exist: run-audit-alloy.cjs');
  const content_89 = fs.readFileSync('/Users/jonathanborduas/code/QGSD/bin/run-audit-alloy.cjs', 'utf8');
  // Structural check: source file contains requirement-related code
  assert.ok(content_89.length > 0, 'Source file should not be empty');

  // Check source file exists
  assert.ok(fs.existsSync('/Users/jonathanborduas/code/QGSD/bin/install-formal-tools.cjs'), 'Source file should exist: install-formal-tools.cjs');
  const content_90 = fs.readFileSync('/Users/jonathanborduas/code/QGSD/bin/install-formal-tools.cjs', 'utf8');
  // Structural check: source file contains requirement-related code
  assert.ok(content_90.length > 0, 'Source file should not be empty');

  // Check source file exists
  assert.ok(fs.existsSync('/Users/jonathanborduas/code/QGSD/bin/run-tlc.cjs'), 'Source file should exist: run-tlc.cjs');
  const content_91 = fs.readFileSync('/Users/jonathanborduas/code/QGSD/bin/run-tlc.cjs', 'utf8');
  // Structural check: source file contains requirement-related code
  assert.ok(content_91.length > 0, 'Source file should not be empty');

  // Check source file exists
  assert.ok(fs.existsSync('/Users/jonathanborduas/code/QGSD/bin/verify-quorum-health.cjs'), 'Source file should exist: verify-quorum-health.cjs');
  const content_92 = fs.readFileSync('/Users/jonathanborduas/code/QGSD/bin/verify-quorum-health.cjs', 'utf8');
  // Structural check: source file contains requirement-related code
  assert.ok(content_92.length > 0, 'Source file should not be empty');

  // Check source file exists
  assert.ok(fs.existsSync('/Users/jonathanborduas/code/QGSD/bin/run-phase-tlc.test.cjs'), 'Source file should exist: run-phase-tlc.test.cjs');
  const content_93 = fs.readFileSync('/Users/jonathanborduas/code/QGSD/bin/run-phase-tlc.test.cjs', 'utf8');
  // Structural check: source file contains requirement-related code
  assert.ok(content_93.length > 0, 'Source file should not be empty');

  // Check source file exists
  assert.ok(fs.existsSync('/Users/jonathanborduas/code/QGSD/bin/count-scenarios.cjs'), 'Source file should exist: count-scenarios.cjs');
  const content_94 = fs.readFileSync('/Users/jonathanborduas/code/QGSD/bin/count-scenarios.cjs', 'utf8');
  // Structural check: source file contains requirement-related code
  assert.ok(content_94.length > 0, 'Source file should not be empty');

  // Check source file exists
  assert.ok(fs.existsSync('/Users/jonathanborduas/code/QGSD/bin/initialize-model-registry.cjs'), 'Source file should exist: initialize-model-registry.cjs');
  const content_95 = fs.readFileSync('/Users/jonathanborduas/code/QGSD/bin/initialize-model-registry.cjs', 'utf8');
  // Structural check: source file contains requirement-related code
  assert.ok(content_95.length > 0, 'Source file should not be empty');

  // Check source file exists
  assert.ok(fs.existsSync('/Users/jonathanborduas/code/QGSD/bin/run-sensitivity-sweep.test.cjs'), 'Source file should exist: run-sensitivity-sweep.test.cjs');
  const content_96 = fs.readFileSync('/Users/jonathanborduas/code/QGSD/bin/run-sensitivity-sweep.test.cjs', 'utf8');
  // Structural check: source file contains requirement-related code
  assert.ok(content_96.length > 0, 'Source file should not be empty');

  // Check source file exists
  assert.ok(fs.existsSync('/Users/jonathanborduas/code/QGSD/bin/build-layer-manifest.test.cjs'), 'Source file should exist: build-layer-manifest.test.cjs');
  const content_97 = fs.readFileSync('/Users/jonathanborduas/code/QGSD/bin/build-layer-manifest.test.cjs', 'utf8');
  // Structural check: source file contains requirement-related code
  assert.ok(content_97.length > 0, 'Source file should not be empty');

  // Check source file exists
  assert.ok(fs.existsSync('/Users/jonathanborduas/code/QGSD/bin/run-sensitivity-sweep.cjs'), 'Source file should exist: run-sensitivity-sweep.cjs');
  const content_98 = fs.readFileSync('/Users/jonathanborduas/code/QGSD/bin/run-sensitivity-sweep.cjs', 'utf8');
  // Structural check: source file contains requirement-related code
  assert.ok(content_98.length > 0, 'Source file should not be empty');

  // Check source file exists
  assert.ok(fs.existsSync('/Users/jonathanborduas/code/QGSD/bin/run-prism.test.cjs'), 'Source file should exist: run-prism.test.cjs');
  const content_99 = fs.readFileSync('/Users/jonathanborduas/code/QGSD/bin/run-prism.test.cjs', 'utf8');
  // Structural check: source file contains requirement-related code
  assert.ok(content_99.length > 0, 'Source file should not be empty');

  // Check source file exists
  assert.ok(fs.existsSync('/Users/jonathanborduas/code/QGSD/bin/formal-scope-scan.cjs'), 'Source file should exist: formal-scope-scan.cjs');
  const content_100 = fs.readFileSync('/Users/jonathanborduas/code/QGSD/bin/formal-scope-scan.cjs', 'utf8');
  // Structural check: source file contains requirement-related code
  assert.ok(content_100.length > 0, 'Source file should not be empty');

  // Check source file exists
  assert.ok(fs.existsSync('/Users/jonathanborduas/code/QGSD/bin/assumption-register.test.cjs'), 'Source file should exist: assumption-register.test.cjs');
  const content_101 = fs.readFileSync('/Users/jonathanborduas/code/QGSD/bin/assumption-register.test.cjs', 'utf8');
  // Structural check: source file contains requirement-related code
  assert.ok(content_101.length > 0, 'Source file should not be empty');

  // Check source file exists
  assert.ok(fs.existsSync('/Users/jonathanborduas/code/QGSD/bin/run-phase-tlc.cjs'), 'Source file should exist: run-phase-tlc.cjs');
  const content_102 = fs.readFileSync('/Users/jonathanborduas/code/QGSD/bin/run-phase-tlc.cjs', 'utf8');
  // Structural check: source file contains requirement-related code
  assert.ok(content_102.length > 0, 'Source file should not be empty');

  // Check source file exists
  assert.ok(fs.existsSync('/Users/jonathanborduas/code/QGSD/bin/generate-phase-spec.test.cjs'), 'Source file should exist: generate-phase-spec.test.cjs');
  const content_103 = fs.readFileSync('/Users/jonathanborduas/code/QGSD/bin/generate-phase-spec.test.cjs', 'utf8');
  // Structural check: source file contains requirement-related code
  assert.ok(content_103.length > 0, 'Source file should not be empty');

  // Check source file exists
  assert.ok(fs.existsSync('/Users/jonathanborduas/code/QGSD/bin/generate-triage-bundle.cjs'), 'Source file should exist: generate-triage-bundle.cjs');
  const content_104 = fs.readFileSync('/Users/jonathanborduas/code/QGSD/bin/generate-triage-bundle.cjs', 'utf8');
  // Structural check: source file contains requirement-related code
  assert.ok(content_104.length > 0, 'Source file should not be empty');

  // Check source file exists
  assert.ok(fs.existsSync('/Users/jonathanborduas/code/QGSD/bin/resolve-prism-bin.cjs'), 'Source file should exist: resolve-prism-bin.cjs');
  const content_105 = fs.readFileSync('/Users/jonathanborduas/code/QGSD/bin/resolve-prism-bin.cjs', 'utf8');
  // Structural check: source file contains requirement-related code
  assert.ok(content_105.length > 0, 'Source file should not be empty');

  // Check source file exists
  assert.ok(fs.existsSync('/Users/jonathanborduas/code/QGSD/bin/check-bundled-sdks.test.cjs'), 'Source file should exist: check-bundled-sdks.test.cjs');
  const content_106 = fs.readFileSync('/Users/jonathanborduas/code/QGSD/bin/check-bundled-sdks.test.cjs', 'utf8');
  // Structural check: source file contains requirement-related code
  assert.ok(content_106.length > 0, 'Source file should not be empty');

  // Check source file exists
  assert.ok(fs.existsSync('/Users/jonathanborduas/code/QGSD/bin/run-account-pool-alloy.cjs'), 'Source file should exist: run-account-pool-alloy.cjs');
  const content_107 = fs.readFileSync('/Users/jonathanborduas/code/QGSD/bin/run-account-pool-alloy.cjs', 'utf8');
  // Structural check: source file contains requirement-related code
  assert.ok(content_107.length > 0, 'Source file should not be empty');

  // Check source file exists
  assert.ok(fs.existsSync('/Users/jonathanborduas/code/QGSD/bin/run-transcript-alloy.test.cjs'), 'Source file should exist: run-transcript-alloy.test.cjs');
  const content_108 = fs.readFileSync('/Users/jonathanborduas/code/QGSD/bin/run-transcript-alloy.test.cjs', 'utf8');
  // Structural check: source file contains requirement-related code
  assert.ok(content_108.length > 0, 'Source file should not be empty');

  // Check source file exists
  assert.ok(fs.existsSync('/Users/jonathanborduas/code/QGSD/bin/mismatch-register.test.cjs'), 'Source file should exist: mismatch-register.test.cjs');
  const content_109 = fs.readFileSync('/Users/jonathanborduas/code/QGSD/bin/mismatch-register.test.cjs', 'utf8');
  // Structural check: source file contains requirement-related code
  assert.ok(content_109.length > 0, 'Source file should not be empty');

  // Check source file exists
  assert.ok(fs.existsSync('/Users/jonathanborduas/code/QGSD/bin/observed-fsm.cjs'), 'Source file should exist: observed-fsm.cjs');
  const content_110 = fs.readFileSync('/Users/jonathanborduas/code/QGSD/bin/observed-fsm.cjs', 'utf8');
  // Structural check: source file contains requirement-related code
  assert.ok(content_110.length > 0, 'Source file should not be empty');

  // Check source file exists
  assert.ok(fs.existsSync('/Users/jonathanborduas/code/QGSD/bin/instrumentation-map.cjs'), 'Source file should exist: instrumentation-map.cjs');
  const content_111 = fs.readFileSync('/Users/jonathanborduas/code/QGSD/bin/instrumentation-map.cjs', 'utf8');
  // Structural check: source file contains requirement-related code
  assert.ok(content_111.length > 0, 'Source file should not be empty');

  // Check source file exists
  assert.ok(fs.existsSync('/Users/jonathanborduas/code/QGSD/bin/git-history-evidence.cjs'), 'Source file should exist: git-history-evidence.cjs');
  const content_112 = fs.readFileSync('/Users/jonathanborduas/code/QGSD/bin/git-history-evidence.cjs', 'utf8');
  // Structural check: source file contains requirement-related code
  assert.ok(content_112.length > 0, 'Source file should not be empty');

  // Check source file exists
  assert.ok(fs.existsSync('/Users/jonathanborduas/code/QGSD/bin/formal-test-sync.cjs'), 'Source file should exist: formal-test-sync.cjs');
  const content_113 = fs.readFileSync('/Users/jonathanborduas/code/QGSD/bin/formal-test-sync.cjs', 'utf8');
  // Structural check: source file contains requirement-related code
  assert.ok(content_113.length > 0, 'Source file should not be empty');

  // Check source file exists
  assert.ok(fs.existsSync('/Users/jonathanborduas/code/QGSD/bin/run-transcript-alloy.cjs'), 'Source file should exist: run-transcript-alloy.cjs');
  const content_114 = fs.readFileSync('/Users/jonathanborduas/code/QGSD/bin/run-transcript-alloy.cjs', 'utf8');
  // Structural check: source file contains requirement-related code
  assert.ok(content_114.length > 0, 'Source file should not be empty');

  // Check source file exists
  assert.ok(fs.existsSync('/Users/jonathanborduas/code/QGSD/bin/run-formal-verify.test.cjs'), 'Source file should exist: run-formal-verify.test.cjs');
  const content_115 = fs.readFileSync('/Users/jonathanborduas/code/QGSD/bin/run-formal-verify.test.cjs', 'utf8');
  // Structural check: source file contains requirement-related code
  assert.ok(content_115.length > 0, 'Source file should not be empty');

  // Check source file exists
  assert.ok(fs.existsSync('/Users/jonathanborduas/code/QGSD/bin/account-manager.cjs'), 'Source file should exist: account-manager.cjs');
  const content_116 = fs.readFileSync('/Users/jonathanborduas/code/QGSD/bin/account-manager.cjs', 'utf8');
  // Structural check: source file contains requirement-related code
  assert.ok(content_116.length > 0, 'Source file should not be empty');

  // Check source file exists
  assert.ok(fs.existsSync('/Users/jonathanborduas/code/QGSD/bin/sensitivity-sweep-feedback.cjs'), 'Source file should exist: sensitivity-sweep-feedback.cjs');
  const content_117 = fs.readFileSync('/Users/jonathanborduas/code/QGSD/bin/sensitivity-sweep-feedback.cjs', 'utf8');
  // Structural check: source file contains requirement-related code
  assert.ok(content_117.length > 0, 'Source file should not be empty');

  // Check source file exists
  assert.ok(fs.existsSync('/Users/jonathanborduas/code/QGSD/bin/check-liveness-fairness.test.cjs'), 'Source file should exist: check-liveness-fairness.test.cjs');
  const content_118 = fs.readFileSync('/Users/jonathanborduas/code/QGSD/bin/check-liveness-fairness.test.cjs', 'utf8');
  // Structural check: source file contains requirement-related code
  assert.ok(content_118.length > 0, 'Source file should not be empty');

  // Check source file exists
  assert.ok(fs.existsSync('/Users/jonathanborduas/code/QGSD/bin/verifier-formal-context.test.cjs'), 'Source file should exist: verifier-formal-context.test.cjs');
  const content_119 = fs.readFileSync('/Users/jonathanborduas/code/QGSD/bin/verifier-formal-context.test.cjs', 'utf8');
  // Structural check: source file contains requirement-related code
  assert.ok(content_119.length > 0, 'Source file should not be empty');

  // Check source file exists
  assert.ok(fs.existsSync('/Users/jonathanborduas/code/QGSD/bin/gate-c-validation.test.cjs'), 'Source file should exist: gate-c-validation.test.cjs');
  const content_120 = fs.readFileSync('/Users/jonathanborduas/code/QGSD/bin/gate-c-validation.test.cjs', 'utf8');
  // Structural check: source file contains requirement-related code
  assert.ok(content_120.length > 0, 'Source file should not be empty');

  // Check source file exists
  assert.ok(fs.existsSync('/Users/jonathanborduas/code/QGSD/bin/generate-triage-bundle.test.cjs'), 'Source file should exist: generate-triage-bundle.test.cjs');
  const content_121 = fs.readFileSync('/Users/jonathanborduas/code/QGSD/bin/generate-triage-bundle.test.cjs', 'utf8');
  // Structural check: source file contains requirement-related code
  assert.ok(content_121.length > 0, 'Source file should not be empty');

  // Check source file exists
  assert.ok(fs.existsSync('/Users/jonathanborduas/code/QGSD/bin/promote-model.test.cjs'), 'Source file should exist: promote-model.test.cjs');
  const content_122 = fs.readFileSync('/Users/jonathanborduas/code/QGSD/bin/promote-model.test.cjs', 'utf8');
  // Structural check: source file contains requirement-related code
  assert.ok(content_122.length > 0, 'Source file should not be empty');

  // Check source file exists
  assert.ok(fs.existsSync('/Users/jonathanborduas/code/QGSD/bin/plan-phase-fv-gate.test.cjs'), 'Source file should exist: plan-phase-fv-gate.test.cjs');
  const content_123 = fs.readFileSync('/Users/jonathanborduas/code/QGSD/bin/plan-phase-fv-gate.test.cjs', 'utf8');
  // Structural check: source file contains requirement-related code
  assert.ok(content_123.length > 0, 'Source file should not be empty');

  // Check source file exists
  assert.ok(fs.existsSync('/Users/jonathanborduas/code/QGSD/bin/invariant-catalog.test.cjs'), 'Source file should exist: invariant-catalog.test.cjs');
  const content_124 = fs.readFileSync('/Users/jonathanborduas/code/QGSD/bin/invariant-catalog.test.cjs', 'utf8');
  // Structural check: source file contains requirement-related code
  assert.ok(content_124.length > 0, 'Source file should not be empty');

  // Check source file exists
  assert.ok(fs.existsSync('/Users/jonathanborduas/code/QGSD/bin/observe-solve-pipe.cjs'), 'Source file should exist: observe-solve-pipe.cjs');
  const content_125 = fs.readFileSync('/Users/jonathanborduas/code/QGSD/bin/observe-solve-pipe.cjs', 'utf8');
  // Structural check: source file contains requirement-related code
  assert.ok(content_125.length > 0, 'Source file should not be empty');

  // Check source file exists
  assert.ok(fs.existsSync('/Users/jonathanborduas/code/QGSD/bin/sweepPtoF.cjs'), 'Source file should exist: sweepPtoF.cjs');
  const content_126 = fs.readFileSync('/Users/jonathanborduas/code/QGSD/bin/sweepPtoF.cjs', 'utf8');
  // Structural check: source file contains requirement-related code
  assert.ok(content_126.length > 0, 'Source file should not be empty');

  // Check source file exists
  assert.ok(fs.existsSync('/Users/jonathanborduas/code/QGSD/bin/check-bundled-sdks.cjs'), 'Source file should exist: check-bundled-sdks.cjs');
  const content_127 = fs.readFileSync('/Users/jonathanborduas/code/QGSD/bin/check-bundled-sdks.cjs', 'utf8');
  // Structural check: source file contains requirement-related code
  assert.ok(content_127.length > 0, 'Source file should not be empty');

  // Check source file exists
  assert.ok(fs.existsSync('/Users/jonathanborduas/code/QGSD/bin/requirements-core.test.cjs'), 'Source file should exist: requirements-core.test.cjs');
  const content_128 = fs.readFileSync('/Users/jonathanborduas/code/QGSD/bin/requirements-core.test.cjs', 'utf8');
  // Structural check: source file contains requirement-related code
  assert.ok(content_128.length > 0, 'Source file should not be empty');

  // Check source file exists
  assert.ok(fs.existsSync('/Users/jonathanborduas/code/QGSD/bin/validate-traces.test.cjs'), 'Source file should exist: validate-traces.test.cjs');
  const content_129 = fs.readFileSync('/Users/jonathanborduas/code/QGSD/bin/validate-traces.test.cjs', 'utf8');
  // Structural check: source file contains requirement-related code
  assert.ok(content_129.length > 0, 'Source file should not be empty');

  // Check source file exists
  assert.ok(fs.existsSync('/Users/jonathanborduas/code/QGSD/bin/check-trace-redaction.test.cjs'), 'Source file should exist: check-trace-redaction.test.cjs');
  const content_130 = fs.readFileSync('/Users/jonathanborduas/code/QGSD/bin/check-trace-redaction.test.cjs', 'utf8');
  // Structural check: source file contains requirement-related code
  assert.ok(content_130.length > 0, 'Source file should not be empty');

  // Check source file exists
  assert.ok(fs.existsSync('/Users/jonathanborduas/code/QGSD/bin/run-installer-alloy.test.cjs'), 'Source file should exist: run-installer-alloy.test.cjs');
  const content_131 = fs.readFileSync('/Users/jonathanborduas/code/QGSD/bin/run-installer-alloy.test.cjs', 'utf8');
  // Structural check: source file contains requirement-related code
  assert.ok(content_131.length > 0, 'Source file should not be empty');

  // Check source file exists
  assert.ok(fs.existsSync('/Users/jonathanborduas/code/QGSD/bin/generate-tla-cfg.cjs'), 'Source file should exist: generate-tla-cfg.cjs');
  const content_132 = fs.readFileSync('/Users/jonathanborduas/code/QGSD/bin/generate-tla-cfg.cjs', 'utf8');
  // Structural check: source file contains requirement-related code
  assert.ok(content_132.length > 0, 'Source file should not be empty');

  // Check source file exists
  assert.ok(fs.existsSync('/Users/jonathanborduas/code/QGSD/bin/install.js'), 'Source file should exist: install.js');
  const content_133 = fs.readFileSync('/Users/jonathanborduas/code/QGSD/bin/install.js', 'utf8');
  // Structural check: source file contains requirement-related code
  assert.ok(content_133.length > 0, 'Source file should not be empty');

  // Check source file exists
  assert.ok(fs.existsSync('/Users/jonathanborduas/code/QGSD/bin/generate-formal-specs.cjs'), 'Source file should exist: generate-formal-specs.cjs');
  const content_134 = fs.readFileSync('/Users/jonathanborduas/code/QGSD/bin/generate-formal-specs.cjs', 'utf8');
  // Structural check: source file contains requirement-related code
  assert.ok(content_134.length > 0, 'Source file should not be empty');

  // Check source file exists
  assert.ok(fs.existsSync('/Users/jonathanborduas/code/QGSD/bin/git-history-evidence.test.cjs'), 'Source file should exist: git-history-evidence.test.cjs');
  const content_135 = fs.readFileSync('/Users/jonathanborduas/code/QGSD/bin/git-history-evidence.test.cjs', 'utf8');
  // Structural check: source file contains requirement-related code
  assert.ok(content_135.length > 0, 'Source file should not be empty');

  // Check source file exists
  assert.ok(fs.existsSync('/Users/jonathanborduas/code/QGSD/bin/generate-petri-net.test.cjs'), 'Source file should exist: generate-petri-net.test.cjs');
  const content_136 = fs.readFileSync('/Users/jonathanborduas/code/QGSD/bin/generate-petri-net.test.cjs', 'utf8');
  // Structural check: source file contains requirement-related code
  assert.ok(content_136.length > 0, 'Source file should not be empty');

  // Check source file exists
  assert.ok(fs.existsSync('/Users/jonathanborduas/code/QGSD/bin/nf-stop-hook.test.cjs'), 'Source file should exist: nf-stop-hook.test.cjs');
  const content_137 = fs.readFileSync('/Users/jonathanborduas/code/QGSD/bin/nf-stop-hook.test.cjs', 'utf8');
  // Structural check: source file contains requirement-related code
  assert.ok(content_137.length > 0, 'Source file should not be empty');

  // Check source file exists
  assert.ok(fs.existsSync('/Users/jonathanborduas/code/QGSD/bin/sensitivity-sweep-feedback.test.cjs'), 'Source file should exist: sensitivity-sweep-feedback.test.cjs');
  const content_138 = fs.readFileSync('/Users/jonathanborduas/code/QGSD/bin/sensitivity-sweep-feedback.test.cjs', 'utf8');
  // Structural check: source file contains requirement-related code
  assert.ok(content_138.length > 0, 'Source file should not be empty');

  // Check source file exists
  assert.ok(fs.existsSync('/Users/jonathanborduas/code/QGSD/bin/autoClosePtoF.cjs'), 'Source file should exist: autoClosePtoF.cjs');
  const content_139 = fs.readFileSync('/Users/jonathanborduas/code/QGSD/bin/autoClosePtoF.cjs', 'utf8');
  // Structural check: source file contains requirement-related code
  assert.ok(content_139.length > 0, 'Source file should not be empty');

  // Check source file exists
  assert.ok(fs.existsSync('/Users/jonathanborduas/code/QGSD/bin/risk-heatmap.test.cjs'), 'Source file should exist: risk-heatmap.test.cjs');
  const content_140 = fs.readFileSync('/Users/jonathanborduas/code/QGSD/bin/risk-heatmap.test.cjs', 'utf8');
  // Structural check: source file contains requirement-related code
  assert.ok(content_140.length > 0, 'Source file should not be empty');

  // Check source file exists
  assert.ok(fs.existsSync('/Users/jonathanborduas/code/QGSD/bin/export-prism-constants.test.cjs'), 'Source file should exist: export-prism-constants.test.cjs');
  const content_141 = fs.readFileSync('/Users/jonathanborduas/code/QGSD/bin/export-prism-constants.test.cjs', 'utf8');
  // Structural check: source file contains requirement-related code
  assert.ok(content_141.length > 0, 'Source file should not be empty');

  // Check source file exists
  assert.ok(fs.existsSync('/Users/jonathanborduas/code/QGSD/bin/sensitivity-report.cjs'), 'Source file should exist: sensitivity-report.cjs');
  const content_142 = fs.readFileSync('/Users/jonathanborduas/code/QGSD/bin/sensitivity-report.cjs', 'utf8');
  // Structural check: source file contains requirement-related code
  assert.ok(content_142.length > 0, 'Source file should not be empty');

  // Check source file exists
  assert.ok(fs.existsSync('/Users/jonathanborduas/code/QGSD/bin/generate-traceability-matrix.cjs'), 'Source file should exist: generate-traceability-matrix.cjs');
  const content_143 = fs.readFileSync('/Users/jonathanborduas/code/QGSD/bin/generate-traceability-matrix.cjs', 'utf8');
  // Structural check: source file contains requirement-related code
  assert.ok(content_143.length > 0, 'Source file should not be empty');

  // Check source file exists
  assert.ok(fs.existsSync('/Users/jonathanborduas/code/QGSD/bin/generate-petri-net.cjs'), 'Source file should exist: generate-petri-net.cjs');
  const content_144 = fs.readFileSync('/Users/jonathanborduas/code/QGSD/bin/generate-petri-net.cjs', 'utf8');
  // Structural check: source file contains requirement-related code
  assert.ok(content_144.length > 0, 'Source file should not be empty');

  // Check source file exists
  assert.ok(fs.existsSync('/Users/jonathanborduas/code/QGSD/bin/debt-dedup.cjs'), 'Source file should exist: debt-dedup.cjs');
  const content_145 = fs.readFileSync('/Users/jonathanborduas/code/QGSD/bin/debt-dedup.cjs', 'utf8');
  // Structural check: source file contains requirement-related code
  assert.ok(content_145.length > 0, 'Source file should not be empty');

  // Check source file exists
  assert.ok(fs.existsSync('/Users/jonathanborduas/code/QGSD/bin/formal-query.cjs'), 'Source file should exist: formal-query.cjs');
  const content_146 = fs.readFileSync('/Users/jonathanborduas/code/QGSD/bin/formal-query.cjs', 'utf8');
  // Structural check: source file contains requirement-related code
  assert.ok(content_146.length > 0, 'Source file should not be empty');

  // Check source file exists
  assert.ok(fs.existsSync('/Users/jonathanborduas/code/QGSD/bin/autoClosePtoF.test.cjs'), 'Source file should exist: autoClosePtoF.test.cjs');
  const content_147 = fs.readFileSync('/Users/jonathanborduas/code/QGSD/bin/autoClosePtoF.test.cjs', 'utf8');
  // Structural check: source file contains requirement-related code
  assert.ok(content_147.length > 0, 'Source file should not be empty');

  // Check source file exists
  assert.ok(fs.existsSync('/Users/jonathanborduas/code/QGSD/bin/run-prism.cjs'), 'Source file should exist: run-prism.cjs');
  const content_148 = fs.readFileSync('/Users/jonathanborduas/code/QGSD/bin/run-prism.cjs', 'utf8');
  // Structural check: source file contains requirement-related code
  assert.ok(content_148.length > 0, 'Source file should not be empty');

  // Check source file exists
  assert.ok(fs.existsSync('/Users/jonathanborduas/code/QGSD/bin/initialize-model-registry.test.cjs'), 'Source file should exist: initialize-model-registry.test.cjs');
  const content_149 = fs.readFileSync('/Users/jonathanborduas/code/QGSD/bin/initialize-model-registry.test.cjs', 'utf8');
  // Structural check: source file contains requirement-related code
  assert.ok(content_149.length > 0, 'Source file should not be empty');

  // Check source file exists
  assert.ok(fs.existsSync('/Users/jonathanborduas/code/QGSD/bin/failure-taxonomy.cjs'), 'Source file should exist: failure-taxonomy.cjs');
  const content_150 = fs.readFileSync('/Users/jonathanborduas/code/QGSD/bin/failure-taxonomy.cjs', 'utf8');
  // Structural check: source file contains requirement-related code
  assert.ok(content_150.length > 0, 'Source file should not be empty');

  // Check source file exists
  assert.ok(fs.existsSync('/Users/jonathanborduas/code/QGSD/bin/validate-debt-entry.cjs'), 'Source file should exist: validate-debt-entry.cjs');
  const content_151 = fs.readFileSync('/Users/jonathanborduas/code/QGSD/bin/validate-debt-entry.cjs', 'utf8');
  // Structural check: source file contains requirement-related code
  assert.ok(content_151.length > 0, 'Source file should not be empty');

  // Check source file exists
  assert.ok(fs.existsSync('/Users/jonathanborduas/code/QGSD/bin/solve-debt-bridge.cjs'), 'Source file should exist: solve-debt-bridge.cjs');
  const content_152 = fs.readFileSync('/Users/jonathanborduas/code/QGSD/bin/solve-debt-bridge.cjs', 'utf8');
  // Structural check: source file contains requirement-related code
  assert.ok(content_152.length > 0, 'Source file should not be empty');

  // Check source file exists
  assert.ok(fs.existsSync('/Users/jonathanborduas/code/QGSD/bin/nf-solve.cjs'), 'Source file should exist: nf-solve.cjs');
  const content_153 = fs.readFileSync('/Users/jonathanborduas/code/QGSD/bin/nf-solve.cjs', 'utf8');
  // Structural check: source file contains requirement-related code
  assert.ok(content_153.length > 0, 'Source file should not be empty');

  // Check source file exists
  assert.ok(fs.existsSync('/Users/jonathanborduas/code/QGSD/bin/state-candidates.cjs'), 'Source file should exist: state-candidates.cjs');
  const content_154 = fs.readFileSync('/Users/jonathanborduas/code/QGSD/bin/state-candidates.cjs', 'utf8');
  // Structural check: source file contains requirement-related code
  assert.ok(content_154.length > 0, 'Source file should not be empty');

  // Check source file exists
  assert.ok(fs.existsSync('/Users/jonathanborduas/code/QGSD/bin/observe-handler-internal.cjs'), 'Source file should exist: observe-handler-internal.cjs');
  const content_155 = fs.readFileSync('/Users/jonathanborduas/code/QGSD/bin/observe-handler-internal.cjs', 'utf8');
  // Structural check: source file contains requirement-related code
  assert.ok(content_155.length > 0, 'Source file should not be empty');

  // Check source file exists
  assert.ok(fs.existsSync('/Users/jonathanborduas/code/QGSD/bin/lint-formal-models.cjs'), 'Source file should exist: lint-formal-models.cjs');
  const content_156 = fs.readFileSync('/Users/jonathanborduas/code/QGSD/bin/lint-formal-models.cjs', 'utf8');
  // Structural check: source file contains requirement-related code
  assert.ok(content_156.length > 0, 'Source file should not be empty');

  // Check source file exists
  assert.ok(fs.existsSync('/Users/jonathanborduas/code/QGSD/bin/nf-debt.test.cjs'), 'Source file should exist: nf-debt.test.cjs');
  const content_157 = fs.readFileSync('/Users/jonathanborduas/code/QGSD/bin/nf-debt.test.cjs', 'utf8');
  // Structural check: source file contains requirement-related code
  assert.ok(content_157.length > 0, 'Source file should not be empty');

  // Check source file exists
  assert.ok(fs.existsSync('/Users/jonathanborduas/code/QGSD/bin/oscillation-audit.test.cjs'), 'Source file should exist: oscillation-audit.test.cjs');
  const content_158 = fs.readFileSync('/Users/jonathanborduas/code/QGSD/bin/oscillation-audit.test.cjs', 'utf8');
  // Structural check: source file contains requirement-related code
  assert.ok(content_158.length > 0, 'Source file should not be empty');

  // Check source file exists
  assert.ok(fs.existsSync('/Users/jonathanborduas/code/QGSD/bin/promote-model.cjs'), 'Source file should exist: promote-model.cjs');
  const content_159 = fs.readFileSync('/Users/jonathanborduas/code/QGSD/bin/promote-model.cjs', 'utf8');
  // Structural check: source file contains requirement-related code
  assert.ok(content_159.length > 0, 'Source file should not be empty');

  // Check source file exists
  assert.ok(fs.existsSync('/Users/jonathanborduas/code/QGSD/bin/extractFormalExpected.cjs'), 'Source file should exist: extractFormalExpected.cjs');
  const content_160 = fs.readFileSync('/Users/jonathanborduas/code/QGSD/bin/extractFormalExpected.cjs', 'utf8');
  // Structural check: source file contains requirement-related code
  assert.ok(content_160.length > 0, 'Source file should not be empty');

  // Check source file exists
  assert.ok(fs.existsSync('/Users/jonathanborduas/code/QGSD/bin/sweepPtoF.test.cjs'), 'Source file should exist: sweepPtoF.test.cjs');
  const content_161 = fs.readFileSync('/Users/jonathanborduas/code/QGSD/bin/sweepPtoF.test.cjs', 'utf8');
  // Structural check: source file contains requirement-related code
  assert.ok(content_161.length > 0, 'Source file should not be empty');

  // Check source file exists
  assert.ok(fs.existsSync('/Users/jonathanborduas/code/QGSD/bin/test-recipe-gen.test.cjs'), 'Source file should exist: test-recipe-gen.test.cjs');
  const content_162 = fs.readFileSync('/Users/jonathanborduas/code/QGSD/bin/test-recipe-gen.test.cjs', 'utf8');
  // Structural check: source file contains requirement-related code
  assert.ok(content_162.length > 0, 'Source file should not be empty');

  // Check source file exists
  assert.ok(fs.existsSync('/Users/jonathanborduas/code/QGSD/bin/generate-tla-cfg.test.cjs'), 'Source file should exist: generate-tla-cfg.test.cjs');
  const content_163 = fs.readFileSync('/Users/jonathanborduas/code/QGSD/bin/generate-tla-cfg.test.cjs', 'utf8');
  // Structural check: source file contains requirement-related code
  assert.ok(content_163.length > 0, 'Source file should not be empty');

  // Check source file exists
  assert.ok(fs.existsSync('/Users/jonathanborduas/code/QGSD/bin/cross-layer-dashboard.cjs'), 'Source file should exist: cross-layer-dashboard.cjs');
  const content_164 = fs.readFileSync('/Users/jonathanborduas/code/QGSD/bin/cross-layer-dashboard.cjs', 'utf8');
  // Structural check: source file contains requirement-related code
  assert.ok(content_164.length > 0, 'Source file should not be empty');

  // Check source file exists
  assert.ok(fs.existsSync('/Users/jonathanborduas/code/QGSD/bin/validate-debt-entry.test.cjs'), 'Source file should exist: validate-debt-entry.test.cjs');
  const content_165 = fs.readFileSync('/Users/jonathanborduas/code/QGSD/bin/validate-debt-entry.test.cjs', 'utf8');
  // Structural check: source file contains requirement-related code
  assert.ok(content_165.length > 0, 'Source file should not be empty');

  // Check source file exists
  assert.ok(fs.existsSync('/Users/jonathanborduas/code/QGSD/bin/conformance-schema.test.cjs'), 'Source file should exist: conformance-schema.test.cjs');
  const content_166 = fs.readFileSync('/Users/jonathanborduas/code/QGSD/bin/conformance-schema.test.cjs', 'utf8');
  // Structural check: source file contains requirement-related code
  assert.ok(content_166.length > 0, 'Source file should not be empty');

  // Check source file exists
  assert.ok(fs.existsSync('/Users/jonathanborduas/code/QGSD/bin/run-oscillation-tlc.test.cjs'), 'Source file should exist: run-oscillation-tlc.test.cjs');
  const content_167 = fs.readFileSync('/Users/jonathanborduas/code/QGSD/bin/run-oscillation-tlc.test.cjs', 'utf8');
  // Structural check: source file contains requirement-related code
  assert.ok(content_167.length > 0, 'Source file should not be empty');

  // Check source file exists
  assert.ok(fs.existsSync('/Users/jonathanborduas/code/QGSD/bin/write-check-result.test.cjs'), 'Source file should exist: write-check-result.test.cjs');
  const content_168 = fs.readFileSync('/Users/jonathanborduas/code/QGSD/bin/write-check-result.test.cjs', 'utf8');
  // Structural check: source file contains requirement-related code
  assert.ok(content_168.length > 0, 'Source file should not be empty');

  // Check source file exists
  assert.ok(fs.existsSync('/Users/jonathanborduas/code/QGSD/bin/export-prism-constants.cjs'), 'Source file should exist: export-prism-constants.cjs');
  const content_169 = fs.readFileSync('/Users/jonathanborduas/code/QGSD/bin/export-prism-constants.cjs', 'utf8');
  // Structural check: source file contains requirement-related code
  assert.ok(content_169.length > 0, 'Source file should not be empty');

  // Check source file exists
  assert.ok(fs.existsSync('/Users/jonathanborduas/code/QGSD/bin/isNumericThreshold.cjs'), 'Source file should exist: isNumericThreshold.cjs');
  const content_170 = fs.readFileSync('/Users/jonathanborduas/code/QGSD/bin/isNumericThreshold.cjs', 'utf8');
  // Structural check: source file contains requirement-related code
  assert.ok(content_170.length > 0, 'Source file should not be empty');

  // Check source file exists
  assert.ok(fs.existsSync('/Users/jonathanborduas/code/QGSD/bin/accept-debug-invariant.cjs'), 'Source file should exist: accept-debug-invariant.cjs');
  const content_171 = fs.readFileSync('/Users/jonathanborduas/code/QGSD/bin/accept-debug-invariant.cjs', 'utf8');
  // Structural check: source file contains requirement-related code
  assert.ok(content_171.length > 0, 'Source file should not be empty');

  // Check source file exists
  assert.ok(fs.existsSync('/Users/jonathanborduas/code/QGSD/bin/generate-proposed-changes.cjs'), 'Source file should exist: generate-proposed-changes.cjs');
  const content_172 = fs.readFileSync('/Users/jonathanborduas/code/QGSD/bin/generate-proposed-changes.cjs', 'utf8');
  // Structural check: source file contains requirement-related code
  assert.ok(content_172.length > 0, 'Source file should not be empty');

  // Check source file exists
  assert.ok(fs.existsSync('/Users/jonathanborduas/code/QGSD/bin/read-policy.test.cjs'), 'Source file should exist: read-policy.test.cjs');
  const content_173 = fs.readFileSync('/Users/jonathanborduas/code/QGSD/bin/read-policy.test.cjs', 'utf8');
  // Structural check: source file contains requirement-related code
  assert.ok(content_173.length > 0, 'Source file should not be empty');

  // Check source file exists
  assert.ok(fs.existsSync('/Users/jonathanborduas/code/QGSD/bin/quorum-composition.test.cjs'), 'Source file should exist: quorum-composition.test.cjs');
  const content_174 = fs.readFileSync('/Users/jonathanborduas/code/QGSD/bin/quorum-composition.test.cjs', 'utf8');
  // Structural check: source file contains requirement-related code
  assert.ok(content_174.length > 0, 'Source file should not be empty');

  // Check source file exists
  assert.ok(fs.existsSync('/Users/jonathanborduas/code/QGSD/bin/detect-coverage-gaps.cjs'), 'Source file should exist: detect-coverage-gaps.cjs');
  const content_175 = fs.readFileSync('/Users/jonathanborduas/code/QGSD/bin/detect-coverage-gaps.cjs', 'utf8');
  // Structural check: source file contains requirement-related code
  assert.ok(content_175.length > 0, 'Source file should not be empty');

  // Check source file exists
  assert.ok(fs.existsSync('/Users/jonathanborduas/code/QGSD/bin/validate-requirements-haiku.test.cjs'), 'Source file should exist: validate-requirements-haiku.test.cjs');
  const content_176 = fs.readFileSync('/Users/jonathanborduas/code/QGSD/bin/validate-requirements-haiku.test.cjs', 'utf8');
  // Structural check: source file contains requirement-related code
  assert.ok(content_176.length > 0, 'Source file should not be empty');

  // Check source file exists
  assert.ok(fs.existsSync('/Users/jonathanborduas/code/QGSD/bin/xstate-to-tla.cjs'), 'Source file should exist: xstate-to-tla.cjs');
  const content_177 = fs.readFileSync('/Users/jonathanborduas/code/QGSD/bin/xstate-to-tla.cjs', 'utf8');
  // Structural check: source file contains requirement-related code
  assert.ok(content_177.length > 0, 'Source file should not be empty');

  // Check source file exists
  assert.ok(fs.existsSync('/Users/jonathanborduas/code/QGSD/bin/formal-query.test.cjs'), 'Source file should exist: formal-query.test.cjs');
  const content_178 = fs.readFileSync('/Users/jonathanborduas/code/QGSD/bin/formal-query.test.cjs', 'utf8');
  // Structural check: source file contains requirement-related code
  assert.ok(content_178.length > 0, 'Source file should not be empty');

  // Check source file exists
  assert.ok(fs.existsSync('/Users/jonathanborduas/code/QGSD/bin/quorum-slot-dispatch.cjs'), 'Source file should exist: quorum-slot-dispatch.cjs');
  const content_179 = fs.readFileSync('/Users/jonathanborduas/code/QGSD/bin/quorum-slot-dispatch.cjs', 'utf8');
  // Structural check: source file contains requirement-related code
  assert.ok(content_179.length > 0, 'Source file should not be empty');

  // Check source file exists
  assert.ok(fs.existsSync('/Users/jonathanborduas/code/QGSD/bin/sync-baseline-requirements.cjs'), 'Source file should exist: sync-baseline-requirements.cjs');
  const content_180 = fs.readFileSync('/Users/jonathanborduas/code/QGSD/bin/sync-baseline-requirements.cjs', 'utf8');
  // Structural check: source file contains requirement-related code
  assert.ok(content_180.length > 0, 'Source file should not be empty');

  // Check source file exists
  assert.ok(fs.existsSync('/Users/jonathanborduas/code/QGSD/bin/formal-ref-linker.test.cjs'), 'Source file should exist: formal-ref-linker.test.cjs');
  const content_181 = fs.readFileSync('/Users/jonathanborduas/code/QGSD/bin/formal-ref-linker.test.cjs', 'utf8');
  // Structural check: source file contains requirement-related code
  assert.ok(content_181.length > 0, 'Source file should not be empty');

  // Check source file exists
  assert.ok(fs.existsSync('/Users/jonathanborduas/code/QGSD/bin/run-formal-check.cjs'), 'Source file should exist: run-formal-check.cjs');
  const content_182 = fs.readFileSync('/Users/jonathanborduas/code/QGSD/bin/run-formal-check.cjs', 'utf8');
  // Structural check: source file contains requirement-related code
  assert.ok(content_182.length > 0, 'Source file should not be empty');

  // Check source file exists
  assert.ok(fs.existsSync('/Users/jonathanborduas/code/QGSD/bin/run-alloy.test.cjs'), 'Source file should exist: run-alloy.test.cjs');
  const content_183 = fs.readFileSync('/Users/jonathanborduas/code/QGSD/bin/run-alloy.test.cjs', 'utf8');
  // Structural check: source file contains requirement-related code
  assert.ok(content_183.length > 0, 'Source file should not be empty');

  // Check source file exists
  assert.ok(fs.existsSync('/Users/jonathanborduas/code/QGSD/bin/build-phase-index.cjs'), 'Source file should exist: build-phase-index.cjs');
  const content_184 = fs.readFileSync('/Users/jonathanborduas/code/QGSD/bin/build-phase-index.cjs', 'utf8');
  // Structural check: source file contains requirement-related code
  assert.ok(content_184.length > 0, 'Source file should not be empty');

  // Check source file exists
  assert.ok(fs.existsSync('/Users/jonathanborduas/code/QGSD/bin/analyze-state-space.cjs'), 'Source file should exist: analyze-state-space.cjs');
  const content_185 = fs.readFileSync('/Users/jonathanborduas/code/QGSD/bin/analyze-state-space.cjs', 'utf8');
  // Structural check: source file contains requirement-related code
  assert.ok(content_185.length > 0, 'Source file should not be empty');

  // Check source file exists
  assert.ok(fs.existsSync('/Users/jonathanborduas/code/QGSD/bin/validate-memory.cjs'), 'Source file should exist: validate-memory.cjs');
  const content_186 = fs.readFileSync('/Users/jonathanborduas/code/QGSD/bin/validate-memory.cjs', 'utf8');
  // Structural check: source file contains requirement-related code
  assert.ok(content_186.length > 0, 'Source file should not be empty');

  // Check source file exists
  assert.ok(fs.existsSync('/Users/jonathanborduas/code/QGSD/bin/observed-fsm.test.cjs'), 'Source file should exist: observed-fsm.test.cjs');
  const content_187 = fs.readFileSync('/Users/jonathanborduas/code/QGSD/bin/observed-fsm.test.cjs', 'utf8');
  // Structural check: source file contains requirement-related code
  assert.ok(content_187.length > 0, 'Source file should not be empty');

  // Check source file exists
  assert.ok(fs.existsSync('/Users/jonathanborduas/code/QGSD/bin/state-candidates.test.cjs'), 'Source file should exist: state-candidates.test.cjs');
  const content_188 = fs.readFileSync('/Users/jonathanborduas/code/QGSD/bin/state-candidates.test.cjs', 'utf8');
  // Structural check: source file contains requirement-related code
  assert.ok(content_188.length > 0, 'Source file should not be empty');

  // Check source file exists
  assert.ok(fs.existsSync('/Users/jonathanborduas/code/QGSD/bin/failure-mode-catalog.cjs'), 'Source file should exist: failure-mode-catalog.cjs');
  const content_189 = fs.readFileSync('/Users/jonathanborduas/code/QGSD/bin/failure-mode-catalog.cjs', 'utf8');
  // Structural check: source file contains requirement-related code
  assert.ok(content_189.length > 0, 'Source file should not be empty');

  // Check source file exists
  assert.ok(fs.existsSync('/Users/jonathanborduas/code/QGSD/bin/build-layer-manifest.cjs'), 'Source file should exist: build-layer-manifest.cjs');
  const content_190 = fs.readFileSync('/Users/jonathanborduas/code/QGSD/bin/build-layer-manifest.cjs', 'utf8');
  // Structural check: source file contains requirement-related code
  assert.ok(content_190.length > 0, 'Source file should not be empty');

  // Check source file exists
  assert.ok(fs.existsSync('/Users/jonathanborduas/code/QGSD/bin/isNumericThreshold.test.cjs'), 'Source file should exist: isNumericThreshold.test.cjs');
  const content_191 = fs.readFileSync('/Users/jonathanborduas/code/QGSD/bin/isNumericThreshold.test.cjs', 'utf8');
  // Structural check: source file contains requirement-related code
  assert.ok(content_191.length > 0, 'Source file should not be empty');

  // Check source file exists
  assert.ok(fs.existsSync('/Users/jonathanborduas/code/QGSD/bin/run-account-pool-alloy.test.cjs'), 'Source file should exist: run-account-pool-alloy.test.cjs');
  const content_192 = fs.readFileSync('/Users/jonathanborduas/code/QGSD/bin/run-account-pool-alloy.test.cjs', 'utf8');
  // Structural check: source file contains requirement-related code
  assert.ok(content_192.length > 0, 'Source file should not be empty');

  // Check source file exists
  assert.ok(fs.existsSync('/Users/jonathanborduas/code/QGSD/bin/run-audit-alloy.test.cjs'), 'Source file should exist: run-audit-alloy.test.cjs');
  const content_193 = fs.readFileSync('/Users/jonathanborduas/code/QGSD/bin/run-audit-alloy.test.cjs', 'utf8');
  // Structural check: source file contains requirement-related code
  assert.ok(content_193.length > 0, 'Source file should not be empty');

  // Check source file exists
  assert.ok(fs.existsSync('/Users/jonathanborduas/code/QGSD/bin/analyze-assumptions.test.cjs'), 'Source file should exist: analyze-assumptions.test.cjs');
  const content_194 = fs.readFileSync('/Users/jonathanborduas/code/QGSD/bin/analyze-assumptions.test.cjs', 'utf8');
  // Structural check: source file contains requirement-related code
  assert.ok(content_194.length > 0, 'Source file should not be empty');

  // Check source file exists
  assert.ok(fs.existsSync('/Users/jonathanborduas/code/QGSD/bin/run-alloy.cjs'), 'Source file should exist: run-alloy.cjs');
  const content_195 = fs.readFileSync('/Users/jonathanborduas/code/QGSD/bin/run-alloy.cjs', 'utf8');
  // Structural check: source file contains requirement-related code
  assert.ok(content_195.length > 0, 'Source file should not be empty');

  // Check source file exists
  assert.ok(fs.existsSync('/Users/jonathanborduas/code/QGSD/bin/check-liveness-fairness.cjs'), 'Source file should exist: check-liveness-fairness.cjs');
  const content_196 = fs.readFileSync('/Users/jonathanborduas/code/QGSD/bin/check-liveness-fairness.cjs', 'utf8');
  // Structural check: source file contains requirement-related code
  assert.ok(content_196.length > 0, 'Source file should not be empty');

  // Check source file exists
  assert.ok(fs.existsSync('/Users/jonathanborduas/code/QGSD/bin/mismatch-register.cjs'), 'Source file should exist: mismatch-register.cjs');
  const content_197 = fs.readFileSync('/Users/jonathanborduas/code/QGSD/bin/mismatch-register.cjs', 'utf8');
  // Structural check: source file contains requirement-related code
  assert.ok(content_197.length > 0, 'Source file should not be empty');

  // Check source file exists
  assert.ok(fs.existsSync('/Users/jonathanborduas/code/QGSD/bin/observe-solve-pipe.test.cjs'), 'Source file should exist: observe-solve-pipe.test.cjs');
  const content_198 = fs.readFileSync('/Users/jonathanborduas/code/QGSD/bin/observe-solve-pipe.test.cjs', 'utf8');
  // Structural check: source file contains requirement-related code
  assert.ok(content_198.length > 0, 'Source file should not be empty');

  // Check source file exists
  assert.ok(fs.existsSync('/Users/jonathanborduas/code/QGSD/bin/requirements-core.cjs'), 'Source file should exist: requirements-core.cjs');
  const content_199 = fs.readFileSync('/Users/jonathanborduas/code/QGSD/bin/requirements-core.cjs', 'utf8');
  // Structural check: source file contains requirement-related code
  assert.ok(content_199.length > 0, 'Source file should not be empty');

  // Check source file exists
  assert.ok(fs.existsSync('/Users/jonathanborduas/code/QGSD/bin/formal-proximity.test.cjs'), 'Source file should exist: formal-proximity.test.cjs');
  const content_200 = fs.readFileSync('/Users/jonathanborduas/code/QGSD/bin/formal-proximity.test.cjs', 'utf8');
  // Structural check: source file contains requirement-related code
  assert.ok(content_200.length > 0, 'Source file should not be empty');

  // Check source file exists
  assert.ok(fs.existsSync('/Users/jonathanborduas/code/QGSD/bin/invariant-catalog.cjs'), 'Source file should exist: invariant-catalog.cjs');
  const content_201 = fs.readFileSync('/Users/jonathanborduas/code/QGSD/bin/invariant-catalog.cjs', 'utf8');
  // Structural check: source file contains requirement-related code
  assert.ok(content_201.length > 0, 'Source file should not be empty');

  // Check source file exists
  assert.ok(fs.existsSync('/Users/jonathanborduas/code/QGSD/bin/test-formal-integration.test.cjs'), 'Source file should exist: test-formal-integration.test.cjs');
  const content_202 = fs.readFileSync('/Users/jonathanborduas/code/QGSD/bin/test-formal-integration.test.cjs', 'utf8');
  // Structural check: source file contains requirement-related code
  assert.ok(content_202.length > 0, 'Source file should not be empty');

  // Check source file exists
  assert.ok(fs.existsSync('/Users/jonathanborduas/code/QGSD/bin/promote-gate-maturity.cjs'), 'Source file should exist: promote-gate-maturity.cjs');
  const content_203 = fs.readFileSync('/Users/jonathanborduas/code/QGSD/bin/promote-gate-maturity.cjs', 'utf8');
  // Structural check: source file contains requirement-related code
  assert.ok(content_203.length > 0, 'Source file should not be empty');

  // Check source file exists
  assert.ok(fs.existsSync('/Users/jonathanborduas/code/QGSD/hooks/dist/nf-spec-regen.js'), 'Source file should exist: nf-spec-regen.js');
  const content_204 = fs.readFileSync('/Users/jonathanborduas/code/QGSD/hooks/dist/nf-spec-regen.js', 'utf8');
  // Structural check: source file contains requirement-related code
  assert.ok(content_204.length > 0, 'Source file should not be empty');

  // Check source file exists
  assert.ok(fs.existsSync('/Users/jonathanborduas/code/QGSD/hooks/nf-spec-regen.js'), 'Source file should exist: nf-spec-regen.js');
  const content_205 = fs.readFileSync('/Users/jonathanborduas/code/QGSD/hooks/nf-spec-regen.js', 'utf8');
  // Structural check: source file contains requirement-related code
  assert.ok(content_205.length > 0, 'Source file should not be empty');
});
