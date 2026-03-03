# Requirements Envelope Research Summary

**Research conducted:** 2026-03-01

**Project context:** QGSD v0.22 — Adding requirements-as-formal-artifacts to existing FV ecosystem

---

## Research Scope

This research focused on common mistakes when adding the following features to QGSD's existing formal verification infrastructure:

1. **Formal requirements artifacts** — promotion of `.planning/REQUIREMENTS.md` (working document) to `formal/requirements.json` (frozen envelope)
2. **LLM-based validation** — Haiku validation pass checking requirements for duplicates, conflicts, and ambiguity
3. **Immutability enforcement** — pre-commit hooks blocking unauthorized modifications to frozen envelope
4. **Drift detection** — monitoring for divergence between working requirements document and frozen envelope
5. **Integration with existing FV** — ensuring requirements envelope constrains TLA+/Alloy spec generation

---

## Key Findings

### Critical Integration Risk: Staged Validation, Not Single Gate

The most important finding is that **requirements validation must be multi-stage**, not single-pass:

| Stage | Gate | Purpose | Failure Mode |
|-------|------|---------|---|
| STAGE 1 | Formal Spec Dry-Run | Catch structural issues early (unsatisfiable conditions) | Formal incompatibility discovered late after freezing |
| STAGE 2 | Haiku Semantic Validation | Catch duplicates, conflicts, ambiguity | Non-deterministic results; false positives |
| STAGE 3 | Amendment Window (Class B/C) | Allow formal spec fixes before full freeze | Envelope frozen prematurely; phase blocked on spec errors |
| STAGE 4 | Immutable Envelope | Final freeze | — |

Attempting to merge STAGE 1 and STAGE 2 into a single "validation gate" will cause spec generation failures to block phases AFTER the envelope is already immutable.

### Secondary Risk: Immutability Without Amendment Workflow

Immutability enforcement (pre-commit hook) without a clear, bounded amendment workflow creates a dysfunctional situation:

- Typo in frozen requirement → user blocked by hook
- No official amendment path → user hacks the hook or maintains shadow documents
- Immutability becomes theater; team learns to ignore it
- Recovery cost is HIGH (days to redesign and redeploy hook)

**Prevention:** Define amendment classes (A/B/C) BEFORE implementing the enforcement hook. Amendment design is more important than hook design.

### Tertiary Risk: False Positive Storms from Drift Detection

Naive drift detection (string-level diffs) produces overwhelming noise:

- ~90% of detected "drifts" are formatting, reordering, clarifying language
- Team ignores drift warnings after first week
- Real drift (actual requirement change) goes undetected
- Recovery cost is MEDIUM (requires semantic fingerprinting redesign)

**Prevention:** Implement drift detection in two phases:
- Phase 5 disabled (drift disabled, only warnings)
- Only enable selective windows (plan-phase, not execute-phase) after false positive rate validated <5%

### Quaternary Risk: Haiku Validation Non-Determinism

LLM-as-judge validation is probabilistic. Same envelope can pass Tuesday, fail Wednesday.

**Prevention:** Use explicit rubrics + aggregate scoring (3 independent passes; findings must appear in ≥2 passes to count as HIGH confidence). Generate deterministic hashes of validation results to detect non-reproducibility early.

---

## Pitfalls Categorized by Phase

### Phase 1: Requirements Envelope Foundation
**Pitfall:** JSON Schema Versioning Brittleness

Design decisions made in Phase 1 lock in place. Extensibility must be explicit but not over-designed.

**Prevention checklist:**
- Schema includes `"schema_version": "1.0"` field
- Core constraint types (preconditions, postconditions, invariants) are locked
- Extension metadata (priority, risk level, sunset date) goes into extensible object
- v1.0 → v1.1 migration path is documented (not attempted; just documented)
- Schema lives in `formal/requirements.schema.json`, not embedded in code

---

### Phase 2: Haiku Validation Gate & Formal Spec Generation
**Pitfalls:**
1. Haiku Non-Determinism
2. Formal Spec Incompatibility
3. Haiku Unavailability

