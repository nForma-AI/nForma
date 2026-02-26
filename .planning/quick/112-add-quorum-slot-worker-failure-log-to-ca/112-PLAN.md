---
phase: quick-112
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - bin/call-quorum-slot.cjs
  - bin/check-provider-health.cjs
  - .gitignore
autonomous: true
requirements: [FAIL-LOG-01, FAIL-LOG-02]

must_haves:
  truths:
    - "When call-quorum-slot.cjs exits non-zero, a record is appended to .planning/quorum-failures.json with slot, error_type, pattern, count, last_seen"
    - "qgsd health providers warns when any slot has 3+ failures with the same error_type in quorum-failures.json"
    - "quorum-failures.json is gitignored (disk-only like quorum-scoreboard.json)"
    - "If quorum-failures.json does not exist, health check silently skips the failure summary (no crash on new installs)"
    - "call-quorum-slot.cjs still exits 1 and returns UNAVAIL on subprocess failure (existing behavior preserved)"
  artifacts:
    - path: "bin/call-quorum-slot.cjs"
      provides: "Side-effect failure log write before exit(1)"
      contains: "quorum-failures.json"
    - path: "bin/check-provider-health.cjs"
      provides: "Warning section for recurring slot failures"
      contains: "quorum-failures"
    - path: ".planning/quorum-failures.json"
      provides: "Disk-only failure log (created at runtime, not committed)"
  key_links:
    - from: "bin/call-quorum-slot.cjs catch block (line ~301)"
      to: ".planning/quorum-failures.json"
      via: "writeFailureLog() called before process.exit(1)"
      pattern: "writeFailureLog"
    - from: "bin/check-provider-health.cjs"
      to: ".planning/quorum-failures.json"
      via: "fs.existsSync + JSON.parse, warn on count >= 3"
      pattern: "quorum-failures"
---

<objective>
Add structured failure logging to call-quorum-slot.cjs and surface recurring slot failure patterns in the provider health check.

Purpose: Currently when a slot subprocess exits non-zero, the failure is ephemeral — nothing persists why it was UNAVAIL or whether the same error recurs. This makes debugging slot misconfiguration (wrong CLI flags, bad model names, auth errors) invisible across sessions.

Output:
- call-quorum-slot.cjs writes structured failure records to .planning/quorum-failures.json on non-zero exit
- bin/check-provider-health.cjs reads quorum-failures.json and warns when any slot accumulates 3+ failures of the same error_type
- .gitignore entry for quorum-failures.json (disk-only, same pattern as quorum-scoreboard.json)
</objective>

<execution_context>
@/Users/jonathanborduas/.claude/qgsd/workflows/execute-plan.md
@/Users/jonathanborduas/.claude/qgsd/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@bin/call-quorum-slot.cjs
@bin/check-provider-health.cjs
</context>

<tasks>

<task type="auto">
  <name>Task 1: Add writeFailureLog() to call-quorum-slot.cjs</name>
  <files>bin/call-quorum-slot.cjs</files>
  <action>
Add a `writeFailureLog(slot, errorMsg, stderrText)` function near the top of the file (after the `os` require block, before `// --- Args`). The function must:

1. Determine the project root using a simple upward walk from `__dirname` looking for `.planning/` directory, falling back to `process.cwd()`. Use this pattern (not `git rev-parse` — that adds a subprocess dependency):
   ```js
   function findProjectRoot() {
     let dir = __dirname;
     for (let i = 0; i < 8; i++) {
       if (fs.existsSync(path.join(dir, '.planning'))) return dir;
       const parent = path.dirname(dir);
       if (parent === dir) break;
       dir = parent;
     }
     return process.cwd();
   }
   ```

2. Compute the failure log path: `path.join(findProjectRoot(), '.planning', 'quorum-failures.json')`.

3. Classify `errorMsg` into `error_type`:
   - If message matches `/usage:|unknown flag|unknown option|invalid flag|unrecognized/i` → `CLI_SYNTAX`
   - If message matches `/TIMEOUT/i` → `TIMEOUT`
   - If message matches `/401|403|unauthorized|forbidden/i` → `AUTH`
   - Otherwise → `UNKNOWN`

4. Extract `pattern`: first 200 chars of `stderrText` (or `errorMsg` if stderrText is empty/null), stripping ANSI escape codes via a simple regex `/\x1b\[[0-9;]*m/g`.

5. Read existing log (if file exists and is valid JSON); if not, start with `[]`.

6. Find an existing record where `record.slot === slot && record.error_type === error_type`. If found, increment `record.count` and update `record.last_seen` (ISO timestamp). If not found, push a new record: `{ slot, error_type, pattern, count: 1, last_seen: new Date().toISOString() }`.

7. Write the updated array back with `fs.writeFileSync(..., JSON.stringify(records, null, 2), 'utf8')`.

8. Wrap the entire function body in a try/catch that silently swallows errors (failure logging must never interrupt the primary flow).

Call `writeFailureLog(slot, err.message, '')` in the main catch block (line ~302, just before `process.exit(1)`). The existing `process.stderr.write(...)` and `process.exit(1)` lines must remain unchanged.

