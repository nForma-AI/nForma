# Roadmap: nForma

## Milestones

- ✅ **v0.2 — Gap Closure & Activity Resume Routing** — Phases 1–17 (shipped 2026-02-21)
- ✅ **v0.3 — Test Suite Maintenance Tool** — Phases 18–22 (shipped 2026-02-22)
- ✅ **v0.4 — MCP Ecosystem** — Phases 23–31 (shipped 2026-02-22)
- ✅ **v0.5 — MCP Setup Wizard** — Phases 32–38 (shipped 2026-02-23)
- ✅ **v0.6 — Agent Slots & Quorum Composition** — Phase 39 (shipped 2026-02-23)
- ✅ **v0.7 — Composition Config & Multi-Slot** — Phases v0.7-01..v0.7-04 (shipped 2026-02-23)
- ✅ **v0.8 — fix-tests ddmin Pipeline** — Phase v0.8-01 (shipped 2026-02-23)
- ✅ **v0.9 — GSD Sync** — Phases v0.9-01..v0.9-09 (shipped 2026-02-27)
- ✅ **v0.10 — Roster Toolkit** — Phases v0.10-01..v0.10-08 (shipped 2026-02-25)
- ✅ **v0.11 — Parallel Quorum** — Phase v0.11-01 (shipped 2026-02-24)
- ✅ **v0.13 — Autonomous Milestone Execution** — Phases v0.13-01..v0.13-06 (shipped 2026-02-25)
- ✅ **v0.14 — FV Pipeline Integration** — Phases v0.14-01..v0.14-05 (shipped 2026-02-26)
- ✅ **v0.15 — Health & Tooling Modernization** — Phases v0.15-01..v0.15-04 (shipped 2026-02-27)
- ✅ **v0.19 — FV Pipeline Hardening** — Phases v0.19-01..v0.19-11 (completed 2026-02-28)
- ✅ **v0.20 — FV as Active Planning Gate** — Phases v0.20-01..v0.20-09 (shipped 2026-03-01)
- ✅ **v0.21 — FV Closed Loop** — Phases v0.21-01..v0.21-06 (shipped 2026-03-01)
- ✅ **v0.23 — Formal Gates** — Phases v0.23-01..v0.23-04 (shipped 2026-03-02)
- ✅ **v0.24 — Quorum Reliability Hardening** — Phases v0.24-01..v0.24-05 (shipped 2026-03-03)
- ✅ **v0.25 — Formal Traceability & Coverage** — Phases v0.25-01..v0.25-07 (shipped 2026-03-03)
- ✅ **v0.26 — Operational Completeness** — Phases v0.26-01..v0.26-06 (shipped 2026-03-04)
- ✅ **v0.27 — Production Feedback Loop** — Phases v0.27-01..v0.27-05 (shipped 2026-03-04)
- ✅ **v0.28 — Agent Harness Optimization** — Phases v0.28-01..v0.28-04 (shipped 2026-03-06)
- ✅ **v0.29 — Three-Layer Formal Verification Architecture** — Phases v0.29-01..v0.29-06 (shipped 2026-03-06)

> **v0.2 through v0.29 phase details archived to respective milestone ROADMAP files in** `.planning/milestones/`

---

## v0.30 — Advanced Agent Patterns

### Overview

v0.30 extends nForma's hook-driven pipeline with six advanced agent patterns: dynamic model selection for cost optimization, file-based state persistence across compaction, cross-session memory and learning, continuous verification during execution, iterative retrieval for quorum subagents, and git worktree parallelization. All patterns build on existing infrastructure with zero new npm dependencies, ordered by dependency depth and blast radius -- cost control and state management first, complex architectural changes last.

### Phases

