# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-02-26 after Phase v0.14-02)

**Core value:** Planning decisions are multi-model verified by structural enforcement, not instruction-following — a Stop hook that reads the transcript makes it impossible for Claude to skip quorum.
**Current focus:** v0.14 FV Pipeline Integration — Phase v0.14-04 COMPLETE; ready to plan v0.14-05

## Current Position

Phase: v0.14-04 (PRISM Config Injection) — COMPLETE (2/2 plans done)
Plan: v0.14-04-01 DONE (run-prism.cjs scoreboard injection) | v0.14-04-02 DONE (889b0c1)
Status: All plans complete — PRISM-01 (scoreboard read) + PRISM-02 (correct -const injection) satisfied; 337 tests passing
Last activity: 2026-02-26 — v0.14-04: run-prism.cjs scoreboard injection + 4 integration tests (run-prism.test.cjs), 337 tests total

Progress: [██████████] v0.13: SHIPPED | v0.14: 4/5 phases complete (v0.14-01 DONE, v0.14-02 DONE, v0.14-03 DONE, v0.14-04 DONE) | v0.12: in-progress (v0.12-10 pending) | v0.9: in-progress (v0.9-02..05 pending)

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
| v0.10-08 P02 | 2 | 6 min | 3 min |
| v0.12-04 P02 | 2 | 4 min | 2 min |
| v0.12-04 P03 | 2 | 2 min | 1 min |

**Recent Trend:**
- Last 5 plans: stable
- Trend: stable

*Updated after each plan completion*
| Phase v0.12-09 P02 | 1 | 1 tasks | 1 files |
| Phase v0.12-09 P01 | 3 | 1 tasks | 2 files |
| Phase v0.12-09 P05 | 3 | 1 tasks | 1 files |
| Phase v0.12-09 P03 | 2 | 1 tasks | 3 files |
| Phase v0.12-09 P04 | 1 | 1 tasks | 1 files |
| Phase v0.13-03 P01 | 5 | 2 tasks | 2 files |
| Phase v0.13-03 P02 | 8 | 3 tasks | 3 files |
| Phase v0.13-04 P01 | 1min | 1 tasks | 0 files |
| Phase v0.13-04 P02 | 102s | 2 tasks | 1 files |
| Phase v0.13-05 P01 | 4min | 4 tasks | 2 files |
| Phase v0.14-01 P01 | 1min | 3 tasks | 12 files |
| Phase v0.14-01 P02 | 2min | 7 tasks | 6 files |
| Phase v0.14-01 P03 | 174s | 6 tasks | 2 files |
| Phase v0.14-02 P01 | 178s | 4 tasks | 4 files |
| Phase v0.14-02 P02 | 147s | 3 tasks | 3 files |
| Phase v0.14-04 P02 | 2min | 1 tasks | 2 files |

## Accumulated Context

### Decisions

Decisions are logged in PROJECT.md Key Decisions table.
Recent decisions affecting current work:

