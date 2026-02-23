---
phase: quick-55
plan: 55
type: execute
wave: 1
depends_on: []
files_modified:
  - get-shit-done/workflows/fix-tests.md
  - get-shit-done/bin/gsd-tools.cjs
autonomous: true
requirements: []

must_haves:
  truths:
    - "Running 'maintain-tests ddmin' with a failing test and a candidate set returns the minimal polluter subset"
    - "The fix-tests workflow enriches 'isolate' verdicts with a polluter_set before dispatch"
    - "Dispatched tasks for isolate failures include the polluter context so the fixer knows which test to address"
  artifacts:
    - path: "get-shit-done/bin/gsd-tools.cjs"
      provides: "maintain-tests ddmin subcommand"
      contains: "cmdMaintainTestsDdmin"
    - path: "get-shit-done/workflows/fix-tests.md"
      provides: "ddmin integration step in 6d/6h for isolate category"
      contains: "ddmin"
  key_links:
    - from: "get-shit-done/workflows/fix-tests.md (step 6d)"
      to: "get-shit-done/bin/gsd-tools.cjs cmdMaintainTestsDdmin"
      via: "maintain-tests ddmin CLI call"
      pattern: "maintain-tests ddmin"
    - from: "ddmin result polluter_set"
      to: "dispatched task description in 6h"
      via: "verdict.polluter_set appended to task description"
      pattern: "polluter_set"
---

<objective>
Add delta debugging (ddmin) to the fix-tests workflow so that "isolate" category tests — those that fail due to ordering/pollution dependencies — are enriched with a minimal polluter set before dispatch. This transforms a vague "isolate" classification into an actionable "test A causes test B to fail when run first" diagnosis.

Purpose: Today when a test is classified as `isolate`, the dispatcher fires a quick task with only the error heuristic (port conflict, env var, race condition). The fixer has no idea which upstream test is causing the pollution. Ddmin finds the minimal subset of co-runner tests responsible, guiding the fixer to the right source file.

Output: A `maintain-tests ddmin` CLI subcommand in gsd-tools.cjs and an updated fix-tests.md workflow step 6d that runs ddmin for isolate verdicts and attaches `polluter_set` to the verdict before dispatch.
</objective>

<execution_context>
@/Users/jonathanborduas/.claude/get-shit-done/workflows/execute-plan.md
</execution_context>

<context>
@.planning/STATE.md
@get-shit-done/workflows/fix-tests.md
</context>

<tasks>

<task type="auto">
  <name>Task 1: Add maintain-tests ddmin subcommand to gsd-tools.cjs</name>
  <files>get-shit-done/bin/gsd-tools.cjs</files>
  <action>
Add a `maintain-tests ddmin` subcommand to gsd-tools.cjs. This implements the classic delta debugging algorithm (ddmin) adapted for test order sensitivity.

**CLI signature:**
```
maintain-tests ddmin --failing-test <path> --candidates-file <path> [--timeout N] [--output-file <path>] [--runner auto|jest|playwright|pytest]
```

- `--failing-test`: single test file path that currently fails in isolation (passes alone, fails after some other test runs first)
- `--candidates-file`: JSON file containing `{ "test_files": ["path1", "path2", ...] }` — the full set of suspect co-runners discovered from the current batch
- `--timeout`: per-run timeout in seconds (default 60)
- `--runner`: test runner override (default auto-detect)
- `--output-file`: write result JSON here

**Algorithm — ddmin on co-runner sets:**

The ddmin algorithm finds the minimal subset S of candidates such that running S + [failing-test] causes failing-test to fail. It does NOT run all candidates; it binary-splits and narrows.

Implement `async function cmdMaintainTestsDdmin(cwd, options, raw)`:

1. Read candidates from `--candidates-file` into array `candidates[]`. If empty, return early with `{ polluter_set: [], ddmin_ran: false, reason: "no candidates" }`.

