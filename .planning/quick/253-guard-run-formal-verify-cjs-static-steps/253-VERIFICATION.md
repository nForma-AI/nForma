---
task: quick-253
verified: 2026-03-10T18:34:00Z
status: passed
score: 4/4 must-haves verified
---

# Quick Task 253: Guard run-formal-verify.cjs static steps — Verification Report

**Task Goal:** Guard run-formal-verify.cjs static steps to only run in nForma repo — prevent cross-repo contamination of internal models (quorum-votes.als, NFQuorum.tla, etc.) into target repos

**Verified:** 2026-03-10
**Status:** PASSED
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | When run-formal-verify.cjs executes in a non-nForma repo, nForma-internal static steps are skipped | ✓ VERIFIED | Test 1 passes: tmpdir without XState machine triggers "Non-nForma repo detected" + 6 skip logs. Filtering logic at line 430-440 removes all nformaOnly=true steps from STEPS array. |
| 2 | When run-formal-verify.cjs executes in nForma repo (src/machines/nf-workflow.machine.ts exists), all static steps run as before | ✓ VERIFIED | Test 2 passes: `--only=generate --project-root=QGSD_ROOT` shows no skip message. Marker file exists at /Users/jonathanborduas/code/QGSD/src/machines/nf-workflow.machine.ts. isNformaRepo detection correctly identifies the repo. |
| 3 | Skipped steps are logged with clear reason | ✓ VERIFIED | Lines 434-438 output formatted skip logs: TAG + ' skip: ' + s.id + ' (' + s.label + ')' for each nformaOnly step. Test 1 asserts all 6 step IDs appear in output. |
| 4 | Dynamic discovery steps still run in any repo | ✓ VERIFIED | Dynamic steps added after filtering (line 427) are not marked nformaOnly. Generic steps like ci:liveness-fairness-lint (line 372), ci:triage-bundle (line 385), traceability:* (lines 393-409), gates:* (line 413) have no nformaOnly marker and survive filtering in non-nForma repos. |

**Score:** 4/4 truths verified

---

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `bin/run-formal-verify.cjs` | nForma-repo detection guard on STATIC_STEPS, contains "nformaOnly" property | ✓ VERIFIED | Line 70: isNformaRepo detection. Lines 341, 347, 355, 363, 369, 380: Six STATIC_STEPS entries marked `nformaOnly: true`. Line 433: Filtering removes nformaOnly steps. Syntax check: `node -c bin/run-formal-verify.cjs` passes. |
| `test/run-formal-verify-guard.test.cjs` | Test proving guard filters nForma-only steps in non-nForma repos, min 30 lines | ✓ VERIFIED | File exists with 77 lines. Two test cases: (1) tmpdir without machine → asserts skip logs, (2) QGSD repo → asserts no skip message. Both use `node:test` + `node:assert`. Test run: 2 pass, 0 fail. |

---

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|----|--------|---------|
| `bin/run-formal-verify.cjs` | `src/machines/nf-workflow.machine.ts` | `fs.existsSync` marker check | ✓ WIRED | Line 70: `const isNformaRepo = fs.existsSync(path.join(ROOT, 'src', 'machines', 'nf-workflow.machine.ts'))`. Marker file exists. isNformaRepo used immediately in line 430 condition `if (!isNformaRepo)` to trigger filtering. Test 1 confirms: tmpdir without marker triggers filter; Test 2 confirms: real repo with marker skips filter. |

---

### Implementation Details

**nForma-repo Detection (Line 70):**
```javascript
const isNformaRepo = fs.existsSync(path.join(ROOT, 'src', 'machines', 'nf-workflow.machine.ts'));
```
Uses canonical marker file for nForma repo. Any repo lacking this file is treated as external.

**nForma-Only Steps Tagged (6 steps):**
1. `generate:tla-from-xstate` (line 341) — XState → TLA+ spec generation
2. `generate:alloy-prism-specs` (line 347) — XState → Alloy/PRISM specs (quorum-votes.als)
3. `petri:quorum` (line 355) — Petri net generation
4. `ci:trace-redaction` (line 363) — nForma trace redaction enforcement
5. `ci:trace-schema-drift` (line 369) — nForma trace schema validation
6. `ci:conformance-traces` (line 380) — XState machine replay validation

