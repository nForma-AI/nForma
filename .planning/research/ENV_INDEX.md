# Research Index: QGSD v0.22 Requirements Envelope

**Research Date:** 2026-03-01
**Topic:** Requirements envelope integration (ENV-01..05)
**Status:** Complete

---

## Files in This Research

### 1. **ENV_SUMMARY.md** (START HERE)
**Purpose:** Executive overview and roadmap implications  
**For:** Project manager, architect deciding how to build this phase  
**Contains:**
- Executive summary of what envelope does
- Key findings (architecture, components, data flows)
- Critical integration points
- Build order rationale
- Roadmap structure recommendation (4-phase plan)
- Success criteria

**Read time:** 15 minutes

---

### 2. **ENV_ARCHITECTURE.md** (IMPLEMENTATION REFERENCE)
**Purpose:** Detailed architecture and component specifications  
**For:** Engineers implementing ENV-01..05  
**Contains:**
- Current QGSD architecture baseline
- Proposed envelope layer design
- **5 new components** with full specifications:
  - `aggregate-requirements.cjs` (ENV-01)
  - `validate-requirements-haiku.cjs` (ENV-02)
  - `detect-requirements-drift.cjs` (ENV-05)
  - `amend-requirements.cjs` (ENV-04)
  - `extract-requirements-properties.cjs` (ENV-03)
- **4 modified components** with precise change specs:
  - `generate-phase-spec.cjs` (ENV-03)
  - `run-formal-verify.cjs` (ENV-02, ENV-03)
  - `hooks/qgsd-prompt.js` (ENV-05)
  - `hooks/qgsd-stop.js` (ENV-04)
- Data flow patterns for each ENV requirement
- Component interaction diagrams
- Build order with dependencies
- Known constraints and mitigations
- Integration checklist

**Read time:** 45 minutes

---

## Quick Navigation

### By Role

**Project Manager:**
→ ENV_SUMMARY.md (sections: Executive Summary, Implications for Roadmap, Build Order Rationale)

**Architect:**
→ ENV_ARCHITECTURE.md (sections: System Overview, Component Architecture, Data Flow Patterns)

**Frontend Engineer (Agent/Hook modifications):**
→ ENV_ARCHITECTURE.md (section: Modified Existing Components, subsections 2, 3)

**Backend Engineer (CJS script implementation):**
→ ENV_ARCHITECTURE.md (section: New Components, subsections 1-5)

**QA/Tester:**
→ ENV_SUMMARY.md (section: Success Criteria) + ENV_ARCHITECTURE.md (section: Integration Checklist)

---

### By Phase

**Phase 1 (Week 1) — Foundation (ENV-01 + ENV-02):**
- ENV_SUMMARY.md: "Phase 1 (Week 1): Foundation"
- ENV_ARCHITECTURE.md: sections 1-2 (aggregate, validate components)
- ENV_ARCHITECTURE.md: "Phase Dependency Graph" (ENV-01 → ENV-02)

**Phase 2 (Week 2) — Spec Integration (ENV-03):**
- ENV_SUMMARY.md: "Phase 2 (Week 2): Spec Integration"
- ENV_ARCHITECTURE.md: sections 3, 5 (extract-properties, generate-phase-spec modification)
- ENV_ARCHITECTURE.md: "ENV-03: Spec Constraint Binding Flow"

**Phase 3 (Week 3) — Protection (ENV-04 + ENV-05):**
- ENV_SUMMARY.md: "Phase 3 (Week 3): Enforcement"
- ENV_ARCHITECTURE.md: sections 2, 4 (drift, amend components)
- ENV_ARCHITECTURE.md: "Modified: qgsd-stop.js, qgsd-prompt.js"

**Phase 4 (Week 4) — Integration Testing:**
- ENV_SUMMARY.md: "Phase 4 (Integration Testing)"
- ENV_ARCHITECTURE.md: "Integration Checklist"

---

### By Feature/Component

