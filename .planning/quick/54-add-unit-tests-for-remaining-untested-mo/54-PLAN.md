---
phase: quick-54
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - hooks/qgsd-statusline.test.js
  - bin/review-mcp-logs.test.cjs
  - package.json
autonomous: true
requirements: [QUICK-54]

must_haves:
  truths:
    - "node --test hooks/qgsd-statusline.test.js runs and all tests pass"
    - "node --test bin/review-mcp-logs.test.cjs runs and all tests pass"
    - "npm test includes both new test files and the suite passes end-to-end"
    - "qgsd-statusline context-scaling logic is covered (0%, 50%, 80%, 100% remaining)"
    - "review-mcp-logs --json output mode is covered with synthetic temp debug files"
  artifacts:
    - path: "hooks/qgsd-statusline.test.js"
      provides: "statusline hook unit tests"
    - path: "bin/review-mcp-logs.test.cjs"
      provides: "MCP log review CLI unit tests"
  key_links:
    - from: "hooks/qgsd-statusline.test.js"
      to: "hooks/qgsd-statusline.js"
      via: "process-spawn with piped JSON stdin"
      pattern: "spawnSync.*qgsd-statusline"
    - from: "bin/review-mcp-logs.test.cjs"
      to: "bin/review-mcp-logs.cjs"
      via: "process-spawn with temp debug dir via QGSD_DEBUG_DIR env override or synthetic files"
      pattern: "spawnSync.*review-mcp-logs"
---

<objective>
Add unit tests for `hooks/qgsd-statusline.js` and `bin/review-mcp-logs.cjs` — the two untested modules with meaningful, exercisable logic.

Purpose: Bring test coverage to the two remaining high-value untested modules. The other untested files (qgsd-check-update.js, qgsd-session-start.js, check-provider-health.cjs, check-mcp-health.cjs, secrets.cjs, set-secret.cjs, install.js, qgsd.cjs) are either thin glue, fire-and-forget background spawners, real-network-dependent, or native-addon-dependent — not realistically unit-testable without complex infrastructure.

Output: Two new test files + updated npm test script.
</objective>

<execution_context>
@/Users/jonathanborduas/.claude/get-shit-done/workflows/execute-plan.md
@/Users/jonathanborduas/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@hooks/qgsd-stop.test.js
@hooks/qgsd-statusline.js
@bin/review-mcp-logs.cjs
@package.json
</context>

<tasks>

<task type="auto">
  <name>Task 1: Write tests for hooks/qgsd-statusline.js</name>
  <files>hooks/qgsd-statusline.test.js</files>
  <action>
Create `hooks/qgsd-statusline.test.js` using the Node.js built-in test runner (`node:test` + `node:assert/strict`), following the exact process-spawn pattern from `hooks/qgsd-stop.test.js`.

The hook reads JSON from stdin and writes formatted statusline text to stdout. Tests must exercise:

**Spawn helper:**
```js
const HOOK_PATH = path.join(__dirname, 'qgsd-statusline.js');
function runHook(stdinPayload, extraEnv) {
  const result = spawnSync('node', [HOOK_PATH], {
    input: JSON.stringify(stdinPayload),
    encoding: 'utf8',
    timeout: 5000,
    env: extraEnv ? { ...process.env, ...extraEnv } : process.env,
  });
  return { stdout: result.stdout || '', stderr: result.stderr || '', exitCode: result.status };
}
```

**Test cases to implement:**

TC1: Minimal payload (no context, no session) — stdout contains model name
- Input: `{ model: { display_name: 'TestModel' }, workspace: { current_dir: '/tmp/myproject' } }`
- Assert: exitCode 0, stdout includes 'TestModel', stdout includes 'myproject'

TC2: Context at 100% remaining (0% used) — green bar, 0%
- Input: `{ model: { display_name: 'M' }, context_window: { remaining_percentage: 100 } }`
- Assert: stdout includes '░░░░░░░░░░' (all empty = 0% used), stdout includes '0%'

