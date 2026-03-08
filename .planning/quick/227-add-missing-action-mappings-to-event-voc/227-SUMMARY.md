---
phase: quick-227
plan: 01
status: complete
---

# Quick Task 227: Add missing action mappings for Gate A unmapped trace actions

## Changes

### 1. Fixed action normalization in gate-a-grounding.cjs
- Added `event.action || event.type` fallback to match `mapToXStateEvent()` behavior
- 8180 conformance events had `type` field but no `action` field (all `quorum_fallback_t1_required`)
- These were being classified as `instrumentation_bug` because `event.action` was `undefined`

### 2. Added non-FSM classification bypass in gate-a-grounding.cjs
- New Step 1b between vocabulary check and XState mapping
- Actions with `classification: "observability"` or `"instrumentation_gap"` are counted as "explained" without requiring XState event validation
- Resolves 15 `security_sweep:no_xstate_map` false positives

### 3. Added missing vocabulary entries to event-vocabulary.json
- Added `quorum_fallback_t1_required` (maps to `QUORUM_START`)
- Added `deliberation_round` (maps to `VOTES_COLLECTED`)

## Results

| Metric | Before | After |
|--------|--------|-------|
| Grounding score | 0.8625 | 1.0000 |
| Instrumentation bugs | 8195 | 0 |
| Non-FSM skips | 0 | 15 |
| Explained events | 51393/59588 | 59588/59588 |
| Target met | Yes (0.86 > 0.80) | Yes (1.00 > 0.80) |

## Files Modified
- `bin/gate-a-grounding.cjs` — action normalization, non-FSM classification bypass, methodology output
- `.planning/formal/evidence/event-vocabulary.json` — added 2 missing action entries
