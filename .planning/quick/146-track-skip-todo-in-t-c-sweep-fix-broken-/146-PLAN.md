---
phase: quick-146
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - bin/qgsd-solve.cjs
  - bin/qgsd-solve.test.cjs
  - commands/qgsd/solve.md
autonomous: true
requirements: [QUICK-146]
formal_artifacts: none

must_haves:
  truths:
    - "sweepTtoC parses both # and i prefix formats from Node TAP output"
    - "sweepTtoC returns skipped and todo counts in detail object"
    - "residual equals failed + skipped (not just failed)"
    - "formatReport T->C section displays skipped and todo counts"
    - "solve.md remediation dispatches fix-tests when skips > 0"
  artifacts:
    - path: "bin/qgsd-solve.cjs"
      provides: "Updated sweepTtoC with dual-format regex and skip/todo parsing"
      contains: "skipMatch"
    - path: "bin/qgsd-solve.test.cjs"
      provides: "TC-TAP-PARSE and TC-RESIDUAL-SKIP test cases"
      contains: "TC-TAP-PARSE"
    - path: "commands/qgsd/solve.md"
      provides: "Updated T->C remediation dispatch covering skips"
      contains: "skip"
  key_links:
    - from: "bin/qgsd-solve.cjs"
      to: "sweepTtoC return value"
      via: "residual = failCount + skipCount"
      pattern: "residual:\\s*failCount\\s*\\+\\s*skipCount"
    - from: "bin/qgsd-solve.cjs"
      to: "formatReport T->C section"
      via: "detail.skipped and detail.todo rendering"
      pattern: "detail\\.skipped|detail\\.todo"
    - from: "commands/qgsd/solve.md"
      to: "bin/qgsd-solve.cjs"
      via: "remediation dispatch reads t_to_c residual"
      pattern: "skip"
---

<objective>
Fix broken TAP regex in sweepTtoC() that only matches `#` prefix (Node <= v24) but not `i` prefix (Node v25+), and add skip/todo tracking to the T->C residual detail. Update formatReport display and solve.md remediation dispatch to account for skipped tests.

Purpose: Node v25 changed TAP summary output from `# tests N` to `i tests N`. The current regex silently falls back to ok/not-ok counting, missing skip/todo entirely. This makes the solver blind to skipped tests that inflate residual noise.

Output: Updated sweepTtoC with dual-format parsing, new test cases, and updated solve.md dispatch.
</objective>

<execution_context>
@/Users/jonathanborduas/.claude/qgsd/workflows/execute-plan.md
@/Users/jonathanborduas/.claude/qgsd/templates/summary.md
</execution_context>

<context>
@bin/qgsd-solve.cjs
@bin/qgsd-solve.test.cjs
@commands/qgsd/solve.md
</context>

<tasks>

<task type="auto">
  <name>Task 1: Fix TAP regex and add skip/todo parsing in sweepTtoC</name>
  <files>bin/qgsd-solve.cjs</files>
  <action>
1. In sweepTtoC() (lines 468-495), replace the `#`-only regex with dual-format character class matching that handles both Node <= v24 (`# tests N`) and Node v25+ (`i tests N`):
   ```javascript
   const testsMatch = output.match(/^[ℹ#]\s+tests\s+(\d+)/m);
   const failMatch  = output.match(/^[ℹ#]\s+fail\s+(\d+)/m);
   const skipMatch  = output.match(/^[ℹ#]\s+skipped\s+(\d+)/m);
   const todoMatch  = output.match(/^[ℹ#]\s+todo\s+(\d+)/m);
   ```

2. Parse all four values with parseInt fallback to 0:
   ```javascript
   if (testsMatch) totalTests = parseInt(testsMatch[1], 10);
   if (failMatch) failCount = parseInt(failMatch[1], 10);
   const skipCount = skipMatch ? parseInt(skipMatch[1], 10) : 0;
   const todoCount = todoMatch ? parseInt(todoMatch[1], 10) : 0;
   ```

3. Update the return object so residual = failCount + skipCount (skips are unresolved gaps) and detail includes all four counters:
   ```javascript
   return {
     residual: failCount + skipCount,
     detail: {
       total_tests: totalTests,
       passed: Math.max(0, totalTests - failCount - skipCount - todoCount),
       failed: failCount,
       skipped: skipCount,
       todo: todoCount,
     },
   };
   ```

4. Keep the existing ok/not-ok fallback block intact for edge cases where no summary line is found. In that fallback, set skipCount and todoCount to 0.

