# Roadmap: GSD Quick Mode

## Overview

Quick mode adds a fast-path command (`/gsd:quick`) that executes small tasks with full GSD guarantees (atomic commits, STATE.md tracking, ROADMAP.md integration) but skips optional verification agents. The roadmap delivers the command, integrates it with resume-work, and documents the feature.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

- [ ] **Phase 1: Core Command** - Complete `/gsd:quick` command end-to-end
- [ ] **Phase 2: Resume Integration** - Update `/gsd:resume-work` for decimal phases
- [ ] **Phase 3: Documentation** - Update help.md, README.md, and GSD-STYLE.md

## Phase Details

### Phase 1: Core Command
**Goal**: User can run `/gsd:quick "description"` and have it execute with full state tracking
**Depends on**: Nothing (first phase)
**Requirements**: CMD-01, CMD-02, CMD-03, CMD-04, CMD-05, EXEC-01, EXEC-02, EXEC-03, EXEC-04, STATE-01, STATE-02, STATE-03
**Success Criteria** (what must be TRUE):
  1. User can run `/gsd:quick "fix button spacing"` and it parses the description
  2. Command fails with clear error if no ROADMAP.md exists
  3. Decimal phase directory created (e.g., `.planning/phases/1.1-fix-button-spacing/`)
  4. ROADMAP.md contains new decimal phase entry after command completes
  5. STATE.md "Last activity" and "Quick Tasks Completed" table updated after execution
**Plans**: TBD

Plans:
- [ ] 01-01: TBD

### Phase 2: Resume Integration
**Goal**: User can resume failed quick tasks using existing `/gsd:resume-work`
**Depends on**: Phase 1
**Requirements**: RESUME-01, RESUME-02
**Success Criteria** (what must be TRUE):
  1. `/gsd:resume-work` correctly parses decimal phase numbers (3.1, 3.2)
  2. `/gsd:resume-work` finds and resumes decimal phase directories
**Plans**: TBD

Plans:
- [ ] 02-01: TBD

### Phase 3: Documentation
**Goal**: Quick mode is documented in all relevant locations
**Depends on**: Phase 2
**Requirements**: DOCS-01, DOCS-02, DOCS-03
**Success Criteria** (what must be TRUE):
  1. help.md lists `/gsd:quick` with usage and description
  2. README.md includes quick mode section explaining when to use it
  3. GSD-STYLE.md documents quick mode patterns
**Plans**: TBD

Plans:
- [ ] 03-01: TBD

## Progress

**Execution Order:**
Phases execute in numeric order: 1 -> 2 -> 3

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Core Command | 0/? | Not started | - |
| 2. Resume Integration | 0/? | Not started | - |
| 3. Documentation | 0/? | Not started | - |