**Generic Steps NOT Tagged (preserved in all repos):**
- `ci:liveness-fairness-lint` (line 372) — Works in any repo with TLA+ files
- `ci:triage-bundle` (line 385) — Generic diff/suspects analysis
- `traceability:matrix`, `traceability:coverage-guard`, `traceability:state-space` (lines 393-409) — Generic coverage checking
- `gates:per-model-aggregate` (line 413) — Generic gate computation

**Filtering Logic (Lines 430-440):**
```javascript
if (!isNformaRepo) {
  const before = STEPS.length;
  const skipped = STEPS.filter(s => s.nformaOnly);
  STEPS = STEPS.filter(s => !s.nformaOnly);
  if (skipped.length > 0) {
    process.stdout.write(TAG + ' Non-nForma repo detected — skipping ' + skipped.length + ' nForma-internal step(s)\n');
    for (const s of skipped) {
      process.stdout.write(TAG + '   skip: ' + s.id + ' (' + s.label + ')\n');
    }
  }
}
```
Removes nformaOnly steps, logs each with ID and label for clarity.

---

### Test Coverage

**Test 1: Non-nForma Repo Scenario**
- Creates tmpdir with `.planning/formal/` but no `src/machines/nf-workflow.machine.ts`
- Runs `node bin/run-formal-verify.cjs --project-root=<tmpdir>`
- Asserts: "Non-nForma repo detected" message appears
- Asserts: All 6 nformaOnly step IDs logged in skip list
- Timeout: 30s (acceptable for spawned processes)
- Result: PASS

**Test 2: nForma Repo Scenario**
- Uses real QGSD repo (marker file present)
- Runs `node bin/run-formal-verify.cjs --only=generate --project-root=QGSD_ROOT`
- Asserts: No "Non-nForma repo detected" message
- Asserts: `generate:tla-from-xstate` appears in output (not skipped)
- Timeout: 30s
- Result: PASS

**Test Execution Results:**
```
▶ run-formal-verify nForma-repo guard
  ✔ skips nformaOnly steps when XState machine is absent (2284.815833ms)
  ✔ runs all steps when XState machine is present (nForma repo) (576.074833ms)
✔ run-formal-verify nForma-repo guard (2861.647084ms)
✓ tests 2
✓ pass 2
✓ fail 0
```

---

### Requirements Alignment

**Requirement:** SAFE-02 (from plan frontmatter)

Task guards against safety violation: running nForma-internal model generation in external repos contaminates those repos with nForma artifacts and creates false F→C gaps in subsequent solve cycles. By skipping these 6 steps in non-nForma repos, the guard ensures:
- No quorum-votes.als, NFQuorum.tla, Petri nets generated into target repos
- No trace redaction/schema drift checks contaminate external formal directories
- Generic formal verification (liveness lint, gates, traceability) still available for external repos

SAFE-02 satisfaction: Verified — implementation prevents unsafe artifact cross-repo contamination.

---

### Formal Verification Notes

**Formal Scope:** agent-loop, safety modules not applicable — this task modifies the verification runner itself, not formal models.

**Formal Check Result:** `{"passed":0,"failed":0,"skipped":0,"counterexamples":[]}` — No formal models matched. This is expected; formal verification applies to generated TLA+/Alloy models, not to the runner script.

**Implementation Sound:** The guard is straightforward file-system logic (existsSync check + array filtering), requires no formal proof of correctness. The test suite provides empirical confidence.

---

## Anti-Patterns Scan

No blocker or warning anti-patterns found:
- No TODO/FIXME comments in modified code
- No empty implementations or stub functions
- No console.log-only handlers
- Filtering logic is complete and tested
- Skip logging is user-visible and informative

---

## Human Verification Required

None — all verifiable aspects confirmed programmatically.

---

## Summary

**Status: PASSED**

All 4 must-haves verified:
1. ✓ Non-nForma repos skip 6 nForma-internal steps with clear logging
2. ✓ nForma repo preserves full execution (no steps skipped)
3. ✓ Skip reasons logged for each step
4. ✓ Generic steps remain available in all repos

**Implementation quality:**
- Syntax valid (node -c passes)
- Test suite comprehensive (2 tests, both pass, 2861ms total)
- Logic correct: isNformaRepo detection + filtering + logging all verified
- No regressions: existing behavior in nForma repo unchanged
- Clear separation: 6 nForma-only vs 7 generic steps

**Impact:** Prevents cross-repo contamination of nForma formal models when `/nf:solve` runs in target repos. Requirement SAFE-02 satisfied.

---

_Verified: 2026-03-10T18:34:00Z_
_Verifier: Claude (nf-verifier)_
