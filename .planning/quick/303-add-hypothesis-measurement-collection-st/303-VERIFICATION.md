---
phase: quick-303
verified: 2026-03-15T21:32:00Z
status: passed
score: 5/5 must-haves verified
---

# Quick Task 303: Hypothesis Measurement Collection Verification Report

**Task Goal:** Add hypothesis measurement collection step to solve-diagnose (Step 0e) — extract formal model assumptions, measure against trace/scoreboard/telemetry data, compare, write hypothesis-measurements.json. Add H→M as a new residual layer in nf-solve.cjs.

**Verified:** 2026-03-15T21:32:00Z
**Status:** PASSED
**Score:** 5/5 must-haves verified

---

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Running `node bin/hypothesis-measure.cjs --json` produces hypothesis-measurements.json with CONFIRMED/VIOLATED/UNMEASURABLE verdicts for tier-1 assumptions | ✓ VERIFIED | Script executes and produces valid JSON with schema_version 1, total_measured: 85, verdicts counts, measurements array with assumption_name, source_model, formal_value, actual_value, actual_source, verdict, reason fields |
| 2 | nf-solve.cjs includes h_to_m in its residual vector, with residual = count of VIOLATED assumptions | ✓ VERIFIED | `node bin/nf-solve.cjs --json --report-only` output includes "h_to_m" key with residual and detail object (detail includes total, confirmed, violated, unmeasurable, measurements_path) |
| 3 | Existing solve runs do not break when hypothesis-measurements.json is absent (backward-compatible default) | ✓ VERIFIED | When proposed-metrics.json is missing or path does not exist, measureHypotheses() returns { total_measured: 0, verdicts: {CONFIRMED: 0, VIOLATED: 0, UNMEASURABLE: 0}, measurements: [] }, residual defaults to 0 |
| 4 | solve-diagnose.md Step 0e calls hypothesis-measure.cjs between Step 0d and Step 1 | ✓ VERIFIED | Step 0e section exists in solve-diagnose.md with correct placement (after Step 0d, before Step 1), includes command to run hypothesis-measure.cjs, parse verdicts, store result |
| 5 | solve-remediate.md has an h_to_m remediation section that dispatches constant alignment fixes | ✓ VERIFIED | Section 3n exists with H→M Gaps remediation logic, layer reference table includes h_to_m row mapping to "3n. H->M Gaps", max-3 dispatch cap documented |

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `bin/hypothesis-measure.cjs` | Hypothesis measurement collection — reads proposed-metrics.json tier-1 assumptions, compares against trace/scoreboard/telemetry data | ✓ VERIFIED | 376 lines, exports measureHypotheses, loadActualData, extractFormalValue, compareAssumption via module.exports._pure. Reads 4 data sources: conformance-events.jsonl, quorum-scoreboard.json, telemetry/report.json, circuit-breaker-state.json. Produces verdicts with comparison logic (>10% relative or >2 absolute). |
| `bin/nf-solve.cjs` | Updated computeResidual() with sweepHtoM() and h_to_m in return object | ✓ VERIFIED | Lines 2703-2726 define sweepHtoM(). Line 2815 calls sweepHtoM() in computeResidual(). Line 2839 adds h_to_m.residual to informational bucket. Lines 2862 in return statement includes h_to_m. Exported at line 4339. |
| `bin/layer-constants.cjs` | Updated LAYER_KEYS with h_to_m | ✓ VERIFIED | LAYER_KEYS array includes 'h_to_m' at line 14. Array length is 19. JSDoc comment at line 4 says "19-layer". |
| `bin/solve-wave-dag.cjs` | DAG includes h_to_m layer | ✓ VERIFIED | Line 37 defines LAYER_DEPS['h_to_m'] = [] (no dependencies). h_to_m is a valid key in LAYER_DEPS. |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|----|--------|---------|
| bin/hypothesis-measure.cjs | .planning/formal/evidence/proposed-metrics.json | JSON read (line 278) | ✓ WIRED | Script reads metricsPath and filters to tier === 1 entries |
| bin/hypothesis-measure.cjs | .planning/formal/evidence/hypothesis-measurements.json | JSON write (line 338) | ✓ WIRED | Script calls fs.writeFileSync with complete measurement result object |
| bin/nf-solve.cjs | bin/hypothesis-measure.cjs | require at line 54, call at line 2709 | ✓ WIRED | Imported via `const { measureHypotheses } = require('./hypothesis-measure.cjs')._pure;` and called in sweepHtoM() |
| bin/solve-wave-dag.cjs | h_to_m layer | LAYER_DEPS entry at line 37 | ✓ WIRED | h_to_m present in LAYER_DEPS with empty dependency array |
| commands/nf/solve-diagnose.md | bin/hypothesis-measure.cjs | Step 0e command (line 165) | ✓ WIRED | Step 0e calls `node ~/.claude/nf-bin/hypothesis-measure.cjs --json` with fallback to `bin/hypothesis-measure.cjs` |
| commands/nf/solve-remediate.md | h_to_m layer remediation | Section 3n (line 629+) | ✓ WIRED | Comprehensive remediation logic with max-3 dispatch cap, per-source auto-fix routing |

