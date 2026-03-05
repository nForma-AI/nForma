---
phase: quick-175
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - bin/analyze-assumptions.cjs
  - bin/analyze-assumptions.test.cjs
autonomous: true
formal_artifacts: none
requirements: [QUICK-175]

must_haves:
  truths:
    - "Each assumption is classified as tier 1, 2, or 3 based on monitorability"
    - "Running with --actionable filters output to tier 1 only"
    - "Gap report sorts by tier (tier 1 first, then 2, then 3)"
    - "Tier 1 assumptions get richer Prometheus gauge/histogram instrumentation snippets"
    - "All existing tests still pass and new tests cover tiering/filtering"
    - "PRISM string-numeric values like '5' are correctly detected as numeric for tier 1"
    - "generateSnippet produces tier 2/3 format when tier field is missing or undefined"
  artifacts:
    - path: "bin/analyze-assumptions.cjs"
      provides: "classifyTier function, --actionable CLI flag, tier-sorted gap report, Prometheus snippets for tier 1"
      exports: ["classifyTier", "extractTlaAssumptions", "extractTlaCfgValues", "extractAlloyAssumptions", "extractPrismAssumptions", "scanAllFormalModels", "crossReference", "generateGapReport", "formatMarkdownReport"]
    - path: "bin/analyze-assumptions.test.cjs"
      provides: "Tests for tier classification, --actionable filtering, sort order, Prometheus snippets, integration CLI test"
      min_lines: 500
  key_links:
    - from: "bin/analyze-assumptions.cjs:classifyTier"
      to: "bin/analyze-assumptions.cjs:generateGapReport"
      via: "classifyTier called on each assumption before gap grouping"
      pattern: "classifyTier"
    - from: "bin/analyze-assumptions.cjs:generateGapReport"
      to: "bin/analyze-assumptions.cjs:generateSnippet"
      via: "tier 1 gets richer Prometheus patterns; undefined tier falls back to tier 2/3 path"
      pattern: "prometheus|histogram"
---

<objective>
Add priority tiering and actionable filtering to bin/analyze-assumptions.cjs.

Purpose: Enable operators to focus on the most actionable assumptions first (tier 1 = directly monitorable numeric constants from cfg files) and generate production-ready Prometheus instrumentation snippets for them.

Output: Enhanced analyze-assumptions.cjs with tier classification, --actionable flag, tier-sorted output, richer Prometheus snippets for tier 1, and comprehensive tests.
</objective>

<execution_context>
@/Users/jonathanborduas/.claude/qgsd/workflows/execute-plan.md
@/Users/jonathanborduas/.claude/qgsd/templates/summary.md
</execution_context>

<context>
@bin/analyze-assumptions.cjs
@bin/analyze-assumptions.test.cjs
</context>

<tasks>

<task type="auto">
  <name>Task 1: Add classifyTier function and integrate into gap report pipeline</name>
  <files>bin/analyze-assumptions.cjs</files>
  <action>
Add a new exported function `classifyTier(assumption)` that returns 1, 2, or 3:

**Numeric value detection (CRITICAL):** Do NOT use `typeof assumption.value === 'number'` to check for numeric values. PRISM const values parsed from .pm files arrive as strings (e.g., `'5'` not `5`). Instead, use: `assumption.value !== null && assumption.value !== undefined && !isNaN(Number(assumption.value))`. This handles both native numbers and string-encoded numbers from PRISM extraction.

**Tier 1 (directly monitorable):** Numeric constants with concrete values sourced from .cfg files or PRISM const with numeric value. Criteria: value passes the numeric check above AND `assumption.type` is one of `'constant', 'const', 'property', 'constraint'`. These are parameters you can read from config and compare at runtime.

**Design decision comment for 'constraint' type (REQUIRED):** Add a code comment above or inside the tier 1 classification block explaining: "// NOTE: 'constraint' with numeric value is tier 1 because the numeric value represents a cardinality bound that can be monitored at runtime (e.g., max replicas). Alloy constraints that express relational/structural rules without numeric values fall through to tier 3. This is a deliberate classification choice -- not all constraints are monitorable, only those with numeric thresholds."

