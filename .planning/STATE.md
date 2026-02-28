# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-02-28 after Milestone v0.20 start)

**Core value:** Planning decisions are multi-model verified by structural enforcement, not instruction-following — a Stop hook that reads the transcript makes it impossible for Claude to skip quorum.
**Current focus:** v0.20 Phase v0.20-04 — Verification Gate

## Current Position

Phase: v0.20-04 of 7 (Verification Gate)
Plan: Not started
Status: Ready to plan
Last activity: 2026-02-28 — v0.20-03 complete (PLAN-01 + PLAN-02 + PLAN-03 satisfied)

Progress: [▓▓▓▓▓▓░░░░░░░░░░░░░░░░░] v0.20: 3/7 phases complete (v0.20-03 done, advancing to v0.20-04)

## Performance Metrics

**Velocity:**
- Total plans completed: 46+ (across v0.2–v0.9)
- Average duration: 3.5 min
- Total execution time: ~2.7 hours

**By Phase (recent):**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| v0.20-02 P02 | 1 | 300s | 300s |
| v0.20-02 P01 | 1 | 120s | 120s |
| v0.20-01 P03 | 1 | 641s | 641s |
| v0.20-01 P02 | 1 | 358s | 358s |
| v0.20-01 P04 | 1 | 600s | 600s |

**Recent Trend:**
- Last 5 plans: stable
- Trend: stable

*Updated after each plan completion*
| Phase v0.20-01 P04 | 10m | 2 tasks | 9 files |

## Accumulated Context

### Decisions

Decisions are logged in PROJECT.md Key Decisions table.
Recent decisions affecting current work:

- [v0.20-02-03 Implementation]: ci:liveness-fairness-lint STEPS entry added to run-formal-verify.cjs (26th entry). Header updated: CI enforce (3), Total: 26 steps. LIVE-02 RED test from Plan 01 now GREEN. --only=ci runs all 3 CI steps including check-liveness-fairness.cjs. All verification criteria met.
- [v0.20-02-02 Implementation]: Liveness fairness lint check-liveness-fairness.cjs complete. Implemented as centralized CI step with dynamic MC*.cfg discovery (no hardcoded config list). Detects liveness properties lacking fairness declarations and emits v2.1 NDJSON result='pass'|'inconclusive'. Always exits 0 (inconclusive not a failure). Enhanced detectLivenessProperties with fallback surface mapping (strip 'MC' prefix if config unknown) to support test isolation. All 6 Wave 0 RED tests now GREEN. LIVE-01 and LIVE-02 requirements satisfied.
- [v0.20-02-01 Wave 0 Scaffold]: Liveness fairness lint RED test scaffold complete. 6 tests in check-liveness-fairness.test.cjs specify the contract (exit 0 always, pass/inconclusive results, dynamic config discovery). 1 test in run-formal-verify.test.cjs asserts ci:liveness-fairness-lint entry in STEPS. All 7 tests fail in RED state — implementation tasks must satisfy them. LIVE-01 and LIVE-02 requirements scoped by Wave 0 tests.
- [v0.20-01-05 completion]: Phase v0.20-01 Schema Enrichment COMPLETE. All 3 requirements satisfied: SCHEMA-01 (schema updated with v2.1 fields), SCHEMA-02 (writeCheckResult enforces validation), SCHEMA-03 (all 21 active callers updated). Integration smoke test confirms end-to-end pipeline: TLA+ runners call writeCheckResult with v2.1 fields, records appear in check-results.ndjson with correct structure. 9 fresh v2.1 records generated with runtime_ms > 0. Backwards compatibility verified (0 parse errors). Phase ready for downstream v0.20-02 through v0.20-06 which all depend on this enriched NDJSON.
- [v0.20-01-03 execution]: All 5 TLA+ runners (run-tlc.cjs, run-oscillation-tlc.cjs, run-protocol-tlc.cjs, run-breaker-tlc.cjs, run-account-manager-tlc.cjs) updated to v2.1 spec. Timer placement (immediately before spawnSync) ensures runtime_ms measures actual TLC execution, not module load time. Timeout-risk annotation at 120s threshold enables CI timeout-adequacy decisions. Plan 03 covers 9 of 21 STEPS entries; Plan 04 covered remaining 12 (Alloy, PRISM, formal-verify CI tool calls).
- [v0.20 roadmap]: v0.20-01 Schema Enrichment is the sole foundation phase — all other phases read check-results.ndjson with enriched v2.1 fields; no other phase can run until SCHEMA-01/02/03 are complete.
- [v0.20 roadmap]: v0.20-02 through v0.20-06 depend only on v0.20-01 and are parallelizable in execution: v0.20-02 (LIVE), v0.20-03 (PLAN), v0.20-04 (VERIFY), v0.20-05 (EVID), v0.20-06 (TRIAGE) can run in any order after v0.20-01.
- [v0.20 roadmap]: Planning gate is fail-open (PLAN-03) — TLC failures surface as warnings to the planner, never hard blockers. FV flakiness cannot break the planning workflow.
- [v0.19-11-01 execution]: UNIF-03 timing bug fixed — added ci:trace-redaction and ci:trace-schema-drift as STEPS entries in orchestrator (tool: 'ci') so their NDJSON writes happen before summary read at end of runOnce(). STEPS now 23 (was 21). Both CI scripts are idempotent; double execution (inside orchestrator + standalone workflow steps) is safe. Kept standalone CI steps in formal-verify.yml for explicit step reporting.
- [v0.19 milestone re-audit]: Final status tech_debt — all 25/25 requirements satisfied, 0 implementation gaps. Four tech-debt items: UNIF-03 (triage summary early read, RESOLVED by v0.19-11-01), CALIB-04 (conservative_priors parsed but not consumed by run-prism.cjs, medium), REQUIREMENTS.md stale checkboxes (resolved — all [x]), REQUIREMENTS.md missing traceability rows (resolved by v0.19-09). Audit artifact: .planning/v0.19-MILESTONE-AUDIT.md.
- [v0.18-04-02 execution]: mapRiskLevelToCount helper maps risk_level to fan-out counts: routine→2, medium→3, high→maxSize (fail-open). Export block uses `typeof module !== 'undefined'` guard to allow require() in tests while script exits via process.exit() before reaching export line at runtime.
- [Phase v0.15-04]: Check 9 added to cmdValidateHealth: W008 emitted for quorum slots with count >= 3 in .planning/quorum-failures.json. Threshold >= 3, try/catch swallows errors, Array.isArray + typeof count === 'number' guards applied.
- [Phase v0.15-02]: Content-length guard added to regenerateState: SAFE_LINE_THRESHOLD=50, --force required for overwrite of rich STATE.md

