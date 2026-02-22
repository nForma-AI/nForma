# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-02-22 after Phase 28)

**Core value:** Planning decisions are multi-model verified by structural enforcement, not instruction-following — a Stop hook that reads the transcript makes it impossible for Claude to skip quorum.
**Current focus:** v0.4 MCP Ecosystem — COMPLETE (all 28 phases done)

## Current Position

Phase: Not started (defining requirements)
Plan: —
Status: Defining requirements for v0.5 MCP Setup Wizard
Last activity: 2026-02-22 — Milestone v0.5 MCP Setup Wizard started

Progress: [██████████████████████] 28/28 phases (100%)

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
| Phase 19 P02 | 4 | 2 tasks | 2 files |
| Phase 19 P01 | 5 | 3 tasks | 3 files |
| Phase 22 P01 | 5min | 5 tasks | 1 file |
| Phase 22 P02 | 2 | 4 tasks | 2 files |

## Accumulated Context

### Decisions

Decisions are logged in PROJECT.md Key Decisions table.
Recent decisions affecting current work:

- [v0.3 roadmap]: 5 phases (18–22): CLI Foundation → State Schema → Workflow Orchestrator → Categorization Engine → Integration Test
- [v0.3 scope]: User-facing command is `/qgsd:fix-tests` — single autonomous command (discover → batch → run → categorize → fix → loop). Internal gsd-tools sub-commands remain as maintain-tests discover/batch/run-batch.
- [v0.3 scope]: `/qgsd:fix-tests` is execution-only — NOT added to quorum_commands (INTG-03 / R2.1)
- [v0.3 scope]: Circuit breaker must be disabled at fix-tests start and re-enabled at end (INTG-01) — prevents false oscillation on iterative fix commits
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
- [Phase 19-02]: Edit source and installed resume-project.md copies independently (not via cp) — installed copy uses absolute paths, source uses tilde paths
- [Phase 19-02]: All 6 maintain_tests sub_activities carry (activity=maintain_tests) qualifier — prevents mis-routing when future activities reuse same sub_activity names (Pitfall 5)
- [Phase 19]: load-state returns null for missing file (not {}) — Phase 20 can distinguish fresh start from corrupted state
- [Phase 19]: require('node:sqlite') inside hasSqliteSupport() branch only — avoids ExperimentalWarning on Node < 22.5
- [Phase 19]: --batch-index is zero-based array subscript; out-of-bounds emits error containing 'out of range'
- [Phase 20]: Stub categorization marks all confirmed failures as real_bug — conservative placeholder; Phase 21 replaces with AI classification (CATG-01/02/03)
- [Phase 20]: consecutive_no_progress stored in state JSON (not workflow variable) so progress guard survives interruption and resumes correctly
- [Phase 20]: fix-tests is execution-only — must NOT appear in quorum_commands (INTG-03 / R2.1); verified by grep
- [Phase 21]: real-bug is conservative fallback category — when uncertain, classify as real-bug; never auto-actioned
- [Phase 21]: pickaxe enrichment is non-gating — commits=[] still dispatches as adapt; git absent → pickaxe_context=null but adapt still dispatched
- [Phase 21]: dispatched_task state saved BEFORE Task spawn — idempotent on resume; dedup check skips already-dispatched chunks
- [Phase 21]: Phase 20 stub detection in Step 6d — clears stale state when categorization_verdicts==[] AND results_by_category non-empty
- [22-01]: runInstall() helper uses cwd: tmpDir so --disable-breaker git fallback writes state to tmpDir/.claude/ (not real project root)
- [22-01]: TC-RESUME-2 uses 3-batch manifest with empty files arrays — exercises --batch-index 2 routing without needing real test runner
- [Phase 22]: 22-VERIFICATION.md written with evidence chains for all 14 v0.3 requirements — 135 tests passing, all verdicts PASSED, v0.3 milestone complete
- [Phase 22]: REQUIREMENTS.md: 7 requirements (CATG-01/02/03, ITER-01/02, INTG-01/03) marked Complete with Phase 22 as verifying phase
- [Phase 23]: 6 MCP repos unified: openhands renamed, dynamic versioning, MIT license, Makefile, CHANGELOG, npm scoping
- [Phase 24]: Gen1→Gen2 architecture port: per-tool *.tool.ts + registry.ts for claude/codex/copilot/openhands
- [Phase 25]: identity tool (5-field schema: name/version/model/available_models/install_method) + constants.ts + logger.ts (stderr-only via console.warn) in all 6 repos
- [Phase 26]: /qgsd:mcp-status reads identity tool on all 10 quorum agents + scoreboard UNAVAIL counts; health = available/quota-exceeded/error; claude-glm is 10th agent; NOT in quorum_commands (R2.1)
- [Phase 27]: model_preferences global-only (no per-project); agent name validated before identity call (no hang on typos); AGENT_TOOL_MAP in qgsd-prompt.js maps 10 agents to primary quorum tools
- [Phase 27]: /qgsd:mcp-set-model NOT in quorum_commands (R2.1); validates model via identity available_models (live truth); old model captured before write for confirmation
- [Phase 28]: install method from ~/.claude.json (not identity tool) — works offline; package name = args[args.length-1] for npx; repo dir = dirname(dirname(args[0])) for local node
- [Phase 28]: "all" mode deduplicates by repo dir — 6 claude-* agents share one binary, built once; others marked SKIPPED
- [Phase 28]: mcp-restart uses pkill -f; for npx: kills npm exec parent first then node child to prevent respawn
- [Phase 28]: /qgsd:mcp-update and /qgsd:mcp-restart NOT in quorum_commands (R2.1); identity verification sequential not sibling (R3.2)

### Pending Todos

- `2026-02-20-add-gsd-quorum-command-for-consensus-answers.md` — Add qgsd:quorum command for consensus answers (area: planning)
- Phase 22 post-validation: 5-category taxonomy may need refinement based on empirical categorization results on real suites

### Blockers/Concerns

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
| 47 | Add multi-provider fallback support to claude-mcp-server | 2026-02-22 | 5d30af5 | Verified | [47-add-multi-provider-fallback-support-to-c](./quick/47-add-multi-provider-fallback-support-to-c/) |
| 48 | it should have automatically proceed through the verification if it deemed it necessary and used our quorum-test mechanism to go through test testing tasks | 2026-02-22 | 14116e0 | Verified | [48-it-should-have-automatically-proceed-thr](./quick/48-it-should-have-automatically-proceed-thr/) |
| 49 | fix sibling tool call errors in quorum by making calls sequential | 2026-02-22 | 81f3d02 | Verified | [49-fix-sibling-tool-call-errors-in-quorum-b](./quick/49-fix-sibling-tool-call-errors-in-quorum-b/) |
| 50 | Fix claude-mcp-server health_check subprocess env passthrough | 2026-02-22 | 65b540d | Pending | [50-fix-claude-mcp-server-health-check-subpr](.planning/quick/50-fix-claude-mcp-server-health-check-subpr/) |
| 51 | Add keytar-based cross-platform secret management | 2026-02-22 | fe67e5d | Pending | [51-add-keytar-based-cross-platform-secret-m](.planning/quick/51-add-keytar-based-cross-platform-secret-m/) |

## Session Continuity

Last session: 2026-02-22
Stopped at: 2026-02-22 - Completed quick task 51: Add keytar-based cross-platform secret management
Resume file: None
