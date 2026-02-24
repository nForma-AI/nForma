# Milestones

## v0.1 — Quorum Hook Enforcement

**Completed:** 2026-02-21
**Phases:** 1–5 (Phase 5 = gap closure)
**Last phase number:** 5

### What Shipped

- Stop hook hard gate — Claude cannot deliver a GSD planning response without quorum evidence in transcript
- UserPromptSubmit injection — quorum instructions fire at command time, not session start
- Config system — two-layer merge (global ~/.claude/qgsd.json + project .claude/qgsd.json), MCP auto-detection
- Decision scope narrowing — GUARD 5 restricts quorum to actual project decision turns (hasArtifactCommit + hasDecisionMarker)
- npm installer — `npx qgsd@latest` writes hooks to `~/.claude/settings.json`, idempotent, warns on missing MCP servers
- Phase 5 gap closure — GUARD 5 marker path propagated to buildQuorumInstructions() and templates/qgsd.json

### Requirements Satisfied

39/39 v1 requirements (STOP-01–09, UPS-01–05, META-01–03, CONF-01–05, MCP-01–06, INST-01–07, SYNC-01–04)
Phase 4 scope requirements: SCOPE-01–07 (7/7)

### Key Decisions Carried Forward

- Hook installation writes to ~/.claude/settings.json directly (never plugin hooks.json — bug #10225)
- Fail-open: unavailable models pass through, not block
- Global install only; no per-project install in v0.x
- GUARD 5: decision turn = hasArtifactCommit OR hasDecisionMarker (both must be false to skip quorum)

---

*Archive committed: 2026-02-21*

## v0.2 Gap Closure — Activity Resume Routing (Shipped: 2026-02-21)

**Phases completed:** 17 phases, 40 plans, 13 tasks

**Key accomplishments:**
- (none recorded)

---

## v0.3 — Test Suite Maintenance Tool (Shipped: 2026-02-22)

**Phases completed:** 5 phases (18–22), ~96 commits
**Requirements:** 14/14 v0.3 requirements (DISC-01/02, EXEC-01..04, CATG-01..03, ITER-01/02, INTG-01..03)

**Delivered:** Built `/qgsd:fix-tests` — a single autonomous command that discovers all jest/playwright/pytest tests, batches them, runs with flakiness detection, AI-categorizes failures into 5 types, dispatches fix tasks, and loops until all tests are classified. 135 integration tests verify all seams end-to-end.

**Key accomplishments:**
- `gsd-tools.cjs maintain-tests discover/batch/run-batch` — framework-native test discovery (never globs); random batch shuffling; spawnToFile capture prevents Node.js maxBuffer overflow on large suites (DISC-01/02, EXEC-01..04)
- 5-category AI failure diagnosis (valid-skip / adapt / isolate / real-bug / fixture) with git pickaxe enrichment for `adapt` failures linking to the causative commit (CATG-01..03)
- Autonomous dispatch: adapt/fixture/isolate failures grouped and dispatched as `/qgsd:quick` Tasks; real-bug failures deferred to user report (CATG-03)
- Loop termination logic: no-progress guard (5 consecutive batches), configurable iteration cap, circuit breaker disable/re-enable lifecycle (ITER-01/02, INTG-01)
- Activity sidecar integration: interrupted maintenance runs resume to exact batch step via `/qgsd:resume-work` routing table (INTG-02)
- 135 integration tests covering INTG-03 compliance, circuit breaker lifecycle, resume mid-batch, Phase 21 schema round-trips (Phase 22)

---

## v0.4 — MCP Ecosystem (Shipped: 2026-02-22)

**Phases completed:** 9 phases (23–31), ~853 commits
**Requirements:** OBS-01..04, MGR-01..06, STD-02, STD-04, STD-08, STD-10 shipped; STD-01/03/05/06/07/09 deferred (out of scope per Phase 23 scope decision)

**Delivered:** Standardized the 6 coding-agent MCP server repos to Gen2 architecture, shipped `/qgsd:mcp-status` (identity-based polling + scoreboard UNAVAIL counts), `/qgsd:mcp-set-model` (persistent model preferences + quorum injection), `/qgsd:mcp-update` (all install methods), and `/qgsd:mcp-restart` (pkill + auto-reconnect). 201/201 tests passing.

**Key accomplishments:**
- Gen1→Gen2 architecture port for claude/codex/copilot/openhands repos: per-tool `*.tool.ts` + `registry.ts` structure; Gen1 files removed; both repos merged to main from feature branches (STD-02, Phase 24/31)
- `identity` tool + `constants.ts` + `Logger` utility shipped in all 6 repos; `gemini-mcp-server` unscoped to unscoped npm package name (STD-04, STD-08, STD-10, Phase 25/30)
- `/qgsd:mcp-status` v2 — 10-agent identity polling + inline scoreboard UNAVAIL read; health state table with model and availability (OBS-01..04, Phase 26/29)
- `/qgsd:mcp-set-model` — 6-step command with live identity validation, model_preferences persistence to global qgsd.json, quorum override injection in subsequent calls (MGR-01/02, Phase 27)
- `/qgsd:mcp-update` — detects npm global / npx / git install method from `~/.claude.json` args; deduplicates 6 claude-* agents to single build; `all` mode sequential (MGR-03..05, Phase 28)
- `/qgsd:mcp-restart` — pkill npm exec parent then node child (prevents stale respawn); Claude Code auto-reconnect + identity verification (MGR-06, Phase 28)

---

## v0.5 — MCP Setup Wizard (Shipped: 2026-02-23)

**Phases completed:** 7 phases (32–38), ~613 commits
**Requirements:** 17/17 v0.5 requirements (WIZ-01..05, KEY-01..04, PROV-01..03, AGENT-01..03, INST-01)

**Delivered:** Built `/qgsd:mcp-setup` — a hybrid wizard that takes users from zero agents to a fully configured quorum in one command, or lets them reconfigure any existing agent (key, provider, model) without touching config files. First-run = linear onboarding; re-run = navigable agent menu with live status.

**Key accomplishments:**
- Wizard scaffold: first-run vs re-run detection, AskUserQuestion agent menu with live identity status, confirm+apply+restart flow (WIZ-01..05, Phase 32)
- API key management: keytar-backed secure storage via `bin/secrets.cjs`; key passed via env var (not shell history); `syncToClaudeJson` propagates to all agent env blocks after apply (KEY-01..04, Phase 33)
- Provider swap: curated list (AkashML / Together.xyz / Fireworks) + custom URL; `NEW_URL` env var pattern prevents injection; `syncToClaudeJson` called on apply (PROV-01..03, Phase 34)
- Agent roster: add new claude-mcp-server instances with `CLAUDE_MCP_PATH` 2-strategy fallback; identity ping verifies connectivity; remove existing agents (AGENT-01..03, Phase 35)
- Install nudge: installer detects no configured quorum agents via `hasClaudeMcpAgents()` and prompts `/qgsd:mcp-setup` (INST-01, Phase 36)
- Distribution fixes: 9 hardcoded `secrets.cjs` absolute paths replaced with `copyWithPathReplacement()` dynamic resolution; all 5 apply flows call `syncToClaudeJson` (Phase 37)

---


## v0.6 Agent Slots & Quorum Composition (Shipped: 2026-02-23)

**Phases completed:** Phase 39 (+ Phases 37–38 as v0.5 gap closure), 5 plans
**Git range:** 1e84b15..dae3af6 (23 commits, 43 files changed, +3243/-231 lines)

**Delivered:** Renamed all 10 quorum agents to slot-based `<family>-<N>` names everywhere in QGSD, shipped a non-destructive idempotent migration script, and eliminated all old model-based names from every source file.

**Key accomplishments:**
- Shipped `bin/migrate-to-slots.cjs` — idempotent migration script with `--dry-run`; renames 10 `~/.claude.json` mcpServers keys and patches `qgsd.json` required_models tool_prefix values (SLOT-02)
- Updated all runtime hooks (`qgsd-prompt.js`, `config-loader.js`, `qgsd-stop.js`) and `templates/qgsd.json` to slot-based tool prefixes — zero old names in hook layer (SLOT-03)
- Updated all 8 command `.md` files and the quorum orchestrator agent to slot names in allowed-tools, validation lists, KNOWN_AGENTS arrays — zero old names in command layer (SLOT-01, SLOT-03, SLOT-04)
- Fixed `mcp-setup.md` distribution defects: replaced 9 hardcoded `secrets.cjs` absolute paths with dynamic resolution, added missing `syncToClaudeJson` to provider swap flow (Phase 37)
- Established `requirements:` frontmatter as the canonical traceability link in SUMMARY.md files (Phase 38)

**Known gaps (deferred to v0.7):** COMP-01..04, MULTI-01..03, WIZ-08..10, SCBD-01..03

---


## v0.7 Composition Config & Multi-Slot (Shipped: 2026-02-23)

**Phases completed:** 4 phases (v0.7-01..v0.7-04), 10 plans
**Git range:** 03fffb3..36ad405 (61 files changed, +5,555/-219 lines)

**Delivered:** Shipped `quorum_active` composition config so which slots participate in quorum is a config decision not a code change, extended to N-slot-per-family multi-slot support, added a Composition Screen to the mcp-setup wizard, and fixed scoreboard slot tracking on all quorum paths.

**Key accomplishments:**
- `quorum_active` config field added — users define slot composition via `qgsd.json`; auto-populated at install/migrate time via `buildActiveSlots()` / `populateActiveSlots()` (COMP-01..04)
- Scoreboard slot tracking — `update-scoreboard.cjs` extended with `slots{}` schema and `--slot`/`--model-id` CLI args; composite key `<slot>:<model-id>` for per-slot-per-model stats (SCBD-01..03)
- Dynamic quorum wiring — quorum.md and orchestrator provider pre-flight read `quorum_active`; no more hardcoded agent lists (COMP-02)
- Multi-slot support — multiple claude/copilot/opencode/codex-cli/gemini-cli slots; mcp-setup `Add new agent` expanded with native CLI second-slot options 6–9 (MULTI-01..03)
- Wizard Composition Screen — `/qgsd:mcp-setup` re-run gains "Edit Quorum Composition" with on/off slot toggle, apply-to-disk, and add-from-composition routing (WIZ-08..10)
- Orchestrator scoreboard slot fix — quorum.md + orchestrator Mode A use `--slot`/`--model-id`; Escalate sections expanded to inline dual-variant blocks; closes SCBD-01..03 audit gap (Phase v0.7-04)

---


## v0.11 Parallel Quorum (Shipped: 2026-02-24)

**Phases completed:** 28 phases, 52 plans, 12 tasks

**Key accomplishments:**
- (none recorded)

---

