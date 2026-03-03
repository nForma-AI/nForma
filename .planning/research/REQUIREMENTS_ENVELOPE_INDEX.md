# Requirements Envelope Research Index

**Research period:** 2026-03-01

**Milestone:** QGSD v0.22 (Requirements Envelope)

---

## Research Files

### 1. REQUIREMENTS_ENVELOPE_RESEARCH_SUMMARY.md
**Purpose:** Executive summary and roadmap implications

**Contains:**
- Research scope (what we investigated)
- Key findings (what we learned)
- Pitfalls by phase (when they matter)
- High-confidence recommendations
- Recovery strategies and cost assessment
- Confidence levels by research area

**Start here if:** You need a 10-minute overview or are deciding phase ordering.

---

### 2. REQUIREMENTS_ENVELOPE_PITFALLS.md
**Purpose:** Detailed pitfall analysis with prevention and recovery strategies

**Contains 9 critical pitfalls:**
1. JSON Schema Versioning Creates Validation Brittleness
2. Haiku Validation Pass Becomes Unreliable / Non-Deterministic
3. Immutability Enforcement Lacks Clear Amendment Workflow
4. Drift Detection False Positives Overwhelm Signal
5. Formal Spec Generation Discovers Requirements Were Incomplete / Contradictory
6. Immutability Enforcement Prevents Normal Development Workflows
7. Hook Installation Sync Breaks Immutability Enforcement
8. Requirements-to-Formal-Spec Traceability Gap Obscures Coverage
9. Haiku Validation Fails Due to Quota / Model Availability

**Plus supporting sections:**
- Technical Debt Patterns (table format)
- Integration Gotchas (common mistakes + correct approach)
- Performance Traps (when systems break at scale)
- Security Mistakes (immutability/drift/validation risks)
- UX Pitfalls (user frustration points)
- "Looks Done But Isn't" Checklist (verification gates)
- Recovery Strategies (cost assessment for each pitfall)
- Pitfall-to-Phase Mapping (which phase prevents which pitfall)

**Start here if:** You're implementing a specific phase or designing a subsystem.

---

## Research Findings Summary

### Most Critical Discoveries

1. **Staged validation is required** (not single-pass)
   - Stage 1: Formal spec dry-run (catch structural issues)
   - Stage 2: Haiku semantic validation (catch duplicates/conflicts)
   - Stage 3: Amendment window (allow spec fixes before freeze)
   - Stage 4: Immutable envelope (final freeze)

2. **Amendment workflow must precede immutability hook**
   - Design amendment classes (A/B/C) first
   - Implement hook after workflow is clear
   - Prevents user confusion and shadow documents

3. **Semantic fingerprinting required for drift detection**
   - Naive string diffs produce false positive storms
   - ~90% of detected "drifts" are noise
   - Only enable drift detection after false positive rate <5%

4. **Haiku validation needs aggregation**
   - Never single-shot LLM judgment
   - Run 3+ passes; findings must appear in ≥2 passes for HIGH confidence
   - Generate deterministic hashes to detect non-reproducibility

5. **Separate immutable envelope from operational metadata**
   - `requirements.json` immutable (content)
   - `requirements.metadata.json` mutable (operational data)
   - Prevents legitimate tools from being blocked

---

## Phase Ordering (Based on Dependencies)

```
Phase 1: Foundation
  └─ Schema design + vocabulary boundaries
     └─ Prerequisite for Phase 2

Phase 2: Validation + Spec Generation
  ├─ Formal spec dry-run (catches incompatibilities early)
  ├─ Haiku validation (rubric + aggregation)
  └─ Staged freezing (amendment window open)
     └─ Prerequisite for Phase 3

Phase 3: Immutability + Amendment Workflow
  ├─ Amendment workflow (classes A/B/C)
  ├─ Hook implementation (metadata separation)
  └─ Installation sync validation
     └─ Prerequisite for Phase 4

Phase 4: Integration
  ├─ Envelope → plan-phase workflow
  ├─ Envelope → spec generation source of truth
  └─ Traceability (requirements → properties)
     └─ Prerequisite for Phase 5

Phase 5: Drift Detection
  ├─ Semantic fingerprinting
  ├─ Selective windowing (plan vs execute phase)
  └─ False positive validation (<5%)
```

**Key constraint:** Phases must be sequential. Parallelizing Phase 2+3 or Phase 3+4 will cause expensive rework.

---

## Success Criteria by Phase

| Phase | Success Criterion |
|-------|---|
| Phase 1 | Schema finalized + versioning + migration plan documented |
| Phase 2 | Dry-run spec gen working; Haiku determinism validated (5-run hash test); cache working; fallback tested |
| Phase 3 | All 3 amendment classes working; hook installed globally; version check at phase start; merge conflicts resolvable |
| Phase 4 | Envelope constrains spec gen; traceability >95%; plan-phase uses envelope as source of truth |
| Phase 5 | Drift detection false positive rate <5%; semantic fingerprinting confirmed; windowing working |

---

## Quick Reference: Pitfall-to-Prevention Map

