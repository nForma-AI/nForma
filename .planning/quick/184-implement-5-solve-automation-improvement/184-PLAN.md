---
phase: quick-184
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - bin/formal-test-sync.cjs
  - bin/qgsd-solve.cjs
  - .planning/formal/acknowledged-false-positives.json
autonomous: true
formal_artifacts: none
requirements:
  - SOLVE-7

must_haves:
  truths:
    - "Recipe sidecars emit absolute paths so executors never compute relative paths"
    - "Recipe sidecars include a template field classifying the test pattern"
    - "--fast flag skips F->C and T->C layers for sub-second iteration"
    - "D->C scanner suppresses false positives matching pattern rules in acknowledged-false-positives.json"
    - "Category B reverse discovery candidates are auto-acknowledged without human review"
  artifacts:
    - path: "bin/formal-test-sync.cjs"
      provides: "Recipe sidecar generation with absolute paths and template classification"
      contains: "source_file_absolute"
    - path: "bin/qgsd-solve.cjs"
      provides: "Fast mode, pattern-based FP suppression, auto-acknowledge Category B"
      contains: "--fast"
    - path: ".planning/formal/acknowledged-false-positives.json"
      provides: "Pattern-based suppression rules for D->C false positives"
      contains: "patterns"
  key_links:
    - from: "bin/formal-test-sync.cjs"
      to: "recipe JSON sidecar"
      via: "generateStubs function writing absolute paths + template field"
      pattern: "source_file_absolute|template"
    - from: "bin/qgsd-solve.cjs"
      to: "computeResidual"
      via: "fast mode skipping sweepFtoC and sweepTtoC"
      pattern: "fastMode"
    - from: "bin/qgsd-solve.cjs"
      to: ".planning/formal/acknowledged-false-positives.json"
      via: "pattern-based suppression in sweepDtoC"
      pattern: "patterns"
    - from: "bin/qgsd-solve.cjs"
      to: ".planning/formal/acknowledged-not-required.json"
      via: "auto-write Category B candidates in assembleReverseCandidates"
      pattern: "category.*B"
---

<objective>
Implement 5 solve automation improvements to reduce friction in the `/qgsd:solve` convergence loop.

Purpose: The solve loop currently wastes time on (1) broken relative paths in recipe sidecars, (2) 30+ minute full re-diagnostics when only file-parsing layers changed, (3) executor rediscovery of test patterns, (4) 411 D->C false positives from prose word matches, and (5) 60 Category B reverse candidates needing unnecessary human review.

Output: Updated `bin/formal-test-sync.cjs` and `bin/qgsd-solve.cjs` with all 5 improvements.
</objective>

<execution_context>
@/Users/jonathanborduas/.claude/qgsd/workflows/execute-plan.md
@/Users/jonathanborduas/.claude/qgsd/templates/summary.md
</execution_context>

<context>
@bin/formal-test-sync.cjs
@bin/qgsd-solve.cjs
@.planning/formal/acknowledged-false-positives.json
@.planning/todos/pending/2026-03-05-implement-5-solve-automation-improvements.md
</context>

<tasks>

<task type="auto">
  <name>Task 1: Add absolute paths and test template classification to recipe sidecars</name>
  <files>bin/formal-test-sync.cjs</files>
  <action>
In the `generateStubs()` function (~line 561-633), modify the recipe JSON sidecar generation to add two new fields:

1. **Absolute paths** (`source_file_absolute` and `source_file_hint`):
   - For each `sourceFiles` entry, resolve to an absolute path using `path.resolve(ROOT, sourceFile)`.
   - Add `source_file_absolute: path.resolve(ROOT, sourceFiles[0])` to the recipe object (alongside existing `source_files` array).
   - Also add `source_files_absolute: sourceFiles.map(f => path.resolve(ROOT, f))` as a full list.
   - Replace the existing relative `import_hint` with an absolute-path version: `"const mod = require('" + path.resolve(ROOT, sourceFiles[0]) + "');"` so executors paste directly without computing relative paths.

