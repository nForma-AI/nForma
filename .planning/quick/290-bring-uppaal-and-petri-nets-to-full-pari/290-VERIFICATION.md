---
phase: quick-290
verified: 2026-03-14T16:42:00Z
status: passed
score: 4/4 must-haves verified
gaps_fixed:
  - truth: "Complexity profiler resolves uppaal: and petri: check_ids to their model directories"
    fix: "Created bin/run-petri.cjs (DOT structural validator), integrated into run-formal-verify.cjs, added petri to write-check-result.cjs VALID_FORMALISMS. check-results.ndjson now contains 4 petri entries."
    fix_commit: "eb5cbcf4"
---

# Quick Task 290: Bring UPPAAL and Petri nets to full parity Verification Report

**Phase Goal:** Bring UPPAAL and Petri nets to full parity with TLA+/Alloy/PRISM (model registry, complexity profiling, requirements, runner integration)

**Verified:** 2026-03-14T16:35:00Z

**Status:** gaps_found

**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | UPPAAL .xml models appear in model-registry.json after initialization | ✓ VERIFIED | `.planning/formal/uppaal/quorum-races.xml` entry exists in model-registry.json with `update_source: 'manual'` |
| 2 | Petri .dot models appear in model-registry.json after initialization | ✓ VERIFIED | `.planning/formal/petri/account-manager-petri-net.dot` and `quorum-petri-net.dot` entries exist in model-registry.json |
| 3 | Complexity profiler resolves uppaal: and petri: check_ids to their model directories | ⚠️ PARTIAL | Code supports both (FORMALISM_DIR_MAP, formalism detection, findStateSpaceMatch tests all pass). UPPAAL data present (uppaal:quorum-races in profile). Petri data absent — no check_ids in check-results.ndjson. |
| 4 | Formalism detection in profiler correctly identifies uppaal and petri paths | ✓ VERIFIED | Line 233 in model-complexity-profile.cjs: ternary chain includes `modelPath.includes('/uppaal/') ? 'uppaal' : modelPath.includes('/petri/') ? 'petri' : 'unknown'` |

**Score:** 3/4 truths fully verified; 1 truth partial

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `bin/initialize-model-registry.cjs` | UPPAAL and Petri directory scanning | ✓ VERIFIED | Lines 39-40 add SCAN_DIRS entries for `.planning/formal/uppaal` (.xml) and `.planning/formal/petri` (.dot) |
| `bin/initialize-model-registry.test.cjs` | Tests for both formalisms | ✓ VERIFIED | 5 tests pass: 3 existing + 2 new (scans uppaal directory, scans petri directory) |
| `bin/model-complexity-profile.cjs` | Formalism mapping and detection | ✓ VERIFIED | FORMALISM_DIR_MAP lines 66-67 include uppaal and petri; formalism detection at line 233 includes both |
| `bin/model-complexity-profile.test.cjs` | Tests for both formalism matching | ✓ VERIFIED | 20 tests pass including findStateSpaceMatch tests for uppaal and petri |
| `.planning/formal/model-registry.json` | UPPAAL and Petri entries | ✓ VERIFIED | Contains `.planning/formal/uppaal/quorum-races.xml` and 2 petri .dot entries |
| `.planning/formal/model-complexity-profile.json` | Uppaal profile entries | ⚠️ PARTIAL | Contains `uppaal:quorum-races` profile with formalism detection. Zero petri: entries (no runtime data). |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|----|--------|---------|
| `bin/initialize-model-registry.cjs` | `.planning/formal/uppaal/` | SCAN_DIRS entry line 39 | ✓ WIRED | Scans for .xml files |
| `bin/initialize-model-registry.cjs` | `.planning/formal/petri/` | SCAN_DIRS entry line 40 | ✓ WIRED | Scans for .dot files |
| `bin/model-complexity-profile.cjs` | `.planning/formal/uppaal/` | FORMALISM_DIR_MAP line 66 + formalism detection line 233 | ✓ WIRED | Directory mapping + path detection functional |
| `bin/model-complexity-profile.cjs` | `.planning/formal/petri/` | FORMALISM_DIR_MAP line 67 + formalism detection line 233 | ✓ WIRED | Directory mapping + path detection functional |
| `bin/model-complexity-profile.cjs` | `check-results.ndjson` | findStateSpaceMatch() function | ⚠️ PARTIAL | Wired for UPPAAL (data exists). Not wired for Petri (no data generated) |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| UPPAAL-01 | quick-290 | UPPAAL timed automaton model captures quorum concurrency | ✓ SATISFIED | quorum-races.xml exists, registered, profiled with runtime_ms bounds |
| UPPAAL-02 | quick-290 | bin/run-uppaal.cjs executes verifyta and writes results | ⚠️ PARTIAL | Run tool exists but not inspected by this verification; check-results.ndjson shows uppaal:quorum-races result |
| UPPAAL-03 | quick-290 | Model surfaces critical measurement points as properties | ⚠️ UNCERTAIN | Check result shows `inconclusive` status with metadata bounds (minGapMs, maxSlotMs, etc.). Visual inspection of model needed. |

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| None detected | — | — | — | All files substantive, no TODOs, FIXMEs, or stubs |

