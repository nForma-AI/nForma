---
phase: quick-314
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - bin/formal-proximity.cjs
  - bin/formal-proximity.test.cjs
  - bin/candidate-discovery.cjs
  - bin/candidate-discovery.test.cjs
autonomous: true
formal_artifacts: none
requirements: [QUICK-314]

must_haves:
  truths:
    - "countEmbeddedEdges() returns accurate edge count by summing node.edges.length across all nodes"
    - "Orphan requirements in candidate-discovery are determined by 0 edges in proximity graph, not zero-scoring pairs"
    - "Default threshold is 0.7, eliminating the 0.60-0.62 noise floor false positives"
    - "Fast-path skips ensemble when coverage >= 95%, directly surfacing uncovered requirements via grep"
    - "Truly uncovered requirements (no mention in any .als/.tla/.pm file) are surfaced prominently in CLI output"
    - "Graph builder extracts @requirement annotations from .tla and .pm files in addition to existing JSON sources"
  artifacts:
    - path: "bin/formal-proximity.cjs"
      provides: "countEmbeddedEdges function, TLA+/PRISM @requirement extraction in buildIndex"
      exports: ["buildIndex", "proximity", "countEmbeddedEdges"]
    - path: "bin/candidate-discovery.cjs"
      provides: "Graph-connectivity orphan detection, 0.7 threshold, fast-path for high coverage, uncovered requirements section"
      exports: ["discoverCandidates"]
  key_links:
    - from: "bin/candidate-discovery.cjs"
      to: "bin/formal-proximity.cjs"
      via: "require('./formal-proximity.cjs')"
      pattern: "require.*formal-proximity"
    - from: "bin/formal-proximity.cjs buildIndex step 13+"
      to: ".planning/formal/tla/*.tla, .planning/formal/prism/*.pm"
      via: "fs.readFileSync + regex @requirement extraction"
      pattern: "@requirement\\s+([A-Z0-9_-]+)"
---

<objective>
Fix 5 issues in the proximity pipeline: stats reader edge counting, orphan definition accuracy, threshold tuning, uncovered requirement surfacing, and TLA+/PRISM requirement extraction.

Purpose: The proximity pipeline currently produces high false-positive orphan/candidate results because (1) orphans are defined by zero-scoring pairs instead of graph connectivity, (2) the 0.6 threshold is at the noise floor, (3) TLA+/PRISM @requirement annotations are not extracted into the graph, and (4) truly uncovered requirements are not surfaced.

Output: Updated bin/formal-proximity.cjs and bin/candidate-discovery.cjs with accurate edge counting, graph-based orphan detection, 0.7 threshold, uncovered-requirement surfacing, and multi-formalism @requirement extraction.
</objective>

<execution_context>
@/Users/jonathanborduas/.claude/nf/workflows/execute-plan.md
@/Users/jonathanborduas/.claude/nf/templates/summary.md
</execution_context>

<context>
@bin/formal-proximity.cjs
@bin/formal-proximity.test.cjs
@bin/candidate-discovery.cjs
@bin/candidate-discovery.test.cjs
@.planning/formal/proximity-index.json
@.planning/formal/requirements.json
</context>

<tasks>

