---
phase: quick-141
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - bin/formal-test-sync.cjs
  - bin/qgsd-solve.cjs
  - bin/formal-test-sync.test.cjs
autonomous: true
formal_artifacts: none
requirements: [QUICK-141]

must_haves:
  truths:
    - "parseAlloyDefaults() correctly parses all 3 constants (defaultOscDepth, defaultCommitWindow, defaultFailMode) from a newline-separated Alloy constraint block"
    - "The solver loop in qgsd-solve.cjs clears formalTestSyncCache at the top of each iteration so computeResidual() sees fresh data after autoClose() mutates files"
    - "Running `node --test bin/formal-test-sync.test.cjs` passes all existing tests plus the 4 new TC-ALLOY-PARSE tests"
  artifacts:
    - path: "bin/formal-test-sync.cjs"
      provides: "Fixed parseAlloyDefaults splitting on newlines, tighter regex, and module.exports + require.main guard"
      contains: "split('\\n').filter"
    - path: "bin/qgsd-solve.cjs"
      provides: "Cache invalidation at top of solver loop"
      contains: "formalTestSyncCache = null"
    - path: "bin/formal-test-sync.test.cjs"
      provides: "Unit test for parseAlloyDefaults with multi-line constraint block"
      contains: "TC-ALLOY-PARSE"
  key_links:
    - from: "bin/qgsd-solve.cjs"
      to: "bin/formal-test-sync.cjs"
      via: "Spawns formal-test-sync.cjs via spawnTool, cache must be cleared between iterations"
      pattern: "formalTestSyncCache = null"
    - from: "bin/formal-test-sync.test.cjs"
      to: "bin/formal-test-sync.cjs"
      via: "Imports parseAlloyDefaults for unit testing"
      pattern: "require.*formal-test-sync.*parseAlloyDefaults"
---

<objective>
Fix two bugs in the solver loop: (1) parseAlloyDefaults() in formal-test-sync.cjs splits on comma instead of newline, causing only the first constant to be parsed from Alloy constraint blocks; (2) formalTestSyncCache in qgsd-solve.cjs is never cleared between solver iterations, causing stale data after autoClose() mutates files. Add a unit test proving the parse fix works.

Purpose: Without these fixes, the solver's C->F residual layer reports incorrect constant mismatches (missing 2 of 3 defaults), and multi-iteration solving reads stale formal-test-sync results that never change.
Output: Fixed bin/formal-test-sync.cjs, fixed bin/qgsd-solve.cjs, new test in bin/formal-test-sync.test.cjs.
</objective>

<execution_context>
@/Users/jonathanborduas/.claude/qgsd/workflows/execute-plan.md
@/Users/jonathanborduas/.claude/qgsd/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@bin/formal-test-sync.cjs
@bin/qgsd-solve.cjs
@bin/formal-test-sync.test.cjs
@.formal/alloy/config-two-layer.als
</context>

<tasks>

<task type="auto">
  <name>Task 1: Fix parseAlloyDefaults parsing and add module exports to formal-test-sync.cjs</name>
  <files>
    bin/formal-test-sync.cjs
  </files>
  <action>
Two changes in `bin/formal-test-sync.cjs`:

**Fix 1 — parseAlloyDefaults() (line 205-208):**

The Alloy constraint block format is newline-separated, not comma-separated. The real file `.formal/alloy/config-two-layer.als` has:
```
} {
  defaultOscDepth = 3
  defaultCommitWindow = 6
  defaultFailMode = FailOpen
}
```

Change line 205 from:
```javascript
const pairs = constraintBlock.split(',');
```
to:
```javascript
const pairs = constraintBlock.split('\n');
```

Change line 208 regex from:
```javascript
const kv = trimmed.match(/(\w+)\s*=\s*(.+)/);
```
to:
```javascript
const kv = trimmed.match(/^\s*(\w+)\s*=\s*(\S+)\s*$/);
```

The anchored regex with `\S+` prevents greedy multi-line capture and trims whitespace properly.

**Fix 1b — Filter blank lines and comment lines before regex matching:**

Before the `for` loop that iterates over `pairs`, add a filter step to skip blank lines and Alloy comment lines (lines starting with `--` or `//`). This prevents the anchored regex from failing on real-world Alloy files that contain blank lines or inline comments within constraint blocks:

```javascript
const pairs = constraintBlock.split('\n')
  .filter(line => {
    const t = line.trim();
    return t.length > 0 && !t.startsWith('--') && !t.startsWith('//');
  });
```

