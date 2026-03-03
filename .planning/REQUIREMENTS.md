# Requirements: QGSD v0.25 Formal Traceability & Coverage

**Defined:** 2026-03-03
**Core Value:** Planning decisions are multi-model verified by structural enforcement, not instruction-following -- a Stop hook that reads the transcript makes it impossible for Claude to skip quorum.

## v0.25 Requirements -- Formal Traceability & Coverage

Connect human requirements to formal models with bidirectional, queryable traceability -- so you can answer "which specs verify requirement X?" and "which requirements broke?" when a check fails, with coverage dashboards and decomposition awareness.

### Schema Foundation -- SCHEMA

- [ ] **SCHEMA-01**: `model-registry.json` entries gain a `requirements` array (string[]) listing the requirement IDs each model covers; existing entries seeded from the property-to-requirement map in TRACEABILITY_RESEARCH.md
- [ ] **SCHEMA-02**: `check-result.schema.json` gains a `requirement_ids` array (string[]) field; validation updated to accept the new field
- [ ] **SCHEMA-03**: Each verification runner (run-tlc.cjs, run-alloy.cjs, run-prism.cjs, CI lint steps) emits `requirement_ids` in its NDJSON output, extracted from model-registry or inline annotations
- [ ] **SCHEMA-04**: `requirements.json` envelope gains an optional `formal_models` array (string[]) per requirement, listing model file paths that verify it

### Traceability Matrix -- TRACE

- [ ] **TRACE-01**: `bin/generate-traceability-matrix.cjs` reads model-registry, requirements.json, and check-results.ndjson to produce `formal/traceability-matrix.json` with property-level links between requirements and formal properties
- [ ] **TRACE-02**: The traceability matrix includes a `coverage_summary` section: total requirements, covered count, coverage percentage, list of uncovered requirements, list of orphan properties (properties with no requirement mapping)
- [ ] **TRACE-03**: The traceability matrix is generated as a step in `run-formal-verify.cjs` after all checks complete
- [ ] **TRACE-04**: Bidirectional validation detects asymmetric links (model claims requirement X but requirement X does not claim that model) and emits warnings
- [ ] **TRACE-05**: CI guard warns when formal coverage percentage drops below a configurable threshold (default 15%) compared to the previous traceability matrix

### Property Annotations -- ANNOT

- [ ] **ANNOT-01**: All 11 TLA+ model files contain `@requirement` structured comments on each property/invariant, mapping it to specific requirement IDs
- [ ] **ANNOT-02**: All 8 Alloy model files contain `@requirement` structured comments on each assertion/check, mapping it to specific requirement IDs
- [ ] **ANNOT-03**: All 3 PRISM .props files contain `@requirement` structured comments on each property, mapping it to specific requirement IDs
- [ ] **ANNOT-04**: `bin/extract-annotations.cjs` parses `@requirement` comments from TLA+, Alloy, and PRISM files and returns a structured JSON map of `{ model_file: [{ property, requirement_ids }] }`
- [ ] **ANNOT-05**: The traceability matrix generator reads extracted annotations as a primary data source, with model-registry `requirements` arrays as fallback

### Decomposition Awareness -- DECOMP

- [ ] **DECOMP-01**: `bin/analyze-state-space.cjs` reads TLA+ .cfg files and model variables to estimate state-space size per model and classifies risk as MINIMAL/LOW/MODERATE/HIGH based on configurable thresholds
- [ ] **DECOMP-02**: The state-space analyzer flags models using unbounded domains (Nat, Int without constraints) as HIGH risk
- [ ] **DECOMP-03**: When a model is split into sub-models, the traceability matrix validates that no requirement loses coverage (pre-split coverage >= post-split coverage for every affected requirement)
- [ ] **DECOMP-04**: The state-space analysis report is included in the traceability matrix output as a `state_space` section per model

## Out of Scope

| Feature | Reason |
|---------|--------|
| Writing new formal models for non-verifiable requirements (ACT, DASH, KEY, META, WIZ) | Most requirements are UI/config/deployment — not amenable to formal verification |
| Assume-guarantee compositional reasoning | Research identified applicability but it's premature — no current model needs it |
| Renaming existing TLA+ properties to encode requirement IDs | Disruptive change across all models; annotations solve the same problem non-invasively |
| TypeOK-to-requirement mapping | TypeOK is structural validation, not domain requirements; tracked separately in the matrix |
| Dynamic coverage threshold auto-adjustment | Simple configurable threshold is sufficient for v0.25 |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| SCHEMA-01 | | Pending |
| SCHEMA-02 | | Pending |
| SCHEMA-03 | | Pending |
| SCHEMA-04 | | Pending |
| TRACE-01 | | Pending |
| TRACE-02 | | Pending |
| TRACE-03 | | Pending |
| TRACE-04 | | Pending |
| TRACE-05 | | Pending |
| ANNOT-01 | | Pending |
| ANNOT-02 | | Pending |
| ANNOT-03 | | Pending |
| ANNOT-04 | | Pending |
| ANNOT-05 | | Pending |
| DECOMP-01 | | Pending |
| DECOMP-02 | | Pending |
| DECOMP-03 | | Pending |
| DECOMP-04 | | Pending |

**Coverage:**
- v0.25 requirements: 18 total
- Mapped to phases: 0
- Unmapped: 18

---
*Requirements defined: 2026-03-03*
*Last updated: 2026-03-03 after initial definition*
