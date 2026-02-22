# Roadmap: QGSD

## Milestones

- ✅ **v0.2 — Gap Closure & Activity Resume Routing** — Phases 1–17 (shipped 2026-02-21)
- 🚧 **v0.3 — Test Suite Maintenance Tool** — Phases 18–22 (in progress)
- ⏳ **v0.4 — MCP Ecosystem** — Phases 23–28 (pending v0.3 completion)

## Phases

<details>
<summary>✅ v0.2 — Gap Closure & Activity Resume Routing (Phases 1–17) — SHIPPED 2026-02-21</summary>

- [x] **Phase 1: Hook Enforcement** — Stop hook hard gate + UserPromptSubmit injection + meta quorum behavior (completed 2026-02-20)
- [x] **Phase 2: Config & MCP Detection** — User-editable config system with MCP auto-detection and fail-open behavior (completed 2026-02-20)
- [x] **Phase 3: Installer & Distribution** — npm installer that writes hooks to ~/.claude/settings.json and GSD version sync strategy (completed 2026-02-20)
- [x] **Phase 4: Narrow Quorum Scope** — Stop hook restricted to actual project decision turns via GUARD 5 (completed 2026-02-21)
- [x] **Phase 5: Fix GUARD 5 Delivery Gaps** — hooks/dist/ rebuilt + marker path propagated to installer users (completed 2026-02-21)
- [x] **Phase 6: Circuit Breaker Detection & State** — PreToolUse hook detects oscillation in git history and persists breaker state across invocations (completed 2026-02-21)
- [x] **Phase 7: Enforcement & Config Integration** — Bash execution blocked when breaker is active; circuit_breaker config block added to config-loader (completed 2026-02-21)
- [x] **Phase 8: Installer Integration** — Installer registers PreToolUse hook and writes default circuit_breaker config block idempotently (completed 2026-02-21)
- [x] **Phase 9: Verify Phases 5-6** — VERIFICATION.md for Phases 5 and 6; DETECT-01..05 and STATE-01..04 closed (completed 2026-02-21)
- [x] **Phase 10: Fix Bugs + Verify Phases 7-8** — Fix INST-08/RECV-01/INST-10 bugs + VERIFICATION.md for Phases 7 and 8 (completed 2026-02-21)
- [x] **Phase 11: Changelog & Build** — CHANGELOG [0.2.0] entry, hooks/dist/ rebuilt, npm test 141/141 (completed 2026-02-21)
- [x] **Phase 12: Version & Publish** — package.json 0.2.0, MILESTONES.md, git tag v0.2.0 pushed; npm publish deferred (completed 2026-02-21)
- [x] **Phase 13: Circuit Breaker Oscillation Resolution Mode** — Structured quorum resolution when breaker fires; unified solution approval gate (completed 2026-02-21)
- [x] **Phase 14: Activity Tracking** — current-activity.json sidecar + activity-set/clear/get CLI + resume-work 15-row routing table (completed 2026-02-21)
- [x] **Phase 15: v0.4 Gap Closure — Activity Resume Routing** — Fix ACT-02 schema violations + ACT-04 routing gaps (completed 2026-02-21)
- [x] **Phase 16: Verify Phase 15** — 15-VERIFICATION.md + ACT-02/ACT-04 traceability closed (completed 2026-02-21)
- [x] **Phase 17: Fix Agent Name Typos** — qqgsd-* → qgsd-* across 12 files (completed 2026-02-21)

**Archive:** `.planning/milestones/v0.2-ROADMAP.md`

</details>

### 🚧 v0.3 — Test Suite Maintenance Tool (In Progress)

**Milestone Goal:** Build `/qgsd:fix-tests` — a single command that discovers, batches, runs, AI-categorizes, and iteratively fixes test failures across large suites (20k+ tests). Fully autonomous.

