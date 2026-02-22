# Requirements: QGSD

**Defined:** 2026-02-22
**Core Value:** Planning decisions are multi-model verified by structural enforcement, not instruction-following — a Stop hook that reads the transcript makes it impossible for Claude to skip quorum.

## v0.3 Requirements

### Discovery

- [x] **DISC-01**: User can run `/qgsd:fix-tests` and have the tool auto-detect jest, playwright, and pytest by reading project config files (jest.config.*, playwright.config.*, pytest.ini/pyproject.toml)
- [x] **DISC-02**: Tool uses each framework's own CLI as the authoritative test source (jest --listTests, playwright --list, pytest --collect-only) — never file system globs

### Execution

- [x] **EXEC-01**: Tool randomly shuffles all discovered tests and splits them into batches of 100 (batch size configurable via `.claude/qgsd.json`)
- [x] **EXEC-02**: Tool executes each batch, captures JSON-formatted output, and records pass/fail/skip status per test
- [ ] **EXEC-03**: Tool persists batch progress to a local state file so interrupted runs on 20,000+ test suites can resume from the last completed batch
- [x] **EXEC-04**: Tool runs each failing test 3 times before AI categorization to detect flakiness (eliminates false positives from non-convergent loops)

### Categorization

- [ ] **CATG-01**: Claude classifies each confirmed failure into one of 5 categories: `valid-skip` / `adapt` / `isolate` / `real-bug` / `fixture`
- [ ] **CATG-02**: For `adapt`-categorized failures, tool provides git pickaxe context (`git log -S`) linking the failing test to the commit that changed the code under test
- [ ] **CATG-03**: `adapt`, `fixture`, and `isolate` classifications automatically trigger a `/qgsd:quick` fix task; `real-bug` failures go to a deferred user report

### Iteration

- [ ] **ITER-01**: Tool iterates through remaining uncategorized/unactioned tests continuously until terminal state is reached
- [ ] **ITER-02**: Loop terminates when: all tests classified, no progress in last 5 batches, or configurable iteration cap reached

### Integration

- [ ] **INTG-01**: Tool disables QGSD circuit breaker at run start and re-enables on completion (prevent false oscillation detection during iterative fix commits)
- [ ] **INTG-02**: Tool activity state integrates with `/qgsd:resume-work` routing so interrupted maintenance runs recover to the correct step
- [ ] **INTG-03**: `/qgsd:fix-tests` is implemented as execution-only — not added to `quorum_commands` (R2.1 compliance)

## v0.4 Requirements — MCP Ecosystem

**Defined:** 2026-02-22
**Goal:** Standardize the 6 coding-agent MCP server repos to a unified Gen2 architecture, then build a QGSD management layer that can observe, configure, and update connected agents.

### MCP Standardization (STD)

- [ ] **STD-01**: openhands-mcp-server package.json name, class name, and server config are corrected to `openhands-mcp-server` (currently all say `codex-mcp-server`)
- [ ] **STD-02**: All 4 Gen1 repos (claude, codex, copilot, openhands) use Gen2 per-tool `*.tool.ts` + `registry.ts` architecture
- [ ] **STD-03**: All 6 repos read version dynamically from `package.json` (no hardcoded string in `index.ts`)
- [ ] **STD-04**: All 6 repos expose an `identity` tool returning `{name, version, model, available_models, install_method}`
- [ ] **STD-05**: All 6 repos use MIT license with a `LICENSE` file present
- [ ] **STD-06**: All 6 repos have `engines: node>=18`, `prepublishOnly` build script, `publishConfig: {access: public}`
- [ ] **STD-07**: All 6 repos have a comprehensive Makefile with lint/format/test/build/clean/dev targets
- [ ] **STD-08**: All 6 repos have `constants.ts` and a `Logger` utility in `src/utils/logger.ts`
- [ ] **STD-09**: All 6 repos have `CHANGELOG.md` and `CLAUDE.md`
- [ ] **STD-10**: All 6 repos use consistent npm scoping (uniform: all `@tuannvm/` or all unscoped)

### MCP Observation (OBS)

- [ ] **OBS-01**: User can run `/qgsd:mcp-status` to see all connected MCPs with name, version, current model, and availability
- [ ] **OBS-02**: Status display shows health state (available / quota-exceeded / error) derived from scoreboard data
- [ ] **OBS-03**: Status shows available models for each agent (from `identity` tool response)
- [ ] **OBS-04**: Status shows recent UNAVAIL count per agent from quorum scoreboard

### MCP Management (MGR)

- [ ] **MGR-01**: User can run `/qgsd:mcp-set-model <agent> <model>` to set the default model for a quorum worker
- [ ] **MGR-02**: Default model preference persists in `qgsd.json` and is injected into subsequent quorum tool calls
- [ ] **MGR-03**: User can run `/qgsd:mcp-update <agent>` to auto-detect installation method and run the correct update command
- [ ] **MGR-04**: `/qgsd:mcp-update` detects npm global / brew / pipx / binary and runs appropriate update command
- [ ] **MGR-05**: User can run `/qgsd:mcp-update all` to update all agents sequentially
- [ ] **MGR-06**: User can run `/qgsd:mcp-restart <agent>` to restart a specific MCP server process

## v0.5 Requirements (Deferred)

- Multi-framework mixed batching (jest + playwright in same batch) — adds CLI-switching complexity
- CI/scheduled maintenance runs — periodic automated maintenance
- Per-test ownership tracking — link tests to code owners for routing fix tasks
- Actual OpenHands CLI integration in openhands-mcp-server (CLI to wrap is unclear)
- Model benchmark comparison (`/qgsd:mcp-benchmark`)
- Version rollback (`/qgsd:mcp-rollback`)

## Out of Scope

| Feature | Reason |
|---------|--------|
| Installing test plugins in target projects | Non-invasive observer model — QGSD doesn't modify target codebases |
| Concurrent batch execution | Sequential by design — test runners parallelize internally, outer concurrency counterproductive |
| Auto-fixing real-bug failures | Safety boundary — source changes require user approval |
| Real-time MCP metrics dashboard | UI complexity — v0.x is CLI-only |
| Per-project MCP configurations | Global-only install pattern; per-project adds auth complexity |
| Automatic model switching based on task type | Requires categorization engine (v0.3 Phase 21 prerequisite) |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| DISC-01 | Phase 18 | Complete |
| DISC-02 | Phase 18 | Complete |
| EXEC-01 | Phase 18 | Complete |
| EXEC-02 | Phase 18 | Complete |
| EXEC-04 | Phase 18 | Complete |
| EXEC-03 | Phase 19 | Pending |
| INTG-02 | Phase 19 | Pending |
| ITER-01 | Phase 20 | Pending |
| ITER-02 | Phase 20 | Pending |
| INTG-01 | Phase 20 | Pending |
| INTG-03 | Phase 20 | Pending |
| CATG-01 | Phase 21 | Pending |
| CATG-02 | Phase 21 | Pending |
| CATG-03 | Phase 21 | Pending |

**v0.3 Coverage:**
- v0.3 requirements: 14 total
- Mapped to phases: 14
- Unmapped: 0 ✓

**v0.4 Coverage:**
- v0.4 requirements: 16 total (STD: 10, OBS: 4, MGR: 6 — minus STD-10 merged into STD phases)
- Mapped to phases: TBD (roadmapper pending)
- Unmapped: 16 ⚠️ (roadmap not yet created)

---
*Requirements defined: 2026-02-22*
*Last updated: 2026-02-22 — v0.4 MCP Ecosystem requirements added (STD/OBS/MGR)*