2. Define helper `async function runSequence(prefix_files, target_file)`:
   - Build a temporary batch manifest with files = [...prefix_files, target_file]
   - Run each file in sequence using the same `runTestFile` logic (reuse the per-file runner from run-batch)
   - Return `true` if target_file result is "failed", `false` otherwise
   - Handle timeout: if total elapsed > timeoutMs, return `null` (inconclusive)

3. **Sanity check:** First verify the failing-test actually passes alone: `runSequence([], failing_test)`. If it fails alone, return `{ polluter_set: [], ddmin_ran: false, reason: "test fails in isolation — not an ordering issue" }`.

4. **Full set check:** Verify the full candidate set triggers the failure: `runSequence(candidates, failing_test)`. If it does NOT fail, return `{ polluter_set: [], ddmin_ran: true, reason: "full candidate set does not reproduce failure" }`.

5. **Ddmin loop** (standard ddmin2):
   ```
   n = 2  (granularity)
   remaining = candidates[:]
   while len(remaining) > 1:
     split remaining into n equal chunks
     for each chunk c_i:
       test runSequence(c_i, failing_test) → if fails: remaining = c_i, n = max(2, n-1), break
       test runSequence(remaining minus c_i, failing_test) → if fails: remaining = remaining minus c_i, n = max(2, n-1), break
     else (no reduction found):
       if n >= len(remaining): break
       n = min(n*2, len(remaining))
   polluter_set = remaining
   ```

6. Output JSON:
   ```json
   {
     "failing_test": "<path>",
     "polluter_set": ["<path1>", "<path2>"],
     "candidates_tested": <N>,
     "runs_performed": <M>,
     "ddmin_ran": true,
     "reason": "minimal polluter set found" | "timeout during ddmin"
   }
   ```

**Wire into the CLI switch** in the `case 'maintain-tests':` block, add:
```js
case 'ddmin': {
  const failingTestIdx = args.indexOf('--failing-test');
  const candidatesIdx = args.indexOf('--candidates-file');
  const timeoutIdx = args.indexOf('--timeout');
  const outputIdx = args.indexOf('--output-file');
  const runnerIdx = args.indexOf('--runner');
  await cmdMaintainTestsDdmin(cwd, {
    failingTest: failingTestIdx !== -1 ? args[failingTestIdx + 1] : null,
    candidatesFile: candidatesIdx !== -1 ? args[candidatesIdx + 1] : null,
    timeoutSec: timeoutIdx !== -1 ? parseInt(args[timeoutIdx + 1], 10) : 60,
    outputFile: outputIdx !== -1 ? args[outputIdx + 1] : null,
    runner: runnerIdx !== -1 ? args[runnerIdx + 1] : 'auto',
    env: process.env,
  }, raw);
  break;
}
```

Also update the `error()` fallback line to include `ddmin`:
`Available: discover, batch, run-batch, save-state, load-state, ddmin`

Also update the CLI comment block at top of file (the `*` docblock) to add:
`*   maintain-tests ddmin --failing-test <path> --candidates-file <path> [--timeout N] [--runner auto|jest|playwright|pytest] [--output-file path]`

Note: `runTestFile` is already defined in the file (used by `cmdMaintainTestsRunBatch`). Place `cmdMaintainTestsDdmin` right after `cmdMaintainTestsRunBatch` (after line ~6165). Reference `runTestFile` directly — do not duplicate it.

Important: The ddmin loop must cap total runs at 50 to avoid runaway execution. Track `runsPerformed` counter; if it hits 50, break the ddmin loop early and set `reason: "run cap reached"`.
  </action>
  <verify>
Run:
```bash
# Smoke test: no candidates → fast exit
echo '{"test_files":[]}' > /tmp/ddmin-candidates.json
node /Users/jonathanborduas/code/QGSD/get-shit-done/bin/gsd-tools.cjs maintain-tests ddmin \
  --failing-test some/test.test.js \
  --candidates-file /tmp/ddmin-candidates.json
# Should print JSON with ddmin_ran: false, reason: "no candidates"

# Syntax check
node --check /Users/jonathanborduas/code/QGSD/get-shit-done/bin/gsd-tools.cjs && echo "syntax OK"
```
  </verify>
  <done>