This replaces the separate `.split('\n')` and loop — the filter is applied inline so only key=value candidate lines reach the regex.

**Fix 2 — Add module.exports and require.main guard (end of file):**

Currently line 587 is bare `main();`. Replace it with:
```javascript
// ── Exports (for testing) ────────────────────────────────────────────────────

module.exports = { parseAlloyDefaults };

// ── Entry point ──────────────────────────────────────────────────────────────

if (require.main === module) {
  main();
}
```

This allows the test file to `require('./formal-test-sync.cjs')` and call `parseAlloyDefaults()` directly without triggering the full `main()` execution.
  </action>
  <verify>
    1. `node -e "const m = require('./bin/formal-test-sync.cjs'); const r = m.parseAlloyDefaults('one sig Defaults { defaultOscDepth: one Int, defaultCommitWindow: one Int, defaultFailMode: one FailMode } { defaultOscDepth = 3\ndefaultCommitWindow = 6\ndefaultFailMode = FailOpen }'); console.log(JSON.stringify(r))"` prints `{"defaultOscDepth":3,"defaultCommitWindow":6,"defaultFailMode":"FailOpen"}` (all 3 constants).
    2. `node -e "const m = require('./bin/formal-test-sync.cjs'); console.log(typeof m.parseAlloyDefaults)"` prints `function` (export works, main() does not execute).
    3. `node bin/formal-test-sync.cjs --json --report-only` still exits 0 with valid JSON (main() still works when invoked directly).
  </verify>
  <done>
    parseAlloyDefaults() correctly parses all 3 Alloy default constants from newline-separated constraint blocks. The function is exported for unit testing. The require.main guard prevents main() from firing on require().
  </done>
</task>

<task type="auto">
  <name>Task 2: Fix stale cache in solver loop and add parseAlloyDefaults unit test</name>
  <files>
    bin/qgsd-solve.cjs
    bin/formal-test-sync.test.cjs
  </files>
  <action>
**Fix 1 — Cache invalidation in qgsd-solve.cjs main loop (line ~692):**

In the `main()` function, add cache invalidation at the top of the `for` loop body (after `process.stderr.write(TAG + ' Iteration ' + i + ...)`), BEFORE calling `computeResidual()`. Add this line after line 691 (the stderr write):

```javascript
    // Clear formal-test-sync cache so computeResidual() sees fresh data after autoClose() mutations
    formalTestSyncCache = null;
```

This ensures that after `autoClose()` runs `formal-test-sync.cjs` (which may generate stubs, update sidecar, etc.), the next iteration's `computeResidual()` will re-run the tool and parse fresh results instead of reading the stale cached JSON.

**Fix 2 — Add TC-ALLOY-PARSE test to bin/formal-test-sync.test.cjs:**

Insert a new test section between the existing TC-STUB section and the TC-INT section. Locate the last TC-STUB test closure (`});`) and the `// ── TC-INT` header comment, and insert the new block between them. Add:

```javascript
// ── TC-ALLOY: Alloy Defaults Parsing Tests ──────────────────────────────────

test('TC-ALLOY-PARSE-1: parseAlloyDefaults parses all 3 constants from newline-separated block', () => {
  const { parseAlloyDefaults } = require('./formal-test-sync.cjs');

  const alloyContent = `-- Hardcoded defaults for fallback
