# Milestone v0.37 Integration Verification Report

**Audit Date**: 2026-03-16  
**Phases Checked**: v0.37-01 through v0.37-05  
**Requirements Scope**: 16 requirements across 5 phases

---

## Executive Summary

**Milestone v0.37 is 87.5% integrated** (14 of 16 requirements wired and operational).

### Critical Finding
Phase v0.37-05 (Hypothesis Targeting) is **orphaned from the solve loop**. Both HTARGET-01 and HTARGET-02 are fully implemented and tested in isolation but never called from the main `nf-solve.cjs` orchestrator. This is a **must-fix integration gap** that prevents hypothesis-driven wave prioritization from reaching users.

### Minor Findings
1. **TLINK-03** (annotation coverage percentage) is computed but not persisted to solve-classifications.json for historical tracking
2. **Cross-phase dependency** between v0.37-01 (annotation suppression) and v0.37-03 (FP tuning baseline) is logical but not explicitly validated

---

## Detailed Findings by Phase

### Phase v0.37-01: Annotation Back-Linking ✓ INTEGRATED (5/5 requirements)

**Status**: Fully operational in solve flow

**Exports → Consumers**:
- `SEMANTIC_WEIGHTS` (formal-proximity.cjs) → imported by nf-solve.cjs at lines 2023, 2205
- `parseSourceAnnotations` (formal-proximity.cjs) → called during proximity-index rebuild
- `annotation_coverage_percent` → computed in sweepTtoR, reported in detail output
- `bin/annotate-tests.cjs` → standalone CLI tool for developers

**Integration Path**:
```
Source file @requirement annotation (line 1-30 header convention)
  ↓
formal-proximity.cjs parseSourceAnnotations extracts IDs
  ↓
proximity-index.json built with code_file → requirement declares edges
  ↓
nf-solve.cjs sweepCtoR loads proximity-index, requires SEMANTIC_WEIGHTS
  ↓
proximity check: edge_weight >= SUPPRESS_THRESHOLD (0.6) → suppress flag
  ↓
Orphan code items not flagged; FP rate baseline reduced
```

**Test Coverage**: 31/31 tests pass (annotation-back-linking.test.cjs + annotation-back-linking-tlink.test.cjs + annotate-tests.test.cjs)

**Evidence**: 54 code-requirement annotations extracted from 38 source files; proximity declares edges created; proximity suppression applied in both sweepCtoR (code→requirement) and sweepTtoR (test→requirement).

---

### Phase v0.37-02: Gate Auto-Promotion ✓ INTEGRATED (3/3 requirements)

**Status**: Fully operational, invoked from solve flow

**Exports → Consumers**:
- `shouldPromoteToHardGate` function → called by compute-per-model-gates.cjs during main loop
- `consecutive_pass_count` tracking → incremented every solve session
- `promotion-changelog.json` → written with evidence snapshot on promotion

**Integration Path**:
```
Solve iteration completes classification
  ↓
computeScannerStats aggregates per-scanner results
  ↓
recordSessionHistory appends session entry (rolling 10-session window)
  ↓
computeFPRates analyzes FP rate trends (orthogonal to promotion)
  ↓
compute-per-model-gates.cjs spawned via spawnTool
  ↓
evaluateConsecutivePass checks: maturity>=1 && evidence_ok && not UNSTABLE
  ↓
If pass: consecutive_pass_count += 1
  ↓
shouldPromoteToHardGate checks: SOFT_GATE && maturity>=3 && evidence>=3 && consecutive_pass_count>=3
  ↓
If all criteria met: SOFT_GATE → HARD_GATE promotion
  ↓
appendChangelog writes to promotion-changelog.json with full evidence snapshot
```

**Invocation Points in nf-solve.cjs**:
- Line 2796-2815: computeGateScores (aggregation only, informational)
- Line 2904-2944: sweepPerModelGates (main mutation mode, triggers promotion logic)
- Line 4747-4761: Step 8a auto-promotion eligibility check

**Test Coverage**: 84/84 tests pass (compute-per-model-gates.test.cjs, including 25 GPROMO-specific tests)

**Evidence**: 201 models tracked; consecutive_pass_count appears 13+ times in source code; promotion logic tested for count thresholds (2, 3, 5), all other gate criteria, UNSTABLE/cooling states.

