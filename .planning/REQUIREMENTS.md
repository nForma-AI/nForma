# Requirements: QGSD

**Defined:** 2026-02-22
**Core Value:** Planning decisions are multi-model verified by structural enforcement, not instruction-following — a Stop hook that reads the transcript makes it impossible for Claude to skip quorum.

## v0.3 Requirements

### Discovery

- [ ] **DISC-01**: User can run `/qgsd:maintain-tests` and have the tool auto-detect jest, playwright, and pytest by reading project config files (jest.config.*, playwright.config.*, pytest.ini/pyproject.toml)
- [ ] **DISC-02**: Tool uses each framework's own CLI as the authoritative test source (jest --listTests, playwright --list, pytest --collect-only) — never file system globs

### Execution

- [ ] **EXEC-01**: Tool randomly shuffles all discovered tests and splits them into batches of 100 (batch size configurable via `.claude/qgsd.json`)
- [ ] **EXEC-02**: Tool executes each batch, captures JSON-formatted output, and records pass/fail/skip status per test
- [ ] **EXEC-03**: Tool persists batch progress to a local state file so interrupted runs on 20,000+ test suites can resume from the last completed batch
- [ ] **EXEC-04**: Tool runs each failing test 3 times before AI categorization to detect flakiness (eliminates false positives from non-convergent loops)

### Categorization

- [ ] **CATG-01**: Claude classifies each confirmed failure into one of 5 categories: `valid-skip` / `adapt` / `isolate` / `real-bug` / `fixture`
- [ ] **CATG-02**: For `adapt`-categorized failures, tool provides git pickaxe context (`git log -S`) linking the failing test to the commit that changed the code under test
- [ ] **CATG-03**: `adapt`, `fixture`, and `isolate` classifications automatically trigger a `/qgsd:quick` fix task; `real-bug` failures go to a deferred user report

### Iteration

- [ ] **ITER-01**: Tool iterates through remaining uncategorized/unactioned tests continuously until terminal state is reached
- [ ] **ITER-02**: Loop terminates when: all tests classified, no progress in last 5 batches, or configurable iteration cap reached

### Integration

- [ ] **INTG-01**: Tool disables QGSD circuit breaker at run start and re-enables on completion (prevent false oscillation detection during iterative fix commits)
- [ ] **INTG-02**: Tool activity state integrates with `/qgsd:resume-work` routing so interrupted maintenance runs recover to the correct step
- [ ] **INTG-03**: `/qgsd:maintain-tests` is implemented as execution-only — not added to `quorum_commands` (R2.1 compliance)

## v0.4 Requirements

### Scale & CI

- Multi-framework mixed batching (jest + playwright in same batch) — deferred, adds CLI-switching complexity
- CI/scheduled maintenance runs — periodic automated maintenance
- Per-test ownership tracking — link tests to code owners for routing fix tasks

## Out of Scope

| Feature | Reason |
|---------|--------|
| Installing test plugins in target projects | Non-invasive observer model — QGSD doesn't modify target codebases |
| Concurrent batch execution | Sequential by design — test runners parallelize internally, outer concurrency counterproductive |
| Auto-fixing real-bug failures | Safety boundary — source changes require user approval |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| DISC-01 | Phase 18 | Pending |
| DISC-02 | Phase 18 | Pending |
| EXEC-01 | Phase 18 | Pending |
| EXEC-02 | Phase 18 | Pending |
| EXEC-04 | Phase 18 | Pending |
| EXEC-03 | Phase 19 | Pending |
| INTG-02 | Phase 19 | Pending |
| ITER-01 | Phase 20 | Pending |
| ITER-02 | Phase 20 | Pending |
| INTG-01 | Phase 20 | Pending |
| INTG-03 | Phase 20 | Pending |
| CATG-01 | Phase 21 | Pending |
| CATG-02 | Phase 21 | Pending |
| CATG-03 | Phase 21 | Pending |

**Coverage:**
- v0.3 requirements: 14 total
- Mapped to phases: 14
- Unmapped: 0 ✓

---
*Requirements defined: 2026-02-22*
*Last updated: 2026-02-22 — traceability populated after roadmap creation (Phases 18–22)*
