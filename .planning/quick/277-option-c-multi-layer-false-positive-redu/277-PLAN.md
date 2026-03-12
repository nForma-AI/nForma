---
phase: quick-277
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - bin/candidate-discovery.cjs
  - bin/formal-proximity.cjs
autonomous: true
requirements: []
formal_artifacts: none

must_haves:
  truths:
    - "Graph-sourced candidates with cross-domain model-requirement pairs are filtered out unless proximity exceeds 0.95"
    - "Already-covered requirements (formal_models[] non-empty) require a higher threshold (0.95) to produce candidates"
    - "Proximity scoring penalizes paths through generic type-hub nodes, reducing inflated scores"
    - "Candidates with zero keyword overlap between model file content and requirement text are auto-rejected"
    - "Non-neighbor (source: non_neighbor) candidates bypass all pre-filters"
  artifacts:
    - path: "bin/candidate-discovery.cjs"
      provides: "Category-domain gating, already-covered check, keyword pre-screen"
      exports: ["discoverCandidates"]
    - path: "bin/formal-proximity.cjs"
      provides: "Type-aware hop penalty in proximity BFS"
      exports: ["buildIndex", "proximity", "EDGE_WEIGHTS"]
  key_links:
    - from: "bin/candidate-discovery.cjs"
      to: ".planning/formal/category-groups.json"
      via: "require() to load domain group mappings"
      pattern: "category-groups\\.json"
    - from: "bin/candidate-discovery.cjs"
      to: ".planning/formal/requirements.json"
      via: "category + formal_models fields per requirement"
      pattern: "formal_models"
    - from: "bin/candidate-discovery.cjs"
      to: "bin/formal-proximity.cjs"
      via: "require('./formal-proximity.cjs').proximity"
      pattern: "formal-proximity"
    - from: "bin/formal-proximity.cjs"
      to: ".planning/formal/proximity-index.json"
      via: "BFS scoring with type-aware penalties"
      pattern: "EDGE_WEIGHTS"
---

<objective>
Reduce false positive rate in the proximity pipeline by adding three layers of filtering: (1) category-domain gating and already-covered requirement checks in candidate-discovery.cjs, (2) type-aware hop penalty in formal-proximity.cjs BFS scoring, and (3) keyword pre-screen that auto-rejects candidates with zero term overlap between model content and requirement text.

Purpose: The pipeline currently has a 100% Haiku false positive rate because the dense graph (2241 nodes, 5296 edges) allows multiple weak paths to accumulate into high scores. These three layers attack the problem at different points: pre-filter removes obviously wrong candidates before scoring, scoring improvements deflate artificially high scores, and keyword pre-screen catches semantic mismatches before expensive Haiku evaluation.

Output: Modified `bin/candidate-discovery.cjs` and `bin/formal-proximity.cjs` with pre-filters and improved scoring.
</objective>

<execution_context>
@/Users/jonathanborduas/.claude/nf/workflows/execute-plan.md
@/Users/jonathanborduas/.claude/nf/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@bin/candidate-discovery.cjs
@bin/formal-proximity.cjs
@bin/haiku-semantic-eval.cjs
@.planning/formal/category-groups.json
@.planning/formal/requirements.json
@.planning/formal/model-registry.json
</context>

<tasks>

<task type="auto">
  <name>Task 1: Add type-aware hop penalty to proximity BFS scoring</name>
  <files>bin/formal-proximity.cjs</files>
  <action>
Modify the `proximity()` function in `bin/formal-proximity.cjs` to apply a type-aware hop penalty that deflates scores inflated by traversal through generic hub nodes.

**What to change in the `proximity()` function (starting around line 499):**

1. Inside the edge expansion loop (around line 527), after computing `edgeWeight` from `EDGE_WEIGHTS`, add a hub-node penalty: if the target node (`edge.to`) is of type `formal_model` and the edge relationship is a structural/directory relationship (one of: `contains`, `in_file`, `owned_by`, `owns`), multiply `edgeWeight` by 0.5 (halving it). This penalizes paths that hop through generic formal_model nodes via directory containment rather than semantic concept edges.

2. The penalty applies ONLY to intermediate hops — do NOT penalize when `edge.to === nodeKeyB` (the target node we are actually scoring against).

3. To determine the node type of `edge.to`, read from `index.nodes[edge.to].type`. The hub types to penalize are: `formal_model` when reached via structural edges. The structural edge set is: `contains`, `in_file`, `owned_by`, `owns`.

**Implementation detail:**
```javascript
// Inside the edge loop, after: const edgeWeight = EDGE_WEIGHTS[edge.rel] || 0.3;
let effectiveWeight = edgeWeight;
// Penalize structural hops through hub node types (formal_model via directory edges)
if (edge.to !== nodeKeyB) {
  const targetNode = index.nodes[edge.to];
  const isStructuralEdge = edge.rel === 'contains' || edge.rel === 'in_file' || edge.rel === 'owned_by' || edge.rel === 'owns';
  if (targetNode && targetNode.type === 'formal_model' && isStructuralEdge) {
    effectiveWeight *= 0.5;
  }
}
const newMin = Math.min(minWeight, effectiveWeight);
```

