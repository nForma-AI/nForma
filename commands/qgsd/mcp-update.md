---
name: qgsd:mcp-update
description: Update a quorum agent to its latest version — detects install method from ~/.claude.json and runs the correct update command
argument-hint: "<agent|all>"
allowed-tools:
  - Bash
---

<objective>
Update a named quorum agent (or all agents) to their latest version. The install method is detected from `~/.claude.json` mcpServers config: `npx`-based agents update via `npm install -g <package>`; `node`-based local repo agents update via `git pull && npm run build` in their repo directory. The running process is NOT killed — run `/qgsd:mcp-restart <agent>` after updating to load the new binary.
</objective>

<process>

## Step 1 — Parse arguments

Parse `$ARGUMENTS` as one token: `$TARGET`.

If `$TARGET` is missing, print usage and stop:
```
Usage: /qgsd:mcp-update <agent|all>

Valid agents:
  codex-cli, gemini-cli, opencode, copilot-cli,
  claude-deepseek, claude-minimax, claude-qwen-coder,
  claude-kimi, claude-llama4, claude-glm

Use "all" to update all configured agents sequentially.
```

## Step 2 — Validate agent name (single agent mode)

If `$TARGET` is not `"all"`:

Check `$TARGET` against the known agent list:
```
codex-cli, gemini-cli, opencode, copilot-cli,
claude-deepseek, claude-minimax, claude-qwen-coder,
claude-kimi, claude-llama4, claude-glm
```

If not in the list, print an error and stop:
```
Error: Unknown agent "$TARGET"

Valid agents:
  codex-cli       gemini-cli       opencode         copilot-cli
  claude-deepseek claude-minimax   claude-qwen-coder claude-kimi
  claude-llama4   claude-glm

Use "all" to update all configured agents.
```

## Step 3 — Read install config from ~/.claude.json

Run this inline node script via Bash to read the install configuration:

**For single agent:**
```bash
node -e "
const fs = require('fs');
const path = require('path');
const os = require('os');

const claudeJsonPath = path.join(os.homedir(), '.claude.json');
let claudeJson;
try {
  claudeJson = JSON.parse(fs.readFileSync(claudeJsonPath, 'utf8'));
} catch (e) {
  console.error('Error: Cannot read ~/.claude.json: ' + e.message);
  process.exit(1);
}

const servers = claudeJson.mcpServers || {};
const agent = process.env.AGENT;
const serverConfig = servers[agent];

if (!serverConfig) {
  console.error('Error: Agent \"' + agent + '\" is not configured in ~/.claude.json mcpServers');
  process.exit(2);
}

const command = serverConfig.command;
const args = serverConfig.args || [];

let result;
if (command === 'npx' || command === 'npm') {
  // npm/npx-based: package name is last arg (skip flags like -y)
  const packageName = args[args.length - 1];
  result = { type: 'npm', package: packageName };
} else if (command === 'node' && args.length > 0) {
  // local node path: args[0] = /path/to/repo/dist/index.js
  const distIndexPath = args[0];
  const repoDir = path.dirname(path.dirname(distIndexPath));
  result = { type: 'local', repoDir };
} else {
  result = { type: 'unknown', command, args };
}

process.stdout.write(JSON.stringify(result) + '\n');
" AGENT="$TARGET"
```

Store output as `$INSTALL_INFO`.

If exit code 1 or 2: print the error message and stop.
If exit code 0: parse `$INSTALL_INFO` JSON.

## Step 4 — Execute update (single agent)

Based on the `type` field from `$INSTALL_INFO`:

**type = "npm":**
```bash
npm install -g "$PACKAGE"
```
where `$PACKAGE` is `install_info.package`.

Capture exit code and output. If exit code ≠ 0: print error output and stop.

**type = "local":**
```bash
cd "$REPO_DIR" && git pull && npm run build
```
where `$REPO_DIR` is `install_info.repoDir`.

Capture exit code and output. If exit code ≠ 0: print error output and stop.
**Important:** Do NOT kill the running process if build fails.

