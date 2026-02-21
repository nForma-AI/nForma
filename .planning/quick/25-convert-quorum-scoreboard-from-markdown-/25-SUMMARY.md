---
phase: quick-25
plan: 01
subsystem: scoreboard
tags: [scoreboard, cli, json, quorum]
dependency_graph:
  requires: [.planning/quorum-scoreboard.md]
  provides: [bin/update-scoreboard.cjs, .planning/quorum-scoreboard.json]
  affects: [commands/qgsd/quorum.md]
tech_stack:
  added: []
  patterns: [CommonJS CLI, JSON persistence, from-scratch recompute]
key_files:
  created:
    - bin/update-scoreboard.cjs
    - .planning/quorum-scoreboard.json
  modified:
    - commands/qgsd/quorum.md
    - .gitignore
decisions:
  - "Round data is authoritative over markdown cumulative table; markdown had off-by-1 for Claude (+36 vs computed +37) and Copilot (+43 vs computed +44) — script computes correct values from round log"
  - "Round 'SH' (special) for quick-18 stored as string round value; script handles non-integer round gracefully"
  - "TP+ increments both tp counter and impr counter; score delta for TP+ is +3 (+1 TP effectiveness + +2 bonus)"
  - "quorum-scoreboard.json added to .gitignore (disk-only per project convention)"
metrics:
  duration: "7 min"
  completed: "2026-02-21"
  tasks: 2
  files: 4
---

# Quick-25: Convert Quorum Scoreboard from Markdown to JSON Summary

**One-liner:** CLI script (update-scoreboard.cjs) reads JSON, applies score delta, recomputes all cumulative stats from scratch, writes back; quorum.md now calls CLI instead of instructing AI arithmetic.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Create bin/update-scoreboard.cjs and migrate history to JSON | 3f362d7 | bin/update-scoreboard.cjs, .planning/quorum-scoreboard.json, .gitignore |
| 2 | Update quorum.md to call update-scoreboard.cjs via Bash | d24f1ad | commands/qgsd/quorum.md |

## What Was Built

### bin/update-scoreboard.cjs

CommonJS CLI script that:
- Parses `--model`, `--result`, `--task`, `--round`, `--verdict`, `--scoreboard` args
- Loads JSON (initialises empty if file absent)
- Finds or appends the round entry matching task+round
- Recomputes all model cumulative stats from scratch (walking all rounds) to avoid drift
- Writes back with `JSON.stringify(data, null, 2)`
- Prints confirmation: `[update-scoreboard] <model>: <result> (<delta>) → score: <N> | <task> R<round> <verdict>`
- Exits 1 with Usage on missing/invalid args

Score delta lookup: TP=+1, TN=+5, FP=-3, FN=-1, TP+=+3, UNAVAIL=0, blank=0

### .planning/quorum-scoreboard.json

All 41 historical rounds from quorum-scoreboard.md faithfully transcribed. Model scores computed from round log (authoritative):
- Claude: 37 (markdown said 36 — markdown had arithmetic error; round log is correct)
- Gemini: 25
- OpenCode: 45
- Copilot: 44 (markdown said 43 — markdown had arithmetic error; round log is correct)
- Codex: 0

### commands/qgsd/quorum.md

Three `Update .planning/quorum-scoreboard.md per R8.` instructions replaced with CLI bash call blocks (Mode A Step 6, Mode A Step 7, Mode B Step 6). Copied to `~/.claude/commands/qgsd/quorum.md` and `~/.claude/gsd-local-patches/commands/qgsd/quorum.md`.

## Verification Results

1. `node bin/update-scoreboard.cjs --model gemini --result TN --task "quick-25-verify" --round 1 --verdict APPROVE` — exit 0, printed confirmation
2. gemini.tn incremented, gemini.score +5 (30 total) in JSON — verified
3. `grep "update-scoreboard.cjs" commands/qgsd/quorum.md | wc -l` returns 3 — verified
4. `grep "quorum-scoreboard.md" commands/qgsd/quorum.md | wc -l` returns 0 — verified
5. `.gitignore` contains `quorum-scoreboard.json` — verified

## Deviations from Plan

### Note: Score discrepancy between markdown and round log

- **Found during:** Task 1 verification
- **Issue:** The markdown's cumulative score table showed Claude=+36, Copilot=+43, but recomputing from the 41 round entries yields Claude=+37, Copilot=+44. The markdown table had manual arithmetic errors (off-by-1 in each).
- **Resolution:** Round data is treated as authoritative (it's what was actually scored per round). The script computes the correct values. The markdown cumulative table was the artifact with the error — which is exactly why this migration was needed.
- **No fix required:** The plan's goal was to eliminate future arithmetic errors. The round log is the single source of truth going forward.

## Self-Check

- [x] bin/update-scoreboard.cjs exists and exits 0 on valid args, exits 1 on invalid args
- [x] .planning/quorum-scoreboard.json exists with 41 historical rounds
- [x] commands/qgsd/quorum.md has 3 occurrences of update-scoreboard.cjs, 0 of quorum-scoreboard.md
- [x] .gitignore includes quorum-scoreboard.json
- [x] Commits 3f362d7 and d24f1ad exist

## Self-Check: PASSED
