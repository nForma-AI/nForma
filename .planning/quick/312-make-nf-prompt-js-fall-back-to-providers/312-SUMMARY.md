---
phase: quick-312
plan: 01
subsystem: quorum
tags: [model-deduplication, providers.json, fallback-logic, dual-subscription-slots]

requires:
  - nf-prompt.js quorum dispatch infrastructure
  - bin/providers.json slot configuration

provides:
  - deduplicateByModel with providers.json fallback
  - Dual-subscription slot deduplication even when agent_config is empty
  - Model resolution: agentCfg -> providers.json -> 'unknown'

affects:
  - quorum dispatch logic when agent_config lacks model entries
  - MODEL-DEDUP fallback tier population
  - any future slot configuration changes

tech-stack:
  added: []
  patterns:
    - "Three-tier model resolution: explicit config -> file fallback -> unknown default"
    - "Optional parameter pattern for backward compatibility (providersList is optional)"

key-files:
  created: []
  modified:
    - hooks/nf-prompt.js (deduplicateByModel function signature and model resolution)
    - hooks/dist/nf-prompt.js (synced copy, installed globally)
    - test/model-dedup.test.cjs (4 new test cases for fallback behavior)

key-decisions:
  - "Optional third parameter (providersList) preserves backward compatibility with 2-arg calls"
  - "Model resolution cascade: agentCfg takes absolute precedence, then providers.json, then 'unknown'"
  - "Unknown models never deduplicated (fail-safe: can't assert they're duplicates)"
  - "Call site uses findProviders() to read providers.json at dispatch time (module-cached read)"

requirements-completed:
  - QUICK-312

duration: 12min
completed: 2026-03-16
---

# Quick Task 312: Make nf-prompt.js fall back to providers.json for model dedup

**deduplicateByModel now resolves models via agentCfg → providers.json → 'unknown', enabling dual-subscription slot deduplication without explicit agent_config entries**

## Performance

- **Duration:** 12 min
- **Started:** 2026-03-16T12:49:00Z
- **Completed:** 2026-03-16T13:01:00Z
- **Tasks:** 2
- **Files modified:** 3 (hooks/nf-prompt.js, test/model-dedup.test.cjs, hooks/dist/nf-prompt.js)

## Accomplishments

- Modified deduplicateByModel function to accept optional providersList parameter
- Implemented three-tier model resolution: agentCfg → providers.json → 'unknown'
- Added 4 new test cases validating fallback behavior, precedence rules, backward compatibility, and mixed scenarios
- Synced dist copy and installed globally via bin/install.js --claude --global
- All 14 tests pass (10 existing + 4 new)

## Task Commits

1. **Task 1: Add providers.json fallback to deduplicateByModel** - `6ddda3b9` (feat)
   - Modified function signature to accept optional providersList parameter
   - Added providersMap lookup for model resolution with cascade: agentCfg → providers.json → 'unknown'
   - Updated call site to pass providers array from findProviders()
   - Verified all 10 existing tests pass without regression

2. **Task 2: Add tests for providers.json fallback and sync dist** - `5ce50f57` (test)
   - Test 11: Empty agentCfg with providersList deduplicates codex-1/codex-2 (same model)
   - Test 12: agentCfg takes precedence when custom model differs from providers.json entry
   - Test 13: No providersList (undefined) — backward compatible with 2-arg calls
   - Test 14: Mixed — some slots in agentCfg, others fall back to providers.json
   - Synced hooks/dist/nf-prompt.js and installed globally
   - All 14 tests pass

## Files Created/Modified

- `hooks/nf-prompt.js` - Modified deduplicateByModel function (lines 291-330)
  - Added optional `providersList` parameter
  - Added providersMap construction from providers array
  - Changed model resolution line to cascade: agentCfg → providersMap → 'unknown'
  - Added findProviders() call at dispatch site (line 655)

- `test/model-dedup.test.cjs` - Added 4 new test cases (lines 207-285)
  - Tests 11-14 cover fallback behavior, precedence, backward compat, and mixed scenarios
  - All tests validate core functionality: dedup same-model slots, respect agentCfg precedence, handle unknown models

## Decisions Made

- **Optional parameter design:** Made providersList optional to preserve backward compatibility with existing 2-arg callers. This allows gradual adoption without code refactoring.

- **Precedence hierarchy:** Chose agentCfg > providers.json > 'unknown' to respect explicit configuration (agentCfg is authoritative for custom overrides) while falling back to discovered models.

- **Call site strategy:** Used findProviders() at dispatch time rather than caching earlier. The function reads from a cached module-loaded file, so the overhead is minimal and we get fresh data each dispatch.

- **Unknown model bypass:** Preserved the existing logic that never deduplicates 'unknown' models. This is a fail-safe: if a slot's model is truly unknown, we can't assert it's a duplicate.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None - all tasks completed successfully on first attempt.

## Verification Checklist

- [x] `node test/model-dedup.test.cjs` — 14/14 tests pass
- [x] `node -e "require('./hooks/nf-prompt.js'); console.log('OK')"` — loads without error
- [x] `diff hooks/nf-prompt.js hooks/dist/nf-prompt.js` — no differences
- [x] `grep 'providersMap\|providersList' hooks/nf-prompt.js` — confirms fallback plumbing exists
- [x] Global install verified: grep confirms providers fallback code in ~/.claude/hooks/nf-prompt.js

## Next Phase Readiness

- Quorum dispatch now deduplicates dual-subscription slots (codex-1/codex-2, gemini-1/gemini-2) even when agent_config is empty
- MODEL-DEDUP fallback tier properly populated with same-model slots
- All changes backward compatible — no breaking changes to existing code or configs
- Ready for quorum tests with empty agent_config to verify model diversity enforcement

---

*Quick Task: 312*
*Completed: 2026-03-16*
