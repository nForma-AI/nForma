# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-03-08)

**Core value:** Planning decisions are multi-model verified by structural enforcement, not instruction-following
**Current focus:** v0.32 — Documentation & README Overhaul

## Current Position

Phase: v0.32-01 (README Above-the-Fold Restructure)
Plan: 01 of 01 complete
Status: Phase v0.32-01 complete
Last activity: 2026-03-09 — Completed v0.32-01-01-PLAN.md

Progress: [██████████] 100%

## Accumulated Context

### Decisions

Decisions logged in PROJECT.md Key Decisions table.
- [Phase v0.32-01]: Used HTML img tag with width=720 for TUI hero screenshot; added manual anchor for configuration-reference details block

### Pending Todos

None.

### Blockers/Concerns

- additionalContext token budget contention (multiple injection sources share ~4000 token ceiling)
- Token dashboard path mismatch: token-dashboard.cjs defaults to legacy path (Low severity)

## Quick Tasks Completed

| # | Description | Date | Commit | Status | Link |
|---|---|---|---|---|---|
| 226 | Track formal model complexity and runtime; nf:solve ingests results to decide split/merge | 2026-03-08 | 86e2650b | Verified | [226-track-formal-model-complexity-and-runtim](./quick/226-track-formal-model-complexity-and-runtim/) |
| 227 | Add missing action mappings to event-vocabulary.json for Gate A unmapped trace actions | 2026-03-08 | pending | Pending | [227-add-missing-action-mappings-to-event-voc](./quick/227-add-missing-action-mappings-to-event-voc/) |
| 228 | Build interactive TUI for browsing and acting on human-gated solve items | 2026-03-08 | cc0c08d8 | Verified | [228-build-interactive-tui-for-browsing-and-a](./quick/228-build-interactive-tui-for-browsing-and-a/) |
| 229 | Integrate solve-tui into nForma.cjs as F5 Solve module | 2026-03-08 | 8a51cbe0 | Pending | [229-integrate-solve-tui-into-nforma-cjs-as-a](./quick/229-integrate-solve-tui-into-nforma-cjs-as-a/) |
| 230 | Close all solver feedback loops in TUI Solve module | 2026-03-08 | d762995f | Verified | [230-close-all-solver-feedback-loops-in-tui-s](./quick/230-close-all-solver-feedback-loops-in-tui-s/) |
| 231 | Fix health checker W007 false positives for archived milestone phase directories | 2026-03-08 | ddfa4108 | Pending | [231-fix-health-checker-w007-false-positives-](./quick/231-fix-health-checker-w007-false-positives-/) |
| 232 | Fix token consumption display in nf:health | 2026-03-08 | pending | Pending | [232-fix-token-consumption-in-health-workflow](./quick/232-fix-token-consumption-in-health-workflow/) |
| 233 | Implement insights-driven nForma improvements (git safety, MCP guard, verify, preflight) | 2026-03-08 | 31c5ba8e | Verified | [233-implement-insights-driven-nforma-improve](./quick/233-implement-insights-driven-nforma-improve/) |
| 235 | Fix TLA+ model state space explosions and config bugs | 2026-03-09 | b5baea94 | Verified | [235-fix-tla-model-state-space-explosions-and](./quick/235-fix-tla-model-state-space-explosions-and/) |
| 236 | Wire evidence files into gate promotion pipeline — fix all 5 gaps | 2026-03-09 | a770ac15 | Verified | [236-wire-evidence-files-into-gate-promotion-](./quick/236-wire-evidence-files-into-gate-promotion-/) |
| 237 | Persist quorum debate traces with matched requirement IDs | 2026-03-09 | b8a98931 | Verified | [237-persist-quorum-debate-traces-with-matche](./quick/237-persist-quorum-debate-traces-with-matche/) |
| 238 | Close remaining gate promotion feedback loops | 2026-03-09 | d909b75e | Verified | [238-close-remaining-gate-promotion-feedback-](./quick/238-close-remaining-gate-promotion-feedback-/) |
| 239 | Add install-time path validation | 2026-03-09 | 61104d6f | Verified | [239-add-install-time-path-validation-to-bin-](./quick/239-add-install-time-path-validation-to-bin-/) |
| 240 | Teach sweepCtoR to read Requirements header comments | 2026-03-09 | 9d9e87b7 | Verified | [240-teach-sweepctor-to-read-requirements-hea](./quick/240-teach-sweepctor-to-read-requirements-hea/) |
| 241 | implement the migration (add --aggregate to compute-per-model-gates.cjs, migrate consumers, then delete global gates) | 2026-03-09 | 10064bbb | Verified | [241-implement-the-migration-add-aggregate-to](./quick/241-implement-the-migration-add-aggregate-to/) |
| 242 | Add Gate Scoring page to TUI under Reqs (F2) module + fix Solve (F5) ASCII art from T to S shape | 2026-03-09 | 54c92a3b | Pending | [242-add-gate-scoring-page-to-tui-under-reqs-](./quick/242-add-gate-scoring-page-to-tui-under-reqs-/) |

## Session Continuity

Last session: 2026-03-09
Stopped at: Completed v0.32-01-01-PLAN.md
Resume file: None