one sig Defaults {
  defaultOscDepth: one Int,
  defaultCommitWindow: one Int,
  defaultFailMode: one FailMode
} {
  defaultOscDepth = 3
  defaultCommitWindow = 6
  defaultFailMode = FailOpen
}`;

  const result = parseAlloyDefaults(alloyContent);
  assert.equal(result.defaultOscDepth, 3, 'defaultOscDepth should be 3');
  assert.equal(result.defaultCommitWindow, 6, 'defaultCommitWindow should be 6');
  assert.equal(result.defaultFailMode, 'FailOpen', 'defaultFailMode should be FailOpen');
  assert.equal(Object.keys(result).length, 3, 'should have exactly 3 constants');
});

test('TC-ALLOY-PARSE-2: parseAlloyDefaults returns empty object when no Defaults sig found', () => {
  const { parseAlloyDefaults } = require('./formal-test-sync.cjs');

  const alloyContent = `sig Foo { bar: one Int }`;
  const result = parseAlloyDefaults(alloyContent);
  assert.deepEqual(result, {}, 'should return empty object when no Defaults sig');
});

test('TC-ALLOY-PARSE-3: parseAlloyDefaults handles single constant', () => {
  const { parseAlloyDefaults } = require('./formal-test-sync.cjs');

  const alloyContent = `one sig Defaults {
  depth: one Int
} {
  depth = 5
}`;

  const result = parseAlloyDefaults(alloyContent);
  assert.equal(result.depth, 5, 'depth should be 5');
  assert.equal(Object.keys(result).length, 1, 'should have exactly 1 constant');
});

test('TC-ALLOY-PARSE-4: parseAlloyDefaults handles blank lines and comments in constraint block', () => {
  const { parseAlloyDefaults } = require('./formal-test-sync.cjs');

  const alloyContent = `one sig Defaults {
  defaultOscDepth: one Int,
  defaultCommitWindow: one Int,
  defaultFailMode: one FailMode
} {
  -- oscillation depth
  defaultOscDepth = 3

  // commit window size
  defaultCommitWindow = 6

  defaultFailMode = FailOpen
}`;

  const result = parseAlloyDefaults(alloyContent);
  assert.equal(result.defaultOscDepth, 3, 'defaultOscDepth should be 3');
  assert.equal(result.defaultCommitWindow, 6, 'defaultCommitWindow should be 6');
  assert.equal(result.defaultFailMode, 'FailOpen', 'defaultFailMode should be FailOpen');
  assert.equal(Object.keys(result).length, 3, 'should have exactly 3 constants despite blank lines and comments');
});
```

These tests verify:
- TC-ALLOY-PARSE-1: The primary bug fix -- all 3 constants are parsed from a realistic multi-line block matching the actual `.formal/alloy/config-two-layer.als` format.
- TC-ALLOY-PARSE-2: Edge case -- no Defaults sig returns empty object.
- TC-ALLOY-PARSE-3: Edge case -- single constant still works.
- TC-ALLOY-PARSE-4: Robustness -- blank lines and Alloy comment lines (`--`, `//`) inside constraint blocks do not break parsing.
  </action>
  <verify>
    1. `node --test bin/formal-test-sync.test.cjs` -- all tests pass, including TC-ALLOY-PARSE-1/2/3/4.
    2. `grep -c 'formalTestSyncCache = null' bin/qgsd-solve.cjs` -- returns 2 or more (the original initialization on line 135, plus the new invalidation inside the loop).
    3. Verify cache invalidation placement: `grep -n 'formalTestSyncCache = null\|computeResidual' bin/qgsd-solve.cjs` -- confirm the new `formalTestSyncCache = null` line number is INSIDE the for-loop body AND appears BEFORE the `computeResidual()` call line number. The invalidation must precede `computeResidual()` within the same loop iteration.
    4. `grep 'TC-ALLOY-PARSE' bin/formal-test-sync.test.cjs | wc -l` -- returns at least 4 (the 4 test names).
  </verify>
  <done>
    The solver loop clears formalTestSyncCache at the top of each iteration (before computeResidual()), ensuring computeResidual() always gets fresh results after autoClose() mutations. Four new unit tests prove parseAlloyDefaults() correctly parses multi-line Alloy constraint blocks — including blocks with blank lines and comments — with all constants returned.
  </done>
</task>

</tasks>

<verification>
1. `node -e "const m = require('./bin/formal-test-sync.cjs'); const r = m.parseAlloyDefaults(require('fs').readFileSync('.formal/alloy/config-two-layer.als','utf8')); console.log(JSON.stringify(r))"` -- prints object with all 3 keys: defaultOscDepth, defaultCommitWindow, defaultFailMode.
2. `node --test bin/formal-test-sync.test.cjs` -- all tests pass (existing + new TC-ALLOY-PARSE).
3. `node bin/formal-test-sync.cjs --json --report-only` -- exits 0 with valid JSON (no regression).
4. `node bin/qgsd-solve.cjs --json --report-only` -- exits without crash, valid JSON output.
5. `grep -n 'formalTestSyncCache = null\|computeResidual' bin/qgsd-solve.cjs` -- shows cache invalidation line number is inside the loop body AND before the `computeResidual()` call.
</verification>

<success_criteria>
- parseAlloyDefaults() returns all 3 constants from the real config-two-layer.als file
- formalTestSyncCache is cleared at the start of each solver iteration
- All existing tests continue to pass (no regression)
- 4 new TC-ALLOY-PARSE tests pass (including TC-ALLOY-PARSE-4 for blank lines and comments)
- formal-test-sync.cjs exports parseAlloyDefaults and guards main() behind require.main
</success_criteria>

<output>
After completion, create `.planning/quick/141-fix-solver-loop-bugs-parsealloydefaults-/141-SUMMARY.md`
</output>
