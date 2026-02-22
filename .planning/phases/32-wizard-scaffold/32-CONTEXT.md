# Phase 32: Wizard Scaffold - Context

**Gathered:** 2026-02-22
**Status:** Ready for planning

<domain>
## Phase Boundary

Implement `/qgsd:mcp-setup` as a working wizard: first-run linear onboarding for new installs (no mcpServers entries), a live-status agent menu for re-runs (existing entries), and a confirm+apply+restart flow that writes changes to `~/.claude.json`. Upstream MCP server setup (installing binaries, registering with npm) is out of scope — this phase wires the user through config and key management only.

</domain>

<decisions>
## Implementation Decisions

### Interaction model (locked from STATE.md)
- Slash command `/qgsd:mcp-setup` using AskUserQuestion for all interactive prompts
- Config target: `~/.claude.json` mcpServers section
- Secret store: keytar via existing `bin/secrets.cjs`
- Restart delegation: `/qgsd:mcp-restart` after applying changes
- First-run detection: zero mcpServers entries = fresh install; any entries present = re-run

### First-run onboarding flow
1. Detect zero mcpServers entries → trigger first-run path
2. Display welcome banner (QGSD branding from ui-brand.md)
3. Present numbered list of agent templates from provider map, each with skip option:
   - AkashML: deepseek, minimax
   - Together.xyz: qwen-coder, llama4
   - Fireworks: kimi
4. Per agent selected: collect API key, validate format via regex + optional connectivity probe (reuse `bin/check-provider-health.cjs` logic), prompt retry on invalid
5. Accumulate changes as a pending batch (do not write per-agent)
6. After each agent: offer "add another" or "finish"
7. On finish: backup `~/.claude.json` with timestamp, write all pending changes, offer `/qgsd:mcp-restart` invocation
8. Closing summary: list skipped agents with reminder to configure later via `/qgsd:mcp-setup`

### Re-run agent menu
- Numbered list: each row shows agent name + current model + provider base URL + key status (stored in keytar: yes/no)
- Selecting an agent opens a sub-menu: [1] Set/update key, [2] Swap provider, [3] Remove

### Swap provider action
- Present numbered provider templates with brief description blurbs:
  - `1. AkashML      — api.akashml.com/v1              (affordable, supports deepseek/minimax)`
  - `2. Together.xyz — api.together.xyz/v1             (broad model selection, ~2-4s latency)`
  - `3. Fireworks    — api.fireworks.ai/inference/v1   (fast inference, supports kimi)`
  - `4. Custom URL   — enter base URL manually`
- Custom URL: validate HTTPS format + optional reachability probe (GET /models, 7s timeout)
- After provider swap: chain immediately into "Update API Key" prompt (old key is invalid for new provider)

### Keytar failure fallback
- If keytar unavailable (no system keychain): show warning naming the exact file — "System keychain unavailable — API key will be stored unencrypted in `~/.claude.json` (less secure). Confirm? [y/N]"
- Also show Linux libsecret install hint: `sudo apt install libsecret-1-dev gnome-keyring`
- On user confirmation: fall back to storing key in mcpServers env block
- Write fallback audit log entry (timestamped) to `~/.claude/debug/` noting env-block fallback was used

### Apply + restart flow
- Before writing: create timestamped backup of `~/.claude.json`
- After confirm+write: invoke `/qgsd:mcp-restart` on affected agent(s)
- Display "changes applied and agent restarted" confirmation (or error if restart fails — leave config in applied state, show manual retry instructions)

### Claude's Discretion
- Exact AskUserQuestion option wording and ordering
- Welcome banner copy
- Error message phrasing
- Restart failure message format

</decisions>

<specifics>
## Specific Ideas

- API key validation: regex check on input + optional connectivity probe using existing `bin/check-provider-health.cjs` logic (GET /models, 7s timeout)
- Batch writes: accumulate all changes in memory, single atomic write at end of session (reduces partial-write risk)
- Backup before write: `~/.claude.json.backup-YYYY-MM-DD-HHmmss` in same directory

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope (config + key management only; binary installation and npm setup are separate phases)

</deferred>

---

*Phase: 32-wizard-scaffold*
*Context gathered: 2026-02-22*
