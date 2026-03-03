---
task: quick-141
title: "Fix solver loop bugs: parseAlloyDefaults parsing, stale cache invalidation"
date: 2026-03-03
status: Complete
commit: ed8df4cf
---

# Quick Task 141 Summary

## Objective
Fix two bugs in the consistency solver loop:
1. `parseAlloyDefaults()` splits on comma instead of newline, causing only the first constant to be parsed from Alloy constraint blocks
2. `formalTestSyncCache` is never cleared between solver iterations, causing stale data after `autoClose()` mutates files

## Changes Made

### Task 1: Fixed parseAlloyDefaults and added module exports
**File:** `bin/formal-test-sync.cjs`

- **Changed line 205** from `split(',')` to `split('\n').filter(line => { const t = line.trim(); return t.length > 0 && !t.startsWith('--') && !t.startsWith('//'); })`
  - Now correctly splits on newlines instead of commas
  - Filters out blank lines and Alloy comment lines (starting with `--` or `//`)

- **Updated regex on line 208** from `/(\w+)\s*=\s*(.+)/` to `/^\s*(\w+)\s*=\s*(\S+)\s*$/`
  - Added anchors `^` and `$` to match entire line
  - Changed `.+` to `\S+` to avoid greedy multi-line capture

- **Added exports and require.main guard at end of file** (replacing bare `main()` call)
  - `module.exports = { parseAlloyDefaults };` allows importing for testing
  - `if (require.main === module) { main(); }` prevents main() execution on require()

### Task 2: Fixed stale cache and added unit tests
**Files:** `bin/qgsd-solve.cjs`, `bin/formal-test-sync.test.cjs`

**Cache Invalidation (qgsd-solve.cjs):**
- Added `formalTestSyncCache = null;` at top of solver loop (line 694), right after iteration stderr write and before `computeResidual()` call
- Ensures each iteration fetches fresh formal-test-sync results after `autoClose()` mutations

**Unit Tests (formal-test-sync.test.cjs):**
- Added 4 new TC-ALLOY-PARSE tests between TC-STUB and TC-INT sections
- TC-ALLOY-PARSE-1: Parses all 3 constants from realistic newline-separated Alloy constraint block matching `.formal/alloy/config-two-layer.als` format
- TC-ALLOY-PARSE-2: Returns empty object when no Defaults sig found (edge case)
- TC-ALLOY-PARSE-3: Handles single constant (edge case)
- TC-ALLOY-PARSE-4: Handles blank lines and Alloy comment lines within constraint block (robustness)

## Verification Results

### parseAlloyDefaults Fix
- ✓ Parses all 3 constants from test block: `defaultOscDepth=3, defaultCommitWindow=6, defaultFailMode=FailOpen`
- ✓ Parses all 3 constants from real `.formal/alloy/config-two-layer.als` file
- ✓ Module exports work correctly: `require('./formal-test-sync.cjs')` returns function without executing main()
- ✓ Main script still works: `node bin/formal-test-sync.cjs --json --report-only` exits 0 with valid JSON

### Cache Invalidation
- ✓ Cache invalidation count is 4: 1 initialization + 2 in loadFormalTestSync + 1 in solver loop
- ✓ New invalidation on line 694 appears BEFORE `computeResidual()` call on line 696 within loop body

### Unit Tests
- ✓ All 24 tests pass (20 existing + 4 new TC-ALLOY-PARSE)
- ✓ TC-ALLOY-PARSE-1 passes: all 3 constants parsed correctly
- ✓ TC-ALLOY-PARSE-2 passes: empty object on no match
- ✓ TC-ALLOY-PARSE-3 passes: single constant handled
- ✓ TC-ALLOY-PARSE-4 passes: blank lines and comments skipped correctly

## Test Results
```
ℹ tests 24
ℹ pass 24
ℹ fail 0
```

All existing tests continue to pass (no regression). New tests verify:
- Multi-line Alloy constraint block parsing works correctly
- Edge cases (no Defaults sig, single constant) handled gracefully
- Robustness with blank lines and inline comments

## Deviations from Plan
None — plan executed exactly as written.

## Technical Notes

The `parseAlloyDefaults()` function now correctly handles the Alloy file format which uses newline-separated field assignments within constraint blocks, not comma-separated values. The filter step ensures that:
- Blank lines don't cause regex mismatches
- Alloy comment lines (`--`) and C-style comment lines (`//`) are skipped
- Only actual `key = value` pairs are parsed

The cache invalidation in the solver loop ensures that multi-iteration solving reads fresh results from `formal-test-sync.cjs` after each `autoClose()` pass that mutates files. Without this, the C->F residual layer would report stale constant mismatches.

## Impact
- Solver's C->F residual layer now correctly reports all 3 Alloy default constant mismatches (previously only reported 1)
- Multi-iteration solver sweeps now read fresh formal-test-sync results instead of stale cached data
- Tests provide regression protection for both parsing and residual computation
