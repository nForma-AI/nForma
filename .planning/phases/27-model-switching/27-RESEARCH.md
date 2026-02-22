# Phase 27: Model Switching - Research

**Researched:** 2026-02-22
**Domain:** CLI slash command + config persistence + hook injection (Node.js / JSON / Claude slash commands)
**Confidence:** HIGH

## Summary

Phase 27 adds `/qgsd:mcp-set-model <agent> <model>` — a slash command that writes a `model_preferences` block to `~/.claude/qgsd.json` and causes subsequent quorum invocations to pass an explicit `model:` argument in each MCP tool call. The feature touches three layers: a new slash command (discovery + validation + write), `config-loader.js` (new config key), and `qgsd-prompt.js` (inject model overrides into the quorum context string).

All 10 quorum agents expose an `identity` tool that returns `{ name, version, model, available_models, install_method }`. The `available_models` list is the validation source — a model is valid if and only if it appears in the running server's identity response. The claude-mcp-server instances accept a `model: string` parameter directly in the `claude` and `review` tool schemas. Codex and copilot also accept `model` parameters. Gemini's `ask-gemini.tool.ts` accepts `model`. The injection mechanism is the `quorum_instructions` string that `qgsd-prompt.js` appends to Claude's context — adding a "Model overrides" sub-section tells Claude which `model:` value to pass when constructing each MCP tool call.

The entire change is confined to well-understood existing patterns: the config-loader's two-layer merge, the prompt hook's additionalContext injection, and the identity-polling pattern from Phase 26. No new external dependencies are needed. The two sync points (hooks/dist/ rebuild and ~/.claude/hooks/ copy) are mandatory as in every prior hook change.

**Primary recommendation:** Implement as three discrete changes — new slash command file, config-loader update (new key + validation), prompt hook update (read model_preferences, append override block to injected instructions). One plan is sufficient.

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| MGR-01 | User can run `/qgsd:mcp-set-model <agent> <model>` to set the default model for a quorum worker | New slash command `commands/qgsd/mcp-set-model.md` calls identity, validates model is in `available_models`, writes to `qgsd.json`, prints confirmation with old+new model |
| MGR-02 | Default model preference persists in `qgsd.json` and is injected into subsequent quorum tool calls | `config-loader.js` reads `model_preferences` block; `qgsd-prompt.js` appends "Model overrides" section to injected instructions; Claude reads override and passes `model: <X>` when calling the agent's MCP tool |
</phase_requirements>

## Standard Stack

### Core
| Component | Version/Location | Purpose | Why Standard |
|-----------|-----------------|---------|--------------|
| `config-loader.js` | `hooks/config-loader.js` | Two-layer config read/write (global + project) | All QGSD config flows here |
| `qgsd-prompt.js` | `hooks/qgsd-prompt.js` | UserPromptSubmit hook — injects quorum instructions | Existing injection point for quorum context |
| Slash command `.md` | `commands/qgsd/mcp-set-model.md` | User-facing command file | Established pattern for all qgsd commands |
| Node.js `fs` module | built-in | JSON config read/write | Used throughout hooks |

### Supporting
| Component | Version/Location | Purpose | When to Use |
|-----------|-----------------|---------|-------------|
| `identity` MCP tool | per-agent (all 10 agents) | Returns `available_models` for validation | Called at set-model time to validate model |
| `hooks/dist/` rebuild | `cp hooks/*.js hooks/dist/` | Keeps installed copy in sync | Required after any hook change |
| `~/.claude/hooks/` sync | `cp` to installed path | Keeps running hooks in sync | Required after any hook change |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Identity tool for validation | Hardcoded model lists | Identity is live truth; hardcoded goes stale when providers add models |
| Appending to quorum_instructions text | New config key read by quorum.md directly | Hook injection is the only reliable enforcement path — quorum.md only runs for /qgsd:quorum; quorum_instructions covers all quorum-gated commands |
| Global qgsd.json only | Project-scoped qgsd.json | REQUIREMENTS.md "Out of Scope" item explicitly says per-project config is out of scope; write to global only |

**Installation:** No new packages needed.

## Architecture Patterns

