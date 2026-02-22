# Phase 32: Wizard Scaffold — Research

**Phase:** 32 — Wizard Scaffold
**Requirements:** WIZ-01, WIZ-02, WIZ-03, WIZ-04, WIZ-05
**Researched:** 2026-02-22

---

## What We're Building

A new `/qgsd:mcp-setup` slash command that acts as a wizard for configuring quorum agents in `~/.claude.json`. The wizard has two paths:

1. **First-run** (no mcpServers entries): linear onboarding flow
2. **Re-run** (existing entries): live-status agent menu with sub-actions

Phase 32 scope is the scaffold — command file, routing logic, first-run detection, main menu display, sub-menu stubs, and the confirm+apply+restart flow. Key management (Phase 33), provider swap (Phase 34), and agent add/remove (Phase 35) are separate phases, but their entry points must be stubbed here.

---

## Existing Infrastructure (Reuse)

### `bin/secrets.cjs`
- Exports: `set(service, key, value)`, `get(service, key)`, `delete(service, key)`, `list(service)`, `syncToClaudeJson(service)`, `SERVICE` (= `'qgsd'`)
- `syncToClaudeJson`: reads all keytar credentials for service, patches matching env keys in every mcpServers entry, writes `~/.claude.json` with 2-space indent
- Graceful error: throws `Error` with install hint if keytar native addon missing — wizard must catch this

### `bin/set-secret.cjs`
- CLI wrapper: `node bin/set-secret.cjs <KEY_NAME> <value>`
- Calls `set()` then `syncToClaudeJson()` in sequence
- The wizard will call the library functions directly (not this CLI), but the pattern shows: store → sync → done

### `bin/check-provider-health.cjs`
- `GET /models` HTTP probe with configurable timeout (default 7s)
- Accepts 200, 401, 403, 404, 422 as "UP" (auth-required is still reachable)
- Reads `~/.claude.json` for provider URLs — wizard can reuse the probe logic inline
- Together.xyz latency ~2–4s; timeout must be ≥7s to avoid false positives
- Exit 0 = all healthy, exit 1 = one or more down

### `commands/qgsd/mcp-restart.md`
- Takes `$AGENT` name; reads `~/.claude.json`; `pkill` by process path or package name; waits 2s; calls `identity` tool to confirm reconnection
- Known agent list: `codex-cli`, `gemini-cli`, `opencode`, `copilot-cli`, `claude-deepseek`, `claude-minimax`, `claude-qwen-coder`, `claude-kimi`, `claude-llama4`, `claude-glm`
- Wizard should invoke via `/qgsd:mcp-restart <agent>` — command already handles process kill + reconnect wait

### `~/.claude.json` mcpServers Structure
```json
{
  "mcpServers": {
    "claude-deepseek": {
      "command": "node",
      "args": ["/path/to/claude-mcp-server/dist/index.js"],
      "env": {
        "ANTHROPIC_API_KEY": "...",
        "ANTHROPIC_BASE_URL": "https://api.akashml.com/v1",
        "CLAUDE_DEFAULT_MODEL": "deepseek-ai/DeepSeek-V3"
      }
    }
  }
}
```
- Key presence check: `Object.keys(claudeJson.mcpServers || {}).length === 0` → first-run
- Agents without `claude-mcp-server` in args (e.g., `codex-cli`, `gemini-cli`, `opencode`, `copilot-cli`) are non-claude-mcp-server agents — wizard may list them but cannot configure them in Phase 32

### Provider Map (from MEMORY.md + check-provider-health.cjs)
| Provider | Base URL | Models |
|---|---|---|
| AkashML | `https://api.akashml.com/v1` | deepseek, minimax |
| Together.xyz | `https://api.together.xyz/v1` | qwen-coder, llama4 |
| Fireworks | `https://api.fireworks.ai/inference/v1` | kimi |

---

## Slash Command Architecture

### How Existing Commands Work (from mcp-restart.md, mcp-status.md)
- Frontmatter with `name:`, `description:`, `argument-hint:`, `allowed-tools:`
- `$ARGUMENTS` contains the raw argument string
- Bash inline node scripts for JSON config reads
- AskUserQuestion for interactive prompts (from CONTEXT.md decisions)
- Sequential tool calls (never parallel for quorum-sensitive ops)
- Installed to `~/.claude/commands/qgsd/<name>.md` — must sync both source and installed

### Command File Location Pattern
- Source: `commands/qgsd/mcp-setup.md`
- Installed: `~/.claude/commands/qgsd/mcp-setup.md`
- Both must be written + kept in sync (same as mcp-restart.md, mcp-status.md pattern)

---

## First-Run Detection Logic

```js
const fs = require('fs');
const path = require('path');
const os = require('os');

const claudeJsonPath = path.join(os.homedir(), '.claude.json');
let claudeJson = {};
try {
  claudeJson = JSON.parse(fs.readFileSync(claudeJsonPath, 'utf8'));
} catch (e) {
  // Missing or corrupt = treat as fresh install
}
const servers = claudeJson.mcpServers || {};
const isFirstRun = Object.keys(servers).length === 0;
```