5. Update formatReport() (~line 1090-1100) T->C section to display skipped/todo counts with symbols:
   Replace:
   ```javascript
   lines.push('Failed tests: ' + detail.failed + ' / ' + detail.total_tests);
   ```
   With:
   ```javascript
   const parts = [];
   if (detail.failed > 0) parts.push('\u2717 ' + detail.failed + ' failed');
   if (detail.skipped > 0) parts.push('\u2298 ' + detail.skipped + ' skipped');
   if (detail.todo > 0) parts.push('\u25F7 ' + detail.todo + ' todo');
   lines.push('Tests: ' + parts.join(', ') + ' (of ' + detail.total_tests + ' total)');
   ```

6. Export sweepTtoC in module.exports so tests can unit-test it directly.
  </action>
  <verify>Run `node --test bin/qgsd-solve.test.cjs` — all existing tests pass (no regressions). Manually confirm: `node -e "const s = require('./bin/qgsd-solve.cjs'); console.log(typeof s.sweepTtoC)"` prints "function".</verify>
  <done>sweepTtoC matches both # and i prefixes, returns {failed, skipped, todo} in detail, residual = failed + skipped. formatReport shows expanded T->C info. sweepTtoC is exported.</done>
</task>

<task type="auto">
  <name>Task 2: Add unit tests for dual-format TAP parsing and skip/todo</name>
  <files>bin/qgsd-solve.test.cjs</files>
  <action>
1. Add sweepTtoC to the destructured import at top of file (line 24-33):
   ```javascript
   const { ..., sweepTtoC } = require('./qgsd-solve.cjs');
   ```

2. Update TC-FORMAT-2 mock (line 94) to include skipped and todo fields in t_to_c detail:
   ```javascript
   t_to_c: { residual: 1, detail: { failed: 1, skipped: 0, todo: 0, total_tests: 10 } },
   ```

3. Add a new test section "TC-TAP-PARSE" after TC-SWEEP-DC tests:

   TC-TAP-PARSE-1: verify i prefix regex matches Node v25 output. Create a mock helper that tests the regex directly:
   ```javascript
   test('TC-TAP-PARSE-1: dual-format regex matches i prefix (Node v25)', () => {
     const output = 'i tests 42\ni pass 40\ni fail 1\ni skipped 1\ni todo 0\ni duration_ms 123';
     const testsMatch = output.match(/^[ℹ#]\s+tests\s+(\d+)/m);
     const failMatch = output.match(/^[ℹ#]\s+fail\s+(\d+)/m);
     const skipMatch = output.match(/^[ℹ#]\s+skipped\s+(\d+)/m);
     assert.ok(testsMatch, 'should match i prefix for tests');
     assert.equal(testsMatch[1], '42');
     assert.ok(failMatch, 'should match i prefix for fail');
     assert.equal(failMatch[1], '1');
     assert.ok(skipMatch, 'should match i prefix for skipped');
     assert.equal(skipMatch[1], '1');
   });
   ```

   TC-TAP-PARSE-2: verify # prefix still works (Node <= v24):
   ```javascript
   test('TC-TAP-PARSE-2: dual-format regex matches # prefix (Node <= v24)', () => {
     const output = '# tests 10\n# pass 8\n# fail 2\n# skipped 0\n# todo 0';
     const testsMatch = output.match(/^[ℹ#]\s+tests\s+(\d+)/m);
     const failMatch = output.match(/^[ℹ#]\s+fail\s+(\d+)/m);
     assert.ok(testsMatch);
     assert.equal(testsMatch[1], '10');
     assert.ok(failMatch);
     assert.equal(failMatch[1], '2');
   });
   ```

   TC-TAP-PARSE-3: verify skip/todo extraction:
   ```javascript
   test('TC-TAP-PARSE-3: skip and todo counts extracted', () => {
     const output = 'i tests 20\ni fail 1\ni skipped 3\ni todo 2';
     const skipMatch = output.match(/^[ℹ#]\s+skipped\s+(\d+)/m);
     const todoMatch = output.match(/^[ℹ#]\s+todo\s+(\d+)/m);
     assert.ok(skipMatch);
     assert.equal(parseInt(skipMatch[1], 10), 3);
     assert.ok(todoMatch);
     assert.equal(parseInt(todoMatch[1], 10), 2);
   });
   ```

   TC-RESIDUAL-SKIP-1: verify residual = failed + skipped via integration:
   ```javascript
   test('TC-RESIDUAL-SKIP-1: sweepTtoC residual includes skipped count', () => {
     // Integration test: run actual tests and verify detail shape
     const result = sweepTtoC();
     assert.ok(typeof result === 'object');
     assert.ok(typeof result.residual === 'number');
     assert.ok(typeof result.detail === 'object');
     assert.ok('skipped' in result.detail, 'detail must include skipped field');
     assert.ok('todo' in result.detail, 'detail must include todo field');
     assert.ok('failed' in result.detail, 'detail must include failed field');
     // residual should equal failed + skipped
     assert.equal(result.residual, result.detail.failed + result.detail.skipped);
   });
   ```
  </action>
  <verify>Run `node --test bin/qgsd-solve.test.cjs` — all tests pass including TC-TAP-PARSE-1, TC-TAP-PARSE-2, TC-TAP-PARSE-3, TC-RESIDUAL-SKIP-1.</verify>
  <done>Four new tests cover dual-format regex, skip/todo extraction, and residual=failed+skipped invariant. TC-FORMAT-2 mock updated. All tests green.</done>
