---
phase: quick-100
plan: 01
subsystem: quorum-orchestrator
tags: [quorum, timeout, availability, R6, fail-open]
dependency_graph:
  requires: []
  provides: [global-wall-clock-timeout-quorum]
  affects: [~/.claude/agents/qgsd-quorum-orchestrator.md, ~/.claude/qgsd.json]
tech_stack:
  added: []
  patterns: [wall-clock-timeout, fail-open-R6]
key_files:
  created: []
  modified:
    - /Users/jonathanborduas/.claude/agents/qgsd-quorum-orchestrator.md
    - /Users/jonathanborduas/.claude/qgsd.json
decisions:
  - "global_timeout_ms defaults to 600000ms (10 min) — covers realistic worst-case all-model-unavailable scenario without blocking the session indefinitely"
  - "Reduced-quorum timeout output template defined once (before Mode A Round 1) and referenced by name at all four check points — avoids duplication"
  - "Scoreboard note in timeout output block: instructs orchestrator to call update-scoreboard.cjs with UNAVAIL for all timed-out slots (quorum improvement accepted at planning)"
metrics:
  duration: 92s
  completed: 2026-02-24
  tasks_completed: 2
  files_modified: 2
---

# Quick Task 100: Add global wall-clock timeout to quorum orchestrator — Summary

**One-liner:** Configurable 10-minute wall-clock timeout (global_timeout_ms) added to quorum orchestrator Pre-step and all four wave dispatch checkpoints, failing open per R6 when limit is reached.

## What Was Built

The quorum orchestrator previously had no upper bound on total runtime. When all external models were unavailable, it could hang indefinitely (3+ hours observed). This task adds a configurable wall-clock ceiling that causes the orchestrator to fail-open gracefully per R6 policy rather than blocking Claude's session.

### Changes Made

**`~/.claude/qgsd.json`**
- Added `"global_timeout_ms": 600000` after `circuit_breaker` block
- This is the single source of truth for the timeout ceiling; project-level `qgsd.json` can override it

**`~/.claude/agents/qgsd-quorum-orchestrator.md`**
- **Pre-step (Location A):** Added wall-clock start time capture using the same global+project config merge pattern already used elsewhere in the orchestrator. Reads `global_timeout_ms` (default 600000) and stores `$GLOBAL_TIMEOUT = { start, timeout_ms }`
- **Mode A Round 1 (Location B):** Timeout check before dispatching workers + reduced-quorum timeout output block (defined once here, referenced at all other check points). Also includes scoreboard update instruction per accepted quorum improvement
- **Mode A Round 2 (Location C):** Timeout check before dispatching deliberation wave
- **Mode B Round 1 (Location D1):** Timeout check before dispatching Mode B workers
- **Mode B Round 2 (Location D2):** Timeout check before dispatching Mode B deliberation wave

All four check points use the same `Date.now() - $GLOBAL_TIMEOUT.start` elapsed comparison. If `elapsed >= timeout_ms`: emit REDUCED-QUORUM TIMEOUT output and return. Otherwise log remaining time and proceed.

## Verification Results

1. `node -e "const f=require('/Users/jonathanborduas/.claude/qgsd.json'); console.log(f.global_timeout_ms)"` → `600000`
2. Grep count of timeout-related terms in orchestrator → 22 occurrences (well above the minimum 6)
3. All original orchestrator sections intact — `Step 1`, `Step 2`, `Mode A`, `Mode B`, `Consensus output`, `Escalate` all present (31 matches)
4. Timeout output block references R6 explicitly in two places (header and body)

## Deviations from Plan

None — plan executed exactly as written. The quorum-accepted improvement (scoreboard update instruction in timeout block) was included per the constraint spec.

## Self-Check

- [x] `/Users/jonathanborduas/.claude/qgsd.json` — modified, `global_timeout_ms: 600000` present
- [x] `/Users/jonathanborduas/.claude/agents/qgsd-quorum-orchestrator.md` — modified, 5 timeout blocks present (1 start + 4 check points)
- [x] All original orchestrator content intact (no deletions)
- [x] R6 cited in timeout output block

## Self-Check: PASSED
