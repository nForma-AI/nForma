---
status: resolved
trigger: "mcp-status shows all 10 providers as quota-exceeded, but that is NOT the real status. The health classification is wrong/misleading."
created: 2026-02-23T00:00:00Z
updated: 2026-02-23T00:00:00Z
---

## Current Focus

hypothesis: RESOLVED
test: Applied fix — HTTP agents now use health_check for real-time health, not UNAVAIL count
expecting: /qgsd:mcp-status will show available for HTTP agents with responding endpoints, quota-exceeded only for CLI agents with UNAVAIL > 0
next_action: done

## Symptoms

expected: mcp-status should show accurate, current health for each provider — some providers should show as available if their endpoint is up and they can respond
actual: All 10 agents show quota-exceeded, even providers whose HTTP endpoints respond in 220-351ms. The health legend says "quota-exceeded — UNAVAIL count > 0 in scoreboard" — meaning ANY single past quota error permanently marks a provider as quota-exceeded.
errors: No error messages — just incorrect health classification that misleads the user
reproduction: Run /qgsd:mcp-status — all providers show quota-exceeded regardless of real availability
started: User noticed 2026-02-23. Scoreboard shows 142 rounds recorded, UNAVAIL counts on all providers

## Eliminated

- hypothesis: The mcp-status command was recently broken by a code change
  evidence: A correctly-fixed version already exists in ~/.claude/gsd-local-patches/commands/qgsd/mcp-status.md — the fix was written but never propagated to the active location
  timestamp: 2026-02-23

## Evidence

- timestamp: 2026-02-23
  checked: ~/.claude/commands/qgsd/mcp-status.md (active installed version)
  found: Step 6 health derivation for HTTP agents reads "Else if getUnavail(slot, model) > 0 → quota-exceeded" — this is historical-count-based, permanent marking
  implication: Any provider with a single past UNAVAIL in the scoreboard is permanently marked quota-exceeded

- timestamp: 2026-02-23
  checked: ~/.claude/gsd-local-patches/commands/qgsd/mcp-status.md (backup from previous update)
  found: Completely rewritten command — HTTP agents use health_check tool for real-time health (healthy/unhealthy/unreachable), UNAVAIL count is only shown in the UNAVAIL column for context, not used to drive health state
  implication: This is the correct version. It was a local patch that got preserved in gsd-local-patches but never promoted to the active commands location

- timestamp: 2026-02-23
  checked: scoreboard UNAVAIL counts
  found: All providers have UNAVAIL > 0 (deepseek=14+7, minimax=14+7, qwen=9+6, kimi=14+7, llama4=10+6, glm=7). All keys match getUnavail() lookup.
  implication: Under the current logic, every single provider will always show quota-exceeded — the display is completely non-functional as a health indicator

- timestamp: 2026-02-23
  checked: /Users/jonathanborduas/code/QGSD/commands/qgsd/mcp-status.md (source repo)
  found: Same old logic as the installed ~/.claude/commands/ version (providers.json probe approach, UNAVAIL > 0 = quota-exceeded)
  implication: Source repo also needs to be updated to the fixed version

## Resolution

root_cause: The active mcp-status command (~/.claude/commands/qgsd/mcp-status.md and source repo commands/qgsd/mcp-status.md) used "UNAVAIL count > 0 in scoreboard" as the health criterion for HTTP agents (claude-1..6). Since every provider has accumulated at least one UNAVAIL in 142 rounds, all providers permanently showed as quota-exceeded. A correctly-fixed version existed in ~/.claude/gsd-local-patches/commands/qgsd/mcp-status.md but used wrong slot names (codex-cli-1 vs codex-1) so could not be copied verbatim.
fix: Rewrote health derivation for HTTP agents to use live mcp__claude-N__health_check tool calls instead of UNAVAIL count. UNAVAIL count still shown in table for context. CLI agents retain scoreboard-based health. Added health_check tools to allowed-tools. New health states: available/unhealthy/unreachable for HTTP agents.
verification: Both files verified identical via diff. Grep confirms health_check used for HTTP agents (lines 17-22, 101-106, 123-127) and UNAVAIL > 0 only applies to CLI agents (line 120).
files_changed:
  - /Users/jonathanborduas/.claude/commands/qgsd/mcp-status.md
  - /Users/jonathanborduas/code/QGSD/commands/qgsd/mcp-status.md
