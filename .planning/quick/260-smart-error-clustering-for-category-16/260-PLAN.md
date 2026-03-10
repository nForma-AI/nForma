---
phase: quick-260
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - bin/error-clusterer.cjs
  - bin/observe-handler-internal.cjs
  - test/error-clusterer.test.cjs
autonomous: true
requirements: [QUICK-260]

must_haves:
  truths:
    - "Category 16 emits one observe issue per error cluster, not one per individual error entry"
    - "22 current errors.jsonl entries collapse to 3-5 cluster issues"
    - "Shell escaping errors (\\!==, \\!fs.existsSync) are grouped into a single cluster"
    - "Empty errors.jsonl produces zero issues (no crash)"
    - "Stale clusters (all entries >7 days old) get severity info, active clusters get warning"
  artifacts:
    - path: "bin/error-clusterer.cjs"
      provides: "Pure function clusterErrors(entries, options) for grouping error entries"
      exports: ["clusterErrors"]
    - path: "bin/observe-handler-internal.cjs"
      provides: "Updated Category 16 that calls clusterErrors instead of per-entry loop"
      contains: "require.*error-clusterer"
    - path: "test/error-clusterer.test.cjs"
      provides: "Test coverage for clustering logic"
      min_lines: 80
  key_links:
    - from: "bin/observe-handler-internal.cjs"
      to: "bin/error-clusterer.cjs"
      via: "require('./error-clusterer.cjs')"
      pattern: "require.*error-clusterer"
    - from: "bin/error-clusterer.cjs"
      to: "bin/levenshtein.cjs"
      via: "require('./levenshtein.cjs')"
      pattern: "levenshteinSimilarity"
---

<objective>
Replace per-entry error emission in Category 16 with smart clustering so that ~22 individual errors.jsonl entries collapse into ~3-5 cluster issues, preventing cascading individual solve dispatches.

Purpose: Category 16 (added in quick-258) emits one observe issue per error entry. This triggers individual `/nf:quick` dispatches in `nf:solve-remediate` for each entry. Clustering reduces 22 issues to 3-5 aggregated clusters, making solve actionable instead of noisy.

Output: `bin/error-clusterer.cjs` (pure function module), updated Category 16 in observe-handler-internal.cjs, tests.
</objective>

<execution_context>
@/Users/jonathanborduas/.claude/nf/workflows/execute-plan.md
@/Users/jonathanborduas/.claude/nf/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@bin/observe-handler-internal.cjs
@bin/levenshtein.cjs
@bin/memory-store.cjs
@bin/debt-dedup.cjs
@bin/fingerprint-issue.cjs
</context>

<tasks>

<task type="auto">
  <name>Task 1: Create bin/error-clusterer.cjs with clusterErrors() function</name>
  <files>bin/error-clusterer.cjs</files>
  <action>
Create `bin/error-clusterer.cjs` exporting a single pure function `clusterErrors(entries, options)`.

The function takes an array of error entries (same shape as errors.jsonl lines: `{ type, symptom, root_cause, fix, tags, ts, confidence }`) and returns an array of cluster objects.

**Algorithm (two-phase clustering):**

1. **Phase 1 — Error type extraction and primary grouping:**
   - Extract error type keyword from each entry's `symptom` field using regex patterns:
     - Match known JS error types: `SyntaxError`, `TypeError`, `ReferenceError`, `Error: ENOENT`, `Error: Cannot find module`
     - Match shell escaping pattern: look for `\\!` (backslash-bang) in symptom — classify as `ShellEscaping`
     - Match output/API errors: `Output too large`, `class not found` — classify as `ToolError`
     - Default fallback: `Unknown`
   - Group entries by their extracted error type into a Map<string, entry[]>

2. **Phase 2 — Levenshtein sub-clustering within each type group:**
   - For each type group with >1 entry, compare symptom strings pairwise using `levenshteinSimilarity` from `require('./levenshtein.cjs')`
   - Use greedy single-linkage: iterate entries, if similarity to any existing sub-cluster representative >= threshold (default 0.7 from `options.threshold`), add to that sub-cluster; otherwise start new sub-cluster
   - For groups with 1 entry, that entry is its own cluster

3. **Build cluster objects:**
   For each sub-cluster, produce:
   ```js
   {
     clusterId: `${errorType}-${index}`,  // e.g. "ShellEscaping-0", "ENOENT-0"
     label: string,          // Representative symptom truncated to 80 chars
     errorType: string,      // The extracted error type
     count: number,          // Number of entries in cluster
     entries: entry[],       // All entries in this cluster
     representative: entry,  // Entry with highest confidence, or first entry
     stale: boolean,         // true if ALL entries have ts older than 7 days from now
     avgConfidence: string   // 'high' if any entry is high, else 'medium' if any medium, else 'low'
   }
   ```

