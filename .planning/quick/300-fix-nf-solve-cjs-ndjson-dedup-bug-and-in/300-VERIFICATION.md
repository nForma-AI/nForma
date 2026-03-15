---
task: 300-fix-nf-solve-cjs-ndjson-dedup-bug-and-in
verified: 2026-03-15T13:30:00Z
status: passed
score: 4/4 must-haves verified
---

# Quick Task 300 Verification Report

**Task Goal:** Fix nf-solve.cjs NDJSON dedup bug and increase verification pipeline timeout

**Verified:** 2026-03-15T13:30:00Z

**Status:** PASSED

**Score:** 4/4 must-haves verified

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | sweepFtoC NDJSON parser deduplicates by check_id using last-entry-wins | VERIFIED | Map-based dedup at bin/nf-solve.cjs:1282-1288 |
| 2 | verification pipeline timeout is 600s (10min) instead of 300s (5min) | VERIFIED | timeout: 600000 at bin/nf-solve.cjs:1247 |
| 3 | D->C false positive for ephemeral current-activity.json is acknowledged | VERIFIED | Entry in acknowledged-false-positives.json:356-359 |
| 4 | installed copy at ~/.claude/nf-bin/nf-solve.cjs is synced | VERIFIED | diff shows no differences |

## Artifact Verification

### bin/nf-solve.cjs

**Status:** VERIFIED

**Evidence:**

1. **Exists:** YES — file present at /Users/jonathanborduas/code/QGSD/bin/nf-solve.cjs
2. **Substantive (NDJSON dedup):** YES
   - Lines 1278-1292: Reads check-results.ndjson line by line
   - Line 1282: `const deduped = new Map()` — establishes Map for dedup
   - Lines 1283-1291: Loop over lines, parse JSON, `deduped.set(id, entry)` — last-write-wins semantics
   - Line 1302: `for (const entry of deduped.values())` — counts results from deduplicated values only
   - Lines 1303-1324: Result counting using deduped values (not raw lines)
   - This implements the required dedup: multiple entries for the same check_id are replaced with the last occurrence
3. **Substantive (timeout value):** YES
   - Line 1247: `timeout: 600000` — exactly 10 minutes (600000ms)
   - Replaces previous 300000 (5 minutes)
4. **Wired:** YES
   - Function sweepFtoC is called during `/nf:solve` pipeline
   - NDJSON dedup logic directly affects calculation of F->C residual
   - Timeout directly affects whether verification pipeline completes without being killed

### .planning/formal/acknowledged-false-positives.json

**Status:** VERIFIED

**Evidence:**

1. **Exists:** YES — file present
2. **Substantive:** YES
   - Lines 354-360: Entry for `.planning/current-activity.json`
   - Type: file_path
   - Reason: "Ephemeral file created by activity-set, removed by activity-clear. Absence is correct when no activity in progress."
   - Timestamp: 2026-03-15T13:21:28.405Z
   - This acknowledges the D->C false positive as intended
3. **Wired:** YES
   - File is consumed by bin/nf-solve.cjs during conformance checks
   - Entries in this file suppress false positives in formal verification results

## Key Link Verification

| From | To | Via | Status | Details |
|------|----|----|--------|---------|
| sweepFtoC() | check-results.ndjson | Map-based dedup parser (1282-1288) | WIRED | Last-entry-wins logic correctly implements dedup |
| sweepFtoC() | verification pipeline | spawnTool timeout (1247) | WIRED | 600000ms timeout allows full verification run |
| nf-solve.cjs | acknowledged-false-positives.json | conformance trace check (1340+) | WIRED | FP entry loaded and applied |

## Formal Verification Context

**Formal scope:** mcp-calls module (loosely matched by formal tooling)

**Pre-existing counterexample:** mcp-calls:tlc reported in formal check result

**Impact on this task:** NONE

- Task changes only NDJSON parsing and timeout values in sweepFtoC()
- No changes to MCP call paths, quorum slots, or environment subprocess handling
- Pre-existing counterexample is unrelated to these changes
- No formal_artifacts declared in plan
- Task scope does NOT overlap with mcp-calls invariants

## Implementation Quality

### Code Review

**NDJSON dedup implementation:**
- Map-based dedup correctly handles duplicate entries
- Last-write-wins semantics implemented via `deduped.set(id, entry)` — subsequent entries with same ID overwrite previous
- Iteration over `deduped.values()` ensures count uses only unique entries
- Handles empty/malformed lines gracefully (lines 1284-1291)
- Comments clearly explain the dedup rationale

**Timeout increase:**
- Value changed from 300000 (5min) to 600000 (10min)
- Sufficient for 207+ formal checks (50 TLA+, 100+ Alloy, PRISM, UPPAAL, CI)
- Applied at correct spawnTool call for verification pipeline
- No other timeout-sensitive code modified

**False positive acknowledgment:**
- Entry follows existing schema in acknowledged-false-positives.json
- Reason clearly documents ephemeral nature of current-activity.json
- Timestamp is recent (2026-03-15), indicating this task execution

### Installation Sync

- Source: `/Users/jonathanborduas/code/QGSD/bin/nf-solve.cjs`
- Installed: `~/.claude/nf-bin/nf-solve.cjs`
- Diff result: No differences (files identical)
- Sync status: COMPLETE

## Anti-Patterns Scan

No TODO/FIXME comments in modified sections.

No placeholder implementations.

No empty handlers.

**Status:** CLEAN

## Summary

All four must-haves verified:

1. **NDJSON dedup:** Map-based deduplicator implemented at lines 1282-1288, counting performed on deduped.values() at line 1302
2. **Timeout increase:** Changed from 300000 to 600000 at line 1247
3. **D->C FP acknowledgment:** Entry added to acknowledged-false-positives.json at lines 354-360
4. **Install sync:** Source and installed copies match exactly (diff clean)

Task goal achieved. Verification pipeline will complete with deduplicated check results and acknowledges ephemeral file behavior.

---

_Verified: 2026-03-15T13:30:00Z_
_Verifier: Claude (nf-verifier)_
