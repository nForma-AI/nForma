---
phase: 22
type: research
status: complete
---

# Phase 22 Research: Integration Test

## RESEARCH COMPLETE

## Goal Restatement

Phase 22 validates the full `/qgsd:fix-tests` loop end-to-end and closes out the v0.3 milestone. It does not add new features — it verifies that Phases 18–21 compose correctly and closes 9 open requirements: CATG-01, CATG-02, CATG-03, ITER-01, ITER-02, INTG-01, INTG-03, plus DISC-01/02 end-to-end confirmation.

## What Exists (Phases 18–21 Delivered)

### fix-tests Workflow (466 lines, fully implemented)

**`/Users/jonathanborduas/code/QGSD/get-shit-done/workflows/fix-tests.md`**
- Step 1: Resume check via `maintain-tests load-state` (null = fresh, non-null = resume)
- Step 2: Circuit breaker disable (`npx qgsd --disable-breaker`)
- Steps 3–4: Discover + batch via gsd-tools maintain-tests CLIs
- Step 5: Initialize state JSON (schema_version, session_id, results_by_category, categorization_verdicts, dispatched_tasks, deferred_report)
- Step 6a–6h: Batch loop — run → categorize (5-category AI + pickaxe) → progress banner → update state → termination check → dispatch
- Step 7: Circuit breaker re-enable
- Step 8: Activity clear
- Step 9: Terminal summary with deferred report

**State schema (Step 5):**
```json
{"schema_version":1,"session_id":"...","manifest_path":"...","total_tests":N,"batches_complete":0,
"batch_status":{},"processed_files":[],"results_by_category":{"valid_skip":[],"adapt":[],"isolate":[],"real_bug":[],"fixture":[]},
"flaky_tests":[],"iteration_count":0,"last_unresolved_count":N,"consecutive_no_progress":0,
"deferred_tests":[],"categorization_verdicts":[],"dispatched_tasks":[],"deferred_report":{"real_bug":[],"low_context":[]}}
```

### gsd-tools.cjs Subcommands

- `maintain-tests discover --output-file` — jest/playwright/pytest CLI detection + collect
- `maintain-tests batch --input-file --manifest-file` — random batch shuffling, Mulberry32 PRNG
- `maintain-tests run-batch --batch-file --batch-index --output-file` — per-file test execution, 3-run flakiness check, JSON output
- `maintain-tests save-state --state-json` — state persistence (node:sqlite or JSON flat file)
- `maintain-tests load-state` — returns null for missing file (resume safety)

### Resume Routing

`/qgsd:resume-work` → resume-project.md routing table covers all 6 `maintain_tests` sub_activities:
- discovering_tests → re-trigger fix-tests fresh
- running_batch → re-run batch N
- categorizing_batch → re-enter categorization for batch N
- actioning_batch → dispatch quick tasks for batch N failures
- verifying_batch → re-run verification for batch N
- complete → print summary

### Circuit Breaker Integration

- Disabled at Step 2 via `npx qgsd --disable-breaker`
- Re-enabled at Step 7 AND in error handler (every exit path)
- Circuit breaker state file: `.claude/circuit-breaker-state.json`
- TDD growth detection (net positive diff) distinguishes iterative fix commits from genuine oscillation (Phase quick-45)

### INTG-03 Compliance

- `fix-tests` absent from `quorum_commands` in `~/.claude/qgsd.json`
- Confirmed: only plan-phase, new-project, new-milestone, discuss-phase, verify-work, research-phase in quorum_commands

### Test Suite (124 tests, 0 failures)

Existing coverage in `gsd-tools.test.cjs`:
- maintain-tests batch, discover, run-batch, integration (monorepo, pytest, buffer overflow, runner field propagation, batch-index flag)
- maintain-tests save-state, load-state

No tests yet for:
- Circuit breaker lifecycle within fix-tests (INTG-01)
- Resume mid-batch scenario (EXEC-03 resume path)
- INTG-03 compliance (fix-tests absent from quorum_commands)
- Category counting in terminal summary
- State schema field presence validation

## What Phase 22 Must Produce

### Plan 22-01: Fixture Project + End-to-End Smoke Test

A fixture test project that provides "controllable failures" is needed. The simplest approach:

**Option A: Inline fixture files** — create a small jest/node:test project under `.planning/fixtures/` with:
- 3–5 test files with known-passing tests
- 1–2 test files that always fail (different failure modes: assertion mismatch, import error, snapshot mismatch)
- 1 test file that is flaky (passes 2/3 runs)
- These are small enough to not pollute the repo

**Option B: Scripted mocked discovery** — create a mock `maintain-tests-batch-result.json` and drive the workflow steps manually.

**Recommendation: Option A** — real fixture tests exercise the actual CLI path (discover → batch → run) and produce authentic `batch_result.json` outputs. This gives genuine integration coverage without live network dependency.