---

### Phase v0.37-03: Scanner FP Tuning ✓ INTEGRATED (3/3 requirements)

**Status**: Fully operational, wired into classification loop

**Exports → Consumers**:
- `recordSessionHistory` → called after classification loading (line 4667)
- `computeFPRates` → called with session_history to calculate rolling FP rates
- `applyFPTuning` → called to auto-raise suppression thresholds (line 4675)
- `formatFPRateTable` → called in formatReport for --report-only diagnostics

**Integration Path**:
```
Classification load complete (solve-classifications.json)
  ↓
computeScannerStats extracts per-scanner per-category FP/genuine/review counts
  ↓
recordSessionHistory appends new session with stats to rolling 10-session window
  ↓
computeFPRates calculates FP rate per scanner (FP / total items over window)
  ↓
For each scanner:
  If FP_rate > 60% && sessions >= 5:
    applyFPTuning raises SUPPRESS_THRESHOLD by 0.1 (cap 0.9)
    Evidence logged: { scanner, from, to, fp_rate, sessions }
  ↓
Threshold persisted in solve-classifications.json tuning section
  ↓
Next solve iteration uses updated threshold for classifier output
  ↓
formatFPRateTable renders diagnostics table (Scanner | FP_Rate | Status)
```

**Invocation Points in nf-solve.cjs**:
- Line 4664-4675: Main loop integration (recordSessionHistory, computeFPRates, applyFPTuning)
- Line ~3800: formatReport inclusion of FP rate table

**Test Coverage**: 38/38 tests pass (nf-solve-fp-tuning.test.cjs)

**Evidence**: 
- Session history rolling window tested (10-session trim)
- FP rate calculation validated (0.33, 0.8 test cases)
- Auto-tuning threshold increment tested (0.5→0.6→0.7, cap at 0.9)
- Coverage for all 4 scanners (ctor, ttor, dtor, dtoc)
- All tests for empty/minimal data pass

---

### Phase v0.37-04: Quorum Precedents ✓ INTEGRATED (3/3 requirements)

**Status**: Fully operational, mines debates and injects precedents into quorum dispatch

**Exports → Consumers**:
- `bin/extract-precedents.cjs` → standalone tool, scans `.planning/quorum/debates/`
- `loadPrecedents` (quorum-slot-dispatch.cjs) → loads from `.planning/quorum/precedents.json` with fail-open
- `matchPrecedentsByKeywords` → scores and filters using stopword-filtered keyword overlap
- `formatPrecedentsSection` → formats truncated precedent text for prompt injection

**Integration Path**:
```
extract-precedents.cjs runs (manual or triggered)
  ↓
Scans .planning/quorum/debates/*.md files (69 debate files found)
  ↓
extractPrecedentMetadata parses: Question, Date, Consensus, Outcome
  ↓
Filters: INCONCLUSIVE excluded, Date validated, Consensus ∈ {APPROVE, BLOCK}
  ↓
isPrecedentFresh checks TTL: (now - date) < 90 days
  ↓
15 fresh precedents written to .planning/quorum/precedents.json
  ↓
During quorum dispatch (quorum-slot-dispatch.cjs):
  ↓
loadPrecedents reads precedents.json, caches per projectRoot
  ↓
matchPrecedentsByKeywords scores each precedent:
  - Extract stopword-filtered keywords from question + outcome
  - Score = outcome_keyword_matches * 2 + question_keyword_matches * 1
  - Filter to matches with score > 0, sort descending, take top 3
  - Inline TTL check: filter stale (>90 days) before returning
  ↓
formatPrecedentsSection truncates and formats:
  - Question: max 120 chars + "..."
  - Outcome: max 150 chars + "..."
  - Header: "=== PAST QUORUM PRECEDENTS ==="
  ↓
Precedents section injected into buildModeAPrompt and buildModeBPrompt
  ↓
Section placed after requirements, before review context
```

**Invocation Points**:
- `quorum-slot-dispatch.cjs` line 1074-1119: Main dispatch flow
  - Line 1074-1082: Load requirements (existing)
  - Line 1083-1086: Load and match precedents (new)
  - Line 1116, 1118: Pass precedents to prompt builders
  - Lines 483-487, 647-651: Inject into Mode A and Mode B prompts

