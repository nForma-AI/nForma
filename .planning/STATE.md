# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-02-28 after Phase v0.19-08)

**Core value:** Planning decisions are multi-model verified by structural enforcement, not instruction-following — a Stop hook that reads the transcript makes it impossible for Claude to skip quorum.
**Current focus:** v0.19 FV Pipeline Hardening — gap closure phases v0.19-07 and v0.19-08 done; milestone re-audit next

## Current Position

Phase: v0.19-08 (MCP Formal Verification Pipeline Integration) — COMPLETE (all 2 plans done)
Plan: v0.19-08-01 — DONE; v0.19-08-02 — DONE
Status: MCPENV-02 and MCPENV-04 closed — MCMCPEnv.tla wired into TLC pipeline with fairness declaration; run-prism.cjs module.exports fixed + composite-key filter; both models in run-formal-verify.cjs STEPS and CI; 5 new tests GREEN
Last activity: 2026-02-28 — v0.19-08 complete: MCMCPEnv TLC pipeline registration (invariants.md, SURFACE_MAP, CI step); PRISM mcp-availability module.exports fix + composite-key filter; MCPENV-02 and MCPENV-04 fully closed

Progress: [████████████████████] prior milestones complete | v0.19: v0.19-01 COMPLETE | v0.19-02 COMPLETE | v0.19-03 COMPLETE | v0.19-04 COMPLETE | v0.19-05 COMPLETE | v0.19-06 COMPLETE | v0.19-07 COMPLETE | v0.19-08 COMPLETE — gap closure phases done, milestone re-audit next

## Performance Metrics

**Velocity:**
- Total plans completed: 46+ (across v0.2–v0.9)
- Average duration: 3.5 min
- Total execution time: ~2.7 hours

**By Phase (recent):**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| v0.9-08 P01 | 1 | 25s | 25s |
| v0.15-01 P01 | 1 | 684s | 684s |

**Recent Trend:**
- Last 5 plans: stable
- Trend: stable

*Updated after each plan completion*
| Phase v0.15-02 P01 | 4 | 3 tasks | 2 files |

## Accumulated Context

### Decisions

Decisions are logged in PROJECT.md Key Decisions table.
Recent decisions affecting current work:

- [v0.19-08 execution]: MCPENV gap closure — Plan 01: MCMCPEnv added to SURFACE_MAP ('MCMCPEnv':'mcp-calls') + VALID_CONFIGS, invariants.md created with EventualDecision fairness declaration (3 WF_vars operators), tla:mcp-environment STEPS entry, CI step. Plan 02: run-prism.cjs module.exports moved behind require.main===module guard; composite-key filter added INSIDE readMCPAvailabilityRates (not just at call site) so exported function returns clean data testable with realistic scoreboards; prism:mcp-availability STEPS entry + CI step. 5 new tests, 648 suite GREEN.
- [v0.19-07 execution]: LIVE-02 gap closure: detectLivenessProperties was already implemented in run-tlc.cjs — the wiring to the 4 runners (oscillation, breaker, protocol, account-manager) was all that was needed. TDD RED→GREEN approach: 12 stub tests written first, then 4 commits wiring each runner.
- [v0.19 roadmap]: UNIF-01 is the foundation phase — all other phases depend on check-results.ndjson schema existing; v0.19-01 has no upstream dependency. Dependency chain: UNIF (foundation) → CALIB (extends run-prism.cjs) → LIVE (extends run-tlc.cjs, parallel) → ENFORCE (adds redaction/evidence/drift, parallel) → MCPENV (depends on CALIB cold-start policy + UNIF output stream).
- [v0.19 roadmap]: LIVE-01..02 and REDACT-01..03/EVID-01..02/DRIFT-01..02 are parallel to CALIB — both depend only on UNIF-01 being done. Grouped into separate phases (v0.19-03 and v0.19-04) to keep each phase coherent.
- [v0.19 roadmap]: MCPENV-04 (mcp-availability.pm) depends on CALIB policy infrastructure (run-prism.cjs reads policy.yaml) — so v0.19-05 depends on v0.19-02.
- [v0.18-04-02 execution]: mapRiskLevelToCount helper maps risk_level to fan-out counts: routine→2, medium→3, high→maxSize (fail-open). Export block uses `typeof module !== 'undefined'` guard to allow require() in tests while script exits via process.exit() before reaching export line at runtime.
- [v0.18-04-02 execution]: Risk level extraction uses regex `/^risk_level:\s*(\S+)/m` on input.context_yaml YAML string. Priority chain: user --n N > envelope risk_level > config.maxSize > available slots. minNote always emits --n N for Stop hook parseQuorumSizeFlag consistency.
- [Phase v0.15-04]: Check 9 added to cmdValidateHealth: W008 emitted for quorum slots with count >= 3 in .planning/quorum-failures.json. Threshold >= 3, try/catch swallows errors, Array.isArray + typeof count === 'number' guards applied.
- [v0.18-02-04 execution]: 6 TIER unit tests added to gsd-tools.test.cjs (TIER-01 through TIER-03d); includes unknown agent fallback test per copilot-1 improvement suggestion; all 160 tests pass, zero regressions. Closed PLAN 02 gap of missing unit test coverage.
- [v0.18-02-02 execution]: model_overrides field added to loadConfig return object — was missing but accessed in resolveModelInternal, causing Rule 1 auto-fix. Tier lookup order: per-agent override → tier key → profile → default.
- [v0.18-02-01 execution]: TIER-03 implemented: flat keys model_tier_planner='opus', model_tier_worker='haiku' in DEFAULT_CONFIG with validation (whitelist: 'haiku'|'sonnet'|'opus')
- [v0.18 roadmap]: Phase order fixed by dependency chain: OBSV (independent) → TIER (config schema first) → ENV (foundation for fan-out) → FAN (depends on both TIER config and ENV envelope)
- [v0.18 research]: Flat config keys required for tier config — nested objects silently lost via shallow merge in config-loader.js
- [v0.18 research]: SubagentStop hook + agent_transcript_path transcript parsing is the only method to get per-slot token counts (not in hook payload directly)
- [v0.18 research]: --n N injection MUST flow through qgsd-prompt.js for any reduced fan-out — Stop hook reads count from prompt text only
- [Phase v0.15-01]: Extended phasePattern to match checkbox-format ROADMAP entries in addition to header format
- [Phase v0.14-04]: PRISM_BIN=prism sentinel in run-prism.test.cjs skips existence check, enabling Args line capture without PRISM installed
- [Phase v0.15-02]: Content-length guard added to regenerateState: SAFE_LINE_THRESHOLD=50, --force required for overwrite of rich STATE.md
- [Phase v0.15-02]: W002 phantom-phase trigger (v0.99-99) used in SAFE-01 tests — phase ref must match extractor regex v\d+\.\d+-\d{2}

