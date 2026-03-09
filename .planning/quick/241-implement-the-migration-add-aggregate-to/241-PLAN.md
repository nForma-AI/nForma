---
phase: quick-241
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - bin/compute-per-model-gates.cjs
  - bin/nf-solve.cjs
  - bin/cross-layer-dashboard.cjs
  - bin/run-formal-verify.cjs
  - bin/gate-a-grounding.cjs
  - bin/gate-a-grounding.test.cjs
  - bin/gate-b-abstraction.cjs
  - bin/gate-b-abstraction.test.cjs
  - bin/gate-c-validation.cjs
  - bin/gate-c-validation.test.cjs
  - .planning/formal/gates/
  - bin/compute-per-model-gates.test.cjs
autonomous: true
formal_artifacts: none
requirements: [GATE-01, GATE-02, GATE-03, GATE-04]

must_haves:
  truths:
    - "compute-per-model-gates.cjs --aggregate --json produces continuous 0-1 scores and diagnostic breakdowns matching the old global gate JSON schema"
    - "nf-solve.cjs sweep functions produce identical residual scores using --aggregate instead of spawning global gate scripts"
    - "cross-layer-dashboard.cjs collectAll produces identical dashboard output using --aggregate"
    - "run-formal-verify.cjs pipeline runs per-model-gates --aggregate instead of three separate global gate scripts"
    - "Global gate scripts and their output directory no longer exist"
  artifacts:
    - path: "bin/compute-per-model-gates.cjs"
      provides: "--aggregate mode producing continuous gate scores"
      contains: "AGGREGATE_FLAG"
    - path: "bin/compute-per-model-gates.test.cjs"
      provides: "Fixture-based unit tests for aggregate score calculations"
      contains: "computeAggregate"
    - path: "bin/nf-solve.cjs"
      provides: "Sweep functions using compute-per-model-gates --aggregate"
      contains: "compute-per-model-gates"
    - path: "bin/cross-layer-dashboard.cjs"
      provides: "Dashboard gate collection via --aggregate"
      contains: "compute-per-model-gates"
  key_links:
    - from: "bin/nf-solve.cjs"
      to: "bin/compute-per-model-gates.cjs"
      via: "spawnTool with --aggregate --json"
      pattern: "compute-per-model-gates.*--aggregate"
    - from: "bin/cross-layer-dashboard.cjs"
      to: "bin/compute-per-model-gates.cjs"
      via: "spawnTool with --aggregate --json"
      pattern: "compute-per-model-gates.*--aggregate"
    - from: "bin/run-formal-verify.cjs"
      to: "bin/compute-per-model-gates.cjs"
      via: "pipeline step with --aggregate"
      pattern: "compute-per-model-gates.*--aggregate"
---

<objective>
Migrate gate scoring from three global gate scripts to a unified --aggregate mode in compute-per-model-gates.cjs, then delete the redundant global scripts.

Purpose: Eliminate three redundant scripts (gate-a-grounding.cjs, gate-b-abstraction.cjs, gate-c-validation.cjs) that duplicate logic already in compute-per-model-gates.cjs. The per-model script already evaluates gates A/B/C per model; --aggregate adds continuous score aggregation for consumers that need 0-1 scores and diagnostic breakdowns.

Output: Single gate scoring pipeline via compute-per-model-gates.cjs --aggregate, all consumers migrated, global gate scripts deleted.
</objective>

<execution_context>
@/Users/jonathanborduas/.claude/nf/workflows/execute-plan.md
@/Users/jonathanborduas/.claude/nf/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@bin/compute-per-model-gates.cjs
@bin/nf-solve.cjs (lines 2110-2270: sweep functions)
@bin/cross-layer-dashboard.cjs (lines 70-183: collectGateData, collectAll, buildResult)
@bin/run-formal-verify.cjs (lines 395-424: gate pipeline steps)
@bin/gate-a-grounding.cjs (exports at line 483)
@bin/gate-b-abstraction.cjs (exports at end)
@bin/gate-c-validation.cjs (exports at end)
@.planning/formal/gates/gate-a-grounding.json (reference output format)
@.planning/formal/gates/gate-b-abstraction.json (reference output format)
@.planning/formal/gates/gate-c-validation.json (reference output format)
</context>

