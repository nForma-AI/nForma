---
phase: quick-217
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - bin/formal-proximity.cjs
  - bin/formal-proximity.test.cjs
  - bin/formal-query.cjs
  - bin/formal-query.test.cjs
autonomous: true
formal_artifacts: none
requirements: [QUICK-217]

must_haves:
  truths:
    - "Running formal-proximity.cjs generates proximity-index.json from all 12 source artifact types"
    - "The index contains bidirectional edges — every forward edge has a reverse"
    - "Running formal-query.cjs reach on a known node returns correct reachable nodes"
    - "Running formal-query.cjs impact on a code file returns linked requirements and invariants"
    - "Orphan nodes (zero edges) are reported in build output as warnings"
    - "risk_transition composite keys use the delimiter format risk_transition::STATE-EVENT-TO_STATE with hyphens"
  artifacts:
    - path: "bin/formal-proximity.cjs"
      provides: "Index builder — reads 12 artifact types (including scope.json from each spec/*/ dir), emits proximity-index.json"
      min_lines: 200
    - path: "bin/formal-proximity.test.cjs"
      provides: "Tests for builder, reverse edges, scoring, orphan detection"
      min_lines: 100
    - path: "bin/formal-query.cjs"
      provides: "CLI for reach, path, neighbors, impact, coverage queries"
      min_lines: 120
    - path: "bin/formal-query.test.cjs"
      provides: "Tests for query CLI traversal and output"
      min_lines: 80
    - path: ".planning/formal/proximity-index.json"
      provides: "Generated bidirectional adjacency graph"
      contains: "schema_version"
  key_links:
    - from: "bin/formal-proximity.cjs"
      to: ".planning/formal/proximity-index.json"
      via: "fs.writeFileSync output"
      pattern: "proximity-index\\.json"
    - from: "bin/formal-query.cjs"
      to: ".planning/formal/proximity-index.json"
      via: "fs.readFileSync + JSON.parse input (not require())"
      pattern: "proximity-index\\.json"
    - from: "bin/formal-proximity.cjs"
      to: ".planning/formal/spec/*/scope.json"
      via: "glob read of all scope.json files (one per spec dir, ~15 files)"
      pattern: "scope\\.json"
    - from: "bin/formal-proximity.cjs"
      to: ".planning/formal/constants-mapping.json"
      via: "direct file read"
      pattern: "constants-mapping"
---

<objective>
Build the formal proximity index builder and query CLI as specified in the DESIGN.md.

Purpose: Replace isolated formal-to-code lookups with a unified bidirectional graph that enables "given X, what touches X?" queries across all 12 formal artifact types. This is the foundational data structure that nf-solve, formal-scope-scan, and nf:quick will consume.

Output: Four scripts (builder, builder tests, query CLI, query tests) and one generated artifact (proximity-index.json). Note: proximity-index.schema.json (DESIGN.md section 7) is deferred to a follow-up task.
</objective>

<execution_context>
@/Users/jonathanborduas/.claude/nf/workflows/execute-plan.md
@/Users/jonathanborduas/.claude/nf/templates/summary.md
</execution_context>

<context>
@.planning/formal/spec/formal-proximity-index/DESIGN.md
@bin/formal-scope-scan.cjs
</context>

<tasks>

<task type="auto">
  <name>Task 1: Build the proximity index builder (formal-proximity.cjs) and tests</name>
  <files>bin/formal-proximity.cjs, bin/formal-proximity.test.cjs</files>
  <action>
Create `bin/formal-proximity.cjs` — a CommonJS script with `'use strict'` that reads all 12 source artifact types and emits `.planning/formal/proximity-index.json`.

Follow the existing pattern from `bin/formal-scope-scan.cjs` (parseArgs, printHelp, main function structure).

