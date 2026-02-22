# Pitfalls Research

**Domain:** AI-driven test suite maintenance tool added to an existing Claude Code plugin (QGSD v0.3)
**Researched:** 2026-02-22
**Confidence:** HIGH (confirmed via official docs + GitHub issues + community reports + QGSD codebase analysis)

---

## Critical Pitfalls

### Pitfall 1: Test Discovery Counts Diverge Between Frameworks in the Same Repo

**What goes wrong:**

When a monorepo contains jest, playwright, and pytest tests, a naive discovery pass double-counts or misses files. The specific failure mode: a `*.spec.ts` file in a Next.js app is discovered by both Jest (via `testMatch: **/*.spec.ts`) and Playwright (via `**/*.@(spec|test).?(c|m)[jt]s?(x)`). The tool reports 22,000 tests found; 4,000 of them are duplicates that belong to Playwright and get counted again under Jest. When batching is based on the inflated count, batches contain wrong tests for the wrong runner, and those runs produce 100% failure rates that look like real bugs.

**Why it happens:**

Each framework has its own discovery glob. Jest's `testMatch` and `testRegex` are configured per-project; Playwright's `testDir` and Playwright-for-Python's `pytestmark` patterns are separate. A tool that runs its own discovery scan outside the framework config cannot know which framework owns which file — unless it reads the framework config first. Developers assume file suffix is sufficient to distinguish frameworks; it is not when both frameworks use `.spec.ts`.

**How to avoid:**

Discovery must be config-driven, not suffix-driven. For each framework:
- **Jest**: Run `jest --listTests --json` using the project's existing `jest.config.js` — never glob independently. In monorepos, run once per package that has its own `jest.config.js`.
- **Playwright**: Run `npx playwright test --list` to get the authoritative file list. Do not glob for `.spec.ts` files directly.
- **pytest**: Run `pytest --collect-only -q` with the project's `pytest.ini` or `pyproject.toml` rootdir in scope.

Use framework CLI output as the canonical source of truth. Never independently glob to discover tests — the framework's own config is the source of truth for what it owns.

**Warning signs:**

- Batch failure rate is 100% across an entire batch (not a realistic distribution)
- Same file path appears in multiple framework discovery results
- `jest --listTests` count differs from a grep count of `*.test.ts` files
- Discovery tool runs faster than expected — frameworks skip some files the tool found

**Phase to address:** Phase 1 (Test Discovery). Discovery must be implemented through framework CLIs, not file system globbing. This is a design decision that cannot be retrofitted.

---

### Pitfall 2: Jest Monorepo rootDir Resolution Breaks Discovery at Scale

**What goes wrong:**

In a monorepo with 20k+ tests, a root-level `jest.config.js` uses `projects: ['<rootDir>/packages/*']`. When the discovery tool invokes `jest --listTests` from the project root, Jest resolves `<rootDir>` to the current working directory. If the tool is invoked from a subdirectory (e.g., a package inside the monorepo), `<rootDir>` resolves differently, and `jest --listTests` returns 0 tests — or worse, crashes with "No tests found" without a non-zero exit code. The tool interprets 0 as success and proceeds with empty batches, creating spurious "all tests pass" reporting.

**Why it happens:**

Jest's rootDir resolution is invocation-directory-sensitive. The `<rootDir>` token resolves relative to the config file location in Jest 29+, but the CWD of the jest process determines where relative paths in the config are resolved. In monorepos with nested configs, there is a second failure mode: each package has its own `jest.config.js`, and those nested configs have `rootDir: '../../'` pointing to the monorepo root. Running `jest --listTests` in the nested package finds only that package's tests; running from the root finds all packages via `projects:`. The tool must know which invocation mode to use.

**How to avoid:**

For each jest project, always pass `--rootDir` explicitly and always invoke from the directory that contains the config file. Before discovery:
1. Walk upward from each candidate config file to find the effective rootDir.
2. Invoke `jest --listTests --config=<absolute-path-to-config>` with `cwd` set to the directory containing that config.
3. Treat empty results as a failure requiring investigation, never as "zero tests found" success.

Add a post-discovery sanity check: if discovered count is more than 20% below the previous run's count, emit a warning before proceeding.

**Warning signs:**

- `jest --listTests` returns 0 when executed from a package subdirectory
- Discovery count varies depending on which directory the tool was invoked from
- `No tests found, exiting with code 1` in Jest output but the tool's exit code handling swallows it
- Different runs produce different test counts without any test files being added or deleted

**Phase to address:** Phase 1 (Test Discovery). The cwd/rootDir invariant must be established during initial discovery design and tested with a real monorepo fixture.

---

### Pitfall 3: pytest conftest.py Ancestor Traversal Causes Import Collisions

**What goes wrong:**

