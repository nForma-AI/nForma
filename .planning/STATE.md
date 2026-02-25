# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-02-24 after v0.12 roadmap created)

**Core value:** Planning decisions are multi-model verified by structural enforcement, not instruction-following — a Stop hook that reads the transcript makes it impossible for Claude to skip quorum.
**Current focus:** v0.10-08 PLCY-03 auto-update bug fix — Wave 0 regression stubs complete (Plan 01 done); Plan 02 (implementation + export runAutoUpdateCheck via _pure + GREEN) remaining

## Current Position

Phase: v0.10-08-plcy03-auto-update-bug-fix
Plan: 1 of 2 complete (Plan 02 remaining)
Status: v0.10-08 Plan 01 COMPLETE — 3 Wave 0 regression stubs added: stub 1 PASS (bug proof), stub 2 PASS (fix proof), stub 3 FAIL/RED (runAutoUpdateCheck not yet in _pure); 124/125 tests pass; commit 4951f47
Last activity: 2026-02-25 - Completed v0.10-08-01: PLCY-03 Wave 0 regression test stubs (TDD RED phase)

Progress: [████████████████████] 46/46 plans (prior milestones 100%) | v0.11-01: 3/3 plans COMPLETE | v0.12: 3/3 phases COMPLETE (v0.12-01 + v0.12-02 + v0.12-03) | v0.10: v0.10-01 + v0.10-07 COMPLETE + v0.10-08 Plan 01 COMPLETE | v0.9 parallel: 3/5 phases

## Performance Metrics

**Velocity:**
- Total plans completed: 46+ (across v0.2–v0.8)
- Average duration: 3.5 min
- Total execution time: ~2.7 hours

**By Phase (recent):**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| v0.7-03 P02 | 1 | 4 min | 4 min |
| v0.8-01 P01 | 1 | ~5 min | 5 min |
| v0.8-01 P02 | 1 | ~5 min | 5 min |
| v0.9-01 P01 | 1 | ~2 min | 2 min |
| v0.11-01 P01 | 2 | 2 min | 1 min |
| v0.11-01 P03 | 1 | 3 min | 3 min |
| v0.10-01 P01 | 2 | 2 min | 1 min |
| v0.10-01 P02 | 1 | 1 min | 1 min |
| v0.10-04 P01 | 1 | 1 min | 1 min |
| v0.10-04 P02 | 2 | 1 min | 1 min |
| v0.10-05 P01 | 1 | 2 min | 2 min |
| v0.10-05 P02 | 2 | 2 min | 1 min |
| v0.10-05 P03 | 3 | 28 min | 9 min |

**Recent Trend:**
- Last 5 plans: stable
- Trend: stable

*Updated after each plan completion*

## Accumulated Context

### Decisions

Decisions are logged in PROJECT.md Key Decisions table.
Recent decisions affecting current work:

- [v0.12 roadmap]: Hook emission (LOG-02) uses fs.appendFile only — never stdout (stdout = Claude Code decision channel)
- [v0.12 roadmap]: XState must NOT be imported in hook files — compiled CJS artifact only; hooks maintain zero npm runtime dependencies
- [v0.12 roadmap]: conformance-schema.cjs is the first deliverable of v0.12-01 — prevents schema drift permanently
- [v0.12 roadmap]: v0.12-03 depends on v0.12-01 only (not v0.12-02) — Alloy/PRISM/Petri can run in parallel after schema is stable
- [v0.12 roadmap]: Java ≥17 is the shared prerequisite for TLA+, Alloy, PRISM — documented once in VERIFICATION_TOOLS.md
- [v0.11-01-03]: SEQUENTIAL CALLS ONLY exception: worker Task spawns per round ARE sibling calls; all Bash remains sequential
- [v0.11-01-03]: Scoreboard update uses merge-wave per round (temp vote files → single atomic transaction)
- [v0.10-01-01]: readQgsdJson/writeQgsdJson use optional filePath parameter for testability — avoids fs mocking
- [v0.10-01-01]: getKeyInvalidBadge uses dependency-injected hasKeyFn — keeps pure function testable without secretsLib
- [v0.10-01-01]: listAgents() deduplication — 2 separate inline qgsd.json reads replaced by single readQgsdJson() call
- [v0.10-01-02]: hasKeyFn=()=>true in listAgents() — key_status is written only after health probe (key configured), so invalid status implies key existed at probe time; badge fires unconditionally on invalid status
- [v0.10-01-02]: scoreboardData loaded from process.cwd()/.planning/quorum-scoreboard.json (project-relative, not home-relative)
- [v0.10-04-01]: formatTimestamp tests check format structure (length + colon positions) not exact HH:MM:SS to avoid UTC vs local timezone flakiness
- [v0.10-04-01]: buildDashboardLines stale threshold: 60s — test uses 70s (stale) and 10s (fresh) as deterministic boundary cases
- [v0.10-04-02]: formatTimestamp inserted after writeKeyStatus, before probeWithRetryOrCancel — keeps pure functions together near other pure functions
- [v0.10-04-02]: ANSI escape codes embedded in buildDashboardLines return strings — caller (liveDashboard) renders as-is, no abstraction layer needed
- [v0.10-05-01]: Plan stated 22 stubs but action block contained 24 (4+4+4+5+7); applied all 24 — code specification is authoritative over prose count
- [v0.10-05-02]: 118 tests pass (not 116 as plan expected) — 94+24=118 is correct GREEN state; count discrepancy carried forward from Plan 01
- [v0.10-05-02]: POLICY_MENU_CHOICES and UPDATE_LOG_DEFAULT_MAX_AGE_MS are module-level constants, not exported — internal implementation details
- [v0.10-05-03]: runAutoUpdateCheck() is fail-open with 20s Promise.race timeout — never throws or blocks mainMenu
- [v0.10-05-03]: listAgents() reads tail 500 lines of update log — prevents unbounded memory growth on large logs
- [v0.10-05-03]: writeUpdatePolicy() persists to qgsd.json agent_config[slot].update_policy; tuneTimeouts() writes to providers.json via writeProvidersJson()
- [v0.10-08-01]: Wave 0 stub 3 uses _pure.runAutoUpdateCheck existence check as RED trigger — simplest assertion that fails before Plan 02 adds the export

