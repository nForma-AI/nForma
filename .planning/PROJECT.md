# GSD Quick Mode

## What This Is

A fast-path command (`/gsd:quick`) for GSD that executes small tasks with the same guarantees (atomic commits, STATE.md tracking) but skips optional verification agents. Reduces agent spawns from 5-8 to 2 (planner + executor) for tasks where the user already knows what to do.

## Core Value

Same guarantees, 50-70% fewer tokens for simple tasks.

## Requirements

### Validated

- ✓ `/gsd:quick "description"` command executes end-to-end — v1.8.0
- ✓ Spawns gsd-planner (unchanged, just skips researcher/checker) — v1.8.0
- ✓ Spawns gsd-executor for each plan — v1.8.0
- ✓ Commits only files it edits/creates (not entire working dir) — v1.8.0
- ✓ Updates STATE.md with "Quick Tasks Completed" table — v1.8.0
- ✓ Updates STATE.md "Last activity" line — v1.8.0
- ✓ Errors if no ROADMAP.md exists — v1.8.0
- ✓ help.md updated with quick command — v1.8.0
- ✓ README.md updated with quick mode section — v1.8.0
- ✓ GSD-STYLE.md updated with quick mode patterns — v1.8.0

### Active

- [ ] `/gsd:resume-work` handles decimal phases (3.1, 3.2)

### Out of Scope

- `--plan-only` flag — MVP is always execute
- `--after N` flag — always inserts after current phase
- `--standalone` flag — requires active project, no exceptions
- Node.js helper scripts — Claude handles decimal parsing inline
- Git status warnings — commits only its own files anyway
- Planner modifications — planner unchanged, orchestrator skips agents
- gsd-verifier — verification skipped by design
- Requirements mapping — quick tasks are ad-hoc
- `/gsd:squash-quick` — future enhancement if fragmentation becomes a problem
- Decimal phases in ROADMAP.md — Quick tasks use `.planning/quick/` instead
- Handles multiple plans with wave-based execution — Quick tasks are single-plan by design

## Context

Shipped v1.8.0 with `/gsd:quick` command. Quick tasks live in `.planning/quick/NNN-slug/` directories with sequential numbering. Each quick task spawns planner + executor and commits atomically.

Design change: Quick tasks don't integrate with ROADMAP.md or use decimal phases. They're tracked separately in STATE.md's Quick Tasks Completed table.

## Constraints

- **Artifacts**: Same artifacts as full mode (PLAN.md, SUMMARY.md)
- **Directory**: Quick tasks in `.planning/quick/`, not `.planning/phases/`

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| No planner changes | Quick mode is orchestrator-level, not agent-level | ✓ Good |
| No decimal phases | Quick tasks don't need ROADMAP integration | ✓ Good — simpler |
| No flags for MVP | Simplest possible interface | ✓ Good |
| Quick Tasks table in STATE.md | Better tracking than just Last activity | ✓ Good |
| Error if no ROADMAP | Maintains state integrity, no standalone mode | ✓ Good |
| Orchestration inline in command | No separate workflow needed for simple flow | ✓ Good |

---
*Last updated: 2026-01-19 after v1.8.0 milestone*