This replaces the current `const newMin = Math.min(minWeight, edgeWeight);` line.

Do NOT change the `EDGE_WEIGHTS` constant, the `buildIndex()` function, `DECAY`, or any other part of the file. Only modify the `proximity()` function.
  </action>
  <verify>
Run: `node -e "const {proximity, buildIndex} = require('./bin/formal-proximity.cjs'); const {index} = buildIndex(); const score = proximity(index, 'formal_model::.planning/formal/alloy/solve-session-persistence.als', 'requirement::ACT-01', 3); console.log('Score:', score);"` — should return a numeric score (verifying no crash). Then verify the module still exports correctly: `node -e "const m = require('./bin/formal-proximity.cjs'); console.log('exports:', Object.keys(m));"` should show `buildIndex, proximity, EDGE_WEIGHTS, REVERSE_RELS`.
  </verify>
  <done>
The `proximity()` function applies a 0.5x penalty when traversing through `formal_model` nodes via structural edges (`contains`, `in_file`, `owned_by`, `owns`), deflating scores that accumulated through generic directory-level hub connections. All existing exports preserved.
  </done>
</task>

<task type="auto">
  <name>Task 2: Add pre-filters and keyword pre-screen to candidate discovery</name>
  <files>bin/candidate-discovery.cjs</files>
  <action>
Modify `bin/candidate-discovery.cjs` to add three pre-filter layers that reduce false positives. All filters apply ONLY to graph-sourced candidates (score > threshold), NOT to non-neighbor candidates.

**Step A — Load additional data at the top of `discoverCandidates()`:**

After the existing `require('./formal-proximity.cjs')` line, add:
```javascript
// Load category-groups for domain gating
const CATEGORY_GROUPS_PATH = path.join(process.cwd(), '.planning', 'formal', 'category-groups.json');
let categoryGroups = {};
try { categoryGroups = JSON.parse(fs.readFileSync(CATEGORY_GROUPS_PATH, 'utf8')); } catch { /* no category groups available */ }

// Build model -> category group lookup from model-registry requirements
// modelCategoryGroups: Map<modelPath, Set<categoryGroup>>
const modelCategoryGroups = new Map();
for (const [mp, mi] of Object.entries(modelRegistry.models || {})) {
  const groups = new Set();
  for (const rId of (mi.requirements || [])) {
    const req = requirements.find(r => r.id === rId);
    if (req && req.category && categoryGroups[req.category]) {
      groups.add(categoryGroups[req.category]);
    }
  }
  modelCategoryGroups.set(mp, groups);
}

// Build requirement -> category group lookup
const reqCategoryGroup = new Map();
for (const req of requirements) {
  if (req.category && categoryGroups[req.category]) {
    reqCategoryGroup.set(req.id, categoryGroups[req.category]);
  }
}

// Build requirement -> already-covered flag (formal_models non-empty)
const reqAlreadyCovered = new Map();
for (const req of requirements) {
  reqAlreadyCovered.set(req.id, Array.isArray(req.formal_models) && req.formal_models.length > 0);
}
```

**Step B — Add pre-filter logic inside the candidate scoring loop:**

In the existing loop where `score > threshold` leads to `candidates.push(...)` (around line 72), replace the simple push with a filtered push. The logic should be:

```javascript
if (score > threshold) {
  let dominated = false;
  let filterReason = null;

  // Pre-filter 1: Category-domain gating
  // If model's declared requirements are ALL in one category group,
  // and the candidate requirement is in a DIFFERENT category group,
  // reject unless score > 0.95
  const modelGroups = modelCategoryGroups.get(modelPath);
  const reqGroup = reqCategoryGroup.get(reqId);
  if (modelGroups && modelGroups.size === 1 && reqGroup) {
    const modelGroup = [...modelGroups][0];
    if (modelGroup !== reqGroup && score <= 0.95) {
      dominated = true;
      filterReason = 'cross_domain';
    }
  }

  // Pre-filter 2: Already-covered requirement check
  // If requirement already has formal_models, raise threshold to 0.95
  if (!dominated && reqAlreadyCovered.get(reqId) && score <= 0.95) {
    dominated = true;
    filterReason = 'already_covered';
  }

  if (!dominated) {
    candidates.push({
      model: modelPath,
      requirement: reqId,
      proximity_score: Math.round(score * 10000) / 10000,
      source: 'graph',
    });
  } else {
    filteredCount++;
  }
}
```

Add `let filteredCount = 0;` near the top of the function (next to `totalPairsChecked`).

**Step C — Add keyword pre-screen function (Layer 3):**

Add a new function BEFORE `discoverCandidates()`:

