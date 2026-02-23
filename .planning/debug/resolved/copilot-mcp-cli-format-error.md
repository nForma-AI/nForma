---
status: resolved
trigger: "copilot-mcp-cli-format-error: mcp__copilot-1__ask returns CLI format error"
created: 2026-02-23T00:00:00Z
updated: 2026-02-23T00:01:00Z
---

## Current Focus

hypothesis: CONFIRMED — args_template uses ["ask", "--", "{prompt}"] but the copilot CLI has no "ask" subcommand; correct non-interactive format is ["-p", "{prompt}", "--allow-all-tools", "--no-color", "-s"]
test: Ran copilot ask -- "test prompt" → exit 1 with "Invalid command format"; ran copilot -p "Say HELLO" --allow-all-tools --no-color -s → exit 0 with clean response
expecting: Updating args_template to use -p flag will fix the exit-code-1 error
next_action: Update providers.json copilot-1 args_template and extraTools args_template

## Symptoms

expected: mcp__copilot-1__ask returns a quorum verdict (PASS/BLOCK/REVIEW-NEEDED)
actual: Tool exits with code 1, no verdict returned
errors: |
  error: Invalid command format.
  Did you mean: copilot -i "ask -- ..."
  For non-interactive mode, use the -p or --prompt option.
reproduction: Call mcp__copilot-1__ask with a prompt during quorum-test dispatch
started: Observed 2026-02-23 — may have always been broken or broke after a Copilot CLI update

## Eliminated

- hypothesis: "Wrong file being read — maybe a different copilot binary is invoked"
  evidence: ~/.claude.json confirmed copilot-1 uses unified-mcp-server.mjs with PROVIDER_SLOT=copilot-1; providers.json confirmed cli=/opt/homebrew/bin/copilot with args_template=["ask","--","{prompt}"]
  timestamp: 2026-02-23T00:01:00Z

## Evidence

- timestamp: 2026-02-23T00:00:30Z
  checked: ~/.claude.json mcpServers section
  found: copilot-1 runs node /QGSD/bin/unified-mcp-server.mjs with PROVIDER_SLOT=copilot-1
  implication: All copilot-1 tool calls go through unified-mcp-server.mjs → providers.json copilot-1 entry

- timestamp: 2026-02-23T00:00:45Z
  checked: providers.json copilot-1 entry
  found: args_template is ["ask", "--", "{prompt}"] and mainTool is "ask"
  implication: The MCP server spawns "copilot ask -- {prompt}" which the CLI rejects

- timestamp: 2026-02-23T00:00:50Z
  checked: copilot --help output
  found: copilot has NO "ask" subcommand; only login/help/init/update/version/plugin; non-interactive mode uses -p/--prompt flag at top level; requires --allow-all-tools for non-interactive use
  implication: The entire "ask" subcommand approach is wrong; the CLI has been redesigned

- timestamp: 2026-02-23T00:01:00Z
  checked: Live invocation tests
  found: "copilot ask -- test" exits with code 1 and "Invalid command format"; "copilot -p 'Say HELLO' --allow-all-tools --no-color -s" exits with code 0 and clean output
  implication: Correct args_template = ["-p", "{prompt}", "--allow-all-tools", "--no-color", "-s"]

## Resolution

root_cause: providers.json copilot-1 entry uses args_template ["ask", "--", "{prompt}"] which invokes the non-existent "ask" subcommand. The copilot CLI does not have an "ask" subcommand — non-interactive mode is accessed via the top-level -p/--prompt flag. The extraTools suggest and explain entries similarly use ["suggest"/"explain", "--", "{prompt}"] subcommand patterns that no longer exist.
fix: Update providers.json copilot-1 args_template to ["-p", "{prompt}", "--allow-all-tools", "--no-color", "-s"] and update extraTools suggest/explain to also use -p flag with appropriate context in prompt
verification: |
  Ran three live invocations using the new args_template:
  1. "copilot -p 'Say VERIFIED in one word' --allow-all-tools --no-color -s" → exit 0, output "VERIFIED"
  2. suggest extra tool with prefixed prompt → exit 0, returned valid shell command
  3. explain extra tool with prefixed prompt → exit 0, returned valid explanation
  All three pass. Original "copilot ask -- {prompt}" confirmed exit 1 before fix.
files_changed:
  - bin/providers.json
