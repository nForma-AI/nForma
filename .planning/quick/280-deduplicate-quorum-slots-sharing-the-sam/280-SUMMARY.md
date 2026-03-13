---
phase: quick-280
plan: 01
subsystem: quorum-dispatch
tags: [quorum-slots, model-deduplication, fallback-sequence, diversity]
status: Completed
completed_date: 2026-03-12
requires: []
provides: [model-dedup-logic, fallback-seq-v2]
affects: [nf-prompt.js, FALLBACK-01 behavior]
tech_stack:
  added: []
  patterns: [model-dedup via Map, MODEL-DEDUP tier insertion, auth_type sort order]
---

# Quick Task 280: Deduplicate quorum slots sharing the same model for LLM diversity

**One-liner:** Model deduplication logic added to quorum dispatch; duplicate-model slots demoted to fallback tier between T1 and T2, maximizing LLM diversity within fan-out budget.

## Summary

Successfully implemented automatic deduplication of quorum slots that share the same underlying model. The solution ensures the quorum gets diverse model perspectives by keeping only the first slot for each unique model in the primary dispatch list, and demoting duplicate-model slots to a new MODEL-DEDUP fallback tier positioned between T1 and T2 in the FALLBACK-01 sequence.

## Tasks Completed

### Task 1: Add model-dedup step to nf-prompt.js
- Added `deduplicateByModel(orderedSlots, agentCfg)` function that:
  - Creates a `seenModels` Map to track first slot claiming each model
  - Iterates through slots and classifies them as unique or duplicate
  - Logs stderr when a slot is demoted (for audit trail)
  - Returns `{ unique: [...], duplicates: [...] }`
- Integrated dedup into main dispatch logic AFTER task classification, BEFORE cache check
- Dedup operates on cappedSlots (after externalSlotCap slice) to respect fan-out budget
- Updated buildFalloverRule to accept optional `modelDedupSlots` parameter
- MODEL-DEDUP tier inserted between T1 and T2 with correct step numbering
- Exported deduplicateByModel for unit testing

### Task 2: Add model-dedup tests and enhance preflight output
- Created `test/model-dedup.test.cjs` with 10 comprehensive test cases:
  1. No duplicates — all unique models (4 slots → 4 unique)
  2. One pair of duplicates — codex-1/2 (sub slot wins)
  3. Two pairs of duplicates — codex-1/2 + gemini-1/2
  4. Auth-type sort order respected (sub agent preferred)
  5. Unknown models treated as unique (fallback to 'unknown')
  6. Model-dedup tier rendered in FALLBACK-01 output
  7. Empty model-dedup tier produces no MODEL-DEDUP line
  8. Step numbering correct with model-dedup (1→2→3→4)
  9. Model-dedup + T2 only (no T1) scenario
  10. Full integration test: dedup result → buildFalloverRule
- Updated `bin/quorum-preflight.cjs` buildTeam function to include display_provider field
- Preflight --team output now shows model and provider per slot for dedup visibility

### Task 3: Sync hooks/dist and run install
- Copied updated hook to hooks/dist/nf-prompt.js
- Ran installer: `node bin/install.js --claude --global`
- Verified installed copy at ~/.claude/hooks/ contains dedup logic
- Installer completed successfully with no errors

## Verification Results

**Model-dedup tests:** 10/10 PASS
- All dedup logic scenarios validated
- Mock agentCfg configuration used for isolated testing
- Logging output verified (MODEL-DEDUP stderr messages)

**Fallback-01 regression tests:** 7/7 PASS
- T1 empty + T2 has slots case verified
- T1 + T2 both populated verified
- T1 only case verified
- No fallback case verified
- Large T2 pool verified
- Primary slot ordering preserved
- maxSize value in instruction verified
- No regression in existing FALLBACK-01 behavior

**Preflight output verification:**
- `node bin/quorum-preflight.cjs --team` returns JSON with display_provider field
- codex-1/codex-2 both show model: "gpt-5.4", display_provider: "OpenAI"
- gemini-1/gemini-2 both show model: "gemini-3-pro-preview", display_provider: "Google"

**Installed hook verification:**
- `grep 'deduplicateByModel' ~/.claude/hooks/nf-prompt.js` returns 3 matches (function def, call, export)

## Key Changes

### hooks/nf-prompt.js
- **New function:** deduplicateByModel (lines ~310-330)
- **Integration point:** Inserted after task classification, before cache check (line ~638)
- **Dispatch list update:** cappedSlots → dedup → uniqueSlots (primary dispatch)
- **Fallback enhancement:** MODEL-DEDUP tier created from duplicates, inserted between T1 and T2
- **buildFalloverRule signature:** Added optional modelDedupSlots parameter
- **Export:** deduplicateByModel added to module.exports

### bin/quorum-preflight.cjs
- **buildTeam function:** Enhanced to include display_provider field alongside model

### test/model-dedup.test.cjs
- **New file:** 10 comprehensive test cases covering dedup scenarios
- **Test structure:** Compatible with existing fallback-01-regression.test.cjs pattern (assert, custom runner, exit code)

### hooks/dist/nf-prompt.js
- **Synced:** Copy of updated hooks/nf-prompt.js
- **Purpose:** Installed globally via bin/install.js

## Deviations from Plan

None — plan executed exactly as written. All tasks completed within scope, all tests passing, all verifications successful.

## Known Behaviors

1. **Model lookup:** Defaults to 'unknown' if agentCfg entry missing (fail-open)
2. **Auth-type preference:** First slot in orderedSlots wins for each model (respects sub agent priority)
3. **Step numbering:** Automatically adjusted when MODEL-DEDUP tier is present
4. **Logging:** Stderr output for each demotion: `[nf-dispatch] MODEL-DEDUP: {slot} ({model}) demoted to fallback — duplicate of {primary}`
5. **Fallback message:** CRITICAL directive updated to mention MODEL-DEDUP when present
6. **Model-dedup tier position:** Always between T1 and T2 for proper fallback order (try dedup before CCR slots)

## Testing Notes

- Tests use mock agentCfg to avoid external dependencies
- deduplicateByModel is pure function — deterministic results
- buildFalloverRule backward compatible — optional modelDedupSlots param defaults to undefined
- stderr capture in tests verifies logging without polluting test output

## Design Rationale

- **Dedup after externalSlotCap:** Ensures fan-out budget is applied to unique-model slots only, maximizing diversity
- **Dedup before cache check:** Ensures cache key includes deduplicated dispatch list
- **MODEL-DEDUP tier position:** Between T1 and T2 because:
  - Same model as primary → similar behavior/reliability as primary
  - But unlike T1 (different slot family), should not be preferred over T2 (different provider)
  - Try it after T1 exhausted, but before giving up to T2
- **Logging to stderr:** Audit trail for quorum debugging without polluting stdout JSON

## Related Requirements

- QUICK-280: Deduplicate quorum slots sharing the same model for LLM diversity (COMPLETE)
