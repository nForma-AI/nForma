---
phase: quick-274
plan: 01
completed_date: 2026-03-11
autonomous: true
subsystem: proximity-pipeline
tags: [candidate-discovery, proximity-skill, cli-flags]
dependency_graph:
  requires: []
  provides: [--top N flag in candidate discovery]
  affects: [nf:proximity skill, candidate selection pipeline]
tech_stack:
  added: []
  patterns: [CLI flag parsing, JSON metadata]
key_files:
  created: []
  modified:
    - bin/candidate-discovery.cjs
    - commands/nf/proximity.md
decisions: []
metrics:
  tasks_completed: 2
  files_modified: 2
  duration_minutes: 5
---

# Quick Task 274: Add a --top N flag to /nf:proximity

## Summary

Added a `--top N` flag to the proximity candidate discovery pipeline that caps output to the top N candidates by proximity score. The flag is integrated at both the script level (candidate-discovery.cjs) and the skill level (proximity.md), with a default of 10 enforced by the skill.

## What Was Built

**Task 1: Add --top N flag to candidate-discovery.cjs**
- Added `top: null` to default args in parseArgs()
- Implemented `--top` flag parsing with support for both `--top N` and `--top=N` syntax
- Added `--top <n>` to help text: "Return only top N candidates by score (default: all)"
- Implemented truncation logic in main() that:
  - Runs histogram logging BEFORE truncation (shows full distribution)
  - Applies defensive bounds check (only slice if 0 < top < candidate count)
  - Adds metadata fields: `top`, `candidates_before_top` to track truncation
  - Logs truncation message to stderr: "Showing top N of M candidates"

**Task 2: Update proximity.md skill to support --top flag**
- Updated YAML frontmatter `argument-hint` to include `[--top N]`
- Added `--top <N>` to Step 1 argument documentation with default 10 enforcement note
- Updated Step 3 (Discover candidates) to:
  - Pass `--top <val>` in the candidate-discovery.cjs invocation
  - Default to `--top 10` when user doesn't specify
  - Document output display: "Showing top N of M candidates"
- Added comprehensive note explaining skill default vs script default and how to bypass via `--top 0`

## Verification

**Task 1 Verification:**
```bash
node bin/candidate-discovery.cjs --help
# Shows: "  --top <n>        Return only top N candidates by score (default: all)"

node bin/candidate-discovery.cjs --min-score 0.3 --max-hops 6 --top 5 --json 2>/dev/null | \
  node -e "const d=JSON.parse(require('fs').readFileSync('/dev/stdin','utf8')); \
  console.log('count:', d.candidates.length, 'top:', d.metadata.top, 'before_top:', d.metadata.candidates_before_top)"
# Output: count: 5 top: 5 before_top: 8647
```

**Task 2 Verification:**
```bash
grep -c -- '--top' commands/nf/proximity.md
# Returns: 5 (appears in: argument-hint, Step 1, Step 3 run command, Step 3 note, notes section)
```

## Deviations from Plan

None — plan executed exactly as written.

## Key Decisions

- Script defaults to no limit (null); skill defaults to 10 for practical output limits
- Histogram logging runs before truncation to show full score distribution
- Defensive bounds check prevents slicing when top >= candidate count
- Metadata includes both `top` and `candidates_before_top` for transparency

## Files Modified

- `/Users/jonathanborduas/code/QGSD/bin/candidate-discovery.cjs` — Added --top parsing, help text, and truncation logic
- `/Users/jonathanborduas/code/QGSD/commands/nf/proximity.md` — Added --top documentation and passthrough
