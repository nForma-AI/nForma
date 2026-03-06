# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-03-06)

**Core value:** Planning decisions are multi-model verified by structural enforcement, not instruction-following
**Current focus:** v0.28-04 — Safety & Diagnostics (Security Sweep, Session State, Harness Diagnostics)

## Current Position

Phase: v0.28-04 (Safety & Diagnostics -- Security Sweep + Session State + Harness Diagnostics)
Plan: 3 of 3 in current phase (COMPLETE)
Status: Phase Complete
Last activity: 2026-03-06 - Completed quick task 196: Improve formal scope scan to use semantic relevance

Progress: [##########] 100%

## Performance Metrics

**Velocity:**
- Total plans completed: 3
- Average duration: 3min
- Total execution time: 0.17 hours

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| v0.28-01 | 3 | 10min | 3min |
| v0.29-01 | 3 | 12min | 4min |

**Recent Trend:**
- Last 5 plans: 2min, 2min, 6min
- Trend: Stable

*Updated after each plan completion*
| Phase v0.29-02 P01 | 8min | 2 tasks | 6 files |
| Phase v0.28-02 P01 | 2min | 2 tasks | 6 files |
| Phase v0.29-04 P02 | 2min | 1 tasks | 2 files |
| Phase v0.29-04 P03 | 16min | 2 tasks | 4 files |
| Phase v0.29-04 P01 | 3min | 2 tasks | 6 files |
| Phase v0.29-05 P01 | 3min | 2 tasks | 2 files |
| Phase v0.28-02 P02 | 3min | 2 tasks | 4 files |
| Phase v0.28-02 P03 | 3min | 2 tasks | 4 files |
| Phase v0.28-04 P01 | 2min | 2 tasks | 5 files |
| Phase v0.28-04 P02 | 2min | 2 tasks | 3 files |
| Phase v0.28-04 P03 | 2min | 2 tasks | 3 files |

## Accumulated Context

### Decisions

Decisions are logged in PROJECT.md Key Decisions table.
Recent decisions affecting current work:

- [v0.28-01-03]: Profile guard placed AFTER stdin consumption to prevent deadlock
- [v0.28-01-03]: Strict mode uses broadened regex instead of patching quorum_commands list
- [v0.28-01-03]: nf-circuit-breaker.js and nf-precompact.js intentionally untouched -- always active per HOOK_PROFILE_MAP
- [v0.28-01-01]: standard and strict profiles share identical hook sets -- behavioral difference handled in individual hooks not profile map
- [v0.28-01-01]: nf-check-update excluded from profile map -- SessionStart hook runs independently of profile system
- [v0.29 Roadmap]: Strict bottom-up ordering (L1 -> L2+GateA -> L3+GateB -> GateC -> Dashboard) -- building any layer before its foundation is the single most expensive mistake
- [v0.29 Roadmap]: Gate A comes WITH L2 (not after) -- grounding metric must be locked before L2 implementation to prevent vacuous pass
- [v0.29 Roadmap]: Gate B comes WITH L3 (not after) -- traceability enforcement must be built into L3 from the start
- [v0.29 Research]: Zero new npm dependencies -- all 14 new scripts use Node.js built-ins + existing XState/Ajv
- [v0.29-02-02]: H1 methodology skip prevents false positives -- mid-session events skipped in fresh-actor replay
- [v0.29-02-02]: Timestamp-based session windowing (2s gap) for per-session replay since events lack session_id
- [v0.29-02-02]: All 10 divergences.json entries are genuine IDLE-phase circuit_break disagreements, classified as open
- [Phase v0.28-01]: Cleanup subagent is non-blocking -- failure never prevents phase completion
- [Phase v0.29-02]: Observed invariant checks 1-3 fail on real data; added checks 4-5 (complete_requires_block, action_count_consistency) that hold across all 349 sessions
- [v0.28-02-01]: Null-byte separator in cache key prevents cross-field collisions
- [v0.28-02-01]: Cache validity checks both git HEAD and quorum composition to prevent stale results
- [v0.28-02-02]: nf-stop.js trusts NF_CACHE_HIT marker because nf-prompt.js is the validation gatekeeper
- [v0.28-02-02]: Cache backfill reads raw file instead of readCache() since pending entries lack completed field
- [v0.28-02-03]: countDeliberationRounds counts assistant messages with slot-worker dispatches, not individual slot calls
- [v0.28-02-03]: Cache-hit events get pass_at_k: 0 to distinguish from live quorum decisions
- [v0.28-02-03]: computePassAtKRates excludes cache hits and pre-PASSK events from rate calculations
- [v0.29-04-02]: L2/L3 analysis skipped when L1 produces zero impact -- avoids false positives from non-instrumented files
- [v0.29-04-02]: Emission points with null xstate_event excluded from L2 chaining -- only mapped events propagate
- [v0.29-04-01]: Oracle type directly maps to failure mode type: omission->state_assertion, commission->guard_rejection, corruption->state_equality
- [v0.29-04-01]: Gate C target threshold set at 0.8 (80%) following gate-b pattern; current score is 1.0
- [v0.29-04-03]: Layer sweeps use separate layer_total field -- never inflate existing total for backward compatibility
- [v0.29-04-03]: Gate steps in run-formal-verify marked nonCritical (ADVISORY maturity, not hard gates)
- [v0.29-05-01]: Gate scripts spawned via child_process for isolation -- matches nf-solve.cjs pattern
- [v0.29-05-01]: Accept exit code 0 OR 1 from gate scripts -- exit 1 means target not met but JSON valid
- [v0.29-05-01]: require.main guard prevents auto-execution when module required for testing
- [Phase v0.28-04]: Advisory-only security scanner -- exit code 0 always, findings are informational not blocking
- [v0.28-04-02]: Collect-then-emit pattern for combining multiple additionalContext sources in SessionStart hook
- [v0.28-04-02]: SessionStart vs PreCompact separation by design -- separate hooks on separate events, no conditional logic needed
- [v0.28-04-03]: Each diagnostic section independent with try/catch -- one broken data source never crashes the report
- [v0.28-04-03]: Reuses existing computePassAtKRates and detectStalledSlots instead of reimplementing
- [v0.28-04-03]: Exit code always 0 -- diagnostic tool is informational, never blocking

### Pending Todos

None yet.

### Blockers/Concerns

- Phase v0.29-02: Gate A metric definition is hardest design decision -- "explains" must be formally specified; prior attempt regressed (69% -> 0% -> 17.9%)
- Phase v0.29-03: FMEA methodology adapted to software state machines is novel synthesis -- RPN formula standard but S/O/D mapping to formal concepts needs design
- Phase v0.29-01: 567 uncovered assumptions in assumption-gaps.md form the integration backlog for L1->L2 classification

### Quick Tasks Completed

| # | Description | Date | Commit | Status | Directory |
|---|-------------|------|--------|--------|-----------|
| 190 | Review and validate session persistence and modal fix changes in nForma.cjs | 2026-03-06 | fd0c6634 | Verified | [190-review-and-validate-session-persistence-](./quick/190-review-and-validate-session-persistence-/) |
| 191 | Harden circuit breaker to prevent false positives on monotonic workflow progression | 2026-03-06 | 60e5f8bc | Verified | [191-harden-circuit-breaker-to-prevent-false-](./quick/191-harden-circuit-breaker-to-prevent-false-/) |
| 192 | Fix execute-plan Route C to chain into transition.md audit-milestone logic on last phase completion | 2026-03-06 | 1711e881 | Verified | [192-fix-execute-plan-route-c-to-chain-into-t](./quick/192-fix-execute-plan-route-c-to-chain-into-t/) |
| 193 | Build bin/git-heatmap.cjs — mine git history for numerical adjustments, bugfix hotspots, and churn ranking; output .planning/formal/evidence/git-heatmap.json as input for nf:solve | 2026-03-06 | e59d88e7 | Verified | [193-build-bin-git-heatmap-cjs-mine-git-histo](./quick/193-build-bin-git-heatmap-cjs-mine-git-histo/) |
| 194 | Fix gsd-tools.cjs phase-complete to detect next phase from ROADMAP.md when no directory exists on disk | 2026-03-06 | 3d186560 | Verified | [194-fix-gsd-tools-cjs-phase-complete-to-dete](./quick/194-fix-gsd-tools-cjs-phase-complete-to-dete/) |
| 195 | Add automated audit→plan→execute loop to nf:audit-milestone for tech debt auto-remediation | 2026-03-06 | c5467c79 | Pending | [195-add-automated-audit-plan-execute-loop-to](./quick/195-add-automated-audit-plan-execute-loop-to/) |
| 196 | Improve formal scope scan to use semantic relevance instead of keyword-only matching for determining which formal spec modules apply | 2026-03-06 | d1ea24da | Verified | [196-improve-formal-scope-scan-to-use-semanti](./quick/196-improve-formal-scope-scan-to-use-semanti/) |

## Session Continuity

Last session: 2026-03-06
Stopped at: Completed v0.28-04-03-PLAN.md (Harness Diagnostic) -- Phase v0.28-04 complete
Resume file: None