**Test Coverage**: 48/48 tests pass (extract-precedents.test.cjs 22 + quorum-slot-dispatch.test.cjs 26 new precedent tests)

**Evidence**:
- 15 APPROVE/BLOCK precedents extracted from 69 debate files
- 54 files skipped (slot response files without standard debate template)
- No INCONCLUSIVE entries in output (correctly filtered)
- TTL boundary testing: 89 days fresh, 91 days stale
- Keyword matching tested: basic overlap, outcome boost, top-3 limit, freshness filtering
- Injection tested: both Mode A and B, placement after requirements, null-safe empty precedents

---

### Phase v0.37-05: Hypothesis Targeting ✗ ORPHANED (0/2 requirements wired)

**Status**: CRITICAL INTEGRATION GAP — Fully implemented and tested, but never called from solve loop

**Exports → Consumers**:
- `bin/hypothesis-layer-map.cjs` exports 3 functions:
  - `mapSourceToLayer` — maps TLA+ filename keywords to layer keys
  - `loadHypothesisTransitions` — detects UNMEASURABLE → CONFIRMED/VIOLATED transitions
  - `computeLayerPriorityWeights` — converts transitions to per-layer weight deltas
- `solve-wave-dag.cjs` extended with optional `priorityWeights` parameter to `computeWaves`

**What's Missing**:
- `nf-solve.cjs` **never imports** hypothesis-layer-map.cjs
- `nf-solve.cjs` **never calls** loadHypothesisTransitions or computeLayerPriorityWeights
- `computeWaves` is **never called** from nf-solve.cjs (module is not used in main flow)
- Wave ordering **always uses** empty priorityWeights `{}` (in CLI mode only)

**Evidence of Orphaning**:
```bash
grep -r "hypothesis-layer-map" bin/*.cjs | grep -v test
# → ZERO matches (only in test files)

grep "computeWaves" bin/nf-solve.cjs
# → ZERO matches

grep -n "solve-wave-dag" bin/nf-solve.cjs
# → Only appears in a regex pattern at line ~1700 (spawnTool exclusion list)
```

**Test Coverage**: 38/38 tests pass (hypothesis-layer-map.test.cjs 22 + solve-wave-dag.test.cjs 16) — but tests are isolated unit tests, never integrated.

**Design vs. Reality**:
- `solve-wave-dag.cjs` CLI mode (require.main === module) includes hypothesis weighting
- Real solve orchestration (`nf-solve.cjs`) has no connection to hypothesis targeting
- Layer waves are computed with topology-only logic (no hypothesis prioritization)

**Missing Integration Path**:
```
hypothesis-measurements.json (current + prev) exists
  ↓
[MISSING CALL] loadHypothesisTransitions(root)
  ↓
[MISSING CALL] computeLayerPriorityWeights(transitions)
  ↓
[MISSING PARAMETER] Pass priorityWeights to computeWaves
  ↓
[MISSING EFFECT] Wave ordering respects UNMEASURABLE → CONFIRMED/VIOLATED transitions
  ↓
[MISSING OUTCOME] Hypothesis-active layers remediated first in their wave
```

**Impact**: 
- Hypothesis-driven remediation prioritization is disabled
- Users cannot benefit from hypothesis transition signals
- Architecture supports it (computeWaves parameter exists), but orchestration skipped it

---

## Requirements Integration Map