- [x] **Phase v0.30-01: Dynamic Model Selection** - Task-complexity-aware routing, thinking budget scaling, token dashboarding, and auto-compaction at workflow boundaries (completed 2026-03-07)
- [ ] **Phase v0.30-02: File-Based Execution State** - Sub-task progress tracked in files so compaction never loses execution position
- [ ] **Phase v0.30-03: Memory Persistence** - Structured state, proactive session reminders, error resolution memory, and quorum decision memory survive compaction and sessions
- [ ] **Phase v0.30-04: Continuous Learning** - Automatic pattern extraction, user correction capture, quorum-validated skills, and failure catalog with confidence scoring
- [ ] **Phase v0.30-05: Continuous Verification** - Boundary-batched test/lint checks during execution and machine-verifiable completion conditions
- [ ] **Phase v0.30-06: Subagent Orchestration** - Iterative retrieval for quorum slots, phase-based context accumulation, and specialized retrieval agents
- [ ] **Phase v0.30-07: Worktree Parallelization** - Worktree-isolated executor subagents and parallel plan execution with merge orchestration

### Phase Details

#### Phase v0.30-01: Dynamic Model Selection
**Goal**: Users pay less for quorum by routing simple tasks to cheaper models and controlling thinking budgets per task type
**Depends on**: Nothing (first phase)
**Requirements**: TOKN-01, TOKN-02, TOKN-03, TOKN-04
**Success Criteria** (what must be TRUE):
  1. User sees automatic compaction triggered at 60-70% context usage when the workflow is at a clean boundary (phase-complete, verification-done, wave-barrier) instead of waiting for the 80%+ emergency threshold
  2. User can set `thinking_budget_scaling` in nf.json to control extended thinking per task type (0 for exploration, reduced for reviews, full for architecture) and observe the configured budget applied in quorum dispatch
  3. User can run a token dashboard command that shows cost breakdown per milestone, phase, and slot aggregated from token-usage.jsonl
  4. User observes simple tasks (linting, file reads, config changes) routed to cheaper models while complex tasks (architecture decisions, multi-file refactors) route to Opus, with no downgrade oscillation (cooldown period prevents thrashing)
**Plans**: 3 plans
Plans:
- [ ] v0.30-01-01-PLAN.md — Task complexity classifier + thinking budget scaling in quorum dispatch
- [ ] v0.30-01-02-PLAN.md — Token usage dashboard CLI with /nf:tokens command
- [ ] v0.30-01-03-PLAN.md — Enhanced compaction at clean boundaries + anti-oscillation cooldown

#### Phase v0.30-02: File-Based Execution State
**Goal**: Execution progress survives mid-task compaction so the agent loop always resumes at the correct sub-task
**Depends on**: Phase v0.30-01
**Requirements**: VERF-01
**Success Criteria** (what must be TRUE):
  1. User's sub-task progress within a plan is tracked in a file (not just conversation context) so that after compaction the agent resumes at the correct step rather than restarting from the beginning
  2. The agent loop reaches a terminal state (success, cap exhausted, or unrecoverable) on every execution run -- file-based state tracking does not introduce infinite loops or stalls (formal: EventuallyTerminates)
**Plans**: 1 plan
Plans:
- [ ] v0.30-02-01-PLAN.md — File-based execution progress tracking with compaction injection and termination guards

#### Phase v0.30-03: Memory Persistence
**Goal**: Users retain accumulated knowledge (decisions, error fixes, quorum rationale) across compaction and sessions without manual re-entry
**Depends on**: Phase v0.30-02
**Requirements**: MEMP-01, MEMP-02, MEMP-03, MEMP-04
**Success Criteria** (what must be TRUE):
  1. User's accumulated decisions, rejected approaches, and partial findings persist in structured state files beyond STATE.md and survive compaction events
  2. User receives a proactive session reminder at SessionStart showing the last 3 decisions made, any blockers discovered, and relevant learnings from previous sessions
  3. User benefits from error resolution memory -- when a previously-solved error recurs, the symptom/root-cause/fix pattern is available as searchable context without re-diagnosis
  4. User benefits from quorum decision memory -- debate rationale ("chose X over Y because Z") persists across compaction and is available in subsequent quorum rounds
**Plans**: TBD

