---
phase: quick-258
plan: 01
type: execute
completed_date: 2026-03-10
duration_minutes: 15
tasks_completed: 2
commit: e7275919
subsystem: observe-pipeline
tags: [error-extraction, quality-filtering, pipeline-bridging]
tech_stack: [nodejs, jsonl, error-patterns, observe-internal]
decisions: []
dependency_graph:
  requires: []
  provides:
    - Category 16 (errors.jsonl bridge to observe pipeline)
    - revalidate-errors CLI command
  affects: [/nf:observe, /nf:solve]
---

# Quick Task 258: Bridge errors.jsonl into solve debt pipeline

## Summary

Successfully bridged the errors.jsonl memory store into the solve debt pipeline via a new Category 16 in observe-handler-internal.cjs, implemented quality-filtering improvements in learning-extractor.cjs, and added a revalidate-errors CLI command to memory-store.cjs for purging historical noise.

**Key Achievement:** The 198-entry errors.jsonl dataset, previously a dead-end data store, now surfaces quality-filtered error patterns as internal observe issues routed to `/nf:solve`, enabling automated debt tracking and resolution.

## What Was Built

### 1. Quality-Filtered Error Extraction (learning-extractor.cjs)

**Improved `extractSymptom()` function:**
- Rejects symptoms > 500 chars (file dumps, JSON blobs)
- Requires at least one ERROR_INDICATOR keyword OR STACK_TRACE_PATTERN match
- Preserves 200-char truncation for valid errors
- Result: null returned for noise, only quality symptoms extracted

**Improved `findResolution()` function:**
- Filters tool_result blocks: rejects if > 500 chars
- Rejects file-read patterns (line-number prefix: `/^\s+\d+[→|]/`)
- Rejects JSON arrays starting with `[{`
- Preserves FIX_KEYWORDS check for assistant messages
- Result: only actionable resolutions linked to symptoms

**Updated guard in `extractErrorPatterns()`:**
- Changed `if (symptom && fix)` to `if (symptom !== null && fix)`
- Allows null symptoms to be properly filtered (symptom returns null, not empty string)

### 2. Error Entry Revalidation Command (memory-store.cjs)

**New `revalidate-errors` CLI command:**
- Reads all errors.jsonl entries
- Applies triple filter:
  - (a) symptom length <= 500 chars
  - (b) symptom contains ERROR_INDICATOR or stack trace pattern
  - (c) fix field is non-empty
- Rewrites file with only passing entries
- Output: `{ kept: N, removed: M }` JSON
- Result: 176 noisy entries removed from 198, 22 quality entries retained

**Updated usage help:**
- Added `revalidate-errors` to CLI command list in default case

### 3. Category 16: Errors.jsonl Bridge to Observe Pipeline (observe-handler-internal.cjs)

**New Category 16 handler:**
- Requires memory-store.cjs and readLastN export
- Reads up to limit (default 20) recent error entries from errors.jsonl
- Filters to entries with non-empty root_cause OR non-empty fix
- Converts each to observe issue:
  - `id`: `internal-error-{index}`
  - `title`: Error pattern preview (first 80 chars)
  - `severity`: warning if high confidence, else info
  - `meta`: Fix or root_cause preview (100 chars)
  - `source_type`: internal
  - `_route`: `/nf:solve` (routes to solve debt pipeline)
- Gracefully handles missing memory-store.cjs (fail-open)

**Updated JSDoc comments:**
- Category list: added "16. Accumulated error patterns (errors.jsonl via memory-store.cjs)"
- Function description: updated from "15 categories" to "16 categories"

## Verification

All success criteria met:

1. **Full observe handler runs without error:**
   - Total issues detected: 128
   - Error-pattern issues (Category 16): 20 (default limit)
   - All have source_type='internal': ✓
   - All have _route='/nf:solve': ✓

2. **Revalidate purges noise:**
   - Command output: `{ kept: 22, removed: 176 }`
   - 88.9% noise removal rate
   - Remaining 22 entries all pass quality filters

3. **Post-revalidate query shows clean entries:**
   - All sampled entries contain Error: or other ERROR_INDICATOR
   - Symptoms are actionable, not file dumps
   - Fixes are meaningful resolutions

4. **Learning-extractor tests pass:**
   - Stack trace pattern detection: PASS
   - All 20 extractor tests pass

5. **Integration test passes:**
   - Observe handler Category 16 successfully integrates
   - Error entries properly formatted and routed

## Files Modified

- **bin/learning-extractor.cjs**: Enhanced extractSymptom() and findResolution() with quality filters; updated extractErrorPatterns() guard
- **bin/memory-store.cjs**: Added revalidate-errors CLI command with triple-filter logic; updated usage help
- **bin/observe-handler-internal.cjs**: Added Category 16 handler; updated JSDoc to reflect 16 categories

## Key Insights

**Why this matters:** The errors.jsonl file was accumulating 198 entries from transcript scanning but had no consumption path. The learned error patterns were invisible to the solve system. This task:

1. Closes the feedback loop by routing quality errors to `/nf:solve`
2. Improves data quality by filtering at extraction time (not post-facto)
3. Enables historical cleanup via revalidate-errors for fresh starts
4. Maintains fail-open behavior (missing memory-store doesn't crash observe)

**Quality filter rationale:**
- Symptoms > 500 chars are typically file dumps (unactionable noise)
- ERROR_INDICATORS + stack trace patterns ensure error legitimacy
- Fixes must be non-empty (entries without resolutions aren't useful)

## Deviations from Plan

None - plan executed exactly as written.
