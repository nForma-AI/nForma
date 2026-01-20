# Roadmap: v1.9.0 Codebase Intelligence System

**Goal:** Make GSD feel intelligent and automagical in how it navigates and understands both greenfield and brownfield projects.

**Phases:** 4 (3 complete, 1 remaining)

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

### Phase 4: Semantic Intelligence & Scale
**Goal:** Transform syntax-only indexing into semantic understanding with graph-based relationships

**Depends on:** Phase 3
**Plans:** 4 plans (3 core + 1 gap closure)

Plans:
- [x] 04-01-PLAN.md — SQLite graph layer with sql.js (Wave 1)
- [x] 04-02-PLAN.md — Graph-backed rich summary generation (Wave 2)
- [x] 04-03-PLAN.md — Semantic entity generation via Claude API (Wave 2)
- [ ] 04-04-PLAN.md — CLI query interface for getDependents (Gap closure)

**Wave Structure:**
- Wave 1: 04-01 (SQLite foundation)
- Wave 2: 04-02, 04-03 (parallel - both depend only on 04-01)
- Gap closure: 04-04 (expose orphaned getDependents function)

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

---

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| INTEL-01 | Phase 1 | ✓ Complete |
| INTEL-02 | Phase 2 | ✓ Complete |
| INTEL-03 | Phase 3 | ✓ Complete |
| INTEL-04 | Phase 4 | ✓ Complete (04-03) |
| INTEL-05 | Phase 4 | Gap closure (04-04) |
| INTEL-06 | Phase 4 | ✓ Complete (04-03) |
| INTEL-07 | Phase 4 | ✓ Complete (04-02) |

---
*Created: 2026-01-19*
*Updated: 2026-01-20 — Added 04-04 gap closure plan for CLI query interface*