<tasks>

<task type="auto">
  <name>Task 1: Add --aggregate mode to compute-per-model-gates.cjs</name>
  <files>bin/compute-per-model-gates.cjs, bin/compute-per-model-gates.test.cjs</files>
  <action>
Add an `--aggregate` flag that, when combined with `--json`, outputs an aggregate section alongside per-model data. The aggregate section MUST produce continuous 0-1 scores and diagnostic breakdowns that exactly match what the global gate scripts output.

1. Add `const AGGREGATE_FLAG = process.argv.includes('--aggregate');` near the other flag constants (line ~38).

2. In the main() function, after the per-model loop completes (after line 374), when AGGREGATE_FLAG is true, compute aggregate gate scores:

   **Gate A aggregate** — Replicate gate-a-grounding.json schema:
   - `grounding_score`: proportion of models passing gate A (`gateACount / modelKeys.length`)
   - `target`: 0.8
   - `target_met`: grounding_score >= 0.8
   - `explained`: gateACount
   - `total`: modelKeys.length
   - `unexplained_counts`: `{ instrumentation_bug: 0, model_gap: modelsFailingA, genuine_violation: 0 }` where modelsFailingA = modelKeys.length - gateACount

   **Gate B aggregate** — Replicate gate-b-abstraction.json schema:
   - `gate_b_score`: proportion passing gate B (`gateBCount / modelKeys.length`)
   - `total_entries`: modelKeys.length
   - `grounded_entries`: gateBCount
   - `orphaned_entries`: modelKeys.length - gateBCount
   - `target`: 1.0
   - `target_met`: gate_b_score >= 1.0

   **Gate C aggregate** — Replicate gate-c-validation.json schema:
   - `gate_c_score`: proportion passing gate C (`gateCCount / modelKeys.length`)
   - `total_entries`: modelKeys.length
   - `validated_entries`: gateCCount
   - `unvalidated_entries`: modelKeys.length - gateCCount
   - `target`: 0.8
   - `target_met`: gate_c_score >= 0.8

3. Add these to the output object under an `aggregate` key:
   ```
   output.aggregate = {
     gate_a: { grounding_score, target, target_met, explained, total, unexplained_counts },
     gate_b: { gate_b_score, total_entries, grounded_entries, orphaned_entries, target, target_met },
     gate_c: { gate_c_score, total_entries, validated_entries, unvalidated_entries, target, target_met },
   };
   ```

4. When --aggregate is passed WITHOUT --json, print a human-readable aggregate summary after the per-model summary.

5. Also write aggregate results to `.planning/formal/gates/` JSON files (gate-a-grounding.json, gate-b-abstraction.json, gate-c-validation.json) with `schema_version: "1"` and `generated` timestamp — matching the existing file format exactly. This preserves backward compatibility for the cached-mode dashboard reader during the transition. Skip file writes during --dry-run.

IMPORTANT: The gate A `unexplained_counts` breakdown with `instrumentation_bug`, `model_gap`, `genuine_violation` is used by nf-solve.cjs sweepL1toL2 (lines 2141-2145). The per-model system does not have deep trace analysis like the global gate-a script, so map failing models to `model_gap` category (this is semantically accurate — a model failing gate A means its grounding has gaps).

6. **Unit tests for --aggregate mode** (quorum improvement from opencode-1): Create `bin/compute-per-model-gates.test.cjs` with unit tests that verify aggregate score calculations against known fixtures BEFORE proceeding to consumer migration. The tests MUST:

   - Import or extract the aggregate computation logic into a testable function (e.g., `computeAggregate(perModelResults)`)
   - Create fixture data representing known per-model gate results (e.g., 3 models: 2 pass gate A, 3 pass gate B, 1 passes gate C)
   - Assert that `grounding_score` = 2/3 ≈ 0.6667 for the fixture, `gate_b_score` = 1.0, `gate_c_score` = 1/3 ≈ 0.3333
   - Assert `target_met` is false when score < target, true when score >= target
   - Assert `unexplained_counts.model_gap` equals number of failing models for gate A
   - Assert field names and structure match the existing global gate JSON files (gate-a-grounding.json, gate-b-abstraction.json, gate-c-validation.json)
   - Include an edge case: 0 models (empty input) should produce scores of 0 or NaN-safe defaults
   - Include an edge case: all models pass all gates (scores should be exactly 1.0)

   This ensures aggregate logic matches global script outputs precisely across edge cases before any consumer migration begins.
  </action>
  <verify>
