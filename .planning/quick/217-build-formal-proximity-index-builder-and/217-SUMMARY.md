---
phase: quick-217
plan: 01
subsystem: formal-verification
tags: [graph, proximity, traversal, cli, formal]
dependency_graph:
  requires: [constants-mapping.json, model-registry.json, invariant-catalog.json, traceability-matrix.json, unit-test-coverage.json, instrumentation-map.json, event-vocabulary.json, observed-fsm.json, risk-heatmap.json, git-heatmap.json, debt.json, "spec/*/scope.json"]
  provides: [proximity-index.json, formal-proximity.cjs, formal-query.cjs]
  affects: [nf-solve, formal-scope-scan, nf-quick-planner]
tech_stack:
  added: []
  patterns: [bidirectional-adjacency-graph, bfs-traversal, proximity-scoring]
key_files:
  created:
    - bin/formal-proximity.cjs
    - bin/formal-proximity.test.cjs
    - bin/formal-query.cjs
    - bin/formal-query.test.cjs
    - .planning/formal/proximity-index.json
  modified: []
decisions:
  - "Invariant node keys use name@config composite to handle duplicate names (e.g., TypeOK appears in many models)"
  - "risk_transition composite keys use hyphen delimiter: FROM_STATE-EVENT-TO_STATE"
  - "Used node:test framework (not vitest require) to match project test patterns for .test.cjs files"
metrics:
  duration: 7min
  completed: 2026-03-07
---

# Quick Task 217: Build Formal Proximity Index Builder and Query CLI Summary

Bidirectional adjacency graph builder consuming 12 formal artifact types with BFS traversal query CLI.

## What Was Built

### formal-proximity.cjs (Index Builder)
- Reads all 12 source artifact types from `.planning/formal/`
- 14-step build pipeline: 12 artifact ingestion steps + reverse pass + validation
- Generates `proximity-index.json` with schema_version "1", sources metadata, and bidirectional node graph
- 1647 nodes, 3478 edges across 15 node types
- Proximity scoring function with edge weights and 0.7 decay per hop
- CLI: `--dry-run`, `--json`, fail-open for missing optional artifacts
- Exports: `buildIndex`, `proximity`, `EDGE_WEIGHTS`, `REVERSE_RELS`

### formal-query.cjs (Query CLI)
- 7 commands: `reach`, `path`, `neighbors`, `impact`, `coverage`, `proximity`, `stats`
- `reach` — BFS with configurable depth and type filter
- `path` — shortest path between two nodes
- `neighbors` — direct edges (depth=1)
- `impact` — reach from code_file filtered to invariant/requirement/formal_model/test_file
- `coverage` — reach from requirement filtered to formal_model/invariant/test_file/code_file/code_line
- `proximity` — scoring with tier classification (Definitive/Structural/Semantic/Unrelated)
- `stats` — full index summary with node/edge counts by type
- Output modes: table (default), `--json`, `--format lines`
- Node key resolution with auto-prefix and similar-key suggestions on error
- Index loaded via `fs.readFileSync` + `JSON.parse` (not `require()`)

### Tests
- `formal-proximity.test.cjs` — 15 tests: build correctness, reverse edge invariant, orphan detection, proximity scoring, edge weights, fail-open, REVERSE_RELS symmetry, risk_transition key format
- `formal-query.test.cjs` — 16 tests: reach/path/resolve/suggest unit tests, impact/coverage/stats CLI tests, error handling, readFileSync verification

## Commits

| Task | Commit | Description |
|------|--------|-------------|
| 1 | 2a3b68f7 | Build formal proximity index builder and tests |
| 2 | 6081bcfe | Build formal query CLI with reach, path, neighbors, impact, coverage, proximity, stats |

## Deviations from Plan

None -- plan executed exactly as written.

## Key Observations

- The graph reveals 8 orphan nodes (formal models and actions not referenced by any other artifact)
- formal_module nodes are not directly connected to formal_model nodes in the current artifacts -- the connection path goes through requirements (via model-registry) rather than through spec modules. This means `impact` queries from code_file start points may return empty results until scope.json files include model path references.
- 757 invariant nodes (many are TypeOK duplicates disambiguated by @config suffix)

## Self-Check: PASSED
