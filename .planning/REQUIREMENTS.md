# Requirements: GSD Quick Mode

**Defined:** 2025-01-19
**Core Value:** Same guarantees, 50-70% fewer tokens for simple tasks

## v1 Requirements

### Command

- [ ] **CMD-01**: `/gsd:quick "description"` parses description from arguments
- [ ] **CMD-02**: Command errors if .planning/ROADMAP.md doesn't exist
- [ ] **CMD-03**: Command calculates next decimal phase from current phase in STATE.md
- [ ] **CMD-04**: Command creates phase directory `.planning/phases/{decimal}-{slug}/`
- [ ] **CMD-05**: Command inserts decimal phase entry in ROADMAP.md

### Execution

- [ ] **EXEC-01**: Command spawns gsd-planner (no researcher, no checker)
- [ ] **EXEC-02**: Command spawns gsd-executor for each plan created
- [ ] **EXEC-03**: Multiple plans execute in parallel waves (same as execute-phase)
- [ ] **EXEC-04**: Executor commits only files it edits/creates

### State

- [ ] **STATE-01**: STATE.md "Last activity" updated after completion
- [ ] **STATE-02**: STATE.md "Quick Tasks Completed" table created/updated
- [ ] **STATE-03**: ROADMAP.md decimal phase marked complete with date

### Resume

- [ ] **RESUME-01**: `/gsd:resume-work` parses decimal phase numbers (3.1, 3.2)
- [ ] **RESUME-02**: `/gsd:resume-work` finds decimal phase directories

### Docs

- [ ] **DOCS-01**: help.md lists `/gsd:quick` command
- [ ] **DOCS-02**: README.md includes quick mode section
- [ ] **DOCS-03**: GSD-STYLE.md documents quick mode patterns

## v2 Requirements

(None identified)

## Out of Scope

| Feature | Reason |
|---------|--------|
| `--plan-only` flag | MVP always executes |
| `--after N` flag | Always uses current phase |
| `--standalone` flag | Requires active project for state integrity |
| Node.js helper scripts | Claude handles decimal parsing inline |
| Git status warnings | Commits only its own files |
| Planner modifications | Orchestrator skips agents, planner unchanged |
| gsd-verifier | Verification skipped by design |
| Requirements mapping | Quick tasks are ad-hoc |
| `/gsd:squash-quick` | Future enhancement |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| CMD-01 | Phase 1 | Pending |
| CMD-02 | Phase 1 | Pending |
| CMD-03 | Phase 1 | Pending |
| CMD-04 | Phase 1 | Pending |
| CMD-05 | Phase 1 | Pending |
| EXEC-01 | Phase 1 | Pending |
| EXEC-02 | Phase 1 | Pending |
| EXEC-03 | Phase 1 | Pending |
| EXEC-04 | Phase 1 | Pending |
| STATE-01 | Phase 1 | Pending |
| STATE-02 | Phase 1 | Pending |
| STATE-03 | Phase 1 | Pending |
| RESUME-01 | Phase 2 | Pending |
| RESUME-02 | Phase 2 | Pending |
| DOCS-01 | Phase 3 | Pending |
| DOCS-02 | Phase 3 | Pending |
| DOCS-03 | Phase 3 | Pending |

**Coverage:**
- v1 requirements: 17 total
- Mapped to phases: 17
- Unmapped: 0

---
*Requirements defined: 2025-01-19*
*Last updated: 2025-01-19 after roadmap creation*