1. Run aggregate unit tests FIRST: `node bin/compute-per-model-gates.test.cjs` — all fixture-based assertions must pass (scores match expected values, field names match global gate JSON schemas, edge cases handled).

2. Run: `node bin/compute-per-model-gates.cjs --aggregate --json --dry-run | node -e "const d=JSON.parse(require('fs').readFileSync('/dev/stdin','utf8')); const a=d.aggregate; console.log('gate_a:', typeof a.gate_a.grounding_score === 'number', 'gate_b:', typeof a.gate_b.gate_b_score === 'number', 'gate_c:', typeof a.gate_c.gate_c_score === 'number'); console.log('unexplained:', JSON.stringify(a.gate_a.unexplained_counts)); process.exit(a.gate_a && a.gate_b && a.gate_c ? 0 : 1)"`

3. Verify non-aggregate mode still works: `node bin/compute-per-model-gates.cjs --json --dry-run | node -e "const d=JSON.parse(require('fs').readFileSync('/dev/stdin','utf8')); console.log('no aggregate key:', !d.aggregate); process.exit(!d.aggregate ? 0 : 1)"`
  </verify>
  <done>compute-per-model-gates.cjs --aggregate --json outputs continuous 0-1 gate scores with diagnostic breakdowns matching the global gate JSON schemas. Unit tests in compute-per-model-gates.test.cjs verify score calculations against known fixtures including edge cases. Non-aggregate mode unchanged.</done>
</task>

<task type="auto">
  <name>Task 2: Migrate all consumers to use --aggregate mode</name>
  <files>bin/nf-solve.cjs, bin/cross-layer-dashboard.cjs, bin/run-formal-verify.cjs</files>
  <action>
Migrate three consumers from spawning individual global gate scripts to spawning compute-per-model-gates.cjs --aggregate.

**A. nf-solve.cjs — sweep functions (lines 2118-2245)**

Replace sweepL1toL2, sweepL2toL3, sweepL3toTC to share a single --aggregate call:

1. Add a memoized aggregate loader above the sweep functions:
   ```
   let _aggregateCache = null;
   function getAggregateGates() {
     if (_aggregateCache) return _aggregateCache;
     const args = ['--aggregate', '--json'];
     if (reportOnly) args.push('--dry-run');
     const result = spawnTool('bin/compute-per-model-gates.cjs', args);
     if (!result.ok && !result.stdout) return null;
     try {
       const data = JSON.parse(result.stdout);
       _aggregateCache = data.aggregate;
       return _aggregateCache;
     } catch { return null; }
   }
   ```

2. Rewrite sweepL1toL2:
   - Call `getAggregateGates()`, extract `agg.gate_a`
   - Compute residual: `Math.ceil((1 - gateA.grounding_score) * 10)`
   - Return same shape: `{ residual, detail: { grounding_score, target: 0.8, gap: 0.8 - score, unexplained_breakdown: { instrumentation_bug, model_gap, genuine_violation } } }`
   - The unexplained_breakdown comes from `gateA.unexplained_counts`

3. Rewrite sweepL2toL3:
   - Extract `agg.gate_b`
   - Compute residual: `Math.min(Math.ceil((1 - gateB.gate_b_score) * 10) + gateB.orphaned_entries, 10)`
   - Return: `{ residual, detail: { gate_b_score, orphaned_count: gateB.orphaned_entries, residual_capped } }`

4. Rewrite sweepL3toTC:
   - Keep the test-recipes staleness check (lines 2201-2219) as-is
   - Extract `agg.gate_c`
   - Compute residual: `Math.ceil((1 - gateC.gate_c_score) * 10)`
   - Return: `{ residual, detail: { gate_c_score, unvalidated_count: gateC.unvalidated_entries, total_failure_modes: gateC.total_entries, total_recipes: gateC.validated_entries } }`

