---
phase: quick-103
plan: 01
subsystem: quorum
tags: [deprecation, quorum, dispatch, UX, agents]
dependency_graph:
  requires: [quick-101]
  provides: [direct-dispatch-quorum-pattern]
  affects: [commands/qgsd/quorum.md, agents/qgsd-quorum-orchestrator.md]
tech_stack:
  added: []
  patterns: [direct-inline-dispatch, fallback-pool-banner, tree-char-hierarchy]
key_files:
  created: []
  modified:
    - agents/qgsd-quorum-orchestrator.md
    - commands/qgsd/quorum.md
decisions:
  - "Deprecate qgsd-quorum-orchestrator via HTML comment (same pattern as QT-101 for worker/synthesizer) — retained for reference, not deleted"
  - "Replace <orchestrator_delegation> block with <dispatch_pattern> — quorum.md is now fully self-contained with no intermediary agent spawn"
  - "Dispatch banner shows Active slots + Fallback pool line rendered at runtime from pre-flight results"
  - "Results tables use 30-char Model column with tree chars (├─ / └─) to show primary/fallback hierarchy; fallback rows only rendered when primary is UNAVAIL"
metrics:
  duration: "4 min"
  completed: "2026-02-25"
  tasks_completed: 3
  files_modified: 2
---

# Quick Task 103: Deprecate qgsd-quorum-orchestrator and Update Quorum Dispatch UX

**One-liner:** Deprecated the qgsd-quorum-orchestrator agent via HTML comment and replaced the orchestrator_delegation block in quorum.md with direct inline dispatch (dispatch_pattern), adding a fallback pool banner and 30-char tree-char results tables for both Mode A and Mode B.

## What Was Changed

### agents/qgsd-quorum-orchestrator.md

Prepended a single HTML deprecation comment at line 1, before the frontmatter `---` block:

```
<!-- DEPRECATED: This agent is superseded by direct inline dispatch in commands/qgsd/quorum.md as of quick-103. The orchestrator Task-spawn indirection is no longer needed — quorum.md now contains the full R3 protocol inline (with qgsd-quorum-slot-worker for per-slot dispatch). Retained for reference only. Do not spawn this agent. -->
```

This matches the exact pattern used in QT-101 for `qgsd-quorum-worker.md` and `qgsd-quorum-synthesizer.md`. The file is retained for reference — it documents the full R3 protocol logic that is now inline in `quorum.md`.

### commands/qgsd/quorum.md

Four targeted changes made:

**1. Replaced `<orchestrator_delegation>` with `<dispatch_pattern>`**

The old block instructed Claude to spawn the `qgsd-quorum-orchestrator` Task agent with a fallback to inline execution. The new `<dispatch_pattern>` block removes the orchestrator intermediary entirely: Claude runs the full R3 protocol directly in the main conversation thread, dispatching slot-workers via sibling Task calls. This matches the actual execution model that QT-101 established.

**2. Updated Mode A dispatch banner**

Old banner (2 lines):
```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 QGSD ► QUORUM: Mode A — Pure Question
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

New banner (4 lines):
```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 QGSD ► QUORUM: Round 1 — N workers dispatched
 Active: gemini-1, opencode-1, copilot-1, codex-1
 Fallback pool: claude-1..claude-6 (on UNAVAIL)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

The Active line is rendered dynamically at runtime from the resolved slot list. The Fallback pool line communicates when claude-N slots are acting as substitutes for unavailable primary slots.

**3. Updated Mode A results table (Evaluate Round 1 section)**

Old: 14-char Model column with fixed hardcoded rows (Claude, Codex, Gemini, OpenCode, Copilot, dynamic catch-all).

New: 30-char Model column with tree characters showing the fallback hierarchy:

```
┌────────────────────────────────┬──────────────────────────────────────────────────────────┐
│ Model                          │ Round N Position                                         │
├────────────────────────────────┼──────────────────────────────────────────────────────────┤
│ Claude                         │ [summary — $CLAUDE_POSITION]                            │
│ gemini-1 (primary)             │ [summary or UNAVAIL]                                     │
│   └─ claude-1 (fallback)       │ [summary or UNAVAIL — only shown if primary UNAVAIL]    │
│ codex-1 (primary)              │ [summary or UNAVAIL]                                     │
│   ├─ claude-3 (fallback)       │ [summary or UNAVAIL — only shown if primary UNAVAIL]    │
│   └─ claude-4 (fallback)       │ [summary or UNAVAIL — only shown if still need quorum]  │
│ opencode-1 (primary)           │ [summary or UNAVAIL]                                     │
│ copilot-1 (primary)            │ [summary or UNAVAIL]                                     │
└────────────────────────────────┴──────────────────────────────────────────────────────────┘
```

Prose note added: fallback rows are only rendered when the primary slot returned UNAVAIL.

**4. Updated Mode B results table (Output consensus verdict section)**

Same transformation as Mode A table — 30-char Model column, tree chars, fallback hierarchy, prose note.

## Decisions Made

**Why deprecate (not delete) the orchestrator:**
The orchestrator agent contains the full R3 protocol logic that was the reference implementation before QT-101 unified quorum. Deleting it loses that reference. The deprecation comment is the canonical signal that it should not be spawned — keeping the file means future readers can understand the historical design.

**Why dispatch_pattern block replaces orchestrator_delegation:**
The old `<orchestrator_delegation>` block told Claude to spawn a Task agent. Now that quorum.md contains the full protocol inline, the indirection is unnecessary and confusing (a "fallback" that is always the primary path is not a fallback). The `<dispatch_pattern>` block clarifies the actual execution model.

**Why the banner changed:**
The old banner said "Mode A — Pure Question" which described the mode but not the runtime state. The new banner shows how many workers were dispatched, which active slots responded, and what the fallback pool is. This gives the user immediate visibility into quorum health at the moment of dispatch.

**Why tree chars (├─ / └─) for fallback hierarchy:**
When a primary slot (gemini-1) is UNAVAIL and a claude-N fallback fires, the relationship needs to be visually explicit — a flat row in the table would look like just another participant. Tree chars make the substitution relationship unambiguous without adding extra prose.

## Deviations from Plan

None — plan executed exactly as written.

## Commits

| # | Hash | Message |
|---|------|---------|
| 1 | 7d327fc | feat(quick-103): deprecate orchestrator agent, update quorum dispatch UX |

## Self-Check

- [x] `head -1 agents/qgsd-quorum-orchestrator.md` starts with `<!-- DEPRECATED:`
- [x] `grep -c "orchestrator_delegation" commands/qgsd/quorum.md` = 0
- [x] `grep -c "dispatch_pattern" commands/qgsd/quorum.md` = 2
- [x] `grep -c "Fallback pool" commands/qgsd/quorum.md` = 1
- [x] `grep -c "fallback)" commands/qgsd/quorum.md` = 6
- [x] `git log --oneline -1` shows `7d327fc feat(quick-103): ...`
