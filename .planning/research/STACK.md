# Stack Research

**Domain:** Test suite maintenance tool — Node.js CLI command within QGSD plugin
**Researched:** 2026-02-22
**Confidence:** HIGH — all library choices verified against official docs, npm current versions confirmed, Node.js built-in capabilities verified from v25.6.1 docs

---

## Scope

This STACK.md covers ONLY the new capabilities needed for v0.3 (`/qgsd:maintain-tests`). The existing QGSD stack (Claude Code hooks API, Node.js stdlib for hooks, esbuild for build, hook registration via settings.json) is already documented in the v0.1/v0.2 STACK.md and is not re-documented here.

**New capabilities required:**
1. Test file discovery (jest / playwright / pytest) across unknown project layouts
2. Batch execution (100 tests/batch, sequential)
3. Structured failure capture (machine-readable JSON output from each runner)
4. Persistent state across interrupted runs (20k+ test suites means multi-session)
5. AI categorization loop (Claude subagent reads failures, writes category decisions)
6. Git history integration (optional: determine when test last passed for context)

---

## Recommended Stack

### Core Technologies

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| Node.js `child_process.spawnSync` | built-in (Node >=16.7.0) | Execute jest/playwright/pytest as subprocesses | Already used in qgsd-circuit-breaker.js for git operations. Synchronous variant is correct for sequential batch execution — simpler control flow, exit code and stdout/stderr available immediately after the call returns. |
| Node.js `fs` | built-in | Read/write batch state file, read jest/playwright JSON output, write categorization log | The stdlib of record in every existing QGSD hook. No external library needed. |
| Node.js `path` | built-in | Resolve project root, construct runner command paths | Already the stdlib of record in all QGSD hooks. |
| Node.js `child_process.spawn` (async) | built-in | Execute long-running batches where stdout must stream | Use the async variant when a batch may produce >1MB stdout (e.g. 100 slow playwright tests). Pipe stdout/stderr to a temp file rather than buffering in memory to avoid pipe-buffer blocking. |

### Test Discovery

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `fast-glob` | 3.3.3 | Discover test files matching framework patterns (`**/*.test.{js,ts}`, `**/*.spec.{js,ts}`, `**/test_*.py`, `**/*_test.py`) across the project directory | Use when the project does NOT have a jest/playwright config to delegate discovery to. fast-glob handles negations, gitignore-style ignore patterns, and resolves symlinks. Version 3.3.3 is the current stable release (Jan 2025), MIT license, zero transitive dependencies in production use. |
| Jest `--testPathPattern` + `--json` | Jest built-in | When the project uses Jest: delegate discovery AND execution to Jest itself by passing a regex of test file paths for one batch, capture JSON output via `--json --outputFile` | Preferred over re-implementing discovery for Jest projects. Jest's project config (testMatch, testPathIgnorePatterns) is authoritative. |
| Playwright `--reporter=json` | Playwright built-in | When the project uses Playwright: pass explicit file list or a shard (`--shard=N/M`), capture structured JSON output | Preferred over re-implementing discovery for Playwright projects. |
| `pytest --collect-only -q --no-header` | pytest built-in | Discover pytest tests: spawn the command and parse each `path/to/test_file.py::test_name` line from stdout | Output is NOT JSON natively but is line-delimited and parseable. Filter lines matching `^[^\s].*::` to exclude the summary line. No extra library needed. |

**Discovery strategy:** Auto-detect which runner(s) the project uses by checking for presence of `jest.config.*`, `playwright.config.*`, or `pytest.ini` / `pyproject.toml` with `[tool.pytest.ini_options]`. Fall back to fast-glob pattern scan. This avoids re-implementing runner config logic.

### Failure Output Capture

| Format | Command flags | Key fields |
|--------|---------|-----------------|
| Jest JSON | `--json --outputFile=.qgsd-batch-result.json` | `testResults[].testResults[].failureMessages[]`, `testResults[].testResults[].status`, `testResults[].testResults[].fullName`, `testFilePath` |
| Playwright JSON | `--reporter=json` (capture stdout to temp file) | `suites[].specs[].tests[].results[].error.message`, `suites[].specs[].tests[].results[].status`, `suites[].file` |
| pytest text | `--tb=short -q` stdout capture | Parse `FAILED path::name - ErrorType: message` lines. Sufficient for AI categorization — the AI only needs the failure message string, not a structured schema. |

**Do not install pytest-json-report.** Installing a pytest plugin requires modifying the target project, which violates the QGSD constraint of being a pure observer/runner. Capturing `--tb=short` stdout is sufficient.