5. sweepPerModelGates (line 2255) already calls compute-per-model-gates.cjs — leave it as-is but add --aggregate to its args so it also triggers aggregate computation and gate file writes.

**B. cross-layer-dashboard.cjs — collectAll/buildResult (lines 91-183)**

1. Replace the three collectGateData calls in collectAll with a single call:
   ```
   function collectAll() {
     let gateA = null, gateB = null, gateC = null;

     if (CACHED_FLAG) {
       // Read from cached gate files (still written by --aggregate mode)
       gateA = readJsonFile(path.join(GATES_DIR, 'gate-a-grounding.json'));
       gateB = readJsonFile(path.join(GATES_DIR, 'gate-b-abstraction.json'));
       gateC = readJsonFile(path.join(GATES_DIR, 'gate-c-validation.json'));
     } else {
       const result = spawnTool('compute-per-model-gates.cjs', ['--aggregate', '--json']);
       if (result.ok || result.stdout) {
         try {
           const data = JSON.parse(result.stdout);
           if (data.aggregate) {
             gateA = data.aggregate.gate_a;
             gateB = data.aggregate.gate_b;
             gateC = data.aggregate.gate_c;
           }
         } catch {}
       }
     }

     const l1Pct = collectL1Coverage();
     const maturity = collectMaturityData();
     return { gateA, gateB, gateC, l1Pct, maturity };
   }
   ```

2. buildResult (lines 141-183) does NOT need changes — it already reads field names like `gateA.grounding_score`, `gateB.gate_b_score`, `gateC.gate_c_score` which the aggregate output matches.

**C. run-formal-verify.cjs — pipeline steps (lines 399-423)**

Replace the three separate gate pipeline entries (lines 400-417) with a single entry:
```
{
  tool: 'gates', id: 'gates:aggregate',
  label: 'Gate A/B/C -- aggregate alignment scores (via per-model)',
  type: 'node', script: 'compute-per-model-gates.cjs', args: ['--aggregate'],
  nonCritical: true,
},
```

Keep the existing per-model entry at line 418-423 as-is (it runs without --aggregate for per-model scoring).

Actually, since Task 1 makes --aggregate also write gate JSON files, the per-model entry (line 418-423) should add --aggregate to its args so it writes the files too. Then we only need ONE pipeline entry total:
```
{
  tool: 'gates', id: 'gates:per-model-aggregate',
  label: 'Per-model gate maturity + aggregate alignment scores',
  type: 'node', script: 'compute-per-model-gates.cjs', args: ['--aggregate', '--json'],
  nonCritical: true,
},
```
This replaces all four entries (three global gates + one per-model) with one.
  </action>
  <verify>
1. Run nf-solve sweep test: `node bin/nf-solve.cjs --report-only --fast 2>&1 | head -5` (should not error; fast mode skips sweeps so this verifies no syntax errors)
2. Run dashboard: `node bin/cross-layer-dashboard.cjs --json 2>/dev/null | node -e "const d=JSON.parse(require('fs').readFileSync('/dev/stdin','utf8')); console.log('gate_a:', d.gate_a !== null, 'gate_b:', d.gate_b !== null, 'gate_c:', d.gate_c !== null)"`
3. Verify no references to global gate scripts remain in consumers: `grep -l 'gate-a-grounding\|gate-b-abstraction\|gate-c-validation' bin/nf-solve.cjs bin/cross-layer-dashboard.cjs bin/run-formal-verify.cjs` should return empty (exit 1)
4. Run: `node bin/run-formal-verify.cjs --dry-run 2>&1 | grep -i 'aggregate\|per-model'` to confirm the pipeline step exists
  </verify>
  <done>All three consumers (nf-solve.cjs, cross-layer-dashboard.cjs, run-formal-verify.cjs) use compute-per-model-gates.cjs --aggregate. Zero references to global gate scripts remain in consumer code.</done>
</task>

