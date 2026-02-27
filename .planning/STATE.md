# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-02-27 after v0.18 milestone start)

**Core value:** Planning decisions are multi-model verified by structural enforcement, not instruction-following — a Stop hook that reads the transcript makes it impossible for Claude to skip quorum.
**Current focus:** v0.18 Token Efficiency — roadmap defined, ready to plan Phase v0.18-01

## Current Position

Phase: v0.18-02 of 4 (Tiered Model Sizing)
Plan: 02 (completed)
Status: 2/3 plans complete (v0.18-02-01, v0.18-02-02); v0.18-02-03 ready to plan
Last activity: 2026-02-27 — Executed v0.18-02-02: tier lookup logic + unit tests (TIER-01, TIER-02 requirements met)

Progress: [████████████████████] prior milestones complete | v0.18: 2/3 phase plans complete (v0.18-02-01, v0.18-02-02)

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

- [Phase v0.15-04]: Check 9 added to cmdValidateHealth: W008 emitted for quorum slots with count >= 3 in .planning/quorum-failures.json. Threshold >= 3, try/catch swallows errors, Array.isArray + typeof count === 'number' guards applied.
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
- [v0.18-04 research flag]: --n N emission for envelope-driven fan-out must be verified to reach qgsd-stop.js parseQuorumSizeFlag() correctly; test with conformance-events.jsonl

## Quick Tasks Completed

See previous STATE.md entries for quick tasks 95-114. Most recent:
| 113 | create a flag that allows to control the number of max member in the quorum | 2026-02-27 | ce5afb9 | Verified |
| 114 | Fix objective line in v0.15-01-01-PLAN.md | 2026-02-27 | b143170 | Verified |
| 115 | add missing unit tests for default ceiling, --n 1 solo mode, --n N ceiling override in stop/prompt hooks, and extend TLA+ model with MaxSize constant | 2026-02-27 | ab5a80c | Verified | [115-add-missing-unit-tests-for-default-ceili](./quick/115-add-missing-unit-tests-for-default-ceili/) |
| 116 | make formal spec generator fully automatic — GUARD_REGISTRY, maxSize/polledCount extraction, regenerate all specs with unanimity semantics | 2026-02-27 | 4618236 | Completed | [116-make-formal-spec-generator-fully-automat](./quick/116-make-formal-spec-generator-fully-automat/) |

## Session Continuity

Last activity: 2026-02-27 - Completed quick task 116: make formal spec generator fully automatic
Last session: 2026-02-27
Stopped at: Completed v0.15-04-01-PLAN.md — W008 health warning for quorum failures live
Resume file: None