| Pitfall | Phase | Prevention |
|---------|-------|---|
| Schema brittleness | 1 | Version field + vocabulary boundaries + migration plan |
| Haiku non-determinism | 2 | Rubric + 3-pass aggregation + hash validation |
| Spec incompatibility | 2 | Dry-run spec gen before Haiku validation |
| Amendment lack | 3 | Define classes A/B/C before hook implementation |
| Immutability breaks workflows | 3 | Separate envelope from metadata; test merge resolution |
| Hook sync breaks | 3 | Version stamp + post-merge sync check + CI backstop |
| Drift false positives | 5 | Semantic fingerprinting; false positive rate <5% before enabling |
| Traceability gap | 2 | Embedded REQ- comments in specs; auto-generated traceability report |
| Haiku unavailability | 2 | Health check + cache + fallback to syntax validation |

---

## Research Quality Assessment

### High-Confidence Areas
- JSON Schema versioning pitfalls (official roadmap, documented breaking changes)
- LLM-as-judge validation reliability (ICLR 2026 research, industrial studies)
- Drift detection false positive storms (90% of IaC deployments experience drift)
- Immutability enforcement design (file-level mechanisms well-understood)

### Medium-Confidence Areas
- Hook installation sync risks (QGSD-specific; learned from memory context)
- Traceability gap risks (FV best practices; QGSD v0.21 model registry available but spec←→req mapping not yet explored)

### Topics Requiring Phase-Specific Research
- Semantic fingerprinting implementation details
- Amendment approval routing (quorum vs user vs automatic)
- Traceability coverage thresholds (85% vs 90% vs 95%+)
- Spec synthesis error recovery paths
- Cache invalidation strategy
- CI gate implementation details

---

## Sources (Consolidated)

### Academic Research
- [Automated requirement contradiction detection through formal logic and LLMs](https://link.springer.com/article/10.1007/s10515-024-00452-x) — ALICE system; LLM-only approaches miss 40% of contradictions
- [Requirements Ambiguity Detection and Explanation with LLMs: An Industrial Study](https://www.ipr.mdu.se/pdf_publications/7221.pdf) — Industrial validation of LLM-based detection
- [Context-Adaptive Requirements Defect Prediction through Human-LLM Collaboration](https://arxiv.org/html/2601.01952) — January 2026 research on LLM-based quality assessment
- [Validation of Modern JSON Schema: Formalization and Complexity](https://dl.acm.org/doi/10.1145/3632891) — JSON Schema formal analysis; PSPACE-hard with dynamic references
- [LogSage: An LLM-Based Framework for CI/CD Failure Detection and Remediation with Industrial Validation](https://arxiv.org/html/2506.03691v2) — March 2026 research; single-shot evaluations unreliable

### Infrastructure Drift Research
- [Data Drift: Key Detection and Monitoring Techniques in 2026](https://labelyourdata.com/articles/machine-learning/data-drift) — Drift detection patterns (PSI, KL Divergence, KS Test)
- [Drift Detection in IaC: Prevent Your Infrastructure from Breaking](https://www.env0.com/blog/drift-detection-in-iac-prevent-your-infrastructure-from-breaking) — ~90% of large deployments experience drift; false positives overwhelm signal
- [Autonomous Regulatory Drift Detection](https://al-kindipublishers.org/index.php/jcsts/article/download/10650/9398) — Statistical divergence approach to drift

### Formal Verification & LLM Validation
- [Best AI evals tools for CI/CD in 2025](https://braintrust.dev/articles/best-ai-evals-tools-cicd-2025) — LLM validation in CI/CD; semantic evaluation via embedding similarity
- [CI/CD for LLM apps: Run tests with Evidently and GitHub actions](https://www.evidentlyai.com/blog/llm-unit-testing-ci-cd-github-actions) — LLM-as-judge in gates; explicit rubrics necessary

### Developer Tools & Immutability
- [Effortless Code Quality: The Ultimate Pre-Commit Hooks Guide for 2025](https://gatlenculp.medium.com/effortless-code-quality-the-ultimate-pre-commit-hooks-guide-for-2025-57ca501d9835) — Pre-commit hook patterns
- [5 'chattr' Commands to Make Important Files IMMUTABLE (Unchangeable) in Linux](https://www.tecmint.com/chattr-command-examples/) — File-level immutability enforcement
- [How to Set Up Immutable Backup Storage Using Azure Blob](https://www.ninjaone.com/blog/set-up-immutable-backup-storage-using-azure-blob/) — WORM strategy

### Standards & Roadmaps
- [JSON Schema - Towards a stable JSON Schema](https://json-schema.org/blog/posts/future-of-json-schema) — Official JSON Schema roadmap; history of breaking changes and future stability strategy

---

## How to Use This Research

### For Roadmap Planning
1. Read REQUIREMENTS_ENVELOPE_RESEARCH_SUMMARY.md (Phase Ordering section)
2. Use Pitfall-to-Phase Mapping to define phase success criteria
3. Reference Recovery Strategies to understand cost of shortcuts

### For Phase Implementation
1. Identify your phase in REQUIREMENTS_ENVELOPE_PITFALLS.md
2. Review the pitfalls relevant to that phase
3. Use "Warning signs" to detect problems early
4. Check "Looks Done But Isn't" checklist before closing phase

### For Design Decisions
1. Reference Quick Reference Pitfall-to-Prevention Map
2. Look up the specific pitfall in REQUIREMENTS_ENVELOPE_PITFALLS.md
3. Review "How to avoid" section for specific recommendations
4. Check "Integration Gotchas" for interactions with existing QGSD infrastructure

---

*Research prepared: 2026-03-01*
*Ready for roadmap creation: YES*
