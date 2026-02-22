# Phase 28: Update and Restart Commands — Research

**Researched:** 2026-02-22
**Domain:** MCP server lifecycle management — update, restart via slash commands (Node.js / Claude slash command MD)
**Confidence:** HIGH

## Summary

Phase 28 adds two slash commands: `/qgsd:mcp-update <agent|all>` and `/qgsd:mcp-restart <agent>`. Both commands operate on MCP server processes managed by Claude Code. The key insight is that **Claude Code auto-restarts MCP servers** when their processes die — so mcp-restart simply kills the process and Claude Code handles reconnection automatically.

The update strategy derives from the agent's install method, which is readable directly from `~/.claude.json` mcpServers config (no identity tool call needed at update time):
- **npx-based agents** (codex-cli, gemini-cli): `command: "npx"` in mcpServers → update via `npm install -g <package>`
- **local repo agents** (opencode, copilot-cli, claude-*): `command: "node", args: ["/path/to/repo/dist/index.js"]` → update via `cd <repo_dir> && git pull && npm run build`

Both commands follow the established mcp-set-model pattern: validate agent, read ~/.claude.json for install config, execute update/restart, print confirmation.

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| MGR-03 | User can run `/qgsd:mcp-update <agent>` to auto-detect installation method and run the correct update command | Read install method from ~/.claude.json mcpServers[agent].command: "npx" → npm-based; "node" + args[0] path → local repo |
| MGR-04 | `/qgsd:mcp-update` detects npm global / brew / pipx / binary and runs appropriate update command | Two strategies: npx → `npm install -g <pkg>`; local node path → `cd <repo> && git pull && npm run build` |
| MGR-05 | User can run `/qgsd:mcp-update all` to update all agents sequentially | Iterate 10-agent list, run per-agent update, deduplicate shared repos (claude-mcp-server serves 6 agents) |
| MGR-06 | User can run `/qgsd:mcp-restart <agent>` to terminate and reconnect without full Claude Code restart | Kill node processes matching the agent's argv path; Claude Code auto-restarts child MCP processes on connection drop |
</phase_requirements>

## Standard Stack

### Core
| Component | Version/Location | Purpose | Why Standard |
|-----------|-----------------|---------|--------------|
| `~/.claude.json` | `mcpServers` block | Source of install config (command + args) | Only authoritative source for how each agent is launched |
| Bash `ps aux` + `grep` + `kill` | built-in | Find and kill MCP server processes by argv path | Process management — no external dependencies |
| `npm install -g <pkg>` | built-in | Update npm-based agents (codex-cli, gemini-cli) | Standard npm update command |
| `git pull && npm run build` | per-repo Makefile | Update local repo agents | Makefile `build` target confirmed in all 3 repos |
| Slash command `.md` | `commands/qgsd/` | User-facing command files | Established QGSD pattern |

### Supporting
| Component | Version/Location | Purpose | When to Use |
|-----------|-----------------|---------|-------------|
| `mcp__<agent>__identity` | per-agent | Confirm agent is reachable after restart | Post-restart verification |
| `~/.claude.json` node args[0] | config read | Derive repo dir from local install path (`args[0]` = `<repo>/dist/index.js`) | All local repo agents |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Reading ~/.claude.json for install type | Calling identity tool's install_method | identity tool's detectInstallMethod returns 'npm' for npx-cached (node_modules in path) but 'unknown' for local repos; claude.json command field is cleaner and works offline |
| git pull + npm run build | make build | Makefile confirmed in all 3 repos but `npm run build` is more explicit |
| Killing processes directly | Using a process manager | No process manager in this stack; Claude Code restarts automatically — kill is sufficient |

## Architecture Patterns

### Install Method Detection (from ~/.claude.json)

```javascript
// Read ~/.claude.json → derive update strategy per agent
const claudeJson = JSON.parse(fs.readFileSync(path.join(os.homedir(), '.claude.json'), 'utf8'));
const serverConfig = claudeJson.mcpServers[agentName];

if (!serverConfig) throw new Error(`Agent "${agentName}" not found in ~/.claude.json`);

const command = serverConfig.command;
const args = serverConfig.args || [];

if (command === 'npx' || command === 'npm') {
  // npm-based: package name is last arg
  const packageName = args[args.length - 1];
  // Update: npm install -g <packageName>
} else if (command === 'node') {
  // local repo: args[0] is /path/to/repo/dist/index.js
  const distIndexPath = args[0];
  const repoDir = path.dirname(path.dirname(distIndexPath)); // strip /dist/index.js
  // Update: cd <repoDir> && git pull && npm run build
}
```