### Pending Todos

- `2026-02-20-add-gsd-quorum-command-for-consensus-answers.md` — Add qgsd:quorum command for consensus answers (area: planning)
- Phase 22 post-validation: 5-category taxonomy may need refinement based on empirical categorization results

### Blockers/Concerns

- [Phase 12 carry-forward]: npm publish qgsd@0.2.0 deferred; run `npm publish --access public` when user decides
- [v0.18-01 research flag]: Correlation file protocol timing — verify whether agent_id is predictable before Task spawn or only after; fallback is vote-line slot: parsing from output
- [v0.18-06/07 open]: v0.18-06 (FAN-04 Stop hook ceiling fix) and v0.18-07 (ENV-03 envelope path wiring) are not yet started — gap closure phases for v0.18

## Quick Tasks Completed

See previous STATE.md entries for quick tasks 95-114. Most recent:
| 115 | add missing unit tests for default ceiling, --n 1 solo mode, --n N ceiling override in stop/prompt hooks, and extend TLA+ model with MaxSize constant | 2026-02-27 | ab5a80c | Verified | [115-add-missing-unit-tests-for-default-ceili](./quick/115-add-missing-unit-tests-for-default-ceili/) |
| 116 | make formal spec generator fully automatic — GUARD_REGISTRY, maxSize/polledCount extraction, regenerate all specs with unanimity semantics | 2026-02-27 | 4618236 | Completed | [116-make-formal-spec-generator-fully-automat](./quick/116-make-formal-spec-generator-fully-automat/) |
| 117 | Add PreCompact hook for seamless context continuation | 2026-02-27 | ccefbfa | Verified | [117-add-a-precompact-hook-to-qgsd-that-auto-](./quick/117-add-a-precompact-hook-to-qgsd-that-auto-/) |
| 118 | Update all user-facing documentation: README with blessed TUI capabilities and formal analysis tools (PRISM, Alloy, TLA+, Petri nets) with installation instructions | 2026-02-28 | 01a4e608 | Verified | [118-update-all-user-facing-documentation-rea](./quick/118-update-all-user-facing-documentation-rea/) |
| 119 | major documentation refresh — update all documentation | 2026-02-28 | 225369a9 | Verified | [119-major-documentation-refresh-update-all-d](./quick/119-major-documentation-refresh-update-all-d/) |
| 121 | Build install-formal-tools.cjs cross-platform installer for TLA+ Alloy PRISM with --formal flag in install.js | 2026-02-28 | e765606c | Pending | [121-build-install-formal-tools-cjs-cross-pla](./quick/121-build-install-formal-tools-cjs-cross-pla/) |

## Session Continuity

Last activity: 2026-02-28 — v0.20-03 complete (PLAN-01 + PLAN-02 + PLAN-03 satisfied)
Last session: 2026-02-28
Stopped at: Phase v0.20-03 complete, ready to plan Phase v0.20-04 (Verification Gate)
Resume file: None
