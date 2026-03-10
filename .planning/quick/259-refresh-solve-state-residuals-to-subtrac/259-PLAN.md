---
phase: quick-259
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - bin/nf-solve.cjs
autonomous: true
formal_artifacts: none
requirements: [QUICK-259]

must_haves:
  truths:
    - "solve-state.json known_issues entries for d_to_c, c_to_r, t_to_r, d_to_r include net_residual field"
    - "net_residual subtracts Haiku FP classifications and archived items from raw residual"
    - "Layers without FP/archive filtering retain residual only (no net_residual or net_residual equals residual)"
  artifacts:
    - path: "bin/nf-solve.cjs"
      provides: "net_residual computation in persistSessionSummary block"
      contains: "net_residual"
    - path: ".planning/formal/solve-state.json"
      provides: "Updated known_issues with net_residual fields"
      contains: "net_residual"
  key_links:
    - from: "bin/nf-solve.cjs"
      to: ".planning/formal/solve-classifications.json"
      via: "readClassificationCache pattern from solve-tui"
      pattern: "solve-classifications"
    - from: "bin/nf-solve.cjs"
      to: ".planning/formal/archived-solve-items.json"
      via: "readArchiveFile pattern from solve-tui"
      pattern: "archived-solve-items"
---

<objective>
Add net_residual to solve-state.json known_issues by subtracting Haiku FP classifications and archived items from raw sweep residuals.

Purpose: The raw residual counts in solve-state.json overstate actionable work because they include items already classified as false positives by Haiku or archived via /nf:resolve. Downstream consumers (TUI, skill overview) need accurate counts.

Output: Updated nf-solve.cjs that computes and persists both `residual` (raw) and `net_residual` (filtered) for the four human-gated sweep layers (d_to_c, c_to_r, t_to_r, d_to_r).
</objective>

<execution_context>
@/Users/jonathanborduas/.claude/nf/workflows/execute-plan.md
@/Users/jonathanborduas/.claude/nf/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@bin/nf-solve.cjs
@bin/solve-tui.cjs
</context>

<tasks>

<task type="auto">
  <name>Task 1: Add net_residual computation to nf-solve.cjs known_issues population</name>
  <files>bin/nf-solve.cjs</files>
  <action>
In the `computeResidual()` result assembly block (around line 3677-3682), after the existing loop that pushes `{ layer, residual }` into `solveState.known_issues`, add net_residual computation for the four human-gated layers: d_to_c, c_to_r, t_to_r, d_to_r.

Implementation steps:

1. At the top of the known_issues population block (before the for-loop at line 3678), load the two filtering data sources:
   - Classification cache: Read `.planning/formal/solve-classifications.json`, parse JSON, extract `.classifications` object. Use try/catch, default to `{}` on failure. This mirrors `readClassificationCache()` in solve-tui.cjs (line 1373).
   - Archive data: Read `.planning/formal/archived-solve-items.json`, parse JSON, extract `.entries` array. Use try/catch, default to `{ entries: [] }` on failure. This mirrors `readArchiveFile()` in solve-tui.cjs (line 226).

2. Define an inline `itemKey(catKey, item)` function matching solve-tui.cjs line 1364-1369:
   - dtoc: `${item.doc_file}:${item.value}`
   - ctor: `item.file`
   - ttor: `item.file`
   - dtor: `${item.doc_file}:${item.line}`

3. Define a `computeArchiveKey(catKey, item)` function matching the archive key logic from solve-tui.cjs isArchived() (line 278-282):
   - dtoc: `${item.doc_file}:${item.value}`
   - dtor: `${item.doc_file}:${item.line}`
   - others: `item.file || item.summary`

4. Define a layer-to-category mapping:
   ```
   const LAYER_CAT_MAP = {
     d_to_c: { catKey: 'dtoc', detailKey: 'broken_claims' },
     c_to_r: { catKey: 'ctor', detailKey: 'untraced_modules' },
     t_to_r: { catKey: 'ttor', detailKey: 'orphan_tests' },
     d_to_r: { catKey: 'dtor', detailKey: 'unbacked_claims' },
   };
   ```

5. Modify the existing known_issues loop (line 3678-3682). For each entry pushed, check if the layer is in LAYER_CAT_MAP. If so:
   a. Get the detail items from `val.detail[detailKey]` (the raw items array from the sweep)
   b. Filter out FP items: for each raw item, compute `itemKey(catKey, item)` and check if `classifications[catKey][key] === 'fp'` -- if so, exclude
   c. Filter out archived items: for each remaining item, compute `computeArchiveKey(catKey, item)` and check if `archiveEntries.some(e => e.key === archiveKey)` -- if so, exclude
   d. Set `net_residual` to the count of remaining items after both filters
   e. Push `{ layer: key, residual: val.residual, net_residual }` instead of just `{ layer, residual }`

6. For layers NOT in LAYER_CAT_MAP (f_to_t, f_to_c, l1_to_l2, etc.), keep the existing behavior: push `{ layer, residual }` with no net_residual field.

Important: Do NOT import from solve-tui.cjs -- inline the helper functions to avoid circular dependency issues. The nf-solve.cjs file already has fs and path available.

Important: The detail items from sweeps are raw objects (not the normalized format solve-tui uses). For d_to_c, items have `{ doc_file, value, type, line, reason, category }`. For c_to_r, items are `{ file }` or strings. For t_to_r, items are strings or `{ file }`. For d_to_r, items have `{ doc_file, line, claim_text }`. Handle the string-vs-object cases for c_to_r and t_to_r (use `typeof item === 'string' ? item : item.file` for the file field).
  </action>
  <verify>
Run `node bin/nf-solve.cjs --report-only 2>/dev/null` and then inspect solve-state.json:
- `cat .planning/formal/solve-state.json | node -e "const s=require('fs').readFileSync('/dev/stdin','utf8');const j=JSON.parse(s);const layers=['d_to_c','c_to_r','t_to_r','d_to_r'];for(const i of j.known_issues){if(layers.includes(i.layer)){console.log(i.layer,': residual=',i.residual,'net_residual=',i.net_residual);if(i.net_residual===undefined)process.exit(1);if(i.net_residual>i.residual)process.exit(1);}}"` -- should print all four layers with net_residual <= residual
- Layers NOT in the four (f_to_t, l1_to_l2, etc.) should NOT have net_residual field
  </verify>
  <done>
solve-state.json known_issues entries for d_to_c, c_to_r, t_to_r, d_to_r all contain both `residual` (raw sweep count) and `net_residual` (after subtracting FP classifications and archived items). net_residual is always <= residual. Other layers remain unchanged with only `residual`.
  </done>
</task>

</tasks>

<verification>
1. `node bin/nf-solve.cjs --report-only` completes without errors
2. `.planning/formal/solve-state.json` contains `net_residual` fields for d_to_c, c_to_r, t_to_r, d_to_r
3. Each `net_residual` is <= its corresponding `residual`
4. Non-human-gated layers (f_to_t, f_to_c, l1_to_l2, etc.) have no `net_residual` field
5. Existing tests pass: `node test/nf-solve.test.cjs` (if applicable)
</verification>

<success_criteria>
solve-state.json accurately reflects actionable residual counts by subtracting FP and archived items, making known_issues trustworthy for downstream consumers.
</success_criteria>

<output>
After completion, create `.planning/quick/259-refresh-solve-state-residuals-to-subtrac/259-SUMMARY.md`
</output>
