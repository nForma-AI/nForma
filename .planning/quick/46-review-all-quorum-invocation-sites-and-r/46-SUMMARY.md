---
phase: quick-46
plan: "01"
subsystem: quorum-commands
tags: [verbosity, quorum, ux, step-labels]
dependency_graph:
  requires: []
  provides: [quorum.md-no-step-labels, quorum-test.md-no-step-labels]
  affects: [commands/qgsd/quorum.md, commands/qgsd/quorum-test.md]
tech_stack:
  added: []
  patterns: [markdown-section-headers]
key_files:
  created: []
  modified:
    - commands/qgsd/quorum.md
    - commands/qgsd/quorum-test.md
decisions:
  - "Strip all Step N: prefixes from section headers; keep descriptive names intact"
  - "Remove 'Forming Claude's position...' narration line from Mode A banner"
  - "Convert 1a/1b/1c/1d sub-labels in quorum-test.md to plain prose headings"
  - "Update inline cross-references (skip to Step 6 / Step 7) to use renamed section names"
metrics:
  duration: "~2min"
  completed: "2026-02-22"
  tasks_completed: 2
  files_modified: 2
---

# Phase quick-46 Plan 01: Reduce quorum verbosity — strip step labels from quorum.md and quorum-test.md Summary

Strip numbered "Step N:" section headers from quorum.md and quorum-test.md so quorum invocations produce a compact, scannable trace without narrating each phase number.

## What Was Done

### Task 1: Reduce verbosity in commands/qgsd/quorum.md

Removed all "Step N:" prefixes from section headers across both Mode A and Mode B:

- `## Step 0: Team identity capture` → `### Team identity capture`
- `### Step 1: Parse question` → `### Parse question`
- `### Step 2: Claude forms position (Round 1)` → `### Claude's position (Round 1)`
- `### Step 3: Query each model sequentially` → `### Query models (sequential)`
- `### Step 4: Evaluate Round 1 — check for consensus` → `### Evaluate Round 1 — check for consensus`
- `### Step 5: Deliberation rounds (R3.3)` → `### Deliberation rounds (R3.3)`
- `### Step 6: Consensus output` → `### Consensus output`
- `### Step 7: Escalate — no consensus after 4 rounds` → `### Escalate — no consensus after 4 rounds`
- Mode B: `### Step 1-6` headers all stripped of "Step N:" prefix
- Removed trailing `Forming Claude's position...` line from Mode A banner display block
- Updated inline cross-references: "skip to Step 6 (consensus output)" → "skip to **Consensus output**"

Commit: `e8aaf14`

### Task 2: Reduce verbosity in commands/qgsd/quorum-test.md

Removed all "Step N:" prefixes from bold section headers and "Na." sub-label prefixes:

- `**Step 0: Detect test runner**` → `**Detect test runner**`
- `**Step 1: Parse and validate target**` → `**Parse and validate target**`
- Sub-labels `**1a. Parse $ARGUMENTS:**`, `**1b. Empty check:**`, `**1c. File existence check:**`, `**1d. Validation summary:**` → plain prose labels without bold Nx. prefix
- `**Step 2: Capture execution bundle**` → `**Capture execution bundle**`
- `**Step 3: Immediate BLOCK if exit code != 0**` → `**Immediate BLOCK if exit code is non-zero**`
- `**Step 4: Assemble bundle**` → `**Assemble bundle**`
- `**Step 5: Dispatch parallel quorum workers**` → `**Dispatch parallel quorum workers**`
- `**Step 6: Collect verdicts and render table**` → `**Collect verdicts and render table**`
- `**Step 7: Save artifact**` → `**Save artifact**`

Commit: `063674a`

## Verification

```
grep -rn "Step [0-9]" commands/qgsd/quorum.md commands/qgsd/quorum-test.md
# Returns: (empty — zero matches)
```

All ━━━ banner blocks, bash code blocks, quorum prompt templates, structured output tables, and `## Mode A` / `## Mode B` top-level section headers are unchanged.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Inline cross-references still contained "Step N" wording**
- **Found during:** Task 1 verification
- **Issue:** Two inline prose references (`skip to **Step 6 (consensus output)**` and `→ **Step 7 (escalate)**`) matched the `grep -n "Step [0-9]"` zero-match verification criterion even though they were not headers
- **Fix:** Updated both references to use the new section names (`**Consensus output**` and `**Escalate**`)
- **Files modified:** commands/qgsd/quorum.md
- **Commit:** e8aaf14 (included in Task 1 commit)

## Self-Check: PASSED

| Item | Status |
|------|--------|
| commands/qgsd/quorum.md | FOUND |
| commands/qgsd/quorum-test.md | FOUND |
| .planning/quick/46-.../46-SUMMARY.md | FOUND |
| Commit e8aaf14 | FOUND |
| Commit 063674a | FOUND |