- [x] **Phase 18: CLI Foundation** — gsd-tools.cjs maintain-tests sub-commands: discover, batch, run-batch + integration tests (4 plans) (completed 2026-02-22)
- [x] **Phase 19: State Schema & Activity Integration** — maintain-tests-state.json schema + resume-work routing rows (completed 2026-02-22)
- [x] **Phase 20: Workflow Orchestrator** — fix-tests.md command + orchestrator: batch loop, circuit breaker lifecycle, loop termination (completed 2026-02-22)
- [x] **Phase 21: Categorization Engine** — 5-category AI diagnosis, git pickaxe context, quick task dispatch grouping (completed 2026-02-22)
- [x] **Phase 22: Integration Test** — End-to-end validation of the full fix-tests loop (completed 2026-02-22)

### ⏳ v0.4 — MCP Ecosystem (Pending v0.3 Completion)

**Milestone Goal:** Standardize the 6 coding-agent MCP server repos to a unified Gen2 architecture, then build QGSD commands to observe, configure, and update connected agents.

- [x] **Phase 23: MCP Repo Surface Fixes** — openhands rename, dynamic versioning, MIT license, package.json metadata, Makefile, CHANGELOG/CLAUDE.md, npm scoping across all 6 repos (completed 2026-02-22)
- [x] **Phase 24: Gen1→Gen2 Architecture Port** — Per-tool *.tool.ts + registry.ts structure for claude/codex/copilot/openhands repos (completed 2026-02-22)
- [x] **Phase 25: Identity Tool & Shared Utilities** — identity tool + constants.ts + Logger utility in src/utils/logger.ts across all 6 repos (completed 2026-02-22)
- [x] **Phase 26: MCP Status Command** — /qgsd:mcp-status showing all agents, models, health state, and UNAVAIL counts (completed 2026-02-22)
- [x] **Phase 27: Model Switching** — /qgsd:mcp-set-model with qgsd.json persistence and quorum call injection (completed 2026-02-22)
- [ ] **Phase 28: Update & Restart Commands** — /qgsd:mcp-update (all install methods) + /qgsd:mcp-restart

## Phase Details

### Phase 18: CLI Foundation
**Goal**: Users can run the maintain-tests mechanical layer from the command line — discovery, batching, batch execution, and state I/O all work independently before any workflow logic exists
**Depends on**: Phase 17
**Requirements**: DISC-01, DISC-02, EXEC-01, EXEC-02, EXEC-04
**Success Criteria** (what must be TRUE):
  1. `gsd-tools.cjs maintain-tests discover` detects jest/playwright/pytest by reading project config files and invokes each framework's own CLI (jest --listTests, playwright --list, pytest --collect-only) to produce a deduplicated test list — never globs
  2. `gsd-tools.cjs maintain-tests batch` randomly shuffles the discovered test list and splits it into batches of the configured size (default 100), with the full batch manifest written to disk before any execution begins
  3. `gsd-tools.cjs maintain-tests run-batch` executes a single batch, captures output to a temp file via spawn (not in-memory buffering), and records pass/fail/skip per test
  4. Before AI categorization, each failing test is automatically re-run 3 times in isolation; tests that pass at least once are pre-classified as flaky and excluded from the categorization queue
  5. Unit tests pass for all sub-commands including monorepo fixture tests covering framework cross-discovery collision prevention
**Plans**:
  - 18-01: `maintain-tests discover` — config detection + framework CLI invocation + dedup (DISC-01, DISC-02) [Wave 1]
  - 18-02: `maintain-tests batch` — seeded Fisher-Yates shuffle + disk manifest (EXEC-01) [Wave 1]
  - 18-03: `maintain-tests run-batch` + 3-run flakiness pre-check — spawn file-based capture + timeout + env passthrough (EXEC-02, EXEC-04) [Wave 1]
  - 18-04: Integration tests — monorepo collision, parametrized pytest IDs, buffer overflow regression [Wave 2]

