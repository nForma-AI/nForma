---
phase: quick-101
plan: 01
subsystem: quorum-agent-stack
tags: [quorum, agents, orchestrator, slot-worker, refactor, inline-synthesis]
dependency_graph:
  requires: []
  provides: [unified-slot-worker, 10-round-orchestrator, parallel-fallback-dispatch]
  affects: [agents/qgsd-quorum-orchestrator.md, agents/qgsd-quorum-slot-worker.md, commands/qgsd/quorum.md]
tech_stack:
  added: []
  patterns: [inline-synthesis, parallel-sibling-tasks, bash-only-worker, cross-pollination]
key_files:
  created: []
  modified:
    - agents/qgsd-quorum-slot-worker.md
    - agents/qgsd-quorum-orchestrator.md
    - agents/qgsd-quorum-worker.md
    - agents/qgsd-quorum-synthesizer.md
    - commands/qgsd/quorum.md
    - CLAUDE.md (disk-only — gitignored by design)
decisions:
  - "Orchestrator synthesizes inline — no separate synthesizer Task per round"
  - "Slot-worker uses Bash (cqs.cjs) only — no MCP tool lookup step"
  - "10-round cap replaces 2-round Barrier/Synthesizer structure"
  - "CLAUDE.md updated on disk but not committed (gitignored by design per project policy)"
metrics:
  duration: "5 min 13 sec"
  completed_date: "2026-02-25"
  tasks_completed: 3
  files_modified: 5
---

# Quick Task 101: Unified Quorum — New Slot-Worker Agent, Orchestrator 10-Round Parallel Loop, Inline Synthesis, Retire Old Workers

**One-liner:** Unified quorum stack — Bash-only slot-worker (no MCP juggling), orchestrator with 10-round parallel loop and inline synthesis (no separate synthesizer Task), parallel fallback dispatch in quorum.md, 10-round policy in CLAUDE.md.

## What Was Built

Rewrote the QGSD quorum agent stack across 6 files to eliminate latency and complexity from the old 2-round Barrier/Synthesizer architecture.

### agents/qgsd-quorum-slot-worker.md — Full rewrite

- `tools: "*"` changed to `tools: Read, Bash, Glob, Grep`
- Removed Step 4 (MCP tool lookup table) and Step 5 (MCP primary call + fallback)
- New Step 4: calls slot via Bash `node "$HOME/.claude/qgsd-bin/call-quorum-slot.cjs"` only — no MCP at all
- No fallback path: if Bash exits non-zero or output contains `TIMEOUT`, verdict = UNAVAIL
- Step 5 (renamed from 6): parse output and return structured result block — unchanged
- Noted that `description=` UI display is controlled by the orchestrator (not the worker)
- Kept all prompt construction logic (Mode A / Mode B, prior_positions, traces, artifact_path)

### agents/qgsd-quorum-orchestrator.md — Major rewrite

- Removed all `qgsd-quorum-synthesizer` Task spawns (was spawned after every round)
- Replaced "Round 1 → Barrier 1/Synthesizer → Round 2 → Barrier 2/Synthesizer → done" with a unified `$MAX_ROUNDS = 10` loop
- Orchestrator synthesizes results inline after each round (no Task overhead)
- Round banner displayed before each dispatch
- Cross-pollination bundle built after each non-consensus round and injected into next round's worker prompts
- Claude's position stated before first wave dispatch; included in cross-poll bundle from Round 2+
- Worker subagent_type: `qgsd-quorum-worker` → `qgsd-quorum-slot-worker`
- `description="<slotName> quorum R<$CURRENT_ROUND>"` on each Task creates the "Running N agents" parallel UI
- Mode A and Mode B use identical loop structure
- Escalation banner updated: "NO CONSENSUS AFTER 10 ROUNDS"
- Pre-step, Step 1, Step 2 (provider pre-flight, team identity, timeout resolution) preserved unchanged

### agents/qgsd-quorum-worker.md — Deprecation notice

Prepended `<!-- DEPRECATED: This agent is superseded by qgsd-quorum-slot-worker.md as of quick-101... -->` at the very top. File retained for reference.