4. **Staleness detection:**
   - `options.staleAfterDays` (default 7)
   - A cluster is stale if every entry's `ts` field is older than `staleAfterDays` from `options.now || new Date()`
   - Entries without a `ts` field are treated as not-stale (conservative)

**Constraints:**
- Pure function: no file I/O, no side effects, no `require('fs')`
- Only external dependency: `require('./levenshtein.cjs')` for `levenshteinSimilarity`
- Handle edge cases: empty array returns []; entries with missing/empty symptom get type "Unknown"
- Module format: CommonJS (`module.exports = { clusterErrors }`)
  </action>
  <verify>
Run: `node -e "const { clusterErrors } = require('./bin/error-clusterer.cjs'); console.log(typeof clusterErrors);"` — prints "function".

Run: `node -e "const { clusterErrors } = require('./bin/error-clusterer.cjs'); const r = clusterErrors([]); console.log(JSON.stringify(r));"` — prints "[]".

Run: `node -e "
const { clusterErrors } = require('./bin/error-clusterer.cjs');
const entries = [
  { symptom: 'if (x \\\\!== y) SyntaxError', ts: new Date().toISOString() },
  { symptom: 'if (z \\\\!== w) SyntaxError', ts: new Date().toISOString() },
  { symptom: 'Error: ENOENT: no such file', ts: new Date().toISOString() }
];
const clusters = clusterErrors(entries);
console.log('clusters:', clusters.length, 'expected: 2');
clusters.forEach(c => console.log(c.clusterId, c.count));
"` — prints 2 clusters, shell escaping cluster has count 2, ENOENT has count 1.
  </verify>
  <done>
`bin/error-clusterer.cjs` exists, exports `clusterErrors`, correctly clusters shell escaping errors together, ENOENT errors together, handles empty input, and staleness detection works.
  </done>
</task>

<task type="auto">
  <name>Task 2: Update Category 16 in observe-handler-internal.cjs to use clusterer</name>
  <files>bin/observe-handler-internal.cjs</files>
  <action>
In `bin/observe-handler-internal.cjs`, replace the Category 16 block (lines 812-844) with cluster-based emission.

**Changes:**

1. Add require at top of the Category 16 try block:
   ```js
   const { clusterErrors } = require(path.join(projectRoot, 'bin', 'error-clusterer.cjs'));
   ```

2. Replace the `for (let idx = 0; ...)` loop with:
   ```js
   // Filter entries that have actionable content
   const actionableErrors = recentErrors.filter(e => e.root_cause || e.fix);

   // Cluster instead of emitting individually
   const clusters = clusterErrors(actionableErrors);

   for (const cluster of clusters) {
     const severity = cluster.stale ? 'info' : 'warning';
     const rep = cluster.representative;
     const symptomPreview = (rep.symptom || '').slice(0, 80);

     issues.push({
       id: `internal-error-cluster-${cluster.clusterId}`,
       title: `Error cluster (${cluster.count}): ${cluster.label}`,
       severity,
       url: '',
       age: rep.ts ? formatAgeFromMtime(new Date(rep.ts)) : '',
       created_at: rep.ts || new Date().toISOString(),
       meta: rep.fix
         ? `Fix: ${(rep.fix || '').slice(0, 100)}`
         : `Cause: ${(rep.root_cause || '').slice(0, 100)}`,
       source_type: 'internal',
       issue_type: 'issue',
       _route: '/nf:solve',
       _cluster_count: cluster.count
     });
   }
   ```

3. Keep the existing try/catch error handling wrapper intact.
4. Keep the `readLastN` call and `limitOverride` logic unchanged — the clusterer receives the same entries.

**Do NOT modify:**
- Any other category in observe-handler-internal.cjs
- `bin/debt-dedup.cjs`, `bin/fingerprint-issue.cjs`, or `bin/solve-debt-bridge.cjs`
  </action>
  <verify>
Run: `grep 'error-clusterer' bin/observe-handler-internal.cjs` — confirms require is present.

Run: `grep 'internal-error-cluster-' bin/observe-handler-internal.cjs` — confirms new ID format.

Run: `grep '_cluster_count' bin/observe-handler-internal.cjs` — confirms cluster count field.

Run: `node -e "
const path = require('path');
const projectRoot = process.cwd();
// Smoke test: require the handler to check no syntax errors
require('./bin/observe-handler-internal.cjs');
console.log('observe-handler-internal.cjs loads OK');
"` — no errors.

