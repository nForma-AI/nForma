# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-03-04)

**Core value:** Planning decisions are multi-model verified by structural enforcement, not instruction-following
**Current focus:** v0.27 archived — planning next milestone

## Current Position

Phase: —
Plan: —
Status: Milestone v0.27 archived. Ready for next milestone.
Last activity: 2026-03-05 - Completed quick task 174: Harden test runner against glob failures, timeout hangs, and missing test-file mappings

Progress: Ready for /qgsd:new-milestone

## Performance Metrics

**Velocity:**
- Total plans completed: 6
- Average duration: 5 minutes
- Total execution time: 0.5 hours

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| v0.27-01 | 3/3 | 5/5 | 8 min |
| v0.27-05 | 3/3 | 56/56 | 5 min |

**Recent Trend:**
- Last 5 plans: -
- Trend: -

*Updated after each plan completion*

## Accumulated Context

### Decisions

Decisions are logged in PROJECT.md Key Decisions table.
Recent decisions affecting current work:

- [v0.27 roadmap]: Debt schema + fingerprinting are foundation phase — everything depends on valid data structure
- [v0.27 roadmap]: Observe skill core in Phase 2 reuses existing triage architecture (pluggable sources, parallel fetch)
- [v0.27 roadmap]: Production source types (Prometheus/Grafana/Logstash) are framework-ready stubs, no live endpoints required
- [v0.27 roadmap]: Cross-source dedup (Phase 3) and production sources (Phase 4) can run in parallel after Phase 2
- [v0.27 roadmap]: Solve P->F integration is last — requires stable debt ledger + dedup before feedback loop closes
- [v0.27 research]: Six critical pitfalls identified (false positive floods, unbounded growth, fingerprint collisions, solve instability, abstraction leaks, human gate bypass)

### Pending Todos

None yet.

### Blockers/Concerns

None yet.

## Session Continuity

Last session: 2026-03-04
Stopped at: Completed quick task 161 (Replace blessed-xterm/node-pty with pure-JS terminal widget using @xterm/headless)
Resume file: None

## Quick Tasks Completed