2. **Test template classification** (`template` field):
   - Add a new function `classifyTestTemplate(testStrategy, sourceFiles, requirementText)` that returns one of three template strings:
     - `"source-grep"` — when `testStrategy === 'structural'` (default): test greps source file for pattern existence (e.g., function exists, export present). Pre-fill boilerplate: `const content = fs.readFileSync(SOURCE, 'utf8'); assert.match(content, /PATTERN/);`
     - `"import-and-call"` — when `testStrategy === 'behavioral'`: test imports module and calls function with known input, asserts output. Pre-fill: `const mod = require(SOURCE); const result = mod.FUNCTION(INPUT); assert.strictEqual(result, EXPECTED);`
     - `"config-validate"` — when `testStrategy === 'constant'`: test loads config and asserts value matches formal spec. Pre-fill: `const { DEFAULT_CONFIG } = require(CONFIG_PATH); assert.strictEqual(resolveConfigPath(PATH, DEFAULT_CONFIG), EXPECTED);`
   - Add `template` and `template_boilerplate` fields to the recipe JSON object.
   - The boilerplate uses placeholder tokens (SOURCE, PATTERN, FUNCTION, etc.) that executors fill in.

Keep existing fields intact. The recipe JSON gains: `source_file_absolute`, `source_files_absolute`, `template`, `template_boilerplate`. The `import_hint` field switches to absolute path.
  </action>
  <verify>
Run `node bin/formal-test-sync.cjs --dry-run` and verify no crash. Then run `node bin/formal-test-sync.cjs` and check a generated `.stub.recipe.json` file in `.planning/formal/generated-stubs/` contains `source_file_absolute`, `source_files_absolute`, `template`, and `template_boilerplate` fields. Verify `source_file_absolute` starts with `/` (absolute). Verify `template` is one of `source-grep`, `import-and-call`, or `config-validate`.
  </verify>
  <done>
Recipe sidecars contain absolute paths (no relative path computation needed by executors) and a template field with pre-filled boilerplate for one of three test patterns.
  </done>
</task>

<task type="auto">
  <name>Task 2: Add --fast mode, pattern-based FP suppression, and auto-acknowledge Category B</name>
  <files>bin/qgsd-solve.cjs, .planning/formal/acknowledged-false-positives.json</files>
  <action>
Three changes to `bin/qgsd-solve.cjs`:

**Improvement 2: `--fast` flag**