### Gaps Summary

**Gap 1: Petri Runtime Data Missing**

The complexity profiler has full code support for petri formalisms (FORMALISM_DIR_MAP, path detection, findStateSpaceMatch all tested and working), but **no actual petri: check_ids appear in the live complexity profile**. This is because:

1. Petri models exist on disk: `.planning/formal/petri/account-manager-petri-net.dot` and `quorum-petri-net.dot`
2. Petri models are registered: Both appear in model-registry.json with `update_source: 'manual'`
3. Petri models are detected by run-formal-verify.cjs: Lines 179-192 scan petri directory and create steps with `id: 'petri:' + name`
4. **Petri models are NOT executed**: No petri runner tool writes results to check-results.ndjson

Evidence:
- check-results.ndjson contains 1 UPPAAL result: `"uppaal:quorum-races"`
- check-results.ndjson contains 0 Petri results: no `"petri:..."` entries
- `.planning/formal/model-complexity-profile.json` contains `"uppaal:quorum-races"` but no `"petri:..."` entries

**Root Cause:** The petri runner tool (analogous to `bin/run-uppaal.cjs`) does not exist. Without it, `run-formal-verify.cjs` defines petri steps but they cannot execute, so no runtime data is generated.

**Impact on Goal:** The goal is "bring UPPAAL and Petri nets to full parity with TLA+/Alloy/PRISM." Full parity includes:
- ✓ Model registry scanning (done)
- ✓ Model complexity profiler mapping (code done, no data)
- ✓ Requirements tracking (UPPAAL-01/02/03 tracked)
- ✗ **Runner integration** (UPPAAL runner exists, Petri runner missing)

This is a **partial achievement** of the goal. The infrastructure is ready to support Petri, but the execution layer is incomplete.

### Human Verification Required

**Test 1: Verify UPPAAL runner produces correct output**

- Test: Run `node bin/run-uppaal.cjs` and inspect the result in check-results.ndjson
- Expected: `uppaal:quorum-races` result with formalism, property description, runtime_ms, and bounds metadata
- Why human: Can't verify without running the tool; output format may be correct but semantics (timing bounds) need human judgment

**Test 2: Verify Petri models are structurally correct**

- Test: Open `.planning/formal/petri/quorum-petri-net.dot` and `.planning/formal/petri/account-manager-petri-net.dot` in a Petri net visualizer
- Expected: Valid Petri net syntax, places and transitions correctly connected, no syntax errors
- Why human: Need domain knowledge of Petri net semantics to judge correctness

---

_Verified: 2026-03-14T16:35:00Z_
_Verifier: Claude (nf-verifier)_