| # | Task | Date | Commit | Status | Link |
|---|------|------|--------|--------|------|
| 146 | TAP regex fix for Node v25 and skip/todo tracking in sweepTtoC | 2026-03-04 | 54d7f780 | Completed | [146-track-skip-todo-in-t-c-sweep-fix-broken-](./quick/146-track-skip-todo-in-t-c-sweep-fix-broken-/) |
| 161 | Replace blessed-xterm/node-pty with pure-JS terminal widget using @xterm/headless | 2026-03-04 | ba5e0b58 | Verified | [161-replace-blessed-xterm-node-pty-with-pure](./quick/161-replace-blessed-xterm-node-pty-with-pure/) |
| 162 | Make sync-baselines always use detect mode by default | 2026-03-04 | 39fc61e9 | Completed | [162-make-sync-baselines-always-use-detect-mo](./quick/162-make-sync-baselines-always-use-detect-mo/) |
| 163 | Add developer doc auto-generation to qgsd solve skill | 2026-03-04 | ea9363ea | Verified | [163-add-developer-doc-auto-generation-to-qgs](./quick/163-add-developer-doc-auto-generation-to-qgs/) |
| 164 | Add UPPAAL verifyta installation to bin/install.js | 2026-03-04 | 8caf29e4 | Completed | [164-add-uppaal-verifyta-installation-to-bin-](./quick/164-add-uppaal-verifyta-installation-to-bin-/) |
| 165 | Fix solver F→C diagnostic to read all 26+ formal checks instead of 4 CI-only | 2026-03-04 | 6ff105da | Completed | [165-fix-qgsd-solve-cjs-f-to-c-diagnostic-to-](./quick/165-fix-qgsd-solve-cjs-f-to-c-diagnostic-to-/) |
| 166 | Autonomous milestone completion loop via audit-milestone --auto | 2026-03-04 | e6d375c3 | Pending | [166-implement-autonomous-milestone-completio](./quick/166-implement-autonomous-milestone-completio/) |
| 167 | Implement SOLVE-05: Make the formal verification harness project-agnostic | 2026-03-04 | f3341590 | Verified | [167-implement-solve-05-make-the-formal-verif](./quick/167-implement-solve-05-make-the-formal-verif/) |
| 168 | Add internal work detection handler to observe | 2026-03-04 | 21951ed3 | Verified | [168-add-internal-work-detection-handler-to-o](./quick/168-add-internal-work-detection-handler-to-o/) |
| 170 | Inject relevant requirements subset into quorum dispatch prompts for better-informed agent judgement | 2026-03-04 | 12fe407e | Verified | [170-inject-relevant-requirements-subset-into](./quick/170-inject-relevant-requirements-subset-into/) |
| 171 | Modify solve skill to use direct parallel executor dispatch for F-T and R-D | 2026-03-05 | 9d5342bb | Verified | [171-modify-solve-skill-to-use-direct-paralle](./quick/171-modify-solve-skill-to-use-direct-paralle/) |
| 172 | Build assumption-to-instrumentation analysis | 2026-03-05 | a3fce37a | Pending | [172-build-assumption-to-instrumentation-anal](./quick/172-build-assumption-to-instrumentation-anal/) |
| 173 | Teach discoverModels() to read model-registry.json search_dirs and add check_command support for project-level formal models | 2026-03-05 | 25f32777 | Pending | [173-teach-discovermodels-to-read-model-regis](./quick/173-teach-discovermodels-to-read-model-regis/) |
| 174 | Harden test runner against glob failures, timeout hangs, and missing test-file mappings | 2026-03-05 | pending | Pending | [174-harden-test-runner-against-glob-failures](./quick/174-harden-test-runner-against-glob-failures/) |

## Recent Accomplishments

- **v0.27-05 (Solve P->F Integration)** [2026-03-04]
  - P->F residual sweep: sweepPtoF reads acknowledged debt, compares against formal thresholds
  - Helpers: compareDrift, extractFormalExpected (cfg + json), isNumericThreshold, parseFormalRef
  - autoClosePtoF: two-track dispatch (parameter updates via /qgsd:quick, investigation flags)
  - Freeze semantics: entries in resolving status immune to concurrent observe overwrites
  - 8-layer solve pipeline: P->F integrated into computeResidual, autoClose, formatReport, formatJSON
  - 56 tests (40 unit + 11 autoClose + 5 integration), all passing
  - Requirements PF-01 through PF-05 completed
  - v0.27 milestone shipped: production feedback loop fully closed

- **v0.27-01-01 (Debt Schema & Validation)** [2026-03-04]
  - JSON Schema draft-07 definition with all required fields
  - Runtime validation module (validateDebtEntry, validateDebtLedger)
  - State machine enforcement (canTransition, transitionDebtEntry)
  - 70 tests (36 validation + 34 state machine), all passing
  - Requirements DEBT-01 and DEBT-03 completed

- **v0.27-01-02 (Deterministic Fingerprinting)** [2026-03-04]
  - Issue fingerprinting: hierarchical (exception_type → function_name → message hash)
  - Drift fingerprinting: formal parameter key hash
  - 38 tests (20 issue + 18 drift), all passing
  - Requirements FP-01 and FP-02 completed

- **v0.27-01-03 (Ledger I/O and Retention Policy)** [2026-03-04]
  - Atomic read/write operations with fail-open behavior (readDebtLedger, writeDebtLedger)
  - Retention policy for archival of resolved entries > max_age (applyRetentionPolicy, writeArchive)
  - Seed .formal/debt.json with empty ledger structure
  - 27 tests (19 ledger/retention + 8 integration), all passing
  - Requirement DEBT-04 completed
  - Complete v0.27-01 phase foundation: schema + validation + state machine + fingerprinting + ledger + retention