### Recommended File Changes
```
hooks/
├── config-loader.js     # Add model_preferences key to DEFAULT_CONFIG + validation
├── qgsd-prompt.js       # Read model_preferences, append override block to injected instructions
└── dist/
    ├── config-loader.js # Rebuilt copy (cp hooks/config-loader.js hooks/dist/)
    └── qgsd-prompt.js   # Rebuilt copy
commands/qgsd/
└── mcp-set-model.md     # New slash command (source)
~/.claude/
├── hooks/
│   ├── config-loader.js # Installed copy — must be synced
│   └── qgsd-prompt.js   # Installed copy — must be synced
├── commands/qgsd/
│   └── mcp-set-model.md # Installed copy — must be synced
└── qgsd.json            # Gets new model_preferences block written by command
```

### Pattern 1: Config Key Addition (config-loader.js)
**What:** Add `model_preferences: {}` to DEFAULT_CONFIG. Add validation that asserts the value is a plain object with string keys and string values. Shallow merge from global and project layers already works — model_preferences at project scope overrides global scope.

**When to use:** Any new top-level config key that agents or hooks read.

**Example:**
```javascript
// Source: hooks/config-loader.js (existing pattern)
const DEFAULT_CONFIG = {
  quorum_commands: [...],
  fail_mode: 'open',
  required_models: {...},
  circuit_breaker: {...},
  model_preferences: {},  // NEW: { "<agent>": "<model>" }
};

// Validation addition
if (typeof config.model_preferences !== 'object' || config.model_preferences === null || Array.isArray(config.model_preferences)) {
  process.stderr.write('[qgsd] WARNING: qgsd.json: model_preferences must be an object; using {}\n');
  config.model_preferences = {};
}
```

### Pattern 2: Quorum Instructions Injection Override (qgsd-prompt.js)
**What:** After reading `config.model_preferences`, if any entries exist, append a "Model overrides" block to the instructions string before writing to additionalContext. This tells Claude to pass `model: <X>` when calling the specified agent's MCP tool.

**When to use:** When a config value needs to affect how Claude constructs tool calls.

**Example:**
```javascript
// Source: hooks/qgsd-prompt.js (new addition)
const prefs = config.model_preferences || {};
const overrides = Object.entries(prefs);
let instructions = config.quorum_instructions || DEFAULT_QUORUM_INSTRUCTIONS_FALLBACK;

if (overrides.length > 0) {
  const overrideLines = overrides
    .map(([agent, model]) => `  - ${agent}: pass model="${model}" as a parameter in the tool call`)
    .join('\n');
  instructions += `\n\nModel overrides (from qgsd.json model_preferences):\n${overrideLines}`;
}
```

### Pattern 3: Slash Command with Identity Validation
**What:** New `mcp-set-model.md` slash command calls the agent's identity tool to get `available_models`, validates the requested model, then uses a Bash inline node script to read-modify-write `~/.claude/qgsd.json`.

**When to use:** Any management command that needs live agent data for validation.

