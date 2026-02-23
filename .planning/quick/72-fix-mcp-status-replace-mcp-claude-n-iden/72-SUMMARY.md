---
phase: quick-72
plan: 01
subsystem: commands/qgsd
tags: [mcp-status, providers, http-probe, quorum-agents]
dependency_graph:
  requires: [bin/providers.json, commands/qgsd/mcp-status.md]
  provides: [updated mcp-status slash command]
  affects: [commands/qgsd/mcp-status.md]
tech_stack:
  added: []
  patterns: [inline-node-https-probe, providers-json-read]
key_files:
  modified:
    - commands/qgsd/mcp-status.md
decisions:
  - "HTTP provider model info sourced from providers.json, not from mcp__claude-N__identity calls (those return Anthropic model list, not the configured DeepSeek/MiniMax/etc. models)"
  - "Endpoint health probed inline using Node built-in https module at baseUrl/models; accept 200/401/403/404/422 as healthy (auth errors confirm endpoint is alive)"
  - "UNAVAIL lookup uses Math.max of old simple key (deepseek), new composite key (claude-1:deepseek-ai/DeepSeek-V3.2), and slot name — handles scoreboard migration period"
  - "CLI slot names updated from codex-cli-1/gemini-cli-1 to codex-1/gemini-1 to match current unified-mcp-server roster"
  - "Endpoint column added to table (ms latency for HTTP agents, — for CLI agents)"
metrics:
  duration: "< 5 min"
  completed: "2026-02-23"
  tasks: 1
  files: 1
---

# Phase quick-72 Plan 01: Fix mcp-status — providers.json reads for HTTP agents

**One-liner:** Replaced broken mcp__claude-N__identity calls with providers.json reads and inline Node https endpoint probes for all 6 HTTP quorum agents.

## What Was Done

The mcp-status slash command previously called `mcp__claude-N__identity` for all 10 agents. This was broken for claude-1..6 (HTTP providers) because the claude-mcp-server's `identity` tool returns Anthropic's model list — not the DeepSeek/MiniMax/Qwen/Kimi/Llama/GLM models actually configured in providers.json. The command showed wrong model IDs for 6 of 10 agents.

### Changes to commands/qgsd/mcp-status.md

1. **allowed-tools block**: Removed all `mcp__claude-N__identity` entries (6 tools removed). Updated CLI slot names from `codex-cli-1`/`gemini-cli-1` to `codex-1`/`gemini-1`. Final allowed-tools: Read, Bash, mcp__codex-1__identity, mcp__gemini-1__identity, mcp__opencode-1__identity, mcp__copilot-1__identity.

2. **Step 2 (new)**: Inline `node -e` script reads `bin/providers.json`, filters `type === "http"` entries, and produces `{ "claude-1": { model, description, baseUrl, apiKeyEnv }, ... }` map stored as HTTP_PROVIDERS.

3. **Step 3 (new)**: Inline `node -e` script groups HTTP providers by baseUrl (3 unique: AkashML, Together, Fireworks), probes `GET baseUrl/models` with 7-second timeout using Node's built-in `https` module. Accepts HTTP 200/401/403/404/422 as healthy. Stores as ENDPOINT_HEALTH map.

4. **Step 5**: CLI identity calls updated to use correct slot names (codex-1, gemini-1, opencode-1, copilot-1).

5. **Step 6**: HTTP agents (claude-1..6) get model from HTTP_PROVIDERS, endpoint latency from ENDPOINT_HEALTH, and health = `endpoint-down` / `quota-exceeded` / `available` based on probe + UNAVAIL count.

6. **UNAVAIL lookup**: Uses `Math.max(counts[slot], counts[simpleKey], counts[compositeKey])` to handle both old simple keys and new composite `slot:model-id` keys.

7. **Table**: Added `Endpoint` column between Health and Available Models showing probe latency for HTTP agents.

8. **Banner**: Updated to "Querying 4 CLI agents + 6 HTTP providers..."

## Verification Results

| Check | Result |
|-------|--------|
| `grep "mcp__claude-"` returns no matches | PASS |
| `grep "providers.json"` returns matches | PASS |
| `grep "mcp__codex-1__identity"` returns matches | PASS |
| `grep "endpoint-down"` returns matches | PASS |
| `grep "claude-1:deepseek"` returns matches | PASS |

## Commits

| Task | Commit | Description |
|------|--------|-------------|
| 1 | 11f31a3 | feat(quick-72): rewrite mcp-status to use providers.json + inline HTTP probe for claude-1..6 |

## Deviations from Plan

None — plan executed exactly as written.

## Self-Check: PASSED

- commands/qgsd/mcp-status.md: exists and modified
- Commit 11f31a3: verified in git log