**Tier 2 (indirectly monitorable):** Named invariants and assertions that can be checked via periodic probes. Criteria: `assumption.type` is one of `'invariant', 'assert', 'fact'`. These require running a check to verify, not just reading a value.

**Tier 3 (not runtime-observable):** Structural type constraints, state-space bounds, assumptions without concrete numeric values. Criteria: everything else -- `'assume'` type without numeric value, `'bound'` type (state-space ranges like [0..2]), constants without concrete values.

Edge case: An `'assume'` type WITH a numeric value should be tier 1 (it has a monitorable threshold). An `'assume'` WITHOUT a numeric value is tier 3.

Integrate tiering into the pipeline:
1. In `generateGapReport`, call `classifyTier` on each gap entry and add `tier` field.
2. Sort `report.gaps` by tier ascending (tier 1 first, then 2, then 3), preserving original order within same tier.
3. Add `--actionable` CLI flag parsing in the CLI entrypoint. When present, filter `crossRefed` to only tier 1 assumptions BEFORE generating the gap report (so counts reflect filtered set).
4. Add tier column to markdown table in `formatMarkdownReport` (between Type and Coverage columns).

For Tier 1 Prometheus snippets, enhance `generateSnippet` to detect tier 1 and produce richer output:
- **Defensive default (CRITICAL):** If `gap.tier` is `undefined` or missing (e.g., caller invoked generateSnippet without first running classifyTier), fall back to the tier 2/3 code path (observe handler JSON). Do NOT crash or produce Prometheus output for unclassified gaps. Guard: `if (gap.tier === 1) { ... } else { /* existing observe handler format */ }`.
- For gauge types: include a `# HELP` and `# TYPE` comment line (Prometheus exposition format), plus a `prometheus_client` pattern showing `new Gauge({ name, help, labelNames: ['model', 'file'] })` and a `.set()` call with the threshold value.
- For histogram types (property thresholds with probability values like 0.95): use `new Histogram({ name, help, buckets })` pattern.
- Keep existing snippet format for tier 2 and tier 3 (observe handler JSON).

The function signature for generateSnippet changes to accept the full gap object (it already does), just branch on `gap.tier === 1`.

Export `classifyTier` from module.exports.
  </action>
  <verify>node -e "const m = require('./bin/analyze-assumptions.cjs'); console.log(m.classifyTier({type:'constant',value:5})); console.log(m.classifyTier({type:'const',value:'5'})); console.log(m.classifyTier({type:'invariant',value:null})); console.log(m.classifyTier({type:'bound',value:'[0..2]'}))" should print 1, 1, 2, 3 (note second call uses string '5' to verify PRISM string-numeric handling).</verify>
  <done>classifyTier exported and returns correct tiers including string-numeric PRISM values. generateSnippet defaults to tier 2/3 path when tier is undefined. Design decision comment present for constraint type. generateGapReport adds tier field and sorts by tier. --actionable flag filters to tier 1. Tier 1 gets Prometheus snippets. Markdown report includes tier column.</done>
</task>

<task type="auto">
  <name>Task 2: Add tests for tier classification, filtering, sort order, and Prometheus snippets</name>
  <files>bin/analyze-assumptions.test.cjs</files>
  <action>
Import `classifyTier` from analyze-assumptions.cjs (add to existing destructured import).

Add new describe blocks:

**describe('classifyTier'):**
- Tier 1: constant with numeric value (value: 5) -> 1
- Tier 1: const (PRISM) with numeric value (value: 10) -> 1
- Tier 1: const (PRISM) with STRING numeric value (value: '5') -> 1 (CRITICAL: verifies PRISM string-numeric parsing)
- Tier 1: property with numeric value -> 1
- Tier 1: property with STRING numeric value (value: '0.95') -> 1 (PRISM probability)
- Tier 1: constraint with numeric value -> 1
- Tier 1: assume with numeric value -> 1 (has threshold)
- Tier 2: invariant -> 2
- Tier 2: assert -> 2
- Tier 2: fact -> 2
- Tier 3: bound (state-space) -> 3
- Tier 3: assume without numeric value -> 3
- Tier 3: constant without numeric value (value is null) -> 3