TC3: Context at 20% remaining (80% used → 100% scaled) — skull emoji or red, 100%
- Input: `{ model: { display_name: 'M' }, context_window: { remaining_percentage: 20 } }`
- Assert: stdout includes '100%' (scaled = 100%), stdout contains '██████████' (full bar)

TC4: Context at 51% remaining (49% used → 61% scaled) — should be green (scaled < 63)
- Input: `{ model: { display_name: 'M' }, context_window: { remaining_percentage: 51 } }`
- Assert: stdout includes '61%', stdout includes green ANSI code '\x1b[32m'
- Note: remaining_percentage: 50 would produce Math.round(62.5)=63 which hits the yellow threshold (used >= 63), so 51 is used here to stay safely in the green zone at 61%.

TC5: Context at 36% remaining (64% used → 80% scaled) — should be yellow (63 <= scaled < 81)
- Input: `{ model: { display_name: 'M' }, context_window: { remaining_percentage: 36 } }`
- Assert: stdout includes '80%', stdout includes yellow ANSI code '\x1b[33m'

TC6: Malformed JSON input — exits 0, stdout is empty (silent fail)
- Input: 'this is not valid json' (send as raw string)
- Assert: exitCode 0, stdout is ''

TC7: Update available — output includes '/qgsd:update'
- Write a temp cache file at a writable path with `{ update_available: true, ... }`
- Override HOME to a temp dir containing `.claude/cache/qgsd-update-check.json` with `update_available: true`
- Input: `{ model: { display_name: 'M' } }`
- Assert: stdout includes '/qgsd:update'

TC8: Task in progress — output includes task name
- Write a temp todos dir; create a file named `{session_id}-agent-0.json` containing `[{ status: 'in_progress', activeForm: 'Fix the thing' }]`
- Override HOME to temp dir so todos are at the expected path
- Input: `{ model: { display_name: 'M' }, session_id: 'sess123' }`
- Assert: stdout includes 'Fix the thing'

For TC7 and TC8 use extraEnv with `HOME` set to a temp directory. Always clean up temp files in a `finally` block.
  </action>
  <verify>node --test hooks/qgsd-statusline.test.js</verify>
  <done>All 8 test cases pass with exit code 0.</done>
</task>

<task type="auto">
  <name>Task 2: Write tests for bin/review-mcp-logs.cjs and update npm test script</name>
  <files>bin/review-mcp-logs.test.cjs, package.json</files>
  <action>
Create `bin/review-mcp-logs.test.cjs` using the Node.js built-in test runner, following the process-spawn pattern from `bin/update-scoreboard.test.cjs`.

The CLI scans a debug directory for `.txt` files and outputs a report. It reads `~/.claude/debug/` by default. The key insight: the `DEBUG_DIR` path is computed at module top-level from `os.homedir()` — there is no env override. Therefore tests must write synthetic `.txt` files into the **actual** `~/.claude/debug/` temp location, OR they must accept that the CLI uses the real debug dir.

The cleanest approach: write a minimal synthetic `.txt` log file into a real temp subdirectory that mimics the debug dir content, but since DEBUG_DIR is hardcoded, the tests should use the `--json` output mode and test against the parsed JSON structure when debug files are present, with graceful handling when they are absent.

**Preferred approach — test with synthetic log lines in a temp file written to the real debug dir:**

```js
const DEBUG_DIR = path.join(os.homedir(), '.claude', 'debug');
// Ensure it exists; create a timestamped synthetic file for this test run
```

**Test cases:**

TC1: No debug dir or empty — exits 0 with appropriate message
- The CLI's readdirSync catch block calls process.exit(1) when the dir is missing, so the dir must exist.
- Before spawning, call `fs.mkdirSync(DEBUG_DIR, { recursive: true })` to guarantee the dir exists.
- Spawn with `--days 0` to force the cutoff to now — no files qualify (none were created in the future), producing an empty result.
- Assert: exitCode 0

TC2: Synthetic log file with a successful tool call — --json output contains server entry
- Write a temp `.txt` file to `~/.claude/debug/` with content containing a line matching the RE_COMPLETE pattern:
  ```
  2026-02-22T10:00:00.000Z MCP server "test-server": Tool 'test-tool' completed successfully in 150ms
  ```