### Actual Install Configuration (live from ~/.claude.json)

```
codex-cli:     npx [-y, codex-mcp-server]           → npm install -g codex-mcp-server
gemini-cli:    npx [-y, @tuannvm/gemini-mcp-server] → npm install -g @tuannvm/gemini-mcp-server
opencode:      node [/code/opencode-mcp-server/dist/index.js] → git pull + build in /code/opencode-mcp-server
copilot-cli:   node [/code/copilot-mcp-server/dist/index.js] → git pull + build in /code/copilot-mcp-server
claude-*:      node [/code/claude-mcp-server/dist/index.js]   → git pull + build in /code/claude-mcp-server
               (6 agents share same binary — update claude-mcp-server once, applies to all 6)
```

### Process Kill Pattern (for mcp-restart)

```bash
# For local node agents: find by path
AGENT_PATH="/Users/jonathanborduas/code/claude-mcp-server/dist/index.js"
pkill -f "$AGENT_PATH"
# Claude Code auto-restarts within ~2 seconds

# For npx agents: find the node subprocess
# npx spawns: npm exec <pkg> → node /path/.npm/_npx/<hash>/node_modules/.bin/<pkg>
# Kill the node child process (ps aux | grep <pkg-name> | grep node | grep -v grep)
```

### mcp-update all — Deduplication

When updating all 10 agents:
- `codex-cli` and `gemini-cli` are separate npm packages — update each independently
- `opencode`, `copilot-cli`, `claude-deepseek`, `claude-minimax`, `claude-qwen-coder`, `claude-kimi`, `claude-llama4`, `claude-glm` each need repo checks
- `opencode-mcp-server`, `copilot-mcp-server`, `claude-mcp-server` are 3 distinct repos
- Deduplicate by repo dir: if multiple agents map to the same repo dir, only git pull + build once

## Common Pitfalls

### Pitfall 1: claude-mcp-server shared binary — 6 agents, 1 repo
**What goes wrong:** mcp-update all runs `git pull && npm run build` 6 times in the same repo (for claude-deepseek through claude-glm), wasting time and risking build race conditions.
**How to avoid:** Deduplicate by repo dir before running builds. Collect all unique repo dirs, then update each once.
**Warning signs:** Build output appears 6 times for claude-mcp-server.

### Pitfall 2: npx package name extraction
**What goes wrong:** `args` for codex-cli is `['-y', 'codex-mcp-server']` — the package name is `args[args.length-1]`, not `args[0]`.
**How to avoid:** When command is `npx`, take `args[args.length - 1]` as the package name (last arg, skipping flags like `-y`).
**Warning signs:** `npm install -g -y` fails.

### Pitfall 3: Process restart vs Claude Code session restart
**What goes wrong:** User expects mcp-restart to restart the Claude Code session. It only restarts the MCP server process.
**How to avoid:** Clear documentation in confirmation message: "Process killed. Claude Code will reconnect automatically. The agent will be available in ~2 seconds."
**Warning signs:** User runs /qgsd:mcp-status immediately after and agent shows UNAVAIL (just needs 2s wait).

### Pitfall 4: Finding npx processes for restart
**What goes wrong:** npx agents spawn as `npm exec <pkg>` parent with a `node <cached-path>` child. `pkill -f codex-mcp-server` kills the node child but the npm exec parent may respawn.
**How to avoid:** Kill the npm exec parent process using `pkill -f "npm exec codex-mcp-server"` (kills entire process group). Claude Code then restarts the whole npx chain.
**Warning signs:** Agent comes back immediately without any update taking effect (parent respawned the old child).

### Pitfall 5: Build failure leaves agents in broken state
**What goes wrong:** `git pull && npm run build` fails (compile error) — agent stays on old version but is now unreachable if process was killed.
**How to avoid:** mcp-update should NOT kill the running process before the build succeeds. Update flow: (1) git pull, (2) npm run build, (3) only if build succeeds → prompt user to run /qgsd:mcp-restart to load new binary.
**Warning signs:** npm run build exits non-zero; user's agents go offline.