`node --check get-shit-done/bin/gsd-tools.cjs` passes with no syntax errors. The `maintain-tests ddmin --failing-test ... --candidates-file /tmp/empty.json` call returns JSON with `ddmin_ran: false` and `reason: "no candidates"`. The `Available:` error message includes `ddmin`.
  </done>
</task>

<task type="auto">
  <name>Task 2: Integrate ddmin into fix-tests.md workflow for isolate verdicts</name>
  <files>get-shit-done/workflows/fix-tests.md</files>
  <action>
Update the fix-tests workflow to run ddmin enrichment for isolate-classified failures before dispatch.

**Add a new Step 6d.1 (insert between 6d and 6e) titled "Ddmin enrichment for isolate verdicts":**

```markdown
### 6d.1. Ddmin enrichment for isolate verdicts

For each verdict produced in 6d where `category == "isolate"` AND `verdict.polluter_set` is not yet set:

1. Build a candidates list: all OTHER test files in the current batch (batch's `files` list minus the failing test itself).

2. If `candidates` is empty: set `verdict.polluter_set = []`, `verdict.ddmin_ran = false`. Skip to next.

3. Write candidates to a temp file:
   ```bash
   echo '{"test_files":["<file1>","<file2>","..."]}' > .planning/ddmin-candidates-temp.json
   ```

4. Run ddmin:
   ```bash
   node /Users/jonathanborduas/.claude/qgsd/bin/gsd-tools.cjs maintain-tests ddmin \
     --failing-test <verdict.file> \
     --candidates-file .planning/ddmin-candidates-temp.json \
     --timeout 30 \
     --output-file .planning/ddmin-result-temp.json
   ```

5. Read `.planning/ddmin-result-temp.json`. Extract `polluter_set` and `ddmin_ran`.

6. Update the verdict in `state.categorization_verdicts`:
   - Set `verdict.polluter_set = ddmin_result.polluter_set`
   - Set `verdict.ddmin_ran = ddmin_result.ddmin_ran`
   - Set `verdict.ddmin_reason = ddmin_result.reason`

7. Save state after all isolate verdicts in this batch are enriched.

Print after each enrichment:
`QGSD fix-tests: ddmin [{verdict.file}] → {len(polluter_set)} polluters found`

**Note:** Ddmin is best-effort — if it times out or returns no result, proceed with `polluter_set = []`. Never block dispatch on ddmin failure.
```

**Update Step 6h dispatch description for isolate category** — in the task description template, add a conditional polluter context block:

```
{if category == "isolate" AND verdict.polluter_set is non-empty:
"Polluter analysis (ddmin result — tests that cause this failure when run first):
{polluter_set[0]}
{polluter_set[1] if exists}
{... up to 5 polluters}
Tip: the polluter test(s) likely share state (global var, DB, port, file) with the failing test."}

{if category == "isolate" AND (verdict.polluter_set is empty OR ddmin_ran == false):
"Order dependency suspected but no specific polluter identified via ddmin. Check for shared global state, ports, or DB side-effects."}
```

**Update the Step 5 initial state JSON** to add `ddmin_results: []` field in the schema:
In the save-state JSON template in Step 5, append `,"ddmin_results":[]` to the JSON object before the closing `}`.

**Update the Step 9 terminal summary** to add a ddmin stats line:
In the Results section, add:
```
 Ddmin runs:   {count of categorization_verdicts where ddmin_ran == true} tests enriched
```
  </action>
  <verify>
Read the updated workflow file and confirm:
```bash
grep -n "ddmin" /Users/jonathanborduas/code/QGSD/get-shit-done/workflows/fix-tests.md
```
Should show references in: step 6d.1 header, the CLI call, the polluter_set verdict update, the dispatch template in 6h, the initial state JSON, and the terminal summary.
  </verify>
  <done>