### Persistent State (Batch Checkpoint)

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| Node.js `node:sqlite` | built-in (Node >=22.5.0, no flag needed as of v22.13.0) | Store batch results, categorization decisions, and run state persistently across sessions | Zero external dependency. Synchronous API (DatabaseSync) matches the existing hook pattern. At 20k tests, a JSON file becomes unwieldy — slow reads/writes on every batch update, no indexed queries. SQLite handles 20k rows trivially with proper indexing. The module is experimental at "active development" (stability 1.1) — appropriate for a dev tool. |
| JSON flat file fallback | built-in | Fallback for Node < 22.5.0 | If `node:sqlite` import fails (Node 16-21), fall back to a `.qgsd-maintain-state.json` file with a compatibility shim. At 20k tests the JSON approach is 10-30x slower on writes but functional. |

**Why not better-sqlite3?** It requires a native addon compiled against the target Node.js version (`node-gyp`). This breaks the QGSD constraint of zero external dependencies in installed scripts. `node:sqlite` is pure built-in — no compile step, no `node_modules` in the installed path.

**Why not a plain JSON file as primary?** A 20k-test state file serialized as JSON is ~5-10MB. Each batch write requires reading and rewriting the whole file. SQLite writes only the changed rows. For iterative runs (debug→categorize→fix→re-run loop), the write amplification of JSON becomes a real bottleneck over many iterations.

### Concurrency Control

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| Sequential `spawnSync` | built-in | Execute one batch at a time | The correct default. Test runners themselves use parallelism internally (Jest workers, Playwright workers). Running multiple batches concurrently causes port conflicts (Playwright), worker pool exhaustion (Jest), and interleaved stdout that breaks JSON parsing. Sequential outer batching with internal runner parallelism is the right model. |
| Manual bounded queue with `setImmediate` | built-in | If a future phase needs bounded parallelism (e.g. 3 concurrent pytest batches) | Do NOT add p-limit. p-limit v6+ is ESM-only; QGSD is CommonJS (confirmed: no `"type":"module"` in package.json, all hooks use `require()`). Calling `require('p-limit')` will throw `ERR_REQUIRE_ESM`. |

### AI Categorization Integration

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| Claude Code subagent (`.claude/agents/`) | QGSD agents dir | Categorize failure batches into 5 categories | QGSD already has an `agents/` directory. The categorization agent receives a batch of failure messages and returns structured JSON decisions. This matches the existing QGSD agent pattern. No new library needed — Claude Code's built-in subagent system handles this. |
| JSON.parse / JSON.stringify | built-in | Serialize batch failures for prompt, deserialize category decisions | The categorization interface is: input = JSON array of `{testId, failureMessage}`, output = JSON array of `{testId, category, rationale}`. Pure JSON over the agent prompt/response. |

**Categorization loop architecture:** The maintain-tests command is a Node.js script (not a hook) that orchestrates: discover → batch → run batch → capture failures → invoke categorizer agent → write decisions to SQLite → act on decisions → re-run until clean. Each step is a synchronous function call. No async library needed.

### Git History Integration (Optional, Phase 2)

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| `spawnSync('git', ['log', '--follow', '-1', '--format=%H', '--', file])` | built-in | Find last commit touching a test file | Already the established pattern in qgsd-circuit-breaker.js for git log parsing. Provides AI categorizer with context: "this test hasn't been touched in 2 years" = likely stale-needs-adaptation. |
| `spawnSync('git', ['log', '--oneline', '-n', '10', '--', file])` | built-in | Get recent commit history for a failing test file | Same pattern. No git library (simple-git, nodegit) needed. |

---

## Installation

```bash
# No new runtime dependencies for hooks/command scripts.
# All new capabilities use Node.js built-ins only.

# For test file discovery when runner config is unavailable:
npm install fast-glob@3.3.3

# fast-glob is the ONLY new external dependency.
# Add to package.json dependencies (not devDependencies) since
# the maintain-tests command ships as part of the installed package.
```

**Where fast-glob lives:** The maintain-tests command runs from the global install at `~/.claude/commands/maintain-tests.js`. To avoid node_modules resolution issues in the global install path, bundle fast-glob into the output file using esbuild (already a devDependency):

```bash
# Add to build-hooks.js or a new build-commands.js script:
npx esbuild commands/maintain-tests.js \
  --bundle --platform=node --target=node16 \
  --outfile=commands/dist/maintain-tests.js
```

