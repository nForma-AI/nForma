---
phase: quick-53
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - hooks/qgsd-prompt.test.js
  - bin/update-scoreboard.test.cjs
  - package.json
autonomous: true
requirements:
  - QUICK-53
must_haves:
  truths:
    - "npm test passes with all new tests green alongside the existing 201"
    - "qgsd-prompt.js circuit breaker injection path is covered by process-spawn tests"
    - "qgsd-prompt.js quorum injection path is covered (matching and non-matching commands)"
    - "update-scoreboard.cjs parseArgs, validate, emptyModelStats, recomputeStats pure functions are covered"
    - "update-scoreboard.cjs loadData graceful-fallback on missing/corrupt file is covered"
    - "initTeam fingerprint deduplication logic is covered"
  artifacts:
    - path: "hooks/qgsd-prompt.test.js"
      provides: "Process-spawn tests for qgsd-prompt.js"
      min_lines: 100
    - path: "bin/update-scoreboard.test.cjs"
      provides: "Unit tests for all pure functions in update-scoreboard.cjs"
      min_lines: 150
  key_links:
    - from: "package.json scripts.test"
      to: "hooks/qgsd-prompt.test.js bin/update-scoreboard.test.cjs"
      via: "node --test additional files"
      pattern: "qgsd-prompt\\.test\\.js.*update-scoreboard\\.test\\.cjs"
---

<objective>
Add unit tests for the two largest untested modules: hooks/qgsd-prompt.js (148 lines, zero tests) and bin/update-scoreboard.cjs (457 lines, zero tests).

Purpose: 201 tests exist for stop-hook, circuit-breaker, config-loader, and gsd-tools. The prompt hook and scoreboard updater are production code with no test coverage despite containing non-trivial logic — command-matching regex, quorum instruction injection, model override formatting, score delta computation, cumulative stats recompute, initTeam fingerprint deduplication, and argument validation.

Output: Two new test files wired into npm test, raising total coverage to 270+ tests.
</objective>

<execution_context>
@/Users/jonathanborduas/.claude/get-shit-done/workflows/execute-plan.md
@/Users/jonathanborduas/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/STATE.md
@.planning/quick/53-we-need-full-unit-test-coverage/53-PLAN.md
</context>

<tasks>

<task type="auto">
  <name>Task 1: Write hooks/qgsd-prompt.test.js</name>
  <files>hooks/qgsd-prompt.test.js</files>
  <action>
Create a process-spawn test suite using Node.js built-in test runner (same pattern as hooks/qgsd-stop.test.js). The hook reads JSON from stdin and writes JSON to stdout; tests feed it via spawnSync.

Test cases to cover — follow existing naming convention (TC1, TC2, ...):

TC1: non-planning command exits 0 with no stdout output
  - Input: { prompt: "/qgsd:execute-phase", cwd: process.cwd() }
  - /qgsd:execute-phase is NOT in default quorum_commands → silent pass

TC2: planning command triggers quorum injection
  - Input: { prompt: "/qgsd:plan-phase 03-auth", cwd: process.cwd() }
  - Stdout JSON should have hookSpecificOutput.additionalContext containing "QUORUM REQUIRED"

TC3: /gsd:plan-phase (GSD prefix) also triggers injection
  - Input: { prompt: "/gsd:plan-phase 03-auth", cwd: process.cwd() }
  - Same expectation: additionalContext contains "QUORUM REQUIRED"

TC4: /qgsd:research-phase triggers injection
  - Input: { prompt: "/qgsd:research-phase", cwd: process.cwd() }
  - additionalContext contains "QUORUM REQUIRED"

TC5: /qgsd:verify-work triggers injection
  - Input: { prompt: "/qgsd:verify-work", cwd: process.cwd() }
  - additionalContext contains "QUORUM REQUIRED"

TC6: /qgsd:discuss-phase triggers injection
  - Input: { prompt: "/qgsd:discuss-phase", cwd: process.cwd() }
  - additionalContext contains "QUORUM REQUIRED"

TC7: malformed JSON stdin exits 0 with no output (fail-open)
  - Feed raw string "not json" as stdin
  - Expect exit code 0, stdout empty

TC8: prefix boundary — /qgsd:plan-phase-extra does NOT trigger (trailing non-space after command)
  - Input: { prompt: "/qgsd:plan-phase-extra something", cwd: process.cwd() }
  - Word boundary regex (\s|$) should block match → no injection, exit 0

TC9: circuit breaker active in temp dir → injects resolution context
  - Create a temp dir, run git init, write .claude/circuit-breaker-state.json with { active: true }
  - Input: { prompt: "/qgsd:execute-phase", cwd: tempDir }
  - Stdout should contain "CIRCUIT BREAKER ACTIVE"
  - Cleanup temp dir after

TC10: circuit breaker disabled flag → does NOT inject resolution context
  - Same temp dir setup but state = { active: true, disabled: true }
  - Input: { prompt: "/qgsd:execute-phase", cwd: tempDir }
  - Stdout should be empty (exit 0, no injection)

Helper: use spawnSync to run node hooks/qgsd-prompt.js with { input, encoding, timeout: 5000, env: process.env }.
Use path.join(__dirname, 'qgsd-prompt.js') for HOOK_PATH.
Temp dir helpers: fs.mkdtempSync, fs.mkdirSync recursive, fs.writeFileSync, fs.rmSync recursive.

For TC9: must also `git init` inside tempDir so isBreakerActive can find a git root (spawnSync 'git', ['init'], { cwd: tempDir }).
</action>
  <verify>node --test hooks/qgsd-prompt.test.js 2>&1 | tail -10</verify>
  <done>All 10 tests pass (ℹ pass 10, ℹ fail 0)</done>