pytest crawls upward from the test file to collect all `conftest.py` files in ancestor directories. In a monorepo with two separate Python services — `/services/auth/` and `/services/billing/` — each with their own `conftest.py`, running `pytest services/` from the root causes pytest to load both conftest files into the same import namespace. If both conftest files define a fixture named `db_client`, pytest raises `ValueError: duplicate fixture` and discovery fails entirely. With 20k+ tests, this failure silently aborts collection for affected packages, making the tool undercount tests without a clear error.

**Why it happens:**

pytest's `rootdir` detection walks upward from the specified path until it finds a `pyproject.toml`, `setup.cfg`, `pytest.ini`, or `tox.ini`. In a monorepo, this lands at the repo root. From that root, pytest discovers all conftest.py files in all subdirectories during collection. The ancestor traversal that makes fixtures "just work" inside a single project becomes a collision source across multiple independent projects.

**How to avoid:**

Invoke pytest per-package, never from the monorepo root. For each package directory that contains a `pytest.ini` or `pyproject.toml` with `[tool.pytest.ini_options]`:
1. Invoke `pytest --collect-only -q --rootdir=<package-dir>` with `cwd` set to that package directory.
2. Use `--ignore` flags to exclude sibling packages from collection.
3. For packages without their own pytest config, add a minimal `pytest.ini` with `testpaths = tests` before running discovery.

Do not rely on the pytest rootdir auto-detection when invoking from above the package root.

**Warning signs:**

- `ImportPathMismatchError` or `ValueError: duplicate fixture` in pytest output
- Discovery aborts for some packages but not others
- Running `pytest path/to/package/` from inside the package succeeds, but from the monorepo root it fails
- Two packages share a fixture name (check by grepping for duplicate fixture definitions)

**Phase to address:** Phase 1 (Test Discovery). Per-package pytest invocation must be the implementation pattern from the start.

---

### Pitfall 4: Child Process stdout Truncation Silently Drops Test Output

**What goes wrong:**

The batch executor spawns test runners as child processes. Using Node.js's `exec()` or `execFile()` (which buffer all output in memory) with a 20k test suite produces test output that can easily exceed `maxBuffer` default of 1MB. When maxBuffer is exceeded, Node.js kills the child process and emits a `maxBuffer exceeded` error. If the executor does not handle this error explicitly, it propagates as an uncaught exception, which the executor treats as if the batch completed successfully with empty stdout. AI categorization then receives empty output and hallucinates all failures as "test framework did not run."

**Why it happens:**

Node.js `exec()`/`execFile()` default `maxBuffer: 1 * 1024 * 1024` (1MB) was designed for small command output, not test suite JSON reports. Jest with `--json` reporter produces `{"testResults": [...]}` output that grows linearly with the number of tests. At 100 tests per batch with verbose output, a single batch's stdout can be 2-5MB. The error is easy to miss because `child_process` fires the `'error'` event rather than rejecting, and many developers only listen for `'close'`.

**How to avoid:**

Use `spawn()` with stream event handlers instead of `exec()`/`execFile()`. Pipe test runner output to a temp file:

```text
const outPath = path.join(os.tmpdir(), 'qgsd-batch-' + batchId + '.json');
spawn the runner with stdio: ['ignore', outFd, 'pipe']
read outPath after child close
```

This avoids maxBuffer entirely. The streaming/file approach is more robust for variable-size output than increasing maxBuffer. Read the temp file after the child process emits its `'close'` event.

**Warning signs:**

- AI categorization input is empty or contains only partial JSON (malformed)
- `Error: maxBuffer exceeded` anywhere in executor stderr
- Batch shows 0 failures even though tests are known to be broken
- Output from `jest --json` is truncated mid-object (starts with `{` but has no closing `}`)

**Phase to address:** Phase 2 (Batch Execution). Output collection method must be decided before writing the batch executor — switching from buffered to streaming mid-implementation causes a test rewrite.

---

### Pitfall 5: Flaky Tests Classified as Real Bugs Exhaust the Debug Loop

**What goes wrong:**

The `/qgsd:maintain-tests` debug loop runs a batch, sends failures to Claude for categorization, Claude assigns "real bug" to flaky tests (tests that fail intermittently due to timing, network, or shared state), the loop spawns a `/qgsd:quick` to fix the "bug," the fix makes no difference, the test fails again in the next run, and the loop classifies it as "real bug" again. This cycles indefinitely. The convergence criterion "all tests classified and actioned" is never met because the flaky test keeps re-entering the "real bug" queue.

**Why it happens:**

Claude's categorization is based on a single failure report: the stack trace plus the test code. A flaky test's stack trace is indistinguishable from a real bug's stack trace on any single failure. Without multi-run history, there is no evidence of intermittency. The AI receives a snapshot, not a trend, and correctly classifies the snapshot as "the test failed" — it simply lacks the context to distinguish one-time from intermittent.

**How to avoid:**