<task type="auto">
  <name>Task 3: Delete global gate scripts, tests, and output directory</name>
  <files>bin/gate-a-grounding.cjs, bin/gate-a-grounding.test.cjs, bin/gate-b-abstraction.cjs, bin/gate-b-abstraction.test.cjs, bin/gate-c-validation.cjs, bin/gate-c-validation.test.cjs, .planning/formal/gates/</files>
  <action>
1. Delete the six files:
   - `rm bin/gate-a-grounding.cjs bin/gate-a-grounding.test.cjs`
   - `rm bin/gate-b-abstraction.cjs bin/gate-b-abstraction.test.cjs`
   - `rm bin/gate-c-validation.cjs bin/gate-c-validation.test.cjs`

2. Do NOT delete .planning/formal/gates/ directory — Task 1 configured compute-per-model-gates.cjs --aggregate to write gate JSON files there for backward compatibility (cached dashboard mode). The directory stays, but is now populated by the per-model script.

3. Verify no remaining require() imports of the deleted scripts exist anywhere:
   - `grep -r "require.*gate-a-grounding\|require.*gate-b-abstraction\|require.*gate-c-validation" bin/` should return nothing
   - If any imports found (e.g., in compute-per-model-gates.cjs itself), update them

4. Check that compute-per-model-gates.cjs does NOT import from any of the deleted scripts. It currently imports from promote-gate-maturity.cjs (line 82) which is fine — that script is NOT being deleted.

5. Run the full test suite to confirm nothing breaks:
   - `node bin/compute-per-model-gates.cjs --aggregate --json --dry-run` should succeed
   - `npm test 2>&1 | tail -5` should show 0 failures (excluding the deleted test files)

6. Update the comment in run-formal-verify.cjs (line 24) that lists "Gates (3) -- gate-a-grounding.cjs, gate-b-abstraction.cjs, gate-c-validation.cjs" to say "Gates (1) -- compute-per-model-gates.cjs --aggregate".
  </action>
  <verify>
1. Confirm deleted: `ls bin/gate-a-grounding.cjs bin/gate-b-abstraction.cjs bin/gate-c-validation.cjs 2>&1 | grep -c "No such file"` should be 3
2. Confirm test files deleted: `ls bin/gate-a-grounding.test.cjs bin/gate-b-abstraction.test.cjs bin/gate-c-validation.test.cjs 2>&1 | grep -c "No such file"` should be 3
3. No dangling require imports: `grep -r "require.*gate-[abc]-" bin/*.cjs` should return nothing (exit 1)
4. Full pipeline still works: `node bin/compute-per-model-gates.cjs --aggregate --json --dry-run` exits 0 with valid JSON
5. npm test passes (minus deleted test files): `npm test 2>&1 | grep -E "^(ok|not ok|# (tests|pass|fail))"` shows 0 failures
  </verify>
  <done>Global gate scripts (gate-a-grounding.cjs, gate-b-abstraction.cjs, gate-c-validation.cjs) and their test files are deleted. gates/ directory retained for aggregate output files. Zero dangling references. Test suite passes.</done>
</task>

</tasks>

<verification>
1. `node bin/compute-per-model-gates.test.cjs` — all unit tests pass (fixture-based aggregate score verification including edge cases)
2. `node bin/compute-per-model-gates.cjs --aggregate --json --dry-run` produces valid JSON with aggregate.gate_a, aggregate.gate_b, aggregate.gate_c fields containing continuous 0-1 scores
3. `node bin/cross-layer-dashboard.cjs --json` produces dashboard with gate_a, gate_b, gate_c data
4. `grep -r "gate-a-grounding\|gate-b-abstraction\|gate-c-validation" bin/*.cjs` returns ONLY comments, no functional references
5. `npm test` passes with 0 failures
6. Global gate scripts no longer exist on disk
</verification>

<success_criteria>
- compute-per-model-gates.cjs --aggregate produces continuous scores matching old global gate JSON schemas
- Unit tests verify aggregate scores against known fixtures (including edge cases: 0 models, all-pass) before consumer migration
- All three consumers produce equivalent output using the new --aggregate path
- Six deleted files (3 scripts + 3 tests), zero broken imports
- npm test passes
</success_criteria>

<output>
After completion, create `.planning/quick/241-implement-the-migration-add-aggregate-to/241-SUMMARY.md`
</output>