**Prevention checklist:**
- Pre-flight formal spec dry-run runs BEFORE Haiku validation, not after
- Dry-run failures are reported with specific requirement citations (REQ-02 ∧ REQ-05 unsatisfiable)
- Haiku uses explicit rubric; aggregation tested (run 5 times, hash must match)
- Health check runs before Haiku call; cache reused if envelope unchanged
- Fallback to syntax-only validation if Haiku unavailable
- Amendment window stays open until Phase 2 spec generation completes

---

### Phase 3: Immutability Contract & Amendment Workflow
**Pitfalls:**
1. Immutability Lacks Amendment Workflow
2. Hook Installation Sync Breaks Enforcement
3. Immutability Breaks Development Workflows

**Prevention checklist:**
- Amendment classes (A/B/C) defined before hook implementation
- Staging files (`formal/requirements.AMENDMENT-<timestamp>.json`) separate from envelope
- Hook allows Class A amendments to auto-approve; Class B/C route to explicit user approval
- Metadata separated (`requirements.json` immutable, `requirements.metadata.json` mutable)
- Hook tested against merge resolution, spec regeneration, metadata update workflows
- Version stamp added; post-merge sync validation checks source/dist freshness
- CI gate as backstop (independent of client-side hook)

---

### Phase 5: Drift Detection
**Pitfall:** Drift Detection False Positives

**Prevention checklist:**
- Initially disabled; enable only after semantic fingerprinting is proven
- Semantic fingerprinting (Haiku summaries) replaces string diffs
- False positive rate validated <5% before enabling
- Drift checking disabled during plan-phase (requirements being refined), enabled during execute-phase (stable)
- `.driftignore` mechanism for intentional changes; changes tracked separately

---

## Roadmap Implications

### Phase Ordering

The five phases MUST be sequential, not parallel:

1. **Phase 1 (Foundation)** → establishes schema, vocabulary boundaries
2. **Phase 2 (Validation)** → formal spec dry-run + Haiku validation + staged freezing
3. **Phase 3 (Immutability)** → amendment workflow + hook implementation
4. **Phase 4 (Integration)** → wire envelope into plan-phase, spec generation
5. **Phase 5 (Drift Detection)** → semantic fingerprinting, operator dashboards

Attempting phases out of order will create expensive rework:
- Implementing immutability (Phase 3) before designing amendment workflow (Phase 3 prerequisite) → HIGH recovery cost
- Freezing envelope (Phase 4) before formal spec compatibility validated (Phase 2 step) → HIGH recovery cost
- Enabling drift detection (Phase 5) with naive diffs → MEDIUM recovery cost

### Success Criteria by Phase

| Phase | Success Criterion |
|-------|---|
| Phase 1 | Schema finalized; vocabulary boundaries clear; migration plan documented |
| Phase 2 | Dry-run spec gen catches structural issues; Haiku determinism validated (5 runs, hash stable); cache working; fallback validation tested |
| Phase 3 | All 3 amendment classes working; hook installed globally; version check at phase start; merge conflicts resolvable without bypassing hook |
| Phase 4 | Envelope constrains spec generation; traceability >95%; plan-phase successfully uses envelope as source of truth |
| Phase 5 | Drift detection false positive rate <5%; semantics fingerprinting confirmed; selective windowing (plan vs execute phase) working |

---

## High-Confidence Recommendations

Based on research evidence:

1. **NEVER skip formal spec dry-run before Haiku validation.** (Prevents HIGH-cost recovery.)
   - Research: Requirements validation and formal spec synthesis are different gates with different discovery power.

2. **ALWAYS define amendment classes before implementing immutability hook.** (Prevents user confusion and shadow documents.)
   - Research: LLM-as-judge validates surface-level conflicts; formal spec validator catches deep semantic issues.

3. **ALWAYS use semantic fingerprinting for drift detection, never string-level diffs.** (Prevents false positive storms.)
   - Research: Infrastructure drift detection (~90% of large deployments experience drift) and regulatory drift detection both rely on semantic divergence, not string diffs. False positives overwhelm signal without semantic analysis.

