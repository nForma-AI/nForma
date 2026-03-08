---
phase: quick-226
verified: 2026-03-08T20:10:00Z
status: passed
score: 5/5 must-haves verified
---

# Quick 226: Track Formal Model Complexity and Runtime — Verification Report

**Phase Goal:** Track formal model complexity and runtime; nf:solve ingests results to decide split/merge
**Verified:** 2026-03-08T20:10:00Z
**Status:** passed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Running model-complexity-profile.cjs produces a JSON profile combining static state-space estimates with actual runtime_ms from check-results.ndjson, using a formalism-prefix-to-path correlation layer | VERIFIED | Script at bin/model-complexity-profile.cjs (391 lines) produces valid JSON. Persisted artifact at .planning/formal/model-complexity-profile.json has 40 models profiled. Correlation layer implemented via normalizeFilename/normalizeSlug/findStateSpaceMatch functions (lines 74-118). |
| 2 | When state-space-report.json is absent, the profiler produces a complete runtime-only profile with valid classifications and split candidates | VERIFIED | Test "runtime-only profile: complete profile when state-space-report.json missing" passes. Code treats stateSpaceData=null as normal path (line 194). On-disk profile confirms runtime-only operation (state-space-report.json does not exist in production). |
| 3 | The profile includes per-model complexity class (FAST/MODERATE/SLOW/HEAVY) based on runtime thresholds | VERIFIED | classifyRuntime function (lines 52-58) with thresholds at 1000/10000/30000ms. On-disk profile shows 33 FAST, 1 MODERATE, 6 SLOW, 0 HEAVY. All boundary tests pass. |
| 4 | nf-solve report includes a Model Complexity section showing runtime hotspots and split/merge recommendations | VERIFIED | Text report section at nf-solve.cjs line 2740-2770 reads model-complexity-profile.json and renders profiled count, runtime class distribution, split candidates (up to 5), merge candidates (up to 5). JSON output includes complexity_profile field at line 3115. |
| 5 | Models exceeding runtime threshold are flagged as split candidates; small fast models sharing requirements are flagged as merge candidates | VERIFIED | Split logic at lines 249-275: HEAVY = hard recommend, SLOW = soft "consider splitting". Merge logic at lines 278-301: uses cross_model pairs from state-space, both must be FAST/MODERATE. Tests confirm both paths. On-disk profile shows 6 split candidates. |

**Score:** 5/5 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `bin/model-complexity-profile.cjs` | Combines state-space + NDJSON into complexity profile | VERIFIED | 391 lines, exports classifyRuntime/parseNDJSON/findStateSpaceMatch/main. No stubs. |
| `bin/model-complexity-profile.test.cjs` | Unit tests for the profiler | VERIFIED | 350 lines, 18 tests, all passing. Covers thresholds, joins, deduplication, graceful degradation. |
| `.planning/formal/model-complexity-profile.json` | Persisted complexity profile artifact | VERIFIED | 9615 bytes on disk, valid JSON with profiles/recommendations/summary structure. |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| bin/model-complexity-profile.cjs | .planning/formal/state-space-report.json | fs.readFileSync JSON parse | WIRED | STATE_SPACE_PATH at line 28, read at line 180 |
| bin/model-complexity-profile.cjs | .planning/formal/check-results.ndjson | NDJSON line parsing | WIRED | NDJSON_PATH at line 29, parseNDJSON at line 126 |
| bin/nf-solve.cjs | bin/model-complexity-profile.cjs | spawnTool call in sweepFtoC | WIRED | spawnTool at line 1052, text report at line 2742, JSON output at line 3090/3115 |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| QUICK-226 | 226-PLAN.md | Track formal model complexity and runtime | SATISFIED | Profiler, tests, and nf-solve integration all verified |

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| (none) | — | — | — | No anti-patterns found |

### Human Verification Required

None required. All functionality is programmatically verifiable through unit tests and structural checks.

---

_Verified: 2026-03-08T20:10:00Z_
_Verifier: Claude (nf-verifier)_
