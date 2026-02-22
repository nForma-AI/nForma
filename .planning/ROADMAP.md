# Roadmap: QGSD

## Milestones

- ✅ **v0.2 — Gap Closure & Activity Resume Routing** — Phases 1–17 (shipped 2026-02-21)
- ✅ **v0.3 — Test Suite Maintenance Tool** — Phases 18–22 (shipped 2026-02-22)
- 🚧 **v0.4 — MCP Ecosystem** — Phases 23–31 (in progress, gap closure phases 29–31 added)
- ⏳ **v0.5 — MCP Setup Wizard** — Phases 32–36 (pending v0.4 completion)

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

<details>
<summary>✅ v0.3 — Test Suite Maintenance Tool (Phases 18–22) — SHIPPED 2026-02-22</summary>

- [x] **Phase 18: CLI Foundation** — gsd-tools.cjs maintain-tests sub-commands: discover, batch, run-batch + integration tests (completed 2026-02-22)
- [x] **Phase 19: State Schema & Activity Integration** — maintain-tests-state.json schema + resume-work routing rows (completed 2026-02-22)
- [x] **Phase 20: Workflow Orchestrator** — fix-tests.md command + orchestrator: batch loop, circuit breaker lifecycle, loop termination (completed 2026-02-22)
- [x] **Phase 21: Categorization Engine** — 5-category AI diagnosis, git pickaxe context, quick task dispatch grouping (completed 2026-02-22)
- [x] **Phase 22: Integration Test** — End-to-end validation of the full fix-tests loop (completed 2026-02-22)

</details>

### 🚧 v0.4 — MCP Ecosystem (In Progress)

**Milestone Goal:** Standardize the 6 coding-agent MCP server repos to a unified Gen2 architecture, then build QGSD commands to observe, configure, and update connected agents. Gap closure phases 29–31 close outstanding v0.4 audit findings.

- [x] **Phase 23: MCP Repo Surface Fixes** — openhands rename, dynamic versioning, MIT license, package.json metadata, Makefile, CHANGELOG/CLAUDE.md, npm scoping across all 6 repos (completed 2026-02-22)
- [x] **Phase 24: Gen1→Gen2 Architecture Port** — Per-tool *.tool.ts + registry.ts structure for claude/codex/copilot/openhands repos (completed 2026-02-22)
- [x] **Phase 25: Identity Tool & Shared Utilities** — identity tool + constants.ts + Logger utility in src/utils/logger.ts across all 6 repos (completed 2026-02-22)
- [x] **Phase 26: MCP Status Command** — /qgsd:mcp-status showing all agents, models, health state, and UNAVAIL counts (completed 2026-02-22)
- [x] **Phase 27: Model Switching** — /qgsd:mcp-set-model with qgsd.json persistence and quorum call injection (completed 2026-02-22)
- [x] **Phase 28: Update & Restart Commands** — /qgsd:mcp-update (all install methods) + /qgsd:mcp-restart (completed 2026-02-22)
- [x] **Phase 29: Restore mcp-status v2 + Requirements Checkbox Cleanup** — Restore v2 mcp-status.md (regression fix) + mark OBS-01–04 complete in REQUIREMENTS.md (completed 2026-02-22)
- [x] **Phase 30: Fix gemini-cli Package Reference** — Update ~/.claude.json gemini-cli args to unscoped package name; mark STD-10 complete (completed 2026-02-22)
- [x] **Phase 31: Merge Gen2 Branches + Phase 24 Verification** — Merge codex/copilot Gen2 branches to main + create Phase 24 VERIFICATION.md; close STD-02 (completed 2026-02-22)

### ⏳ v0.5 — MCP Setup Wizard (Pending v0.4 Completion)

**Milestone Goal:** Ship `/qgsd:mcp-setup` — a hybrid wizard that takes users from zero agents to a fully configured quorum in one command, or lets them reconfigure any existing agent (model, provider, API key) without touching config files manually.

- [x] **Phase 32: Wizard Scaffold** — /qgsd:mcp-setup command: first-run vs re-run detection, main menu with live status, confirm+apply+restart flow (WIZ-01..05) (completed 2026-02-22)
- [ ] **Phase 33: API Key Management** — Wizard flow for set/update API keys via keytar; writes to ~/.claude.json env block and restarts agent (KEY-01..04)
- [ ] **Phase 34: Provider Swap** — Wizard flow for changing agent base URL; curated provider list + custom entry; writes ANTHROPIC_BASE_URL and restarts (PROV-01..03)
- [ ] **Phase 35: Agent Roster** — Wizard flow for add/remove claude-mcp-server instances; identity ping after provisioning (AGENT-01..03)
- [ ] **Phase 36: Install Integration** — Installer detects no configured quorum agents and prompts user to run /qgsd:mcp-setup (INST-01)

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

