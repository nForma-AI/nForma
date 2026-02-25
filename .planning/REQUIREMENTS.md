# Requirements: QGSD v0.13 Autonomous Milestone Execution

**Defined:** 2026-02-25
**Core Value:** Planning decisions are multi-model verified by structural enforcement, not instruction-following — a Stop hook that reads the transcript makes it impossible for Claude to skip quorum.

## v1 Requirements

### Loop Wiring

Changes to `transition.md` and `audit-milestone.md` to close the audit gap and create the re-audit loop.

- [x] **LOOP-01**: The last-phase transition calls audit-milestone before complete-milestone (primary phase path)
- [x] **LOOP-02**: The last-phase transition detects the `**Gap Closure:**` ROADMAP marker on the completed phase and routes to audit-milestone instead of complete-milestone (gap closure re-audit path)
- [x] **LOOP-03**: audit-milestone auto-spawns a plan-milestone-gaps Task when result is gaps_found and at least one phase is classified missing_no_plan
- [x] **LOOP-04**: plan-milestone-gaps auto-spawns a plan-phase Task for the first gap phase after quorum approves the proposed phases

### Quorum Gates

Every AskUserQuestion in the autonomous loop is replaced by R3 quorum.

- [x] **QUORUM-01**: plan-milestone-gaps proposed gap closure phases are submitted to R3 quorum for approval before ROADMAP.md is updated (replaces AskUserQuestion confirmation gate)
- [x] **QUORUM-02**: execute-phase gaps_found triggers quorum diagnosis and auto-resolution (replaces chain halt + manual suggestion)
- [x] **QUORUM-03**: discuss-phase remaining user_questions (surviving R4 pre-filter) are routed to quorum in auto mode (replaces AskUserQuestion for gray areas)

### State Tracking

- [x] **STATE-01**: audit-milestone updates STATE.md "Stopped at" and "Current Position" fields with the audit result (passed / gaps_found / tech_debt) after writing the MILESTONE-AUDIT.md artifact

## v2 Requirements

### Deferred

- Parallel audit + gap closure (running multiple gap cycles concurrently) — deferred as over-engineering for v1
- complete-milestone → new-milestone auto-advance — intentionally manual; new milestone goals require human intent

## Out of Scope

| Feature | Reason |
|---------|--------|
| gsd-tools.cjs changes | No new tooling needed — infrastructure (Gap Closure marker, is_last_phase, R3 quorum) already exists |
| gsd: workflow file updates | Downstream sync from qgsd: files; out of scope for this milestone |
| complete-milestone → new-milestone auto-advance | New milestone goals require human intent; not a valid quorum decision |
| New quorum models or providers | Infrastructure change, orthogonal to this milestone |
| Per-phase audit (not just milestone audit) | Over-engineering; phase-level verification via quorum-test is sufficient |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| LOOP-01 | v0.13-01 (verified by v0.13-03) | Complete |
| LOOP-02 | v0.13-01 (verified by v0.13-03) | Complete |
| LOOP-03 | v0.13-01 (verified by v0.13-03) | Complete |
| STATE-01 | v0.13-01 (verified by v0.13-03) | Complete |
| QUORUM-01 | v0.13-02 (verified by v0.13-03) | Complete |
| LOOP-04 | v0.13-02 (verified by v0.13-03) | Complete |
| QUORUM-02 | v0.13-02 (verified by v0.13-03) | Complete |
| QUORUM-03 | v0.13-02 (verified by v0.13-03) | Complete |

**Coverage:**
- v1 requirements: 8 total
- Mapped to phases: 8 (implemented in v0.13-01/02; formal verification in v0.13-03)
- Unmapped: 0 ✓

---
*Requirements defined: 2026-02-25*
*Last updated: 2026-02-25 — gap closure phases v0.13-03/04 added; traceability updated to reflect verifier phase; v0.13-05 added for TECH-01 IS_GAP_CLOSURE behavioral correctness fix (LOOP-01/LOOP-02)*