Before sending failures to AI categorization, re-run each failing test in isolation at least 3 times. Track the pass/fail pattern:
- Fails 3/3: send to categorization with `failure_pattern: consistent`
- Fails 1-2/3: pre-classify as `flaky`, mark for isolation category, skip AI categorization
- Passes 3/3: the original failure was environment noise; drop from the queue

Implement a flaky test registry in the batch run state. Tests already classified as flaky in a previous iteration should not re-enter the categorization loop.

Add `failure_history` to the context sent to Claude: "This test failed in 2 of the last 3 isolated runs." This single piece of evidence significantly reduces misclassification.

**Warning signs:**

- Same test appears in "real bug" queue across multiple loop iterations
- Fixes spawned by the loop produce no code changes but tests still fail
- Batch failure rate stays constant across iterations (convergence not occurring)
- Tests in CI environments fail more often than in local runs (environment-sensitive flakiness)

**Phase to address:** Phase 2 (Batch Execution) for the multi-run isolation mechanism; Phase 3 (AI Categorization) for the flaky context injection.

---

### Pitfall 6: AI Categorization Produces Hallucinated Root Causes Without Source Access

**What goes wrong:**

Claude receives: test name, failure message, stack trace. It correctly identifies that `TypeError: Cannot read property 'userId' of undefined` suggests a null dereference. It then produces a specific, confident root cause: "The `getUser()` function in `auth/user-service.ts` is returning null when the session token is expired. Fix: add a null check before calling `.userId`." This is plausible but wrong — the actual failure is a missing test fixture that should have populated the user object. The `/qgsd:quick` task runs, adds a null check, the test still fails (now for a different reason), and the loop has done net negative work.

**Why it happens:**

Claude is performing root cause inference from symptoms, not from reading the source. Without seeing the actual source file, it generates the most statistically likely explanation for the error pattern. This is different from deliberate hallucination — it is confident inference on incomplete evidence. The model does not flag uncertainty when stack traces fit well-known patterns, because the pattern match is genuinely high-confidence; it is the mapping from pattern to specific code that is wrong.

**How to avoid:**

Always provide Claude with the actual source of the failing test AND the source of the implementation under test. The minimum context payload for AI categorization must include:
1. Full stack trace with file paths resolved to actual content
2. The failing test's source code (the full `it()` / `test()` / `def test_` block)
3. The top-2 source files referenced in the stack trace (read them, embed them)
4. Any test fixtures or setup hooks invoked by the test

A categorization without source context must be treated as LOW confidence and not trigger automatic action. Add a `context_score: 0-3` field to categorization output and only spawn `/qgsd:quick` tasks for categorizations where `context_score >= 2`.

**Warning signs:**

- Categorization output references specific function names or line numbers not in the stack trace
- The proposed fix is in a different file than the stack trace points to
- Claude says "the issue is in X.ts" but the stack trace shows a different file
- Fix tasks produce no diff (Claude found nothing wrong where it looked)

**Phase to address:** Phase 3 (AI Categorization). Context payload design must be a first-class requirement, not added after categorization is wired up.

---

### Pitfall 7: Categorization Loop Never Converges — Missing Termination Conditions

**What goes wrong:**

The iterative debug->quick->debug loop is designed to run "until all tests are classified and actioned." Without explicit termination conditions, the loop runs forever: some tests cannot be fixed in a single session (require upstream dependency updates, require infrastructure changes, require human decision), but the convergence check only looks at whether they are classified. Since they remain "real bug" and no fix lands, the loop re-queues them on every iteration.

A secondary failure mode: the loop makes progress (classifying 90% of tests) but stalls on the last 10%, burning through the context window iterating over the same unfixable tests. Claude Code's context is finite; a stalled loop eventually hits the context limit, the session terminates, and no state is persisted.

**Why it happens:**

"Iterate until done" loops require an explicit definition of "done" that covers stuck states. Developers define the happy path ("done = all classified") but miss the unhappy path ("done = maximum iterations reached, or no progress for N consecutive iterations").

**How to avoid:**

Define explicit termination conditions before implementing the loop:
1. **Progress guard**: If the number of unresolved tests did not decrease in the last 2 iterations, halt and report. Do not continue a loop that is not making progress.
2. **Iteration cap**: Hard cap at a configurable number of iterations (default: 5). After the cap, emit a "maintenance report" with the current state and stop.
3. **Deferral category**: Add a 6th category to the 5-category taxonomy: `deferred` — test requires human decision or out-of-scope change. Tests in `deferred` count as "actioned" for convergence purposes.
4. **State persistence**: After each iteration, write the current classification state to a file (e.g., `.planning/maintain-tests-state.json`). If the session is interrupted, the next run reads the state and resumes from where it stopped.

**Warning signs:**

- Same tests appear in the queue across 3+ consecutive iterations
- Loop iteration count keeps incrementing with no classification changes
- Context window is being consumed rapidly with no output commits
- Claude reports "still working on the same failures" in consecutive summaries

