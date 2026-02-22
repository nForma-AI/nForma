# Roadmap: QGSD

## Milestones

- ✅ **v0.2 — Gap Closure & Activity Resume Routing** — Phases 1–17 (shipped 2026-02-21)
- 🚧 **v0.3 — Test Suite Maintenance Tool** — Phases 18–22 (in progress)

## Phases

<details>
<summary>✅ v0.2 — Gap Closure & Activity Resume Routing (Phases 1–17) — SHIPPED 2026-02-21</summary>

- [x] **Phase 1: Hook Enforcement** — Stop hook hard gate + UserPromptSubmit injection + meta quorum behavior (completed 2026-02-20)
- [x] **Phase 2: Config & MCP Detection** — User-editable config system with MCP auto-detection and fail-open behavior (completed 2026-02-20)
- [x] **Phase 3: Installer & Distribution** — npm installer that writes hooks to ~/.claude/settings.json and GSD version sync strategy (completed 2026-02-20)
- [x] **Phase 4: Narrow Quorum Scope** — Stop hook restricted to actual project decision turns via GUARD 5 (completed 2026-02-21)
- [x] **Phase 5: Fix GUARD 5 Delivery Gaps** — hooks/dist/ rebuilt + marker path propagated to installer users (completed 2026-02-21)
- [x] **Phase 6: Circuit Breaker Detection & State** — PreToolUse hook detects oscillation in git history and persists breaker state across invocations (completed 2026-02-21)
- [x] **Phase 7: Enforcement & Config Integration** — Bash execution blocked when breaker is active; circuit_breaker config block added to config-loader (completed 2026-02-21)
- [x] **Phase 8: Installer Integration** — Installer registers PreToolUse hook and writes default circuit_breaker config block idempotently (completed 2026-02-21)
- [x] **Phase 9: Verify Phases 5-6** — VERIFICATION.md for Phases 5 and 6; DETECT-01..05 and STATE-01..04 closed (completed 2026-02-21)
- [x] **Phase 10: Fix Bugs + Verify Phases 7-8** — Fix INST-08/RECV-01/INST-10 bugs + VERIFICATION.md for Phases 7 and 8 (completed 2026-02-21)
- [x] **Phase 11: Changelog & Build** — CHANGELOG [0.2.0] entry, hooks/dist/ rebuilt, npm test 141/141 (completed 2026-02-21)
- [x] **Phase 12: Version & Publish** — package.json 0.2.0, MILESTONES.md, git tag v0.2.0 pushed; npm publish deferred (completed 2026-02-21)
- [x] **Phase 13: Circuit Breaker Oscillation Resolution Mode** — Structured quorum resolution when breaker fires; unified solution approval gate (completed 2026-02-21)
- [x] **Phase 14: Activity Tracking** — current-activity.json sidecar + activity-set/clear/get CLI + resume-work 15-row routing table (completed 2026-02-21)
- [x] **Phase 15: v0.4 Gap Closure — Activity Resume Routing** — Fix ACT-02 schema violations + ACT-04 routing gaps (completed 2026-02-21)
- [x] **Phase 16: Verify Phase 15** — 15-VERIFICATION.md + ACT-02/ACT-04 traceability closed (completed 2026-02-21)
- [x] **Phase 17: Fix Agent Name Typos** — qqgsd-* → qgsd-* across 12 files (completed 2026-02-21)

**Archive:** `.planning/milestones/v0.2-ROADMAP.md`

</details>

### 🚧 v0.3 — Test Suite Maintenance Tool (In Progress)

**Milestone Goal:** Build `/qgsd:maintain-tests` — a command that discovers, batches, AI-categorizes, and iteratively actions test failures across large suites (20k+ tests).

- [ ] **Phase 18: CLI Foundation** — gsd-tools.cjs maintain-tests sub-commands: discover, batch, run-batch + integration tests (4 plans)
- [ ] **Phase 19: State Schema & Activity Integration** — maintain-tests-state.json schema + resume-work routing rows
- [ ] **Phase 20: Workflow Orchestrator** — maintain-tests.md command + orchestrator: batch loop, circuit breaker lifecycle, loop termination
- [ ] **Phase 21: Categorization Engine** — 5-category AI diagnosis, git pickaxe context, quick task dispatch grouping
- [ ] **Phase 22: Integration Test** — End-to-end validation of the full maintain-tests loop

