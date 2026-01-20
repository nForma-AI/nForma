# Roadmap: v1.9.0 Codebase Intelligence System

**Goal:** Make GSD feel intelligent and automagical in how it navigates and understands both greenfield and brownfield projects.

**Phases:** 5 (4 complete)

---

## Current Milestone: v1.9.0

### Phase 1: Foundation & Learning ✓
**Goal:** Establish index schema and incremental learning via PostToolUse hook
**Status:** Complete
**Plans:** 2/2

### Phase 2: Context Injection ✓
**Goal:** Inject codebase awareness into every session via SessionStart hook
**Status:** Complete
**Plans:** 2/2

### Phase 3: Brownfield & Integration ✓
**Goal:** Deep analysis command for existing codebases, workflow integration
**Status:** Complete
**Plans:** 3/3

### Phase 4: Semantic Intelligence & Scale ✓
**Goal:** Transform syntax-only indexing into semantic understanding with graph-based relationships
**Status:** Complete
**Plans:** 5/5

Plans:
- [x] 04-01-PLAN.md — SQLite graph layer with sql.js (Wave 1)
- [x] 04-02-PLAN.md — Graph-backed rich summary generation (Wave 2)
- [x] 04-03-PLAN.md — Semantic entity generation via Claude API (Wave 2)
- [x] 04-04-PLAN.md — CLI query interface for getDependents (Wave 3)
- [x] 04-05-PLAN.md — Wire plan-phase.md to inject intel into planner (Wave 3)

**Wave Structure:**
- Wave 1: 04-01 (SQLite foundation)
- Wave 2: 04-02, 04-03 (parallel - both depend only on 04-01)
- Wave 3: 04-04, 04-05 (parallel - consumption layer)

**Why this phase:**
- Current system provides "2-3 ls commands worth of information" (Claude's own assessment)
- Missing: what files actually DO, who uses them, blast radius of changes
- Senior engineers at top companies need real intelligence, not file counts

**Delivers:**
- SQLite graph layer (sql.js - zero native deps) for relationship queries
- Entity-based semantic documentation (Claude writes understanding, not just syntax)
- Semantic `/gsd:analyze-codebase` that creates initial entities
- Rich summary generation from accumulated semantic knowledge
- CLI query interface for "what uses this file?" queries

**Requirements:**
- INTEL-04: Entity files capture semantic understanding (purpose, what exports do)
- INTEL-05: Relationships queryable ("what uses this file?", "blast radius")
- INTEL-06: `/gsd:analyze-codebase` creates initial entity docs via Claude
- INTEL-07: Summary reflects accumulated semantic knowledge

**Success Criteria:**
1. Claude can answer "what uses src/lib/db.ts?" from SessionStart context
2. Summary includes file purposes, not just file counts
3. Transitive dependency queries work (blast radius)
4. Works at scale (500+ file codebases)

### Phase 5: Subagent Codebase Analysis
**Goal:** Prevent context exhaustion on large codebases by delegating analysis to subagents
**Depends on:** Phase 4
**Plans:** 2 plans

Plans:
- [ ] 05-01-PLAN.md — Create gsd-entity-generator subagent (Wave 1)
- [ ] 05-02-PLAN.md — Refactor analyze-codebase to use subagent delegation (Wave 2)

**Wave Structure:**
- Wave 1: 05-01 (agent definition)
- Wave 2: 05-02 (command refactor + verification)

**Why this phase:**
- Current entity generation loads file contents in orchestrator context
- On large codebases (500+ files), orchestrator exhausts context during file selection and batching
- Subagent delegation gives fresh 200k context for entity generation

**Delivers:**
- `gsd-entity-generator` subagent following gsd-codebase-mapper pattern
- Refactored `/gsd:analyze-codebase` that spawns subagent instead of inline batching
- Preserved orchestrator context for large codebase analysis

**Requirements:**
- INTEL-08: Entity generation delegated to subagent (not inline)
- INTEL-09: Subagent writes entities directly, returns statistics only
- INTEL-10: Orchestrator passes file paths, not file contents

**Success Criteria:**
1. Entity generation works via subagent spawn
2. Orchestrator context preserved (no file contents loaded)
3. Entities correctly formatted and graph.db updated
4. Works on 500+ file codebases without context exhaustion

---

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| INTEL-01 | Phase 1 | ✓ Complete |
| INTEL-02 | Phase 2 | ✓ Complete |
| INTEL-03 | Phase 3 | ✓ Complete |
| INTEL-04 | Phase 4 | ✓ Complete (04-03) |
| INTEL-05 | Phase 4 | ✓ Complete (04-04) |
| INTEL-06 | Phase 4 | ✓ Complete (04-03) |
| INTEL-07 | Phase 4 | ✓ Complete (04-02) |
| INTEL-08 | Phase 5 | Planned (05-01, 05-02) |
| INTEL-09 | Phase 5 | Planned (05-01) |
| INTEL-10 | Phase 5 | Planned (05-02) |

---
*Created: 2026-01-19*
*Updated: 2026-01-20 — Phase 5 planned with 2 plans in 2 waves*