### Pending Todos

- `2026-02-20-add-gsd-quorum-command-for-consensus-answers.md` — Add qgsd:quorum command for consensus answers (area: planning)
- Phase 22 post-validation: 5-category taxonomy may need refinement based on empirical categorization results

### Blockers/Concerns

- [Phase 12 carry-forward]: npm publish qgsd@0.2.0 deferred; run `npm publish --access public` when user decides
- [v0.12-02 research flag]: TLA+ fairness assumption (WF_vars vs SF_vars for EventualConsensus) needs validation during plan-phase
- [v0.12-03 research flag]: PRISM `-const` flag syntax for injecting rates.const file should be verified before Phase v0.12-03 PRISM plan

## Quick Tasks Completed

| # | Name | Date | Commit | Status | Link |
|---|------|------|--------|--------|------|
| 95 | Comprehensive secure CCR credential management | 2026-02-24 | d0530ed | Verified | [95-comprehensive-secure-ccr-credential-mana](./quick/95-comprehensive-secure-ccr-credential-mana/) |
| 96 | Refactor manage-agents.cjs to extract pure logic functions and add node:test suite | 2026-02-24 | 114de1f | Verified | [96-refactor-manage-agents-cjs-to-extract-pu](./quick/96-refactor-manage-agents-cjs-to-extract-pu/) |
| 97 | Add update management for all sub-coding agents to manage-agents.cjs | 2026-02-24 | 1ad0a6b | Verified | [97-add-update-management-for-all-sub-coding](./quick/97-add-update-management-for-all-sub-coding/) |
| 98 | Apply three quorum-identified improvements to qgsd-quorum-orchestrator prompt wording | 2026-02-24 | 58dbb33 | Verified | [98-apply-three-quorum-identified-improvemen](.planning/quick/98-apply-three-quorum-identified-improvemen/) |
| 99 | in the quorum, we need to make sure that the LLMs understand that the other opinions comes from other LLMs, not from users, lawyers, specialist | 2026-02-24 | 576014a | Verified | [99-in-the-quorum-we-need-to-make-sure-that-](./quick/99-in-the-quorum-we-need-to-make-sure-that-/) |
| 100 | Add global wall-clock timeout to quorum orchestrator to prevent indefinite hangs when all external models are unavailable | 2026-02-24 | 5483112 | Verified | [100-add-global-wall-clock-timeout-to-quorum-](./quick/100-add-global-wall-clock-timeout-to-quorum-/) |
| 101 | Unified quorum: new slot-worker agent, orchestrator 10-round parallel loop, inline synthesis, retire old workers | 2026-02-24 | 849ea36 | Verified | [101-unified-quorum-new-slot-worker-agent-orc](./quick/101-unified-quorum-new-slot-worker-agent-orc/) |
| 102 | full review of Quick Task 101 | 2026-02-25 | e8cbabe | Verified | [102-full-review-of-quick-task-101](.planning/quick/102-full-review-of-quick-task-101/) |
| 103 | deprecate qgsd-quorum-orchestrator and update quorum dispatch UX | 2026-02-25 | 7d327fc | Verified | [103-deprecate-qgsd-quorum-orchestrator-and-u](.planning/quick/103-deprecate-qgsd-quorum-orchestrator-and-u/) |

## Session Continuity

Last session: 2026-02-25
Stopped at: 2026-02-25 - Completed v0.10-08-01: PLCY-03 Wave 0 regression test stubs; Plan 02 (implementation) remaining
Resume file: None