**Phase to address:** Phase 3 (AI Categorization) and Phase 4 (Iterative Loop). Termination conditions must be designed in the loop spec before implementation begins.

---

### Pitfall 8: Git Shallow Clone Breaks git log Integration

**What goes wrong:**

The tool's git history integration reads commit messages to identify which tests were recently modified (for prioritizing batches) and to detect when a failure was introduced. In CI environments and GitHub Codespaces, the repository is frequently a shallow clone (the default `--depth=1` in GitHub Actions). `git log -- path/to/test.ts` on a shallow clone returns only the most recent commit if that commit touched the file; it returns nothing if the file was last modified before the shallow cutoff. The tool interprets empty `git log` output as "this test was never modified" and assigns lowest priority to it — the opposite of what a freshly-broken test deserves.

**Why it happens:**

Shallow clones are the CI default for speed. `git log` on a shallow clone does not warn that the history is truncated — it simply returns whatever commits are available. There is no flag that distinguishes "file not in any commit" from "file not in any commit within the shallow window." Automated tooling that does not check for shallow clone status silently operates on incomplete data.

**How to avoid:**

At initialization, check for shallow clone status using `git rev-parse --is-shallow-repository`. If the repository is shallow:
1. Deepen the clone before relying on git history: `git fetch --deepen=50` (or `--unshallow` if time budget allows).
2. If deepening is not possible (read-only CI), disable git history integration and fall back to alphabetical or random batching. Document the degradation in the run report.
3. Never treat empty `git log` output as conclusive evidence that a file was not recently modified.

**Warning signs:**

- `git log -- tests/foo.test.ts` returns nothing for tests that clearly exist
- `git rev-parse --is-shallow-repository` returns `true`
- The tool always prioritizes the same tests (those in the initial shallow commit)
- Running the tool locally produces different batch ordering than in CI

**Phase to address:** Phase 4 (Git History Integration). Shallow clone detection must be the first operation in the git integration module.

---

### Pitfall 9: Commit Message Parsing Fails on Non-ASCII Characters

**What goes wrong:**

The tool parses `git log --oneline` to extract test-relevant commit messages. In repositories with international team members, commit messages may contain UTF-8 characters, emoji, or CJK characters. If git's `i18n.commitEncoding` is set to a non-UTF-8 encoding (e.g., `ISO-8859-1`), `git log` outputs bytes in that encoding, and the Node.js UTF-8 decoder silently replaces invalid byte sequences with the Unicode replacement character. Regex patterns matching test file names in commit messages then fail to match because the message contains garbage characters around the path.

**Why it happens:**

Git's commit encoding is per-commit, stored in the commit object header. The `git log` command tries to recode output to the configured `i18n.logOutputEncoding`, defaulting to UTF-8, but only if the commit encoding header is present and recognized. Old commits without encoding headers or commits from legacy systems are output as raw bytes. This is rare but happens in repositories with long histories or multi-origin merges.

**How to avoid:**

Always pass `--encoding=UTF-8` to `git log` invocations. This forces git to recode to UTF-8. For commits where recoding fails, git falls back to raw bytes, which the tool should detect (presence of `\ufffd`) and skip rather than attempt to parse.

Use `%x00` as a field separator in `--format` strings instead of spaces. Delimiter-based parsing is robust to arbitrary message content, including multi-byte characters.

**Warning signs:**

- Commit messages contain replacement characters in unexpected positions
- Regex matching commit messages fails for some commits but not others
- Tool works in repos created by the team but fails in forks or upstream clones
- `git log` output differs when run interactively vs. via spawnSync

**Phase to address:** Phase 4 (Git History Integration). Encoding flags must be in the initial spawnSync calls, not added when encoding bugs are reported.

---

### Pitfall 10: The maintain-tests Command Triggers the QGSD Circuit Breaker

**What goes wrong:**

The `/qgsd:maintain-tests` iterative loop runs multiple `/qgsd:quick` fix tasks. Each quick task produces a commit. After 3+ quick tasks touching the same test file, the circuit breaker's oscillation detection fires: it sees the same file set appearing in 3 alternating commit groups and activates. The circuit breaker blocks all Bash write operations, halting the test maintenance loop mid-iteration. The user is told to enter Oscillation Resolution Mode (R5) for a situation that is not oscillation — it is legitimate iterative test improvement.

**Why it happens:**

The circuit breaker's run-collapse algorithm collapses consecutive commits on the same file set into run-groups and fires when a file set appears in 3+ alternating groups. A test maintenance workflow that applies successive fixes to the same test file naturally produces this pattern: fix attempt 1, verify, fix attempt 2, verify, fix attempt 3 — three alternating groups on the same file set. The Haiku reviewer (`consultHaiku()`) is the circuit breaker's safeguard against this, but if Haiku is unavailable (no `ANTHROPIC_API_KEY` in the hook environment) or classifies the pattern as GENUINE, the breaker fires.

