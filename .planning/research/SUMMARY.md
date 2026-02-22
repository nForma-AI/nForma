# Project Research Summary

**Project:** QGSD v0.3 — `/qgsd:maintain-tests`
**Domain:** AI-driven test suite maintenance tool — Claude Code plugin command
**Researched:** 2026-02-22
**Confidence:** HIGH

## Executive Summary

QGSD v0.3 adds a `/qgsd:maintain-tests` command that discovers, batches, categorizes, and iteratively fixes failing tests across large test suites (20k+ tests). This is a subsequent milestone — the existing QGSD architecture (hooks, quorum enforcement, circuit breaker, quick task pipeline) is stable and must not be broken. The correct approach is narrow: extend `gsd-tools.cjs` with new CLI sub-commands for the mechanical layer (discovery, batching, execution, state I/O), add a workflow orchestrator that handles all reasoning (categorization, action dispatch, loop control), and integrate with existing patterns (activity sidecar, quick tasks, resume-work routing). The only new external dependency is `fast-glob@3.3.3`, bundled via the existing esbuild build step.

The recommended stack is pure Node.js built-ins plus `fast-glob`. `node:sqlite` (Node >= 22.5.0) is the correct state persistence mechanism at 20k+ test scale; plain JSON is the fallback for older Node. The AI categorization loop uses a 5-category taxonomy (valid-skip, stale/adapt, isolation-issue, real-bug, fixture-improvement) with quorum workers dispatched via the same parallel Task pattern used in `/qgsd:debug`. Fixes for adapt/fixture/isolate categories are dispatched as `/qgsd:quick` tasks grouped by similarity — never one task per failing test. Real bugs are deferred to the user, never auto-fixed.

The three critical risks are: (1) framework discovery cross-contamination in monorepos (always use framework CLIs, never independent globbing), (2) the QGSD circuit breaker triggering mid-loop on legitimate iterative commits (disable at maintain-tests start, re-enable at end), and (3) the AI categorization loop never converging due to missing termination conditions (implement a `deferred` 6th category, a progress guard, and a hard iteration cap). These risks must be addressed in the design phase, not retrofitted.

## Key Findings

### Recommended Stack

The maintain-tests command is built entirely from Node.js built-ins and one bundled external dependency. `child_process.spawnSync` handles all test runner invocations — the existing pattern in `qgsd-circuit-breaker.js` for git operations applies directly. `node:sqlite` (built-in, Node >= 22.5.0, stability 1.1) replaces a JSON state file at 20k+ test scale; write amplification of JSON flat files becomes a real bottleneck over many iterations. `fast-glob@3.3.3` is needed only when no framework config is present; bundle it via esbuild to eliminate runtime node_modules resolution issues in the global install path.

**Core technologies:**
- `node:sqlite` (built-in, Node >= 22.5.0): persistent batch state across sessions — avoids write amplification of JSON at 20k+ tests
- `child_process.spawnSync` and `child_process.spawn`: test runner execution (jest/playwright/pytest) — already the established QGSD pattern; use spawn with file-based output capture for variable-size test reports to avoid buffer limits
- `fast-glob@3.3.3` (bundled via esbuild): fallback test file discovery when framework configs are absent — only external dependency
- `node:fs` / `node:path`: state file I/O, path resolution — QGSD standard throughout
- Claude Code Task workers (parallel spawns): failure categorization using quorum models — no new library needed
- JSON flat file: fallback state for Node < 22.5.0 — functional but 10-30x slower on writes

Critical avoidances: `p-limit` is ESM-only and will throw `ERR_REQUIRE_ESM` in QGSD's CommonJS codebase. `better-sqlite3` requires a native `node-gyp` compile and breaks the zero-dependency install model. Jest's `runCLI()` programmatic API has broken silently across every major version since v25 — always use the stable CLI contract (`npx jest --json`). Buffering large test runner output in memory (using APIs with default maxBuffer limits) causes silent truncation on high-failure batches — always pipe output to a temp file.

### Expected Features

The 8 P1 table-stakes features are the minimum viable loop. Everything else is additive.