**type = "unknown":**
Print:
```
Warning: Cannot determine update method for $TARGET (command: <command>).
Manual update required. Check ~/.claude.json mcpServers.$TARGET for configuration.
```
Stop.

## Step 5 — Print confirmation (single agent)

Display:
```
Updated $TARGET

  Install method: <npm: npm install -g <pkg>> OR <local repo: git pull + npm run build in <repo_dir>>
  Result: <last line of npm/git output>

Note: The running agent process is still using the old version.
Run: /qgsd:mcp-restart $TARGET   to load the new binary.
```

## Step 6 — All-agent mode (if $TARGET = "all")

If `$TARGET` is `"all"`, skip Steps 2–5 and run this instead:

**6a. Build update task list via inline node script:**

```bash
node -e "
const fs = require('fs');
const path = require('path');
const os = require('os');

const KNOWN_AGENTS = [
  'codex-cli', 'gemini-cli', 'opencode', 'copilot-cli',
  'claude-deepseek', 'claude-minimax', 'claude-qwen-coder',
  'claude-kimi', 'claude-llama4', 'claude-glm'
];

const claudeJsonPath = path.join(os.homedir(), '.claude.json');
const claudeJson = JSON.parse(fs.readFileSync(claudeJsonPath, 'utf8'));
const servers = claudeJson.mcpServers || {};

const tasks = [];
const seenKeys = new Set();

for (const agent of KNOWN_AGENTS) {
  const cfg = servers[agent];
  if (!cfg) {
    tasks.push({ agent, type: 'not_configured' });
    continue;
  }
  const cmd = cfg.command;
  const args = cfg.args || [];

  if (cmd === 'npx' || cmd === 'npm') {
    const pkg = args[args.length - 1];
    const key = 'npm:' + pkg;
    if (seenKeys.has(key)) {
      tasks.push({ agent, type: 'npm', package: pkg, deduplicated: true });
    } else {
      seenKeys.add(key);
      tasks.push({ agent, type: 'npm', package: pkg, deduplicated: false });
    }
  } else if (cmd === 'node' && args.length > 0) {
    const repoDir = path.dirname(path.dirname(args[0]));
    const key = 'local:' + repoDir;
    if (seenKeys.has(key)) {
      tasks.push({ agent, type: 'local', repoDir, deduplicated: true });
    } else {
      seenKeys.add(key);
      tasks.push({ agent, type: 'local', repoDir, deduplicated: false });
    }
  } else {
    tasks.push({ agent, type: 'unknown', command: cmd });
  }
}

process.stdout.write(JSON.stringify(tasks) + '\n');
"
```

**6b. For each task in the list, sequentially:**
- If `deduplicated: true`: mark as `SKIPPED (shared repo already updated)` — do not run again
- If `type: "npm"` and `deduplicated: false`: run `npm install -g <package>`
- If `type: "local"` and `deduplicated: false`: run `cd <repoDir> && git pull && npm run build`
- If `type: "not_configured"`: mark as `NOT CONFIGURED`
- If `type: "unknown"`: mark as `UNKNOWN (manual update required)`

**6c. Print per-agent status table:**
```
Update results:

  codex-cli       npm install -g codex-mcp-server      ✓ UPDATED
  gemini-cli      npm install -g @tuannvm/gemini-...   ✓ UPDATED
  opencode        git pull + build in /code/opencode   ✓ UPDATED
  copilot-cli     git pull + build in /code/copilot    ✓ UPDATED
  claude-deepseek git pull + build in /code/claude-m   ✓ UPDATED
  claude-minimax  (shared repo with claude-deepseek)   ⚡ SKIPPED
  claude-qwen-coder (shared repo)                      ⚡ SKIPPED
  claude-kimi     (shared repo)                        ⚡ SKIPPED
  claude-llama4   (shared repo)                        ⚡ SKIPPED
  claude-glm      (shared repo)                        ⚡ SKIPPED

To load new binaries, restart updated agents:
  /qgsd:mcp-restart codex-cli
  /qgsd:mcp-restart gemini-cli
  /qgsd:mcp-restart opencode
  (etc. — list only agents that were UPDATED, not SKIPPED)
```

</process>
