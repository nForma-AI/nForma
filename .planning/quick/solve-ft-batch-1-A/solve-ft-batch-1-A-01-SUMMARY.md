---
phase: solve-ft-batch-1-A
plan: 01
subsystem: testing
tags: [formal-verification, test-stubs, node-test, structural, constant]

requires:
  - phase: none
    provides: existing source modules and formal models
provides:
  - 5 implemented formal-test-sync stub tests covering EVID-03, GUARD-01, NAV-04, SPEC-05, STATE-05
affects: [formal-test-sync, unit-test-coverage]

tech-stack:
  added: []
  patterns: [source-grep for TUI modules that cannot be required, structural export verification, constant content matching]

key-files:
  created:
    - .planning/formal/generated-stubs/EVID-03.stub.test.js
    - .planning/formal/generated-stubs/GUARD-01.stub.test.js
    - .planning/formal/generated-stubs/NAV-04.stub.test.js
    - .planning/formal/generated-stubs/SPEC-05.stub.test.js
    - .planning/formal/generated-stubs/STATE-05.stub.test.js
  modified: []

key-decisions:
  - "NAV-04 uses source-grep instead of require because nForma.cjs launches blessed TUI on import"
  - "GUARD-01 verifies all three guardrails: post-edit-format hook, console-guard hook, and .claude/rules/ directory"

patterns-established:
  - "Source-grep strategy: read file content and assert.match for modules with side effects on require"

requirements-completed: [EVID-03, GUARD-01, NAV-04, SPEC-05, STATE-05]

duration: 3min
completed: 2026-03-07
---

# Solve FT Batch 1-A Plan 01: Implement 5 Formal-Test-Sync Stub Tests Summary

**29 passing tests across 5 stubs using structural and constant strategies against real source modules and formal models**

## Performance

- **Duration:** 3 min
- **Started:** 2026-03-07T09:43:12Z
- **Completed:** 2026-03-07T09:46:24Z
- **Tasks:** 1/1
- **Files modified:** 5

## Accomplishments

### Task 1: Implement stubs EVID-03, GUARD-01, NAV-04, SPEC-05, STATE-05

| Stub | Strategy | Tests | Source Module |
|------|----------|-------|---------------|
| EVID-03 | structural | 7 | bin/git-heatmap.cjs — verifies exports for numerical adjustments, bugfix hotspots, churn ranking, priority scoring, coverage cross-ref |
| GUARD-01 | structural | 7 | hooks/nf-post-edit-format.js, hooks/nf-console-guard.js, .claude/rules/ — verifies three guardrail hooks exist and are fail-open |
| NAV-04 | structural (source-grep) | 7 | bin/nForma.cjs — verifies session persistence functions and SESSIONS_FILE constant via source content matching |
| SPEC-05 | constant | 4 | bin/formal-scope-scan.cjs — verifies scope.json usage with concepts, source_files, and three matching strategies |
| STATE-05 | constant | 4 | core/workflows/execute-plan.md — verifies Route C chains into /nf:audit-milestone |

**Commit:** 472660ea

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] NAV-04 strategy changed from require to source-grep**
- **Found during:** Task 1
- **Issue:** nForma.cjs launches a blessed TUI on require, making it impossible to import for structural testing
- **Fix:** Used fs.readFileSync + assert.match to verify function definitions and exports in source text
- **Files modified:** .planning/formal/generated-stubs/NAV-04.stub.test.js

## Verification

All 29 tests pass:
```
node --test .planning/formal/generated-stubs/{EVID-03,GUARD-01,NAV-04,SPEC-05,STATE-05}.stub.test.js
# pass 29, fail 0
```