**How to avoid:**

Two mitigations, both required:

1. **Disable the circuit breaker during maintain-tests runs.** At the start of `/qgsd:maintain-tests`, call `npx qgsd --disable-breaker`. At the end (or on interrupt), call `npx qgsd --enable-breaker`. This is the documented escape hatch for "deliberate iterative work."

2. **Batch fixes by file set.** Instead of one quick task per failing test, group all fixes for the same file into a single quick task. This produces one commit per file set instead of N commits, preventing alternating groups from forming.

Do not attempt to tune the oscillation_depth config to avoid this — increasing the depth makes the circuit breaker less sensitive system-wide, degrading its protection for actual oscillation.

**Warning signs:**

- Circuit breaker activates shortly after the first few quick-task commits
- `circuit-breaker-state.json` is written with a file set that contains test files
- The maintain-tests loop stalls with "CIRCUIT BREAKER ACTIVE" in hook output
- The Haiku reviewer is unavailable (no ANTHROPIC_API_KEY or quota exceeded)

**Phase to address:** Phase 2 (Batch Execution) when the quick task integration is designed. The `--disable-breaker` / `--enable-breaker` lifecycle must be part of the maintain-tests command wrapper, not an afterthought.

---

### Pitfall 11: AI Categorization Context Window Overflow on Large Batch Reports

**What goes wrong:**

A batch of 100 tests runs and 40 fail. The executor collects all 40 failure reports (stack trace + test source + implementation source = ~5-15KB per failure) and sends them in a single categorization prompt. For 40 failures at 10KB average, the prompt is 400KB+ of text. Either the prompt is silently truncated by the SDK, or the API returns a 400 error. In the truncation case, the last N failures in the prompt receive no categorization, and the tool emits empty categories for them — which the convergence check treats as "categorized" (category = empty string), causing the loop to terminate with unclassified tests.

**Why it happens:**

Developers design the categorization payload for the average case (10-15 failures per 100 tests, 3-5KB each = 30-75KB, well within context). The edge case — a regression that breaks 60-80% of a batch — produces payloads that exceed practical context limits. The SDK may truncate or return an API error that the executor treats as a transient failure and retries with the same oversized payload.

**How to avoid:**

Categorize failures in sub-batches of maximum 10 failures per Claude call. For each sub-batch:
1. Send failures sequentially with a consistent prompt structure.
2. Merge categorization results before proceeding.

Set a hard limit on context per categorization call: if the constructed prompt exceeds 100KB, split it further. Track token usage via the `usage` field in the API response and log it for monitoring.

Never wait for all batch failures before starting categorization — pipeline them: as soon as each test failure arrives from the batch runner, add it to a categorization queue and process in sub-batches of 10.

**Warning signs:**

- Categorization API calls take longer than 60 seconds (large payload processing)
- Some failures in a batch have empty or null categories
- Claude returns "I notice you've provided many test failures — I'll focus on the first N"
- API 400 errors or context length errors in executor logs

**Phase to address:** Phase 3 (AI Categorization). Sub-batch sizing must be a first-class design parameter, not an optimization applied after seeing failures.

---

### Pitfall 12: Adding /qgsd:maintain-tests Breaks the Stop Hook Quorum Gate

**What goes wrong:**

If `/qgsd:maintain-tests` is mistakenly added to the `quorum_commands` allowlist in `qgsd.json`, the Stop hook's `hasQuorumCommand()` matches it. But `maintain-tests` is an execution command — it discovers, runs, categorizes, and fixes tests. It is not a planning artifact command. The Stop hook fires at the end of the maintain-tests session, finds no MCP quorum tool calls (Claude ran jest, not Codex or Gemini), and blocks Claude from completing the session. The user is told to run quorum before completing a test maintenance run, which is nonsensical.

**Why it happens:**

`maintain-tests` sounds like a planning command by name but is execution by nature. The QGSD quorum enforcement architecture checks whether the current turn contains a planning command (GUARD 4 in `qgsd-stop.js`). The `hasArtifactCommit` GUARD 5 check catches cases where an artifact commit (e.g., a PLAN.md) is produced — but `maintain-tests` produces commits to test files, not planning artifacts, so GUARD 5 does not fire. The stop hook over-fires only if maintain-tests is in quorum_commands.

**How to avoid:**

Do NOT add `/qgsd:maintain-tests` to `quorum_commands`. It is an execution command. The stop hook's GUARD 4 correctly passes it through when it is not in the allowlist.

Instead, if maintain-tests involves a planning step (e.g., generating a maintenance plan before running), implement that step as a separate `/qgsd:plan-phase` invocation. The plan phase runs quorum; the maintain-tests execution runs without quorum enforcement. This maintains the clean planning/execution separation defined in CLAUDE.md R2.1.

