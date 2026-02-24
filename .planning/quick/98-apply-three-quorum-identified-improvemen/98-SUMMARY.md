---
phase: quick-98
plan: 01
subsystem: agents
tags: [quorum, orchestrator, prompt-wording, grounding]
dependency_graph:
  requires: []
  provides: [improved-quorum-grounding]
  affects: [agents/qgsd-quorum-orchestrator.md]
tech_stack:
  added: []
  patterns: [sequential-quorum-calls, heredoc-prompts]
key_files:
  created: []
  modified:
    - agents/qgsd-quorum-orchestrator.md
decisions:
  - "All three wording fixes were pre-applied by the planner before execution; executor verified and ran install"
metrics:
  duration: "< 2 min"
  completed: "2026-02-24"
---

# Quick Task 98: Apply Three Quorum-Identified Improvements Summary

**One-liner:** Three targeted prompt-wording improvements applied to qgsd-quorum-orchestrator.md — eliminating a duplicated narrative block, strengthening deliberation re-grounding from conditional to imperative, and elevating Mode B file-reading from reactive fallback to proactive norm.

## What Was Done

The planner pre-applied all three fixes to `agents/qgsd-quorum-orchestrator.md` before this executor was spawned. The executor verified all three were in place and ran the install to propagate the changes.

### Fix 1 — Duplication Removed (Mode A Round 1 narrative block)

The fenced narrative prompt block between "### Query models (sequential)" and "Bash call pattern" was replaced with a single prose sentence:

> "Use the grounding instruction shown in the heredoc below — the heredoc is the canonical form sent to workers."

The heredoc under "Bash call pattern" (the binding form) was left untouched.

**Verified at line 247:**
```
Use the grounding instruction shown in the heredoc below — the heredoc is the canonical form sent to workers.
```

### Fix 2 — Deliberation Strengthening (deliberation prompt in Deliberation rounds section)

The weak conditional:
> "If any prior position references codebase details you haven't verified, use your tools to read the relevant files in the Repository directory before revising."

Was replaced with a proactive imperative:
> "Before revising your position, use your tools to re-check any codebase files relevant to the disagreement. At minimum re-read CLAUDE.md and .planning/STATE.md if they exist, plus any files directly referenced in the question or prior positions."

**Verified at line 364.**

### Fix 3 — Mode B Elevation (Mode B worker prompt)

The reactive fallback:
> "If the traces reference files or behaviour that require codebase context to interpret, use your tools to read relevant files from the Repository directory before giving your verdict."

Was replaced with a proactive norm:
> "Before giving your verdict, use your tools to read relevant files from the Repository directory above. At minimum check CLAUDE.md and .planning/STATE.md if they exist. Ground your verdict in what you actually find — use your internal knowledge to reason, but let the real files be the source of truth."

**Verified at line 498.**

## Grep Verification Results

All positive checks returned matches:

| Check | Result |
|-------|--------|
| `grep "the heredoc is the canonical form"` | Line 247: FOUND |
| `grep "Before revising your position"` | Line 364: FOUND |
| `grep "Before giving your verdict"` | Line 498: FOUND |

Both removal checks returned no output (expected):

| Check | Result |
|-------|--------|
| `grep "If any prior position references codebase details"` | No output (REMOVED) |
| `grep "If the traces reference files or behaviour"` | No output (REMOVED) |

## Install Exit Code

```
node bin/install.js --claude --global
Exit code: 0
```

Install completed successfully. Updated orchestrator is live in `~/.claude/`.

## Deviations from Plan

None — plan executed exactly as written. All three fixes were pre-applied by the planner; executor confirmed and ran install.

## Self-Check: PASSED

- agents/qgsd-quorum-orchestrator.md: All three replacement strings present, both removed strings absent.
- Install exit code: 0
