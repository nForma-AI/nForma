# Feature Research

**Domain:** Test suite maintenance / triage tool — Claude Code plugin command (`/qgsd:maintain-tests`)
**Researched:** 2026-02-22
**Confidence:** HIGH for test framework APIs and taxonomy; MEDIUM for scale patterns; LOW for the 5-category taxonomy (project-defined, not an industry standard)

---

## Context: What Is Already Built

This is a SUBSEQUENT MILESTONE. The following QGSD features are DONE and must not be re-scoped:

- Quorum enforcement hooks (UserPromptSubmit + Stop)
- Circuit breaker (PreToolUse oscillation detection)
- Activity sidecar (current-activity.json)
- Quorum scoreboard
- `/qgsd:quick` → planner → executor pipeline
- Debug/diagnosis agent pattern (`diagnose-issues.md`)

The features below are ONLY for the new `/qgsd:maintain-tests` command in v0.3.

---

## Feature Landscape

### Table Stakes (Users Expect These)

Features that must exist for the command to feel functional. Missing any of these = the tool is not usable for its stated purpose.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Test discovery across jest, playwright, pytest | Core premise of the tool — must know what tests exist before doing anything | MEDIUM | Each framework has a different discovery mechanism. Jest: `npx jest --listTests` gives file list; `npx jest --collect-only --json` gives test names. Playwright: `npx playwright test --list` outputs test titles and file paths. Pytest: `pytest --collect-only -q` gives node IDs. Each requires its own shell invocation and output parser. Discovery must be auto-detected (find `jest.config.*`, `playwright.config.*`, `pytest.ini`/`pyproject.toml`/`setup.cfg`) — the user should not specify framework. |
| Random batching into groups of 100 | Prevents memory exhaustion and context overflow on 20k+ suites; makes progress visible and recoverable | LOW | Shuffle discovered test IDs using Fisher-Yates then chunk into arrays of `batch_size` (default 100, configurable). Randomness ensures coverage sampling — sequential ordering risks never reaching tests in later files if iteration halts. Write batch manifest to disk before execution so restart is possible mid-suite. |
| Execute each batch and capture output | Tests must actually run to surface failures | MEDIUM | Per-framework invocation: Jest uses `--testPathPattern` + `--testNamePattern` or node IDs; Playwright uses `--grep` or explicit test file + title arguments; pytest accepts node IDs directly as positional args. Capture stdout+stderr per batch. Set a timeout per batch (default: 5 minutes for 100 tests). Store raw output to disk per batch for later AI categorization. |
| AI-driven failure categorization into 5 categories | The core value of the tool — turning raw failures into actionable decisions | HIGH | 5 categories defined by project spec: (1) **valid-skip** — test covers a use case that no longer applies (feature removed or deprecated); (2) **stale/adapt** — test expectation is wrong due to code evolution, needs updating via git history analysis; (3) **isolation-issue** — test fails due to shared state, ordering dependency, or missing cleanup (passes in isolation); (4) **real-bug** — test is correct and exposes a genuine regression in production code; (5) **fixture-improvement** — test infrastructure (setup/teardown, mocks, test data) needs repair to be reliable. Note: this 5-category taxonomy is QGSD-defined, not an industry standard. Parasoft DTP uses: Bug/Regression, Flaky, Unstable Environment, Bad Data, Outliers. Google's research identifies: async timing (46% of flaky), order dependency, environment. The QGSD taxonomy maps to industry categories but uses domain-specific names. |
| Per-failure categorization output with action | User needs to know what to do with each test — not just a label | MEDIUM | For each failure, the AI must produce: category label, 1-2 sentence diagnosis, and a specific action item (e.g., "delete test — validates X which was removed in commit abc1234", "update assertion at line 42 to reflect new return shape", "add `afterEach(() => jest.clearAllMocks())` to isolate from suite", "open bug report for failing null check in UserService.login", "replace hardcoded fixture with factory function"). |
| Iterative improvement loop until all tests classified | The tool must continue until the job is done, not just run once | HIGH | Loop structure: discover → batch → execute → categorize → action → re-execute unresolved batch → repeat. The loop continues while any test remains in state `unresolved` or `real-bug` (real bugs may stay as bugs; others should reach resolution). Loop termination: all tests reach a terminal state (skipped, adapted, passing, or filed-as-bug). Loop uses QGSD's existing `/qgsd:quick` and debug pattern. Circuit breaker must not fire on batch-execute repetition (different file sets each batch). |
| Progress tracking across batches | 20k+ test suites take hours — the user must know where they are | LOW | Write a manifest file (`.planning/maintain-tests/state.json`) tracking: total discovered, batches total, batches completed, per-test state (unresolved/categorized/actioned). Display progress banner at each batch completion: `Batch 3/47 complete — 287/4700 tests processed, 12 failures found`. |
| Persist state for resume | A 20k suite won't finish in one session | MEDIUM | Integrate with the existing activity sidecar pattern (`.planning/current-activity.json`). Write batch manifest before execution so a restart picks up where it left off. State file records which batches have been processed and which test IDs have been categorized. On resume, skip already-processed batches. |

