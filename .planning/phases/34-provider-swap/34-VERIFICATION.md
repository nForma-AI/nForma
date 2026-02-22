---
phase: 34
name: Provider Swap
status: passed
verified: 2026-02-22
verifier: qgsd-verifier
---

# Phase 34 Verification — Provider Swap

## Goal

Users can change the base URL (provider) for any existing agent through the wizard — they choose from a curated list or enter a custom URL, the wizard updates `~/.claude.json` and restarts the agent.

## Must-Have Verification

### PROV-01 — User can change provider for an existing agent through wizard

**Status: VERIFIED**

- `mcp-setup.md` Agent Sub-Menu Option 2 is now fully implemented with a 4-step flow replacing the Phase 34 stub.
- Step B presents AskUserQuestion with header "Swap Provider — {agent-name}" and question "Select a new provider for {agent-name}:".
- Sub-menu option label is "2 — Swap provider" (no phase suffix).
- Evidence: `grep "Swap Provider" mcp-setup.md` hits line 648; `grep "Phase 34"` = 0 matches.

### PROV-02 — Curated provider list (AkashML, Together.xyz, Fireworks) + Custom URL

**Status: VERIFIED**

- Step B options: "1 — AkashML (https://api.akashml.com/v1)", "2 — Together.xyz (https://api.together.xyz/v1)", "3 — Fireworks (https://api.fireworks.ai/inference/v1)", "4 — Custom URL", "Skip".
- Curated selections auto-fill `NEW_URL` without user typing the URL (Step C resolves from selection).
- "4 — Custom URL" opens a second AskUserQuestion for free-text entry with Cancel path.
- Evidence: `grep -c "AkashML" mcp-setup.md` = 8; `grep -c "Custom URL"` = 3 (option, step C label, implementation note).

### PROV-03 — ~/.claude.json ANTHROPIC_BASE_URL patched + agent restarted

**Status: VERIFIED**

- Step D item 2: patches `claudeJson.mcpServers[agentName].env.ANTHROPIC_BASE_URL = newUrl` via inline node; new URL passed via `NEW_URL` environment variable only (never interpolated).
- Step D item 3: `Invoke /qgsd:mcp-restart {agent-name} (sequential)` — user does not restart manually.
- Restart-failure fallback present: config left written, warning displayed.
- Evidence: `grep -c "ANTHROPIC_BASE_URL"` = 7; specific patch at line 718; mcp-restart invocation at line 725.

## Artifact Verification

| Artifact | Path | Contains | Status |
|----------|------|----------|--------|
| Source wizard | `commands/qgsd/mcp-setup.md` | Full provider swap flow | VERIFIED |
| Installed copy | `~/.claude/commands/qgsd/mcp-setup.md` | identical to source | VERIFIED |
| No stub | both copies | 0 "Phase 34" stub matches | VERIFIED |

## Numeric Checks

| Check | Expected | Actual | Pass |
|-------|----------|--------|------|
| `grep "Phase 34"` | 0 | 0 | YES |
| `grep -c "AkashML"` | >= 2 | 8 | YES |
| `grep -c "ANTHROPIC_BASE_URL"` | >= 3 | 7 | YES |
| `grep -c "mcp-restart"` | >= 4 | 11 | YES |
| `grep -c "Custom URL"` | >= 1 | 3 | YES |
| `diff source installed` | empty | empty | YES |

## Conclusion

**Status: PASSED**

All PROV-01..PROV-03 requirements satisfied. The mcp-setup.md wizard fully implements the provider swap flow for Agent Sub-Menu Option 2. The Phase 34 stub has been completely replaced. Source and installed copies are byte-identical. URL value is never interpolated into script bodies.