**Must have (table stakes — v0.3 launch):**
- Test discovery (auto-detect jest/playwright/pytest from config files; framework CLI output is canonical, never independent globbing)
- Random batching at 100 tests/batch with batch manifest written to disk before execution (Fisher-Yates shuffle, deterministic seed for resumability)
- Batch execution per framework with output captured to temp file (not in-memory buffering) and configurable timeout (default 5 minutes per batch)
- AI categorization into 5 categories (valid-skip, stale/adapt, isolation-issue, real-bug, fixture-improvement) with 1-sentence diagnosis and action item per failure
- State persistence and resume via `maintain-tests-state.json` + activity sidecar integration
- Iterative loop with explicit termination: progress guard (no decrease in 2 iterations = halt), iteration cap (default 5), `deferred` 6th category for convergence
- Progress banner after each batch completion (user feedback is mandatory for 20k+ suites)
- SUMMARY.md artifact on completion or interruption

**Should have (v0.3.x — after core loop validates on a real 20k suite):**
- Git history context for stale/adapt classification (`git log -S` pickaxe evidence embedded in categorization prompt)
- Isolation re-run verification (re-run isolation-issue candidates in single-test mode to distinguish from real bugs)
- Configurable batch size/timeout via `.claude/qgsd.json` `maintain_tests` key
- Cross-batch pattern detection (surface recurring root causes after every 5 batches)

**Defer to v0.4+:**
- Quorum on valid-skip/real-bug categorizations (adds latency; validate category reliability first)
- Categorization confidence scores (need enough categorizations to evaluate false positive rate)
- Multiple framework priority ordering for polyglot suites

**Anti-features to reject:**
- Auto-fix all tests without review (miscategorizing real-bug as stale/adapt hides regressions)
- Running all 20k tests in one batch (Jest OOM without batching — workers restart under `workerIdleMemoryLimit`)
- Storing full test output in state file (20k suite produces gigabytes; store only first 500 chars of error per test)
- Retrying failed tests before categorization (retry evidence IS the flakiness signal — do not eliminate it before categorization)

### Architecture Approach

The maintain-tests integration adds exactly 2 new files (command stub + workflow orchestrator) and extends 4 existing files (gsd-tools.cjs, install.js, resume-work.md, .gitignore). No hooks are changed. No new agents are added. The command is NOT added to `quorum_commands` — it is an execution command per CLAUDE.md R2.2.

The architectural split is thin CLI + reasoning workflow: `gsd-tools.cjs` owns all mechanical operations (discover, batch, run-batch, save-state, load-state); the workflow orchestrator owns all reasoning (categorization, action dispatch, loop control, quick task grouping). This mirrors how every existing QGSD workflow uses `gsd-tools.cjs` for context gathering while Claude handles coordination.

**Major components:**
1. `commands/qgsd/maintain-tests.md` (NEW) — slash command stub; routes to workflow via `execution_context`
2. `workflows/maintain-tests.md` (NEW) — full orchestrator: discovery loop, batch iteration, categorization worker dispatch, action grouping, real bug deferral, session state management
3. `gsd-tools.cjs maintain-tests` sub-commands (MODIFIED: additive) — discover, batch, run-batch, save-state, load-state; thin wrappers around filesystem and spawnSync operations
4. `maintain-tests-state.json` (NEW, gitignored) — SQLite or JSON fallback; stores per-test state, batch progress, categorization results, actioned quick task references
5. Categorization workers (inline Task dispatches, NOT new agents) — parallel Gemini/OpenCode/Copilot/Codex calls using same quorum dispatch pattern as `/qgsd:debug`
6. `/qgsd:quick` (EXISTING, unmodified) — receives grouped fix tasks for adapt/fixture/isolate categories; cap 20 tests per task

Build order is strictly: Phase 18 CLI foundation → Phase 19 state schema + activity tracking → Phase 20 workflow orchestrator → Phase 21 categorization engine → Phase 22 integration test.

### Critical Pitfalls

1. **Framework cross-discovery collision in monorepos** — A `.spec.ts` file owned by Playwright is also discovered by Jest's `testMatch` glob, inflating counts and producing 100% batch failure rates. Avoid by always using framework CLI output (`jest --listTests`, `npx playwright test --list`, `pytest --collect-only`) as the canonical source of truth. Never independently glob for test files. This is a Phase 18 design decision that cannot be retrofitted.

