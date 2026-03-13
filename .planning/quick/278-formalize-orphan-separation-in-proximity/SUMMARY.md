---
phase: quick-278
plan: 01
subsystem: proximity-pipeline
tags: [proximity, orphans, candidate-discovery, pipeline]
dependency-graph:
  requires: [proximity-index.json, model-registry.json, requirements.json]
  provides: [orphan-separation-in-candidates-json]
  affects: [haiku-semantic-eval, candidate-pairings, proximity-skill]
tech-stack:
  patterns: [structural-exclusion-by-object-shape]
key-files:
  modified:
    - bin/candidate-discovery.cjs
    - commands/nf/proximity.md
decisions:
  - "Orphan models filtered by 0 linked requirements; orphan requirements by empty formal_models"
  - "Orphans stored as {path, zeroPairCount} and {id, zeroPairCount} for prioritization"
  - "non_neighbor_top parameter retained as the limit for both orphan lists"
metrics:
  duration: "~4 minutes"
  completed: "2026-03-12"
  tasks_completed: 2
  tasks_total: 2
---

# Quick 278: Formalize Orphan Separation in Proximity

Structural separation of non-neighbor pairs into dedicated orphans object, eliminating wasted Haiku eval on zero-path pairs that consistently return "no" verdicts.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Separate orphans from candidates in candidate-discovery.cjs | 757d4093 | bin/candidate-discovery.cjs |
| 2 | Add orphan display to proximity pipeline summary | 757d4093 | commands/nf/proximity.md |

## Changes Made

### Task 1: Orphan separation in candidate-discovery.cjs

- Replaced the non-neighbor push loop that added entries to `candidates[]` with orphan extraction logic
- Orphan models: unique models from zeroPairs with 0 linked requirements, ranked by zeroPairCount
- Orphan requirements: unique requirements with no formal_models coverage, ranked by zeroPairCount
- Return shape now: `{ metadata, candidates, orphans: { models[], requirements[] } }`
- Metadata: replaced `non_neighbor_count` with `orphan_models_count` and `orphan_requirements_count`
- Score histogram: removed `non_neighbor` bucket (candidates are now graph-only)
- Logging: "Found X orphan models, Y orphan requirements" replaces "Added N non-neighbor candidates"

### Task 2: Proximity skill dashboard update

- Step 3: Changed display to "Found N graph candidates. Orphans: X models, Y requirements"
- Step 4b: Added note that orphans are excluded from evaluation
- Step 7 dashboard: Added Orphans row between Candidates and Evaluation
- Candidates line simplified to "C candidates (graph-sourced)"
- Notes: Updated non-neighbor-top flag description to reference orphans

## Verification Results

- candidates.json: 1 graph candidate, 0 non_neighbor entries (was 10 non-neighbor previously)
- orphans.models: 4 orphan models discovered
- orphans.requirements: 20 orphan requirements discovered
- candidate-pairings.cjs: runs correctly (exits with "no evaluated candidates" which is expected without eval step)
- No residual `non_neighbor` source values in candidates array

## Deviations from Plan

None - plan executed exactly as written.

## Self-Check: PASSED

- [x] bin/candidate-discovery.cjs modified with orphan separation
- [x] commands/nf/proximity.md updated with orphan display
- [x] Commit 757d4093 exists
- [x] candidates.json contains zero non_neighbor entries in candidates[]
- [x] candidates.json has top-level orphans object