1. Add `const fastMode = args.includes('--fast');` near the other CLI flag declarations (~line 42-44).
2. Update the usage comment block at the top to include `--fast`.
3. In `computeResidual()` (~line 1761), conditionally skip `sweepFtoC()` and `sweepTtoC()` when `fastMode` is true. Replace their calls with stub results: `{ residual: -1, detail: { skipped: true, reason: 'fast mode' } }`. These are the two slow layers (formal verification ~30min, test execution ~2min). All file-parsing layers (R->F, F->T, C->F, R->D, D->C, P->F) still run.
4. Export `fastMode` is NOT needed (it's a CLI flag, not an API).

**Improvement 4: Pattern-based D->C false-positive suppression**

1. Update `.planning/formal/acknowledged-false-positives.json` to add a `patterns` array alongside the existing `entries` array:
   ```json
   {
     "description": "...",
     "entries": [],
     "patterns": [
       { "type": "dependency", "regex": "^claude-\\d+$", "reason": "MCP slot names, not npm packages" },
       { "type": "dependency", "regex": "^(date|mode|time|name|type|state|status|level|path|port)$", "reason": "Common English words matching npm package name regex" }
     ]
   }
   ```

2. In `sweepDtoC()` (~line 1095), after loading `acknowledgedFPs` Set (~line 1116-1124), also load the `patterns` array from the same file. Compile each pattern's `regex` field into a RegExp object keyed by `type`.

3. In the broken claims loop (~line 1175), after checking `acknowledgedFPs.has()`, add a second check: if the claim's `type` matches a pattern entry's `type` AND the claim's `value` matches the pattern's compiled regex, suppress it and increment `suppressedFpCount`. This avoids needing to enumerate every false positive individually.

**Improvement 5: Auto-acknowledge Category B reverse candidates**

1. In `assembleReverseCandidates()` (~line 1596), after the auto-categorize loop (~line 1722-1728) and BEFORE the category count computation (~line 1731):
   - Filter out Category B candidates from the `candidates` array.
   - If not in `reportOnly` mode, auto-write them to `.planning/formal/acknowledged-not-required.json`:
     - Read existing file (or create `{ entries: [] }` if missing).
     - For each Category B candidate, add `{ file_or_claim: c.file_or_claim, category: 'B', reason: c.category_reason, acknowledged_at: new Date().toISOString() }` if not already present (deduplicate by `file_or_claim`).
     - Write back.
   - Add a `auto_acknowledged_b` count to the return object.
   - Remove Category B from the candidates array so they do not appear in reports or require human review.

2. To respect `reportOnly`, wrap the file-write in `if (!reportOnly)` but ALWAYS filter Category B from candidates (they should never surface to humans regardless of mode).

Update the module.exports at the bottom to also export the new `fastMode`-related logic if needed for testing (likely not needed since it's CLI-only, but ensure no existing export breaks).
  </action>
  <verify>
1. **Fast mode**: Run `node bin/qgsd-solve.cjs --fast --report-only --json 2>/dev/null | node -e "const d=JSON.parse(require('fs').readFileSync('/dev/stdin','utf8')); const r=d.residual_vector; console.log('F->C skipped:', r.f_to_c?.detail?.skipped, 'T->C skipped:', r.t_to_c?.detail?.skipped)"` and confirm both show `true`.
2. **Pattern suppression**: Run `node bin/qgsd-solve.cjs --report-only --json 2>/dev/null | node -e "const d=JSON.parse(require('fs').readFileSync('/dev/stdin','utf8')); console.log('D->C suppressed:', d.residual_vector.d_to_c?.detail?.suppressed_fp_count)"` and confirm the suppressed count is higher than before (was 0 with empty entries, should now suppress pattern matches).
3. **Category B auto-ack**: Run `node bin/qgsd-solve.cjs --report-only --json 2>/dev/null | node -e "const d=JSON.parse(require('fs').readFileSync('/dev/stdin','utf8')); const ac=d.residual_vector.assembled_candidates; console.log('Cat B in candidates:', ac?.category_counts?.B || 0, 'auto_acked:', ac?.auto_acknowledged_b || 0)"` and confirm Category B count in candidates is 0 and auto_acknowledged_b is > 0.
  </verify>
  <done>
--fast flag skips F->C and T->C for sub-second iteration. D->C false positives matching pattern rules are suppressed. Category B reverse candidates are auto-acknowledged and removed from human review queue.
  </done>
</task>

</tasks>

<verification>
1. `node bin/formal-test-sync.cjs` completes without error and recipe sidecars contain new fields
2. `node bin/qgsd-solve.cjs --fast --report-only` completes in under 30 seconds (skips formal verify + test execution)
3. `node bin/qgsd-solve.cjs --report-only` completes and shows reduced D->C residual due to pattern suppression
4. No existing tests break: `node --test bin/*.test.cjs 2>&1 | tail -5`
</verification>

<success_criteria>
- Recipe sidecars have absolute paths and template classification
- --fast mode runs in < 30 seconds (vs 30+ minutes for full)
- D->C false positive count drops significantly via pattern-based suppression
- Category B candidates no longer appear in reverse discovery output
- All existing tests pass
</success_criteria>

<output>
After completion, create `.planning/quick/184-implement-5-solve-automation-improvement/184-SUMMARY.md`
</output>
