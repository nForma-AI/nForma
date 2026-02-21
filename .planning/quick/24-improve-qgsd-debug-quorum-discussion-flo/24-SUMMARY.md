---
phase: quick-24
plan: 01
subsystem: quorum-workflows
tags: [quorum, debug, role-visibility, improvement-round, auto-execute]
dependency_graph:
  requires: []
  provides:
    - Canonical quorum role taxonomy (CONTRARIAN/AGREEING/IMPROVING) defined once in orchestrator, applied everywhere
    - Role column in all quorum output tables (orchestrator, quorum.md Mode A + Mode B, debug.md)
    - Improvement round (Step 5.5) in debug.md aligned to R3.6 orchestrator pattern
    - Strict user-prompt gate: escalate only on no-consensus after max rounds
  affects:
    - ~/.claude/agents/qgsd-quorum-orchestrator.md
    - ~/.claude/commands/qgsd/quorum.md
    - ~/.claude/commands/qgsd/debug.md
    - ~/.claude/gsd-local-patches/agents/qgsd-quorum-orchestrator.md
    - ~/.claude/gsd-local-patches/commands/qgsd/quorum.md
    - ~/.claude/gsd-local-patches/commands/qgsd/debug.md
tech_stack:
  added: []
  patterns:
    - Role taxonomy: CONTRARIAN | AGREEING | IMPROVING — defined in orchestrator worker prompt and output_format; propagated to quorum.md and debug.md tables and worker prompts
    - Improvement round gate: consensus_root_cause AND has_improvements triggers v2 round with frozen root cause
    - Auto-execute gate: HIGH consensus + no improvements remaining = auto-proceed, no user prompt
key_files:
  created: []
  modified:
    - ~/.claude/agents/qgsd-quorum-orchestrator.md
    - ~/.claude/commands/qgsd/quorum.md
    - ~/.claude/commands/qgsd/debug.md
    - ~/.claude/gsd-local-patches/agents/qgsd-quorum-orchestrator.md
    - ~/.claude/gsd-local-patches/commands/qgsd/quorum.md
    - ~/.claude/gsd-local-patches/commands/qgsd/debug.md
decisions:
  - "Role taxonomy defined once in qgsd-quorum-orchestrator.md and applied in quorum.md and debug.md — single source of truth for CONTRARIAN/AGREEING/IMPROVING definitions"
  - "Step 5.5 improvement round in debug.md uses sequential tool calls (R3.2) not parallel Tasks — frozen root cause pattern mirrors R3.6 in orchestrator"
  - "Auto-execute gate condition: final_consensus_level == HIGH AND NOT has_improvements — has_improvements persists from v2 round, so v2 with remaining IMPROVING workers still defers to MED path"
metrics:
  duration: 5 min
  completed: 2026-02-21
  tasks_completed: 4
  files_modified: 6
---

# Phase quick-24 Plan 01: Canonicalize Quorum Pattern — Role Visibility, Improvement Round, Auto-Execute Gate

**One-liner:** Role taxonomy (CONTRARIAN/AGREEING/IMPROVING) defined in orchestrator and applied across quorum.md and debug.md tables and worker prompts; improvement round (Step 5.5) and strict auto-execute gate added to debug.md.

## What Was Built

Three targeted edits canonicalized the QGSD quorum pattern across all implementations:

1. **qgsd-quorum-orchestrator.md** — Added `role: CONTRARIAN | AGREEING | IMPROVING` field with rules to the Round 1 worker prompt. Updated `final_positions` in `output_format` to use `{ role: ..., position: ... }` structure for all five models (with UNAVAIL variant). Added user-escalation-only note: "user escalation ONLY fires on ESCALATED result (no consensus after 4 rounds). On APPROVED, proceed without prompting the user."

2. **quorum.md** — Added Role column to Mode A Step 4 table (3-column: Model / Role / Round 1 Position) and Mode B Step 6 table (4-column: Model / Verdict / Role / Reasoning). Updated Mode A Step 3 and Mode B Step 4 worker prompt templates to request the role field using the same taxonomy.

3. **debug.md** — Made 5 targeted changes:
   - Worker prompt: added `role:` field with CONTRARIAN/AGREEING/IMPROVING rules
   - Step 4: added `role:` to parsed fields; added consensus flag computation block (`consensus_root_cause`, `has_improvements`, `consensus_level`, `frozen_root_cause`)
   - Step 5 table: added Role column (4-column: Model / Confidence / Role / Next Step), including role count in CONSENSUS row
   - Step 5.5: inserted improvement round — fires when `consensus_root_cause AND has_improvements`; re-dispatches workers sequentially (R3.2) with frozen root cause; renders v2 table
   - Step 7: replaced vague "IF consensus" gate with strict three-branch logic: HIGH+no improvements = auto-execute, MED = partial consensus message, LOW = no consensus message. "Want me to apply the fix?" eliminated.

All six files mirrored to gsd-local-patches. Diffs confirmed clean.

## Tasks Completed

| Task | Name | Files |
|------|------|-------|
| 1 | Add role field to qgsd-quorum-orchestrator.md | ~/.claude/agents/qgsd-quorum-orchestrator.md |
| 2 | Add Role column to quorum.md tables (Mode A + Mode B) | ~/.claude/commands/qgsd/quorum.md |
| 3 | Align debug.md to canonical quorum pattern | ~/.claude/commands/qgsd/debug.md |
| 4 | Mirror all three files to gsd-local-patches and commit | 6 files (installed + patches) |

## Deviations from Plan

None - plan executed exactly as written.

## Self-Check: PASSED

- ~/.claude/agents/qgsd-quorum-orchestrator.md: contains "role: CONTRARIAN | AGREEING | IMPROVING" in worker prompt, `{ role: ..., position: ... }` in output_format, user-escalation-only note present
- ~/.claude/commands/qgsd/quorum.md: Mode A Step 4 has 3-column table with Role, Mode B Step 6 has 4-column table with Role, worker prompts in Step 3 and Step 4 request role field
- ~/.claude/commands/qgsd/debug.md: Role column in results table, Step 5.5 improvement round present, auto-execute gate on HIGH+no improvements, "Want me to apply" absent
- All three gsd-local-patches mirrors verified identical via diff (0 differences)