**Example structure for mcp-set-model.md:**
```markdown
---
name: qgsd:mcp-set-model
description: Set the default model for a quorum agent (persists to qgsd.json)
argument-hint: "<agent> <model>"
allowed-tools:
  - Bash
---

<process>

## Step 1 — Parse arguments
$ARGUMENTS format: "<agent> <model>"
Parse into $AGENT and $MODEL. If either missing, print usage and stop.

## Step 2 — Call identity to validate
Call `mcp__<agent>__identity` (replace hyphens: agent "codex-cli" → tool `mcp__codex-cli__identity`).
Parse `available_models` array. If $MODEL not in list, print error and stop.

## Step 3 — Read current qgsd.json, update model_preferences, write back
```bash
node -e "
const fs = require('fs');
const path = require('path');
const os = require('os');
const p = path.join(os.homedir(), '.claude', 'qgsd.json');
const cfg = JSON.parse(fs.readFileSync(p, 'utf8'));
const old = (cfg.model_preferences || {})[process.env.AGENT] || '(default)';
cfg.model_preferences = cfg.model_preferences || {};
cfg.model_preferences[process.env.AGENT] = process.env.MODEL;
fs.writeFileSync(p, JSON.stringify(cfg, null, 2));
console.log(JSON.stringify({old}));
" AGENT="$AGENT" MODEL="$MODEL"
```

## Step 4 — Print confirmation
Display: agent, old model, new model
```
</process>
```

### Anti-Patterns to Avoid
- **Writing to project qgsd.json:** Per REQUIREMENTS.md "Out of Scope" table: "Per-project MCP configurations — Global-only install pattern." Always write to `~/.claude/qgsd.json`.
- **Hardcoding available_models lists:** Models change. Always fetch from identity tool at validation time.
- **Skipping hooks/dist/ rebuild:** The Stop hook and prompt hook read from dist/. Forgetting the rebuild means the change won't take effect.
- **Sibling tool calls in the slash command:** The identity call must be a single sequential call (per CLAUDE.md R3.2 and quick-49 fix).
- **Modifying `quorum_instructions` stored value in qgsd.json:** Only add `model_preferences` key. The base instructions string stays as-is; the hook appends overrides dynamically.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Model validation list | Custom hardcoded array per agent | `identity` tool `available_models` | Identity is authoritative and reflects running server; hardcoded lists go stale |
| Config read/write | New file-read logic | Extend existing `config-loader.js` | Two-layer merge and validation already handles the hard cases |
| Override propagation | New hook or separate config file | Append to `quorum_instructions` in `qgsd-prompt.js` | The injection point already exists; piggybacking is simpler and more reliable |

**Key insight:** The `quorum_instructions` string is a free-text instruction block. It can carry any guidance to Claude, including "when calling tool X, include parameter Y=Z." Claude's instruction-following is the propagation mechanism — no code needs to intercept MCP calls.

## Common Pitfalls

### Pitfall 1: Agent Name Format Mismatch
**What goes wrong:** The MCP tool name is `mcp__codex-cli__identity` but the config key written to `model_preferences` might be inconsistently formatted (e.g., `codex` vs `codex-cli`).
**Why it happens:** mcp-status uses "stripped" display names (removing `claude-` prefix), while tool names use full MCP server names.
**How to avoid:** Standardize on the MCP server name as the agent key (the key in `~/.claude.json` mcpServers): `codex-cli`, `gemini-cli`, `opencode`, `copilot-cli`, `claude-deepseek`, `claude-minimax`, `claude-qwen-coder`, `claude-kimi`, `claude-llama4`, `claude-glm`. The slash command should validate the input against this known list before calling identity.
**Warning signs:** Model override injected in quorum_instructions uses a name that doesn't match any tool call in the instructions.

### Pitfall 2: Model Override Not Reaching the Right Tool Parameter
**What goes wrong:** The injected override text says "pass model=X for agent Y" but Claude calls the tool without the model parameter, or uses the wrong parameter name.
**Why it happens:** Different agents use different tool names and parameter schemas. For claude-mcp-server instances, the primary call is `mcp__<name>__claude` with `prompt:` and `model:`. For codex-cli, it's `mcp__codex-cli__review` with `prompt:` and `model:`. For gemini-cli, it's `mcp__gemini-cli__gemini` with `prompt:` and `model:`.
**How to avoid:** The override block in the injected instructions must name the exact tool and exact parameter. E.g., "When calling mcp__codex-cli__review, include model='gpt-4o' in the tool input."
**Warning signs:** Success criterion 3 fails — quorum instructions contain the override but the actual tool call in the transcript doesn't include the model parameter.

### Pitfall 3: Shallow Merge Clobbers model_preferences
**What goes wrong:** The two-layer config merge (`{...DEFAULT_CONFIG, ...global, ...project}`) is a shallow merge. If a project-level `qgsd.json` has `model_preferences: {}`, it replaces the global preferences entirely.
**Why it happens:** JS spread shallow-merges objects — nested keys from global are wiped.
**How to avoid:** Per REQUIREMENTS.md Out of Scope: project-scoped config is out of scope. The command always writes to the global `~/.claude/qgsd.json`. There is no project-level model_preferences to worry about. Document this in the slash command as a note.
**Warning signs:** User sets a model preference, runs a command in a project that has a local qgsd.json, and the override doesn't appear.

### Pitfall 4: Old Model Not Captured Before Write
**What goes wrong:** Confirmation prints "old model: (none)" when there was actually a prior override.
**Why it happens:** Code reads from the wrong key or doesn't check model_preferences before overwriting.
**How to avoid:** Read `cfg.model_preferences[agent]` before writing the new value and store it as `old_model`.
**Warning signs:** Success criterion 1 fails — confirmation doesn't show old model correctly.

### Pitfall 5: Hook Sync Skipped
**What goes wrong:** Changes to `hooks/qgsd-prompt.js` or `hooks/config-loader.js` don't take effect for the running Claude Code session.
**Why it happens:** The running hooks are read from `~/.claude/hooks/` (installed copies), not the source `hooks/` directory. Changes must be copied to both `hooks/dist/` and `~/.claude/hooks/`.
**How to avoid:** Every plan that touches hooks must include a sync step:
  1. `cp hooks/qgsd-prompt.js hooks/dist/qgsd-prompt.js`
  2. `cp hooks/config-loader.js hooks/dist/config-loader.js`
  3. `cp hooks/dist/qgsd-prompt.js ~/.claude/hooks/qgsd-prompt.js`
  4. `cp hooks/dist/config-loader.js ~/.claude/hooks/config-loader.js`
**Warning signs:** Config change test passes in unit test but override doesn't appear in actual quorum injection.

### Pitfall 6: Unrecognized Agent Not Caught Before Identity Call
**What goes wrong:** User passes a typo agent name; the command tries to call `mcp__typo__identity` which either errors badly or hangs.
**Why it happens:** No pre-validation of agent name.
**How to avoid:** Validate agent name against the known 10-agent list before calling identity. Produce a clear error message listing valid agent names.
**Warning signs:** Success criterion 4 fails — unrecognized agent name doesn't produce a clear error.

## Code Examples

Verified patterns from existing source:

### Reading and writing qgsd.json (pattern from install.js)
```javascript
// Source: QGSD codebase — established pattern for config JSON R/W
const fs = require('fs');
const path = require('path');
const os = require('os');

