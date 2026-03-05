# Roadmap: QGSD v0.22 Requirements Envelope

## Overview

v0.22 promotes milestone requirements from a working document (`.planning/REQUIREMENTS.md`) into a validated, immutable formal artifact (`.formal/requirements.json`) that constrains what formal specs must prove. The journey starts with aggregation and Haiku validation (Phase 1), wires the frozen envelope into formal spec generation (Phase 2), locks it down with an amendment escape hatch (Phase 3), and adds semantic drift detection (Phase 4).

## Phases

**Phase Numbering:**
- Milestone-scoped phases (v0.22-01, v0.22-02): Phases scoped to v0.22
- Decimal phases (v0.22-01.1): Urgent gap insertions within milestone

- [x] **Phase v0.22-01: Requirements Envelope Foundation** - Aggregate requirements into `.formal/requirements.json` and validate with Haiku for duplicates, conflicts, and ambiguity (COMPLETE: 3/3 plans)
- [ ] **Phase v0.22-02: Formal Spec Integration** - Frozen envelope becomes the source of truth for TLA+ PROPERTY generation in `generate-phase-spec.cjs`
- [ ] **Phase v0.22-03: Immutability and Amendment Workflow** - Lock the frozen envelope against automated modification; provide a structured amendment workflow requiring user consent
- [ ] **Phase v0.22-04: Drift Detection** - Detect and warn when `.planning/REQUIREMENTS.md` diverges from the frozen envelope after freeze

## Phase Details

### Phase v0.22-01: Requirements Envelope Foundation
**Goal**: Requirements from `.planning/REQUIREMENTS.md` are compiled into a structured JSON artifact and semantically validated before freezing
**Depends on**: Nothing (first phase)
**Requirements**: ENV-01, ENV-02
**Success Criteria** (what must be TRUE):
  1. Running `bin/aggregate-requirements.cjs` on a populated `.planning/REQUIREMENTS.md` produces `.formal/requirements.json` with every requirement containing REQ-ID, text, category, phase assignment, and provenance fields -- validated against a JSON Schema
  2. Running `bin/validate-requirements-haiku.cjs` on the aggregated envelope presents the user with any semantic duplicates, contradictions, or ambiguous requirements found by Haiku -- the user resolves or accepts each finding before the envelope is frozen
  3. After the user approves validation results, `.formal/requirements.json` gains a `frozen_at` timestamp and the envelope is considered immutable from that point
  4. Re-running aggregation on the same REQUIREMENTS.md produces an identical envelope (deterministic output) -- schema version is explicitly tracked in the document root
**Plans**: TBD

### Phase v0.22-02: Formal Spec Integration
**Goal**: Formal spec generation reads the frozen envelope as its source of truth -- TLA+ PROPERTY statements are derived from frozen requirements, and specs that contradict the envelope are flagged
**Depends on**: Phase v0.22-01
**Requirements**: ENV-03
**Success Criteria** (what must be TRUE):
  1. `bin/generate-phase-spec.cjs` reads `.formal/requirements.json` (checking `frozen_at` is set), filters requirements by the current phase, and produces TLA+ PROPERTY templates from each requirement
  2. If a generated formal spec contradicts a frozen requirement (e.g., a PROPERTY that negates an envelope constraint), the contradiction is flagged as a violation in the verification output -- not silently accepted
  3. `bin/run-formal-verify.cjs` includes an envelope validation step that analyzes ENV-derived property results separately in its summary output
**Plans**: TBD

### Phase v0.22-03: Immutability and Amendment Workflow
**Goal**: The frozen envelope cannot be modified by automated workflows -- legitimate changes require explicit user approval through a structured amendment process that re-validates
**Depends on**: Phase v0.22-01
**Requirements**: ENV-04
**Success Criteria** (what must be TRUE):
  1. Direct modifications to `.formal/requirements.json` by any automated workflow (hook, script, agent) are blocked -- a guard (hook or pre-commit) detects the modification and prevents it
  2. Running `bin/amend-requirements.cjs` presents a structured amendment workflow: the user proposes changes, Haiku re-validates the updated set, and the user explicitly approves before the envelope is re-frozen
  3. Amendment history is preserved -- each amendment records what changed, when, and the user approval that authorized it
**Plans**: TBD

### Phase v0.22-04: Drift Detection
**Goal**: When `.planning/REQUIREMENTS.md` is modified after the envelope is frozen, the system warns about divergence and routes legitimate changes through the amendment workflow
**Depends on**: Phase v0.22-03
**Requirements**: ENV-05
**Success Criteria** (what must be TRUE):
  1. Running `bin/detect-requirements-drift.cjs` compares `.planning/REQUIREMENTS.md` against `.formal/requirements.json` and reports any semantic differences (not formatting noise) -- drift categories distinguish NOISE from SEMANTIC DRIFT
  2. When drift is detected during a planning command, a non-blocking warning is injected into Claude's context (via `hooks/qgsd-prompt.js`) identifying the specific requirements that have diverged
  3. The drift warning directs the user to the amendment workflow (ENV-04) for legitimate changes -- there is no path to silently accept drift
**Plans**: TBD

## Progress

**Execution Order:**
Phases execute in milestone-then-sequence order: v0.22-01 -> v0.22-02 -> v0.22-03 -> v0.22-04

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| v0.22-01. Requirements Envelope Foundation | 3/3 | COMPLETE | 2026-03-01 (All plans: aggregation, validation, freezing) |
| v0.22-02. Formal Spec Integration | 0/TBD | Not started | - |
| v0.22-03. Immutability and Amendment Workflow | 0/TBD | Not started | - |
| v0.22-04. Drift Detection | 0/TBD | Not started | - |