## Phase Details

### Phase 18: CLI Foundation
**Goal**: Users can run the maintain-tests mechanical layer from the command line — discovery, batching, batch execution, and state I/O all work independently before any workflow logic exists
**Depends on**: Phase 17
**Requirements**: DISC-01, DISC-02, EXEC-01, EXEC-02, EXEC-04
**Success Criteria** (what must be TRUE):
  1. `gsd-tools.cjs maintain-tests discover` detects jest/playwright/pytest by reading project config files and invokes each framework's own CLI (jest --listTests, playwright --list, pytest --collect-only) to produce a deduplicated test list — never globs
  2. `gsd-tools.cjs maintain-tests batch` randomly shuffles the discovered test list and splits it into batches of the configured size (default 100), with the full batch manifest written to disk before any execution begins
  3. `gsd-tools.cjs maintain-tests run-batch` executes a single batch, captures output to a temp file via spawn (not in-memory buffering), and records pass/fail/skip per test
  4. Before AI categorization, each failing test is automatically re-run 3 times in isolation; tests that pass at least once are pre-classified as flaky and excluded from the categorization queue
  5. Unit tests pass for all sub-commands including monorepo fixture tests covering framework cross-discovery collision prevention
**Plans**:
  - 18-01: `maintain-tests discover` — config detection + framework CLI invocation + dedup (DISC-01, DISC-02) [Wave 1]
  - 18-02: `maintain-tests batch` — seeded Fisher-Yates shuffle + disk manifest (EXEC-01) [Wave 1]
  - 18-03: `maintain-tests run-batch` + 3-run flakiness pre-check — spawn file-based capture + timeout + env passthrough (EXEC-02, EXEC-04) [Wave 1]
  - 18-04: Integration tests — monorepo collision, parametrized pytest IDs, buffer overflow regression [Wave 2]

### Phase 19: State Schema & Activity Integration
**Goal**: The maintain-tests workflow has a stable, version-correct state file schema and is reachable by `/qgsd:resume-work` — interrupted runs on 20k+ suites can be recovered to the exact interrupted step
**Depends on**: Phase 18
**Requirements**: EXEC-03, INTG-02
**Success Criteria** (what must be TRUE):
  1. `maintain-tests-state.json` is written to disk on first batch completion and updated after every subsequent batch, containing per-test state, batch progress, categorization results, and termination condition fields (iteration_count, last_unresolved_count, deferred_tests)
  2. Running `/qgsd:resume-work` after an interrupted maintain-tests session routes back to the exact interrupted step (discovery, batch N, categorization, quick task dispatch) using the activity sidecar and the extended resume-work routing table
  3. Node version is detected at startup; state persistence uses node:sqlite on Node >= 22.5.0 and JSON flat file as fallback; the fallback is explicit and does not silently fail
**Plans**: TBD

### Phase 20: Workflow Orchestrator
**Goal**: The `/qgsd:maintain-tests` command exists and runs the complete batch loop with placeholder categorization — the full mechanical orchestration is validated before the high-risk categorization logic is added
**Depends on**: Phase 19
**Requirements**: ITER-01, ITER-02, INTG-01, INTG-03
**Success Criteria** (what must be TRUE):
  1. Typing `/qgsd:maintain-tests` starts the full discovery → batch → execute → iterate loop; a progress banner is printed after each batch completion
  2. The loop terminates cleanly on all three terminal conditions: all tests classified, no progress in last 5 batches (progress guard), or configurable iteration cap reached (default 5)
  3. The circuit breaker is disabled at maintain-tests start (`npx qgsd --disable-breaker`) and re-enabled at completion or interruption (`npx qgsd --enable-breaker`) — verified by checking circuit-breaker-state.json before and after a run
  4. `/qgsd:maintain-tests` is NOT listed in `quorum_commands` in any config file — confirmed by inspection of installed config and source; R2.1 compliance verified
**Plans**: TBD