### Requirements Coverage

| Requirement | Coverage | Status | Evidence |
|-------------|----------|--------|----------|
| QUICK-303 | Declared in PLAN frontmatter at line 15 | ✓ SATISFIED | All tasks completed: hypothesis-measure.cjs created, nf-solve.cjs updated with h_to_m, layer-constants.cjs updated, solve-wave-dag.cjs updated, solve-diagnose.md Step 0e added, solve-remediate.md section 3n added |

### Anti-Patterns Found

| File | Pattern | Severity | Status |
|------|---------|----------|--------|
| None detected | N/A | — | ✓ CLEAN |

All files checked: no TODO/FIXME comments, no placeholder implementations, no empty return statements, no stub-only logic.

---

## Implementation Details

### bin/hypothesis-measure.cjs (376 lines)

**Pure functions exported:**
- `measureHypotheses(root)` — Main orchestrator. Reads proposed-metrics.json, filters tier-1, loads actual data from 4 sources, compares each assumption, produces verdict, writes hypothesis-measurements.json.
- `loadActualData(root)` — Aggregates data from conformance-events.jsonl, quorum-scoreboard.json, telemetry/report.json, circuit-breaker-state.json. All fail-open (graceful on missing files).
- `extractFormalValue(sourceModel, assumptionName)` — Parses TLA+ and PRISM source files using regex patterns to extract constant values.
- `compareAssumption(metric, formalValue, actualData)` — Matches assumption to actual data, applies comparison logic (>10% relative or >2 absolute), produces verdict and reason.

**Verdict logic:**
- UNMEASURABLE: formal_value === null OR actual_value === null
- VIOLATED: actual exceeds formal by >10% (relative) or >2 (absolute for small values ≤20)
- CONFIRMED: within bounds

**CLI modes:**
- `--json`: outputs JSON to stdout, writes to disk
- Default: human-readable summary with violated assumptions listed

**Output schema (hypothesis-measurements.json):**
```json
{
  "schema_version": "1",
  "generated": "<ISO timestamp>",
  "total_measured": N,
  "verdicts": { "CONFIRMED": N, "VIOLATED": N, "UNMEASURABLE": N },
  "measurements": [
    {
      "assumption_name": "string",
      "source_model": "string",
      "formal_value": number | null,
      "actual_value": number | null,
      "actual_source": "string | null",
      "verdict": "CONFIRMED" | "VIOLATED" | "UNMEASURABLE",
      "reason": "string"
    }
  ]
}
```

### bin/nf-solve.cjs updates

**sweepHtoM() function (lines 2703-2726):**
- Skips in fast mode (returns residual: -1, skipped: true)
- Calls measureHypotheses(ROOT)
- Returns residual = result.verdicts.VIOLATED (count of violated assumptions)
- Includes detail object with total, confirmed, violated, unmeasurable, measurements_path
- Handles errors with residual: -1, error: true

**computeResidual() integration:**
- Line 2815: `const h_to_m = sweepHtoM();`
- Line 2839: Added to informational bucket sum (not automatable)
- Line 2862: Included in return object

**Backward compatibility:**
- If proposed-metrics.json missing: measureHypotheses returns empty result (total_measured: 0)
- h_to_m residual becomes 0
- Existing solve loops continue without error

### bin/layer-constants.cjs