</task>

<task type="auto">
  <name>Task 2: Write bin/update-scoreboard.test.cjs</name>
  <files>bin/update-scoreboard.test.cjs</files>
  <action>
Create a unit test suite for the pure functions in bin/update-scoreboard.cjs. These functions do NOT need to be exported — require the file path and then test the internals by either:
  a) Spawning the CLI process with args for integration-style tests, or
  b) Extracting logic via a separate helper if functions are not exported.

Since update-scoreboard.cjs uses `process.exit` in main(), the cleanest approach is to refactor-free: test by spawning `node bin/update-scoreboard.cjs` with controlled args and a temp scoreboard path via --scoreboard /tmp/xxx.json.

Test cases:

SC-TC1: missing required args → exits 1 and writes USAGE to stderr
  - Spawn with no args
  - Expect exit code 1, stderr contains "--model is required"

SC-TC2: valid round vote creates scoreboard file and prints confirmation
  - Spawn: --model claude --result TP --task quick-53 --round 1 --verdict APPROVE --scoreboard /tmp/qgsd-sb-test-{random}.json
  - Expect exit code 0, stdout contains "[update-scoreboard] claude: TP (+1) → score: 1"
  - Cleanup temp file

SC-TC3: TP result increments score by +1
  - Same as SC-TC2, parse stdout: score should be 1

SC-TC4: TN result increments score by +5
  - Spawn with --result TN --model gemini
  - Stdout should contain "score: 5"

SC-TC5: FP result decrements score by -3
  - Spawn with --result FP
  - Stdout should contain "score: -3"

SC-TC6: FN result decrements score by -1
  - Spawn with --result FN
  - Stdout should contain "score: -1"

SC-TC7: TP+ result increments score by +3
  - Spawn with --result TP+
  - Stdout should contain "score: 3"

SC-TC8: second vote on same task+round updates existing entry (no duplicate round)
  - Write two sequential votes for same task+round with different models
  - Read and parse the scoreboard JSON
  - data.rounds.length should be 1 (not 2)

SC-TC9: second vote on different round appends new entry
  - Write votes for round 1 and round 2
  - data.rounds.length should be 2

SC-TC10: recompute stats from scratch — cumulative score reflects all rounds
  - Write two TP votes for same model in two different rounds (must use same model via two spawns)
  - Read scoreboard JSON, check data.models.claude.score === 2

SC-TC11: invalid --model value → exits 1, stderr contains valid options list
  - Spawn with --model notamodel
  - Expect exit code 1

SC-TC12: invalid --result value → exits 1
  - Spawn with --result BADCODE
  - Expect exit code 1

SC-TC13: UNAVAIL result → score stays at 0 (score delta is 0), prints "(UNAVAIL (0))"
  - Spawn with --result UNAVAIL, read stdout
  - stdout contains "UNAVAIL (0)"

SC-TC14: init-team subcommand writes team fingerprint to scoreboard
  - Spawn: init-team --claude-model claude-opus-4-6 --team '{"gemini":"gemini-2.0"}' --scoreboard /tmp/...
  - Read JSON, check data.team.fingerprint exists and is 16-char hex string

SC-TC15: init-team idempotent — second call with same composition writes "no change"
  - Run init-team twice with same args
  - Second stdout should contain "no change"

Helper: use spawnSync('node', [SCOREBOARD_PATH, ...args], { encoding: 'utf8', timeout: 5000 }).
SCOREBOARD_PATH = path.join(__dirname, '..', 'bin', 'update-scoreboard.cjs').
Use randomised temp paths: path.join(os.tmpdir(), 'qgsd-sb-test-' + Date.now() + '.json').
Cleanup: fs.unlinkSync at end of each test (wrap in try/catch).
</action>
  <verify>node --test bin/update-scoreboard.test.cjs 2>&1 | tail -10</verify>
  <done>All 15 tests pass (ℹ pass 15, ℹ fail 0)</done>
</task>

<task type="auto">
  <name>Task 3: Wire new test files into npm test</name>
  <files>package.json</files>
  <action>
Read package.json. Find the `test` script:

```
"test": "node scripts/lint-isolation.js && node --test hooks/qgsd-stop.test.js hooks/config-loader.test.js get-shit-done/bin/gsd-tools.test.cjs hooks/qgsd-circuit-breaker.test.js"
```

Append the two new test files to the node --test invocation:

```
"test": "node scripts/lint-isolation.js && node --test hooks/qgsd-stop.test.js hooks/config-loader.test.js get-shit-done/bin/gsd-tools.test.cjs hooks/qgsd-circuit-breaker.test.js hooks/qgsd-prompt.test.js bin/update-scoreboard.test.cjs"
```

No other changes to package.json.
</action>
  <verify>npm test 2>&1 | tail -15</verify>
  <done>npm test exits 0, ℹ pass count is 226+ (201 existing + 10 prompt + 15 scoreboard), ℹ fail 0</done>
</task>

</tasks>

<verification>
npm test exits 0 with all tests green. Run:

  npm test

Expected output ends with:
  ℹ tests 226
  ℹ pass 226
  ℹ fail 0
</verification>

<success_criteria>
- hooks/qgsd-prompt.test.js exists with 10 tests covering circuit breaker injection, quorum injection, command matching regex, and fail-open behavior
- bin/update-scoreboard.test.cjs exists with 15 tests covering score delta computation, round deduplication, cumulative recompute, and initTeam fingerprinting
- npm test passes with all 226+ tests green (zero failures, zero skipped)
</success_criteria>

<output>
After completion, create `.planning/quick/53-we-need-full-unit-test-coverage/53-SUMMARY.md`
</output>