### Phase 29: Restore mcp-status v2 + Requirements Checkbox Cleanup
**Goal**: The live mcp-status.md is restored to its verified v2 state (10-agent, scoreboard-aware) and REQUIREMENTS.md OBS-01–04 checkboxes reflect actual verification outcomes
**Depends on**: Phase 28
**Requirements**: OBS-01, OBS-02, OBS-03, OBS-04
**Gap Closure**: Closes mcp-status.md regression (Phase 28 accidentally overwrote v2 with v1 copy from plan context); marks OBS-01–04 complete
**Success Criteria** (what must be TRUE):
  1. `commands/qgsd/mcp-status.md` and `~/.claude/commands/qgsd/mcp-status.md` both contain v2 (10-agent, scoreboard-aware) — line count ≥125, contains `mcp__claude-glm__identity`
  2. REQUIREMENTS.md checkboxes for OBS-01–04 are `[x]` and traceability table shows Complete
**Plans**: 1 plan
  - [x] 29-01-PLAN.md — git checkout v2 mcp-status.md, copy to ~/.claude, mark OBS-01–04 complete in REQUIREMENTS.md [Wave 1] (completed 2026-02-22)

### Phase 30: Fix gemini-cli Package Reference
**Goal**: Running `/qgsd:mcp-update gemini-cli` installs the correct unscoped `gemini-mcp-server` package — `~/.claude.json` reflects Phase 23's unscoping work
**Depends on**: Phase 29
**Requirements**: STD-10
**Gap Closure**: Closes STD-10 partial — `~/.claude.json` `mcpServers["gemini-cli"].args` was not updated when Phase 23 unscoped the package name
**Success Criteria** (what must be TRUE):
  1. `~/.claude.json` `mcpServers["gemini-cli"].args` contains `gemini-mcp-server` (not `@tuannvm/gemini-mcp-server`)
  2. Running `/qgsd:mcp-update gemini-cli` would invoke `npm install -g gemini-mcp-server` — confirmed by inspecting the resolved args
**Plans**: 1 plan
  - [ ] 30-01-PLAN.md — Update ~/.claude.json gemini-cli args + REQUIREMENTS.md STD-10 [Wave 1]

### Phase 31: Merge Gen2 Branches + Phase 24 Verification
**Goal**: codex-mcp-server and copilot-mcp-server Gen2 architecture is merged to main and Phase 24 VERIFICATION.md confirms all 4 Gen1 repos are fully ported — STD-02 is production-stable
**Depends on**: Phase 30
**Requirements**: STD-02
**Gap Closure**: Closes STD-02 — codex-mcp-server Gen2 on `fix/progress-after-done` and copilot-mcp-server Gen2 on `feat/02-error-handling-and-resilience`; no Phase 24 VERIFICATION.md exists
**Success Criteria** (what must be TRUE):
  1. `codex-mcp-server` main branch contains Gen2 per-tool `*.tool.ts` + `registry.ts` architecture
  2. `copilot-mcp-server` main branch contains Gen2 per-tool `*.tool.ts` + `registry.ts` architecture
  3. Phase 24 VERIFICATION.md exists with status `passed` covering all STD-02 success criteria for all 4 repos
**Plans**: 2 plans
  - [ ] 31-01-PLAN.md — Merge codex-mcp-server fix/progress-after-done → main; merge copilot-mcp-server feat/02-error-handling-and-resilience → main [Wave 1]
  - [ ] 31-02-PLAN.md — Create Phase 24 VERIFICATION.md confirming STD-02 across all 4 repos [Wave 2]

### Phase 32: Wizard Scaffold
**Goal**: Users can run `/qgsd:mcp-setup` and reach a working wizard — first-run linear onboarding for new installs, a live-status agent menu for re-runs, and a confirm+apply+restart flow that writes changes to `~/.claude.json`
**Depends on**: Phase 31
**Requirements**: WIZ-01, WIZ-02, WIZ-03, WIZ-04, WIZ-05
**Success Criteria** (what must be TRUE):
  1. Typing `/qgsd:mcp-setup` on a fresh install (no mcpServers entries in `~/.claude.json`) presents a step-by-step onboarding flow — the user is guided through configuring their first agent without seeing an empty menu
  2. Typing `/qgsd:mcp-setup` on an existing install shows a numbered agent menu listing each agent with its current model, provider base URL, and whether an API key is stored in keytar
  3. Selecting an agent from the menu opens a sub-menu of actions (set key, swap provider, remove) — the user never has to manually edit `~/.claude.json`
  4. After the user selects an action and confirms, the wizard writes the change to `~/.claude.json` and invokes `/qgsd:mcp-restart` on the affected agent — the user sees a "changes applied and agent restarted" confirmation
  5. Typing `/qgsd:mcp-setup` without any quorum agents configured (all entries missing or empty) leads to the first-run flow, not an empty menu
**Plans**: TBD

