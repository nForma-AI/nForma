---
phase: quick-16
plan: 01
subsystem: commands/qgsd
tags: [discuss-phase, quorum, pre-filter, auto-resolve, classification]
dependency_graph:
  requires: [CLAUDE.md R4, qgsd/workflows/discuss-phase.md]
  provides: [quorum_filter step, assumptions[] classification, preference_questions[] classification]
  affects: [qgsd/workflows/discuss-phase.md, commands/qgsd/discuss-phase.md]
tech_stack:
  added: []
  patterns: [quorum-pre-filter, auto-resolve-classification, preference-question-with-recommendation]
key_files:
  created: []
  modified:
    - /Users/jonathanborduas/.claude/qgsd/workflows/discuss-phase.md
    - /Users/jonathanborduas/.claude/commands/qgsd/discuss-phase.md
decisions:
  - "quorum_filter step inserted between analyze_phase and present_gray_areas — enforces R4 structurally in the workflow itself, not just via behavioral instruction"
  - "Two-list classification: assumptions[] (auto-resolved, never shown to user) and preference_questions[] (shown with Claude recommendation)"
  - "All-auto-resolved transition rule: skip present_gray_areas entirely, go directly to write_context"
  - "Auto-resolved assumptions persisted to CONTEXT.md under ### Auto-Resolved Assumptions section for planner transparency"
  - "Command entry point updated to reference qgsd workflow (was referencing get-shit-done workflow — stale reference fixed)"
metrics:
  duration: 4 min
  completed: 2026-02-21
  tasks_completed: 2
  files_modified: 2
---

# Quick Task 16: Improve Discuss-Phase Skill with Quorum Summary

**One-liner:** Explicit quorum_filter step added to discuss-phase workflow that classifies gray area questions into auto-resolved assumptions and genuine preference questions before any reach the user — with Claude's recommendation attached to each preference option.

## Tasks Completed

| # | Task | Files |
|---|------|-------|
| 1 | Add quorum_filter step to discuss-phase workflow | /Users/jonathanborduas/.claude/qgsd/workflows/discuss-phase.md |
| 2 | Update command entry point to reflect quorum pre-filter | /Users/jonathanborduas/.claude/commands/qgsd/discuss-phase.md |

## What Was Built

### Task 1: quorum_filter step in workflow

A new `<step name="quorum_filter">` was inserted between `analyze_phase` and `present_gray_areas` in the discuss-phase workflow. The step:

1. Runs quorum (per CLAUDE.md R3) on every candidate gray area question before any are shown to the user
2. Classifies each question using a signal-based decision table:
   - **Auto-resolve signals:** "industry standard", "implementation detail", "unanimous best practice", "performance-determined" → record as assumption
   - **Preference signals:** "visual style", "information density", "interaction model", "user workflow preference" → keep for user with Claude's recommendation
3. Builds two lists:
   - `assumptions[]` — auto-resolved: question + agreed answer
   - `preference_questions[]` — genuine preference: question + Claude's recommendation + 1-sentence reasoning
4. Implements transition rule: if `preference_questions[]` is empty, skip `present_gray_areas` entirely and notify "All gray areas were auto-resolved by quorum. No questions needed."
5. Mandates that `assumptions[]` be persisted to CONTEXT.md under `### Auto-Resolved Assumptions` by the `write_context` step

The `present_gray_areas` step was also updated to:
- Display the `assumptions[]` block first (numbered list of what quorum decided)
- Show only `preference_questions[]` in the multi-select picker
- Append "Claude recommends: [recommendation]" to each option description

The `write_context` step template was updated to include a `### Auto-Resolved Assumptions` subsection.

### Task 2: Command entry point update

The command entry point at `/Users/jonathanborduas/.claude/commands/qgsd/discuss-phase.md` was updated:

1. **Process step 3.5 added** between analyze and present — explicit quorum pre-filter with classification rules
2. **Step 4 rewritten** to describe the two-part presentation (assumptions block + preference picker)
3. **Objective updated** to mention the quorum pre-filter parenthetically: "(Quorum pre-filters: only genuine preference questions reach the user; auto-resolved assumptions are shown first)"
4. **Success criteria expanded** with three new items: quorum pre-filter ran, assumptions listed first, each preference question shown with recommendation
5. **Stale reference fixed:** `execution_context` was referencing `get-shit-done` workflow — updated to reference `qgsd` workflow correctly
6. **Command name fixed:** `name:` field was `gsd:discuss-phase` — updated to `qgsd:discuss-phase`

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Stale get-shit-done reference in execution_context**
- **Found during:** Task 2
- **Issue:** Command entry point `execution_context` referenced `/Users/jonathanborduas/.claude/get-shit-done/workflows/discuss-phase.md` and `/Users/jonathanborduas/.claude/get-shit-done/templates/context.md` — both stale paths from before the QGSD migration
- **Fix:** Updated to reference `/Users/jonathanborduas/.claude/qgsd/workflows/discuss-phase.md` only (context.md template is loaded by the workflow itself)
- **Files modified:** `/Users/jonathanborduas/.claude/commands/qgsd/discuss-phase.md`

**2. [Rule 1 - Bug] Wrong command name in frontmatter**
- **Found during:** Task 2
- **Issue:** `name: gsd:discuss-phase` — should be `qgsd:discuss-phase` post-migration
- **Fix:** Updated to `name: qgsd:discuss-phase`
- **Files modified:** `/Users/jonathanborduas/.claude/commands/qgsd/discuss-phase.md`

## Verification Results

All 6 plan verification checks passed:

1. `quorum_filter` step found at line 194 in workflow
2. `assumptions[]` found at line 216 and 232 in workflow
3. `preference_questions[]` found at line 221 and 229 in workflow
4. `Claude recommends` found at lines 273, 277, 282, 284, 286, 288, 294, 296, 298, 300, 306, 308, 310, 312 in workflow
5. `Quorum pre-filter` found at lines 21, 42, 85 in command entry point
6. Step order confirmed: analyze_phase (169) → quorum_filter (194) → present_gray_areas (240)

## Notes on Commit

The modified files (`~/.claude/qgsd/workflows/discuss-phase.md` and `~/.claude/commands/qgsd/discuss-phase.md`) are installed configuration files that live outside the QGSD git repository. The `gsd-tools.cjs commit` command only tracks files within the QGSD repo scope, so it returns `nothing_to_commit` for these files as expected. This SUMMARY.md and the STATE.md update serve as the delivery record for this quick task.

## Self-Check

- SUMMARY.md created: FOUND
- Both target files modified and verified via grep
- Step ordering verified by line numbers
- All plan success criteria satisfied