#### Phase v0.30-04: Continuous Learning
**Goal**: Users accumulate reusable knowledge automatically -- error patterns, correction habits, validated skills, and failure history prevent repeated mistakes
**Depends on**: Phase v0.30-03
**Requirements**: LRNG-01, LRNG-02, LRNG-03, LRNG-04
**Success Criteria** (what must be TRUE):
  1. User benefits from automatic error resolution extraction at session boundaries -- symptom-to-root-cause-to-fix patterns are extracted from the session transcript into a searchable catalog without manual action
  2. User corrections to Claude's approach (e.g., "don't use that pattern, do this instead") are automatically recorded as learned patterns and applied in future sessions
  3. User benefits from quorum-validated skill extraction -- only patterns that multiple models agree are valuable get persisted as reusable skills, filtering out noise
  4. User benefits from a failure catalog with confidence scores that tracks failed approaches and prevents re-attempting dead ends in subsequent sessions
**Plans**: TBD

#### Phase v0.30-05: Continuous Verification
**Goal**: Users get immediate feedback on code quality during execution, not just at phase end, with machine-checkable definitions of "done"
**Depends on**: Phase v0.30-02
**Requirements**: VERF-02, VERF-03
**Success Criteria** (what must be TRUE):
  1. User benefits from continuous test verification during execution -- relevant tests run after each code change via PostToolUse boundary batching (max 3 per phase, 5s timeout), surfacing regressions immediately rather than at phase end
  2. User benefits from machine-verifiable completion conditions -- "done" is defined as checkable conditions (tests pass, linter clean, type-check passes) that are evaluated programmatically, not by LLM judgment
  3. Verification checks do not stall the agent loop -- checks that timeout or fail degrade gracefully to advisory warnings without blocking execution (formal: EventuallyTerminates)
**Plans**: TBD

#### Phase v0.30-06: Subagent Orchestration
**Goal**: Quorum slot workers retrieve context on demand instead of receiving fixed dumps, and architecture decisions accumulate across phases
**Depends on**: Phase v0.30-01, Phase v0.30-03
**Requirements**: ORCH-01, ORCH-02, ORCH-03
**Success Criteria** (what must be TRUE):
  1. User benefits from iterative retrieval for quorum slot workers -- workers can request additional context via Read/Grep/Glob as needed instead of receiving a fixed context dump, with per-slot token budget (8k max) and max 2 retrieval rounds
  2. User benefits from phase-based context accumulation -- architecture decisions, test results, and API contracts from completed phases automatically inject into subsequent phase planning via a context stack
  3. User benefits from specialized retrieval agents -- domain-specific agents (test-retriever, architecture-retriever, formal-model-retriever) with preloaded skills fetch targeted context more efficiently than generic retrieval
**Plans**: TBD

#### Phase v0.30-07: Worktree Parallelization
**Goal**: Independent plan tasks execute simultaneously in isolated git worktrees instead of sequentially, with safe merge orchestration
**Depends on**: Phase v0.30-01, Phase v0.30-02, Phase v0.30-05, Phase v0.30-06
**Requirements**: PARA-01, PARA-02
**Success Criteria** (what must be TRUE):
  1. User benefits from worktree-isolated executor subagents -- parallel tasks run in git worktrees using native `isolation: worktree` without file conflicts, with all mutable state scoped to worktree-specific directories
  2. User benefits from parallel plan execution -- independent plan tasks identified in the plan are dispatched simultaneously to isolated worktrees instead of running sequentially, with merge orchestration handling results
  3. Each parallel executor reaches a terminal state (success, cap exhausted, or unrecoverable) independently -- no executor stalls or blocks other executors (formal: EventuallyTerminates)
**Plans**: TBD

### Progress

**Execution Order:**
v0.30-01 -> v0.30-02 -> v0.30-03 -> v0.30-04 -> v0.30-05 -> v0.30-06 -> v0.30-07

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| v0.30-01. Dynamic Model Selection | 3/3 | Complete    | 2026-03-07 |
| v0.30-02. File-Based Execution State | 0/1 | Not started | - |
| v0.30-03. Memory Persistence | 0/TBD | Not started | - |
| v0.30-04. Continuous Learning | 0/TBD | Not started | - |
| v0.30-05. Continuous Verification | 0/TBD | Not started | - |
| v0.30-06. Subagent Orchestration | 0/TBD | Not started | - |
| v0.30-07. Worktree Parallelization | 0/TBD | Not started | - |
