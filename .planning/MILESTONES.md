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