This bundles fast-glob into a single output file, eliminating the runtime node_modules dependency entirely. Aligns with the existing esbuild devDependency already in package.json.

---

## Alternatives Considered

| Recommended | Alternative | When to Use Alternative |
|-------------|-------------|-------------------------|
| `spawnSync` for batch execution | Jest's programmatic `runCLI()` API | Only if you need to intercept test results mid-run (streaming). For QGSD, the final JSON output is sufficient — the spawnSync + `--json` flag approach uses Jest's stable CLI contract instead of its undocumented internal API (which has broken across jest 25→26, 27→28, 28→29). |
| `node:sqlite` for state | better-sqlite3 | If Node >=22 cannot be guaranteed AND the 5-10MB JSON file is unacceptable. better-sqlite3 requires native compile, breaking QGSD's zero-dependency install model. Only use if `node:sqlite` proves too unstable. |
| `node:sqlite` for state | Plain JSON `.qgsd-maintain-state.json` | Acceptable for projects with <1,000 tests where write amplification doesn't matter. Make JSON the fallback, not the primary. |
| fast-glob bundled via esbuild | fast-glob as a runtime npm dependency | If QGSD moves to requiring npm install in the project (not global). Currently QGSD is globally installed — bundling is the right answer to avoid node_modules resolution issues in the global install path. |
| Playwright `--reporter=json` stdout capture | playwright-ctrf-json-reporter | Use CTRF reporter only if you need a standardized multi-runner format for dashboard integration. For AI categorization, the built-in JSON reporter is sufficient and avoids installing a dev dependency in the target project. |
| pytest stdout parsing | pytest-json-report plugin | Use only if the target project already has it installed. Never install it on behalf of the user — QGSD is a pure observer. |

---

## What NOT to Use

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| `p-limit` (v6+) | ESM-only module. QGSD is CommonJS (no `"type":"module"` in package.json, all hooks use `require()`). Will throw `ERR_REQUIRE_ESM` at runtime. | Sequential `spawnSync` — test runners parallelize internally, so sequential outer batching is the correct model anyway. No concurrency library needed. |
| `better-sqlite3` | Native addon requires `node-gyp` compile against target Node.js version. Breaks QGSD's zero-dependency install model. Compilation fails in minimal environments (no Python 3, no build tools). | `node:sqlite` (built-in, Node >=22.5.0) with JSON flat file fallback for older Node. |
| `nodegit` / `simple-git` | nodegit is a native addon (same problem as better-sqlite3). simple-git v3+ requires dynamic import for ESM compatibility — incompatible with QGSD CommonJS codebase. | `spawnSync('git', ['log', ...])` — already the QGSD pattern for git operations in qgsd-circuit-breaker.js. |
| Jest `runCLI()` programmatic API | Not publicly documented. Has broken silently across every Jest major version since v25. Coupling to it means maintain-tests breaks when users upgrade Jest without any error in QGSD's own tests. | Spawn `npx jest --json` as a subprocess — uses Jest's stable CLI contract. |
| Storing full test output in memory | 100 tests × average 10KB output = 1MB per batch. 200 batches (20k tests) = 200MB of in-process memory if buffered. spawnSync buffers in memory by default. | Write each batch output to a temp file using `outputFile` flag (Jest) or stdout redirect (Playwright/pytest), parse it, then delete it. |
| pytest-json-report as a requirement | Requires modifying the target project's pytest configuration. QGSD is a non-invasive observer — it must not add dependencies to the projects it tests. | Parse `--tb=short` stdout text. The failure message string is all the AI categorizer needs. |
| Async/await throughout the command script | Not wrong, but adds unnecessary complexity. All subprocess calls are naturally sequential (run batch → capture output → categorize → write state → next batch). Forcing async introduces callback coordination with no benefit. | Synchronous `spawnSync` + `fs.readFileSync` + `sqlite.prepare().all()` — reads like a shell script, straightforward to debug and test. |

---

## Stack Patterns by Variant

**If target project uses Jest:**
- Discovery: Jest handles it. No fast-glob needed.
- Execution per batch: `spawnSync('npx', ['jest', '--json', '--outputFile', tmpFile, '--testPathPattern', batchPattern])`
- Parse `tmpFile` as JSON after spawnSync returns.

**If target project uses Playwright:**
- Discovery: Playwright handles it. No fast-glob needed.
- Execution per batch: `spawnSync('npx', ['playwright', 'test', '--reporter=json', '--shard', batchN + '/' + totalBatches])`
- Capture stdout to temp file (Playwright JSON reporter writes to stdout by default).

