# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-03-01 after v0.21-03 Self-Calibrating Feedback Loops complete)

**Core value:** Planning decisions are multi-model verified by structural enforcement, not instruction-following — a Stop hook that reads the transcript makes it impossible for Claude to skip quorum.
**Current focus:** v0.21 — FV Closed Loop (Phase v0.21-04: Spec Completeness)

## Current Position

Phase: v0.21-04 of 6 (Spec Completeness)
Plan: — (not yet planned)
Status: Ready to plan
Last activity: 2026-03-01 — v0.21-03 Self-Calibrating Feedback Loops complete: 5 plans, 32/32 tests GREEN, LOOP-01/02/03/04 satisfied

Progress: [████████████░░░░░░░░░░░] v0.21: 3/6 phases (50%)

## Performance Metrics

**Velocity:**
- Total plans completed: 46+ (across v0.2–v0.9)
- Average duration: 3.5 min
- Total execution time: ~2.7 hours

**By Phase (recent):**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| v0.20-09 P01 | 1 | - | - |
| v0.20-08 P03 | 1 | - | - |
| v0.20-08 P01 | 1 | 600s | 600s |

**Recent Trend:**
- Last 5 plans: stable
- Trend: stable

*Updated after each plan completion*

## Accumulated Context

### Decisions

Decisions are logged in PROJECT.md Key Decisions table.
Recent decisions affecting current work:

- [v0.21-03 shipped]: LOOP-01/02/03/04 complete — `bin/run-prism.cjs` pre-step calibration, `hooks/qgsd-spec-regen.js` PostToolUse hook, `bin/sensitivity-sweep-feedback.cjs` (DEVIATION_THRESHOLD=0.05), `bin/propose-debug-invariants.cjs` + debug.md Step H. 32/32 tests GREEN.
- [v0.21-03 finding]: PRISM is installed on dev machine (`~/prism/bin/prism`), so LOOP-03 exit-1 logic cannot rely on PRISM exit code for flip-to-fail detection. Fixed: conservative exit-1 when flip-to-fail record within 2×threshold of empirical rate, before PRISM runs.
- [v0.21-02 shipped]: DIAG-01/02/03 complete — `bin/xstate-trace-walker.cjs` (single-actor replay), `bin/attribute-trace-divergence.cjs` (root-cause attribution), `bin/validate-traces.cjs` H1 fix (expectedState phase check). 49/49 tests GREEN. `formal/.divergences.json` TTrace export. `formal/diff-report.md` populated. State_mismatch rate: 0/8966 mapped events (0%).
- [v0.21-02 finding]: The 69% divergence rate was a methodology artifact (H1), not a code bug (H2). Fresh-actor validator started in IDLE for quorum_block/quorum_complete events that happened mid-session (phase=DECIDING). Fix: return null from expectedState() for phase!=IDLE events.
- [v0.21-01 shipped]: ARCH-01/02/03 complete — `formal/model-registry.json` (22 entries), `initialize-model-registry.cjs`, `promote-model.cjs`, `accept-debug-invariant.cjs`. 18/18 tests GREEN.
- [v0.21 roadmap]: LOOP and SPEC phases (v0.21-03, v0.21-04) are parallelizable — both depend only on v0.21-01; LOOP-04 debug invariants require ARCH-03 write path.
- [v0.21 roadmap]: PLAN-01/02/03 (v0.21-05) depends on ARCH + DIAG being stable before trusting FV results as planning gates.
- [v0.21 roadmap]: SIG-01/02/03/04 (v0.21-06) are last — consumes FV output from LOOP and SPEC phases; SIG-04 PRISM gate depends on calibrated rates from v0.21-03.

### Pending Todos

- `2026-02-20-add-gsd-quorum-command-for-consensus-answers.md` — Add qgsd:quorum command for consensus answers (area: planning)
- Phase 22 post-validation: 5-category taxonomy may need refinement based on empirical categorization results

### Blockers/Concerns

- [Phase 12 carry-forward]: npm publish qgsd@0.2.0 deferred; run `npm publish --access public` when user decides
- [v0.18-06/07 open]: v0.18-06 (FAN-04 Stop hook ceiling fix) and v0.18-07 (ENV-03 envelope path wiring) are not yet started — gap closure phases for v0.18
- [v0.21-02 carry-forward]: 3983 unmappable_action divergences remain (circuit_break: 2988, no-action events: 995) — these are correctly excluded from the state_mismatch rate but may need a separate tracking mechanism

## Session Continuity

Last session: 2026-03-01
Stopped at: Phase v0.21-03 complete — 5 plans, 32/32 tests GREEN, LOOP-01/02/03/04 satisfied. Self-calibrating feedback loops live: PRISM pre-step calibration, PostToolUse spec-regen hook, sensitivity sweep feedback, debug invariant mining. Ready to plan Phase v0.21-04 (Spec Completeness).
Resume file: None
