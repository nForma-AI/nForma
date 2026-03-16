---
phase: quick-298
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - bin/nf-solve.cjs
  - bin/nf-solve.test.cjs
autonomous: true
formal_artifacts: none
must_haves:
  truths:
    - "sweepTtoC stores a lightweight digest (~50KB) in detail.v8_coverage instead of raw V8 blobs (~96MB)"
    - "crossReferenceFormalCoverage produces identical results from the digest format"
    - "Raw V8 coverage data is GC-eligible immediately after digestion"
    - "All existing tests pass without modification to assertions (except format-aware ones)"
  artifacts:
    - path: "bin/nf-solve.cjs"
      provides: "digestV8Coverage function + updated sweepTtoC and crossReferenceFormalCoverage"
      contains: "function digestV8Coverage"
    - path: "bin/nf-solve.test.cjs"
      provides: "Tests for digestV8Coverage and updated crossReferenceFormalCoverage"
      contains: "digestV8Coverage"
  key_links:
    - from: "sweepTtoC"
      to: "digestV8Coverage"
      via: "called after raw coverage collection, replaces coverageData"
      pattern: "digestV8Coverage\\(coverageData\\)"
    - from: "crossReferenceFormalCoverage"
      to: "digest format"
      via: "reads coveredFiles from digest instead of parsing raw V8 blobs"
      pattern: "coveredFiles"
    - from: "module.exports"
      to: "digestV8Coverage"
      via: "exported for testing"
      pattern: "digestV8Coverage"
---

<objective>
Digest V8 coverage at collection time in sweepTtoC, replacing raw 96MB blobs with a lightweight Map of per-file covered/uncovered line sets (~50KB).

Purpose: Eliminate 96MB of raw V8 JSON from solve output, reducing serialization time and output size by ~99%.
Output: digestV8Coverage function in nf-solve.cjs, updated crossReferenceFormalCoverage to consume digest format, tests.
</objective>

<execution_context>
@/Users/jonathanborduas/.claude/nf/workflows/execute-plan.md
@/Users/jonathanborduas/.claude/nf/templates/summary.md
</execution_context>

<context>
@bin/nf-solve.cjs (lines 906-1093 — sweepTtoC + crossReferenceFormalCoverage)
@bin/nf-solve.test.cjs (lines 674-718 — TC-COV tests)
</context>

<tasks>

<task type="auto">
  <name>Task 1: Create digestV8Coverage and wire into sweepTtoC</name>
  <files>bin/nf-solve.cjs</files>
  <action>
1. Create `digestV8Coverage(coverageData)` function (place it above `crossReferenceFormalCoverage`, around line 1015):
   - Input: array of V8 coverage entries (each has `.result[]` with `.url`, `.functions[].ranges[]`)
   - Output: plain object `{ files: { [absolutePath]: { covered: number[], uncovered: number[] } } }`
   - For each entry.result item:
     a. Extract file path from `r.url` (strip `file://` prefix)
     b. Resolve to absolute path via `path.resolve()`
     c. Skip entries without `.url` or internal node: URLs
     d. Get the script source text from `r.source` (V8 includes it) — if no source, use the function ranges to determine coverage without line mapping (just mark file as covered/uncovered at file level)
     e. Build a line-offset array from source by finding newline positions
     f. For each function's ranges: map startOffset/endOffset to line numbers using the offset array. Lines with any range having count > 0 go into `covered`, rest go into `uncovered`
     g. Deduplicate and sort the line arrays
   - If `r.source` is not available (some V8 versions omit it), fall back to file-level granularity: if ANY function range has count > 0, mark file as `{ covered: true, uncovered: false }` (boolean fallback)
   - Return the digest object. Fail-open: if any individual entry throws, skip it and continue

2. In `sweepTtoC()`, after the coverage collection block (after line 966 `if (coverageData.length === 0) coverageData = null;`), add:
   ```
   if (coverageData) {
     coverageData = digestV8Coverage(coverageData);
   }
   ```
   This replaces the raw array with the digest, allowing raw data to be GC'd.

