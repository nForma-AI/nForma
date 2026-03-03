# Requirements: QGSD v0.25 Formal Traceability & Coverage

**Defined:** 2026-03-03
**Core Value:** Planning decisions are multi-model verified by structural enforcement, not instruction-following -- a Stop hook that reads the transcript makes it impossible for Claude to skip quorum.

## v0.25 Requirements -- Formal Traceability & Coverage

Connect human requirements to formal models with bidirectional, queryable traceability -- so you can answer "which specs verify requirement X?" and "which requirements broke?" when a check fails, with coverage dashboards and decomposition awareness.

### Schema Foundation -- SCHEMA

- [x] **SCHEMA-01**: `model-registry.json` entries gain a `requirements` array (string[]) listing the requirement IDs each model covers; existing entries seeded from the property-to-requirement map in TRACEABILITY_RESEARCH.md
- [x] **SCHEMA-02**: `check-result.schema.json` gains a `requirement_ids` array (string[]) field; validation updated to accept the new field
- [x] **SCHEMA-03**: Each verification runner (run-tlc.cjs, run-alloy.cjs, run-prism.cjs, CI lint steps) emits `requirement_ids` in its NDJSON output, extracted from model-registry or inline annotations
- [x] **SCHEMA-04**: `requirements.json` envelope gains an optional `formal_models` array (string[]) per requirement, listing model file paths that verify it

### Traceability Matrix -- TRACE

- [x] **TRACE-01**: `bin/generate-traceability-matrix.cjs` reads model-registry, requirements.json, and check-results.ndjson to produce `.formal/traceability-matrix.json` with property-level links between requirements and formal properties
- [x] **TRACE-02**: The traceability matrix includes a `coverage_summary` section: total requirements, covered count, coverage percentage, list of uncovered requirements, list of orphan properties (properties with no requirement mapping)
- [x] **TRACE-03**: The traceability matrix is generated as a step in `run-formal-verify.cjs` after all checks complete
- [x] **TRACE-04**: Bidirectional validation detects asymmetric links (model claims requirement X but requirement X does not claim that model) and emits warnings
- [x] **TRACE-05**: CI guard warns when formal coverage percentage drops below a configurable threshold (default 15%) compared to the previous traceability matrix

### Property Annotations -- ANNOT

- [x] **ANNOT-01**: All 11 TLA+ model files contain `@requirement` structured comments on each property/invariant, mapping it to specific requirement IDs
- [x] **ANNOT-02**: All 8 Alloy model files contain `@requirement` structured comments on each assertion/check, mapping it to specific requirement IDs
- [x] **ANNOT-03**: All 3 PRISM .props files contain `@requirement` structured comments on each property, mapping it to specific requirement IDs
- [x] **ANNOT-04**: `bin/extract-annotations.cjs` parses `@requirement` comments from TLA+, Alloy, and PRISM files and returns a structured JSON map of `{ model_file: [{ property, requirement_ids }] }`
- [x] **ANNOT-05**: The traceability matrix generator reads extracted annotations as a primary data source, with model-registry `requirements` arrays as fallback

### Decomposition Awareness -- DECOMP

- [x] **DECOMP-01**: `bin/analyze-state-space.cjs` reads TLA+ .cfg files and model variables to estimate state-space size per model and classifies risk as MINIMAL/LOW/MODERATE/HIGH based on configurable thresholds
- [x] **DECOMP-02**: The state-space analyzer flags models using unbounded domains (Nat, Int without constraints) as HIGH risk
- [x] **DECOMP-03**: When a model is split into sub-models, the traceability matrix validates that no requirement loses coverage (pre-split coverage >= post-split coverage for every affected requirement)
- [x] **DECOMP-04**: The state-space analysis report is included in the traceability matrix output as a `state_space` section per model

## Out of Scope

| Feature | Reason |
|---------|--------|
| Writing new formal models for non-verifiable requirements (ACT, DASH, KEY, META, WIZ) | Most requirements are UI/config/deployment -- not amenable to formal verification |
| Assume-guarantee compositional reasoning | Research identified applicability but it's premature -- no current model needs it |
| Renaming existing TLA+ properties to encode requirement IDs | Disruptive change across all models; annotations solve the same problem non-invasively |
| TypeOK-to-requirement mapping | TypeOK is structural validation, not domain requirements; tracked separately in the matrix |
| Dynamic coverage threshold auto-adjustment | Simple configurable threshold is sufficient for v0.25 |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| SCHEMA-01 | v0.25-01 | Complete |
| SCHEMA-02 | v0.25-01 | Complete |
| SCHEMA-03 | v0.25-01 | Complete |
| SCHEMA-04 | v0.25-01 | Complete |
| TRACE-01 | v0.25-03 | Complete |
| TRACE-02 | v0.25-03 | Complete |
| TRACE-03 | v0.25-03 | Complete |
| TRACE-04 | v0.25-04 | Complete |
| TRACE-05 | v0.25-04 | Complete |
| ANNOT-01 | v0.25-02 | Complete |
| ANNOT-02 | v0.25-02 | Complete |
| ANNOT-03 | v0.25-02 | Complete |
| ANNOT-04 | v0.25-02 | Complete |
| ANNOT-05 | v0.25-03 | Complete |
| DECOMP-01 | v0.25-05 | Complete |
| DECOMP-02 | v0.25-05 | Complete |
| DECOMP-03 | v0.25-05 | Complete |
| DECOMP-04 | v0.25-05 | Complete |

**Coverage:**
- v0.25 requirements: 18 total
- Mapped to phases: 18
- Complete: 18 (all v0.25 requirements)
- Pending: 0
- Unmapped: 0

---
*Requirements defined: 2026-03-03*
*Last updated: 2026-03-03 after v0.25-07 retroactive verification bookkeeping — all 18 requirements complete*