| Req ID | Phase | Component | Integration Path | Status | Notes |
|--------|-------|-----------|---|---|---|
| TLINK-01 | v0.37-01 | sweepTtoR @req patterns | sweepTtoR line 2168 checks for @req/@requirement in test files | WIRED | Coverage metric computed |
| TLINK-02 | v0.37-01 | bin/annotate-tests.cjs | Tool exists, queries proximity graph via formal-query.cjs reach() | WIRED | 63 annotated, 158 orphan test files found |
| TLINK-03 | v0.37-01 | annotation_coverage_percent | Computed at line 2272, reported in detail at line 2282 | PARTIAL | NOT persisted to solve-classifications.json |
| CLINK-01 | v0.37-01 | sweepCtoR proximity suppression | SEMANTIC_WEIGHTS >= 0.6 threshold at line 2023-2050 | WIRED | 51 code annotations extracted |
| CLINK-02 | v0.37-01 | @requirement → proximity edge | parseSourceAnnotations parses, buildIndex creates declares edges | WIRED | Integrated with formal-proximity.cjs |
| GPROMO-01 | v0.37-02 | consecutive_pass_count tracking | Updated every session in model loop (line 462-465) | WIRED | Visible in per-model output |
| GPROMO-02 | v0.37-02 | SOFT_GATE→HARD_GATE promotion | shouldPromoteToHardGate checks consecutive_pass_count >= 3 (line 479-486) | WIRED | Promotion gated on all criteria |
| GPROMO-03 | v0.37-02 | promotion-changelog.json evidence | appendChangelog writes snapshot on promotion (line 60-96) | WIRED | Dedup window 5min, retention 200 entries |
| FPTUNE-01 | v0.37-03 | session_history rolling window | recordSessionHistory at line 4667, 10-session FIFO trim | WIRED | All 38 tests pass |
| FPTUNE-02 | v0.37-03 | auto-threshold raising | applyFPTuning at line 4675, FP > 60% over 5+ sessions, +0.1 per cycle (cap 0.9) | WIRED | Threshold persisted to classifications |
| FPTUNE-03 | v0.37-03 | /nf:solve --report-only FP table | formatFPRateTable in formatReport output | WIRED | Fixed scanner order (ctor, ttor, dtor, dtoc) |
| QPREC-01 | v0.37-04 | extract-precedents.cjs | Scans debates, extracts 15 APPROVE/BLOCK precedents, writes precedents.json | WIRED | 69 debate files, 54 skipped (non-standard format) |
| QPREC-02 | v0.37-04 | precedent injection | matchPrecedentsByKeywords + formatPrecedentsSection in buildModeAPrompt/B lines 483-487, 647-651 | WIRED | 3-precedent limit, outcome keyword boost 2x |
| QPREC-03 | v0.37-04 | 90-day TTL pruning | Inline check in matchPrecedentsByKeywords (line ~130: isPrecedentFresh), both extraction and dispatch | WIRED | Stale entries excluded from injection |
| HTARGET-01 | v0.37-05 | computeLayerPriorityWeights +1 per transition | Function exists, tested, but never called from nf-solve.cjs | **UNWIRED** | CRITICAL: hypothesis-measurements.json → (missing link) |
| HTARGET-02 | v0.37-05 | intra-wave ordering by priority | solve-wave-dag.cjs computeWaves line 112-114 sorts by priorityWeights descending, but {} always passed | **UNWIRED** | CRITICAL: priorityWeights parameter not populated from hypothesis module |

---

## Cross-Phase Dependencies Status

### Dependency 1: v0.37-01 → v0.37-03 (Annotation Suppression → FP Baseline Reduction)
**Status**: Logically wired, not explicitly validated

The design assumes annotation suppression in v0.37-01 reduces the FP baseline for v0.37-03 to tune against. However:
- No code explicitly validates that FP rates improved post-annotation-suppression
- FP tuning applies regardless of annotation coverage
- This is a **design assumption**, not a wired integration

**Recommendation**: Document or verify that annotation coverage correlates with FP rate improvements in future milestone.

### Dependency 2: v0.37-02 ← v0.37-03 (Gate Promotion ← FP Tuning)
**Status**: Operationally sound, orthogonal

FP tuning (v0.37-03) raises suppression thresholds; gate promotion (v0.37-02) tracks consecutive clean sessions. Both are independent mechanisms. No ordering dependency.

### Dependency 3: v0.37-04 (Quorum Precedents) — Standalone
**Status**: No phase dependencies

Quorum precedent extraction, matching, and injection are self-contained. Works regardless of other v0.37 phases.

### Dependency 4: v0.37-05 (Hypothesis Targeting) ← v0.36 (Wave DAG Foundation)
**Status**: **INCOMPLETE INTEGRATION**

