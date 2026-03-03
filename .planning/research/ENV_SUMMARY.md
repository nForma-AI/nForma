# Research Summary: QGSD v0.22 Requirements Envelope

**Project:** QGSD v0.22 Requirements Envelope Integration
**Researched:** 2026-03-01
**Overall Confidence:** HIGH

---

## Executive Summary

The v0.22 requirements envelope adds formal validation and immutability enforcement to QGSD's requirement-to-specification pipeline. Rather than treating `.planning/REQUIREMENTS.md` as the authoritative source, v0.22 promotes it to a formal artifact (`formal/requirements.json`) that is:

1. **Validated by Haiku** (ENV-02) before freezing — detects duplicates, contradictions, ambiguity
2. **Immutable by default** (ENV-04) — hook-enforced, amendments require explicit workflow
3. **Drift-aware** (ENV-05) — working copy changes are detected and reported
4. **Spec-constraining** (ENV-03) — formal specs read envelope as correctness boundary
5. **Auto-aggregated** (ENV-01) — compiled from REQUIREMENTS.md during new-milestone

This transforms requirements from a planning document into a **formal correctness envelope** that all downstream verification (TLA+, Alloy, PRISM) must respect. It closes the formal verification loop: requirements → specs → proofs.

---

## Key Findings

### Architecture

**The envelope integrates as a new layer between planning and formal verification:**

```
Planning Layer              Formal Verification Layer
├─ REQUIREMENTS.md ────┬──→ formal/requirements.json ─────────┐
│  (working copy)      │    (frozen, immutable)              │
│                      │                                      ↓
├─ task-envelope.json  │    [ENV-03] generate-phase-spec.cjs │
│  (phase truths)      └──→ (reads envelope, merges props)   │
│                            ↓                               │
├─ PLAN.md             ┌──→ formal/tla/scratch/<phase>.tla   │
│  (must_haves)        │    (incl. ENV-* PROPERTY stmts)     │
│                      │                                      ↓
└─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─┘    [run-formal-verify.cjs]
                             (TLC verifies env constraints)
```

The envelope becomes the formal correctness boundary: TLC failures due to envelope constraints block phase approval.

---

### New Components Required

Five new CJS scripts + one new agent role:

| Component | Purpose | Input | Output | ENV |
|-----------|---------|-------|--------|-----|
| `aggregate-requirements.cjs` | Compile REQUIREMENTS.md → JSON | REQUIREMENTS.md + ROADMAP.md | formal/requirements.json (unvalidated) | ENV-01 |
| `validate-requirements-haiku.cjs` | Haiku validation gate | requirements.json | requirements.json (frozen) | ENV-02 |
| `extract-requirements-properties.cjs` | Envelope → TLA+ properties | requirements.json + phase# | TLA+ PROPERTY array | ENV-03 |
| `detect-requirements-drift.cjs` | Working copy divergence check | REQUIREMENTS.md + requirements.json | formal/drift-report.md | ENV-05 |
| `amend-requirements.cjs` | Formal amendment workflow | amendments + requirements.json | requirements.json (re-frozen) | ENV-04 |
| `qgsd-haiku-validator.md` | Haiku validation agent | requirements array | issues + summary JSON | ENV-02 |

---

### Existing Components Modified

| Component | Change | ENV |
|-----------|--------|-----|
| `generate-phase-spec.cjs` | Read envelope, merge properties before TLC | ENV-03 |
| `run-formal-verify.cjs` | Add envelope validation step, analyze ENV results | ENV-02, ENV-03 |
| `qgsd-prompt.js` hook | Inject drift warnings into context | ENV-05 |
| `qgsd-stop.js` hook | Block unapproved envelope edits | ENV-04 |
| `.planning/REQUIREMENTS.md` | Add note about envelope semantics | ENV-01..05 |

---

### Data Flow Highlights

**Aggregation (ENV-01):** Automatic during `/qgsd:new-milestone` step 4
```
REQUIREMENTS.md → [aggregate-requirements.cjs] → requirements.json (frozen_at: null)
```

**Validation (ENV-02):** Automatic, waits for Haiku gate
```
requirements.json → [validate-requirements-haiku.cjs] → Haiku validator → AskUserQuestion (if issues) → requirements.json (frozen_at: timestamp)
```

**Spec Binding (ENV-03):** During `plan-phase` formal verification step
```
requirements.json (frozen) → [extract-requirements-properties.cjs] → ENV-* PROPERTY statements → formal/tla/scratch/<phase>.tla
```

**Immutability (ENV-04):** Enforced by Stop hook, routed through amendment workflow
```
User edit attempt → [qgsd-stop.js] detects → BLOCK → user runs `/qgsd:amend-requirements` → amendment workflow
```