2. **Circuit breaker fires mid-maintenance loop** — After 3+ quick-task commits on the same test file, the QGSD circuit breaker's oscillation detector fires and blocks all Bash write operations. This is legitimate iterative work, not oscillation. Avoid by calling `npx qgsd --disable-breaker` at maintain-tests start and `npx qgsd --enable-breaker` at end. Also group fixes by file set so one commit covers multiple tests rather than N commits per test.

3. **AI categorization loop never converges** — Without explicit termination conditions, the loop runs forever on unfixable tests. Avoid by implementing: (a) a progress guard that halts if unresolved count does not decrease in 2 consecutive iterations, (b) a hard iteration cap (default 5), (c) a `deferred` 6th category that counts as "actioned" for convergence purposes. Design termination conditions in the loop spec before implementation begins.

4. **AI categorization hallucinations without source context** — Claude receives a stack trace and produces a confident but wrong root cause. The proposed fix task finds nothing to change. Avoid by always including the failing test's full source code AND the top-2 stack trace source files in every categorization prompt. Add a `context_score` field and only auto-action categorizations with score >= 2.

5. **Stdout buffer overflow on large test runner output** — Node.js subprocess APIs with default maxBuffer limits (1MB) are insufficient for Jest's JSON reporter output at 100 tests/batch. When the buffer is exceeded, the child process is killed and the error may be swallowed, causing AI categorization to receive empty output. Avoid by using `spawn()` with output piped to a temp file, read after the child's `close` event. This is a Phase 18 batch execution design decision.

6. **Flaky tests classified as real bugs exhaust the loop** — A flaky test's stack trace is indistinguishable from a real bug's on a single run. Avoid by running each failing test 3 times in isolation before categorization: fails 3/3 = consistent; fails 1-2/3 = pre-classify flaky; passes 3/3 = environment noise, drop from queue.

## Implications for Roadmap

Based on research, suggested phase structure for Phases 18-22 (continuing from v0.2 Phase 17):

### Phase 18: CLI Foundation

**Rationale:** The gsd-tools.cjs sub-commands are mechanically testable before any workflow logic exists. Unit testing discover/batch/run-batch catches runner detection bugs early — including the framework cross-discovery collision and stdout buffer overflow pitfalls — before they block workflow development. No workflow dependency; this phase is independent of all others.

**Delivers:** `gsd-tools.cjs maintain-tests` with 5 sub-commands (discover, batch, run-batch, save-state, load-state). Runner auto-detection for jest/playwright/pytest. Per-framework output capture to temp files via spawn with stream piping (not buffered subprocess APIs). Unit tests for all sub-commands including monorepo fixture tests for framework collision and per-package invocation.

**Addresses:** Test discovery, random batching, batch execution (FEATURES.md P1)

**Avoids:** Framework cross-discovery collision (Pitfall 1) — framework CLIs are the implementation from the start. Stdout buffer overflow (Pitfall 4) — spawn with file-based output is baked in. pytest conftest ancestor collision (Pitfall 3) — per-package invocation is the pattern.

### Phase 19: State Schema and Activity Tracking Integration

**Rationale:** The workflow needs a stable state schema and activity sidecar hooks before the orchestrator is written. Getting the schema wrong after the workflow is built requires a rewrite. The resume-work.md routing table must be extended before the workflow relies on it for interrupt recovery. Termination condition fields (iteration_count, last_unresolved_count) belong in the schema, not added as an afterthought in Phase 21.

**Delivers:** `maintain-tests-state.json` schema definition (SQLite primary, JSON fallback for Node < 22.5.0). `.gitignore` addition. Six new sub_activity values and routing table rows in `resume-work.md`. Node version compatibility check at startup. Termination state fields in schema (iteration_count, last_unresolved_count, deferred_tests[]).

**Addresses:** State persistence and resume (FEATURES.md P1), progress tracking (FEATURES.md P1)

**Avoids:** Loop never terminates (Pitfall 7) — iteration cap and progress guard are schema-enforced from the start.

### Phase 20: Workflow Orchestrator