- [Phase v0.14-02-03]: --tla-path/--guards-path CLI overrides in check-spec-sync.cjs for fixture-based drift injection tests — cleanest approach; no temp-file swap, no env var needed
- [Phase v0.14-02-03]: Alloy guard orphan detection is ok() informational not fail() — Alloy abstracts guard logic under different predicate names; guards/qgsd-workflow.json is the authoritative bridge
- [Phase v0.14-02-03]: Guard drift test added (phantomGuardXYZ fixture) per Copilot quorum improvement recommendation
- [v0.13-02]: QUORUM-03 second pass uses 3-round deliberation cap (not 10) — secondary pre-filter pattern matches R4, not full R3
- [v0.13-02]: QUORUM-02 uses compact prompt (1-sentence-per-gap, max 20 words) — execute-phase orchestrator context ~10-15%, full VERIFICATION.md text would overflow
- [v0.13-02]: Scoreboard update ordering guarantee: update-scoreboard.cjs BEFORE any downstream Task spawn (all 3 plans)
- [v0.13-01]: Used subagent_type="general-purpose" for plan-milestone-gaps Task spawn — no dedicated qgsd-plan-milestone-gaps subagent type registered; no model= to avoid resolve-model errors
- [v0.13-01]: STATE.md update placed at end of Step 6 (before Step 7) — ensures update fires regardless of routing path taken in offer_next
- [v0.13 roadmap]: Quorum Gates (v0.13-02) covers QUORUM-01/02/03 + LOOP-04 — plan-milestone-gaps, execute-phase, discuss-phase
- [v0.13 roadmap]: Two phases total — natural delivery boundary between "wiring the chain" and "replacing AskUserQuestion with quorum"
- [v0.12-04-03]: MCoscillation uses -workers 1 (liveness PROPERTY — avoids TLC v1.8.0 multi-worker liveness bug); MCconvergence uses -workers auto (safety-only)
- [Phase v0.12-09]: TLA-04: Used identical conditional-skip guard pattern from run-audit-alloy.test.cjs (phases 06-08) for run-tlc.test.cjs JAR-not-found test
- [Phase v0.12-09-01]: MCconvergence.cfg declares PROPERTY ConvergenceEventuallyResolves — liveness spec requires -workers 1; unconditional assignment replaces ternary
- [Phase v0.12-09-05]: effectiveMinQuorum replaces MIN_QUORUM_SIZE in deadlock check — zero regression on default path (3>5=false unchanged)
- [Phase v0.12-09]: ALY-02: JAR-existence skip guard pattern reused from run-audit-alloy.test.cjs for consistency
- [Phase v0.12-09]: PRM-02: Documentation approach for rates.const variable mismatch — avoids renaming variables in export-prism-constants.cjs, preserves existing tests and documented CLI usage
- [Phase v0.13-03-02]: VERIFICATION.md cites qgsd-core/ paths for all evidence — portable across installs
- [Phase v0.13-04]: INT-01 confirmed non-issue: canonical path qgsd-bin/update-scoreboard.cjs is already correct and consistent across all three workflow files; qgsd/bin/ path does not exist on disk
- [Phase v0.13-04]: INT-02: nice-row uses auto-mode guard instead of 'Ask user:' — subagent-safe in --auto mode
- [Phase v0.13-05]: IS_GAP_CLOSURE uses -A 4 not -A 3: Gap Closure field at offset 4 from ^### Phase X: header (verified across 7 gap-closure phases); ^### Phase anchor prevents cross-phase bleed
- [Phase v0.13-06]: installer sync is the canonical mechanism for deploying qgsd-core/ edits to ~/.claude/qgsd/ — must always include `node bin/install.js --claude --global` as a task when editing workflow files that are installed
- [Phase v0.14-01]: continue-on-error: true on master runner step matches verify-quorum-health guard pattern — JARs may be absent in CI
- [Phase v0.14-01]: Write tool used for formal-verify.yml update — Edit tool blocked by security_reminder_hook.py on workflow files; no functional impact
- [Phase v0.14-01-02]: node --check used for syntax smoke in run-formal-verify.test.cjs — avoids executing the async IIFE which would attempt child process spawns
- [Phase v0.14-01-02]: run-account-manager-tlc --config=invalid test fires before Java check (VALID_CONFIGS guard is first in script)
- [Phase v0.14-01-03]: STEPS[0] split into generate:tla-from-xstate (xstate-to-tla.cjs) + generate:alloy-prism-specs (generate-formal-specs.cjs) — total steps 20→21; satisfies INTG-04
- [Phase v0.14-01]: STEPS[0] split into generate:tla-from-xstate (xstate-to-tla.cjs) + generate:alloy-prism-specs; total steps 20→21; satisfies INTG-04
- [Phase v0.14-02]: _xstate suffix (Option A) chosen for BROKEN-01: never overwrites hand-authored QGSDQuorum.tla; generated spec at QGSDQuorum_xstate.tla
- [Phase v0.14-02]: Write tool used for formal-verify.yml (security_reminder_hook.py blocks Edit on workflow files — established pattern)
- [Phase v0.14-02]: esbuild external:['xstate'] removed — bundle xstate inline for tmpdir bundles (matches xstate-to-tla.cjs pattern)
- [Phase v0.14-02]: TLA+ TypeOK extra phases promoted from warn() to fail() (DRFT-03 hard failure); Alloy orphans remain warn() (may abstract state space)
- [Phase v0.14-04]: PRISM_BIN=prism sentinel in run-prism.test.cjs skips existence check, enabling Args line capture without PRISM installed

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
| 104 | normalize quorum.md dispatch to qgsd-quorum-slot-worker in Mode A and Mode B | 2026-02-25 | fbf52a0 | Verified | [104-normalize-quorum-md-dispatch-to-qgsd-quo](.planning/quick/104-normalize-quorum-md-dispatch-to-qgsd-quo/) |
| 105 | Add formal verification specs for QGSD CLI state machine: circuit breaker FSM (TLA+) and install scope matrix (Alloy) | 2026-02-25 | f3c3618 | Verified | [105-add-formal-verification-specs-for-qgsd-c](./quick/105-add-formal-verification-specs-for-qgsd-c/) |
| 106 | Extend v0.12 Formal Verification milestone with phases v0.12-04 through v0.12-08 covering all 9 formal verification gaps | 2026-02-25 | e9b4ea4 | Verified | [106-extend-v0-12-formal-verification-milesto](./quick/106-extend-v0-12-formal-verification-milesto/) |
| 107 | QGSD self-improvement passive telemetry: collector, classifier, cron installer, SessionStart injection | 2026-02-25 | 4ae7244 | Verified | [107-qgsd-self-improvement-passive-telemetry-](./quick/107-qgsd-self-improvement-passive-telemetry-/) |
| 108 | Richer slot-worker result block: add citations field and increase raw output cap from 2000 to 5000 chars in qgsd-quorum-slot-worker.md | 2026-02-26 | a7d5dde | Verified | [108-richer-slot-worker-result-block-add-cita](./quick/108-richer-slot-worker-result-block-add-cita/) |
| 109 | Update quorum.md: pass citations in prior_positions cross-poll bundle and write QUORUM_DEBATE.md at consensus/escalation | 2026-02-26 | b7cde74 | Verified | [109-update-quorum-md-pass-citations-in-prior](./quick/109-update-quorum-md-pass-citations-in-prior/) |

## Session Continuity

Last activity: 2026-02-26 - Completed Phase v0.14-03 (Parallelization): run-formal-verify.cjs parallelized, wall-clock timing added, 333 tests pass
Last session: 2026-02-26
Stopped at: Phase v0.14-03 COMPLETE — PERF-01 (Promise.all parallel tool groups) + PERF-02 (Wall-clock timing) satisfied; 333 tests pass; ready to plan v0.14-04 (PRISM Config Injection)
Resume file: None