Negative check: `grep 'internal-error-\${idx}' bin/observe-handler-internal.cjs` — returns NO matches (old per-entry ID pattern removed).
  </verify>
  <done>
Category 16 now calls `clusterErrors()` and emits one issue per cluster with ID format `internal-error-cluster-{clusterId}`, title showing count and label, `_cluster_count` field present, and stale clusters get severity `info`.
  </done>
</task>

<task type="auto">
  <name>Task 3: Add test coverage for error-clusterer.cjs</name>
  <files>test/error-clusterer.test.cjs</files>
  <action>
Create `test/error-clusterer.test.cjs` using Node's built-in `node:test` and `node:assert` (matching project test conventions visible in existing test files).

**Test cases to cover:**

1. **Empty input**: `clusterErrors([])` returns `[]`

2. **Single entry**: One entry returns one cluster with count 1

3. **Shell escaping grouping**: Multiple entries with `\\!==` and `\\!fs.existsSync` in symptom all land in the same `ShellEscaping` type cluster. Verify count matches input count.

4. **ENOENT grouping**: Entries with `Error: ENOENT` symptoms group together, separate from shell escaping entries.

5. **Mixed types produce multiple clusters**: Feed 3 shell escaping + 2 ENOENT + 1 TypeError entries. Assert clusters.length >= 3 and each cluster's errorType is correct.

6. **Levenshtein sub-clustering within type**: Two entries of the same error type but very different symptoms (similarity < 0.7) produce separate sub-clusters. Two entries with near-identical symptoms produce one sub-cluster.

7. **Staleness detection**:
   - Cluster with all entries having ts > 7 days ago: `stale === true`
   - Cluster with at least one recent entry: `stale === false`
   - Use `options.now` to control the reference date for deterministic tests

8. **Missing fields gracefully handled**: Entry with no `symptom` field classified as `Unknown`, entry with no `ts` treated as not-stale.

9. **avgConfidence**: Cluster where one entry has confidence 'high' gets avgConfidence 'high'. Cluster with only 'low' entries gets 'low'.

10. **Cluster object shape**: Verify each cluster has all required fields: `clusterId`, `label`, `errorType`, `count`, `entries`, `representative`, `stale`, `avgConfidence`.

**Test structure:**
```js
const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { clusterErrors } = require('../bin/error-clusterer.cjs');
```

Run format: `node --test test/error-clusterer.test.cjs`
  </action>
  <verify>
Run: `node --test test/error-clusterer.test.cjs` — all tests pass with 0 failures.

Check: at least 8 test cases exist (`grep -c 'it(' test/error-clusterer.test.cjs` returns >= 8).
  </verify>
  <done>
Test file exists with 8+ test cases covering empty input, type grouping, Levenshtein sub-clustering, staleness, missing fields, confidence aggregation, and cluster object shape. All tests pass.
  </done>
</task>

</tasks>

<verification>
After all three tasks complete, run these verification commands:

1. `node --test test/error-clusterer.test.cjs` — all tests pass
2. `node -e "require('./bin/observe-handler-internal.cjs'); console.log('handler loads OK');"` — no syntax errors
3. `grep 'error-clusterer' bin/observe-handler-internal.cjs` — require is wired
4. `grep -c 'internal-error-cluster-' bin/observe-handler-internal.cjs` — at least 1 match (new ID format)
5. `node -e "const { clusterErrors } = require('./bin/error-clusterer.cjs'); const { readLastN } = require('./bin/memory-store.cjs'); const entries = readLastN(process.cwd(), 'errors', 30); const clusters = clusterErrors(entries.filter(e => e.root_cause || e.fix)); console.log('entries:', entries.length, 'clusters:', clusters.length); clusters.forEach(c => console.log(' ', c.clusterId, 'count=' + c.count, c.stale ? '(stale)' : '(active)'));"` — shows actual clustering of real errors.jsonl data into fewer groups
</verification>

<success_criteria>
- bin/error-clusterer.cjs exists as a pure function module with no file I/O
- Category 16 emits cluster-level issues instead of per-entry issues
- 22 error entries collapse to 3-5 clusters (verified against real data)
- Empty errors.jsonl produces zero issues without errors
- Stale clusters get severity `info`, active clusters get `warning`
- All tests pass
- No modifications to debt-dedup.cjs, fingerprint-issue.cjs, or solve-debt-bridge.cjs
</success_criteria>

<output>
After completion, create `.planning/quick/260-smart-error-clustering-for-category-16/260-01-SUMMARY.md`
</output>