- v0.36 provided `computeWaves` function
- v0.37-05 extended `solve-wave-dag.cjs` with priorityWeights parameter
- BUT: nf-solve.cjs never loads hypothesis-layer-map.cjs
- Wave ordering remains topology-only (no hypothesis prioritization)

---

## E2E User Flows: Completion Status

### Flow 1: Annotation Discovery → Suppression → Coverage Tracking
**Status**: ✓ COMPLETE (user-facing)

**Path**:
1. Developer adds `// @requirement REQ-123` to source file header (lines 1-30)
2. `nf-solve --report-only` runs diagnostic scan
3. sweepCtoR parses annotation, looks up proximity graph
4. If edge_weight >= 0.6, orphan flag suppressed
5. sweepTtoR reports annotation_coverage_percent (e.g., "63/221 test files annotated, 28.5%")

**Evidence**: 54 code annotations found and parsed; proximity suppression active in both scanners.

---

### Flow 2: Session FP Rate → Auto-Tuning → Threshold Persistence
**Status**: ✓ COMPLETE (operational)

**Path**:
1. `nf-solve` classifies items, computes scanner stats
2. recordSessionHistory appends to rolling 10-session window
3. computeFPRates calculates FP rate per scanner
4. If FP_rate > 60% for 5+ consecutive sessions:
   - applyFPTuning raises SUPPRESS_THRESHOLD by 0.1 (cap 0.9)
   - Evidence logged: scanner, from→to, FP%, sessions
5. Threshold persisted in solve-classifications.json tuning section
6. Next solve iteration uses updated threshold

**Evidence**: All 38 tests pass; tuning threshold validated in dry-run (no mutations without --report-only flag).

---

### Flow 3: Model Passes → Count Increments → Promotion Eligible
**Status**: ✓ COMPLETE (operational)

**Path**:
1. Solve iteration completes successfully
2. compute-per-model-gates.cjs invoked (spawned, reads registries)
3. evaluateConsecutivePass: model passes if maturity>=1 && evidence_ok && not UNSTABLE
4. If pass: consecutive_pass_count incremented
5. If consecutive_pass_count >= 3 && maturity >= 3 && evidence >= 3:
   - shouldPromoteToHardGate returns true
   - Promotion logged to promotion-changelog.json with evidence snapshot
6. Model.gate_maturity updated to HARD_GATE in next registry read

**Evidence**: All 84 gate tests pass; GPROMO-01/02/03 specifically test consecutive pass count and promotion thresholds.

---

### Flow 4: Debate Archives → Precedent Extraction → Quorum Dispatch Enrichment
**Status**: ✓ COMPLETE (operational)

**Path**:
1. Human initiates: `node bin/extract-precedents.cjs .planning/quorum/debates/ .planning/quorum/precedents.json`
2. Tool scans 69 debate files, parses metadata (Question, Date, Consensus, Outcome)
3. Filters: removes INCONCLUSIVE, validates Date, checks TTL (90 days)
4. 15 fresh APPROVE/BLOCK precedents written to .planning/quorum/precedents.json
5. During quorum dispatch:
   - quorum-slot-dispatch.cjs loads precedents (fail-open)
   - matchPrecedentsByKeywords scores based on keyword overlap (outcome 2x boost)
   - Top 3 precedents returned after TTL check
   - formatPrecedentsSection truncates and formats with "=== PAST QUORUM PRECEDENTS ===" header
   - Section injected into Mode A and Mode B prompts after requirements section
6. Model sees historical precedents and considers them in decision

**Evidence**: 15 precedents extracted; all 26 precedent-specific tests pass; injection confirmed in both prompt builders.

---

### Flow 5: Hypothesis Transitions → Layer Prioritization in Wave Ordering
**Status**: ✗ INCOMPLETE (E2E chain broken)

**Path** (intended):
1. hypothesis-measure.cjs produces hypothesis-measurements.json (current verdict state)
2. Previous measurements in hypothesis-measurements.prev.json (prior verdict state)
3. loadHypothesisTransitions detects UNMEASURABLE → CONFIRMED/VIOLATED
4. computeLayerPriorityWeights maps transitions to layer keys
5. solve() calls computeWaves with priorityWeights parameter
6. Layers with higher priority appear first within their wave
7. Hypothesis-active layers remediated first in solve iteration