<task type="auto">
  <name>Task 1: Add countEmbeddedEdges and TLA+/PRISM @requirement extraction to formal-proximity.cjs</name>
  <files>bin/formal-proximity.cjs, bin/formal-proximity.test.cjs</files>
  <action>
  Two changes to bin/formal-proximity.cjs:

  **1. Add countEmbeddedEdges() utility function:**
  Create and export a `countEmbeddedEdges(index)` function that counts total edges by summing `node.edges.length` across all `index.nodes`. This is needed because the proximity-index.json has no top-level `edges` array — edges are embedded inside each node object. The function should return `{ totalEdges: number, byType: Record<string, number> }` where `byType` groups edge counts by node type.

  **2. Add Step 13b: Parse @requirement annotations from formal model source files:**
  After the existing Step 12 (debt.json) and before Step 13 (REVERSE PASS), add a new step that:
  - Scans `.planning/formal/alloy/*.als`, `.planning/formal/tla/*.tla`, and `.planning/formal/prism/*.pm`
  - For each file, reads content and extracts `@requirement` annotations using regex: `/[@]requirement\s+([A-Z][A-Z0-9_-]+)/g`
    - Alloy (.als) comment prefix: `--`
    - TLA+ (.tla) comment prefix: `\*`
    - PRISM (.pm) comment prefix: `//`
    - The regex should match the annotation itself regardless of comment prefix
  - For each extracted requirement ID, creates a `modeled_by` edge from `requirement::{reqId}` to `formal_model::{relativePath}` with source `'source-annotation'`
  - Ensures the formal_model and requirement nodes exist via ensureNode()
  - The relativePath should be relative to process.cwd(), e.g. `.planning/formal/tla/NFQuorum.tla`
  - Deduplicates: if the same reqId appears multiple times in one file, only one edge is created
  - Add `'source-annotations'` to the sources tracking with mtime of latest scanned file
  - Log count to stderr: `[proximity] Extracted {N} requirement annotations from {M} source files`

  **Export countEmbeddedEdges** in the module.exports at the bottom of the file.

  **Tests in bin/formal-proximity.test.cjs:**
  - Add test: `countEmbeddedEdges returns accurate totals` — call buildIndex(), then countEmbeddedEdges(index), verify totalEdges matches manual sum of node.edges.length
  - Add test: `source annotation extraction creates edges for TLA+ files` — call buildIndex(), check that `requirement::QUORUM-01` node has an edge with `rel: 'modeled_by'` and source `'source-annotation'` pointing to a formal_model containing `NFQuorum.tla`
  - Add test: `source annotation extraction creates edges for PRISM files` — check that `requirement::QUORUM-02` has a `modeled_by` edge to a formal_model containing `quorum.pm`
  </action>
  <verify>
  Run: `node --test bin/formal-proximity.test.cjs`
  All tests pass including the 3 new ones.
  Run: `node bin/formal-proximity.cjs --dry-run 2>&1 | grep -E 'annotation|Edges'`
  Verify annotation extraction log line appears and edge count is accurate.
  </verify>
  <done>
  countEmbeddedEdges() exported and accurate. buildIndex() extracts @requirement from .als/.tla/.pm source files, creating modeled_by edges with source 'source-annotation'. All tests pass.
  </done>
</task>