- Spawn with `--json --days 1`
- Assert: exitCode 0, stdout is valid JSON, parsed result has `serverStats['test-server']` with `totalCalls >= 1`
- Clean up the temp file in `finally`

TC3: Synthetic log file with a failure — --json output shows failureCount > 0
- Write a temp `.txt` file with:
  ```
  2026-02-22T10:00:00.000Z MCP server "slow-server": Tool 'slow-tool' failed after 25s: connection timeout
  ```
- Spawn with `--json --days 1`
- Assert: exitCode 0, parsed `serverStats['slow-server'].failureCount >= 1`
- Clean up in `finally`

TC4: --tool filter — only matching server appears in output
- Write a temp `.txt` file with two RE_COMPLETE lines: one for "alpha-server" and one for "beta-server"
- Spawn with `--json --days 1 --tool alpha`
- Assert: parsed result contains alpha-server entry, does NOT contain beta-server entry

TC5: percentile logic (internal) — via --json output, p50 and p95 reported correctly
- Write a temp `.txt` file with 4 RE_COMPLETE lines for "perf-server" with durations 100ms, 200ms, 300ms, 400ms
- Spawn with `--json --days 1`
- Assert: parsed `serverStats['perf-server'].p50Ms >= 100`, `.p95Ms >= 300`

**Helpers:**
```js
const DEBUG_DIR = path.join(os.homedir(), '.claude', 'debug');

function writeSyntheticLog(lines) {
  fs.mkdirSync(DEBUG_DIR, { recursive: true });
  const filename = `qgsd-test-${Date.now()}-${Math.random().toString(36).slice(2)}.txt`;
  const filePath = path.join(DEBUG_DIR, filename);
  fs.writeFileSync(filePath, lines.join('\n') + '\n', 'utf8');
  return filePath;
}

function runCLI(args) {
  const result = spawnSync('node', [SCRIPT_PATH, ...args], {
    encoding: 'utf8', timeout: 8000
  });
  return { stdout: result.stdout || '', stderr: result.stderr || '', exitCode: result.status };
}
```

For TC1, call `fs.mkdirSync(DEBUG_DIR, { recursive: true })` before spawning, then use `--days 0` to force the cutoff to now (no files from the future qualify), ensuring exit 0.

After writing both test files, update `package.json` `scripts.test` to append both new test files to the `node --test` invocation:
```
node --test hooks/qgsd-stop.test.js hooks/config-loader.test.js get-shit-done/bin/gsd-tools.test.cjs hooks/qgsd-circuit-breaker.test.js hooks/qgsd-prompt.test.js bin/update-scoreboard.test.cjs hooks/qgsd-statusline.test.js bin/review-mcp-logs.test.cjs
```
  </action>
  <verify>node --test bin/review-mcp-logs.test.cjs && npm test</verify>
  <done>All 5 review-mcp-logs test cases pass. `npm test` exits 0 with all test files passing.</done>
</task>

</tasks>

<verification>
1. `node --test hooks/qgsd-statusline.test.js` — all 8 tests pass
2. `node --test bin/review-mcp-logs.test.cjs` — all 5 tests pass
3. `npm test` — full suite exits 0 (includes lint-isolation + all test files)
4. No test mutates production files; all temp files cleaned up in finally blocks
</verification>

<success_criteria>
- hooks/qgsd-statusline.test.js exists with 8 passing tests covering context scaling, color thresholds, update banner, task display, and silent fail on bad input
- bin/review-mcp-logs.test.cjs exists with 5 passing tests covering empty-result, successful parse, failure parse, tool filter, and percentile output
- package.json npm test script includes both new test files
- npm test exits 0
</success_criteria>

<output>
After completion, create `.planning/quick/54-add-unit-tests-for-remaining-untested-mo/54-SUMMARY.md` with:
- What was built (both test files, updated package.json)
- Test counts per file
- Any notable patterns or gotchas encountered
</output>