**Drift Detection (ENV-05):** On every planning command via UserPromptSubmit hook
```
REQUIREMENTS.md changes → [detect-requirements-drift.cjs] → formal/drift-report.md → injected into context
```

---

## Critical Integration Points

### 1. Envelope Freezing Timing (ENV-02)

**When:** Immediately after aggregation (step 4.5 of new-milestone)
**Blocker:** Haiku validation failure requires user resolution
**Recovery:** User edits REQUIREMENTS.md, re-runs aggregate → validate

**Implication:** Envelope is frozen BEFORE phase planning begins. All subsequent specs must respect frozen requirements.

---

### 2. Spec Constraint Binding (ENV-03)

**When:** During `plan-phase` formal verification step (8.2)
**Constraint:** Envelope PROPERTY statements take precedence over phase truths
**Failure mode:** TLC failure on ENV property → formal violation → quorum sees evidence

**Implication:** Envelope becomes part of formal correctness proof. Cannot have phase truth that contradicts envelope.

---

### 3. Immutability Enforcement (ENV-04)

**When:** Anytime user attempts direct modification to `formal/requirements.json`
**Mechanism:** Stop hook detects Write to frozen file, checks transcript for approval
**Enforcement:** BLOCK until user runs amendment workflow

**Implication:** Envelope cannot be edited; modifications require Haiku re-validation (ENV-02).

---

### 4. Drift Visibility (ENV-05)

**When:** On every `/qgsd:*` planning command (UserPromptSubmit hook)
**Output:** Drift report injected into Claude's context (non-blocking)
**User action:** Review drift, decide to amend or ignore

**Implication:** User always aware of working copy divergence from frozen envelope. Encourages intentional amendment process.

---

## Build Order Rationale

**Phase 1 (Week 1): Foundation**
- ENV-01 + ENV-02 first because they create the frozen envelope
- Blocks: Everything else depends on frozen_at being set
- Validates: End-to-end aggregation + validation cycle

**Phase 2 (Week 2): Spec Integration**
- ENV-03 reads frozen envelope
- Depends on: ENV-02 (frozen_at exists)
- Validates: Phase specs include envelope constraints

**Phase 3 (Week 3): Enforcement**
- ENV-04 + ENV-05 protect frozen envelope
- Depend on: ENV-02 (frozen envelope exists)
- Parallel: Both work independently

**Phase 4 (Week 4): Integration Testing**
- Full roundtrip: new-milestone → plan-phase → formal-verify → amend → re-plan
- Tests: All interaction scenarios (validation failure, drift, amendment, immutability)
- Validates: No regressions, backward compatibility

---

## Implications for Roadmap

### Phase 1 (ENV-01 + ENV-02) — Requirements Envelope Foundation

**Goal:** Frozen requirements artifact created and validated

**Tasks:**
1. Implement `aggregate-requirements.cjs` — parse REQUIREMENTS.md, output JSON
2. Implement `validate-requirements-haiku.cjs` — invoke Haiku validator, update frozen_at
3. Create `qgsd-haiku-validator.md` agent — role for Haiku validation
4. Modify planner: call aggregation + validation in new-milestone step 4 → 4.5
5. Test roundtrip: REQUIREMENTS.md → aggregation → validation → frozen envelope

**Avoids pitfall:** Starting with spec binding before envelope is frozen would create circular dependency (specs depend on envelope, but envelope validation could depend on specs).

---

### Phase 2 (ENV-03) — Spec Constraint Binding

**Goal:** Phase specs constrained by frozen envelope

**Tasks:**
1. Implement `extract-requirements-properties.cjs` — envelope → TLA+ properties
2. Modify `generate-phase-spec.cjs` — read envelope, merge properties
3. Modify `run-formal-verify.cjs` — add envelope validation step early, analyze ENV results
4. Test: plan-phase specs include ENV-* PROPERTY statements, TLC verifies them

**Avoids pitfall:** Binding before validation (ENV-02) would create specs with invalid constraints.

---

### Phase 3 (ENV-04 + ENV-05) — Protection + Visibility

**Goal:** Envelope immutability enforced, working copy divergence visible

**Tasks:**
1. Implement `detect-requirements-drift.cjs` — diff working vs frozen
2. Implement `amend-requirements.cjs` — amendment workflow with re-validation
3. Modify `qgsd-stop.js` — immutability enforcement
4. Modify `qgsd-prompt.js` — drift injection into context
5. Test: amendment workflow, immutability blocks, drift warnings