<task type="auto">
  <name>Task 2: Fix orphan definition, raise threshold, surface uncovered requirements in candidate-discovery.cjs</name>
  <files>bin/candidate-discovery.cjs, bin/candidate-discovery.test.cjs</files>
  <action>
  Three changes to bin/candidate-discovery.cjs:

  **1. Redefine orphan detection using graph connectivity (lines ~297-360):**
  Replace the current orphan detection logic (which uses zero-scoring pairs from the ensemble) with graph-connectivity checks:
  - **Orphan models:** A model is an orphan if its node in proximity-index.json has 0 edges (i.e., `proximityIndex.nodes[modelKey].edges.length === 0` or the node does not exist in the index).
  - **Orphan requirements:** A requirement is an orphan if its node in proximity-index.json has 0 edges (i.e., `proximityIndex.nodes[reqKey].edges.length === 0` or the node does not exist in the index).
  - Remove the `zeroPairs` array and all the coverage-gap heuristic ranking logic for orphans. Replace with direct graph connectivity checks after the main candidate loop.
  - Keep the `orphans: { models: [...], requirements: [...] }` output shape but populate from graph connectivity.

  **2. Raise default threshold from 0.6 to 0.7:**
  - In `discoverCandidates()`: change `const threshold = opts.threshold != null ? opts.threshold : 0.6;` to default `0.7`
  - In `parseArgs()`: change `const args = { minScore: 0.6, ...}` to `minScore: 0.7`
  - Update the histogram buckets to start at 0.7: `{ '0.7-0.8': 0, '0.8-0.9': 0, '0.9-1.0': 0 }`
  - Update the ensemble floor: `const ensembleFloor = Math.max(threshold, 0.7);`

  **3. Add fast-path for high-coverage codebases:**
  Before running the expensive ensemble scoring (70K+ pair checks), compute a quick coverage ratio:
  - Count requirement IDs mentioned in any formal model file (.als/.tla/.pm) using grep
  - If coverage >= 95% (i.e., uncovered/total < 0.05), emit a `[candidate-discovery] Fast path: {covered}/{total} requirements covered ({pct}%) — skipping ensemble, surfacing gaps directly` log line
  - Skip the full ensemble loop entirely
  - Instead, directly populate `uncovered_requirements` (see item 4 below) and set `candidates: []` with metadata `fast_path: true`
  - Still compute orphans using graph connectivity (item 1)
  - The ensemble is most valuable when coverage is sparse; at 99%+ it's hunting for needles that aren't there
  - Add `--no-fast-path` CLI flag to force the full ensemble even when coverage is high (for debugging/benchmarking)

  **4. Surface truly uncovered requirements prominently:**
  After candidate discovery completes, add a new section that:
  - Reads all requirement IDs from the requirements array
  - Scans all files in `.planning/formal/alloy/*.als`, `.planning/formal/tla/*.tla`, `.planning/formal/prism/*.pm`
  - For each requirement ID, checks if it appears (as a string match) in ANY of those formal model files
  - Requirements that appear in ZERO formal model files are "truly uncovered"
  - Add to the result object: `uncovered_requirements: [{ id: string, text: string }]`
  - Log prominently to stderr:
    ```
    [candidate-discovery] === TRULY UNCOVERED REQUIREMENTS ===
    [candidate-discovery]   {REQ-ID}: {text} (no mention in any formal model)
    [candidate-discovery] === {N} requirements have no formal model coverage ===
    ```
  - Add `uncovered_requirements_count` to metadata

  **Tests in bin/candidate-discovery.test.cjs:**
  - Update existing threshold test: the default is now 0.7 so adjust assertions (score 0.65 should NOT appear with default threshold)
  - Add test: `orphan detection uses graph connectivity` — create mock index where REQ-01 node has edges but REQ-02 node has 0 edges. Verify REQ-02 appears in orphans.requirements but REQ-01 does not.
  - Add test: `result includes uncovered_requirements array` — verify the output shape includes the field (it will be empty in mocked tests since no disk files, but the field must exist)
  </action>
  <verify>
  Run: `node --test bin/candidate-discovery.test.cjs`
  All tests pass including updated and new ones.
  Run: `node bin/candidate-discovery.cjs --json 2>&1 | grep -E 'UNCOVERED|orphan'`
  Verify uncovered requirements section appears in stderr output and orphan counts reflect graph connectivity.
  </verify>
  <done>
  Orphan detection uses graph connectivity (0-edge nodes) instead of zero-scoring pairs. Default threshold raised to 0.7. Truly uncovered requirements (no mention in any .als/.tla/.pm) surfaced prominently. All tests pass.
  </done>
</task>

</tasks>

<verification>
1. `node --test bin/formal-proximity.test.cjs` — all tests pass
2. `node --test bin/candidate-discovery.test.cjs` — all tests pass
3. `node bin/formal-proximity.cjs --dry-run 2>&1` — shows annotation extraction stats, accurate edge count
4. `node bin/candidate-discovery.cjs --json 2>&1` — shows truly uncovered requirements section, orphan counts from graph connectivity, uses 0.7 threshold
5. No regressions in existing pipeline: candidates.json output shape unchanged except for new `uncovered_requirements` field
</verification>

<success_criteria>
- countEmbeddedEdges() exported from formal-proximity.cjs and returns accurate counts
- buildIndex() extracts @requirement from .als, .tla, .pm source files creating modeled_by edges
- Orphan models/requirements determined by 0-edge graph connectivity, not zero-scoring pairs
- Default threshold is 0.7 (previously 0.6)
- Fast-path skips ensemble when coverage >= 95%, surfacing gaps directly via grep (--no-fast-path to override)
- Truly uncovered requirements (not mentioned in any formal model file) surfaced in output
- All existing and new tests pass
</success_criteria>

<output>
After completion, create `.planning/quick/314-fix-proximity-pipeline-stats-reader-orph/314-SUMMARY.md`
</output>
