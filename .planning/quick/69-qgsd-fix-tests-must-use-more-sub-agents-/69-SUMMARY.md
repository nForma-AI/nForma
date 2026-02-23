---
phase: quick-69
plan: "01"
subsystem: workflows
tags: [fix-tests, sub-agents, context-management, refactor]
dependency_graph:
  requires: []
  provides: [fix-tests-sub-agent-categorization, fix-tests-sub-agent-investigation]
  affects: [fix-tests-workflow]
tech_stack:
  added: []
  patterns: [Task-delegation, sub-agent-orchestration, JSON-return-protocol]
key_files:
  created: []
  modified:
    - get-shit-done/workflows/fix-tests.md
decisions:
  - "Categorization sub-agent receives full batch of unclassified failures and returns a JSON verdict array; malformed JSON triggers deferred fallback for entire batch"
  - "Investigation sub-agent handles file reads, Claude hypothesis, sequential quorum calls, and consensus synthesis; top-level receives only JSON with consensus_hypothesis field"
  - "Steps E and F (state append + /qgsd:quick fix dispatch) remain inline in top-level orchestrator — these are state management, not file reads or AI reasoning"
metrics:
  duration: "8 min"
  completed: "2026-02-23"
  tasks_completed: 3
  files_modified: 1
---

# Quick Task 69: fix-tests must use more sub-agents Summary

**One-liner:** Refactored fix-tests.md Steps 6d and 6h.1 to delegate all file reads and AI reasoning to Task sub-agents, preserving top-level context budget for orchestration only.

## What Was Done

The top-level fix-tests orchestrator was accumulating massive context from inline file reads and AI reasoning across every batch in every iteration. For large test suites this exhausted context long before the loop completed.

Two sections were rewritten:

### Task 1: Step 6d — Batch Categorization Sub-Agent

**Before:** Step 6d read every test file and source file inline, performed 5-category AI classification inline, ran git pickaxe inline — all in the top-level agent's context window.

**After:** Step 6d collects unclassified confirmed_failures, spawns a SINGLE Task sub-agent for the entire batch, and waits for a JSON verdict array in return. The sub-agent handles:
- Reading test files and source files
- Computing context_score
- 5-category classification
- Git pickaxe enrichment for adapt verdicts

The top-level agent only: checks the resume-safety dedup, dispatches one Task call, parses the returned JSON array, and saves state. Malformed JSON or Task errors trigger a safe fallback (all failures deferred) without blocking the loop.

### Task 2: Step 6h.1 — Real-Bug Investigation Sub-Agent

**Before:** Step 6h.1 re-read the test file inline (Steps A-D), assembled an investigation bundle, produced a Claude hypothesis, called quorum models sequentially, and synthesized a consensus — all in the top-level context.

**After:** Step 6h.1 spawns a Task sub-agent per real-bug verdict. The sub-agent handles:
- Reading the test file
- Assembling the investigation bundle
- Producing the Claude hypothesis (Round 1)
- Calling quorum models sequentially (codex-cli, gemini-cli, opencode, copilot, claude-mcp)
- Synthesizing the consensus hypothesis

The sub-agent returns `{ consensus_hypothesis, model_count, confidence }`. The top-level agent extracts `consensus_hypothesis` and proceeds to Steps E and F (state append + fix task dispatch) — unchanged, inline.

Both investigation Task and fix dispatch Task are sequential — WAIT instructions preserved.

### Task 3: Install Sync

Ran `node bin/install.js --claude --global` to push the updated source to `~/.claude/qgsd/`. Verified `grep -c "Task(" ~/.claude/qgsd/workflows/fix-tests.md` returns 4.

## Verification Results

1. `grep -n "Context assembly for each confirmed failure"` → nothing (PASS)
2. `grep -n "Step A — Assemble investigation context"` → nothing (PASS)
3. `grep -n "Task(" get-shit-done/workflows/fix-tests.md` → lines 130, 400, 443, 574 (PASS — 4 Task calls)
4. `node bin/install.js --claude --global` → exit 0 (PASS)
5. `grep -c "Task(" ~/.claude/qgsd/workflows/fix-tests.md` → 4 (PASS, >= 4)

## Commits

- `31c152c` — refactor(quick-69): delegate Step 6d batch categorization to Task sub-agent
- `87612c0` — refactor(quick-69): delegate Step 6h.1 real-bug investigation to Task sub-agent

## Deviations from Plan

None — plan executed exactly as written.

## Self-Check: PASSED

- `get-shit-done/workflows/fix-tests.md` modified and committed
- `~/.claude/qgsd/workflows/fix-tests.md` synchronized
- Commits 31c152c and 87612c0 exist
- All inline sections removed, all Task() delegation patterns in place