**If target project uses pytest:**
- Discovery: `spawnSync('python3', ['-m', 'pytest', '--collect-only', '-q', '--no-header'])` → parse stdout lines for `path::name` pattern.
- Execution per batch: `spawnSync('python3', ['-m', 'pytest', '--tb=short', '-q', ...batchTestIds])`
- Parse stdout for `FAILED` lines.

**If project uses multiple runners (jest + playwright):**
- Run each runner's discovery separately.
- Maintain separate batch queues per runner in SQLite state.
- Same categorization agent handles all — the 5-category schema is runner-agnostic.

**If Node.js version is < 22.5.0:**
- Skip `node:sqlite`, use JSON flat file state.
- Add compatibility check at startup:
  ```javascript
  const nodeVersion = parseInt(process.version.slice(1).split('.')[0], 10);
  const state = nodeVersion >= 22 ? new SqliteState(dbPath) : new JsonState(jsonPath);
  ```

---

## Version Compatibility

| Package | Compatible With | Notes |
|---------|-----------------|-------|
| `node:sqlite` | Node >=22.5.0 | Experimental (stability 1.1 — active development). No compile flag needed as of v22.13.0. Claude Code users typically run recent Node — high confidence this is safe as the primary path. |
| `fast-glob@3.3.3` | Node >=12.0.0 | Well within QGSD's >=16.7.0 engine requirement. Bundled via esbuild so no runtime resolution needed. |
| `esbuild@^0.24.0` | Node >=12.17.0 | Already a devDependency in package.json. No version change needed — just add a build step for the maintain-tests command. |
| Jest `--json` flag | Jest >=24 | Available since Jest 24 (2018). Output schema is stable across Jest 27/28/29/30. The `testResults[].testResults[].failureMessages` field exists in all modern versions. |
| Playwright JSON reporter | Playwright >=1.20 | JSON reporter is built-in since v1.0, stabilized by v1.20. |
| pytest `--collect-only -q` | pytest >=3.0 | Line format (`path::name`) is stable since pytest 3. Present in all modern projects. |

---

## Sources

- `https://nodejs.org/docs/latest/api/sqlite.html` — `node:sqlite` stability (1.1 active development), version requirement (>=22.5.0, no flag from v22.13.0), DatabaseSync API. Confidence: HIGH.
- `https://nodejs.org/api/child_process.html` — spawnSync API, pipe buffer limitations for large stdout (must write to file when output >1MB), encoding options. Confidence: HIGH.
- `https://jestjs.io/docs/cli` — `--json` flag behavior (diverts test output to stderr, results to stdout), `--outputFile`, `--testPathPattern`. Confidence: HIGH.
- `https://playwright.dev/docs/test-reporters` — JSON reporter configuration, `outputFile` option, `PLAYWRIGHT_JSON_OUTPUT_FILE` env var. Confidence: HIGH.
- `https://github.com/mrmlnc/fast-glob/releases` — Version 3.3.3 is current stable (Jan 2025), zero transitive dependencies, MIT license. Confidence: HIGH.
- `https://github.com/pytest-dev/pytest/issues/9704` — pytest `--collect-only` output is NOT machine-readable JSON natively; line parsing of `path::name` is the correct approach. Confidence: HIGH (primary source issue thread).
- `https://github.com/sindresorhus/p-limit/issues/63` — p-limit v6+ is ESM-only. Incompatible with QGSD CommonJS codebase. Decision: avoid entirely — sequential spawnSync is the correct batching model. Confidence: HIGH.
- `/Users/jonathanborduas/code/QGSD/hooks/qgsd-circuit-breaker.js` — Confirms QGSD uses CommonJS (`require()`), uses `spawnSync` for git operations, uses `fs.readFileSync`/`fs.writeFileSync` for state. This is the integration pattern that maintain-tests must follow. Confidence: HIGH (first-party).
- `/Users/jonathanborduas/code/QGSD/package.json` — No `"type":"module"` field → defaults to CommonJS. `esbuild@^0.24.0` already a devDependency. `"engines": {"node": ">=16.7.0"}`. Confidence: HIGH (first-party).
- `/Users/jonathanborduas/code/QGSD/scripts/build-hooks.js` — Build system is file-copy only for hooks. Confirms maintain-tests command needs its own esbuild bundle step to handle the fast-glob dependency cleanly. Confidence: HIGH (first-party).

---

*Stack research for: QGSD v0.3 test suite maintenance tool (`/qgsd:maintain-tests`)*
*Researched: 2026-02-22*
