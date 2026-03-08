# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-03-08)

**Core value:** Planning decisions are multi-model verified by structural enforcement, not instruction-following
**Current focus:** Milestone v0.31 complete -- all 3 phases finished

## Current Position

Phase: 3 of 3 (Config & Governance DX)
Plan: 2 of 2 in current phase
Status: Phase v0.31-03 complete -- milestone v0.31 complete
Last activity: 2026-03-08 - Completed quick task 225: Centralize PRISM invocation in run-formal-check.cjs via delegation to run-prism.cjs

Progress: [##########] 100%

## Performance Metrics

**Velocity:**
- Total plans completed: 7 (v0.31)
- Average duration: 12min
- Total execution time: 1.4 hours

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| v0.31-01 | 2/2 | 38min | 19min |
| v0.31-02 | 3/3 | 21min | 7min |
| v0.31-03 | 2/2 | 7min | 3.5min |

**Recent Trend:**
- Last 5 plans: (from v0.30) 3min, 4min, 4min, 5min, 4min
- Trend: Stable

*Updated after each plan completion*
| Phase v0.30-07 P01 | 5min | 2 tasks | 5 files |
| Phase v0.31-02 P02 | 7min | 2 tasks | 4 files |
| Phase v0.31-02 P03 | 4min | 2 tasks | 6 files |
| Phase v0.30-07 P02 | 3min | 2 tasks | 3 files |

## Accumulated Context

### Decisions

Decisions logged in PROJECT.md Key Decisions table.
Recent decisions affecting current work:

- [v0.31-01-01]: Statusline uses 'Notification' as default event type (fail-open for non-standard events)
- [v0.31-01-01]: nf-check-update gets stdin reader with validation for uniform coverage
- [v0.31-01-01]: Validation errors produce stderr warnings then fail-open exit(0)
- [v0.31-01-02]: Priority values follow ruflo HookPriority enum: Critical=1000, Normal=50, Low=10
- [v0.31-01-02]: Sorting placed in finishInstall before writeSettings for single code path
- [v0.31-01-02]: Inline fallback priorities in install.js for bootstrap when config-loader unavailable
- [Roadmap]: 3-phase structure -- hook hardening first (foundation), then runtime safety boundaries, then DX improvements
- [v0.31-02-01]: Evidence file uses schema_version:1 envelope with signatures array for forward compatibility
- [v0.31-02-01]: Preemptive check emits stderr warning only, never blocks tool calls (warn-only)
- [v0.31-02-01]: Evidence cap at 50 entries sorted by last_seen descending, pruned on read
- [v0.31-02-02]: latency_budget_ms takes priority over --timeout and quorum_timeout_ms when present
- [v0.31-02-02]: latency_budget_ms=0 or negative treated as not set (backward compatible)
- [v0.31-02-03]: ccr slots get structural --allowedTools restriction via CLI flag forwarding
- [v0.31-02-03]: Non-ccr slots get prompt-level READ-ONLY restriction (best-effort)
- [v0.31-02-03]: Review mode triggered by Mode B dispatch OR explicit --review-only flag
- [v0.31-02-03]: Verification commands (/nf:verify-work, /nf:check) inject REVIEW MODE instruction
- [v0.31-03-01]: Used Claude Code native paths: frontmatter for rule scoping
- [v0.31-03-01]: Debate formatter uses regex-based YAML parsing (no external deps)
- [v0.31-03-02]: NESTED_TO_FLAT_MAP covers model_tier, smart_compact key conversions
- [v0.31-03-02]: Flat keys take precedence over nested when both present
- [Phase v0.30-07]: CONFLICT detection checks stdout+stderr+message (git outputs CONFLICT to stdout)
- [Phase v0.30-07]: Worktree executors skip state_updates/final_commit -- orchestrator handles after merge
- [Phase v0.30-07]: Executor completion uses structured JSON block for reliable orchestrator parsing
- [Phase v0.30-07]: Pattern D is opt-in via --parallel flag; existing A/B/C unchanged
- [Phase v0.30-07]: SERIAL_FILES expanded: .gitignore, config files, settings.json prevent parallel execution

### Pending Todos

None yet.

### Blockers/Concerns

- v0.30-07 (Worktree Parallelization) was not completed in v0.30 -- deferred requirements PARA-01, PARA-02 listed in v0.32+ consideration
- additionalContext token budget contention remains from v0.30 (multiple injection sources share ~4000 token ceiling)

### Quick Tasks Completed

| # | Description | Date | Commit | Status | Directory |
|---|-------------|------|--------|--------|-----------|
| 222 | use those insights to recommend improvements to nforma | 2026-03-08 | 3d644a39 | Verified | [222-use-those-insights-to-recommend-improvem](./quick/222-use-those-insights-to-recommend-improvem/) |
| 225 | Centralize PRISM invocation in run-formal-check.cjs via delegation to run-prism.cjs | 2026-03-08 | 941af210 | Verified | [225-centralize-prism-invocation-in-run-forma](./quick/225-centralize-prism-invocation-in-run-forma/) |

## Session Continuity

Last session: 2026-03-08
Stopped at: Milestone v0.31 complete -- all 3 phases finished, ready for /nf:audit-milestone v0.31
Resume file: None
