# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-02-22 after Phase 18)

**Core value:** Planning decisions are multi-model verified by structural enforcement, not instruction-following — a Stop hook that reads the transcript makes it impossible for Claude to skip quorum.
**Current focus:** v0.3 — Milestone complete, ready to archive

## Current Position

Phase: 18 of 22 (CLI Foundation)
Plan: 4 of 4 in current phase
Status: Complete — 18-04 done (integration + edge-case tests for all maintain-tests sub-commands)
Last activity: 2026-02-22 - Completed quick task 46: Review all quorum invocation sites and reduce verbosity of banners and step labels

Progress: [████████████████████] 4/4 plans (100%)

## Performance Metrics

**Velocity:**
- Total plans completed: 40 (v0.2)
- Average duration: 3.5 min
- Total execution time: ~2.3 hours

**By Phase (v0.2 sample):**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 01-hook-enforcement | 6 | 13 min | 2.2 min |
| 02-config-mcp-detection | 4 | 38 min | 9.5 min |
| 14-activity-tracking | 4 | 8 min | 2.0 min |

**Recent Trend:**
- Last 5 plans: 2 min, 2 min, 3 min, 2 min, 1 min
- Trend: stable

*Updated after each plan completion*
| Phase quick-45 P01 | 334 | 2 tasks | 2 files |
| Phase 18 P03 | 15min | 3 tasks | 2 files |
| Phase 18 P04 | 12min | 3 tasks | 1 files |

## Accumulated Context

### Decisions

Decisions are logged in PROJECT.md Key Decisions table.
Recent decisions affecting current work:

- [v0.3 roadmap]: 5 phases (18–22): CLI Foundation → State Schema → Workflow Orchestrator → Categorization Engine → Integration Test
- [v0.3 scope]: `/qgsd:maintain-tests` is execution-only — NOT added to quorum_commands (INTG-03 / R2.1)
- [v0.3 scope]: Circuit breaker must be disabled at maintain-tests start and re-enabled at end (INTG-01) — prevents false oscillation on iterative fix commits
- [v0.3 arch]: gsd-tools.cjs owns all mechanical ops (discover/batch/run-batch/save-state/load-state); workflow orchestrator owns reasoning (categorization, action dispatch, loop control)
- [v0.3 arch]: node:sqlite for state on Node >= 22.5.0; JSON flat file fallback for older Node — state schema defined before workflow is written
- [v0.3 arch]: Failing tests run 3 times before categorization — flakiness pre-check gates AI categorization queue (EXEC-04)
- [v0.3 arch]: Fixes dispatched as grouped /qgsd:quick tasks (by category + error type + directory; cap 20 tests/task) — never one task per failing test
- [v0.3 arch]: Always use framework CLIs for discovery (never independent globs) — prevents monorepo cross-discovery collision (DISC-02)
- [RLS-04 carry-forward]: npm publish qgsd@0.2.0 deferred — user decision; run when ready
- [quick-40]: Research always runs on /qgsd:plan-phase; has_research shortcut removed from plan-phase.md Step 5
- [18-02]: Mulberry32 PRNG implemented inline (no external dep) for deterministic test batch shuffling
- [18-02]: Batch manifest written to disk BEFORE returning when --manifest-file provided — enables crashed-run resume
- [18-02]: Batch manifest schema: seed, batch_size, total_files, total_batches, batches[].{batch_id, files, file_count}
- [Phase quick-45]: Use total net change (additions - deletions) across consecutive oscillating commit pairs to distinguish TDD growth (positive) from true oscillation (zero/negative)
- [Phase 18-01]: Use spawnSync (not execSync) for all CLI invocations in cmdMaintainTestsDiscover — eliminates shell injection risk
- [Phase 18]: Use spawn (not spawnSync) for test runner invocation — prevents maxBuffer crash on large jest JSON output; each file run individually for result isolation
- [18-04]: Test parsePytestCollectOutput via Option A (replicate parser inline in test describe block) rather than mock scripts — isolates parsing logic from CLI invocation
- [18-04]: Test deduplication invariant via Set.size == array.length rather than mock CLI injection — works without jest/playwright/pytest installed

### Pending Todos

- `2026-02-20-add-gsd-quorum-command-for-consensus-answers.md` — Add qgsd:quorum command for consensus answers (area: planning)
- Phase 22 post-validation: 5-category taxonomy may need refinement based on empirical categorization results on real suites

### Blockers/Concerns

- [Phase 21 research flag]: Quorum worker classification prompts for 5+1 category test failure categorization are novel — research-phase recommended before plan-phase for Phase 21
- [Phase 12 carry-forward]: npm publish qgsd@0.2.0 deferred; run `npm publish --access public` when user decides to publish
- [Phase 1 carry-forward] Integration test: `stop_hook_active` behavior on second Stop invocations with GSD subagents must be empirically confirmed against live Claude Code runtime

### Quick Tasks Completed

| # | Description | Date | Commit | Status | Directory |
|---|-------------|------|--------|--------|-----------|
| 41 | make qgsd:quorum use quorum automatically for follow-up questions | 2026-02-22 | 4a24f0a | Verified | [41-make-qgsd-quorum-use-quorum-automaticall](./quick/41-make-qgsd-quorum-use-quorum-automaticall/) |
| 45 | fix circuit breaker false positive for TDD patterns (diff-based reversion detection) | 2026-02-22 | 7eedb28 | Verified | [45-fix-circuit-breaker-false-positive-repla](./quick/45-fix-circuit-breaker-false-positive-repla/) |
| 42 | adapt claude-mcp-server fork: replace Codex CLI with Claude CLI end-to-end | 2026-02-22 | 4c05844 | Verified | [42-adapt-claude-mcp-server-fork-replace-cod](./quick/42-adapt-claude-mcp-server-fork-replace-cod/) |
| 43 | we need to review the qgsd quick command | 2026-02-22 | 22a15de | Verified | [43-we-need-to-review-the-qgsd-quick-command](./quick/43-we-need-to-review-the-qgsd-quick-command/) |
| 44 | enable /qgsd:execute-phase N --auto to chain through all milestone phases | 2026-02-22 | a0400d9 | Verified | [44-if-somebody-run-the-qgsd-execute-phase-n](./quick/44-if-somebody-run-the-qgsd-execute-phase-n/) |
| 46 | Review all quorum invocation sites and reduce verbosity of banners and step labels | 2026-02-22 | e2675c4 | Pending | [46-review-all-quorum-invocation-sites-and-r](./quick/46-review-all-quorum-invocation-sites-and-r/) |

## Session Continuity

Last session: 2026-02-22
Stopped at: Phase 18 complete, v0.3 milestone all phases done — ready for /qgsd:complete-milestone
Resume file: None