**describe('generateSnippet defensive default'):**
- Create a gap object WITHOUT a tier field (tier: undefined). Call generateSnippet (or generate report). Assert the snippet uses the observe handler JSON format, NOT Prometheus Gauge/Histogram format. This prevents regression if callers skip classifyTier.

**describe('generateGapReport tier sorting'):**
- Create input array with mixed tiers (tier 3 first, tier 1 last). Assert report.gaps is sorted tier 1, 2, 3.
- Assert each gap has a `tier` field with correct value.
- Assert gaps within same tier preserve original insertion order.

**describe('--actionable filtering'):**
- Create a mixed array of assumptions (some tier 1, some tier 2/3). Run classifyTier on each, filter to tier === 1, pass filtered set to generateGapReport. Assert report only contains tier 1 gaps and counts match filtered set.

**describe('--actionable CLI integration'):**
- Add at least one integration-style test that invokes the script via `require('child_process').execFileSync('node', ['bin/analyze-assumptions.cjs', '--json', '--actionable'], { cwd: '/Users/jonathanborduas/code/QGSD', encoding: 'utf8' })`, parses the JSON output, and asserts that EVERY returned gap has `tier === 1`. This validates the full CLI pipeline end-to-end, not just the function in isolation. Use execFileSync (not execSync) to avoid shell injection per project conventions.

**describe('Prometheus snippets for tier 1'):**
- Create a tier 1 gauge gap (constant, value=5). Generate report. Assert snippet includes "# HELP", "# TYPE", "Gauge", ".set(".
- Create a tier 1 gap with property type and probability-like value (0.95). Generate report. Assert snippet includes "Histogram" or "histogram".
- Create a tier 2 invariant gap. Generate report. Assert snippet does NOT include "Gauge" or "Histogram" (uses old observe handler format).

**Update existing formatMarkdownReport test:**
- Assert markdown output includes "Tier" column header in the gaps table.
- Assert the column ORDER in the markdown header row: the "Tier" column must appear AFTER "Type" and BEFORE "Coverage" (or equivalent). Do not just assert the word "Tier" exists -- split the header row on `|`, trim each cell, and verify the index of "Tier" is exactly one position after "Type". Example: `const cols = headerRow.split('|').map(c => c.trim()).filter(Boolean); assert(cols.indexOf('Tier') === cols.indexOf('Type') + 1)`.

Run: `node --test bin/analyze-assumptions.test.cjs`
All tests must pass (both new and existing).
  </action>
  <verify>cd /Users/jonathanborduas/code/QGSD && node --test bin/analyze-assumptions.test.cjs 2>&1 | tail -5</verify>
  <done>All existing tests pass unchanged. New tests cover: classifyTier for all 3 tiers (13 cases including string-numeric PRISM values), generateSnippet defensive default for undefined tier, tier sorting in gap report, actionable filtering (unit + CLI integration via execFileSync), Prometheus snippet generation for tier 1 vs tier 2/3, markdown tier column position. Zero failures.</done>
</task>

</tasks>

<verification>
- `node --test bin/analyze-assumptions.test.cjs` -- all tests pass
- `node bin/analyze-assumptions.cjs --json | node -e "const r=JSON.parse(require('fs').readFileSync(0,'utf8')); console.log(r.gaps.slice(0,3).map(g=>g.tier))"` -- first gaps should be tier 1
- `node bin/analyze-assumptions.cjs --json --actionable | node -e "const r=JSON.parse(require('fs').readFileSync(0,'utf8')); console.log(r.gaps.every(g=>g.tier===1))"` -- should print true
</verification>

<success_criteria>
- classifyTier correctly assigns tier 1/2/3 based on type and value, including string-numeric PRISM values
- generateSnippet safely defaults to tier 2/3 output when tier field is undefined
- --actionable flag filters to tier 1 assumptions only (verified via CLI integration test)
- Gap report sorted by tier (1 first)
- Tier 1 assumptions get Prometheus gauge/histogram instrumentation snippets
- Markdown tier column appears in correct position between Type and Coverage
- Design decision comment present for constraint type classification
- All tests pass (existing + new)
</success_criteria>

<output>
After completion, create `.planning/quick/175-add-priority-tiering-and-actionable-filt/175-SUMMARY.md`
</output>