**Source artifact types (IMPORTANT — 12 distinct artifact types; scope.json is ONE type that appears in multiple spec/*/ dirs):**

The 12 artifact types enumerated in DESIGN.md section 4 are:
1. `spec/*/scope.json` — glob all scope files across spec dirs (breaker, quorum, oscillation, etc.). This is ONE artifact type even though it yields ~15 individual files.
2. `constants-mapping.json` — top-level formal/
3. `model-registry.json` — top-level formal/
4. `semantics/invariant-catalog.json` — NOT top-level
5. `traceability-matrix.json` — top-level formal/
6. `unit-test-coverage.json` — top-level formal/
7. `evidence/instrumentation-map.json` — in evidence/
8. `evidence/event-vocabulary.json` — in evidence/
9. `semantics/observed-fsm.json` — in semantics/
10. `reasoning/risk-heatmap.json` — in reasoning/
11. `evidence/git-heatmap.json` — in evidence/
12. `debt.json` — top-level formal/

**Build pipeline (14 steps from DESIGN.md section 4):**

Step 1 — scope.json: For each `spec/*/scope.json`, extract `source_files` array -> create `code_file` nodes with `owns` edges to `formal_module` (directory name). Extract `concepts` array -> create `concept` nodes with `describes` edges to `formal_module`.

Step 2 — constants-mapping.json: For each mapping, create `constant` node with `maps_to` edge to `config_path` node (if config_path not null), and `declared_in` edge to `formal_model` node (from source field).

Step 3 — model-registry.json: For each model in `models` object, create `formal_model` node. For each requirement in its `requirements` array, create `requirement` node with `modeled_by` edge to the model.

Step 4 — invariant-catalog.json: For each invariant in `invariants` array, create `invariant` node with `declared_in` edge to `formal_model` node (constructed from `source_file` field, prepended with `.planning/formal/`).

Step 5 — traceability-matrix.json: For each requirement in `requirements` object, for each property, create `verified_by` edge from requirement to invariant (property_name).

Step 6 — unit-test-coverage.json: For each requirement in `requirements` object where `covered: true`, create `tested_by` edge from requirement to test_file (from test_cases[].test_file).

Step 7 — instrumentation-map.json: For each emission_point, create `code_line` node (file:line_number) with `emits` edge to `formal_action` node. Also create `contains` edge from `code_file` to `code_line`, and `in_file` reverse.

Step 8 — event-vocabulary.json: For each action in `vocabulary` object (skip "undefined" entry), create `formal_action` node with `triggers` edge to `xstate_event` node (if xstate_event is not null).

Step 9 — observed-fsm.json: For each state in `observed_transitions`, for each event, create `xstate_event` node with `transitions` edge to `fsm_state` node (the to_state). Also create `from_state` edge from event to the source state.

Step 10 — risk-heatmap.json: For each transition in `transitions` array, create `risk_transition` node. **Composite key format:** `risk_transition::FROM_STATE-EVENT-TO_STATE` using hyphens as delimiters between the three components (e.g., `risk_transition::IDLE-CIRCUIT_BREAK-IDLE`). Note that individual state/event names may contain underscores — the hyphen is the inter-component delimiter. Add `scores` edges to the from/to `fsm_state` nodes. Attach `risk_score` and `risk_tier` as node metadata.

Step 11 — git-heatmap.json: For each signal in `signals.numerical_adjustments`, find existing `constant` nodes and decorate with `drift` metadata (direction, touch_count from the signal).

Step 12 — debt.json: For each entry in `debt_entries` array, create `debt_entry` node. If it has requirement references, add `affects` edges. (Note: currently empty, but handle the structure.)

Step 13 — REVERSE PASS: Iterate all nodes. For each edge A->B, ensure B has a reverse edge back to A. Use reverse relationship names: owns/owned_by, contains/in_file, emits/emitted_by, maps_to/mapped_from, modeled_by/models, declares/declared_in, verified_by/verifies, tested_by/tests, triggers/triggered_by, transitions/transitioned_by, describes/described_by, scores/scored_by, affects/affected_by, constrains/constrained_by.

Step 14 — VALIDATE: Count orphan nodes (nodes with 0 edges). Print warning to stderr for each. Print summary to stderr: total nodes, total edges, orphan count.

**Output format:** Match DESIGN.md section 2.3 exactly:
```json
{
  "schema_version": "1",
  "generated": "ISO timestamp",
  "sources": { "artifact-name": { "mtime": "...", "hash": "sha256 first 8 chars" } },
  "node_key_format": "type::id",
  "nodes": { "type::id": { "type": "...", "id": "...", "edges": [...] } }
}
```

Each edge: `{ "to": "type::id", "rel": "relationship", "source": "artifact-name" }`

**Proximity scoring:** Implement the `proximity(A, B)` function from DESIGN.md section 5 with edge weights and 0.7 decay per hop. Export it for use by formal-query.cjs. Use BFS to find all paths up to maxDepth.

**CLI interface:**
- `node bin/formal-proximity.cjs` — build and write index, print summary to stderr
- `node bin/formal-proximity.cjs --dry-run` — build but don't write, print summary
- `node bin/formal-proximity.cjs --json` — print index to stdout instead of file
- Exit 0 on success, exit 1 on fatal error (missing required artifacts)
- Fail-open: if optional artifacts are missing (debt.json empty, etc.), skip with warning

**Exports for require():** `module.exports = { buildIndex, proximity, EDGE_WEIGHTS, REVERSE_RELS }`

**Note on JSON Schema:** DESIGN.md section 7 specifies a `proximity-index.schema.json` for validating the index. This is deferred — do NOT create it in this plan. Focus on the builder and query tools.

Then create `bin/formal-proximity.test.cjs` using vitest (builder tests ONLY — query tests go in a separate file):
- Test buildIndex with minimal fixture data (2-3 fake scope.json entries, a few constants, a couple model-registry entries)
- Test reverse edge generation: every forward edge must have a matching reverse
- Test orphan detection: a node with no edges should appear in warnings
- Test proximity scoring: known path with known weights should produce expected score
- Test edge weight lookup for each relationship type
- Test fail-open: missing optional artifact file should not crash, just skip
- Test risk_transition composite key format: verify keys use `FROM_STATE-EVENT-TO_STATE` hyphen delimiter pattern
  </action>
  <verify>
Run `node bin/formal-proximity.cjs` from repo root — should generate `.planning/formal/proximity-index.json` and print summary to stderr showing node/edge counts.
Run `npx vitest run bin/formal-proximity.test.cjs` — all tests pass.
Verify proximity-index.json has `schema_version`, `sources`, `nodes` keys using fs.readFileSync + JSON.parse (not require()) to avoid Node module cache:
`node -e "const idx = JSON.parse(require('fs').readFileSync('.planning/formal/proximity-index.json','utf8')); const n = Object.keys(idx.nodes).filter(k => k.startsWith('code_file::')); console.log(n.length + ' code_file nodes')"` — should show >0 code_file nodes.
Verify risk_transition keys use hyphen delimiter: `node -e "const idx = JSON.parse(require('fs').readFileSync('.planning/formal/proximity-index.json','utf8')); const rt = Object.keys(idx.nodes).filter(k => k.startsWith('risk_transition::')); console.log(rt[0] || 'none')"` — should show pattern like `risk_transition::STATE-EVENT-STATE`.
  </verify>
  <done>
formal-proximity.cjs reads all 12 source artifact types (including all spec/*/scope.json files), builds bidirectional adjacency graph, writes proximity-index.json with correct schema. risk_transition keys use hyphen-delimited composite format. All reverse edges present. Tests pass. Orphan warnings printed to stderr.
  </done>
