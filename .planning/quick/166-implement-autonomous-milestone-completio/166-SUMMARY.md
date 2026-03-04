---
one_liner: "Extended --auto pipeline to drive milestones to completion autonomously via audit → gap-closure → re-audit loop"
requirements_completed: [QUICK-166]
---

# Quick Task 166: Implement Autonomous Milestone Completion Loop

## What Changed

Extended the existing `--auto` pipeline to handle milestone completion end-to-end instead of stopping after audit.

### Before
```
plan-phase --auto → execute-phase → transition → audit-milestone → STOP (suggests next steps)
```

### After
```
plan-phase --auto → execute-phase → transition → audit-milestone --auto → [loop: plan-gaps → execute → re-audit] → complete-milestone
```

## Files Modified

### 1. `qgsd-core/workflows/audit-milestone.md`
- Added `--auto` and `--iteration N` argument parsing in Step 0
- New **Auto-Loop Mode** section in `<offer_next>`:
  - `passed` → auto-invoke `complete-milestone`
  - `tech_debt` → auto-complete (accept debt)
  - `gaps_found` → auto plan-gaps → execute → re-audit loop
- Safety limits: `MAX_ITERATIONS=3`, user confirmation gate after iteration 2
- Iteration counter passed via `--iteration` flag across re-invocations

### 2. `qgsd-core/workflows/transition.md`
- Route B (milestone complete, yolo mode): both LOOP-01 and LOOP-02 now pass `--auto` to audit-milestone invocation

### 3. `commands/qgsd/audit-milestone.md`
- Updated `argument-hint` to show `[version] [--auto]`
- Added `AskUserQuestion` to `allowed-tools` (for the iteration 2 safety gate)

## Design Decisions

- **No new command needed** — extending existing workflows is cleaner than a standalone `/qgsd:auto-complete-milestone`
- **Iteration counter via CLI flag** — `--iteration N` allows re-invocation via SlashCommand while preserving loop state
- **User gate at iteration 2** — balances autonomy with safety (3 max means at most 1 unconfirmed iteration)
- **Tech debt = auto-complete** — in auto mode, tech debt is acceptable (it's tracked in MILESTONE-AUDIT.md)