### Phase 19: State Schema & Activity Integration
**Goal**: The fix-tests workflow has a stable, version-correct state file schema and is reachable by `/qgsd:resume-work` — interrupted runs on 20k+ suites can be recovered to the exact interrupted step
**Depends on**: Phase 18
**Requirements**: EXEC-03, INTG-02
**Success Criteria** (what must be TRUE):
  1. `maintain-tests-state.json` is written to disk on first batch completion and updated after every subsequent batch, containing per-test state, batch progress, categorization results, and termination condition fields (iteration_count, last_unresolved_count, deferred_tests)
  2. Running `/qgsd:resume-work` after an interrupted maintain-tests session routes back to the exact interrupted step (discovery, batch N, categorization, quick task dispatch) using the activity sidecar and the extended resume-work routing table
  3. Node version is detected at startup; state persistence uses node:sqlite on Node >= 22.5.0 and JSON flat file as fallback; the fallback is explicit and does not silently fail
**Plans**: 2 plans
  - [ ] 19-01-PLAN.md — Runner bug fix + --batch-index flag + save-state/load-state commands + tests (EXEC-03) [Wave 1]
  - [ ] 19-02-PLAN.md — resume-project.md routing rows for 6 maintain_tests sub-activities (INTG-02) [Wave 1]

### Phase 20: Workflow Orchestrator
**Goal**: The `/qgsd:fix-tests` command exists and runs the complete batch loop with placeholder categorization — the full mechanical orchestration is validated before the high-risk categorization logic is added
**Depends on**: Phase 19
**Requirements**: ITER-01, ITER-02, INTG-01, INTG-03
**Success Criteria** (what must be TRUE):
  1. Typing `/qgsd:fix-tests` starts the full discovery → batch → execute → categorize → fix → iterate loop; a progress banner is printed after each batch completion
  2. The loop terminates cleanly on all three terminal conditions: all tests classified, no progress in last 5 batches (progress guard), or configurable iteration cap reached (default 5)
  3. The circuit breaker is disabled at fix-tests start (`npx qgsd --disable-breaker`) and re-enabled at completion or interruption (`npx qgsd --enable-breaker`) — verified by checking circuit-breaker-state.json before and after a run
  4. `/qgsd:fix-tests` is NOT listed in `quorum_commands` in any config file — confirmed by inspection of installed config and source; R2.1 compliance verified
**Plans**: 1 plan
  - [ ] 20-01-PLAN.md — fix-tests command stub + workflow orchestration + INTG-03 compliance verification (ITER-01, ITER-02, INTG-01, INTG-03) [Wave 1]

### Phase 21: Categorization Engine
**Goal**: Claude reliably classifies confirmed test failures into one of the 5 categories, provides git pickaxe context for adapt failures, and automatically dispatches grouped fix tasks — the full categorization → action pipeline is end-to-end functional
**Depends on**: Phase 20
**Requirements**: CATG-01, CATG-02, CATG-03
**Success Criteria** (what must be TRUE):
  1. Each confirmed failure (passed the 3-run flakiness check) is classified into exactly one of: valid-skip, adapt, isolate, real-bug, or fixture; no failure exits categorization unclassified except via the `deferred` convergence category
  2. For every `adapt`-classified failure, the categorization output includes git pickaxe context (`git log -S`) linking the failing test to the commit that changed the code under test
  3. `adapt`, `fixture`, and `isolate` failures are automatically grouped by category, error type, and directory — then dispatched as `/qgsd:quick` tasks (max 20 tests per task); `real-bug` failures are collected into a deferred user report and never auto-actioned
  4. The categorization prompt includes the full source of the failing test and the top-2 stack trace source files; categorizations with context_score < 2 are not auto-actioned
**Plans**: 2 plans
  - [ ] 21-01-PLAN.md — Context assembly + 5-category inline classification + git pickaxe for adapt + state schema extensions (CATG-01, CATG-02) [Wave 1]
  - [ ] 21-02-PLAN.md — Grouping algorithm + Task dispatch + deferred user report in terminal summary (CATG-03) [Wave 2]