**Aggregation (ENV-01):**
- ENV_ARCHITECTURE.md: Component #1 "aggregate-requirements.cjs"
- ENV_ARCHITECTURE.md: Data Flow Pattern "ENV-01: Aggregation Flow"

**Validation Gate (ENV-02):**
- ENV_ARCHITECTURE.md: Component #2 "validate-requirements-haiku.cjs"
- ENV_ARCHITECTURE.md: Data Flow Pattern "ENV-02: Validation Gate Flow"
- ENV_ARCHITECTURE.md: Modified "run-formal-verify.cjs" (Change 1)

**Spec Constraint Binding (ENV-03):**
- ENV_ARCHITECTURE.md: Component #5 "extract-requirements-properties.cjs"
- ENV_ARCHITECTURE.md: Modified "generate-phase-spec.cjs"
- ENV_ARCHITECTURE.md: Modified "run-formal-verify.cjs" (Change 2)
- ENV_ARCHITECTURE.md: Data Flow Pattern "ENV-03: Spec Constraint Binding Flow"

**Immutability (ENV-04):**
- ENV_ARCHITECTURE.md: Component #4 "amend-requirements.cjs"
- ENV_ARCHITECTURE.md: Modified "qgsd-stop.js"
- ENV_ARCHITECTURE.md: Data Flow Pattern "ENV-04: Immutability Contract Flow"

**Drift Detection (ENV-05):**
- ENV_ARCHITECTURE.md: Component #3 "detect-requirements-drift.cjs"
- ENV_ARCHITECTURE.md: Modified "qgsd-prompt.js"
- ENV_ARCHITECTURE.md: Data Flow Pattern "ENV-05: Drift Detection Flow"

---

### By Question

**Q: What's the overall architecture?**
→ ENV_SUMMARY.md: "Key Findings > Architecture"  
→ ENV_ARCHITECTURE.md: "Proposed: Requirements Envelope Layer" (diagram)

**Q: What files need to be created?**
→ ENV_ARCHITECTURE.md: "Files to Create/Modify Summary" (table)

**Q: What files need to be modified?**
→ ENV_ARCHITECTURE.md: "Modified Existing Components" (sections 1-5)

**Q: What's the build order?**
→ ENV_SUMMARY.md: "Build Order Rationale"  
→ ENV_ARCHITECTURE.md: "Build Order & Dependencies"

**Q: What's the risk if we get the order wrong?**
→ ENV_ARCHITECTURE.md: "Build Order & Dependencies" (Phase Dependency Graph)

**Q: How do components talk to each other?**
→ ENV_ARCHITECTURE.md: "Component Interaction Diagram"

**Q: How does data flow through the system?**
→ ENV_ARCHITECTURE.md: "Data Flow Patterns" (5 detailed flows)

**Q: What happens if Haiku is unavailable?**
→ ENV_ARCHITECTURE.md: "Known Constraints & Mitigations" (Constraint 1)

**Q: What happens when the user edits REQUIREMENTS.md?**
→ ENV_ARCHITECTURE.md: "Data Flow Pattern: ENV-05: Drift Detection Flow"

**Q: How does the Stop hook know to block envelope edits?**
→ ENV_ARCHITECTURE.md: "Modified: qgsd-stop.js"

**Q: What if we need to change requirements after the envelope is frozen?**
→ ENV_ARCHITECTURE.md: "Component #4: amend-requirements.cjs"

---

## Key Metrics at a Glance

| Metric | Value |
|--------|-------|
| **New Components** | 5 (CJS scripts + 1 agent role) |
| **Modified Components** | 4 (2 hooks + 2 CJS scripts) |
| **Unchanged Files** | ~3 (documented in Architecture) |
| **Data Flow Patterns** | 5 (one per ENV requirement) |
| **Integration Points** | 4 (aggregation, validation, spec binding, enforcement) |
| **Critical Dependencies** | 1 (ENV-02 must complete before ENV-03) |
| **Backward Compatibility** | 100% (all features optional) |
| **Estimated Implementation** | 4 weeks (1 week per phase) |
| **Test Coverage** | Full roundtrip + edge cases (see Integration Checklist) |

