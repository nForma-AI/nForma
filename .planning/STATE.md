# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-02-20 after Phase 2)

**Core value:** Planning decisions are multi-model verified by structural enforcement, not instruction-following — a Stop hook that reads the transcript makes it impossible for Claude to skip quorum.
**Current focus:** Phase 3 — Installer & Distribution (next up)

## Current Position

Phase: 2 of 3 (Config & MCP Detection) — COMPLETE
Plan: 4/4 complete
Status: Phase 2 complete — shared config-loader, fail-open detection, MCP auto-detection, template docs shipped
Last activity: 2026-02-20 — Phase 2 complete (4/4 plans, 11/11 requirements verified, human checkpoint approved)

Progress: [████████████████████] 67% (2/3 phases complete)

## Performance Metrics

**Velocity:**
- Total plans completed: 4
- Average duration: 2.5 min
- Total execution time: 0.17 hours

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 01-hook-enforcement | 4 | 10 min | 2.5 min |
| 02-config-mcp-detection | 4 | 38 min | 9.5 min |

**Recent Trend:**
- Last 5 plans: 5 min, 2 min, 2 min, 1 min, 12 min, 8 min, 10 min, 8 min
- Trend: stable (Phase 2 plans longer due to TDD + migration scope)

*Updated after each plan completion*

| Plan | Duration | Tasks | Files |
|------|----------|-------|-------|
| Phase 01-hook-enforcement P01 | 5 min | 3 tasks | 3 files |
| Phase 01-hook-enforcement P02 | 2 min | 1 task | 1 file |
| Phase 01-hook-enforcement P03 | 2 min | 2 tasks | 2 files |
| Phase 01-hook-enforcement P04 | 1 min | 2 tasks | 2 files |
| Phase 01-hook-enforcement P05 | 1 min | 2 tasks | 0 files |
| Phase 02-config-mcp-detection P01 | 12 min | 2 tasks | 4 files |
| Phase 02-config-mcp-detection P02 | 10 min | 1 task | 2 files |
| Phase 02-config-mcp-detection P03 | 8 min | 1 task | 1 file |
| Phase 02-config-mcp-detection P04 | 8 min | 3 tasks | 2 files |

## Accumulated Context

### Decisions

Decisions are logged in PROJECT.md Key Decisions table.
Recent decisions affecting current work:

- Architecture: UserPromptSubmit injection + Stop hook gate (three-model quorum consensus: Claude + Codex + OpenCode)
- Hook installation: Write to ~/.claude/settings.json directly — never via plugin hooks.json (confirmed Claude Code bug #10225 silently discards plugin UserPromptSubmit output)
- Fail-open: When a model is unavailable, proceed with available models and note reduced quorum (matches CLAUDE.md R6)
- Global install only: No per-project install in v1 — matches GSD's behavior
- [Phase 01-hook-enforcement]: Config file named qgsd.json for stop hook; matches PLAN.md artifact spec; Phase 2 CONF-01 may rename
- [Phase 01-hook-enforcement]: buildCommandPattern() extracted in REFACTOR to build quorum command regex once and reuse across hasQuorumCommand and extractCommand
- [Phase 01-hook-enforcement P02]: UserPromptSubmit hook uses ~/.claude/qgsd.json (same file as stop hook); loadConfig() returns null on missing/malformed so caller controls fallback
- [Phase 01-hook-enforcement P02]: Anchored regex ^\\s*\\/gsd:(cmd)(\\s|$) with mandatory /gsd: prefix matches stop hook pattern exactly — no optional (gsd:)? group
- META behavior (META-01/02/03): discuss-phase question auto-resolution is satisfied structurally — /gsd:discuss-phase is in the QGSD hook allowlist, so quorum runs before output delivery. Only questions without consensus are escalated to the user; auto-resolved questions are presented as assumptions first. This is enforced by hooks, not by behavioral instruction.
- [Phase 01-hook-enforcement]: Build wiring: qgsd-prompt.js and qgsd-stop.js added to HOOKS_TO_COPY in build-hooks.js; installer registers both in settings.json with idempotency guards
- [Phase 01-hook-enforcement]: Task 1 produces no git commit because installation targets ~/.claude/ outside repo and hooks/dist/ is gitignored; wiring committed in Plan 04
- [Phase 01-hook-enforcement gap closure]: STOP-05 fast-path omitted by design — last_assistant_message substring matching is not a reliable signal (Claude could summarize results in prose without naming tool prefixes); transcript JSONL is the authoritative and sole source of quorum evidence. Requirement revised to match implementation. (quorum consensus: Claude + Codex + Gemini; OpenCode unavailable)
- [Phase 02-config-mcp-detection P01]: Shallow merge chosen for config layering — project `required_models` fully replaces global; no deep merge. This is intentional: a project that needs only one model should be able to declare that without merging global model list.
- [Phase 02-config-mcp-detection P01]: TC1 in config-loader.test.js adjusted — cannot assert deepEqual to DEFAULT_CONFIG when real ~/.claude/qgsd.json exists on test machine; asserts valid config shape instead
- [Phase 02-config-mcp-detection P02]: QGSD_CLAUDE_JSON env var for testing getAvailableMcpPrefixes() without mutating real ~/.claude.json — production always reads real file
- [Phase 02-config-mcp-detection P02]: KNOWN LIMITATION: getAvailableMcpPrefixes() only reads ~/.claude.json (user-scoped); project-scoped .mcp.json not checked — quorum models are global tools in practice
- [Phase 02-config-mcp-detection P03]: QGSD_KEYWORD_MAP named with QGSD_ prefix to avoid collision in 1874-line install.js; quorum_instructions generated from detected prefixes (not template copy) to prevent behavioral/structural mismatch when servers are renamed
- [Phase 02-config-mcp-detection P04]: REQUIREMENTS.md MCP-01 path corrected (settings.json → ~/.claude.json verified live); CONF-03/MCP-03 field name corrected (quorum_models → required_models, approved divergence)

### Pending Todos

- `2026-02-20-add-gsd-quorum-command-for-consensus-answers.md` — Add gsd:quorum command for consensus answers (area: planning)
- `2026-02-20-narrow-stop-hook-quorum-scope-to-exclude-internal-routing-decisions.md` — Narrow stop hook quorum scope to exclude internal routing decisions (area: planning)

### Blockers/Concerns

- [Phase 1 carry-forward] Integration test: `stop_hook_active` behavior on second Stop invocations with GSD subagents must be empirically confirmed against live Claude Code runtime — documented behavior but not end-to-end tested
- [Phase 2 carry-forward] KNOWN LIMITATION: getAvailableMcpPrefixes() only reads ~/.claude.json (user-scoped MCPs). Project-scoped MCPs configured in .mcp.json are not checked — Phase 3 / future work to extend
- [Phase 3 blocker resolved] Human Check 6 confirmed live quorum enforcement works end-to-end — Stop hook blocks and passes correctly in real Claude Code session

## Session Continuity

Last session: 2026-02-20
Stopped at: Phase 2 complete, transitioned to Phase 3 ready-to-plan. Phases 1 and 2 fully verified; Phase 3 (Installer & Distribution) has no plans yet — run /gsd:plan-phase 3 to begin.
Resume file: None
