---
phase: solve-ft-batch-2-C
plan: 01
subsystem: formal-verification
tags: [test-stubs, formal-traceability, annotations]
dependency_graph:
  requires: [extract-annotations.cjs, model-registry.json, QGSDAgentLoop.tla]
  provides: [AGT-01-coverage, ANNOT-01-coverage, ANNOT-02-coverage, ANNOT-03-coverage, ANNOT-04-coverage]
  affects: [unit-test-coverage.json]
tech_stack:
  added: []
  patterns: [source-grep structural, import-and-call behavioral, node:test]
key_files:
  created: []
  modified:
    - .planning/formal/generated-stubs/AGT-01.stub.test.js
    - .planning/formal/generated-stubs/ANNOT-01.stub.test.js
    - .planning/formal/generated-stubs/ANNOT-02.stub.test.js
    - .planning/formal/generated-stubs/ANNOT-03.stub.test.js
    - .planning/formal/generated-stubs/ANNOT-04.stub.test.js
decisions: []
metrics:
  tasks_completed: 1
  tasks_total: 1
  tests_passing: 8
  completed: 2026-03-08
---

# solve-ft-batch-2-C Plan 01: Implement Test Stubs Summary

Structural and behavioral tests for agent loop TypeOK invariant and annotation traceability across TLA+, Alloy, and PRISM model files.

## Completed Tasks

| Task | Name | Commit | Files |
| ---- | ---- | ------ | ----- |
| 1 | Implement stubs: AGT-01, ANNOT-01..04 | 5e88d1b7 | AGT-01.stub.test.js, ANNOT-01..04.stub.test.js |

## Implementation Details

**AGT-01** (structural): Reads QGSDAgentLoop.tla and asserts TypeOK invariant exists with correct state space -- status in {running, success, cap_exhausted, unrecoverable}, iteration bounded by MaxIterations, and @requirement AGT-01 annotation present.

**ANNOT-01** (structural): Scans all TLA+ model files from model-registry.json (excluding TTrace files), asserts every file contains at least one @requirement annotation. Validates >= 11 TLA+ model files exist.

**ANNOT-02** (structural): Scans all Alloy model files from model-registry.json, asserts every .als file contains `-- @requirement` annotations. Validates >= 8 Alloy files exist.

**ANNOT-03** (structural): Discovers PRISM .props files as siblings of .pm files in model-registry.json, asserts every .props file contains `// @requirement` annotations. Validates >= 3 PRISM props files exist.

**ANNOT-04** (behavioral): Tests the three parser functions (parseTLA, parseAlloy, parsePRISM) with synthetic input and verifies correct property/requirement_ids extraction. Also calls extractAnnotations() end-to-end, asserting the returned map has correct shape: `{ model_file: [{ property, requirement_ids }] }`.

## Deviations from Plan

None -- plan executed exactly as written.

## Verification

All 8 tests passing (0 failures). No `assert.fail('TODO')` remains.
