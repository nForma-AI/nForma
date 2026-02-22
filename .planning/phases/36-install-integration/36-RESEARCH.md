# Phase 36 Research — Install Integration (INST-01)

## Requirement

**INST-01**: Installer detects no configured quorum agents and prompts user to run `/qgsd:mcp-setup`

Success criteria:
1. `npx qgsd@latest` on a machine with no recognized quorum agent entries in `~/.claude.json` → prints: "No quorum agents configured. Run /qgsd:mcp-setup in Claude Code to set up your agents."
2. `npx qgsd@latest` on a machine that already has quorum agents configured → does NOT show the nudge

## Key Discovery: What "quorum agents" means in this context

The INST-01 requirement is about **claude-mcp-server instances** — the quorum agents being set up by the wizard (Phases 32-35). These are the 5 templates:
- claude-deepseek, claude-minimax, claude-qwen-coder, claude-llama4, claude-kimi

The existing QGSD_KEYWORD_MAP checks for `codex`, `gemini`, `opencode` — these are the native CLI quorum agents, not the claude-mcp-server instances. The installer already warns about these. INST-01 is about detecting whether any **claude-mcp-server** agents are configured.

## How to Detect "No quorum agents configured"

### What to check
Read `~/.claude.json` → `mcpServers`. Look for any server where:
- `args` array contains a path that includes `claude-mcp-server`
- OR the server name matches the 5 known template names (claude-deepseek, claude-minimax, claude-qwen-coder, claude-llama4, claude-kimi)

If zero matches: show the nudge.

### Detection approach (simple and reliable)
```js
function hasClaudeMcpAgents() {
  const claudeJsonPath = path.join(os.homedir(), '.claude.json');
  try {
    if (!fs.existsSync(claudeJsonPath)) return false;
    const d = JSON.parse(fs.readFileSync(claudeJsonPath, 'utf8'));
    const mcpServers = d.mcpServers || {};
    return Object.entries(mcpServers).some(([name, cfg]) => {
      // Match by name (known templates)
      const knownNames = ['claude-deepseek', 'claude-minimax', 'claude-qwen-coder', 'claude-llama4', 'claude-kimi'];
      if (knownNames.includes(name)) return true;
      // Match by args path (any claude-mcp-server path)
      if ((cfg.args || []).some(a => String(a).includes('claude-mcp-server'))) return true;
      return false;
    });
  } catch (e) {
    return false; // fail-open — don't block install
  }
}
```

## Where to Insert the Nudge

### Location: `finishInstall()` function (line ~1883 in bin/install.js)

`finishInstall()` is called at the end of every install for every runtime. It prints the "Done!" message. The nudge should be inserted in the Claude Code runtime path specifically (since `/qgsd:mcp-setup` is a Claude Code slash command).

Current `finishInstall()` output:
```
  Done! Launch Claude Code and run /qgsd:help.

  Join the community: https://discord.gg/5JJgD5svVS
```

With INST-01 nudge (when no claude-mcp-server agents detected and runtime is claude):
```
  Done! Launch Claude Code and run /qgsd:help.

  ⚠ No quorum agents configured.
    Run /qgsd:mcp-setup in Claude Code to set up your agents.

  Join the community: https://discord.gg/5JJgD5svVS
```

When agents ARE configured: no change to output.

## What NOT to do

- Do NOT block the install — fail-open
- Do NOT show the nudge for non-Claude runtimes (Gemini, OpenCode) — `/qgsd:mcp-setup` is Claude Code only
- Do NOT use `console.warn()` — use `console.log()` with yellow warning color (matches existing style)
- Do NOT repeat the nudge multiple times — once at finishInstall is enough

## Implementation Location

File: `bin/install.js`

Function: `finishInstall()` (~line 1883). Add `hasClaudeMcpAgents()` helper function near existing `warnMissingMcpServers()` (~line 227). Add nudge inside `finishInstall()` when `runtime === 'claude'` and `!hasClaudeMcpAgents()`.

## Verification

1. `grep -n "INST-01\|mcp-setup\|quorum agents configured" bin/install.js` returns >= 3 matches (comment reference + hasClaudeMcpAgents + finishInstall nudge)
2. `node -e "..."` inline test: call finishInstall with mock state (no agents) → nudge appears; call with agents → no nudge
3. No "Phase 36" references in operational code

## RESEARCH COMPLETE
