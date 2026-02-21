---
phase: quick-27
plan: 01
subsystem: quorum-command
tags: [output-format, quorum, compactness, ux]
dependency_graph:
  requires: []
  provides: [compact-quorum-output-format]
  affects: [quorum.md]
tech_stack:
  added: []
  patterns: [tight-banner-format, 1-sentence-position-constraint, no-supporting-positions]
key_files:
  created: []
  modified:
    - /Users/jonathanborduas/.claude/commands/qgsd/quorum.md
    - /Users/jonathanborduas/.claude/gsd-local-patches/commands/qgsd/quorum.md
decisions:
  - "Removed Supporting positions block entirely — Round 1 table already shows each model's position, duplication eliminated"
  - "Changed consensus answer from 'detailed and actionable' to 2-3 sentences with explicit format constraint (verdict, core reason, actionable implication)"
  - "Added explicit no-editorial-commentary prohibition after Step 6 scoreboard block to prevent walls of post-consensus text"
  - "Applied 1-sentence constraint to Claude's initial position (Step 2) and all model bullets in deliberation prompt template (Step 5)"
metrics:
  duration: "3 min"
  completed: "2026-02-21"
  tasks: 1
  files: 2
---

# Phase quick-27: Compact quorum.md output format — 1-sentence summaries, tighter banners, no supporting positions block

Applied 6 targeted format changes to both quorum.md locations to eliminate verbose output: 1-sentence model positions, no-blank-line banners, 2-3 sentence consensus answers, removed redundant Supporting positions block, and added explicit anti-commentary guard.

## Task Completed

### Task 1: Compact quorum.md output format in both locations

Applied all 6 format changes to both files simultaneously:

**Change 1 — Step 2: Claude's position constraint**
- OLD: `Claude (Round 1): [answer + reasoning — 2–4 sentences]`
- NEW: `Claude (Round 1): [verdict + core reason — 1 sentence]`

**Change 2 — Step 4: Round 1 table column header**
- OLD: `│ Round 1 Position                                         │`
- NEW: `│ Round 1 Position (≤ 60 chars)                           │`

**Change 3 — All banners: remove blank line between closing ━━━ bar and next content**
- Applied to 5 banners: Mode A Step 1, Step 6, Step 7; Mode B Step 1, Step 6

**Change 4 — Step 6 Mode A: Tighten consensus answer, remove Supporting positions block**
- OLD consensus answer: `[Full consensus answer — detailed and actionable]` + Supporting positions bullet list
- NEW consensus answer: `[2–3 sentences. State verdict, core reason, and one actionable implication. No sub-bullets, no headers.]`
- Supporting positions block removed entirely

**Change 5 — Add no-editorial-commentary instruction after Step 6 scoreboard block**
- Added: "Do NOT add editorial commentary after the consensus answer (e.g., "The split in Round 1 was illuminating..."). The consensus answer block is the final output. Stop there."

**Change 6 — Step 5: Deliberation prompt model position length**
- Added `— 1 sentence` to all 5 model position bullets in the deliberation prompt template

## Deviations from Plan

None — plan executed exactly as written.

## Verification

All 6 checks passed:
1. Step 2 says "1 sentence" — CONFIRMED (line 60)
2. Round 1 table header contains "≤ 60 chars" — CONFIRMED (line 91)
3. "Supporting positions:" is absent — CONFIRMED (grep returned nothing)
4. Step 6 template says "2–3 sentences" — CONFIRMED (line 141)
5. No blank line between banner closing ━━━ bar and content lines — CONFIRMED (all 5 banners verified)
6. "Do NOT add editorial commentary" instruction exists — CONFIRMED (line 163)
7. Both files identical — CONFIRMED (diff returned nothing)

Quorum logic, deliberation rounds, consensus evaluation, Mode B workflow, scoreboard update bash commands, and Step 7 escalation structure are all unchanged.

## Self-Check: PASSED

- `/Users/jonathanborduas/.claude/commands/qgsd/quorum.md` — FOUND (modified)
- `/Users/jonathanborduas/.claude/gsd-local-patches/commands/qgsd/quorum.md` — FOUND (modified, identical to primary)
- `diff` between both files — returns nothing (files identical)
