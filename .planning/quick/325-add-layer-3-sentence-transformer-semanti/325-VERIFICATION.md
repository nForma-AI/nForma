---
phase: quick-325
verified: 2026-03-18T22:30:00Z
status: passed
score: 6/6 must-haves verified
---

# Quick Task 325: Add Layer 3+4 to formal-scope-scan.cjs — Verification Report

**Task Goal:** Add Layer 3 (sentence transformer semantic similarity) and Layer 4 (Claude CLI agentic search) to formal-scope-scan.cjs with graceful fallback when optional dependencies are absent.

**Verified:** 2026-03-18T22:30:00Z

**Status:** PASSED

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Layer 3 runs only when layers 1+2 return zero matches, computing cosine similarity against concatenated scope concepts | ✓ VERIFIED | Implementation at lines 1008-1019: `if (enriched.length === 0 && !args.noL3)` runs Layer 3; Layer 3 concatenates concepts and computes similarity via `cosineSim(queryVec, modVec)` |
| 2 | Layer 4 runs only when layers 1+2+3 return zero matches AND --l4 flag is set | ✓ VERIFIED | Implementation at line 1022: `if (finalMatches.length === 0 && args.l4)` ensures conditional execution only when all prior layers fail AND flag is set |
| 3 | Layer 4 is disabled by default; --l4 flag opts in | ✓ VERIFIED | Line 71: `l4: false` default in parseArgs(); flag parser at line 92 sets `args.l4 = true` only when provided |
| 4 | Both layers integrate cleanly with --format lines and --format json output modes | ✓ VERIFIED | Lines 1026-1032 output block uses `finalMatches` for both formats; verified by CLI test: layers 1+2 output unchanged, new layers use same `matched_by` field |
| 5 | Layer 3 and 4 matches include matched_by field set to 'semantic' and 'agentic' respectively | ✓ VERIFIED | Line 809: Layer 3 sets `matched_by: 'semantic'`; line 881: Layer 4 sets `matched_by: 'agentic'` |
| 6 | Graceful fallback: if @huggingface/transformers unavailable or claude CLI absent/timeout, layers skip silently with stderr warning | ✓ VERIFIED | Layer 3 lines 786-792: try/catch on `await import()` writes stderr warning and returns []; Layer 4 lines 848-858: try/catch on execFileSync distinguishes ENOENT vs timeout, writes appropriate stderr warning, returns [] |

**Score:** 6/6 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `bin/formal-scope-scan.cjs` | Extended scope scan with Layer 3 (semantic) and Layer 4 (agentic) | ✓ VERIFIED | File modified; contains runSemanticLayer (lines 784-817), runAgenticLayer (lines 827-883), cosineSim (lines 753-757), resolveClaudeCLI (lines 762-773) |
| `test/formal-scope-scan-semantic.test.cjs` | Tests for Layer 3 and Layer 4 behavior | ✓ VERIFIED | File created; contains 9 tests covering cosineSim unit tests, --no-l3 flag, runAgenticLayer fallbacks, Layer 3 integration, and Layer 1+2 regression |
| `package.json` optionalDependencies | @huggingface/transformers@^3.0.0 added | ✓ VERIFIED | Line 79-81: optionalDependencies field added with correct version |
| `package.json` test:ci script | Updated to include new test file | ✓ VERIFIED | test:ci script includes `test/formal-scope-scan-semantic.test.cjs` at end |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|----|--------|---------|
| main() at line 887 | runSemanticLayer() at line 784 | Line 1018: `finalMatches = await runSemanticLayer(...)` | ✓ WIRED | Conditional execution when enriched.length === 0 && !args.noL3 |
| main() at line 887 | runAgenticLayer() at line 827 | Line 1023: `finalMatches = runAgenticLayer(...)` | ✓ WIRED | Conditional execution when finalMatches.length === 0 && args.l4 |
| parseArgs() at line 70 | CLI flag --l3-threshold | Line 87-88: parseFloat parsing | ✓ WIRED | Flag parsed and stored in args.l3Threshold |
| parseArgs() at line 70 | CLI flag --no-l3 | Line 89-90: boolean flag set | ✓ WIRED | Flag parsed and stored in args.noL3 |
| parseArgs() at line 70 | CLI flag --l4 | Line 91-92: boolean flag set | ✓ WIRED | Flag parsed and stored in args.l4 |
| Help text at line 17 | Layer 3/4 descriptions | Lines 33-50: help text updated | ✓ WIRED | --l3-threshold, --no-l3, --l4 documented with descriptions |
| module.exports at line 1039 | runSemanticLayer | Line 1055: export present | ✓ WIRED | Function exported for test access |
| module.exports at line 1039 | runAgenticLayer | Line 1056: export present | ✓ WIRED | Function exported for test access |
| module.exports at line 1039 | cosineSim | Line 1053: export present | ✓ WIRED | Function exported for test access |
| module.exports at line 1039 | resolveClaudeCLI | Line 1054: export present | ✓ WIRED | Function exported for test access |

### Test Execution

**Test File:** test/formal-scope-scan-semantic.test.cjs