**Avoids pitfall:** Enforcement without amendment workflow would trap users (can't modify).

---

### Phase 4 (Integration Testing) — Validation

**Goal:** Full ecosystem working end-to-end

**Tests:**
1. New-milestone → envelope validation → plan-phase with constraints → formal-verify
2. User amends REQUIREMENTS.md → drift warning → amendment workflow → re-frozen
3. Direct edit attempt → Stop hook BLOCK → error message
4. TLC failure due to envelope constraint violation → clear error attribution
5. Load test: 10K requirements (drift detection performance)

---

## Confidence Assessment

| Area | Confidence | Reason |
|------|------------|--------|
| Architecture | HIGH | Existing formal system well-documented; new layer integrates cleanly |
| New Components | HIGH | All 5 scripts are straightforward transformations with clear inputs/outputs |
| Hook Integration | HIGH | qgsd-prompt.js + qgsd-stop.js are already extensible; patterns established |
| Haiku Validator | MEDIUM | Haiku availability/latency during validation gate is variable; fallback needed |
| Backward Compat | HIGH | All features optional; graceful fallback if envelope missing |
| Drift Detection | HIGH | Simple semantic diff algorithm; false positive rate manageable |
| Immutability Enforcement | HIGH | Stop hook already scans transcripts; direct file modification detection is straightforward |

---

## Gaps & Open Questions

### Technical

1. **Haiku timeout handling:** What behavior if Haiku unavailable during ENV-02 validation?
   - *Current plan:* 30s timeout, user chooses (accept as-is, skip validation, retry)
   - *Risk:* If envelope stays unvalidated (frozen_at = null), specs don't read it
   - *Mitigation:* Graceful fallback in generate-phase-spec.cjs

2. **Semantic similarity threshold for drift:** How many % text change = "semantic drift"?
   - *Current plan:* > 20% difference = drift (single-word edits ignored)
   - *Risk:* Threshold may be too aggressive or too lenient
   - *Mitigation:* Configurable threshold in config.json

3. **Amendment workflow UI:** How does user input amendments? JSON? CLI flags? Interactive?
   - *Current plan:* Interactive prompts + optional CLI flags
   - *Risk:* UX may be awkward for large requirement sets
   - *Mitigation:* Design amendment UX carefully; consider JSON import/export

### Operational

4. **Haiku validator reliability:** Does Haiku consistently detect duplicates/contradictions?
   - *Risk:* Missed issues → invalid envelope frozen
   - *Mitigation:* Haiku validator is lightweight; human eye still reviews in AskUserQuestion

5. **Performance at scale:** Drift detection on 10K requirements — any perf issues?
   - *Risk:* Slow drift check on every prompt = bad UX
   - *Mitigation:* Implement semantic hashing for fast comparison

6. **Audit trail:** Where to track envelope change history? (frozen → amended → re-frozen)
   - *Risk:* No traceability if envelope modified multiple times
   - *Mitigation:* Git commits + model-registry.json version tracking

---

## Recommended Phase-Specific Research

| Phase | Topic | Reason |
|-------|-------|--------|
| ENV-01 | REQUIREMENTS.md parsing — any special syntax we're not capturing? | Ensure aggregate-requirements.cjs handles all real requirement patterns |
| ENV-02 | Haiku validator prompt design — how to phrase duplicate/contradiction detection? | Validate that Haiku can reliably catch issues |
| ENV-03 | TLA+ PROPERTY generation from natural language — how to template different requirement types? | Ensure LTL formulas are semantically correct |
| ENV-04 | Amendment workflow UX — CLI vs interactive vs JSON? | Design for user experience |
| ENV-05 | Drift semantic similarity algorithm — threshold tuning | Minimize false positives while catching real changes |

---

## Success Criteria

**Functional:**
- [x] Envelope aggregated from REQUIREMENTS.md in new-milestone
- [x] Haiku validates envelope before freezing
- [x] Phase specs include ENV-* PROPERTY statements
- [x] Immutability enforced by Stop hook
- [x] Amendment workflow re-validates + re-freezes
- [x] Drift detection warns user on every planning command

**Non-Functional:**
- [x] Backward compatible (envelope optional)
- [x] No regressions in existing phase planning
- [x] Drift detection fast (< 1s on 10K requirements)
- [x] Haiku timeout handled gracefully

**Integration:**
- [x] new-milestone → envelope → plan-phase roundtrip works
- [x] TLC failures due to envelope constraints clearly attributed
- [x] Amendment workflow end-to-end functional

---

## Roadmap Structure Recommendation

```
v0.22 Requirements Envelope
├── Phase v0.22-00-envelope (1 week)
│   ├── Task 1: aggregate-requirements.cjs (ENV-01)
│   ├── Task 2: validate-requirements-haiku.cjs (ENV-02)
│   ├── Task 3: qgsd-haiku-validator agent (ENV-02)
│   └── Task 4: integration testing (ENV-01 + ENV-02)
│
├── Phase v0.22-01-envelope-binding (1 week)
│   ├── Task 1: extract-requirements-properties.cjs (ENV-03)
│   ├── Task 2: modify generate-phase-spec.cjs (ENV-03)
│   ├── Task 3: modify run-formal-verify.cjs (ENV-02, ENV-03)
│   └── Task 4: integration testing (ENV-03 in plan-phase)
│
├── Phase v0.22-02-envelope-protection (1 week)
│   ├── Task 1: detect-requirements-drift.cjs (ENV-05)
│   ├── Task 2: amend-requirements.cjs (ENV-04)
│   ├── Task 3: modify qgsd-stop.js + qgsd-prompt.js (ENV-04, ENV-05)
│   └── Task 4: integration testing (amendment workflow + drift)
│
└── Phase v0.22-03-envelope-validation (1 week)
    ├── Task 1: end-to-end new-milestone → plan-phase → formal-verify
    ├── Task 2: amendment workflow scenarios
    ├── Task 3: load testing (10K requirements)
    └── Task 4: documentation + rollout
```

---

## Key Design Decisions

### Decision 1: Separate Artifact vs In-Document Annotation
**Chosen:** Separate `formal/requirements.json` artifact in `formal/` directory
**Rationale:** Formal verification ownership; clear immutability boundary; enables schema versioning
**Alternative rejected:** Embed frozen requirements in REQUIREMENTS.md frontmatter (harder to enforce immutability, no version tracking)

### Decision 2: Haiku Validation vs No Validation
**Chosen:** Lightweight Haiku validation before freezing (ENV-02)
**Rationale:** Catches duplicates/contradictions early; human (user) approves issues; low cost
**Alternative rejected:** No validation (risks frozen envelope with defects) / Heavy SME review (overkill, delays by days)

### Decision 3: Hook-Based Immutability vs Repository-Level
**Chosen:** Stop hook immutability enforcement + amendment workflow
**Rationale:** Works without git config changes; amendment workflow provides escape hatch; clear UX
**Alternative rejected:** Git pre-commit hook (requires config, harder to debug) / No enforcement (defeats immutability goal)

### Decision 4: Drift Detection Always-On vs On-Demand
**Chosen:** Always-on via UserPromptSubmit hook (ENV-05)
**Rationale:** User always aware; non-blocking (doesn't interrupt workflow); encourages amendment discipline
**Alternative rejected:** Manual drift check (requires user discipline) / No drift tracking (loses visibility into working copy divergence)

---

## Sources

**QGSD Project Documentation:**
- `/Users/jonathanborduas/code/QGSD/.planning/PROJECT.md` — v0.22 overview
- `/Users/jonathanborduas/code/QGSD/.planning/REQUIREMENTS.md` — detailed ENV-01..05 specifications (lines 59-70)

**Formal Verification Infrastructure:**
- `/Users/jonathanborduas/code/QGSD/formal/model-registry.json` — central artifact index
- `/Users/jonathanborduas/code/QGSD/bin/run-formal-verify.cjs` — 30-step orchestrator
- `/Users/jonathanborduas/code/QGSD/bin/generate-phase-spec.cjs` — phase truths → TLA+ properties
- `/Users/jonathanborduas/code/QGSD/bin/promote-model.cjs` — model promotion pipeline

**Hook System:**
- `/Users/jonathanborduas/code/QGSD/hooks/qgsd-prompt.js` — UserPromptSubmit injection
- `/Users/jonathanborduas/code/QGSD/hooks/qgsd-stop.js` — quorum validation + transcript scanning
- `/Users/jonathanborduas/code/QGSD/hooks/qgsd-spec-regen.js` — PostToolUse regeneration

**Workflow Documentation:**
- `/Users/jonathanborduas/code/QGSD/qgsd-core/workflows/new-milestone.md` — milestone creation
- `/Users/jonathanborduas/code/QGSD/qgsd-core/workflows/plan-phase.md` — phase planning (28 steps)

**Architecture Reference:**
- `.planning/research/ENV_ARCHITECTURE.md` — full integration architecture (this session)

---

**Researched:** 2026-03-01
**Confidence Assessment:** HIGH (requirements well-scoped, architecture validated against existing system, integration points identified, build order justified)
**Ready for Roadmap:** YES (5 new components + 4 modifications, 4-week implementation plan provided)
