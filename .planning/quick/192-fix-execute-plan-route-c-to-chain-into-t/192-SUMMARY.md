---
phase: quick-192
plan: 01
subsystem: workflow-engine
tags: [execute-plan, audit-milestone, route-c, gap-closure]
dependency_graph:
  requires: []
  provides: [execute-plan-audit-chaining]
  affects: [core/workflows/execute-plan.md]
tech_stack:
  added: []
  patterns: [audit-before-complete, gap-closure-detection]
key_files:
  modified:
    - core/workflows/execute-plan.md
decisions:
  - Route C now chains into /nf:audit-milestone instead of suggesting /nf:complete-milestone directly
  - Gap closure detection mirrors transition.md Route B logic exactly
  - No emoji used in execute-plan.md (maintains existing file style)
metrics:
  duration: 49s
  completed: 2026-03-06
---

# Quick Task 192: Fix execute-plan Route C audit-milestone chaining

Route C in execute-plan.md now chains into /nf:audit-milestone with gap-closure detection, matching transition.md Route B logic for both yolo and interactive modes.

## What Changed

### Task 1: Expand Route C in execute-plan.md

Replaced the Route C one-liner table entry with a full expanded section that:

1. **Gap closure detection** -- checks ROADMAP.md for Gap Closure marker on the completed phase
2. **Gap closure re-audit path (IS_GAP_CLOSURE=1+)** -- yolo auto-invokes `/nf:audit-milestone {version} --auto`; interactive suggests `/nf:audit-milestone {version}`
3. **Primary completion path (IS_GAP_CLOSURE=0)** -- yolo auto-invokes `/nf:audit-milestone {version} --auto`; interactive suggests `/nf:audit-milestone {version}`

The direct `/nf:complete-milestone` suggestion is removed. Audit-milestone itself gates complete-milestone, ensuring milestone audits are never skipped.

**Commit:** 1711e881

### Task 2: Install sync

Ran `node bin/install.js --claude --global` to deploy updated workflow to `~/.claude/nf/workflows/execute-plan.md`. Installed copy confirmed to have Route C changes.

## Verification Results

- `grep "audit-milestone"` -- 6 matches in Route C section
- `complete-milestone` removed from offer_next step region
- `IS_GAP_CLOSURE` detection present (3 references)
- `offer_next` step tag count: 1 (unchanged structure)
- Total `<step name=` count: 24 (unchanged from before edit)
- Installed copy at `~/.claude/nf/workflows/` has Route C changes

## Deviations from Plan

None -- plan executed exactly as written.

## Self-Check: PASSED