</task>

<task type="auto">
  <name>Task 2: Build the query CLI (formal-query.cjs) and its dedicated tests</name>
  <files>bin/formal-query.cjs, bin/formal-query.test.cjs</files>
  <action>
Create `bin/formal-query.cjs` — a CommonJS script with `'use strict'` that loads `proximity-index.json` and provides graph traversal queries.

**IMPORTANT:** Load proximity-index.json using `fs.readFileSync` + `JSON.parse`, NOT `require()`. This avoids Node's module cache serving stale data if the index was recently rebuilt.

**CLI interface (from DESIGN.md section 3):**

```
node bin/formal-query.cjs reach <node-key> [--depth N] [--filter type1,type2]
node bin/formal-query.cjs path <from-key> <to-key>
node bin/formal-query.cjs neighbors <node-key>
node bin/formal-query.cjs impact <code-file-path>
node bin/formal-query.cjs coverage <requirement-id>
node bin/formal-query.cjs proximity <node-key-A> <node-key-B>
node bin/formal-query.cjs stats
node bin/formal-query.cjs --help
```

**Command implementations:**

`reach(startNode, maxDepth, filter)` — BFS from startNode up to maxDepth hops. If filter provided, only include nodes whose type matches one of the filter types. Output grouped by depth level.

`path(from, to)` — BFS shortest path between two nodes. Print the path as a chain: `A --rel--> B --rel--> C`. If no path, print "No path found".

`neighbors(node)` — Direct edges only (depth=1 reach). Print each edge with relationship type and target.

`impact(codeFilePath)` — Convenience wrapper: `reach("code_file::" + codeFilePath, 3, [invariant, requirement, formal_model, test_file])`. Designed for "what formal elements does this code change affect?"

`coverage(requirementId)` — Convenience wrapper: `reach("requirement::" + requirementId, 4, [formal_model, invariant, test_file, code_file, code_line])`. Designed for "what's the full verification chain for this requirement?"

