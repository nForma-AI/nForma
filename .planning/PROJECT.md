# QGSD

## What This Is

QGSD is a Claude Code plugin extension that moves multi-model quorum enforcement from CLAUDE.md behavioral policy into structural Claude Code hooks. It installs on top of GSD without modifying it, adding a hook-based quorum layer: a UserPromptSubmit hook injects quorum instructions at the right moment, and a Stop hook verifies quorum actually happened by parsing the conversation transcript before allowing Claude to deliver planning output.

## Core Value

Planning decisions are multi-model verified by structural enforcement, not instruction-following — a Stop hook that reads the transcript makes it impossible for Claude to skip quorum.

## Requirements

### Validated

- ✓ UserPromptSubmit hook detects GSD planning commands and injects quorum instructions into Claude's context — Phase 1 (UPS-01 through UPS-05)
- ✓ Stop hook reads transcript JSONL, checks for Codex/Gemini/OpenCode tool call evidence, and blocks with decision:block if quorum is missing — Phase 1 (STOP-01 through STOP-09)
- ✓ Configurable scope: default set is high-stakes GSD commands (new-project, plan-phase, new-milestone, discuss-phase, verify-work, research-phase) — Phase 1 (UPS-02, CONF hardcoded defaults)
- ✓ Fail-open behavior: when a model is unavailable, proceed with available models and note reduced quorum — Phase 1 (STOP-09, loadConfig fallback)
- ✓ Installs globally into ~/.claude/ — same behavior as GSD installer — Phase 1 (INST partial: hooks installed, full installer Phase 3)
- ✓ Works alongside GSD without any modification to GSD internals — Phase 1 (additive hooks only, zero GSD coupling)
- ✓ QGSD config file lets users customize which commands require quorum — Phase 1 (templates/qgsd.json + ~/.claude/qgsd.json)

### Active

(Phase 2 and Phase 3 features — config system, MCP auto-detection, full installer)

### Out of Scope

- Calling model CLIs directly from hooks (fragile, external dependencies, auth complexity) — deferred as optional strict mode
- Modifying GSD workflows or agents — QGSD is additive only
- Per-project install (global only in v1 — matches GSD's install behavior)
- Fail-closed mode in v1 — fail-open matches CLAUDE.md R6 and avoids blocking work

## Context

GSD currently has a CLAUDE.md policy (R2–R7) that instructs Claude to run quorum (R3) before presenting planning outputs. The problem: CLAUDE.md is read once at session start and relies on behavioral compliance. If Claude forgets or rationalizes around the policy mid-session, quorum doesn't happen.

QGSD's structural approach:
- UserPromptSubmit fires at the right moment (when command is invoked, not session start)
- Stop hook provides a hard gate — Claude literally cannot complete its response without evidence of quorum in the transcript
- Quorum consensus was already reached (Claude + Codex + OpenCode) on this architecture before PROJECT.md was written — Gemini unavailable (quota)

The GSD codebase already has hooks infrastructure (see `hooks/` directory). QGSD adds new hooks as a separate plugin, not modifications to existing ones.

## Constraints

- **Architecture**: Plugin extension only — no GSD source modifications, zero coupling to GSD version
- **Dependencies**: Pure Claude Code hooks system — no external CLIs, no API keys beyond what Claude Code already manages via MCPs
- **Install**: Global (~/.claude/) following GSD's install pattern
- **Scope**: v1 covers quorum enforcement only — other QGSD features (if any) are future milestones

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| A+C: UserPromptSubmit injection + Stop hook gate | Three-model quorum (Claude + Codex + OpenCode) reached consensus; Option B (direct CLI calls) is fragile and maintenance-heavy | Implemented — Phase 1 |
| High-stakes commands as default scope | All /gsd:* is too broad (execute-phase doesn't need quorum); user-configurable override future-proofs against GSD command evolution | Implemented — Phase 1 (6-command allowlist) |
| Fail-open | Matches CLAUDE.md R6 behavior; prevents blocking work when models have quota issues | Implemented — Phase 1 (loadConfig fallback, fail_mode: "open") |
| Plugin extension, not fork | No trade-offs vs fork — hooks are additive; GSD updates don't require QGSD changes | Confirmed — Phase 1 (zero GSD source modifications) |
| Global install | Matches GSD's default behavior; quorum should apply everywhere, not require per-project opt-in | Implemented — Phase 1 (hooks in ~/.claude/, config in ~/.claude/qgsd.json) |
| Hook installation via settings.json directly | Confirmed Claude Code bug #10225: plugin hooks.json silently discards UserPromptSubmit output; must write to settings.json | Implemented — Phase 1 (bin/install.js writes to ~/.claude/settings.json) |
| STOP-05 fast-path omitted by design | last_assistant_message substring matching is unreliable (Claude can summarize without naming tool prefixes); JSONL parse is synchronous and correct for all transcript sizes | Design decision — Phase 1 gap closure (quorum: Claude + Codex + Gemini) |

---
*Last updated: 2026-02-20 after Phase 1 (hook-enforcement) — all 17 v1 Phase 1 requirements satisfied, hooks installed, 9/9 tests passing*