Verify the decision by asking: does `maintain-tests` write a PLAN.md? If yes, split it. If no, do not add it to quorum_commands.

**Warning signs:**

- Stop hook blocks at the end of a test maintenance run
- Claude is asked to call Codex/Gemini before completing a test run report
- The quorum_commands list includes execution verbs (run, maintain, fix)

**Phase to address:** Phase 1 (Command Registration) when the `/qgsd:maintain-tests` command is added to the plugin. The quorum_commands decision is permanent once users have it in their config.

---

## Technical Debt Patterns

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| Glob for `*.test.ts` instead of running `jest --listTests` | Faster discovery, no framework dependency | Double-counts files owned by multiple frameworks; misses jest-configured exclusions | Never — always use framework CLI |
| Using `exec()` for batch runner output | Less code | Silently truncates output at maxBuffer (1MB default); corrupts JSON test reports | Never — use `spawn()` with file-based output |
| Single large Claude call for all failures | One API call per batch | Context overflow on high-failure batches; truncation produces silent classification gaps | Never at scale — max 10 failures per call |
| Run maintain-tests without disabling circuit breaker | No setup step required | Circuit breaker fires after 3 fix commits on same test file; halts loop | Never — always bracket with --disable-breaker |
| Add maintain-tests to quorum_commands | "Feels like a planning command" | Stop hook blocks execution sessions; user experience broken | Never — it is an execution command |
| Skip multi-run flakiness check | Faster iteration loop | Flaky tests classified as real bugs; fix tasks produce no diffs; loop stalls | Never — 3-run isolation check is required |
| Send stack trace without source to Claude | Simpler context assembly | Claude hallucinates root causes; fix tasks look in the wrong place | Never — minimum: test source + top-2 stack trace sources |

---

## Integration Gotchas

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| QGSD circuit breaker | Running maintain-tests without disabling the breaker | Call `npx qgsd --disable-breaker` at start of maintain-tests; `--enable-breaker` at end |
| QGSD Stop hook | Adding maintain-tests to quorum_commands | Keep maintain-tests out of quorum_commands; it is execution, not planning |
| Jest monorepo | Invoking `jest --listTests` from monorepo root without specifying config | Pass `--config=<absolute-path>` and set `cwd` to the config's directory |
| pytest monorepo | Running `pytest --collect-only` from repo root | Invoke per-package with `--rootdir=<package>` and `cwd` set to package directory |
| Playwright discovery | Globbing `**/*.spec.ts` to find Playwright tests | Run `npx playwright test --list` to get the canonical file list |
| Node.js child_process | Using `exec()` for test runner output | Use `spawn()` with output piped to a temp file to avoid maxBuffer |
| Git shallow clone | Using `git log` output without checking clone depth | Check `git rev-parse --is-shallow-repository` first; deepen or disable git integration if shallow |
| Claude API | Sending all batch failures in one categorization call | Sub-batch at max 10 failures per call; track token usage per call |

---

## Performance Traps

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| Synchronous test discovery across 20k+ tests | Discovery step takes 5-10 minutes; appears hung | Run framework CLIs in parallel (one per package); aggregate results | At 10+ packages each with 2k+ tests |
| Sequential batch execution (one batch at a time) | 20k tests in 100-test batches = 200 sequential runs; takes hours | Run 4-8 batches in parallel per CPU core; use process pools | At 5k+ tests when sequential takes >30 min |
| Reading all source files for categorization context | Context assembly per failure: 500ms for 3 file reads x 40 failures = 20s | Cache file reads per batch; a file read once should not be re-read for a second failure in the same batch | At 40+ failures per batch |
| Re-discovering tests on every loop iteration | Discovery re-runs every iteration; takes 2-5 min per run | Cache discovery results for the session; only re-discover when explicitly requested | After the first iteration — discovery should be once per maintain-tests invocation |
| Writing batch results to separate files per batch | 200 files created for 20k tests in 100-test batches | Write to a single state file with batch results appended; or use a single JSON array | When operating on 20k+ tests (200 batches x multiple iterations) |

---

## Security Mistakes

| Mistake | Risk | Prevention |
|---------|------|------------|
| Passing raw test failure output to Claude without sanitization | A malicious test failure message could contain prompt injection content | Wrap failure output in code fences before embedding in prompts; treat test output as untrusted user content |
| Storing API responses with test source code in temp files without cleanup | Test source in temp files could persist after the session ends, leaking code to shared filesystems | Use `os.tmpdir()` with unique session IDs; register cleanup handlers for SIGINT and SIGTERM; delete temp files on exit |
| Executing discovered test commands without validation | A malicious `jest.config.js` in a cloned repo could configure `testRunner` to run arbitrary code | Validate that test runner binaries exist in `node_modules/.bin` or are standard system binaries (`pytest`, `npx`); do not shell-execute arbitrary strings from config files |

---

## UX Pitfalls