### Phase 22: Integration Test
**Goal**: The full `/qgsd:fix-tests` loop is validated end-to-end against a real or fixture test suite — all integration edge cases are verified and a VERIFICATION.md confirms the v0.3 milestone is shippable
**Depends on**: Phase 21
**Requirements**: (validates DISC-01, DISC-02, EXEC-01, EXEC-02, EXEC-03, EXEC-04, CATG-01, CATG-02, CATG-03, ITER-01, ITER-02, INTG-01, INTG-02, INTG-03 end-to-end)
**Success Criteria** (what must be TRUE):
  1. Running `/qgsd:fix-tests` on a fixture project with controllable failures produces a complete loop: discovery → batching → execution → flakiness pre-check → categorization → action dispatch → loop termination
  2. Interrupting a run mid-batch and resuming via `/qgsd:resume-work` continues from the correct step with no data loss or duplicate batch execution
  3. The circuit breaker does not trigger during a legitimate fix-tests run that produces multiple iterative fix commits
  4. A VERIFICATION.md for Phases 18–21 documents all 14 v0.3 requirements as verified with evidence
**Plans**: TBD

### Phase 23: MCP Repo Surface Fixes
**Goal**: All 6 MCP server repos have correct identity metadata, licenses, package.json configuration, Makefile, CHANGELOG/CLAUDE.md, and consistent npm scoping — the openhands rename is corrected and every repo reads its version dynamically
**Depends on**: Phase 22
**Requirements**: STD-01, STD-03, STD-05, STD-06, STD-07, STD-09, STD-10
**Success Criteria** (what must be TRUE):
  1. openhands-mcp-server package.json `name`, class names, and server config all read `openhands-mcp-server` — no remaining references to `codex-mcp-server` in that repo
  2. All 6 repos read their version string from `package.json` at runtime — `index.ts` contains no hardcoded version string
  3. All 6 repos have a `LICENSE` file containing MIT license text with the correct author
  4. All 6 repos have `engines: {node: ">=18"}`, a `prepublishOnly` build script, and `publishConfig: {access: "public"}` in package.json
  5. All 6 repos have a Makefile with at least lint, format, test, build, clean, and dev targets; all 6 repos have CHANGELOG.md and CLAUDE.md present; npm scoping is uniform across all 6 repos (all `@tuannvm/` or all unscoped — not mixed)
**Plans**: 3 plans
  - [ ] 23-01-PLAN.md — openhands rename + dynamic version (claude/codex/copilot/openhands) + openhands metadata (STD-01, STD-03) [Wave 1]
  - [ ] 23-02-PLAN.md — Gen1 package.json metadata (claude/codex/copilot) + gemini unscoping + MIT LICENSE all 6 repos (STD-05, STD-06, STD-10) [Wave 1]
  - [ ] 23-03-PLAN.md — Full Makefile for 4 Gen1 repos + CHANGELOG.md/CLAUDE.md for missing repos (STD-07, STD-09) [Wave 1]

### Phase 24: Gen1 to Gen2 Architecture Port
**Goal**: The 4 Gen1 MCP server repos (claude, codex, copilot, openhands) use the Gen2 per-tool file architecture — each tool lives in its own `*.tool.ts` file and is wired through a `registry.ts`, matching the gemini and opencode repos
**Depends on**: Phase 23
**Requirements**: STD-02
**Success Criteria** (what must be TRUE):
  1. claude-mcp-server, codex-mcp-server, copilot-mcp-server, and openhands-mcp-server each have a `src/tools/` directory containing individual `*.tool.ts` files — no monolithic tool file remains
  2. Each of the 4 repos has a `src/tools/registry.ts` that wires all tool files into the MCP server — adding a new tool requires only creating a new `*.tool.ts` and registering it in index.ts
  3. `npm run build` succeeds in all 4 repos after the port; existing tool behaviors are preserved (tools respond correctly to the same inputs as before the port)
**Plans**: 4 plans
  - [ ] 24-01-PLAN.md — claude-mcp-server Gen2 port: registry.ts + per-tool files + session singleton + server.ts dispatch + tests (STD-02) [Wave 1]
  - [ ] 24-02-PLAN.md — codex-mcp-server Gen2 port: registry.ts + per-tool files + session singleton + server.ts dispatch + tests (STD-02) [Wave 1]
  - [ ] 24-03-PLAN.md — copilot-mcp-server Gen2 port: registry.ts + per-tool files + copilotExecutor helper + server.ts dispatch + tests (STD-02) [Wave 1]
  - [ ] 24-04-PLAN.md — openhands-mcp-server Gen2 port: registry.ts + per-tool files + server.ts dispatch + tests (STD-02) [Wave 1]