`grep -c "ddmin" get-shit-done/workflows/fix-tests.md` returns >= 8 matches. Step 6d.1 exists between steps 6d and 6e. The dispatch description in 6h includes a polluter context block for isolate category. The state schema includes `ddmin_results: []`. The terminal summary includes a ddmin stats line.
  </done>
</task>

<task type="auto">
  <name>Task 3: Sync source changes to installed copies via install</name>
  <files>get-shit-done/bin/gsd-tools.cjs</files>
  <action>
The QGSD repo's `get-shit-done/` directory is the authoritative source. The install script copies it to `~/.claude/qgsd/` (and optionally to `~/.claude/get-shit-done/`). After Tasks 1 and 2 modify the source files, run the install to propagate changes to the installed copies so the updated `maintain-tests ddmin` subcommand and workflow are live for Claude Code.

Run from the QGSD repo root:
```bash
node /Users/jonathanborduas/code/QGSD/bin/install.js --claude --global
```

This copies `get-shit-done/bin/gsd-tools.cjs` → `~/.claude/qgsd/bin/gsd-tools.cjs` and `get-shit-done/workflows/fix-tests.md` → `~/.claude/qgsd/workflows/fix-tests.md`.

After install, spot-verify the installed copy has the new subcommand:
```bash
grep -c "cmdMaintainTestsDdmin" /Users/jonathanborduas/.claude/qgsd/bin/gsd-tools.cjs
```
  </action>
  <verify>
```bash
grep "ddmin" /Users/jonathanborduas/.claude/qgsd/bin/gsd-tools.cjs | grep "cmdMaintainTestsDdmin" | head -3
grep "ddmin" /Users/jonathanborduas/.claude/qgsd/workflows/fix-tests.md | head -3
```
Both greps return matches confirming installed copies were updated.
  </verify>
  <done>
`~/.claude/qgsd/bin/gsd-tools.cjs` contains `cmdMaintainTestsDdmin`. `~/.claude/qgsd/workflows/fix-tests.md` contains references to `ddmin`. Installed copies are in sync with source.
  </done>
</task>

</tasks>

<verification>
1. `node --check /Users/jonathanborduas/code/QGSD/get-shit-done/bin/gsd-tools.cjs` — syntax clean
2. `node /Users/jonathanborduas/code/QGSD/get-shit-done/bin/gsd-tools.cjs maintain-tests ddmin --failing-test x --candidates-file /dev/stdin <<< '{"test_files":[]}' ` — returns `{ ddmin_ran: false }`
3. `grep -c "ddmin" /Users/jonathanborduas/code/QGSD/get-shit-done/workflows/fix-tests.md` — returns >= 8
4. `grep "ddmin" /Users/jonathanborduas/code/QGSD/get-shit-done/workflows/fix-tests.md | grep "6d.1"` — step exists
5. `grep "cmdMaintainTestsDdmin" /Users/jonathanborduas/.claude/qgsd/bin/gsd-tools.cjs` — installed copy updated
</verification>

<success_criteria>
- `maintain-tests ddmin` CLI subcommand exists and handles edge cases (empty candidates, test fails alone, full set doesn't reproduce)
- fix-tests.md workflow runs ddmin on all isolate verdicts in step 6d.1 before dispatch
- Dispatch task descriptions for isolate failures include polluter context when ddmin found one
- Both source files (`get-shit-done/bin/gsd-tools.cjs` and `get-shit-done/workflows/fix-tests.md`) are propagated to `~/.claude/qgsd/` via `node bin/install.js --claude --global` (Task 3). The installed copies are the live versions used by Claude Code.
</success_criteria>

<output>
After completion, create `.planning/quick/55-in-qgsd-fix-tests-we-could-use-ddmin-ins/55-SUMMARY.md`
</output>