### Phase 33: API Key Management
**Goal**: Users can set or update the API key for any agent entirely through the wizard — the key is stored in keytar, written to `~/.claude.json` on confirm, and the agent is automatically restarted
**Depends on**: Phase 32
**Requirements**: KEY-01, KEY-02, KEY-03, KEY-04
**Success Criteria** (what must be TRUE):
  1. Choosing "Set API key" for an agent prompts the user to enter the key; the key is saved to the system keychain via `bin/secrets.cjs` and does not appear in any log or plain-text file
  2. After confirming a key change, `~/.claude.json` `mcpServers[agent].env` block is updated with the new key value — inspecting the file confirms the value changed
  3. After the key is written to `~/.claude.json`, the affected MCP server process is restarted automatically — the user does not need to manually restart it
  4. If a key is already stored for the agent, the wizard shows "(key stored)" next to the prompt and allows the user to overwrite it — it does not expose the existing key value
**Plans**: 1 plan
- [ ] 33-01-PLAN.md — Full API key flow in Agent Sub-Menu Option 1: key-status check, "(key stored)" hint, keytar store, ~/.claude.json patch, sync, restart (KEY-01, KEY-02, KEY-03, KEY-04) [Wave 1]

### Phase 34: Provider Swap
**Goal**: Users can change the base URL (provider) for any existing agent through the wizard — they choose from a curated list or enter a custom URL, the wizard updates `~/.claude.json` and restarts the agent
**Depends on**: Phase 33
**Requirements**: PROV-01, PROV-02, PROV-03
**Success Criteria** (what must be TRUE):
  1. Choosing "Swap provider" for an agent shows a numbered list of providers: AkashML, Together.xyz, Fireworks, and a "Custom URL" option
  2. Selecting a curated provider fills in the canonical base URL automatically — the user does not have to type it; selecting "Custom URL" opens a free-text prompt
  3. After confirming a provider change, `~/.claude.json` `mcpServers[agent].env.ANTHROPIC_BASE_URL` is updated to the new value and the agent is restarted — the running agent reaches the new provider on the next quorum call
**Plans**: TBD

### Phase 35: Agent Roster
**Goal**: Users can add a new claude-mcp-server instance or remove an existing one entirely through the wizard — adding a new agent completes with a live identity ping to confirm connectivity
**Depends on**: Phase 34
**Requirements**: AGENT-01, AGENT-02, AGENT-03
**Success Criteria** (what must be TRUE):
  1. Choosing "Add agent" in the wizard prompts for a name, provider, model, and API key — on confirm, a new `mcpServers` entry is written to `~/.claude.json` with the correct `command`, `args`, and `env` block for a claude-mcp-server instance
  2. Choosing "Remove agent" in the wizard shows the existing agent list; selecting an agent and confirming deletes its `mcpServers` entry from `~/.claude.json` — the entry is gone after the operation
  3. After adding a new agent, the wizard waits for the MCP server to start and calls its `identity` tool — the user sees the agent's reported name, version, and model as confirmation that it is live and responding
**Plans**: TBD

### Phase 36: Install Integration
**Goal**: New users who run `npx qgsd@latest` are nudged to configure their agents immediately — the installer detects no configured quorum agents and prompts the user to run `/qgsd:mcp-setup`
**Depends on**: Phase 35
**Requirements**: INST-01
**Success Criteria** (what must be TRUE):
  1. Running `npx qgsd@latest` on a machine where `~/.claude.json` has no recognized quorum agent entries prints a clear prompt: "No quorum agents configured. Run /qgsd:mcp-setup in Claude Code to set up your agents."
  2. Running `npx qgsd@latest` on a machine that already has quorum agents configured does not show the nudge — the prompt appears only on first install or after all agents are removed
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
| 20. Workflow Orchestrator | v0.3 | 1/1 | Complete | 2026-02-22 |
| 21. Categorization Engine | v0.3 | 2/2 | Complete | 2026-02-22 |
| 22. Integration Test | v0.3 | 2/2 | Complete | 2026-02-22 |
| 23. MCP Repo Surface Fixes | v0.4 | 3/3 | Complete | 2026-02-22 |
| 24. Gen1 to Gen2 Architecture Port | v0.4 | 4/4 | Complete | 2026-02-22 |
| 25. Identity Tool and Shared Utilities | v0.4 | 3/3 | Complete | 2026-02-22 |
| 26. MCP Status Command | v0.4 | 1/1 | Complete | 2026-02-22 |
| 27. Model Switching | v0.4 | 2/2 | Complete | 2026-02-22 |
| 28. Update and Restart Commands | v0.4 | TBD | Complete | 2026-02-22 |
| 29. Restore mcp-status v2 + Checkbox Cleanup | v0.4 | 1/1 | Complete | 2026-02-22 |
| 30. Fix gemini-cli Package Reference | v0.4 | Complete    | 2026-02-22 | - |
| 31. Merge Gen2 Branches + Phase 24 Verification | v0.4 | Complete    | 2026-02-22 | - |
| 32. Wizard Scaffold | v0.5 | Complete    | 2026-02-22 | - |
| 33. API Key Management | v0.5 | 0/1 | Not started | - |
| 34. Provider Swap | v0.5 | 0/TBD | Not started | - |
| 35. Agent Roster | v0.5 | 0/TBD | Not started | - |
| 36. Install Integration | v0.5 | 0/TBD | Not started | - |
