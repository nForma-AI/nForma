---
name: qgsd:mcp-set-model
description: Set the default model for a quorum agent — validates against the agent's available_models and persists to ~/.claude/qgsd.json
argument-hint: "<agent> <model>"
allowed-tools:
  - Bash
  - mcp__codex-cli__identity
  - mcp__gemini-cli__identity
  - mcp__opencode__identity
  - mcp__copilot-cli__identity
  - mcp__claude-deepseek__identity
  - mcp__claude-minimax__identity
  - mcp__claude-qwen-coder__identity
  - mcp__claude-kimi__identity
  - mcp__claude-llama4__identity
  - mcp__claude-glm__identity
---

<objective>
Set the default model for a named quorum agent. The preference is written to `~/.claude/qgsd.json` under `model_preferences` and is picked up by the QGSD prompt hook on the next quorum invocation.
</objective>

<process>

## Step 1 — Parse arguments

Parse `$ARGUMENTS` as two tokens: `$AGENT` and `$MODEL`.

If either token is missing, print usage and stop:
```
Usage: /qgsd:mcp-set-model <agent> <model>

Valid agents:
  codex-cli, gemini-cli, opencode, copilot-cli,
  claude-deepseek, claude-minimax, claude-qwen-coder,
  claude-kimi, claude-llama4, claude-glm
```

## Step 2 — Validate agent name

Check `$AGENT` against the known agent list:
```
codex-cli, gemini-cli, opencode, copilot-cli,
claude-deepseek, claude-minimax, claude-qwen-coder,
claude-kimi, claude-llama4, claude-glm
```

If not in the list, print an error and stop:
```
Error: Unknown agent "$AGENT"

Valid agents:
  codex-cli       gemini-cli       opencode         copilot-cli
  claude-deepseek claude-minimax   claude-qwen-coder claude-kimi
  claude-llama4   claude-glm
```

## Step 3 — Fetch available_models from identity tool

Call the identity tool for `$AGENT` — one sequential call:

`mcp__<$AGENT>__identity`

(Replace hyphens in the agent name with hyphens as-is: `codex-cli` → `mcp__codex-cli__identity`)

Parse the response. Extract the `available_models` array.

If the tool call errors or times out, print a warning and proceed to manual confirmation:
```
Warning: Could not reach $AGENT identity tool — cannot validate model name.
Proceeding with write (unvalidated).
```
Skip the model validation in Step 4 and go directly to Step 5.

## Step 4 — Validate model name

Check if `$MODEL` appears in the `available_models` array from Step 3.

If NOT in the list, print an error and stop:
```
Error: Model "$MODEL" is not in $AGENT's available_models list.

Available models for $AGENT:
  <list each model on its own line>

Run /qgsd:mcp-set-model $AGENT <model> with one of the above models.
```

## Step 5 — Write model preference to qgsd.json

Run this inline node script via Bash:

```bash
node -e "
const fs = require('fs');
const path = require('path');
const os = require('os');

const cfgPath = path.join(os.homedir(), '.claude', 'qgsd.json');

let cfg;
try {
  cfg = JSON.parse(fs.readFileSync(cfgPath, 'utf8'));
} catch (e) {
  // File missing or malformed — start with minimal defaults
  cfg = { quorum_commands: ['plan-phase', 'new-project', 'new-milestone', 'discuss-phase', 'verify-work', 'research-phase', 'quick'] };
}

const oldModel = (cfg.model_preferences || {})[process.env.AGENT] || null;
cfg.model_preferences = cfg.model_preferences || {};
cfg.model_preferences[process.env.AGENT] = process.env.MODEL;

fs.writeFileSync(cfgPath, JSON.stringify(cfg, null, 2) + '\n');

const result = { oldModel, newModel: process.env.MODEL, agent: process.env.AGENT };
process.stdout.write(JSON.stringify(result) + '\n');
" AGENT="$AGENT" MODEL="$MODEL"
```

Parse the JSON output to get `oldModel` and `newModel`.

## Step 6 — Print confirmation

Display:
```
Model preference updated

  Agent:     $AGENT
  Old model: <oldModel or "(none — using agent default)">
  New model: $MODEL

The preference is saved to ~/.claude/qgsd.json.
The next quorum invocation will pass model="$MODEL" when calling $AGENT.
```

</process>