const globalPath = path.join(os.homedir(), '.claude', 'qgsd.json');
const cfg = JSON.parse(fs.readFileSync(globalPath, 'utf8'));
const oldModel = (cfg.model_preferences || {})[agentName] || null;
cfg.model_preferences = cfg.model_preferences || {};
cfg.model_preferences[agentName] = newModel;
fs.writeFileSync(globalPath, JSON.stringify(cfg, null, 2) + '\n');
```

### Building the override injection block (new code in qgsd-prompt.js)
```javascript
// Source: hooks/qgsd-prompt.js — extension of existing injection pattern
const prefs = config.model_preferences || {};
const overrideEntries = Object.entries(prefs).filter(([, m]) => m && typeof m === 'string');

if (overrideEntries.length > 0) {
  const lines = overrideEntries.map(([agent, model]) => {
    // Map agent key to the canonical tool call instruction
    return `  - mcp__${agent}: pass model="${model}" in the tool input`;
  }).join('\n');
  instructions += `\n\nModel overrides (qgsd model_preferences):\n` +
    `The following agents have preferred models set. When calling their tools, ` +
    `include the specified model parameter:\n${lines}`;
}
```

### Config validation for new key (config-loader.js)
```javascript
// Source: hooks/config-loader.js — follows existing validation pattern
if (typeof config.model_preferences !== 'object' ||
    config.model_preferences === null ||
    Array.isArray(config.model_preferences)) {
  process.stderr.write('[qgsd] WARNING: qgsd.json: model_preferences must be an object; using {}\n');
  config.model_preferences = {};
} else {
  // Remove invalid entries silently — don't crash on bad values
  for (const [key, val] of Object.entries(config.model_preferences)) {
    if (typeof val !== 'string') {
      process.stderr.write(`[qgsd] WARNING: qgsd.json: model_preferences.${key} must be a string; removing\n`);
      delete config.model_preferences[key];
    }
  }
}
```

### Agent name to tool call mapping (for quorum instructions override)
```
Known agents and their primary quorum tool calls:
  codex-cli     → mcp__codex-cli__review      (prompt: string, model?: string)
  gemini-cli    → mcp__gemini-cli__gemini      (prompt: string, model?: string)
  opencode      → mcp__opencode__opencode       (prompt: string, model?: string)
  copilot-cli   → mcp__copilot-cli__ask         (prompt: string, model?: string)
  claude-deepseek   → mcp__claude-deepseek__claude  (prompt: string, model?: string)
  claude-minimax    → mcp__claude-minimax__claude   (prompt: string, model?: string)
  claude-qwen-coder → mcp__claude-qwen-coder__claude (prompt: string, model?: string)
  claude-kimi       → mcp__claude-kimi__claude       (prompt: string, model?: string)
  claude-llama4     → mcp__claude-llama4__claude     (prompt: string, model?: string)
  claude-glm        → mcp__claude-glm__claude        (prompt: string, model?: string)
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Hardcoded model in env var (CLAUDE_DEFAULT_MODEL) | Dynamic preference in qgsd.json | Phase 27 | User can switch models without editing ~/.claude.json |
| No model override in quorum_instructions | model_preferences appended to injected context | Phase 27 | Claude passes model= arg in tool call |