Per CONTEXT.md + WIZ-05: agents present but with empty/falsy entries should also trigger first-run. Safe check: filter entries where `command` and `args` are set.

---

## Agent Menu Display (Re-run)

For WIZ-03 and WIZ-04, each row must show:
- Agent name (key in mcpServers)
- Current model (`env.CLAUDE_DEFAULT_MODEL` for claude-mcp-server instances; `—` for others)
- Provider base URL (`env.ANTHROPIC_BASE_URL` for claude-mcp-server; `—` for others)
- Key status: check keytar `get(SERVICE, agentName)` → `(key stored)` or `(no key)`

Non-claude-mcp-server agents (codex-cli, gemini-cli, etc.) should appear in the list but show `—` for model and provider, and have limited sub-menu actions (Phase 32 scope: display only; sub-menu stubs for future phases).

---

## Sub-Menu Actions (Phase 32 Stubs)

Per CONTEXT.md, each agent sub-menu offers:
1. Set/update key → Phase 33 implements; Phase 32 stubs with "coming in next phase" or delegates to the sub-flow
2. Swap provider → Phase 34 implements; Phase 32 stubs
3. Remove → Phase 35 implements; Phase 32 stubs

Phase 32 must build the navigation frame (menu → select agent → sub-menu) even if leaf actions are stubs. The confirm+apply+restart flow should be real (WIZ-05).

---

## Confirm + Apply + Restart Flow (WIZ-05)

1. Show pending change summary to user
2. AskUserQuestion: "Apply changes? Confirm / Cancel"
3. On Confirm:
   a. Create timestamped backup: `~/.claude.json.backup-YYYY-MM-DD-HHmmss`
   b. Write updated JSON to `~/.claude.json` (2-space indent, same as secrets.cjs does)
   c. Invoke `/qgsd:mcp-restart <agent>` (as sub-Task or direct invocation instruction)
   d. Display "changes applied and agent restarted" confirmation
4. On Cancel: discard pending changes, return to menu

Backup command:
```bash
cp ~/.claude.json ~/.claude.json.backup-$(date +%Y-%m-%d-%H%M%S)
```

---

## Keytar Failure Fallback (from CONTEXT.md)

If keytar unavailable when storing a key:
- Show warning: "System keychain unavailable — API key will be stored unencrypted in `~/.claude.json` (less secure). Confirm? [y/N]"
- Linux hint: `sudo apt install libsecret-1-dev gnome-keyring`
- On user confirmation: store in `mcpServers[agent].env.ANTHROPIC_API_KEY` directly
- Write timestamped audit log entry to `~/.claude/debug/` noting env-block fallback

This fallback is needed in Phase 32 because the first-run flow collects API keys. The wizard must handle keytar failure gracefully.

---

## UI/UX Patterns (from ui-brand.md)

- Stage banners: `━━━ / QGSD ► STAGE NAME / ━━━`
- Status symbols: `✓` complete, `✗` failed, `◆` in progress, `○` pending, `⚡` auto-approved, `⚠` warning
- Checkpoint boxes for decisions (62-char width, `╔══...╗` / `╚══...╝`)
- Next Up block at end of completions
- No random emoji; no mixed banner styles

---

## Plan Decomposition Strategy

Given the scope (command scaffold + two main flows + confirm/apply + sub-menu stubs), a 2-plan split makes sense:

**Plan 01 — Command file + first-run detection + routing**
- Create `commands/qgsd/mcp-setup.md` (source + installed)
- Implement first-run detection logic
- Display first-run welcome banner
- Implement first-run agent template list with AskUserQuestion
- Collect API key per selected agent (with keytar store + fallback)
- Batch write + backup + restart invocation
- Closing summary

**Plan 02 — Re-run agent menu + sub-menu stubs + REQUIREMENTS.md**
- Read mcpServers from `~/.claude.json`
- Build numbered agent roster with model/provider/key-status columns
- AskUserQuestion for agent selection
- Open sub-menu (set key / swap provider / remove) — Phase 33/34/35 stubs
- Confirm+apply+restart flow (real implementation)
- Update REQUIREMENTS.md: WIZ-01–05 marked `[ ]` (they remain pending until executed, but traceability updated to Phase 32)
- Update STATE.md

---

## Risk Notes

1. **`~/.claude.json` parse failure**: file may be missing (fresh OS) or corrupt — always use try/catch; treat missing as `{}`
2. **Keytar native addon**: Node.js native module — may not be built if npm install wasn't run after OS update. Wizard must catch the throw from `secrets.cjs` and offer the env-block fallback
3. **mcp-restart invocation**: `/qgsd:mcp-restart` expects the agent key name as it appears in mcpServers — must pass exact key, not display name
4. **Non-claude-mcp-server agents**: codex-cli, gemini-cli, opencode, copilot-cli have no `ANTHROPIC_BASE_URL` env — must not attempt provider swap on them
5. **Backup before write**: always create timestamped backup before any write to `~/.claude.json` — atomic write + backup is the pattern from secrets.cjs

## RESEARCH COMPLETE
