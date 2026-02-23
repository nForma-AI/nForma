# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-02-23 after v0.7 milestone)

**Core value:** Planning decisions are multi-model verified by structural enforcement, not instruction-following — a Stop hook that reads the transcript makes it impossible for Claude to skip quorum.
**Current focus:** v0.7 milestone archived — planning next milestone with `/qgsd:new-milestone`

## Current Position

Phase: MILESTONE COMPLETE — v0.7 archived
Plan: —
Status: v0.7 archived to .planning/milestones/; git tag v0.7 created; ready for /qgsd:new-milestone
Last activity: 2026-02-23 - Completed quick task 68: audit and update README and documentation to reflect all features shipped in v0.1-v0.7

Progress: [████████████████████] 46/46 plans (100%)

## Performance Metrics

**Velocity:**
- Total plans completed: 40+ (across v0.2–v0.5)
- Average duration: 3.5 min
- Total execution time: ~2.3 hours

**By Phase (recent):**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 26. MCP Status | 1 | ~5 min | 5 min |
| 27. Model Switching | 2 | ~8 min | 4 min |
| 28. Update & Restart | TBD | ~10 min | — |

**Recent Trend:**
- Last 5 plans: stable
- Trend: stable

*Updated after each plan completion*
| Phase 29 P01 | 2min | 2 tasks | 2 files |
| Phase v0.7-03 P02 | 4 | 3 tasks | 1 files |

## Accumulated Context

### Decisions

Decisions are logged in PROJECT.md Key Decisions table.
Recent decisions affecting current work:

- [v0.5 scope]: Wizard implemented as /qgsd:mcp-setup slash command using AskUserQuestion for interactivity
- [v0.5 scope]: ~/.claude.json is the config file for MCP servers (mcpServers section with env blocks)
- [v0.5 scope]: keytar (bin/secrets.cjs) is the secure secret store — already built in quick-51
- [v0.5 scope]: Reuse /qgsd:mcp-restart for agent restarts after wizard applies changes
- [v0.5 scope]: First-run = no mcpServers entries in ~/.claude.json; re-run = existing entries present
- [Phase quick-51]: keytar-based cross-platform secret management shipped; bin/secrets.cjs + bin/set-secret.cjs available
- [RLS-04 carry-forward]: npm publish qgsd@0.2.0 deferred — run when user decides to publish
- [Phase 29]: OBS-01–04 absent from REQUIREMENTS.md (v0.5 rewrite removed them) — added v0.4 Requirements (Complete) section with [x] entries rather than flip-from-[ ]
- [Phase 33]: Key value always passed via environment variable in node -e scripts (AGENT_NAME + API_KEY) — prevents shell history leaks; pattern established for Phase 34
- [Phase 33]: syncToClaudeJson called after per-agent ANTHROPIC_API_KEY patch — ensures all keytar secrets propagate to all env blocks as a second pass
- [Phase 34]: URL value passed via NEW_URL env var in provider swap scripts — same security pattern as Phase 33 KEY env var; applies to both curated and custom URL paths
- [Phase 35]: Add-agent CLAUDE_MCP_PATH resolved via 2-strategy fallback (read from existing entries, then npm root); identity ping after restart to confirm live connectivity (AGENT-03)
- [Phase 36]: hasClaudeMcpAgents() detection checks both known template names and args path for 'claude-mcp-server' substring; nudge only for Claude Code runtime; fail-open on read errors
- [v0.6 roadmap]: SCBD-01..03 assigned to Phase 40 — scoreboard slot tracking is part of composition data model
- [v0.6 roadmap]: MULTI-03 ("add slot via wizard") in Phase 41; wizard composition screen (Phase 42) depends on multi-slot support first
- [Phase 37]: `~/.claude/qgsd-bin/secrets.cjs` placeholder pattern confirmed; copyWithPathReplacement() substitutes at install time
- [Phase 37]: All 5 apply flows now call syncToClaudeJson — Option 2 was the only missing one
- [Phase 38]: SUMMARY.md requirements frontmatter is the canonical way to link plans to requirements; body sections are supplemental
- [Phase 39]: Slot naming scheme `<family>-<N>` decouples agent identity from provider/model — stable identifiers even as models change
- [Phase 39]: SLOT_MIGRATION_MAP in bin/migrate-to-slots.cjs — non-destructive (skip if newName present), idempotent, --dry-run supported
- [Phase 39]: Display name = slot name as-is (no prefix stripping); scoreboard --model from health_check response, not server name
- [Phase 39]: hasClaudeMcpAgents() regex updated to /^claude-\d+$/ for slot-based names; Install 39-01 adds --migrate-slots flag
- [quick-59]: Phase numbering redesigned to milestone-scoped IDs (v0.7-01 format); v0.7 phases renamed from 40/41/42; gsd-tools.cjs updated to parse both integer and milestone-scoped formats
- [Phase v0.7-01]: quorum_active uses shallow-merge semantics — project config entirely replaces global value (same pattern as required_models)
- [Phase v0.7-01]: Scoreboard composite key `<slot>:<model-id>` — same slot with different model = new row; historical rows preserved; fail-open on empty quorum_active (all slots participate)
- [Phase v0.7-01]: SLOT_TOOL_SUFFIX strips trailing -N digit index before family lookup — codex-cli-1 → codex-cli → review; claude-1 → claude → claude
- [Phase v0.7-01]: buildActiveSlots() reads ~/.claude.json mcpServer keys at install time; populateActiveSlots() in migrate-to-slots.cjs is idempotent
- [Phase v0.7-03]: WIZ-10 add-slot-from-composition routing: Plan 01 left content uncommitted; Plan 02 committed Return path markers + Add new slot handler + WIZ-08/09/10 in success_criteria
- [Phase v0.7-04]: orchestrator Mode A and quorum.md Mode A now use --slot + --model-id for claude-mcp servers; data.slots{} populated on all quorum paths; Mode B was already correct from v0.7-01 INT-04

