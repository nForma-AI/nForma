---
phase: quick-224
plan: 01
status: complete
date: 2026-03-08
---

# Quick Task 224: Add formal grounding step to list-phase-assumptions workflow

## What Changed

Enhanced `~/.claude/nf/workflows/list-phase-assumptions.md` to ground assumption analysis in formal artifacts before surfacing assumptions.

### New step: `ground_in_artifacts`

Inserted between `validate_phase` and `analyze_phase`. Reads 6 formal artifacts across 3 tiers:

| Tier | Artifact | What's extracted |
|------|----------|-----------------|
| 1 | `.planning/REQUIREMENTS.md` | Verbatim requirement text for phase requirement IDs |
| 1 | `.planning/formal/spec/` | Spec directories overlapping with phase domain |
| 2 | `.planning/formal/traceability-matrix.json` | Traced vs. gap status per requirement |
| 2 | `.planning/formal/unit-test-coverage.json` | Test coverage for domain modules |
| 3 | `.planning/formal/requirements.json` | Category, status, invariants (JSON-aware parse) |
| 3 | `.planning/formal/model-registry.json` | Alloy/TLA+/PRISM models referencing phase |

All reads use fail-open pattern. Phases with no `Requirements:` line degrade gracefully to inference-only analysis.

### Modified steps

- **`validate_phase`**: "Continue to" target updated from `analyze_phase` to `ground_in_artifacts`
- **`analyze_phase`**: Each assumption now tagged as **grounded** (with artifact citation) or **inferred** (with reasoning)
- **`present_assumptions`**: New `### Formal Grounding` section appears before the 5 assumption areas, showing requirement texts, specs, traceability, coverage, and formal models

### Unchanged steps

- `gather_feedback` — identical
- `offer_next` — identical

## Quorum

- Round 1: 3/3 APPROVE (Claude + claude-1 + claude-2), 4 improvements proposed
- R3.6 iteration 1: improvements incorporated (graceful degradation, validate_phase target, JSON-aware parsing)
- Round 2: 3/3 APPROVE, no further improvements

## Files Modified

- `~/.claude/nf/workflows/list-phase-assumptions.md`