---

### Differentiators (Competitive Advantage)

Features that make `/qgsd:maintain-tests` better than running test frameworks manually and reading output. Aligned with QGSD's core value of AI-driven decision-making with multi-model verification.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Git history context for stale/adapt classification | The most defensible evidence for why a test needs updating is the commit that changed the production code it tests. `git log -S <symbol>` (pickaxe search) finds the commit that removed or changed the code under test. | MEDIUM | When a test fails and the category looks like `stale/adapt`, run `git log --oneline -S <extracted_symbol>` on the function/class being tested. Include the top matching commit message in the AI categorization prompt as evidence. This converts "this test seems stale" into "this test was testing X which was removed in commit abc1234 (message: 'remove legacy UserV1 API')". HIGH confidence the git pickaxe approach works — verified via git-scm docs. |
| Isolation verification via single-test re-run | Distinguishes isolation-issue from real-bug: if the test passes when run alone but fails in a batch, it's isolation. If it fails alone, it's a real bug. | MEDIUM | For any test categorized as `isolation-issue`, automatically re-run it in isolation (single test, no other tests in the same process) and record the result. If it passes in isolation, confirm isolation-issue. If it still fails, recategorize as `real-bug`. This verification step eliminates the most common miscategorization. |
| Quorum on categorization decisions | Uses QGSD's existing quorum pattern to verify AI categorization before action, preventing automated misclassification at scale | HIGH | Apply quorum specifically on ambiguous categorizations or high-stakes categories (real-bug, valid-skip). `valid-skip` means deleting a test — that's destructive and warrants multi-model consensus. `real-bug` means filing an issue. Both benefit from quorum. `isolation-issue` and `fixture-improvement` are lower stakes and can proceed without quorum. Integrates with existing `qgsd-quorum-orchestrator` agent. |
| Configurable batch size and timeout | Different CI environments have different resource constraints | LOW | `batch_size` (default 100), `batch_timeout_ms` (default 300000 = 5 minutes), configurable via `.claude/qgsd.json` project config under a `maintain_tests` key. Follows existing two-layer config system. |
| Categorization confidence scores | Lets the user see which classifications are certain vs. ambiguous without reading all the AI rationale | LOW | AI returns `confidence: high/medium/low` with each categorization. Low-confidence items are surfaced in a dedicated review section at the end. User can override or re-run with additional context. |
| Cross-batch pattern detection | If the same root cause (e.g., a specific broken mock, a deleted API) appears across many batches, identifying it once and applying the fix across all affected tests is far more efficient than per-test fixes | HIGH | After N batches (configurable, default 5), analyze the accumulated categorizations for patterns: same error message appearing across multiple tests, same file implicated, same category dominating. Surface as "Pattern detected: 23 tests failing with `TypeError: Cannot read property 'user' of undefined` — likely single root cause in auth mock setup." Then propose a single `/qgsd:quick` fix task that addresses the root cause. |
| Actionable SUMMARY.md per session | Consistent with QGSD's artifact pattern — every command produces a summary | LOW | After each full pass, write `.planning/maintain-tests/SESSION-{n}-SUMMARY.md` with: tests processed, categories breakdown, actions taken, remaining, time taken. Committed to git. |

---

### Anti-Features (Commonly Requested, Often Problematic)