### Pending Todos

- `2026-02-20-add-gsd-quorum-command-for-consensus-answers.md` — Add qgsd:quorum command for consensus answers (area: planning)
- Phase 22 post-validation: 5-category taxonomy may need refinement based on empirical categorization results

### Blockers/Concerns

- [Phase 12 carry-forward]: npm publish qgsd@0.2.0 deferred; run `npm publish --access public` when user decides
- [v0.18-01 research flag]: Correlation file protocol timing — verify whether agent_id is predictable before Task spawn or only after; fallback is vote-line slot: parsing from output
- [v0.18-04 RESOLVED]: --n N emission for envelope-driven fan-out verified via qgsd-stop-fan-out.test.cjs (FAN-STOP-TC1 through TC4 all passing); ceiling calculation confirmed correct

## Quick Tasks Completed

See previous STATE.md entries for quick tasks 95-114. Most recent:
| 113 | create a flag that allows to control the number of max member in the quorum | 2026-02-27 | ce5afb9 | Verified |
| 114 | Fix objective line in v0.15-01-01-PLAN.md | 2026-02-27 | b143170 | Verified |
| 115 | add missing unit tests for default ceiling, --n 1 solo mode, --n N ceiling override in stop/prompt hooks, and extend TLA+ model with MaxSize constant | 2026-02-27 | ab5a80c | Verified | [115-add-missing-unit-tests-for-default-ceili](./quick/115-add-missing-unit-tests-for-default-ceili/) |
| 116 | make formal spec generator fully automatic — GUARD_REGISTRY, maxSize/polledCount extraction, regenerate all specs with unanimity semantics | 2026-02-27 | 4618236 | Completed | [116-make-formal-spec-generator-fully-automat](./quick/116-make-formal-spec-generator-fully-automat/) |
| 117 | Add PreCompact hook for seamless context continuation | 2026-02-27 | ccefbfa | Verified | [117-add-a-precompact-hook-to-qgsd-that-auto-](./quick/117-add-a-precompact-hook-to-qgsd-that-auto-/) |

## Session Continuity

Last activity: 2026-02-28 — v0.19-08 complete: MCPENV-02 and MCPENV-04 closed — MCMCPEnv TLC pipeline wired, PRISM mcp-availability module.exports fixed + composite-key filter, 5 new tests GREEN. Milestone re-audit next.
Last session: 2026-02-28
Stopped at: Phase v0.19-08 complete (gap closure), milestone v0.19 re-audit ready
Resume file: None