Also call `writeFailureLog(slot, `Unknown provider type: ${provider.type}`, '')` before the `process.exit(1)` at line ~295 (the unknown-provider-type branch).
  </action>
  <verify>
    Run a deliberate failure:
    ```
    echo "test" | node /Users/jonathanborduas/code/QGSD/bin/call-quorum-slot.cjs --slot codex-1 --timeout 1
    ```
    (1ms timeout forces TIMEOUT exit)
    Then check:
    ```
    cat /Users/jonathanborduas/code/QGSD/.planning/quorum-failures.json
    ```
    Expect a JSON array with one record containing `slot: "codex-1"`, `error_type: "TIMEOUT"`, `count: 1`.
    Running the same command again should increment count to 2.
  </verify>
  <done>
    .planning/quorum-failures.json exists and contains a structured record after any non-zero exit from call-quorum-slot.cjs. Repeated failures on the same slot+error_type increment count rather than creating duplicate entries.
  </done>
</task>

<task type="auto">
  <name>Task 2: Surface recurring failures in check-provider-health.cjs + gitignore entry</name>
  <files>bin/check-provider-health.cjs, .gitignore</files>
  <action>
**Part A — check-provider-health.cjs:**

At the END of the script (after all existing provider checks complete, before the final exit), add a "Quorum Failure Patterns" section:

1. Compute the failures path the same way as Task 1 — walk upward from `__dirname` to find `.planning/` directory. Use an identical `findProjectRoot()` helper at the top of the file (or inline near the new section).

2. Read `quorum-failures.json`. If file does not exist or is invalid JSON, skip this section entirely (no error output, no crash). Guard with `try/catch` around the read+parse.

3. Group records by `slot`. For each slot, group by `error_type`. If any `(slot, error_type)` pair has `count >= 3`, emit a warning line using the same color scheme the file already uses (look at existing `C` color object or similar pattern in the file):

   ```
   WARN  quorum slot "codex-1" has 23 TIMEOUT failures (last: 2026-02-26T12:00:00Z)
         Pattern: TIMEOUT after 30000ms
         Hint: Check provider timeout_ms in providers.json or --timeout arg
   ```

   Error-type-specific hints:
   - `CLI_SYNTAX` → `Check CLI args_template in providers.json for this slot`
   - `TIMEOUT` → `Check provider timeout_ms in providers.json or increase --timeout arg`
   - `AUTH` → `Check API key env var / OAuth token for this slot`
   - `UNKNOWN` → `Check stderr output in pattern field above`

4. If NO failures meet the threshold (count >= 3), emit nothing — do not add a "no failures" line (keep health output clean for normal operation).

5. If the failures section does emit warnings, add a trailing blank line to separate from any subsequent output.

**Part B — .gitignore:**

Add the following line in the "Internal planning documents" block (near the other `.planning/` gitignore entries):
```
.planning/quorum-failures.json
```
  </action>
  <verify>
    1. Manually create a test failures file:
    ```
    echo '[{"slot":"codex-1","error_type":"TIMEOUT","pattern":"TIMEOUT after 30000ms","count":5,"last_seen":"2026-02-26T00:00:00Z"}]' > /Users/jonathanborduas/code/QGSD/.planning/quorum-failures.json
    ```
    2. Run:
    ```
    node /Users/jonathanborduas/code/QGSD/bin/check-provider-health.cjs
    ```
    Expect output to contain `WARN` line mentioning `codex-1` with `TIMEOUT` and hint about `timeout_ms`.

    3. Create a file with count=2 (below threshold):
    ```
    echo '[{"slot":"gemini-1","error_type":"AUTH","pattern":"401","count":2,"last_seen":"2026-02-26T00:00:00Z"}]' > /Users/jonathanborduas/code/QGSD/.planning/quorum-failures.json
    ```
    Re-run — expect NO WARN line for gemini-1.

    4. Delete the failures file:
    ```
    rm /Users/jonathanborduas/code/QGSD/.planning/quorum-failures.json
    ```
    Re-run — expect no crash, no mention of quorum failures in output.

    5. Verify gitignore:
    ```
    grep quorum-failures /Users/jonathanborduas/code/QGSD/.gitignore
    ```
    Expect: `.planning/quorum-failures.json`
  </verify>
  <done>
    `qgsd health providers` warns on slots with 3+ same-type failures, silently skips if file missing, and does not warn for slots below the threshold. .planning/quorum-failures.json is gitignored.
  </done>
</task>

</tasks>

<verification>
End-to-end smoke test:
1. Force a TIMEOUT failure: `echo "test" | node bin/call-quorum-slot.cjs --slot codex-1 --timeout 1`
2. Confirm .planning/quorum-failures.json created with count=1
3. Repeat 2 more times (count reaches 3)
4. Run `node bin/check-provider-health.cjs` — WARN for codex-1 TIMEOUT must appear
5. Confirm `git status` does NOT show quorum-failures.json (gitignored)
6. Run `node --check bin/call-quorum-slot.cjs` — no syntax errors
7. Run `node --check bin/check-provider-health.cjs` — no syntax errors
</verification>

<success_criteria>
- call-quorum-slot.cjs writes structured failure record to .planning/quorum-failures.json on any non-zero exit, without altering existing exit(1) / stderr behavior
- Records with same (slot, error_type) accumulate via count increment, not duplicate entries
- check-provider-health.cjs emits WARN with fix hint when count >= 3 for any (slot, error_type) pair
- Health check does not crash when quorum-failures.json is absent
- .planning/quorum-failures.json is listed in .gitignore
</success_criteria>

<output>
After completion, create `.planning/quick/112-add-quorum-slot-worker-failure-log-to-ca/112-SUMMARY.md`
</output>