```
✔ cosineSim (15.760917ms)
  ✔ cosineSim of identical unit vectors is 1
  ✔ cosineSim of orthogonal vectors is 0
  ✔ cosineSim general case [0.6, 0.8] . [0.8, 0.6] = 0.96

✔ --no-l3 flag (236.541375ms)
  ✔ returns [] when no match and --no-l3 is set

✔ runAgenticLayer (22.151542ms)
  ✔ returns [] when claude binary is missing (claudeBin injection)
  ✔ returns [] when specDir does not exist
  ✔ Layer 4 falls back gracefully when claude binary is missing (injection)

✔ runSemanticLayer (666.102375ms)
  ✔ returns semantic match above threshold (integration — skipped if package absent)

✔ regression: layers 1+2 (360.677917ms)
  ✔ layers 1+2 still return exact/proximity match after async main() change

ℹ tests 9
ℹ suites 5
ℹ pass 9
ℹ fail 0
ℹ duration_ms 1980.128042
```

**All tests pass.** 9/9 passing.

### Implementation Verification

**Layer 3: runSemanticLayer (lines 784-817)**

- Dynamic ESM import of @huggingface/transformers inside async try/catch: ✓ Present (lines 786-792)
- Pipeline creation and embedder setup: ✓ Present (line 794)
- Query embedding computation with pooling and normalization: ✓ Present (lines 795-797)
- Per-module embedding and cosine similarity calculation: ✓ Present (lines 800-804)
- Threshold filtering and score rounding: ✓ Present (lines 805-811)
- Sorting by similarity descending: ✓ Present (line 815)
- Graceful error handling with stderr warning: ✓ Present (line 790)

**Layer 4: runAgenticLayer (lines 827-883)**

- claudeBin injection parameter with resolveClaudeCLI() fallback: ✓ Present (line 828)
- specDir enumeration with error handling: ✓ Present (lines 830-836)
- Prompt construction with module list: ✓ Present (lines 838-842)
- Environment setup with CLAUDECODE deletion: ✓ Present (lines 844-845)
- execFileSync invocation with timeout and stdio piping: ✓ Present (lines 849-851)
- ENOENT vs timeout error differentiation: ✓ Present (lines 853-856)
- Tolerant JSON parsing with fallback regex extraction: ✓ Present (lines 861-870)
- Hallucination guard filtering: ✓ Present (line 877)

**Helper Functions**

- cosineSim (lines 753-757): ✓ Correct dot-product implementation for normalized vectors
- resolveClaudeCLI (lines 762-773): ✓ Correct version resolution from ~/.local/share/claude/versions/

**Main Function Integration**

- async function signature: ✓ Line 887
- Layer 3 conditional integration: ✓ Lines 1008-1019
- Layer 4 conditional integration: ✓ Lines 1022-1024
- Output using finalMatches: ✓ Lines 1026-1032
- Error handler for main: ✓ Line 1062

### CLI Functionality

Verified with manual tests:

```bash
# Layers 1+2 work (no regression)
$ node bin/formal-scope-scan.cjs --description "circuit breaker" --format json
[{"module": "breaker", "path": ".planning/formal/spec/breaker/invariants.md", "matched_by": "concept"}]
✓ PASS

# --no-l3 flag works
$ node bin/formal-scope-scan.cjs --description "zzz-xyzzy-nomatch" --no-l3 --format json
[]
✓ PASS

# Help text shows new flags
$ node bin/formal-scope-scan.cjs --help | grep -E "l3|l4"
  --l3-threshold N       Cosine similarity threshold for Layer 3 (default: 0.35)
  --no-l3                Disable Layer 3 semantic fallback
  --l4                   Enable Layer 4 agentic fallback (disabled by default; slow/expensive)
Layer 3 (semantic — @huggingface/transformers, runs when layers 1+2 return 0 matches):
  Computes cosine similarity between query and module concept text.
  Modules above threshold returned with matched_by: "semantic".
Layer 4 (agentic — claude CLI sub-agent, runs when layers 1+2+3 return 0 matches):
  Spawns claude CLI to search spec directories. Requires --l4 flag to enable.
  Returns matched_by: "agentic". Skips silently if claude CLI unavailable.
✓ PASS
```

### Requirements Coverage

No requirements mapped to quick-325 in .planning/REQUIREMENTS.md — this is a technical enhancement task.

### Anti-Patterns Check

Scanned bin/formal-scope-scan.cjs and test/formal-scope-scan-semantic.test.cjs for:

- ❌ TODO/FIXME comments — none found
- ❌ Placeholder returns — none found
- ❌ Empty implementations — none found
- ❌ Unhandled promises — none found (all async properly awaited)
- ❌ Missing error handlers — none found (try/catch on all fallible operations)

**Result:** No anti-patterns detected.

### Regression Testing

Layer 1+2 functionality verified intact:

- Source file matching: Still functional (test regex unchanged)
- Concept matching: Still functional (tokenization unchanged)
- Module name matching: Still functional (token matching unchanged)
- Proximity index enrichment: Still functional (called before Layer 3)
- Output format (lines/json): Still functional (now uses finalMatches)

**Result:** No regressions detected.

---

## Summary

All 6 observable truths verified. All 4 artifacts present and substantive. All key links wired correctly. Tests pass (9/9). No anti-patterns. No regressions. Graceful fallback confirmed for missing optional dependencies.

**Phase goal achieved:** Layer 3 and Layer 4 successfully integrated into formal-scope-scan.cjs with correct fallback conditions, proper CLI integration, and comprehensive test coverage.

---

_Verified: 2026-03-18T22:30:00Z_
_Verifier: Claude (nf-verifier)_