**What's Missing**:
- Step 5 never happens — nf-solve.cjs never calls loadHypothesisTransitions
- computeWaves always receives {} (empty priorityWeights)
- Wave ordering remains purely topological (dependency-driven)
- Hypothesis signal is generated but not consumed

**Evidence**: 
- hypothesis-layer-map.test.cjs passes all 22 tests (isolated)
- solve-wave-dag.test.cjs passes all 16 tests (isolated)
- **Zero integration tests** verifying end-to-end flow
- **Zero imports** of hypothesis-layer-map in nf-solve.cjs
- **Zero calls** to loadHypothesisTransitions or computeLayerPriorityWeights

---

## File Path References

### Key Integration Points
- **Annotation Back-Linking**: 
  - `/Users/jonathanborduas/code/QGSD/bin/formal-proximity.cjs` (lines 158+: proximity builder, SEMANTIC_WEIGHTS)
  - `/Users/jonathanborduas/code/QGSD/bin/nf-solve.cjs` (lines 2023, 2205: proximity suppression)
  
- **Gate Auto-Promotion**:
  - `/Users/jonathanborduas/code/QGSD/bin/compute-per-model-gates.cjs` (lines 441-486: consecutive_pass_count, shouldPromoteToHardGate)
  - `/Users/jonathanborduas/code/QGSD/bin/nf-solve.cjs` (lines 2904-2944: spawns gate computation)

- **FP Tuning**:
  - `/Users/jonathanborduas/code/QGSD/bin/nf-solve.cjs` (lines 4399-4668: recordSessionHistory, computeFPRates, applyFPTuning)
  
- **Quorum Precedents**:
  - `/Users/jonathanborduas/code/QGSD/bin/extract-precedents.cjs` (debate mining)
  - `/Users/jonathanborduas/code/QGSD/bin/quorum-slot-dispatch.cjs` (lines 97-184: loading, matching, injection)

- **Hypothesis Targeting** (ORPHANED):
  - `/Users/jonathanborduas/code/QGSD/bin/hypothesis-layer-map.cjs` (functions never called)
  - `/Users/jonathanborduas/code/QGSD/bin/solve-wave-dag.cjs` (priorityWeights parameter unused)

---

## Recommendations

### CRITICAL (Must Fix)
1. **Integrate Hypothesis Targeting into nf-solve.cjs Main Loop**
   - Add `const { loadHypothesisTransitions, computeLayerPriorityWeights } = require('./hypothesis-layer-map.cjs');` near top of nf-solve.cjs
   - In main() around wave computation (line 4700-4750):
     ```javascript
     const transitions = loadHypothesisTransitions(ROOT);
     const priorityWeights = computeLayerPriorityWeights(transitions);
     const waves = computeWaves(residualVector, priorityWeights);
     ```
   - Verify hypothesis-measurements.json and hypothesis-measurements.prev.json exist before calling
   - Test E2E: hypothesis transition → priorityWeights → wave ordering
   - Affected Requirements: HTARGET-01, HTARGET-02

### MEDIUM (Recommended)
2. **Persist annotation_coverage_percent to solve-classifications.json**
   - At line 2272-2282, save annotation_coverage_percent to classifications file
   - Enables historical tracking of annotation adoption rate
   - Validates correlation between annotation suppression and FP reduction (supports FPTUNE-01 baseline assumption)
   - Affected Requirement: TLINK-03

### MINOR (Nice-to-Have)
3. **Add Cross-Phase Integration Tests**
   - Create test/v0.37-integration.test.cjs covering:
     - Annotation suppression → FP baseline (v0.37-01 → v0.37-03)
     - Hypothesis transitions → wave ordering (v0.37-05 → solve flow)
   - Validates assumptions between phases

---

## Conclusion

**Milestone v0.37 is 87.5% production-ready** with one critical gap (hypothesis targeting orphaned) and one minor gap (annotation coverage not persisted). All other functionality is integrated, tested, and operational in the solve loop.

The orphaned hypothesis targeting is fixable with ~10 lines of integration code in nf-solve.cjs, reconnecting the completed v0.37-05 work to the main orchestrator.

**Recommendation**: Fix critical gap before promoting v0.37 to stable; all other phases are ship-ready.