`proximity(nodeA, nodeB)` — Compute proximity score using the scoring function from formal-proximity.cjs (require it). Print score and tier (Definitive/Structural/Semantic/Unrelated per DESIGN.md section 5.2).

`stats` — Print summary: total nodes by type, total edges by relationship, orphan count.

**Output format:**
- Default: human-readable table/tree to stdout
- `--json` flag: JSON output for piping
- `--format lines` flag: one result per line for grep

**Error handling:**
- If proximity-index.json doesn't exist, print "Run `node bin/formal-proximity.cjs` first to build the index" and exit 1
- If node key not found, suggest similar keys (substring match on id portion) and exit 1
- Fail-open for non-critical issues

**Create separate `bin/formal-query.test.cjs`** using vitest (query tests are separate from builder tests):
- Test reach with depth=1, depth=2, and filter
- Test path finding between two connected nodes
- Test impact convenience wrapper
- Test coverage convenience wrapper
- Test stats output
- Test "node not found" error handling
- Test that index is loaded via fs.readFileSync (not require) — mock fs.readFileSync and verify it is called
  </action>
  <verify>
Build index first: `node bin/formal-proximity.cjs`
Then test queries:
- `node bin/formal-query.cjs stats` — shows node/edge counts
- `node bin/formal-query.cjs neighbors "code_file::hooks/nf-circuit-breaker.js"` — shows edges
- `node bin/formal-query.cjs impact hooks/nf-circuit-breaker.js` — shows requirements/invariants
- `node bin/formal-query.cjs reach "constant::Depth" --depth 2` — shows reachable nodes
- `node bin/formal-query.cjs coverage SAFE-01` — shows verification chain
- `node bin/formal-query.cjs proximity "code_file::hooks/nf-circuit-breaker.js" "requirement::SAFE-01"` — shows score and tier
- `npx vitest run bin/formal-query.test.cjs` — all query tests pass
- `npx vitest run bin/formal-proximity.test.cjs` — builder tests still pass independently
Verify index loaded via readFileSync: `grep -c 'readFileSync' bin/formal-query.cjs` — should show >= 1 match, and `grep -c 'require.*proximity-index' bin/formal-query.cjs` — should show 0 matches.
  </verify>
  <done>
formal-query.cjs provides reach, path, neighbors, impact, coverage, proximity, and stats commands. All queries return correct results against the generated index. Human-readable and JSON output modes work. Error handling suggests fixes for missing index or unknown node keys. Index loaded via fs.readFileSync+JSON.parse (not require). Query tests live in dedicated formal-query.test.cjs, separate from builder tests.
  </done>
</task>

</tasks>

<verification>
- `node bin/formal-proximity.cjs` builds the index without errors
- `.planning/formal/proximity-index.json` exists and has valid JSON with schema_version "1"
- `node bin/formal-query.cjs stats` shows non-zero node and edge counts
- `node bin/formal-query.cjs impact hooks/nf-stop.js` returns linked requirements
- `npx vitest run bin/formal-proximity.test.cjs` passes all builder tests
- `npx vitest run bin/formal-query.test.cjs` passes all query tests
- Reverse edge invariant: every edge A->B has a matching B->A edge (verified by test)
- risk_transition composite keys use hyphen delimiter: `node -e "const idx = JSON.parse(require('fs').readFileSync('.planning/formal/proximity-index.json','utf8')); Object.keys(idx.nodes).filter(k=>k.startsWith('risk_transition::')).forEach(k=>console.log(k))"` shows `risk_transition::STATE-EVENT-TO_STATE` format
</verification>

<success_criteria>
1. proximity-index.json generated from all 12 source artifact types (scope.json counted as one type across all spec dirs)
2. Bidirectional edges — every forward relationship has its reverse
3. Query CLI provides reach, path, neighbors, impact, coverage, proximity, stats
4. Builder tests in formal-proximity.test.cjs, query tests in formal-query.test.cjs — both pass
5. Scripts follow project conventions: CommonJS, 'use strict', fail-open, stderr for diagnostics
6. JSON files loaded via fs.readFileSync+JSON.parse (not require()) to avoid stale module cache
7. risk_transition nodes keyed as `risk_transition::FROM_STATE-EVENT-TO_STATE` with hyphens between components
</success_criteria>

<output>
After completion, create `.planning/quick/217-build-formal-proximity-index-builder-and/217-SUMMARY.md`
</output>