3. Update `crossReferenceFormalCoverage(v8CoverageData)` (lines 1018-1093) to handle BOTH formats:
   - If `v8CoverageData.files` exists (new digest format): build `coveredFiles` Set directly from `Object.keys(v8CoverageData.files)`
   - Else if Array.isArray (legacy raw format): use existing parsing logic (for backward compat during transition)
   - The rest of the function (recipe matching, false green detection) stays identical — it only needs the `coveredFiles` Set

4. Export `digestV8Coverage` in module.exports (add after `crossReferenceFormalCoverage` on line 4169).
  </action>
  <verify>
Run: `node --test bin/nf-solve.test.cjs 2>&1 | tail -20` — all existing tests must pass.
Grep: `grep -n 'digestV8Coverage' bin/nf-solve.cjs` shows function definition, call site in sweepTtoC, and module.exports entry.
  </verify>
  <done>
digestV8Coverage function exists and is called in sweepTtoC. crossReferenceFormalCoverage handles both digest and legacy formats. All existing TC-COV tests pass unchanged.
  </done>
</task>

<task type="auto">
  <name>Task 2: Add tests for digestV8Coverage and verify output size reduction</name>
  <files>bin/nf-solve.test.cjs</files>
  <action>
Add a new test section after the TC-COV block (after line 718). Import `digestV8Coverage` from the destructured require at top of file (line ~39).

Tests to add:

1. `DIGEST-1: digestV8Coverage returns null-safe on null/undefined input` — call with null, expect falsy or empty result (match fail-open behavior)

2. `DIGEST-2: digestV8Coverage extracts file paths from V8 format` — create a mock V8 entry:
   ```javascript
   const mock = [{
     result: [{
       url: 'file:///abs/path/to/file.js',
       source: 'line1\nline2\nline3\n',
       functions: [{
         ranges: [{ startOffset: 0, endOffset: 5, count: 1 }, { startOffset: 6, endOffset: 11, count: 0 }]
       }]
     }]
   }];
   ```
   Assert: result.files has key `/abs/path/to/file.js`, covered array includes line 1, uncovered includes line 2.

3. `DIGEST-3: digestV8Coverage output is dramatically smaller than input` — create a mock with 100+ function entries with large source text (repeat 'x'.repeat(10000)), digest it, compare `JSON.stringify` sizes: digest must be < 1% of raw size.

4. `DIGEST-4: crossReferenceFormalCoverage works with digest format` — create a digest object `{ files: { '/some/file.js': { covered: [1,2,3], uncovered: [4,5] } } }`, pass to crossReferenceFormalCoverage, assert `available: true`.

5. `DIGEST-5: sweepTtoC v8_coverage is digest format (not raw array)` — call sweepTtoC(), if v8_coverage is not null, assert it has `.files` property (digest format), NOT Array.isArray (raw format).
  </action>
  <verify>
Run: `node --test bin/nf-solve.test.cjs 2>&1 | grep -E '(pass|fail|DIGEST)'` — all DIGEST tests pass, zero failures overall.
  </verify>
  <done>
5 new tests validate digestV8Coverage function behavior, size reduction, and integration with crossReferenceFormalCoverage. All tests (existing + new) pass.
  </done>
</task>

</tasks>

<verification>
1. `node --test bin/nf-solve.test.cjs` — all tests pass (0 failures)
2. `grep 'digestV8Coverage' bin/nf-solve.cjs | wc -l` — at least 3 matches (definition, call site, export)
3. `grep 'v8CoverageData.files' bin/nf-solve.cjs` — confirms digest format handling in crossReferenceFormalCoverage
4. No raw V8 arrays stored in detail.v8_coverage after sweepTtoC runs
</verification>

<success_criteria>
- sweepTtoC stores digest format (~50KB) not raw V8 blobs (~96MB) in detail.v8_coverage
- crossReferenceFormalCoverage produces correct results from digest format
- All 5+ existing TC-COV tests pass unchanged
- 5 new DIGEST tests validate the digest function and integration
- digestV8Coverage is exported for direct testing
</success_criteria>

<output>
After completion, create `.planning/quick/298-digest-v8-coverage-at-collection-time-in/298-SUMMARY.md`
</output>
