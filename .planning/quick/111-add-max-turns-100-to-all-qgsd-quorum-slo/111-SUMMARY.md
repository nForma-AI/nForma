---
phase: quick
task: 111
subsystem: quorum-dispatch
tags: [quorum, slot-worker, max-turns, hang-prevention]
one-liner: "Add max_turns=100 to all qgsd-quorum-slot-worker Task dispatch sites across 5 workflow files"
key-files:
  modified:
    - commands/qgsd/quorum.md
    - qgsd-core/workflows/discuss-phase.md
    - qgsd-core/workflows/quick.md
    - qgsd-core/workflows/execute-phase.md
    - qgsd-core/workflows/plan-phase.md
decisions:
  - "max_turns=100 added after model='haiku' in all dispatch examples and prose descriptions"
  - "Pattern applied consistently: 'model=\"haiku\", max_turns=100' for all qgsd-quorum-slot-worker Tasks"
metrics:
  completed: 2026-02-26
  tasks: 5
  files: 5
---

# Quick Task 111: Add max_turns=100 to All qgsd-quorum-slot-worker Task Dispatch Sites

## Summary

Added `max_turns=100` parameter to all Task dispatch examples and prose descriptions for `qgsd-quorum-slot-worker` across all 5 workflow files. This is a companion change to quick-110 (which added `model="haiku"`). The parameter caps each slot-worker at 100 agentic turns, preventing indefinite hangs when external models are slow or quota-limited.

## Changes Made

### Total max_turns Additions: 20 across 5 files

| File | Occurrences | Locations |
|------|-------------|-----------|
| commands/qgsd/quorum.md | 13 | Mode A dispatch prose + 5 examples; Deliberation rounds prose; Mode B dispatch prose + 5 examples |
| qgsd-core/workflows/discuss-phase.md | 2 | r4_pre_filter dispatch; present_gray_areas second pass |
| qgsd-core/workflows/quick.md | 2 | Step 5.7 quorum review; Step 6.5 verification loop |
| qgsd-core/workflows/execute-phase.md | 2 | human_needed quorum resolution loop; gaps_found quorum |
| qgsd-core/workflows/plan-phase.md | 1 | Step 8.5 quorum dispatch |

### Pattern Applied

Before: `model="haiku"`
After: `model="haiku", max_turns=100`

All inline code examples updated. All prose descriptions updated. Deliberation rounds (Round 2+) carry `max_turns=100` through as well.

## Rationale

- **Prevents indefinite hangs**: External models (DeepSeek, MiniMax, Qwen) can hang for 23+ minutes. `max_turns=100` caps each worker at ~27 minutes (100 turns × 15s avg) instead of waiting forever.
- **Complements quick-110**: quick-110 added `model="haiku"` for faster orchestration. This adds `max_turns=100` for bounded execution time.
- **Consistent pattern**: All dispatch sites now have both `model="haiku", max_turns=100` — no site is missing either parameter.

## Deviations from Plan

None — plan executed exactly as written.

## Self-Check

- [x] commands/qgsd/quorum.md — 13 occurrences confirmed
- [x] qgsd-core/workflows/discuss-phase.md — 2 occurrences confirmed
- [x] qgsd-core/workflows/quick.md — 2 occurrences confirmed
- [x] qgsd-core/workflows/execute-phase.md — 2 occurrences confirmed
- [x] qgsd-core/workflows/plan-phase.md — 1 occurrence confirmed
- [x] Total: 20 occurrences (exceeds plan minimum of 20)
- [x] No `model="haiku"` instances remain without `max_turns=100` in dispatch sites

## Self-Check: PASSED