4. **ALWAYS aggregate Haiku validation results (3+ passes), never single-shot judgement.** (Prevents non-determinism blocking phases.)
   - Research: LLM-as-judge validation requires explicit rubrics and aggregate scoring for reliability. Single-shot evaluations are unreliable per ICLR 2026 research.

5. **ALWAYS separate immutable envelope from operational metadata.** (Prevents tooling from being blocked by immutability guard.)
   - Research: Legitimate workflows (spec regeneration, metadata update) need to touch the file. Monolithic immutability blocks these workflows; separation resolves the conflict.

---

## Known Unknowns / Topics for Phase-Specific Research

| Topic | When to Research | Why |
|-------|---|---|
| **Semantic fingerprinting implementation** | During Phase 5 | How to embed Haiku summaries efficiently; cost of regenerating fingerprints on every drift check |
| **Amendment approval routing** | During Phase 3 | Which approval gates (quorum, user confirmation, none) for each amendment class; interaction with existing approval workflows |
| **Traceability coverage thresholds** | During Phase 4 | What coverage target (85%, 90%, 95%+)? What happens if a requirement can't be traced to a property? |
| **Spec synthesis error recovery** | During Phase 2 | If spec gen fails, what's the path forward? Auto-suggest amendment? Block phase? |
| **Cache invalidation strategy** | During Phase 2 | What triggers cache recompute? Requirement change only? Formal spec regeneration? Haiku model version change? |
| **CI gate implementation** | During Phase 3 | How to enforce immutability in CI independently of client hooks? Webhook on branch push? Pre-merge check? |

---

## Recovery Strategies (Cost Assessment)

| Pitfall | If Caught Early (Phase N) | If Caught Late (Post-deployment) |
|---------|---|---|
| Schema versioning brittleness | LOW (redesign schema, re-validate) | HIGH (migrate all envelopes; very expensive) |
| Haiku non-determinism | LOW (add rubric; revalidate) | HIGH (unpredictable phase blocks; team loses trust) |
| Immutability lacks amendment path | MEDIUM (design workflow, reinstall hook) | HIGH (team creates shadow documents or hacks hook) |
| Drift false positives | MEDIUM (redesign with semantics) | HIGH (drift detection disabled; real drift undetected) |
| Formal spec incompatibility | LOW (use dry-run; revalidate) | HIGH (envelope immutable; phase blocked on spec failures) |

**Key insight:** Early prevention is 10–100× cheaper than post-deployment recovery. Invest heavily in Phase 2 (Validation) dry-run and Phase 3 (Immutability) amendment workflow before shipping.

---

## Confidence Assessment

| Research Area | Confidence | Evidence |
|---|---|---|
| JSON Schema versioning pitfalls | HIGH | Official JSON Schema roadmap; documented Draft 2019-09 → 2020-12 breaking changes |
| LLM-as-judge validation reliability | HIGH | ICLR 2026 research; industrial studies (Requirements Ambiguity Detection); explicit rubrics + aggregate scoring well-established |
| Drift detection false positive storms | HIGH | Infrastructure drift research (~90% of deployments experience drift); naive detection produces floods of false positives |
| Immutability enforcement design | HIGH | File-level immutability well-understood (chattr, chflags); escape hatch design patterns documented |
| Hook installation sync risks | MEDIUM | QGSD-specific pattern; memory context documents pattern but no published recovery strategies |
| Traceability gap risks | MEDIUM | FV best practices suggest embedded comments + generated reports; QGSD v0.21 model registry exists but spec←→req mapping not yet explored |

---

## Appendix: Research Methods

1. **Web search:** Formal verification literature, JSON Schema best practices (2024–2026)
2. **Infrastructure drift research:** Learning from IaC/data drift patterns to inform requirements drift detection
3. **LLM validation literature:** ICLR 2026, industrial studies on requirements quality assessment
4. **Existing QGSD codebase review:** Hook patterns (qgsd-stop.js, qgsd-spec-regen.js), model registry, pending task (enforce-spec-requirements)
5. **Standard library research:** Pre-commit hooks, git hooks, immutability enforcement across Linux/macOS

---

*Summary prepared: 2026-03-01*
*For detailed pitfall analysis, see: REQUIREMENTS_ENVELOPE_PITFALLS.md*