| Pitfall | User Impact | Better Approach |
|---------|-------------|-----------------|
| No progress reporting during batch execution | User sees no output for minutes during a 200-batch run; appears hung | Emit progress: "Batch 47/200 complete — 12 failures found so far" after each batch |
| Reporting test counts before deduplication | User sees "22,000 tests found" but 4,000 are duplicates; later the count drops and user is confused | Report per-framework counts clearly: "Jest: 14,000, Playwright: 5,000, pytest: 3,000 — total: 22,000 (no overlap after dedup)" |
| Silently re-categorizing the same tests every iteration | User cannot tell the loop is making progress | Show a diff: "Iteration 3: 8 tests moved from real_bug to flaky, 3 tests newly classified" |
| No deferral category | Tests that require human action block convergence indefinitely | Implement the 6th category: `deferred`. Show deferred count explicitly: "Maintenance complete: 18,000 passing, 1,200 adapted, 400 skipped, 350 deferred (require human review)" |
| Emitting raw stack traces in the run report | Users see 50-line stack traces in their terminal | Truncate stack traces to first 5 lines in progress output; link to full output in a temp file |

---

## "Looks Done But Isn't" Checklist

- [ ] **Discovery deduplication:** Verify that files matching both `jest --listTests` and `playwright --list` are counted once per framework, not twice. Run with a repo that has `.spec.ts` files owned by Playwright and confirm they do not appear in Jest's list.
- [ ] **maxBuffer check:** Deliberately create a batch where all 100 tests fail with verbose output. Confirm that the output collection does not truncate and AI categorization receives all 100 failures.
- [ ] **Circuit breaker lifecycle:** Run 4 consecutive fix commits on the same test file. Confirm the circuit breaker does not activate (it was disabled at maintain-tests start) and activates correctly after `--enable-breaker` is called.
- [ ] **Shallow clone handling:** Clone the target repo with `--depth=1`, run maintain-tests, and confirm the tool detects the shallow clone and either deepens or disables git history integration with a clear warning.
- [ ] **Flakiness pre-check:** Add a test that fails 50% of the time. Run maintain-tests and confirm it is classified as `flaky`, not `real_bug`, and does not trigger a fix task.
- [ ] **Categorization sub-batching:** Construct a scenario with 50 failures in one batch. Confirm the tool makes multiple Claude API calls (max 10 failures each), not one call with 50 failures.
- [ ] **Loop termination:** Run maintain-tests on a repo with 10 unfixable tests (e.g., tests requiring external service). Confirm the loop terminates after the configured max iterations with a "deferred" classification, not indefinitely.
- [ ] **Stop hook exclusion:** Run `/qgsd:maintain-tests` and confirm the Stop hook does not fire at session end requesting quorum. Verify `maintain-tests` is not in quorum_commands.
- [ ] **pytest rootdir isolation:** Run discovery on a monorepo with two Python services that both have a `conftest.py` with a fixture named `session`. Confirm no `ValueError: duplicate fixture` error.
- [ ] **Convergence state persistence:** Interrupt a maintain-tests run mid-iteration. Restart and confirm it resumes from the saved state rather than starting over.

---

## Recovery Strategies

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| Discovery double-counting | MEDIUM | Re-run discovery with explicit framework flags; deduplicate by absolute file path; compare against known test count |
| maxBuffer truncation | LOW | Switch to spawn() with file-based output; re-run affected batch |
| Circuit breaker fires mid-loop | LOW | Run `npx qgsd --reset-breaker`; add `--disable-breaker` to maintain-tests start; re-run from saved state |
| AI categorization hallucinations | MEDIUM | Review fix diffs before applying; add source context to prompt; re-categorize with source included |
| Loop stuck on flaky tests | LOW | Add the flaky tests to a skip list manually; re-run; implement multi-run isolation check |
| Shallow clone breaks git integration | LOW | Run `git fetch --unshallow` or `git fetch --deepen=100`; re-run; or add `--skip-git-history` flag |
| Stop hook blocks maintain-tests | LOW | Remove maintain-tests from quorum_commands in qgsd.json; restart session |
| Context overflow in categorization | LOW | Implement sub-batching (max 10 failures per call); re-run the affected categorization step |
| pytest conftest collision | MEDIUM | Add per-package `pytest.ini` files with explicit `testpaths`; re-run discovery with per-package invocation |
| Loop never terminates | LOW | Add `max_iterations: 5` to maintain-tests config; set `deferred` as a valid convergence state |

---

## Pitfall-to-Phase Mapping