```javascript
/**
 * Keyword pre-screen: extract key terms from requirement text and model file,
 * compute overlap. Zero overlap = auto-reject.
 * @param {string} modelPath - Path to formal model file
 * @param {string} reqText - Requirement text
 * @returns {boolean} true if there is meaningful keyword overlap
 */
function keywordOverlap(modelPath, reqText) {
  // Extract terms from requirement (3+ char words, lowercased, deduplicated)
  const STOP_WORDS = new Set(['the', 'and', 'for', 'are', 'but', 'not', 'you', 'all', 'can', 'has', 'her', 'was', 'one', 'our', 'out', 'with', 'that', 'this', 'from', 'they', 'been', 'have', 'its', 'will', 'would', 'could', 'should', 'each', 'which', 'their', 'there', 'when', 'must', 'shall']);
  const extractTerms = (text) => {
    if (!text) return new Set();
    return new Set(
      text.toLowerCase()
        .replace(/[^a-z0-9\s-_]/g, ' ')
        .split(/\s+/)
        .filter(w => w.length >= 3 && !STOP_WORDS.has(w))
    );
  };

  const reqTerms = extractTerms(reqText);
  if (reqTerms.size === 0) return true; // Can't filter if no terms

  // Read model file content
  let modelContent = '';
  try {
    const fullPath = path.join(process.cwd(), modelPath);
    modelContent = fs.readFileSync(fullPath, 'utf8');
  } catch {
    return true; // Can't read file = don't filter
  }

  const modelTerms = extractTerms(modelContent);
  if (modelTerms.size === 0) return true;

  // Count overlapping terms
  let overlap = 0;
  for (const term of reqTerms) {
    if (modelTerms.has(term)) overlap++;
  }

  // Zero overlap = reject
  return overlap > 0;
}
```

**Step D — Wire keyword pre-screen into the candidate loop:**

After the category-domain and already-covered checks (after the `if (!dominated)` block but BEFORE the `candidates.push()`), add:

```javascript
// Pre-filter 3: Keyword pre-screen
if (!dominated) {
  const req = requirements.find(r => r.id === reqId);
  const reqText = req ? req.text : '';
  if (!keywordOverlap(modelPath, reqText)) {
    dominated = true;
    filterReason = 'no_keyword_overlap';
  }
}
```

**Step E — Add filteredCount to metadata output:**

In the returned metadata object, add `candidates_filtered: filteredCount` after `candidates_found`.

Also add a stderr log line after the histogram block:
```javascript
if (filteredCount > 0) {
  process.stderr.write(`[candidate-discovery] Pre-filtered ${filteredCount} candidates (cross-domain, already-covered, or no keyword overlap)\n`);
}
```

**Important constraints:**
- Do NOT modify the non-neighbor discovery section — all three pre-filters apply ONLY to graph-sourced candidates inside the `if (score > threshold)` block
- Do NOT change the function signature of `discoverCandidates()`
- Do NOT change the CLI argument parsing
- Preserve the existing `module.exports = { discoverCandidates }` export
- The `keywordOverlap` function reads model files synchronously — this is acceptable since candidate-discovery runs offline and processes at most a few hundred pairs
  </action>
  <verify>
1. Verify no syntax errors: `node -e "require('./bin/candidate-discovery.cjs')"` exits 0
2. Verify exports preserved: `node -e "const m = require('./bin/candidate-discovery.cjs'); console.log('exports:', Object.keys(m));"` shows `discoverCandidates`
3. Run the actual discovery: `node bin/candidate-discovery.cjs --json --top 10 2>&1 | tail -20` — confirm it runs without error and the metadata now includes `candidates_filtered` field
4. Verify pre-filter is active: stderr output should include "Pre-filtered N candidates" line (N may be 0 if no candidates match filters, but the log line format should be present when N > 0)
5. Verify non-neighbor candidates still appear: output should still contain candidates with `"source": "non_neighbor"` if any existed before
  </verify>
  <done>
Three pre-filter layers active in candidate-discovery.cjs: (1) category-domain gating rejects cross-domain candidates below 0.95, (2) already-covered requirements require 0.95+ score, (3) keyword pre-screen auto-rejects zero-overlap pairs. All filters apply only to graph-sourced candidates. Non-neighbor candidates bypass all filters. Metadata includes `candidates_filtered` count.
  </done>
</task>

</tasks>

<verification>
Run the full proximity pipeline to verify end-to-end:
1. `node bin/formal-proximity.cjs --dry-run` — graph builds without error
2. `node bin/candidate-discovery.cjs --json --top 10 2>&1` — candidates discovered with pre-filter counts in stderr
3. Compare candidate count before and after: the filtered pipeline should produce fewer graph-sourced candidates, with the `candidates_filtered` metadata field showing how many were removed
4. Verify no regression: non-neighbor candidates with `source: "non_neighbor"` still appear in output
</verification>

<success_criteria>
- formal-proximity.cjs applies type-aware hop penalty (0.5x) for structural edges through formal_model nodes
- candidate-discovery.cjs pre-filters cross-domain candidates (different category group, score <= 0.95)
- candidate-discovery.cjs raises threshold to 0.95 for already-covered requirements
- candidate-discovery.cjs auto-rejects candidates with zero keyword overlap
- Non-neighbor candidates are unaffected by all pre-filters
- Both scripts run without errors and preserve existing exports
- Pipeline metadata includes `candidates_filtered` count
</success_criteria>

<output>
After completion, create `.planning/quick/277-option-c-multi-layer-false-positive-redu/SUMMARY.md`
</output>
