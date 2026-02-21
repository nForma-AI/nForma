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