### Phase 25: Identity Tool and Shared Utilities
**Goal**: All 6 MCP server repos expose a consistent `identity` tool and share the same `constants.ts` and `Logger` utility structure — the identity tool response is the data source for the mcp-status command in the next phase
**Depends on**: Phase 24
**Requirements**: STD-04, STD-08
**Success Criteria** (what must be TRUE):
  1. All 6 repos expose an `identity` MCP tool that returns `{name, version, model, available_models, install_method}` — calling the tool via Claude returns all 5 fields with non-empty values
  2. All 6 repos have `src/constants.ts` defining at least the server name and default model constants — no magic strings for these values remain in `index.ts` or tool files
  3. All 6 repos have `src/utils/logger.ts` providing a `Logger` utility used for structured log output — direct `console.log` calls for operational output are replaced with Logger calls
**Plans**: 3 plans
  - [ ] 25-01-PLAN.md — constants.ts for 4 Gen1-ported repos (claude, codex, copilot, openhands) + SERVER_NAME in gemini/opencode if missing (STD-08 partial) [Wave 1]
  - [ ] 25-02-PLAN.md — logger.ts for 4 Gen1-ported repos + console.log replacement (STD-08 completion) [Wave 2]
  - [ ] 25-03-PLAN.md — identity tool for all 6 repos: create (claude, openhands) + schema update (codex, copilot, gemini, opencode) (STD-04) [Wave 2]

### Phase 26: MCP Status Command
**Goal**: Users can run `/qgsd:mcp-status` from any project and see a formatted table of all connected MCP agents with their name, version, model, health state, available models, and recent UNAVAIL count
**Depends on**: Phase 25
**Requirements**: OBS-01, OBS-02, OBS-03, OBS-04
**Success Criteria** (what must be TRUE):
  1. Typing `/qgsd:mcp-status` in any Claude Code session produces a formatted display listing every configured quorum agent with name, current version, and current model
  2. The status display shows each agent's health state (available / quota-exceeded / error) derived from the quorum scoreboard file — an agent that has logged quota errors in the scoreboard shows `quota-exceeded`, not `available`
  3. The status display shows the `available_models` list for each agent, sourced from the `identity` tool response — the list reflects what the running MCP server reports, not a hardcoded config value
  4. The status display shows a per-agent UNAVAIL count from the quorum scoreboard — the count matches the number of failed quorum attempts recorded for that agent
**Plans**: 1 plan
  - [ ] 26-01-PLAN.md — mcp-status command: identity polling for all 10 agents, scoreboard UNAVAIL counts, health state derivation, formatted table (OBS-01, OBS-02, OBS-03, OBS-04) [Wave 1]

### Phase 27: Model Switching
**Goal**: Users can change the default model for any quorum worker and have that preference persist across sessions — the next quorum call uses the new model without any manual config editing
**Depends on**: Phase 26
**Requirements**: MGR-01, MGR-02
**Success Criteria** (what must be TRUE):
  1. Running `/qgsd:mcp-set-model <agent> <model>` with a valid agent name and model name completes without error and prints a confirmation showing the agent, old model, and new model
  2. After running `/qgsd:mcp-set-model`, the `qgsd.json` file (global or project, as appropriate) contains the updated model preference for that agent — inspecting the file confirms the value changed
  3. The next quorum invocation after a model switch injects the new model value into the tool call for that agent — verified by inspecting the quorum instructions injected by the UserPromptSubmit hook
  4. Running `/qgsd:mcp-set-model` with an unrecognized agent name or a model not in the agent's `available_models` list produces a clear error message — it does not silently write an invalid value
**Plans**: 2 plans
  - [ ] 27-01-PLAN.md — config-loader model_preferences key + qgsd-prompt override injection + hooks/dist sync (MGR-02) [Wave 1]
  - [ ] 27-02-PLAN.md — mcp-set-model.md slash command: agent validation, identity validation, qgsd.json write, install (MGR-01) [Wave 1]