---

## Decision Framework

**Use ENV_ARCHITECTURE.md if:**
- You need to understand how a specific component works
- You need to implement a feature
- You need to debug an integration point
- You're troubleshooting a data flow problem

**Use ENV_SUMMARY.md if:**
- You're planning the roadmap
- You need to understand "why" we're building this
- You're reviewing risk/mitigation strategies
- You're checking success criteria

---

## Implementation Checklist (From Research)

### Phase 1: Foundation
- [ ] Read ENV_ARCHITECTURE.md: "New Components 1-2" (aggregate, validate)
- [ ] Create `bin/aggregate-requirements.cjs`
- [ ] Create `bin/validate-requirements-haiku.cjs`
- [ ] Create `agents/qgsd-haiku-validator.md`
- [ ] Test roundtrip: REQUIREMENTS.md → validation → frozen envelope

### Phase 2: Spec Integration
- [ ] Read ENV_ARCHITECTURE.md: "New Component 5" (extract-properties)
- [ ] Read ENV_ARCHITECTURE.md: "Modified: generate-phase-spec.cjs"
- [ ] Create `bin/extract-requirements-properties.cjs`
- [ ] Modify `bin/generate-phase-spec.cjs`
- [ ] Modify `bin/run-formal-verify.cjs` (changes 1-2)
- [ ] Test: plan-phase includes ENV PROPERTY statements

### Phase 3: Protection + Visibility
- [ ] Read ENV_ARCHITECTURE.md: "New Components 3-4" (drift, amend)
- [ ] Create `bin/detect-requirements-drift.cjs`
- [ ] Create `bin/amend-requirements.cjs`
- [ ] Modify `hooks/qgsd-stop.js`
- [ ] Modify `hooks/qgsd-prompt.js`
- [ ] Test: amendment workflow, immutability, drift warnings

### Phase 4: Integration Testing
- [ ] Read ENV_SUMMARY.md: "Success Criteria"
- [ ] Read ENV_ARCHITECTURE.md: "Integration Checklist"
- [ ] Execute full roundtrip tests
- [ ] Load test: 10K requirements
- [ ] Verify backward compatibility

---

## Confidence Summary

| Area | Confidence | Source |
|------|-----------|--------|
| Architecture | HIGH | Existing system well-documented; new layer integrates cleanly |
| Component Specs | HIGH | Clear input/output contracts, straightforward transformations |
| Hook Integration | HIGH | Existing patterns established; extensibility proven |
| Data Flows | HIGH | Derived from existing QGSD pipelines |
| Build Order | HIGH | Dependencies explicitly modeled |
| Implementation Effort | HIGH | Estimated 4 weeks is reasonable given component complexity |
| Risk Mitigation | MEDIUM | Most risks have mitigations; Haiku availability is variable |

---

## Known Unknowns (Flagged for Phase-Specific Research)

| Area | Issue | Flagged | Mitigated |
|------|-------|---------|-----------|
| Haiku availability | Timeout during ENV-02 validation gate | YES | 30s timeout, user choice |
| Semantic drift threshold | % text change = "semantic drift" | YES | 20% threshold configurable |
| Amendment UX | Interactive vs CLI vs JSON? | YES | Design in Phase 1 |
| Audit trail | Where to track envelope change history | NO | Consider git + model-registry |
| Performance | Drift detection on 10K requirements | YES | Semantic hashing optimization |

---

## Document Maintenance

**Last updated:** 2026-03-01  
**By:** Claude Code Researcher (v0.22 Requirements Envelope)  
**Status:** COMPLETE (ready for roadmap)

If updating this index:
1. Keep entries brief and scannable
2. Update "Last updated" date
3. Cross-reference to specific sections in detailed docs
4. Maintain role-based navigation structure