### Phase 21: Categorization Engine
**Goal**: Claude reliably classifies confirmed test failures into one of the 5 categories, provides git pickaxe context for adapt failures, and automatically dispatches grouped fix tasks — the full categorization → action pipeline is end-to-end functional
**Depends on**: Phase 20
**Requirements**: CATG-01, CATG-02, CATG-03
**Success Criteria** (what must be TRUE):
  1. Each confirmed failure (passed the 3-run flakiness check) is classified into exactly one of: valid-skip, adapt, isolate, real-bug, or fixture; no failure exits categorization unclassified except via the `deferred` convergence category
  2. For every `adapt`-classified failure, the categorization output includes git pickaxe context (`git log -S`) linking the failing test to the commit that changed the code under test
  3. `adapt`, `fixture`, and `isolate` failures are automatically grouped by category, error type, and directory — then dispatched as `/qgsd:quick` tasks (max 20 tests per task); `real-bug` failures are collected into a deferred user report and never auto-actioned
  4. The categorization prompt includes the full source of the failing test and the top-2 stack trace source files; categorizations with context_score < 2 are not auto-actioned
**Plans**: TBD

### Phase 22: Integration Test
**Goal**: The full `/qgsd:maintain-tests` loop is validated end-to-end against a real or fixture test suite — all integration edge cases are verified and a VERIFICATION.md confirms the v0.3 milestone is shippable
**Depends on**: Phase 21
**Requirements**: (validates DISC-01, DISC-02, EXEC-01, EXEC-02, EXEC-03, EXEC-04, CATG-01, CATG-02, CATG-03, ITER-01, ITER-02, INTG-01, INTG-02, INTG-03 end-to-end)
**Success Criteria** (what must be TRUE):
  1. Running `/qgsd:maintain-tests` on a fixture project with controllable failures produces a complete loop: discovery → batching → execution → flakiness pre-check → categorization → action dispatch → loop termination
  2. Interrupting a run mid-batch and resuming via `/qgsd:resume-work` continues from the correct step with no data loss or duplicate batch execution
  3. The circuit breaker does not trigger during a legitimate maintain-tests run that produces multiple iterative fix commits
  4. A VERIFICATION.md for Phases 18–21 documents all 14 v0.3 requirements as verified with evidence
**Plans**: TBD

## Progress

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 1. Hook Enforcement | v0.2 | 6/6 | Complete | 2026-02-20 |
| 2. Config & MCP Detection | v0.2 | 4/4 | Complete | 2026-02-20 |
| 3. Installer & Distribution | v0.2 | 3/3 | Complete | 2026-02-20 |
| 4. Narrow Quorum Scope | v0.2 | 2/2 | Complete | 2026-02-21 |
| 5. Fix GUARD 5 Delivery Gaps | v0.2 | 1/1 | Complete | 2026-02-21 |
| 6. Circuit Breaker Detection & State | v0.2 | 1/1 | Complete | 2026-02-21 |
| 7. Enforcement & Config Integration | v0.2 | 2/2 | Complete | 2026-02-21 |
| 8. Installer Integration | v0.2 | 1/1 | Complete | 2026-02-21 |
| 9. Verify Phases 5-6 | v0.2 | 3/3 | Complete | 2026-02-21 |
| 10. Fix Bugs + Verify Phases 7-8 | v0.2 | 4/4 | Complete | 2026-02-21 |
| 11. Changelog & Build | v0.2 | 2/2 | Complete | 2026-02-21 |
| 12. Version & Publish | v0.2 | 2/2 | Complete (RLS-04 deferred) | 2026-02-21 |
| 13. Circuit Breaker Oscillation Resolution Mode | v0.2 | 2/2 | Complete | 2026-02-21 |
| 14. Activity Tracking | v0.2 | 4/4 | Complete | 2026-02-21 |
| 15. v0.4 Gap Closure — Activity Resume Routing | v0.2 | 1/1 | Complete | 2026-02-21 |
| 16. Verify Phase 15 | v0.2 | 1/1 | Complete | 2026-02-21 |
| 17. Fix Agent Name Typos | v0.2 | 1/1 | Complete | 2026-02-21 |
| 18. CLI Foundation | 1/4 | In Progress|  | - |
| 19. State Schema & Activity Integration | v0.3 | 0/? | Not started | - |
| 20. Workflow Orchestrator | v0.3 | 0/? | Not started | - |
| 21. Categorization Engine | v0.3 | 0/? | Not started | - |
| 22. Integration Test | v0.3 | 0/? | Not started | - |
