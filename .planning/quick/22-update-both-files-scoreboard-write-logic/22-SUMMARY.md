---
phase: quick-22
plan: "01"
subsystem: governance
tags: [scoreboard, quorum, orchestrator, round-evolution, quorum.md]
dependency_graph:
  requires: []
  provides: [compact-scoreboard-write-format, round-evolution-display]
  affects:
    - /Users/jonathanborduas/.claude/agents/qgsd-quorum-orchestrator.md
    - /Users/jonathanborduas/.claude/commands/qgsd/quorum.md
tech_stack:
  added: []
  patterns: [compact-table-rows, unicode-box-drawing]
key_files:
  created: []
  modified:
    - /Users/jonathanborduas/.claude/agents/qgsd-quorum-orchestrator.md
    - /Users/jonathanborduas/.claude/commands/qgsd/quorum.md
decisions:
  - "Both files are outside the git repo (~/.claude/); changes are disk-only (consistent with quick-20 precedent)"
  - "Closing sentinel 'Update the scoreboard BEFORE delivering output to the user.' kept to avoid double-meaning; prepended with specific Write call instruction"
  - "Mode B Step 5 gets one-line reference only (not full table) — table template lives in Mode A Step 5 to avoid duplication"
metrics:
  duration: "2 min"
  completed: "2026-02-21"
  tasks: 2
  files: 2
---

# Quick Task 22: Update Both Files — Scoreboard Write Logic Summary

**One-liner:** Orchestrator r8_scoreboard gains explicit compact row format (| MM-DD | task | R | ... |) with 7 cell encoding rules; quorum.md gains round-evolution table after multi-round deliberation in both Mode A and Mode B.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Update orchestrator r8_scoreboard section | disk-only | /Users/jonathanborduas/.claude/agents/qgsd-quorum-orchestrator.md |
| 2 | Update quorum.md round-evolution display | disk-only | /Users/jonathanborduas/.claude/commands/qgsd/quorum.md |

## What Was Built

### Task 1 — Orchestrator r8_scoreboard compact write format

Replaced the vague "append rows" instruction in `<r8_scoreboard>` with a concrete write spec.

The section now contains:
- Explicit row format: `| MM-DD | <task-label> | <round> | <claude> | <codex> | <gemini> | <opencode> | <copilot> | <verdict> |`
- 7 cell encoding rules: TP / TN / FP / FN / TP+ / — / blank — each with precise condition
- Sub-round labeling: SH-1, SH-2, etc. for R3.6 improvement iterations
- Cumulative Scores table update instructions (increment TP/TN/FP/FN/Impr, recalculate Score)
- Explicit requirement: scoreboard Write call MUST happen BEFORE delivering output to the user

The format matches the live scoreboard header column-for-column.

### Task 2 — quorum.md round-evolution display

Two locations updated:

**Mode A Step 5 (Deliberation rounds):** Added `#### Round Evolution Display` sub-section after the existing deliberation loop description. The sub-section:
- Guards on `rounds > 1` — single-round consensus does NOT render the table
- Shows full unicode box-drawing table template with example rows
- Defines arrow indicators: `↑` (moved toward consensus), `↓` (regression), `(stable)`, `—` (UNAVAILABLE)
- Includes bracketed argument label showing what caused each position change

**Mode B Step 5 (Collect verdicts):** Added one-line reference after deliberation trigger: "When deliberation ends, render the Round Evolution table (same format as Mode A Step 5) using verdict labels (APPROVE / REJECT / FLAG). Only render when rounds > 1."

Steps 1–4 and Steps 6–7 in both modes are untouched.

## Verification

### Scoreboard format match

Live scoreboard header:
```
| Date  | Task  | R  | Claude | Codex | Gemini | OpenCode | Copilot | Verdict |
```

Orchestrator row format:
```
| MM-DD | <task-label> | <round> | <claude> | <codex> | <gemini> | <opencode> | <copilot> | <verdict> |
```

Column-for-column match confirmed.

### quorum.md structure intact

- Mode A Step 5: `#### Round Evolution Display` present with `rounds > 1` condition guard
- Mode B Step 5: one-line reference added after deliberation trigger
- Mode A Steps 1–4, 6–7: unchanged
- Mode B Steps 1–4, 6: unchanged

## Deviations from Plan

None — plan executed exactly as written.

Both files are outside the git repo (`~/.claude/`), consistent with the disk-only precedent established in quick-20. No git commit for the modified files; changes live on disk.

## Self-Check

- [x] /Users/jonathanborduas/.claude/agents/qgsd-quorum-orchestrator.md — `<r8_scoreboard>` section contains compact row format with 7 cell encoding rules
- [x] /Users/jonathanborduas/.claude/commands/qgsd/quorum.md — Mode A Step 5 has `#### Round Evolution Display` with `rounds > 1` guard; Mode B Step 5 has one-line reference
- [x] Scoreboard column format matches live scoreboard header
- [x] No other sections of either file modified

## Self-Check: PASSED
