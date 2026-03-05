# Roadmap Template

Template for `.planning/ROADMAP.md`.

## Initial Roadmap (v1.0 Greenfield)

```markdown
# Roadmap: [Project Name]

## Overview

[One paragraph describing the journey from start to finish]

## Phases

**Phase Numbering:**
- Milestone-scoped phases (v1.0-01, v1.0-02): Phases scoped to their milestone — PREFERRED for all new projects
- Decimal phases (v1.0-01.1, v1.0-02.1): Urgent gap insertions within a milestone (marked INSERTED)
- Legacy integer phases (1, 2, 3): Global sequential numbering — supported for backward compat only

Milestone-scoped IDs prevent two failure modes:
- Parallel milestone work: v1.0-01 and v1.1-01 never collide
- Mid-milestone gap insertion: v1.0-01.1 inserts without renumbering v1.0-02
- Format: v{major}.{minor}-{NN} where NN resets to 01 each milestone

- [ ] **Phase v1.0-01: [Name]** - [One-line description]
- [ ] **Phase v1.0-02: [Name]** - [One-line description]
- [ ] **Phase v1.0-03: [Name]** - [One-line description]
- [ ] **Phase v1.0-04: [Name]** - [One-line description]

## Phase Details

### Phase v1.0-01: [Name]
**Goal**: [What this phase delivers]
**Depends on**: Nothing (first phase)
**Requirements**: [REQ-01, REQ-02, REQ-03]  <!-- brackets optional, parser handles both formats -->
**Success Criteria** (what must be TRUE):
  1. [Observable behavior from user perspective]
  2. [Observable behavior from user perspective]
  3. [Observable behavior from user perspective]
**Plans**: [Number of plans, e.g., "3 plans" or "TBD"]

Plans:
- [ ] v1.0-01-01: [Brief description of first plan]
- [ ] v1.0-01-02: [Brief description of second plan]
- [ ] v1.0-01-03: [Brief description of third plan]

### Phase v1.0-02: [Name]
**Goal**: [What this phase delivers]
**Depends on**: Phase v1.0-01
**Requirements**: [REQ-04, REQ-05]
**Success Criteria** (what must be TRUE):
  1. [Observable behavior from user perspective]
  2. [Observable behavior from user perspective]
**Plans**: [Number of plans]

Plans:
- [ ] v1.0-02-01: [Brief description]
- [ ] v1.0-02-02: [Brief description]

### Phase v1.0-02.1: Critical Fix (INSERTED)
**Goal**: [Urgent work inserted between phases]
**Depends on**: Phase v1.0-02
**Success Criteria** (what must be TRUE):
  1. [What the fix achieves]
**Plans**: 1 plan

Plans:
- [ ] v1.0-02.1-01: [Description]

### Phase v1.0-03: [Name]
**Goal**: [What this phase delivers]
**Depends on**: Phase v1.0-02
**Requirements**: [REQ-06, REQ-07, REQ-08]
**Success Criteria** (what must be TRUE):
  1. [Observable behavior from user perspective]
  2. [Observable behavior from user perspective]
  3. [Observable behavior from user perspective]
**Plans**: [Number of plans]

Plans:
- [ ] v1.0-03-01: [Brief description]
- [ ] v1.0-03-02: [Brief description]

### Phase v1.0-04: [Name]
**Goal**: [What this phase delivers]
**Depends on**: Phase v1.0-03
**Requirements**: [REQ-09, REQ-10]
**Success Criteria** (what must be TRUE):
  1. [Observable behavior from user perspective]
  2. [Observable behavior from user perspective]
**Plans**: [Number of plans]

Plans:
- [ ] v1.0-04-01: [Brief description]

## Progress

**Execution Order:**
Phases execute in milestone-then-sequence order: v1.0-01 → v1.0-01.1 → v1.0-02 → v1.0-02.1 → v1.0-03

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| v1.0-01. [Name] | 0/3 | Not started | - |
| v1.0-02. [Name] | 0/2 | Not started | - |
| v1.0-03. [Name] | 0/2 | Not started | - |
| v1.0-04. [Name] | 0/1 | Not started | - |
```

<guidelines>
**Initial planning (v1.0):**
- Phase count depends on depth setting (quick: 3-5, standard: 5-8, comprehensive: 8-12)
- Each phase delivers something coherent
- Phases can have 1+ plans (split if >3 tasks or multiple subsystems)
- Plans use naming: {phase}-{plan}-PLAN.md (e.g., v1.0-01-02-PLAN.md)
- No time estimates (this isn't enterprise PM)
- Progress table updated by execute workflow
- Plan count can be "TBD" initially, refined during planning

**Success criteria:**
- 2-5 observable behaviors per phase (from user's perspective)
- Cross-checked against requirements during roadmap creation
- Flow downstream to `must_haves` in plan-phase
- Verified by verify-phase after execution
- Format: "User can [action]" or "[Thing] works/exists"

**After milestones ship:**
- Collapse completed milestones in `<details>` tags
- Add new milestone sections for upcoming work
- Milestone-scoped numbering resets per milestone: v1.0 uses v1.0-01/02, v1.1 uses v1.1-01/02
</guidelines>

<status_values>
- `Not started` - Haven't begun
- `In progress` - Currently working
- `Complete` - Done (add completion date)
- `Deferred` - Pushed to later (with reason)
</status_values>

## Milestone-Grouped Roadmap (After v1.0 Ships)

After completing first milestone, reorganize with milestone groupings:

```markdown
# Roadmap: [Project Name]

## Milestones

- ✅ **v1.0 MVP** - Phases 1-4 (shipped YYYY-MM-DD)
- 🚧 **v1.1 [Name]** - Phases 5-6 (in progress)
- 📋 **v2.0 [Name]** - Phases 7-10 (planned)

## Phases

<details>
<summary>✅ v1.0 MVP (Phases 1-4) - SHIPPED YYYY-MM-DD</summary>

### Phase 1: [Name]
**Goal**: [What this phase delivers]
**Plans**: 3 plans

Plans:
- [x] 01-01: [Brief description]
- [x] 01-02: [Brief description]
- [x] 01-03: [Brief description]

[... remaining v1.0 phases ...]

</details>

### 🚧 v1.1 [Name] (In Progress)

**Milestone Goal:** [What v1.1 delivers]

#### Phase 5: [Name]
**Goal**: [What this phase delivers]
**Depends on**: Phase 4
**Plans**: 2 plans

Plans:
- [ ] 05-01: [Brief description]
- [ ] 05-02: [Brief description]

[... remaining v1.1 phases ...]

### 📋 v2.0 [Name] (Planned)

**Milestone Goal:** [What v2.0 delivers]

[... v2.0 phases ...]

## Progress

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 1. Foundation | v1.0 | 3/3 | Complete | YYYY-MM-DD |
| 2. Features | v1.0 | 2/2 | Complete | YYYY-MM-DD |
| 5. Security | v1.1 | 0/2 | Not started | - |
```

**Notes:**
- Milestone emoji: ✅ shipped, 🚧 in progress, 📋 planned
- Completed milestones collapsed in `<details>` for readability
- Current/future milestones expanded
- Continuous phase numbering (01-99)
- Progress table includes milestone column