### Pending Todos

- `2026-02-20-add-gsd-quorum-command-for-consensus-answers.md` — Add qgsd:quorum command for consensus answers (area: planning)
- Phase 22 post-validation: 5-category taxonomy may need refinement based on empirical categorization results on real suites

### Blockers/Concerns

- [Phase 12 carry-forward]: npm publish qgsd@0.2.0 deferred; run `npm publish --access public` when user decides
- [Phase 1 carry-forward]: Integration test: `stop_hook_active` behavior on second Stop invocations with GSD subagents must be empirically confirmed against live Claude Code runtime

### Quick Tasks Completed

| # | Description | Date | Commit | Status | Directory |
|---|-------------|------|--------|--------|-----------|
| 52 | is it clean ? | 2026-02-22 | a7e4c9f | Complete | [52-is-it-clean](./quick/52-is-it-clean/) |
| 53 | we need full unit test coverage | 2026-02-22 | 76b24b5 | Verified | [53-we-need-full-unit-test-coverage](./quick/53-we-need-full-unit-test-coverage/) |
| 54 | add unit tests for remaining untested modules | 2026-02-22 | 98d8c62 | Verified | [54-add-unit-tests-for-remaining-untested-mo](./quick/54-add-unit-tests-for-remaining-untested-mo/) |
| 55 | in qgsd:fix-tests, we could use ddmin instead of batch to isolate tests that causes instabilities in other, and that would guide our isolation strategies! | 2026-02-23 | ab17b01 | Verified | [55-in-qgsd-fix-tests-we-could-use-ddmin-ins](./quick/55-in-qgsd-fix-tests-we-could-use-ddmin-ins/) |
| 56 | softer circuit breaker with LLM false-negative detection and auto-continue | 2026-02-23 | 70175b7 | Verified | [56-softer-circuit-breaker-with-llm-false-ne](./quick/56-softer-circuit-breaker-with-llm-false-ne/) |
| 57 | Fix GSD branding to QGSD in install.js statusline prompt and completion banners | 2026-02-23 | 74dc5f3 | Complete | [57-fix-gsd-branding-to-qgsd-in-install-js-s](./quick/57-fix-gsd-branding-to-qgsd-in-install-js-s/) |
| 58 | in fix-tests.md step 6h dispatch template, when ddmin_ran is true but polluter_set is empty, make it crystal clear to the fixer agent that ddmin exhaustively searched and ruled out test pollution — show run count, candidate count, and explicitly redirect the agent away from shared-state investigation toward timing/async/io causes | 2026-02-23 | 0f9a0c7 | Pending | [58-in-fix-tests-md-step-6h-dispatch-templat](./quick/58-in-fix-tests-md-step-6h-dispatch-templat/) |
| 59 | phase numbering scheme redesign to avoid milestone collision | 2026-02-23 | 4b370c0 | Verified | [59-phase-numbering-scheme-redesign-to-avoid](./quick/59-phase-numbering-scheme-redesign-to-avoid/) |
| 60 | in fix-tests.md: (1) remove Steps 2 and 7 (circuit breaker disable/enable) entirely; (2) make fresh run the default, gate resume behind --resume flag | 2026-02-23 | 65808c6 | Pending | [60-in-fix-tests-md-1-remove-steps-2-and-7-c](./quick/60-in-fix-tests-md-1-remove-steps-2-and-7-c/) |
| 61 | in fix-tests.md: real-bug quorum investigation + dispatch (same pattern as adapt/fixture) + install sync | 2026-02-23 | 440d6ed | Pending | [61-in-fix-tests-md-when-tests-are-classifie](./quick/61-in-fix-tests-md-when-tests-are-classifie/) |
| 62 | resume-work should also look at quick tasks and incomplete qgsd:debug sessions | 2026-02-23 | 15ab74f | Verified | [62-resume-work-should-also-look-at-quick-ta](.planning/quick/62-resume-work-should-also-look-at-quick-ta/) |
| 63 | fix v0.7-03 gaps: run install sync and mark WIZ-08/09 complete in REQUIREMENTS.md | 2026-02-23 | 351e42f | Verified | [63-fix-v0-7-03-gaps-run-install-sync-and-ma](./quick/63-fix-v0-7-03-gaps-run-install-sync-and-ma/) |
| 64 | fix SCBD-01/02/03: propagate INT-04 --slot/--model-id fix from quorum.md Mode B to qgsd-quorum-orchestrator.md Mode A scoreboard block | 2026-02-23 | 8de229c | Verified | [64-fix-scbd-01-02-03-propagate-int-04-slot-](./quick/64-fix-scbd-01-02-03-propagate-int-04-slot-/) |
| 65 | fix pytest discover in maintain-tests: add --override-ini=addopts= flag and fallback parsing for <Module> tree format | 2026-02-23 | bd73e44 | Verified | [65-fix-pytest-discover-in-maintain-tests-ad](./quick/65-fix-pytest-discover-in-maintain-tests-ad/) |
| 67 | harden all quorum calls against hangs — add per-model timeout wrapper so hung models are skipped with UNAVAIL status | 2026-02-23 | fccf683 | Verified | [67-harden-all-quorum-calls-against-hangs-ad](./quick/67-harden-all-quorum-calls-against-hangs-ad/) |
| 68 | audit and update README and documentation to reflect all features shipped in v0.1-v0.7 | 2026-02-23 | fe2c3cd | Verified | [68-audit-and-update-readme-and-documentatio](./quick/68-audit-and-update-readme-and-documentatio/) |

## Session Continuity

Last session: 2026-02-23
Stopped at: 2026-02-23 - Completed quick task 68: audit and update README and documentation to reflect all features shipped in v0.1-v0.7
Resume file: None