**Updated LAYER_KEYS array:**
- Added 'h_to_m' as 19th entry (line 14)
- Total keys: 19 (verified)
- Updated JSDoc: "Canonical 19-layer key array" (line 4)

### bin/solve-wave-dag.cjs

**LAYER_DEPS update (line 37):**
```javascript
h_to_m: [],  // No dependencies — hypothesis measurement is independent
```

- h_to_m placed in LAYER_DEPS adjacency list
- Empty dependency array (can run in Wave 0)
- Enables proper wave scheduling in computeWaves()

### commands/nf/solve-diagnose.md

**Step 0e: Hypothesis Measurement Collection (lines 156-175):**
- Positioned after Step 0d (Inline Observe Refresh + Debt Load)
- Before Step 1 (Initial Diagnostic Sweep)
- Command: `node ~/.claude/nf-bin/hypothesis-measure.cjs --json --project-root=$(pwd)`
- Fallback to `bin/hypothesis-measure.cjs` (CWD-relative)
- Parse verdicts: log violation count or confirmation message
- Fail-open: if script errors or missing, proceed to Step 1
- Integration: stores measurement result in solve context

### commands/nf/solve-remediate.md

**Layer reference table (line 164):**
- Added row: `| h_to_m | 3n. H->M Gaps | Yes -- dispatches /nf:quick |`

**Section 3n: H->M Gaps (lines 629-649):**
- Remediation for residual_vector.h_to_m.residual > 0
- Extracts violated assumptions from hypothesis-measurements.json
- Auto-fix routing per actual_source:
  - scoreboard + TP/UNAVAIL: dispatch /nf:quick for PRISM constant alignment
  - conformance-events + max rounds: dispatch /nf:quick for TLA+ CONSTANT update
  - telemetry + latency: dispatch /nf:quick for formal spec bound update
  - Other: log as manual-only
- **Max-3 dispatch cap per cycle** — tracks counter, logs cap reached, appends capped_layers entry
- Log pattern: `"H->M: {violated} violated assumptions, {dispatched} auto-fix dispatches, {skipped} manual-only"`

**Objective description update:**
- Changed from "13 layer remediation steps (3a-3m)" to "14 layer remediation steps (3a-3n)" (verified in output)

---

## Verification Test Results

### Unit Tests (Programmatic)

1. ✓ `LAYER_KEYS.includes('h_to_m')` → true
2. ✓ `LAYER_KEYS.length` → 19
3. ✓ `'h_to_m' in LAYER_DEPS` → true
4. ✓ `LAYER_DEPS.h_to_m` → []
5. ✓ `node bin/hypothesis-measure.cjs --json` → valid JSON output with 85 tier-1 metrics measured
6. ✓ `measureHypotheses('/nonexistent/path')` → { total_measured: 0, verdicts: {CONFIRMED: 0, VIOLATED: 0, UNMEASURABLE: 0}, measurements: [] }
7. ✓ `node bin/nf-solve.cjs --json --report-only --fast` includes "h_to_m" key in output
8. ✓ Step 0e text found in solve-diagnose.md (4+ references)
9. ✓ h_to_m references found in solve-remediate.md (4+ references)
10. ✓ "14 layer" count confirmed in solve-remediate.md objective

### Integration Tests

- ✓ Backward compatibility: missing hypothesis-measurements.json causes no errors, residual defaults to 0
- ✓ Module exports: hypothesis-measure.cjs properly exports via `_pure` for testing
- ✓ Wiring: nf-solve.cjs correctly imports and calls measureHypotheses()
- ✓ Wave DAG: h_to_m passes wave computation without dependency issues
- ✓ Step ordering: Step 0e positioned correctly between 0d and Step 1 in solve-diagnose.md

---

## Conclusion

**All 5 must-haves verified.** The hypothesis measurement collection layer is fully implemented, integrated, and backward-compatible. The layer closes the feedback loop by detecting when formal model assumptions diverge from observed trace/scoreboard/telemetry data, enabling automatic constant realignment through remediation dispatches.

**Phase goal ACHIEVED:** H→M layer successfully added to solve loop with proper residual calculation, workflow documentation, and fail-safe backward compatibility.

---

_Verified: 2026-03-15T21:32:00Z_
_Verifier: Claude (nf-verifier)_