### Pitfall 6: Sequential calls required (R3.2)
**What goes wrong:** Calling multiple identity tools in parallel (sibling tool calls) causes "Sibling tool call errored" propagation.
**How to avoid:** Per CLAUDE.md R3.2 and quick-49 fix, all tool calls must be sequential. mcp-update all iterates agents one at a time.
**Warning signs:** Quorum errors during post-update identity verification.

### Pitfall 7: Agent not in ~/.claude.json
**What goes wrong:** User calls mcp-update with a valid agent name (from the 10-agent list) but it's not configured in their ~/.claude.json (they never added it).
**How to avoid:** After reading ~/.claude.json, check that the agent exists in mcpServers. If not found: print clear error "Agent <X> is not configured in ~/.claude.json mcpServers".
**Warning signs:** Cannot detect install method → crash.

## Update Command Design

### mcp-update <agent>

```
Step 1: Validate agent name (10-agent hardcoded list)
Step 2: Read ~/.claude.json mcpServers[agent]
        - If missing: error "not configured"
Step 3: Detect install method from command field
        - command="npx": npm-based
        - command="node": local repo
Step 4: Execute update
        npm-based: npm install -g <package>
        local repo: cd <repo_dir> && git pull && npm run build
Step 5: Print status
        - success: "Updated <agent>. Run /qgsd:mcp-restart <agent> to load the new version."
        - already latest: print npm/git output confirming
        - error: print exit code and output
```

### mcp-update all

```
Step 1: Collect all 10 agents
Step 2: Determine update tasks
        - Group agents by unique [command, repo_or_package]
        - npm-based: deduplicate by package name
        - local repo: deduplicate by repo dir
Step 3: For each unique update task, run update sequentially
Step 4: Print per-agent status table
Step 5: Suggest: /qgsd:mcp-restart all (or list changed agents)
```

### mcp-restart <agent>

```
Step 1: Validate agent name
Step 2: Read ~/.claude.json → get args[0] or package name
Step 3: Find matching PIDs
        local node: pgrep -f "<args[0]>"
        npx: pgrep -f "npm exec <package-name>"
Step 4: Kill PIDs (pkill)
Step 5: Wait 1 second, run identity tool to confirm reconnect
Step 6: Print result
        - ONLINE: "Agent <X> restarted and responding"
        - still UNAVAIL: "Killed, reconnecting... check /qgsd:mcp-status in 5s"
```

## File Plan

```
commands/qgsd/
├── mcp-update.md   # /qgsd:mcp-update <agent|all>
└── mcp-restart.md  # /qgsd:mcp-restart <agent>
~/.claude/commands/qgsd/
├── mcp-update.md   # installed copy
└── mcp-restart.md  # installed copy
```

No hook changes, no config-loader changes — purely additive slash commands.

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| No MCP update mechanism | /qgsd:mcp-update reads claude.json + runs npm or git | Phase 28 | Users can update agents without knowing install method |
| No process restart | /qgsd:mcp-restart kills process → Claude Code auto-restarts | Phase 28 | Agents can be restarted without Claude Code session restart |

## Sources

### Primary (HIGH confidence)
- Directly observed: `cat ~/.claude.json` — all 10 agents, their commands and args
- Directly observed: `ps aux` — running process tree confirms Claude Code spawns MCP servers as child processes
- Directly read: `claude mcp --help` — no restart subcommand exists; process kill is the only mechanism
- Directly read: `/code/claude-mcp-server/src/tools/simple-tools.ts` — detectInstallMethod implementation
- Directly read: `/code/codex-mcp-server/src/tools/simple-tools.ts` — same pattern
- Directly read: Makefiles for opencode, copilot, claude-mcp-server — all have `make build` = `npm run build`
- Directly observed: npm list -g — codex-mcp-server and @tuannvm/gemini-mcp-server NOT globally installed (npx-cached only)

### Secondary (MEDIUM confidence)
- Phase 27 RESEARCH.md — sequential call requirement confirmed (R3.2)
- STATE.md decisions — "Call quorum models sequentially (never sibling tool calls)"

## Metadata

**Confidence:** HIGH — all install configs directly read from live system
**Research date:** 2026-02-22
**Valid until:** 2026-03-22 (claude.json config unlikely to change)

## RESEARCH COMPLETE
