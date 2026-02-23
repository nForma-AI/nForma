---
phase: quick-90
plan: "01"
subsystem: quorum
tags: [bug-fix, quorum, provider-health, orchestrator, preferSub]
dependency_graph:
  requires: []
  provides: [HTTP provider health check working, preferSub slot ordering]
  affects: [bin/check-provider-health.cjs, agents/qgsd-quorum-orchestrator.md]
tech_stack:
  added: []
  patterns: [ANTHROPIC_BASE_URL as HTTP slot discriminator, preferSub partition-then-sort ordering]
key_files:
  modified:
    - bin/check-provider-health.cjs
    - agents/qgsd-quorum-orchestrator.md
decisions:
  - "HTTP slots identified by ANTHROPIC_BASE_URL presence, not binary args path — args filter was blocking unified-mcp-server.mjs slots"
  - "preferSub ordering partitions first (sub before api), then applies healthy/unhealthy reorder within each partition"
metrics:
  duration: "3 min"
  completed: "2026-02-23"
  tasks_completed: 2
  files_modified: 2
---

# Phase quick-90 Plan 01: Fix Two Quorum Bugs Summary

**One-liner:** Removed args-based claude-mcp-server filter from check-provider-health.cjs (unified-mcp-server.mjs slots now detected via ANTHROPIC_BASE_URL) and added explicit preferSub partition ordering to orchestrator Step 1 pre-flight.

## What Was Done

### Task 1 — Fix check-provider-health.cjs binary name filter (commit: f7579a9)

**Problem:** Line 134 filtered MCP servers by checking `cfg.args` for the string `claude-mcp-server`. All HTTP slots (claude-1..claude-6) now use `unified-mcp-server.mjs` as their binary, so this filter excluded all of them. The result: `$CLAUDE_MCP_SERVERS` was always empty and `node bin/check-provider-health.cjs` would immediately print "No claude-mcp-server instances with ANTHROPIC_BASE_URL found." and exit.

**Fix:** Removed the args filter entirely. The `!baseUrl` guard on the line below is the correct HTTP discriminator — subprocess slots (codex-1, gemini-1, etc.) have no `ANTHROPIC_BASE_URL` and are excluded by that guard. The args check was redundant and wrong.

**Verified:** `node bin/check-provider-health.cjs --json` now returns 3 provider entries covering claude-1 through claude-6 across akashml, together.xyz, and fireworks.

### Task 2 — Add preferSub ordering to orchestrator Step 1 (commit: e045011)

**Problem:** Orchestrator Step 1 pre-flight had a single reorder step ("healthy servers first") with no awareness of `quorum.preferSub`. When `preferSub=true` in qgsd.json, subscription CLI slots (codex-1, gemini-1, opencode-1, copilot-1) should be dispatched before API (HTTP) slots regardless of discovery order.

**Fix:** Added a bash snippet in Step 1 that reads `quorum.preferSub` and `agent_config` from qgsd.json (project config takes precedence over global). Replaced the single reorder bullet with a two-phase ordering:
1. **preferSub partition:** If `preferSub=true`, sort working slot list by `auth_type` — `sub` slots first, `api` slots second (stable sort, original order preserved within each group).
2. **Reorder:** Within each partition (sub group and api group separately), healthy servers before unhealthy.

Final order when `preferSub=true`: healthy-sub → unhealthy-sub → healthy-api → unhealthy-api.

**Verified:** `grep -n 'preferSub' agents/qgsd-quorum-orchestrator.md` returns 6 matches. Mode A call order list and Mode B sections are unmodified.

## Deviations from Plan

None — plan executed exactly as written.

## Verification Results

1. `node bin/check-provider-health.cjs --json` returns 3 provider entries (akashml, together.xyz, fireworks) covering claude-1..claude-6. The "No instances found" message does not appear.
2. `grep -n 'preferSub' agents/qgsd-quorum-orchestrator.md` returns 6 matches (exceeds required 3).
3. The faulty `args`-based filter is gone. The two remaining `claude-mcp-server` references are an innocuous file header comment and the fallback empty-state message.

## Self-Check: PASSED

- [x] `bin/check-provider-health.cjs` modified — filter removed
- [x] `agents/qgsd-quorum-orchestrator.md` modified — preferSub ordering added
- [x] Commit f7579a9 exists (Task 1)
- [x] Commit e045011 exists (Task 2)
