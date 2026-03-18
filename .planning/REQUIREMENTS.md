# Requirements: nForma v0.38 — Model-Driven Debugging

**Defined:** 2026-03-18
**Core Value:** Planning decisions are multi-model verified by structural enforcement

## Milestone v0.38 Requirements

### Bug-to-Model Lookup

- [ ] **BML-01**: formal-scope-scan.cjs `--bug-mode` flag finds formal models covering affected code files and returns model paths, formalism type, and requirement coverage
- [ ] **BML-02**: Bug-mode runs matched model checkers (TLC/Alloy, max 3, 60s timeout each) and reports reproduction status (pass/fail/timeout) with counterexample trace when available
- [ ] **BML-03**: bug-model-gaps.json tracks bugs with their model coverage status (no_coverage, no_reproduction, reproduced) and persists across sessions

### Constraint Extraction

- [ ] **CEX-01**: model-constrained-fix.cjs parses TLA+ specs to extract violated invariant definitions, state variables, and transition predicates
- [ ] **CEX-02**: model-constrained-fix.cjs parses Alloy specs to extract failing assertion definitions and signature constraints
- [ ] **CEX-03**: Extracted constraints are rendered as plain-English fix constraint summaries suitable for injection into quorum worker prompts

### Debug Integration

- [ ] **DBG-01**: /nf:debug Step A.5 runs formal model consultation before quorum dispatch, appending $FORMAL_CONTEXT to the worker bundle
- [ ] **DBG-02**: Quorum worker prompts include a rule to respect fix constraints and not violate listed invariants
- [ ] **DBG-03**: NEXT STEP result table includes a FORMAL row showing model verdict (reproduced/not-reproduced/no-model)
- [ ] **DBG-04**: When no model covers the failure, debug Step G appends an entry to bug-model-gaps.json for future model creation

### Model Refinement

- [ ] **MRF-01**: close-formal-gaps.md accepts `--bug-context` flag that injects failure description into spec generation, biasing toward capturing the failure mode
- [ ] **MRF-02**: Model refinement loop creates/refines a model, verifies it FAILS (reproduces the bug), and iterates up to 2 additional times if model passes despite bug
- [ ] **MRF-03**: model-driven-fix.md workflow orchestrates the 6-phase prescriptive cycle (discovery, reproduction, refinement, constraint extraction, constrained fix, pre-verification)

### B-to-F Solve Layer

- [ ] **BTF-01**: layer-constants.cjs includes `b_to_f` as the 20th layer key
- [ ] **BTF-02**: solve-wave-dag.cjs includes `b_to_f` in LAYER_DEPS with dependency on `t_to_c`
- [ ] **BTF-03**: nf-solve.cjs diagnostic sweep computes b_to_f residual by classifying failing tests as covered_reproduced (0), covered_not_reproduced (+1), or not_covered (+1)
- [ ] **BTF-04**: solve-remediate.md section 3a-extra dispatches close-formal-gaps for not_covered gaps (max 3/cycle) and model refinement for blind spots (max 2/cycle)

### Cross-Model Regression Prevention

- [ ] **REG-01**: model-driven-fix.md Phase 5 runs model checkers on proximity-neighbor models (2-hop in proximity-index.json) before declaring fix done
- [ ] **REG-02**: run-formal-verify.cjs accepts `--scope=model1,model2` flag to run only specified models
- [ ] **REG-03**: bug-model-gaps.json entries include post_fix_verification results (model_pass, neighbor_models_pass, regressions array)

## Out of Scope

| Feature | Reason |
|---------|--------|
| Specification mining from traces | High complexity, defer to v0.39+ — needs trace-pattern library selection |
| Automatic patch generation | Anti-feature per research — over-constrains fix space, reduces developer agency |
| Real-time model checking on keystroke | Infeasible — TLC/Alloy startup overhead makes this an anti-feature |
| APALACHE symbolic solver integration | Valuable but separate initiative — TLC enumeration sufficient for v0.38 |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| BML-01 | TBD | Pending |
| BML-02 | TBD | Pending |
| BML-03 | TBD | Pending |
| CEX-01 | TBD | Pending |
| CEX-02 | TBD | Pending |
| CEX-03 | TBD | Pending |
| DBG-01 | TBD | Pending |
| DBG-02 | TBD | Pending |
| DBG-03 | TBD | Pending |
| DBG-04 | TBD | Pending |
| MRF-01 | TBD | Pending |
| MRF-02 | TBD | Pending |
| MRF-03 | TBD | Pending |
| BTF-01 | TBD | Pending |
| BTF-02 | TBD | Pending |
| BTF-03 | TBD | Pending |
| BTF-04 | TBD | Pending |
| REG-01 | TBD | Pending |
| REG-02 | TBD | Pending |
| REG-03 | TBD | Pending |

**Coverage:**
- v0.38 requirements: 20 total
- Mapped to phases: 0
- Unmapped: 20

---
*Requirements defined: 2026-03-18*
