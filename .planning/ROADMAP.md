# Roadmap: nForma v0.38 — Model-Driven Debugging

## Overview

Transform formal models from descriptive CI gates into prescriptive debugging tools. The milestone delivers a complete bug-to-fix guidance loop: when a bug occurs, nForma finds the matching formal model, reproduces the failure, extracts fix constraints in plain English, injects those constraints into quorum workers, and verifies the fix against neighboring models before shipping. Five phases build this capability bottom-up: lookup and extraction infrastructure, debug command integration, model refinement workflow, solve layer automation, and cross-model regression prevention.

## Phases

**Phase Numbering:**
- Milestone-scoped phases (v0.38-01 through v0.38-05)
- Decimal phases (v0.38-01.1): Urgent gap insertions if needed

- [x] **Phase v0.38-01: Bug-to-Model Lookup & Constraint Extraction** - Infrastructure to find matching models and extract fix constraints from TLA+/Alloy specs (completed 2026-03-18)
- [x] **Phase v0.38-02: Debug Command Integration** - Wire model consultation into /nf:debug before quorum dispatch (completed 2026-03-18)
- [x] **Phase v0.38-03: Model Refinement Workflow** - Create and refine models that capture failure modes when no model explains a bug (completed 2026-03-18)
- [x] **Phase v0.38-04: B-to-F Solve Layer** - 20th solve layer tracking bugs formal models should explain but don't (completed 2026-03-18)
- [x] **Phase v0.38-05: Cross-Model Regression Prevention** - Pre-verify fixes against proximity-neighbor models before declaring done (completed 2026-03-18)

## Phase Details

### Phase v0.38-01: Bug-to-Model Lookup & Constraint Extraction
**Goal**: Developers can identify which formal models cover a bug and receive plain-English fix constraints extracted from those models
**Depends on**: Nothing (first phase)
**Requirements**: BML-01, BML-02, BML-03, CEX-01, CEX-02, CEX-03
**Success Criteria** (what must be TRUE):
  1. Running `formal-scope-scan.cjs --bug-mode --description "..."` returns ranked model paths with formalism type and requirement coverage for matching models
  2. Matched model checkers (TLC/Alloy) run automatically with 60s timeout and report pass/fail/timeout with counterexample traces when available
  3. bug-model-gaps.json persists bug-to-model coverage status (no_coverage, no_reproduction, reproduced) across sessions
  4. TLA+ invariant definitions, state variables, and transition predicates are parsed and rendered as plain-English fix constraint summaries
  5. Alloy assertion definitions and signature constraints are parsed and rendered as plain-English fix constraint summaries
**Plans**: 3 plans

Plans:
- [ ] v0.38-01-01-PLAN.md — Bug-mode lookup flag and gap persistence infrastructure
- [ ] v0.38-01-02-PLAN.md — TLA+/Alloy constraint extraction and English rendering
- [ ] v0.38-01-03-PLAN.md — Model checker execution with timeout and reproduction status

### Phase v0.38-02: Debug Command Integration
**Goal**: /nf:debug consults formal models before quorum dispatch, giving workers model-backed fix constraints and surfacing model verdicts in results
**Depends on**: Phase v0.38-01
**Requirements**: DBG-01, DBG-02, DBG-03, DBG-04
**Success Criteria** (what must be TRUE):
  1. /nf:debug Step A.5 runs formal model consultation and appends $FORMAL_CONTEXT to the worker bundle before quorum dispatch
  2. Quorum worker prompts include explicit rules to respect fix constraints and not violate listed invariants
  3. The NEXT STEP result table includes a FORMAL row showing model verdict (reproduced / not-reproduced / no-model)
  4. When no model covers the failure, debug Step G appends an entry to bug-model-gaps.json for future model creation
**Plans**: 2 plans

Plans:
- [ ] v0.38-02-01-PLAN.md — Formal context assembly helper, Step A.5 integration, and constraint injection into worker prompts
- [ ] v0.38-02-02-PLAN.md — FORMAL verdict row in result table and gap persistence in Step G

### Phase v0.38-03: Model Refinement Workflow
**Goal**: When a bug has no matching model or the model fails to reproduce, nForma can create or refine a model that captures the failure mode through a prescriptive 6-phase cycle
**Depends on**: Phase v0.38-02
**Requirements**: MRF-01, MRF-02, MRF-03
**Success Criteria** (what must be TRUE):
  1. close-formal-gaps.md accepts `--bug-context` and biases spec generation toward capturing the described failure mode
  2. The model refinement loop verifies the new/refined model actually FAILS (reproduces the bug) and iterates up to 2 additional times if the model incorrectly passes
  3. model-driven-fix.md orchestrates the full 6-phase prescriptive cycle (discovery, reproduction, refinement, constraint extraction, constrained fix, pre-verification) end-to-end
**Plans**: TBD

Plans:
- [ ] v0.38-03-01: TBD

### Phase v0.38-04: B-to-F Solve Layer
**Goal**: The solve pipeline autonomously identifies bugs that formal models should explain but don't, and routes them to model creation or refinement
**Depends on**: Phase v0.38-01
**Requirements**: BTF-01, BTF-02, BTF-03, BTF-04
**Success Criteria** (what must be TRUE):
  1. `b_to_f` exists as the 20th layer key in layer-constants.cjs
  2. solve-wave-dag.cjs includes `b_to_f` with dependency on `t_to_c` and it executes in the correct wave position
  3. nf-solve.cjs diagnostic sweep computes b_to_f residual by classifying failing tests as covered_reproduced (0), covered_not_reproduced (+1), or not_covered (+1)
  4. solve-remediate.md dispatches close-formal-gaps for not_covered gaps (max 3/cycle) and model refinement for blind spots (max 2/cycle)
**Plans**: TBD

Plans:
- [ ] v0.38-04-01: TBD

### Phase v0.38-05: Cross-Model Regression Prevention
**Goal**: Fixes verified against one model are also checked against proximity-neighbor models to prevent cross-model regressions
**Depends on**: Phase v0.38-03, Phase v0.38-04
**Requirements**: REG-01, REG-02, REG-03
**Success Criteria** (what must be TRUE):
  1. model-driven-fix.md Phase 5 runs model checkers on 2-hop proximity-neighbor models from proximity-index.json before declaring a fix done
  2. run-formal-verify.cjs accepts `--scope=model1,model2` to run only specified models instead of the full suite
  3. bug-model-gaps.json entries include post_fix_verification results with model_pass, neighbor_models_pass, and regressions array
**Plans**: TBD

Plans:
- [ ] v0.38-05-01: TBD

## Progress

**Execution Order:**
Phases execute in milestone-then-sequence order: v0.38-01 -> v0.38-02 -> v0.38-03 -> v0.38-04 -> v0.38-05
Note: v0.38-03 and v0.38-04 could potentially execute in parallel (both depend on v0.38-01, only v0.38-04 depends on v0.38-01 directly). v0.38-05 depends on both v0.38-03 and v0.38-04.

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| v0.38-01. Bug-to-Model Lookup & Constraint Extraction | 2/3 | Complete    | 2026-03-18 |
| v0.38-02. Debug Command Integration | 0/2 | Complete    | 2026-03-18 |
| v0.38-03. Model Refinement Workflow | 2/2 | Complete    | 2026-03-18 |
| v0.38-04. B-to-F Solve Layer | 2/2 | Complete    | 2026-03-18 |
| v0.38-05. Cross-Model Regression Prevention | 0/TBD | Complete    | 2026-03-18 |