**Key fixture design constraints:**
- Use `node:test` (built-in, no dependency) so fixture works without installing jest
- Or use jest IF the QGSD repo itself already has jest installed (it doesn't — gsd-tools.test.cjs uses node:test)
- Fixture tests should be simple enough that gsd-tools.cjs can discover and run them with its default jest/playwright/pytest detection
- Since node:test is native, the fixture should declare a `package.json` that scripts `test` as `node --test` and have `jest.config.js` absent

Actually: gsd-tools discover uses jest/playwright/pytest CLIs. If no framework config found, discovery returns empty. For a fixture, use pytest OR configure jest.

**Better approach: pytest fixture** — create a small Python project under `.planning/fixtures/test-suite/`:
- `conftest.py` + 3 test files
- pytest is installable via `pip`; gsd-tools detects via `pytest.ini` or `pyproject.toml`
- Failures are easy to script

**Or even simpler: just write a fake batch-result.json for testing** and validate the workflow decisions at the state machine level:

The VERIFICATION.md approach (Plan 22-02) does this: run the workflow against a real project's fixture, OR create a state machine test that drives gsd-tools CLI directly.

### Plan 22-01: gsd-tools Integration Tests (new tests in gsd-tools.test.cjs)

Add 10–15 new tests covering the untested integration seams:

1. **INTG-03 compliance test** — read `~/.claude/qgsd.json`, assert `quorum_commands` does NOT include `fix-tests`
2. **Circuit breaker state transition test** — `npx qgsd --disable-breaker` writes `disabled:true`; `--enable-breaker` writes `disabled:false`
3. **Resume mid-batch test** — create state with `batches_complete:2`, verify `load-state` returns that state, verify `run-batch --batch-index 2` starts at batch 2 (not 0)
4. **Termination condition tests:**
   - State with `unresolved=0` → "all classified" condition fires
   - State with `consecutive_no_progress=5` → "no progress" condition fires
   - State with `iteration_count >= ITERATION_CAP AND B == total_batches-1` → "iteration cap" fires
5. **save-state round-trip with new schema fields** — save state with categorization_verdicts, dispatched_tasks, deferred_report; load-state returns identical structure
6. **run-batch flakiness detection** — test that runs 3 times detects flaky vs confirmed failure
7. **Phase 20 stub detection scenario** — state with `categorization_verdicts:[] AND results_by_category.real_bug:["file.test.js"]` matches stub detection condition

### Plan 22-02: VERIFICATION.md for v0.3 Requirements

The VERIFICATION.md is the artifact that closes the milestone. It must:
- Document evidence for all 14 v0.3 requirements (DISC-01/02, EXEC-01/02/03/04, CATG-01/02/03, ITER-01/02, INTG-01/02/03)
- Reference specific files, line numbers, test results, and git commits as evidence
- Status: `passed` closes the milestone, `gaps_found` triggers gap closure

The verifier reads existing workflow files and test suite, runs the test suite, and produces the VERIFICATION.md with per-requirement evidence chains.

## Key Technical Findings

### What "end-to-end integration test" means here

Since `/qgsd:fix-tests` is a Claude Code workflow (not a Node.js function), a true automated end-to-end test cannot be scripted like a unit test — it requires an actual Claude Code session. The practical approach for Phase 22:

1. **Unit-level integration tests** in `gsd-tools.test.cjs` covering the CLI seams (save-state → load-state round trips, batch execution, resume safety, termination conditions)
2. **Static verification** of INTG-03 compliance (read config file, assert fix-tests absent)
3. **Documentation verification** — VERIFICATION.md with evidence chains per requirement

This is exactly the pattern used for Phases 9, 10, 16 which also produced VERIFICATION.md without live Claude session replay.

### Resume Safety Gap to Address

The workflow's resume path at Step 1 checks `STATE_JSON = null` → fresh. But the test suite currently has no test that:
- Creates a real manifest file + state file
- Calls `load-state` and verifies the returned state has correct `batches_complete`
- Then calls `run-batch --batch-index N` with that batch index

This round-trip should be added as an integration test.

### REQUIREMENTS.md Update

After Phase 22 VERIFICATION.md is written, REQUIREMENTS.md traceability must be updated: CATG-01/02/03, ITER-01/02, INTG-01/03 all move from "Pending" to "Complete" with Phase 22 as the verifying phase.

## Phase 22 Plan Shape

**2 plans:**

| Plan | Wave | What |
|------|------|------|
| 22-01 | 1 | Add integration tests to gsd-tools.test.cjs covering INTG-01/03, resume, termination, state round-trip |
| 22-02 | 2 | Write VERIFICATION.md for all 14 v0.3 requirements + update REQUIREMENTS.md traceability |

**Wave 2 depends on Wave 1** (VERIFICATION.md references test results from 22-01).

## Pitfalls

1. **Fixture test project overhead** — Creating a full fixture project is complex and may not add value over well-designed unit tests against the CLI. Keep it unit-level unless the success criteria explicitly require a live run.

2. **Circuit breaker test isolation** — Tests that call `--disable-breaker` / `--enable-breaker` modify `.claude/circuit-breaker-state.json`. They must restore state after each test or use a temp dir.

3. **quorum_commands location** — INTG-03 test must read `~/.claude/qgsd.json` (not `.claude/qgsd.json`). The global file is what the Stop hook reads.

4. **REQUIREMENTS.md update timing** — Requirements should be updated AFTER VERIFICATION.md is written and confirmed passing, not before.

5. **ITER-01/02 evidence** — These are loop control requirements. Evidence is the workflow text (Step 6g termination conditions) + state schema having `consecutive_no_progress`, `iteration_count`, `ITERATION_CAP`. A test that simulates the state machine is the best evidence.