**Rationale:** The workflow shell (command stub + orchestration logic) must exist before categorization is added. Building the orchestrator without categorization allows the full batch loop to be validated end-to-end with placeholder categories before the high-risk categorization engine is wired in. The circuit breaker lifecycle and Stop hook exclusion are verified here before any fix commits are generated.

**Delivers:** `commands/qgsd/maintain-tests.md` (slash command stub). `workflows/maintain-tests.md` (full orchestrator: discovery call, batch loop, activity-set transitions, placeholder categorization, action dispatch skeleton, real bug deferral surface format, session SUMMARY.md). Installer addition (WORKFLOWS_TO_COPY). Explicit verification that maintain-tests is NOT in quorum_commands.

**Addresses:** Iterative loop (FEATURES.md P1), progress banner (FEATURES.md P1), SUMMARY.md artifact (FEATURES.md P1)

**Avoids:** maintain-tests added to quorum_commands (Pitfall 12) — verified at design time. Circuit breaker fires mid-loop (Pitfall 10) — `--disable-breaker`/`--enable-breaker` lifecycle is in the command wrapper from the start.

### Phase 21: Categorization Engine

**Rationale:** Categorization is the highest-risk phase — quorum worker prompt design for 5+1 category classification is novel, and consensus rate is unknown. Isolating it in its own phase means prompt failures do not block the workflow structure. Prompt design should be validated with few-shot examples before wiring into the loop. This phase also incorporates the flakiness pre-check, source context payload design, and sub-batching — all of which interact with categorization quality.

**Delivers:** Quorum worker prompt for 5-category + `deferred` 6th category classification. Consensus aggregation logic (3+ workers agree = consensus; disagreement = Claude tiebreaker). Context payload design (test source + top-2 stack trace sources + failure_history field). Sub-batching at max 10 failures per Claude call. Flakiness pre-check (3-run isolation before AI categorization). Category-grouped quick task dispatch (group by category + error type + directory; cap 20 tests per quick task).

**Addresses:** AI categorization (FEATURES.md P1, highest complexity), isolation re-run verification (FEATURES.md P2), git history context for stale/adapt (FEATURES.md P2)

**Avoids:** AI categorization hallucinations (Pitfall 6) — source context is mandatory. Loop never converges (Pitfall 7) — deferred category and termination conditions are already in schema from Phase 19. Flaky tests misclassified as real bugs (Pitfall 5) — 3-run isolation check gates categorization. Context window overflow (Pitfall 11) — sub-batching at max 10 failures per call.

**Research flag:** NEEDED. Quorum worker classification prompts for 5-category test failure categorization are novel. Phase-specific research should verify: (a) whether few-shot examples are required for reliable classification at the quorum models' capability level, (b) expected consensus rate and how to handle persistent disagreement, (c) whether 5 categories is the right granularity or whether a coarser taxonomy would achieve higher consensus rates with acceptable precision loss.

### Phase 22: Integration Test and Verification