</task>

<task type="auto">
  <name>Task 3: Update solve.md remediation dispatch for skips</name>
  <files>commands/qgsd/solve.md</files>
  <action>
1. In Step 3c T->C Gaps section (line 109-120), update the condition and log message to also dispatch when skips > 0:
   Replace the current text:
   ```
   ### 3c. T->C Gaps (residual_vector.t_to_c.residual > 0)

   Dispatch the fix-tests skill:
   ...
   This will discover and autonomously fix failing tests.

   Log: `"Dispatching T->C remediation: fix-tests for {N} failing tests"`
   ```
   With:
   ```
   ### 3c. T->C Gaps (residual_vector.t_to_c.residual > 0)

   The T->C residual counts both failures and skipped tests. Extract detail:
   - `detail.failed` — tests that ran and failed
   - `detail.skipped` — tests marked skip (still count as unresolved gaps)
   - `detail.todo` — tests marked todo (informational, do not inflate residual)

   Dispatch the fix-tests skill:
   ```
   /qgsd:fix-tests
   ```

   This will discover and autonomously fix failing AND skipped tests. Skipped tests often indicate incomplete implementations or platform-specific guards that need resolution.

   Log: `"Dispatching T->C remediation: fix-tests for {failed} failing + {skipped} skipped tests"`
   ```

2. In Step 6 Before/After Summary (line 252), update the T->C expansion detail format:
   Replace:
   ```
   - **T->C**: List failing test names and error summaries
   ```
   With:
   ```
   - **T->C**: Show counts with symbols (fail, skip, todo) and list failing test names with error summaries. Format: `N failed, N skipped, N todo (of M total)`
   ```

   Add a T->C expansion example after the existing F->C example (around line 263):
   ```
   Example T->C expansion:
   ```
   T -> C Detail:
     Tests: 2 failed, 3 skipped, 1 todo (of 42 total)
   ```
   ```
  </action>
  <verify>Read commands/qgsd/solve.md and confirm: Step 3c mentions skipped tests in dispatch condition and log format; Step 6 T->C expansion shows skip/todo symbols.</verify>
  <done>solve.md routes skip-heavy suites to fix-tests for diagnosis. Step 6 expansion format shows fail/skip/todo breakdown.</done>
</task>

</tasks>

<verification>
1. `node --test bin/qgsd-solve.test.cjs` — all tests pass (0 failures)
2. `node -e "const s = require('./bin/qgsd-solve.cjs'); const d = s.sweepTtoC().detail; console.log('skipped' in d, 'todo' in d)"` prints `true true`
3. `grep -c 'ℹ#' bin/qgsd-solve.cjs` returns >= 4 (dual-format regexes)
4. `grep 'skipped' commands/qgsd/solve.md | head -3` shows skip-aware remediation text
</verification>

<success_criteria>
- sweepTtoC matches both # and i TAP prefixes without regression
- detail object contains failed, skipped, and todo counts
- residual = failed + skipped (todo is informational only)
- formatReport T->C section shows expanded fail/skip/todo breakdown
- solve.md dispatches fix-tests for skip > 0 (not just fail > 0)
- All existing + 4 new tests pass
</success_criteria>

<output>
After completion, create `.planning/quick/146-track-skip-todo-in-t-c-sweep-fix-broken-/146-SUMMARY.md`
</output>