**Deprecated/outdated:**
- Nothing deprecated in this phase; purely additive.

## Open Questions

1. **Does the quorum.md slash command need updating too?**
   - What we know: `quorum.md` is used for `/qgsd:quorum` calls. The `quorum_instructions` from `qgsd-prompt.js` covers all quorum-gated planning commands. `quorum.md` constructs its own call sequence inline.
   - What's unclear: If a user sets a model preference and then runs `/qgsd:quorum`, does the override inject via the prompt hook (which runs on UserPromptSubmit) or does it need to be baked into `quorum.md` itself? The prompt hook DOES fire on `/qgsd:quorum` if it's in `quorum_commands`. But `/qgsd:quorum` currently is NOT in `quorum_commands` per the config (only `plan-phase`, `new-project`, etc. are listed).
   - Recommendation: Phase 27 success criteria focus on the quorum_instructions injection path. Verify `/qgsd:quorum` is NOT in `quorum_commands`. The scope for Phase 27 is: the model override appears in the hook-injected instructions (success criterion 3). Updating `quorum.md` for per-agent model passing is a separate concern and out of scope for this phase.

2. **What happens when `qgsd.json` doesn't exist yet?**
   - What we know: `config-loader.js` returns hardcoded defaults when no files exist. The slash command writes to `~/.claude/qgsd.json`. If the file doesn't exist, the node -e write script needs to handle that.
   - What's unclear: Does the current `~/.claude/qgsd.json` always exist for this user? It does (confirmed in research — file was read).
   - Recommendation: The slash command's write script should handle the "file doesn't exist" case by starting with DEFAULT_CONFIG structure, not crashing. Use a try/catch with a sensible default.

3. **Tool call parameter name for opencode and copilot**
   - What we know: codex-cli and claude-mcp-server instances accept `model:` as a tool parameter. copilot-cli has `model: z.string().optional()` in its schema. gemini-cli's `ask-gemini.tool.ts` accepts `model`. opencode's tool schema has model as optional.
   - What's unclear: Whether the opencode MCP tool's `model` parameter actually routes to the correct CLI flag.
   - Recommendation: The override text instructs Claude to pass the parameter; if a given tool ignores it, the worst case is no-op. Low risk.

## Sources

### Primary (HIGH confidence)
- Directly read: `hooks/config-loader.js` — full source of two-layer config system, validation pattern
- Directly read: `hooks/qgsd-prompt.js` — full source of quorum injection mechanism, `quorum_instructions` field
- Directly read: `~/.claude/qgsd.json` — live global config format including `quorum_instructions` and existing keys
- Directly read: `/code/claude-mcp-server/src/tools/simple-tools.ts` — identity tool implementation, `available_models` source
- Directly read: `/code/claude-mcp-server/src/types.ts` — `AVAILABLE_CLAUDE_MODELS`, `ClaudeToolSchema` (model param confirmed optional)
- Directly read: `/code/codex-mcp-server/src/types.ts` — `AVAILABLE_CODEX_MODELS`, `CodexToolSchema` (model param confirmed optional)
- Directly read: `/code/gemini-mcp-server/src/tools/ask-gemini.tool.ts` — model param accepted, maps to `--model` CLI flag
- Directly read: `/code/gemini-mcp-server/src/tools/simple-tools.ts` — identity tool, `available_models` from MODELS constants
- Directly read: `~/.claude.json` mcpServers block — full list of 10 agents with their env vars (CLAUDE_DEFAULT_MODEL per instance)
- Directly read: `commands/qgsd/quorum.md` — quorum tool call patterns, tool names per agent
- Directly read: `.planning/REQUIREMENTS.md` — MGR-01, MGR-02 definitions; Out of Scope table (per-project configs excluded)

### Secondary (MEDIUM confidence)
- Phase 26 SUMMARY.md — identity polling pattern established; sequential call requirement confirmed
- STATE.md accumulated decisions — "Call quorum models sequentially (never sibling tool calls) per R3.2"

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all components are existing project files read directly from source
- Architecture: HIGH — config key addition, hook injection extension, and slash command pattern all have clear precedents in codebase
- Pitfalls: HIGH — derived from direct reading of existing code and project history (quick-49 sibling call fix, Phase 26 agent list)

**Research date:** 2026-02-22
**Valid until:** 2026-03-22 (config-loader and hook patterns are stable; MCP tool schemas unlikely to change)