**Rationale:** End-to-end validation requires all prior phases. A real failing test suite (QGSD's own test suite or a fixture project with controllable failures) is needed to validate that the full loop converges, the circuit breaker lifecycle works, state persists across interruption, and the Stop hook does not fire erroneously.

**Delivers:** End-to-end test covering all 10 items in the PITFALLS.md "Looks Done But Isn't" checklist: discovery deduplication, buffer overflow handling, circuit breaker lifecycle, shallow clone detection, flakiness pre-check, categorization sub-batching, loop termination on unfixable tests, Stop hook exclusion, pytest rootdir isolation, convergence state persistence. VERIFICATION.md for Phases 18-21. Updated installer.

**Addresses:** All integration gotchas in PITFALLS.md integration table.

### Phase Ordering Rationale

- Phase 18 before 19: CLI commands inform the state schema design. Building schema before understanding what data the CLI produces inverts the dependency.
- Phase 19 before 20: Workflow relies on stable state schema and resume routing. Schema changes after workflow is written cause a workflow rewrite.
- Phase 20 before 21: Categorization is a feature of the workflow, not a standalone component. The workflow shell must be validated before the most complex logic is added.
- Phase 21 is isolated: Prompt design for novel classification is high-risk and benefits from being the sole focus of a phase. Prompt failures here do not affect the workflow shell built in Phase 20.
- Phase 22 last: Integration testing requires all components functional. The "Looks Done But Isn't" checklist in PITFALLS.md has 10 verification scenarios that require the full stack.

### Research Flags

Phases needing deeper research during planning:
- **Phase 21 (Categorization Engine):** Quorum worker prompt design for 5+1 category classification is novel. Research should verify: (a) whether few-shot examples are required for reliable classification, (b) expected consensus rate and how to handle persistent disagreement, (c) whether 5 categories is the right granularity or whether a coarser 3-category taxonomy would achieve higher consensus rates with acceptable precision loss. This is the only HIGH research-risk phase.

Phases with standard patterns (skip research-phase):
- **Phase 18 (CLI Foundation):** All patterns established in existing `gsd-tools.cjs` and `qgsd-circuit-breaker.js`. spawnSync, fs, path — no novel APIs.
- **Phase 19 (State Schema):** Schema design is mechanical. SQLite built-in API is documented. Activity sidecar pattern is already used in execute-phase.
- **Phase 20 (Workflow Orchestrator):** Follows identical structure to existing QGSD workflows (plan-phase.md, execute-phase.md). The slash command + execution_context pattern is established.
- **Phase 22 (Integration Test):** Standard verification phase. Test scenarios are fully defined in PITFALLS.md "Looks Done But Isn't" checklist.

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | All library choices verified against official docs and npm. CommonJS constraint confirmed from package.json. node:sqlite version requirement and stability level confirmed from Node.js docs. p-limit ESM incompatibility confirmed from GitHub issue thread. esbuild bundling confirmed from existing build-hooks.js. |
| Features | HIGH (table stakes) / LOW (5-category taxonomy) | Jest/playwright/pytest API behavior verified against official docs and GitHub issues at scale. The 5-category taxonomy is QGSD-defined — it maps to industry patterns (Parasoft, Google) but is not an industry standard. Taxonomy reliability in practice against real suites is unvalidated. |
| Architecture | HIGH | Integration points derived from direct source reads of gsd-tools.cjs, execute-phase.md, debug.md, quick.md, config-loader.js, qgsd-circuit-breaker.js, STATE.md. No novel APIs involved. Phase numbering (18+) confirmed against STATE.md. |
| Pitfalls | HIGH (technical) / MEDIUM (AI behavior) | Framework cross-discovery, buffer overflow, circuit breaker collision, and shallow clone issues are confirmed from official docs and GitHub issue threads with reproduction cases. AI categorization hallucination rate and quorum consensus rate predictions are based on general LLM research patterns, not QGSD-specific measurement. |

**Overall confidence:** HIGH for implementation approach; MEDIUM for AI categorization reliability at scale.

### Gaps to Address

- **5-category taxonomy validation:** The QGSD-defined categories have not been tested against a real 20k suite. Categories may need refinement after Phase 22 end-to-end testing. Treat Phase 22 as a hypothesis-validation pass, not just a QA pass. Budget for a post-Phase-22 taxonomy adjustment iteration.

- **Quorum consensus rate for test failure classification:** Unknown what percentage of test failures will reach quorum consensus on first categorization attempt. If the rate is low (< 60%), the categorization loop will be slower than expected due to Claude tiebreaker invocations. Design the workflow with a per-test categorization timeout and a fallback to Claude-only categorization to prevent stalls.

- **Performance at 20k+ scale:** Discovery time (30-120 seconds) and total loop time (8-48 hours) estimates are based on documented framework behavior and scale analysis, not empirical measurement. Phase 22 should benchmark discovery and batch execution time against a realistic fixture to validate these estimates before the tool ships.

- **pytest output format edge cases:** `pytest --collect-only -q` line parsing works for standard test IDs but may fail for parametrized tests with complex parameter strings (brackets, special characters). Validate pytest parsing in Phase 18 unit tests with parametrized test fixtures specifically.

## Sources

### Primary (HIGH confidence)

- `/Users/jonathanborduas/code/QGSD/hooks/qgsd-circuit-breaker.js` — CommonJS require() pattern, spawnSync for git, fs.readFileSync/writeFileSync for state; integration blueprint for maintain-tests CLI
- `/Users/jonathanborduas/code/QGSD/package.json` — no `"type":"module"` (CommonJS confirmed), esbuild@^0.24.0 devDep, engines.node >= 16.7.0
- `/Users/jonathanborduas/code/QGSD/.planning/PROJECT.md` — v0.3 target features and constraints (authoritative scope)
- `/Users/jonathanborduas/code/QGSD/.planning/STATE.md` — phase numbering (last phase = 17), key decisions table
- `/Users/jonathanborduas/.claude/qgsd/bin/gsd-tools.cjs` — existing sub-command interface, activity-set pattern, compound init commands
- `/Users/jonathanborduas/.claude/qgsd/workflows/execute-phase.md` — activity-set usage across step transitions; checkpoint:verify pattern
- `https://nodejs.org/docs/latest/api/sqlite.html` — node:sqlite stability (1.1), version (>= 22.5.0, no flag from v22.13.0), DatabaseSync API
- `https://nodejs.org/api/child_process.html` — spawnSync API, spawn streaming API, maxBuffer behavior with buffered subprocess calls
- `https://jestjs.io/docs/cli` — --json flag, --outputFile, --testPathPattern, --listTests, workerIdleMemoryLimit behavior
- `https://playwright.dev/docs/test-reporters` — JSON reporter, --list flag, --shard deterministic splitting
- `https://jestjs.io/docs/configuration` — rootDir, projects, testMatch behavior in monorepos
- `https://docs.pytest.org/en/stable/explanation/pythonpath.html` — conftest.py ancestor traversal and import collision
- `https://docs.pytest.org/en/stable/reference/customize.html` — rootdir detection, per-package invocation required
- `https://git-scm.com/docs/git-log` — pickaxe (-S), --encoding=UTF-8, --is-shallow-repository

### Secondary (MEDIUM confidence)

- `https://github.com/mrmlnc/fast-glob/releases` — version 3.3.3 current stable, zero transitive deps, MIT license
- `https://github.com/pytest-dev/pytest/issues/9704` — collect-only output is not machine-readable JSON; line parsing is the correct approach
- `https://github.com/jestjs/jest/issues/13792` (and #15216, #7311) — workerIdleMemoryLimit behavior, OOM at large scale confirmed
- `https://github.com/sindresorhus/p-limit/issues/63` — p-limit v6+ ESM-only; incompatible with CommonJS
- `https://www.parasoft.com/blog/ml-powered-test-failure-analysis/` — industry failure taxonomy (Bug/Regression, Flaky, Unstable Environment, Bad Data, Outliers)
- `https://testing.googleblog.com/2016/05/flaky-tests-at-google-and-how-we.html` — async timing (46%), order dependency as top flakiness root causes
- `https://dl.acm.org/doi/fullHtml/10.1145/3476105` — ACM survey of flaky test root causes; confirms QGSD taxonomy maps to research categories
- `https://playwright.dev/docs/best-practices` — testDir configuration, Playwright test file ownership patterns in monorepos
- `https://devops.aibit.im/article/git-shallow-clones-guide` — shallow clone detection strategy; consistent with git-scm docs
- `https://redis.io/blog/context-window-overflow/` — context window overflow practical patterns; informs 10-failure sub-batch limit

### Tertiary (LOW confidence)

- `https://www.browserstack.com/guide/playwright-flaky-tests` — Playwright-specific flaky test patterns (community guide, not official)
- `https://johal.in/forked-python-parallel-pytest-plugin-subprocess-testing-isolation-2025/` — 20k test suite pytest isolation case study (2025); validates per-package invocation approach
- `https://demiliani.com/2025/11/02/understanding-llm-performance-degradation-a-deep-dive-into-context-window-limits/` — LLM context window degradation research; informs categorization sub-batching design
- `https://www.getmaxim.ai/articles/multi-agent-system-reliability-failure-patterns-root-causes-and-production-validation-strategies/` — multi-agent reliability failure modes; informs quorum consensus rate gap assessment

---
*Research completed: 2026-02-22*
*Ready for roadmap: yes*
