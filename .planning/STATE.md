# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-03-07 after v0.30 start)

**Core value:** Planning decisions are multi-model verified by structural enforcement, not instruction-following
**Current focus:** Milestone v0.30 — Advanced Agent Patterns

## Current Position

Phase: Not started (defining requirements)
Plan: —
Status: Defining requirements
Last activity: 2026-03-07 — Milestone v0.30 started

## Accumulated Context

### Decisions

Decisions logged in PROJECT.md Key Decisions table.
v0.29 milestone archived — clean boundary.
- [Phase solve-ft-batch-1-A]: NAV-04 uses source-grep instead of require because nForma.cjs launches TUI on import
- [Phase solve-ft-batch-1-B]: Implemented 4 formal-test-sync stubs (STATE-06, OBS-13, OBS-14, OBS-15) with 16 passing structural tests

### Pending Todos

None.

### Blockers/Concerns

None — clean milestone boundary.

### Quick Tasks Completed

| # | Description | Date | Commit | Status | Directory |
|---|-------------|------|--------|--------|-----------|
| 190 | Review and validate session persistence and modal fix changes in nForma.cjs | 2026-03-06 | fd0c6634 | Verified | [190-review-and-validate-session-persistence-](./quick/190-review-and-validate-session-persistence-/) |
| 191 | Harden circuit breaker to prevent false positives on monotonic workflow progression | 2026-03-06 | 60e5f8bc | Verified | [191-harden-circuit-breaker-to-prevent-false-](./quick/191-harden-circuit-breaker-to-prevent-false-/) |
| 192 | Fix execute-plan Route C to chain into transition.md audit-milestone logic on last phase completion | 2026-03-06 | 1711e881 | Verified | [192-fix-execute-plan-route-c-to-chain-into-t](./quick/192-fix-execute-plan-route-c-to-chain-into-t/) |
| 193 | Build bin/git-heatmap.cjs — mine git history for numerical adjustments, bugfix hotspots, and churn ranking; output .planning/formal/evidence/git-heatmap.json as input for nf:solve | 2026-03-06 | e59d88e7 | Verified | [193-build-bin-git-heatmap-cjs-mine-git-histo](./quick/193-build-bin-git-heatmap-cjs-mine-git-histo/) |
| 194 | Fix gsd-tools.cjs phase-complete to detect next phase from ROADMAP.md when no directory exists on disk | 2026-03-06 | 3d186560 | Verified | [194-fix-gsd-tools-cjs-phase-complete-to-dete](./quick/194-fix-gsd-tools-cjs-phase-complete-to-dete/) |
| 195 | Add automated audit→plan→execute loop to nf:audit-milestone for tech debt auto-remediation | 2026-03-06 | c5467c79 | Pending | [195-add-automated-audit-plan-execute-loop-to](./quick/195-add-automated-audit-plan-execute-loop-to/) |
| 196 | Improve formal scope scan to use semantic relevance instead of keyword-only matching for determining which formal spec modules apply | 2026-03-06 | d1ea24da | Verified | [196-improve-formal-scope-scan-to-use-semanti](./quick/196-improve-formal-scope-scan-to-use-semanti/) |
| 197 | Add CI virgin install tests and workflow | 2026-03-06 | 0a0c07e5 | Verified | [197-add-ci-virgin-install-tests-and-workflow](./quick/197-add-ci-virgin-install-tests-and-workflow/) |
| 198 | Implement ECC best practices: post-edit auto-format hook, console.log guard on Stop, and modular .claude/rules/ directory | 2026-03-06 | 1bd37864 | Verified | [198-implement-ecc-best-practices-post-edit-a](./quick/198-implement-ecc-best-practices-post-edit-a/) |
| 199 | Consolidate nf:solve baseline diagnostic into a single unified table | 2026-03-06 | 08883451 | Pending | [199-consolidate-nf-solve-baseline-diagnostic](./quick/199-consolidate-nf-solve-baseline-diagnostic/) |
| 200 | Verify OBS-09..12 code conformance and F->T test coverage | 2026-03-06 | ae9e1ecb | Verified | [200-verify-obs-09-12-code-conformance-and-f-t-test](./quick/200-verify-obs-09-12-code-conformance-and-f-t-test/) |
| 201 | Survey code for producer-without-consumer lone features not wired into top-level skills | 2026-03-07 | aa725efc | Verified | [201-survey-code-for-producer-without-consume](./quick/201-survey-code-for-producer-without-consume/) |
| 202 | Wire gate-a/b/c, cross-layer-dashboard, and hazard-model into nf:solve remediation flow | 2026-03-07 | 4a5cdc5a | Pending | [202-wire-gate-a-b-c-cross-layer-dashboard-an](./quick/202-wire-gate-a-b-c-cross-layer-dashboard-an/) |
| 203 | Wire remaining 12 lone producer scripts into their target skill commands | 2026-03-07 | 06489db0 | Pending | [203-wire-remaining-12-lone-producer-scripts-](./quick/203-wire-remaining-12-lone-producer-scripts-/) |
| 204 | Audit formal models for state space explosion risks and ensure inductive properties are used | 2026-03-07 | dabfd9d2 | Verified | [204-audit-formal-models-for-state-space-expl](./quick/204-audit-formal-models-for-state-space-expl/) |
| 205 | Fix conformance traces — expand mapToXStateEvent | 2026-03-07 | a86b34ef | Verified | [205-fix-conformance-traces-expand-maptoxstat](./quick/205-fix-conformance-traces-expand-maptoxstat/) |
| 206 | Add --base-ref to gate-a-grounding.cjs for diff-scoped grounding | 2026-03-07 | 6f366654 | Verified | [206-add-base-ref-to-gate-a-grounding-cjs-for](./quick/206-add-base-ref-to-gate-a-grounding-cjs-for/) |

## Session Continuity

Last session: 2026-03-06
Stopped at: Completed v0.29 milestone — Three-Layer Formal Verification Architecture
Resume file: None