| Anti-Feature | Why Requested | Why Problematic | Alternative |
|--------------|---------------|-----------------|-------------|
| Auto-fix all tests without review | "Just fix everything automatically" | Automated fixes to production-touching tests are high-risk. A misclassification of `stale/adapt` that should be `real-bug` causes an automated test deletion that hides a real regression. This is the worst possible outcome — the tool would actively suppress bugs. | Show the proposed fix and require user confirmation for destructive actions (delete, skip). Non-destructive actions (add mock cleanup, update assertion) can auto-apply but must produce a git commit with a reversible diff. |
| Run all 20k tests in one batch | "Get results faster" | Jest with 20k tests loaded simultaneously will OOM. Jest itself warns about `workerIdleMemoryLimit` — workers restart when memory exceeds the limit, causing partial output and unreliable results. Playwright with 20k tests in one invocation saturates workers. | Fixed batch size (100) with configurable override. 100 is chosen to fit in ~2-3 worker contexts without memory exhaustion. |
| Always run tests in parallel across all workers | "Maximize speed" | Parallel execution causes false isolation-issue categorizations — a test that fails due to worker-level state sharing looks like an isolation issue but is actually deterministic when run serially. The categorization becomes unreliable. | Run each batch with `--maxWorkers 2` (or pytest's `-n 2`) to balance speed and isolation detection reliability. Single-worker re-run for isolation verification. |
| Store all test output in memory | "Keep it simple" | A 20k suite produces gigabytes of stdout/stderr. Storing in memory means OOM before categorization begins. | Write raw output to disk per batch under `.planning/maintain-tests/batches/batch-{n}-output.txt`. Read batch output on demand for categorization. |
| Global test runner config mutation | "Configure Jest to output JSON for easier parsing" | Mutating jest.config.js or playwright.config.ts in the user's project is a destructive side-effect of running a maintenance tool. If the config change causes issues, it's not obvious the maintenance tool caused it. | Use CLI flags (`--json`, `--reporter json`) to control output format at invocation time without touching project config files. |
| Retry failed tests automatically before categorization | "Eliminate transient flakiness before we even categorize" | Auto-retry before categorization hides flakiness evidence. If a test passes on retry, the isolation-issue or environment category is lost. The retry is precisely the evidence needed for classification. | Record retry behavior as part of the categorization input: "failed on run 1, passed on run 2 = flaky indicator". Let AI use retry evidence in categorization, not eliminate it. |
| Integrate with external CI/reporting services | "Send results to Jira, Datadog, etc." | External integrations add dependencies, auth secrets, and configuration complexity that are orthogonal to the maintenance goal. Launchable and Parasoft DTP address this use case with full platforms. | QGSD produces actionable local artifacts (SUMMARY.md, state.json, per-batch output). Users can pipe these to external tools if needed. QGSD stays focused on the local maintenance loop. |

---

## Feature Dependencies

```
Test discovery (framework auto-detection)
    └──required by──> Batch manifest creation
                          └──required by──> Batch execution
                                                └──required by──> AI categorization
                                                                      └──required by──> Action application
                                                                      └──required by──> State update

State persistence (state.json + activity sidecar)
    └──required by──> Resume capability
    └──required by──> Cross-batch pattern detection

Git history context
    └──enhances──> AI categorization (stale/adapt category)
    └──requires──> git available in working directory

Isolation re-run verification
    └──enhances──> AI categorization (isolation-issue vs real-bug)
    └──requires──> Batch execution (must already know how to run a single test)

Quorum on categorization
    └──enhances──> valid-skip and real-bug actions
    └──requires──> Existing qgsd-quorum-orchestrator agent (already built)
    └──requires──> AI categorization (input to quorum)

Cross-batch pattern detection
    └──requires──> State persistence (needs accumulated categorizations)
    └──requires──> Multiple completed batches

Configurable batch size/timeout
    └──enhances──> Batch execution
    └──requires──> Existing two-layer config system (already built)

Progress tracking
    └──enhances──> State persistence
    └──requires──> Batch manifest (needs total count)

SUMMARY.md artifact
    └──requires──> Completed categorizations
    └──integrates with──> Existing QGSD artifact pattern (STATE.md, quick SUMMARY.md)
```

### Dependency Notes

- **Discovery requires framework auto-detection:** The user should not have to specify `--framework jest`. The tool reads the project root for `jest.config.*`, `playwright.config.*`, `pytest.ini`, `pyproject.toml`. If multiple frameworks exist, it discovers all and merges the test lists before batching. If no framework config is found, it fails with a clear error.

- **Batch execution depends on discovery output format:** Jest discovery returns file paths (`npx jest --listTests`). Playwright discovery returns "test title > file" pairs. Pytest discovery returns node IDs (`path/test_file.py::TestClass::test_method`). Each format requires different execution invocation. The batch manifest stores test IDs in framework-native format so execution re-uses them directly.

- **Isolation re-run conflicts with speed:** Verifying every isolation-issue candidate doubles execution time for that category. Accept this — the isolation-issue category is the most important to get right (a real bug misclassified as isolation-issue is a missed regression). Speed is not the constraint; correctness is.

- **Quorum integration must not create deadlock:** If all quorum models are UNAVAILABLE, fail-open per R6. Do not block the maintenance loop waiting for quorum. Record "quorum unavailable — proceeding with Claude categorization only" in the SUMMARY.md.

- **State persistence integrates with activity sidecar:** On start, set `activity: "maintain-tests"` in `.planning/current-activity.json`. On completion, call `activity-clear`. On resume, the activity sidecar tells `/qgsd:resume-work` that a maintenance session was interrupted.

---

## MVP Definition

### Launch With (v0.3 — this milestone)

Minimum viable product — what's needed to validate that the core loop works on a real project.

- [ ] **Test discovery** — auto-detect jest/playwright/pytest from config files; output unified list of test IDs in framework-native format
- [ ] **Random batching** — shuffle and chunk into groups of 100; write batch manifest to `.planning/maintain-tests/manifest.json`
- [ ] **Batch execution** — run each batch with per-framework CLI invocation; capture output to disk; respect batch timeout
- [ ] **AI categorization** — for each failure, produce category (5-category taxonomy) + 1-sentence diagnosis + action item
- [ ] **State persistence** — write per-test state to `state.json`; integrate with activity sidecar for resume
- [ ] **Iterative loop** — continue until all tests reach terminal state (categorized + actioned); loop cap of N iterations (configurable, default 3 passes) to prevent runaway
- [ ] **Progress banner** — display batch N/total after each completion
- [ ] **SUMMARY.md** — write session summary artifact on completion or interruption
- [ ] **Git integration** — commit state.json and SUMMARY.md changes after each pass

### Add After Validation (v0.3.x — if loop proves useful on real suites)

Features to add once the core loop has run on at least one real 20k suite.

- [ ] **Git history context for stale/adapt** — add `git log -S` evidence to categorization prompt; trigger: categorization is producing too many stale/adapt without clear evidence
- [ ] **Isolation re-run verification** — auto re-run isolation-issue candidates in single-test mode; trigger: too many real bugs being misclassified as isolation issues
- [ ] **Configurable batch size/timeout** — via `.claude/qgsd.json` `maintain_tests` key; trigger: first user with a different CI constraint
- [ ] **Cross-batch pattern detection** — surface recurring root causes after every 5 batches; trigger: users reporting repetitive per-test fixes for same underlying issue

### Future Consideration (v0.4+)

Features to defer until the command has real users.

- [ ] **Quorum on valid-skip/real-bug categorizations** — apply existing quorum orchestrator to high-stakes decisions; defer because quorum adds latency and the v0.3 loop must first prove it produces reliable categories
- [ ] **Categorization confidence scores** — low-confidence review section; defer until enough categorizations exist to evaluate false positive rate
- [ ] **Multiple framework discovery with priority ordering** — if a project has both pytest and jest, choose which to run first; defer until a user with polyglot test suites reports confusion

---

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority |
|---------|------------|---------------------|----------|
| Test discovery (jest/playwright/pytest auto-detect) | HIGH | MEDIUM | P1 |
| Random batching (100/batch, manifest to disk) | HIGH | LOW | P1 |
| Batch execution with timeout | HIGH | MEDIUM | P1 |
| AI categorization (5 categories + action) | HIGH | HIGH | P1 |
| State persistence + resume | HIGH | MEDIUM | P1 — 20k suite won't finish in one session |
| Iterative loop until terminal state | HIGH | MEDIUM | P1 |
| Progress banner | MEDIUM | LOW | P1 — without this, 20k suite feels dead |
| SUMMARY.md artifact | MEDIUM | LOW | P1 — aligns with QGSD artifact pattern |
| Git history for stale/adapt | HIGH | MEDIUM | P2 — significantly improves categorization quality |
| Isolation re-run verification | HIGH | MEDIUM | P2 — reduces most dangerous miscategorization |
| Configurable batch size/timeout | MEDIUM | LOW | P2 |
| Cross-batch pattern detection | HIGH | HIGH | P2 — transforms per-test work into single-fix work |
| Quorum on valid-skip/real-bug | MEDIUM | LOW | P3 — requires working quorum, adds latency |
| Categorization confidence scores | LOW | LOW | P3 |

**Priority key:**
- P1: Must have for v0.3 launch — the command fails its stated purpose without it
- P2: Should have, add when possible — improves classification quality significantly
- P3: Nice to have, future consideration

---

## Industry Comparison: What Similar Tools Do

| Feature | Parasoft DTP | Launchable (CloudBees Smart Tests) | Google's internal approach | QGSD maintain-tests approach |
|---------|--------------|-------------------------------------|---------------------------|-------------------------------|
| Failure categories | Bug/Regression, Flaky, Unstable Environment, Bad Data, Outliers | ML-based: historical failure pattern matching | Async timing, order dependency, env issues | valid-skip, stale/adapt, isolation-issue, real-bug, fixture-improvement |
| Scale mechanism | ML model trained on labeled instances | ML on commit history + code change correlation | Statistical retry analysis | Random batching (100/batch), disk-persisted state |
| Action output | Routes to Jira automatically | Prioritized test list per commit | Quarantine flaky tests | Per-test action item + iterative fix loop |
| Git history use | Not documented | Code change → test correlation | Not documented | git pickaxe for stale/adapt classification |
| Human review gate | Label instances for ML training | Autonomous | Not documented | Quorum on valid-skip and real-bug |
| Integration model | SaaS platform, CI plugin | SaaS, CI plugin, Jira integration | Internal tooling | Local CLI command, git artifacts |

**Key insight:** Industry tools (Parasoft, Launchable) are SaaS platforms optimized for ongoing CI integration and historical learning. QGSD maintain-tests is a one-time or periodic triage tool optimized for bringing a neglected or inherited test suite back to health. Different use case — not direct competition.

---

## Scale Considerations (20k+ Tests)

These are not optional for a suite of this size.

| Concern | At 1k tests | At 10k tests | At 20k+ tests |
|---------|-------------|--------------|----------------|
| Discovery time | < 5 seconds | 10-30 seconds | 30-120 seconds (pytest is slower than jest --listTests) |
| Memory during execution | Negligible | Jest workers restart with workerIdleMemoryLimit | Jest OOM without batching — must use ≤ 100/batch or --maxWorkers 2 |
| AI categorization context window | 1 batch fits easily | 1 batch fits easily | Multiple batches must NOT be accumulated in memory — categorize per-batch, persist, discard output |
| Total loop time | < 1 hour | 2-8 hours | 8-48 hours across sessions — resume is mandatory |
| State file size | < 1MB | ~5MB | ~20-100MB — JSON is fine, avoid storing raw test output in state |
| Batch manifest | Simple array | Simple array | Simple array — O(n) by test count, not by batch count |

**Critical scale constraint (HIGH confidence):** Jest with 20k tests cannot run in a single invocation without memory issues. The `workerIdleMemoryLimit` config exists precisely because of this problem — workers are restarted when they exceed the limit. Batching to 100 tests per invocation prevents this entirely. Source: Jest docs + multiple GitHub issues (#13792, #15216, #7311).

**Pytest output parsing (MEDIUM confidence):** `pytest --collect-only -q` output is not machine-readable by default (GitHub issue #9704 tracking this since 2021). Use `pytest --collect-only --quiet` and strip the summary line (`| head -n -2`) or use the `pytest-collect-formatter` plugin for JSON output. Node IDs from `--collect-only` output can be passed directly as positional arguments to `pytest` for subset execution.

**Playwright test listing (HIGH confidence):** `npx playwright test --list` outputs test titles and file paths in a readable format. JSON reporter (`--reporter json`) produces machine-readable output during test runs. The `--shard` option splits tests deterministically — useful if QGSD needs to parallelize across multiple Claude sessions in the future.

---

## Integration with Existing QGSD Patterns

The following QGSD patterns must be reused, not reimplemented.

| QGSD Pattern | How maintain-tests Uses It |
|---|---|
| `/qgsd:quick` planner → executor | Each actionable fix (add mock cleanup, update assertion) is a quick task — planner creates the fix plan, executor applies it |
| Debug agent (`diagnose-issues.md`) | Per-failure diagnosis for complex failures can spawn debug agents; for batch failures, the AI categorization replaces debug agents (diagnose at categorization time) |
| Activity sidecar (current-activity.json) | Set on start, cleared on completion, read by resume-work for interrupt recovery |
| Two-layer config (qgsd.json) | `maintain_tests.batch_size`, `maintain_tests.batch_timeout_ms` keys under existing config structure |
| Quorum orchestrator | Applied to valid-skip and real-bug categorizations (P2 feature) |
| gsd-tools.cjs commit | All state and summary artifacts committed via existing commit helper |
| STATE.md update | Add a "Test Maintenance Sessions" section tracking session dates and summary paths |

---

## Sources

- [Jest CLI Options (official)](https://jestjs.io/docs/cli) — HIGH confidence. Verified: `--listTests`, `--json`, `--maxWorkers`, `workerIdleMemoryLimit`.
- [Pytest documentation — collection](https://docs.pytest.org/en/stable/how-to/usage.html) — HIGH confidence. Verified: `--collect-only`, node ID format, positional arguments for subset execution.
- [Playwright CLI documentation (official)](https://playwright.dev/docs/test-cli) — HIGH confidence. Verified: `--list` flag, `--reporter json`, `--shard` option.
- [Playwright Sharding docs (official)](https://playwright.dev/docs/test-sharding) — HIGH confidence. Verified: deterministic shard splitting, blob report merging.
- [Parasoft DTP ML-powered failure analysis](https://www.parasoft.com/blog/ml-powered-test-failure-analysis/) — MEDIUM confidence. Verified: categories (Bug/Regression, Flaky, Unstable Environment, Bad Data, Outliers), ML training requirements.
- [Google Testing Blog — Flaky Tests at Google](https://testing.googleblog.com/2016/05/flaky-tests-at-google-and-how-we.html) — HIGH confidence. Verified: async timing (46%), order dependency as top flakiness causes.
- [ACM Survey of Flaky Tests](https://dl.acm.org/doi/fullHtml/10.1145/3476105) — HIGH confidence. Verified: systematic taxonomy of flakiness root causes including order dependency, resource handling, environment.
- [pytest issue #9704 — collect-only not machine readable](https://github.com/pytest-dev/pytest/issues/9704) — HIGH confidence. Verified: output format limitation confirmed.
- [Jest memory issues — GitHub #13792, #15216, #7311](https://github.com/jestjs/jest/issues/13792) — HIGH confidence. Verified: workerIdleMemoryLimit behavior with large suites.
- [git-scm pickaxe documentation](https://git-scm.com/docs/git-log) — HIGH confidence. Verified: `git log -S` finds commits that added or removed a given string.
- [Launchable / CloudBees Smart Tests](https://www.cloudbees.com/capabilities/cloudbees-smart-tests) — MEDIUM confidence. Capabilities inferred from search results; main page redirected.
- `/Users/jonathanborduas/code/QGSD/.planning/PROJECT.md` — PRIMARY SOURCE. Defines v0.3 target features and constraints.
- `/Users/jonathanborduas/code/QGSD/get-shit-done/workflows/quick.md` — PRIMARY SOURCE. Defines existing planner/executor/quorum pattern that maintain-tests integrates with.
- `/Users/jonathanborduas/code/QGSD/get-shit-done/workflows/diagnose-issues.md` — PRIMARY SOURCE. Defines debug agent pattern reusable for per-failure investigation.

---

*Feature research for: QGSD v0.3 — `/qgsd:maintain-tests` test suite maintenance command*
*Researched: 2026-02-22*
