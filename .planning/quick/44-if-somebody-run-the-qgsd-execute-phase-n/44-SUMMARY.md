---
phase: quick-44
plan: 01
subsystem: workflow
tags: [execute-phase, plan-phase, transition, auto-advance, chain]

requires:
  - phase: quick-40
    provides: "research always runs on /qgsd:plan-phase (plan-phase.md Step 5)"

provides:
  - "execute-phase --auto chains through all milestone phases automatically"
  - "transition.md yolo Route A always routes to plan-phase (not discuss-phase) regardless of CONTEXT.md"
  - "plan-phase.md step 4 auto-bypass: --auto + no CONTEXT.md skips AskUserQuestion"

affects: [execute-phase, plan-phase, transition, workflow-automation]

tech-stack:
  added: []
  patterns:
    - "--auto flag propagation: execute-phase passes --auto through transition to plan-phase to next execute-phase"
    - "Guard clause pattern: fast-path before interactive gate when --auto is set"

key-files:
  created: []
  modified:
    - /Users/jonathanborduas/.claude/qgsd/workflows/transition.md
    - /Users/jonathanborduas/.claude/qgsd/workflows/plan-phase.md
    - /Users/jonathanborduas/code/QGSD/get-shit-done/workflows/transition.md
    - /Users/jonathanborduas/code/QGSD/get-shit-done/workflows/plan-phase.md

key-decisions:
  - "Also updated source repo files (get-shit-done/workflows/) alongside installed (~/.claude/qgsd/workflows/) to keep them in sync"
  - "GSD base transition.md also updated (uses /gsd: prefix) since installed command references it directly"
  - "execute-phase.md required no changes — already propagates --auto to transition inline"

patterns-established:
  - "Auto fast-path pattern: check --auto flag first, bypass interactive gate, proceed to next step"

requirements-completed: []

duration: 3min
completed: 2026-02-22
---

# Quick 44: --auto Chain Through All Milestone Phases

**Two surgical workflow fixes enable fully unattended milestone execution: transition.md no longer routes to discuss-phase when CONTEXT.md absent, and plan-phase.md skips AskUserQuestion when --auto is set.**

## Performance

- **Duration:** 3 min
- **Started:** 2026-02-22T15:09:39Z
- **Completed:** 2026-02-22T15:12:52Z
- **Tasks:** 3
- **Files modified:** 4

## Accomplishments

- Fixed transition.md yolo Route A: both CONTEXT.md-exists and not-exists branches now invoke `SlashCommand("/qgsd:plan-phase [X+1] --auto")` — discuss-phase no longer breaks the chain
- Fixed plan-phase.md step 4: added `--auto` fast-path guard clause before AskUserQuestion — when `--auto` and no CONTEXT.md, logs auto-bypass and proceeds to step 5 without blocking
- Verified full chain trace end-to-end: execute → transition → plan → execute cycles automatically until `is_last_phase=true` or `gaps_found`

## Task Commits

Each task was committed atomically:

1. **Task 1: Fix transition.md — route --auto to plan-phase regardless of CONTEXT.md** - `a0400d9` (feat) [source], installed copy updated directly
2. **Task 2: Fix plan-phase.md — bypass AskUserQuestion when --auto and no CONTEXT.md** - `a0400d9` (feat) [source], installed copy updated directly
3. **Task 3: Verify full chain and commit** - `a0400d9` (feat)

## Files Created/Modified

- `/Users/jonathanborduas/.claude/qgsd/workflows/transition.md` — yolo Route A no-CONTEXT.md branch: discuss-phase → plan-phase
- `/Users/jonathanborduas/.claude/qgsd/workflows/plan-phase.md` — step 4: added --auto guard clause before AskUserQuestion
- `/Users/jonathanborduas/code/QGSD/get-shit-done/workflows/transition.md` — same fix in source repo (committed)
- `/Users/jonathanborduas/code/QGSD/get-shit-done/workflows/plan-phase.md` — same fix in source repo (committed)

## Chain Trace (Verified)

```
/qgsd:execute-phase N --auto
  → Phase N executes all plans
  → verify_phase_goal: passed
  → offer_next: detects --auto → reads transition.md inline
  → transition yolo Route A (no CONTEXT.md):
      SlashCommand("/qgsd:plan-phase [X+1] --auto")  ← FIXED
  → plan-phase step 4: --auto + no CONTEXT.md:
      ⚡ Auto-continuing without context (--auto mode) → step 5  ← FIXED
  → plan-phase step 14: --auto → Task(execute-phase [X+1] --auto)
  → ... cycle repeats until is_last_phase=true OR gaps_found
```

**Chain-stopping conditions (unchanged):**
- `gaps_found` in verify_phase_goal → stops at gap closure prompt
- `is_last_phase=true` → Route B → complete-milestone
- Real execution failure with no diagnosis → asks user

## Decisions Made

- Updated both installed (`~/.claude/qgsd/workflows/`) and source (`get-shit-done/workflows/`) copies to keep them in sync — committed the source changes to git
- The GSD base `~/.claude/get-shit-done/workflows/transition.md` was also updated (uses `/gsd:` prefix) because the installed `/qgsd:plan-phase` command references it directly via `@~/.claude/get-shit-done/workflows/plan-phase.md`
- `execute-phase.md` required no changes — already has correct `--auto` propagation at the `offer_next` step

## Deviations from Plan

**1. [Rule 2 - Missing Critical] Also updated GSD base installed files**
- **Found during:** Task 3 (chain verification)
- **Issue:** The installed `/qgsd:plan-phase` command references `@~/.claude/get-shit-done/workflows/plan-phase.md` (GSD base), not the QGSD-specific file. Plan only specified `~/.claude/qgsd/workflows/plan-phase.md`. Without updating the GSD base, the fix would not take effect in the live chain.
- **Fix:** Applied identical fixes to `~/.claude/get-shit-done/workflows/plan-phase.md` and `~/.claude/get-shit-done/workflows/transition.md`
- **Files modified:** Both GSD base workflow files
- **Verification:** grep confirms auto-bypass and plan-phase routing in all four files

---

**Total deviations:** 1 auto-fixed (Rule 2 — missing critical path coverage)
**Impact on plan:** Critical fix — without updating GSD base files, the chain fix would not work in practice.

## Issues Encountered

None — changes were surgical and well-specified. The only discovery was which file the installed command actually reads (GSD base, not qgsd-specific).

## Next Phase Readiness

- `/qgsd:execute-phase N --auto` now chains through all remaining phases automatically
- The chain stops correctly on gaps_found, is_last_phase, or real failures
- No manual intervention needed between phases when --auto is set and no CONTEXT.md exists

---
*Phase: quick-44*
*Completed: 2026-02-22*

## Self-Check: PASSED

Files verified:
- FOUND: `/Users/jonathanborduas/.claude/qgsd/workflows/transition.md` (Auto-continuing: Plan Phase present, Discuss Phase absent from yolo)
- FOUND: `/Users/jonathanborduas/.claude/qgsd/workflows/plan-phase.md` (Auto-continuing without context present)
- FOUND: `/Users/jonathanborduas/code/QGSD/get-shit-done/workflows/transition.md` (same fix)
- FOUND: `/Users/jonathanborduas/code/QGSD/get-shit-done/workflows/plan-phase.md` (same fix)

Commits verified:
- FOUND: `a0400d9` feat(workflow): chain execute-phase --auto through all milestone phases