| Pitfall | Prevention Phase | Verification |
|---------|------------------|--------------|
| Framework cross-discovery collision | Phase 1 (Test Discovery) | Test: discover a repo with jest + playwright `.spec.ts` files; verify no duplicates |
| Jest rootDir resolution breaks at scale | Phase 1 (Test Discovery) | Test: invoke discovery from a package subdirectory; verify correct count |
| pytest conftest ancestor collision | Phase 1 (Test Discovery) | Test: two packages with same fixture name; verify no duplicate fixture error |
| maxBuffer truncation | Phase 2 (Batch Execution) | Test: 100-test batch all failing with verbose output; verify output collection completeness |
| Flaky tests classified as real bugs | Phase 2 (Batch Execution) + Phase 3 (AI Categorization) | Test: add a 50%-flaky test; verify it is classified as flaky after 3-run isolation |
| AI categorization hallucinations | Phase 3 (AI Categorization) | Test: categorize a failure with and without source context; verify fix targets correct file |
| Loop never converges | Phase 3 (AI Categorization) + Phase 4 (Loop Design) | Test: run maintain-tests on unfixable tests; verify loop terminates at max_iterations |
| Shallow clone breaks git integration | Phase 4 (Git History Integration) | Test: run on `--depth=1` clone; verify detection and fallback |
| Commit encoding failures | Phase 4 (Git History Integration) | Test: repo with non-ASCII commit messages; verify no replacement characters in parsed output |
| Circuit breaker fires mid-loop | Phase 2 (Batch Execution) | Test: run 4+ fix commits on same file; verify breaker disabled during maintain-tests |
| maintain-tests breaks Stop hook | Phase 1 (Command Registration) | Test: run maintain-tests end-to-end; verify Stop hook does not block |
| AI context overflow | Phase 3 (AI Categorization) | Test: batch with 50+ failures; verify multiple API calls, each max 10 failures |

---

## Sources

- [Jest Configuration — rootDir, projects, testMatch](https://jestjs.io/docs/configuration) — HIGH confidence (official docs, current)
- [Jest Monorepo Setup Guide (2026)](https://copyprogramming.com/howto/jest-projects-in-a-monorepo-unable-to-find-config-files-in-projects) — MEDIUM confidence (community guide, confirmed by official docs)
- [pytest import mechanisms and conftest.py](https://docs.pytest.org/en/stable/explanation/pythonpath.html) — HIGH confidence (official docs)
- [pytest configuration and rootdir](https://docs.pytest.org/en/stable/reference/customize.html) — HIGH confidence (official docs)
- [Resolving Jest and Playwright Test Conflicts](https://ray.run/discord-forum/threads/5978-jest-tests-clashing-with-playwright-tests) — MEDIUM confidence (community, confirmed by Playwright docs)
- [Playwright Best Practices — testDir](https://playwright.dev/docs/best-practices) — HIGH confidence (official docs)
- [Node.js child_process documentation](https://nodejs.org/api/child_process.html) — HIGH confidence (official Node.js docs)
- [Flaky tests — pytest documentation](https://docs.pytest.org/en/stable/explanation/flaky.html) — HIGH confidence (official docs)
- [Flaky Tests in Playwright (BrowserStack 2026)](https://www.browserstack.com/guide/playwright-flaky-tests) — MEDIUM confidence (community guide)
- [pytest subprocess isolation for large suites (case study)](https://johal.in/forked-python-parallel-pytest-plugin-subprocess-testing-isolation-2025/) — MEDIUM confidence (case study, 20k test suite, 2025)
- [LLM context window degradation research](https://demiliani.com/2025/11/02/understanding-llm-performance-degradation-a-deep-dive-into-context-window-limits/) — MEDIUM confidence (research report)
- [Context window overflow practical guide](https://redis.io/blog/context-window-overflow/) — MEDIUM confidence (community guide)
- [Multi-agent system reliability failure patterns](https://www.getmaxim.ai/articles/multi-agent-system-reliability-failure-patterns-root-causes-and-production-validation-strategies/) — MEDIUM confidence (industry report)
- [Git shallow clone pitfalls for automated tooling](https://devops.aibit.im/article/git-shallow-clones-guide) — MEDIUM confidence (community guide, consistent with git-scm docs)
- [Git log encoding documentation](https://git-scm.com/docs/git-log) — HIGH confidence (official git docs)
- [Claude Code background process hang issue #1481](https://github.com/anthropics/claude-code/issues/1481) — HIGH confidence (confirmed Claude Code issue)
- [Claude Code zombie process issue #10078](https://github.com/anthropics/claude-code/issues/10078) — HIGH confidence (confirmed Claude Code issue)
- [ML-powered test failure analysis](https://www.parasoft.com/blog/ml-powered-test-failure-analysis/) — MEDIUM confidence (vendor blog, consistent with general LLM research)
- QGSD codebase analysis: `hooks/qgsd-circuit-breaker.js`, `hooks/qgsd-stop.js`, `.planning/PROJECT.md`, `.planning/STATE.md` — HIGH confidence (direct source review)

---

*Pitfalls research for: AI-driven test suite maintenance tool (QGSD v0.3 /qgsd:maintain-tests command)*
*Researched: 2026-02-22*