### Phase 28: Update and Restart Commands
**Goal**: Users can update any MCP server to its latest version using the correct install-method-aware command, update all agents in one command, and restart a specific server process — without knowing the install method or process ID
**Depends on**: Phase 27
**Requirements**: MGR-03, MGR-04, MGR-05, MGR-06
**Success Criteria** (what must be TRUE):
  1. Running `/qgsd:mcp-update <agent>` detects the install method (npm global / brew / pipx / binary) for that agent and runs the correct update command — the detection is derived from the `install_method` field returned by the agent's `identity` tool
  2. Running `/qgsd:mcp-update all` updates all configured agents sequentially, printing per-agent status (updated / already-latest / error) as each completes
  3. Running `/qgsd:mcp-restart <agent>` terminates the named MCP server process and signals Claude Code to reconnect to it — the agent becomes reachable again after restart without restarting the full Claude Code session
  4. All three commands (`mcp-update <agent>`, `mcp-update all`, `mcp-restart`) produce actionable error output when the agent is unrecognized, the update command fails, or the process cannot be found — they never fail silently
**Plans**: TBD

## Progress

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 1. Hook Enforcement | v0.2 | 6/6 | Complete | 2026-02-20 |
| 2. Config & MCP Detection | v0.2 | 4/4 | Complete | 2026-02-20 |
| 3. Installer & Distribution | v0.2 | 3/3 | Complete | 2026-02-20 |
| 4. Narrow Quorum Scope | v0.2 | 2/2 | Complete | 2026-02-21 |
| 5. Fix GUARD 5 Delivery Gaps | v0.2 | 1/1 | Complete | 2026-02-21 |
| 6. Circuit Breaker Detection & State | v0.2 | 1/1 | Complete | 2026-02-21 |
| 7. Enforcement & Config Integration | v0.2 | 2/2 | Complete | 2026-02-21 |
| 8. Installer Integration | v0.2 | 1/1 | Complete | 2026-02-21 |
| 9. Verify Phases 5-6 | v0.2 | 3/3 | Complete | 2026-02-21 |
| 10. Fix Bugs + Verify Phases 7-8 | v0.2 | 4/4 | Complete | 2026-02-21 |
| 11. Changelog & Build | v0.2 | 2/2 | Complete | 2026-02-21 |
| 12. Version & Publish | v0.2 | 2/2 | Complete (RLS-04 deferred) | 2026-02-21 |
| 13. Circuit Breaker Oscillation Resolution Mode | v0.2 | 2/2 | Complete | 2026-02-21 |
| 14. Activity Tracking | v0.2 | 4/4 | Complete | 2026-02-21 |
| 15. v0.4 Gap Closure — Activity Resume Routing | v0.2 | 1/1 | Complete | 2026-02-21 |
| 16. Verify Phase 15 | v0.2 | 1/1 | Complete | 2026-02-21 |
| 17. Fix Agent Name Typos | v0.2 | 1/1 | Complete | 2026-02-21 |
| 18. CLI Foundation | v0.3 | 4/4 | Complete | 2026-02-22 |
| 19. State Schema & Activity Integration | v0.3 | 2/2 | Complete | 2026-02-22 |
| 20. Workflow Orchestrator | 1/1 | Complete    | 2026-02-22 | - |
| 21. Categorization Engine | 2/2 | Complete    | 2026-02-22 | - |
| 22. Integration Test | 2/2 | Complete    | 2026-02-22 | 2026-02-22 |
| 23. MCP Repo Surface Fixes | v0.4 | 3/3 | Complete | 2026-02-22 |
| 24. Gen1 to Gen2 Architecture Port | v0.4 | 0/4 | Not started | - |
| 25. Identity Tool and Shared Utilities | 3/3 | Complete    | 2026-02-22 | - |
| 26. MCP Status Command | 1/1 | Complete    | 2026-02-22 | - |
| 27. Model Switching | v0.4 | Complete    | 2026-02-22 | - |
| 28. Update and Restart Commands | v0.4 | 0/? | Not started | - |
