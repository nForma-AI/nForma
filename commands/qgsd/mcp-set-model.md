---
name: qgsd:mcp-set-model
description: Set the default model for a quorum agent — validates against the agent's available_models and persists to ~/.claude/qgsd.json
argument-hint: "<agent> <model>"
allowed-tools:
  - Bash
  - mcp__codex-cli-1__identity
  - mcp__gemini-cli-1__identity
  - mcp__opencode-1__identity
  - mcp__copilot-1__identity
  - mcp__claude-1__identity
  - mcp__claude-2__identity
  - mcp__claude-3__identity
  - mcp__claude-4__identity
  - mcp__claude-5__identity
  - mcp__claude-6__identity
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
  codex-cli-1, gemini-cli-1, opencode-1, copilot-1,
  claude-1, claude-2, claude-3, claude-4, claude-5, claude-6
```

## Step 2 — Validate agent name

Check `$AGENT` against the known agent list:
```
codex-cli-1, gemini-cli-1, opencode-1, copilot-1,
claude-1, claude-2, claude-3, claude-4, claude-5, claude-6
```

If not in the list, print an error and stop:
```
Error: Unknown agent "$AGENT"

Valid agents:
  codex-cli-1   gemini-cli-1   opencode-1   copilot-1
  claude-1      claude-2       claude-3     claude-4
  claude-5      claude-6
```

## Step 3 — Fetch available_models from identity tool

Call the identity tool for `$AGENT` — one sequential call:

`mcp__<$AGENT>__identity`

(Replace hyphens in the agent name with hyphens as-is: `codex-cli-1` → `mcp__codex-cli-1__identity`)

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