### agents/qgsd-quorum-synthesizer.md — Deprecation notice

Prepended `<!-- DEPRECATED: This agent is superseded by inline synthesis in qgsd-quorum-orchestrator.md as of quick-101... -->` at the very top. File retained for reference.

### commands/qgsd/quorum.md — Fallback updates

- Removed `> **SEQUENTIAL CALLS ONLY — NO SIBLING TOOL CALLS**` warning block
- Replaced with: `> **Worker Task dispatch is PARALLEL per round.** Dispatch all slot workers for a given round as sibling Task calls in one message turn. Between rounds (Bash scoreboard calls, set-availability) remain sequential.`
- Mode B dispatch section header: "sequential — one at a time" → "parallel per round"
- Worker dispatch prose: "sequentially, one per message turn" → "parallel sibling calls in one message turn" with `description=` note
- Round cap: "max 4 total rounds" → "max 10 total rounds including Round 1"
- "After 4 total rounds with no consensus" → "After 10 total rounds with no consensus"
- Escalation banner: "NO CONSENSUS AFTER 4 ROUNDS" → "NO CONSENSUS AFTER 10 ROUNDS"

### CLAUDE.md — Policy updates (disk-only, gitignored by design)

- R3.3 table: "up to 4 rounds" → "up to 10 rounds total"
- R3.3 prose: "4 rounds exhausted" → "10 rounds exhausted"
- R3.4: "4 deliberation rounds complete without consensus" → "10 rounds complete without consensus"

## Decisions Made

1. **Orchestrator synthesizes inline, no synthesizer Task:** The old architecture spawned a separate `qgsd-quorum-synthesizer` Task after every round, adding latency, complexity, and an extra agent type to maintain. The orchestrator now performs the same synthesis logic directly in its reasoning — faster and simpler.

2. **Slot-worker is Bash-only (no MCP):** The old slot-worker had an MCP primary path with Bash fallback, requiring a tool lookup table and two-stage call logic. Since MCP tools are not available in sub-agent sessions anyway, the MCP path was dead code. The new worker calls `call-quorum-slot.cjs` via Bash directly.

3. **10-round cap (up from 2 rounds):** The old design capped at 2 rounds (Round 1 + 1 deliberation). The new 10-round cap aligns with CLAUDE.md R3.6 (iterative improvement up to 10 iterations) and gives more opportunities for genuine consensus before escalation.

4. **CLAUDE.md gitignored — not committed:** CLAUDE.md is intentionally gitignored by project design (`CLAUDE.md` in `.gitignore`). The policy changes were applied on disk only. This is correct per the project's "trust + audit" enforcement model — the policy file lives outside git history.

## Deviations from Plan

### Auto-noted: CLAUDE.md gitignored — no commit

- **Found during:** Task 3 commit
- **Issue:** PLAN.md frontmatter lists CLAUDE.md in `files_modified`, but CLAUDE.md is in `.gitignore` by project design (noted explicitly in the file header)
- **Action:** Applied CLAUDE.md changes on disk (R3.3 and R3.4 updated to 10 rounds). Did not force-commit. This matches the project's stated design intent.
- **Deviation type:** Scope adjustment (no-commit for gitignored file)

## Commits

| Task | Commit | Description |
|------|--------|-------------|
| 1 | 745f178 | feat(quick-101): rewrite slot-worker to Bash-only + deprecate old worker and synthesizer |
| 2 | 68f0e70 | feat(quick-101): rewrite orchestrator — 10-round parallel loop with inline synthesis |
| 3 | 849ea36 | feat(quick-101): update quorum.md fallback — parallel dispatch, 10-round cap |

## Self-Check: PASSED

All modified files present on disk. All 3 task commits verified in git log.

- agents/qgsd-quorum-slot-worker.md: FOUND
- agents/qgsd-quorum-orchestrator.md: FOUND
- agents/qgsd-quorum-worker.md: FOUND (with deprecation notice)
- agents/qgsd-quorum-synthesizer.md: FOUND (with deprecation notice)
- commands/qgsd/quorum.md: FOUND
- 745f178: FOUND
- 68f0e70: FOUND
- 849ea36: FOUND
