# Phase 1: Hook Enforcement - Research

**Researched:** 2026-02-20
**Domain:** Claude Code hook-based multi-model quorum enforcement (UserPromptSubmit + Stop hooks)
**Confidence:** HIGH — all hook schemas, transcript format, and installer patterns verified from official docs and confirmed against live QGSD codebase (install.js, hooks/gsd-statusline.js, hooks/gsd-check-update.js, scripts/build-hooks.js)

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| STOP-01 | Stop hook reads transcript JSONL for tool_use entries matching configured quorum model names | Transcript format verified: assistant lines contain `message.content[]` array with `type:"tool_use"` and `name:"mcp__*"` blocks. Parse pattern confirmed from live session data. |
| STOP-02 | Stop hook checks `stop_hook_active` flag first — if true, exits 0 immediately | `stop_hook_active` field confirmed in Stop hook input schema from official docs. Must be first guard in hook body. |
| STOP-03 | Stop hook checks `hook_event_name` — if `SubagentStop`, exits 0 immediately | `hook_event_name` field present in hook input; values are `"Stop"` (main) and `"SubagentStop"` (subagents). Confirmed via PITFALLS.md pitfall 6. |
| STOP-04 | Stop hook scopes transcript search to current turn only (lines since last user message boundary) | Required to survive context compaction — full-file scan causes false blocks after `/compact`. Implementation: scan backward from end until last user message entry. |
| STOP-05 | Stop hook uses `last_assistant_message` as fast-path check before JSONL parse | `last_assistant_message` field confirmed in Stop hook input schema. Enables checking most recent response text without filesystem I/O. |
| STOP-06 | Stop hook verifies quorum only when a configured planning command was issued in the current turn | Scope filtering: scan user message entries in the current-turn window for `/gsd:*` planning commands before triggering quorum verification. |
| STOP-07 | Stop hook blocks with `{"decision": "block", "reason": "..."}` when quorum is missing | Blocking mechanism confirmed: stdout JSON with `decision:"block"` + `reason` string, exit 0. NOT exit 2 (exit 2 shows stderr as error UX). |
| STOP-08 | Block reason message format: "QUORUM REQUIRED: Before completing this /gsd:[command] response, call [tool1], [tool2], [tool3] with your current plan. Present their responses, then deliver your final output." | Reason string is fed back to Claude as next instruction. Must name exact tool names and provide clear next action. |
| STOP-09 | Stop hook passes (exits 0, no decision field) when quorum evidence found or no planning command in scope | Pass mechanism: exit 0 with no stdout output (or output without `decision` field). |
| UPS-01 | UserPromptSubmit hook detects GSD planning commands via explicit allowlist regex match against prompt field | `prompt` field confirmed in UserPromptSubmit input schema. Allowlist pattern: `^\s*\/gsd:(plan-phase|new-project|...)` — use `startsWith`-equivalent anchored regex. |
| UPS-02 | Allowlist contains exactly 6 commands: new-project, plan-phase, new-milestone, discuss-phase, verify-work, research-phase | Confirmed against REQUIREMENTS.md. Execute-phase and other non-planning commands must be excluded (CLAUDE.md R2.2 prohibits quorum during execution). |
| UPS-03 | UserPromptSubmit hook injects quorum instructions via `hookSpecificOutput.additionalContext` | `additionalContext` inside `hookSpecificOutput` confirmed as the mechanism that injects into Claude's context window (not `systemMessage` which only shows UI warning). |
| UPS-04 | Injected context names the exact MCP tools to call and instructs Claude to present model responses before delivering final output | Injection text must be actionable: name tools exactly (`mcp__codex-cli__review`, `mcp__gemini-cli__gemini`, `mcp__opencode__opencode`). |
| UPS-05 | UserPromptSubmit hook never fires on execute-phase or other non-planning commands | Enforced by explicit allowlist (6 commands). All other commands: exit 0 silently. |
| META-01 | GSD planning commands within this repo auto-resolve questions via quorum before escalating to user | CLAUDE.md R4 already defines this behavior. Phase 1 implements the structural hook that enforces it — the hooks themselves enable META compliance by requiring quorum on every /gsd:discuss-phase call. |
| META-02 | Only questions where quorum fails to reach consensus are presented to the user | Satisfied by R4 + hook enforcement — discuss-phase is in the allowlist, so quorum is required before output delivery. |
| META-03 | Auto-resolved questions are presented as a list of assumptions before escalated questions | Process requirement, not hook behavior. Hook enforces that quorum ran; what Claude does with quorum output is governed by CLAUDE.md R4. Hook compliance enables this. |
</phase_requirements>

---

## Summary

Phase 1 implements the two-hook structural quorum enforcement layer: a UserPromptSubmit hook that injects quorum instructions when a GSD planning command is detected, and a Stop hook that verifies quorum evidence in the transcript before allowing Claude to deliver planning output. Together these move quorum from a behavioral instruction (CLAUDE.md R3) to a structural gate that Claude cannot bypass.

The implementation domain is well-understood and fully verified. All hook API shapes, transcript format, and the existing GSD installer pattern are confirmed from official documentation and live codebase inspection. The critical implementation risks are: (1) the Stop hook infinite loop if `stop_hook_active` is not checked first, (2) plugin hook output being silently discarded if hooks are registered via plugin.json rather than settings.json, and (3) transcript compaction causing false blocks if the hook scans the full JSONL instead of the current-turn window.

No new npm dependencies are needed. All hook code uses Node.js stdlib (fs, path, os) — identical to the existing GSD hooks. The build pipeline is a simple file copy (same as scripts/build-hooks.js). The installer follows the exact pattern of bin/install.js: read settings.json, add hook entries idempotently, write back. This phase produces two hook files (`qgsd-prompt.js`, `qgsd-stop.js`), one config file (`qgsd-config.json`), and the build/install plumbing to deploy them.

**Primary recommendation:** Implement in the order: config module → Stop hook → UserPromptSubmit hook → build script → installer integration. Test the Stop hook first (it has the most failure modes), then test the UserPromptSubmit hook, then integration test both together against a live GSD planning command.

---

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Node.js | >=16.7.0 | Hook runtime | GSD hooks are already Node.js; matches existing engine requirement in package.json; zero install overhead since Claude Code ships Node. |
| `fs` (built-in) | built-in | Read transcript JSONL at `transcript_path`; read/write settings.json | Required for Stop hook's transcript read and installer's settings.json merge. |
| `path` (built-in) | built-in | Resolve hook script paths, config file paths | Required in hooks and installer. |
| `os` (built-in) | built-in | Resolve `~/.claude/` home directory | Required in hooks (config load) and installer (target path). |
| JSON/JSONL | no lib | Transcript parsing | Transcript is newline-delimited JSON — `JSON.parse()` per line is the only dependency. No external library. |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `readline` (built-in) | built-in | Stream-parse large JSONL transcripts | Use if transcript files grow >1MB (typical sessions are <<1MB; not needed for v1 but good to know). |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Node.js hooks | Python hooks | Python works equally (see gsd-guardian.py pattern); Node is preferred here because the existing GSD hooks are Node.js and QGSD should match the runtime for consistency. Either is valid. |
| Simple file copy (build) | esbuild bundling | esbuild is already a devDependency. Since QGSD hooks have no npm dependencies (pure stdlib), simple copy is sufficient — same approach as scripts/build-hooks.js. Only add esbuild if hooks gain npm deps. |

**Installation:**
```bash
# No additional npm packages needed for Phase 1.
# Uses only Node.js stdlib + existing devDependency (esbuild already in package.json).
```

---

## Architecture Patterns

### Recommended Project Structure

```
QGSD/
├── hooks/
│   ├── qgsd-prompt.js          # Source: UserPromptSubmit hook
│   ├── qgsd-stop.js            # Source: Stop hook
│   └── dist/
│       ├── qgsd-prompt.js      # Built: copied to ~/.claude/hooks/ on install
│       └── qgsd-stop.js        # Built: copied to ~/.claude/hooks/ on install
├── templates/
│   └── qgsd-config.json        # Default config written during install
├── scripts/
│   └── build-hooks.js          # Extended to include qgsd-prompt.js and qgsd-stop.js
└── bin/
    └── install.js              # Extended to write UserPromptSubmit + Stop hook entries
```

The `hooks/dist/` directory follows the exact GSD pattern: source in `hooks/`, built (copied) output in `hooks/dist/`, installer copies from `hooks/dist/` to `~/.claude/hooks/`. No bundling needed for Phase 1 since hooks have zero npm dependencies.

### Pattern 1: Stop Hook — Transcript Parsing with Infinite Loop Guard

**What:** The Stop hook reads `transcript_path` JSONL, scans the current-turn window for quorum tool_use evidence, and blocks or passes.

**When to use:** The only moment that provides a hard gate — Claude cannot deliver output without this check passing.

**Critical order of operations:**

```javascript
#!/usr/bin/env node
// hooks/qgsd-stop.js
const fs = require('fs');
const path = require('path');
const os = require('os');

const DEFAULT_CONFIG = {
  quorum_commands: ['plan-phase', 'new-project', 'new-milestone', 'discuss-phase', 'verify-work', 'research-phase'],
  fail_mode: 'open',
  required_models: {
    codex: { tool_prefix: 'mcp__codex-cli__', required: true },
    gemini: { tool_prefix: 'mcp__gemini-cli__', required: true },
    opencode: { tool_prefix: 'mcp__opencode__', required: true }
  }
};

function loadConfig() {
  const configPath = path.join(os.homedir(), '.claude', 'qgsd-config.json');
  if (!fs.existsSync(configPath)) return DEFAULT_CONFIG;
  try { return { ...DEFAULT_CONFIG, ...JSON.parse(fs.readFileSync(configPath, 'utf8')) }; }
  catch { return DEFAULT_CONFIG; }
}

function main() {
  let raw = '';
  process.stdin.setEncoding('utf8');
  process.stdin.on('data', chunk => raw += chunk);
  process.stdin.on('end', () => {
    try {
      const input = JSON.parse(raw);

      // GUARD 1: Infinite loop prevention (MUST be first)
      if (input.stop_hook_active) { process.exit(0); }

      // GUARD 2: Subagent exclusion
      if (input.hook_event_name === 'SubagentStop') { process.exit(0); }

      // GUARD 3: Transcript must exist
      if (!input.transcript_path || !fs.existsSync(input.transcript_path)) { process.exit(0); }

      const config = loadConfig();
      const lines = fs.readFileSync(input.transcript_path, 'utf8').split('\n').filter(l => l.trim());

      // Scope to current turn: find lines since last user message
      const currentTurnLines = getCurrentTurnLines(lines);

      // GUARD 4: Scope filtering — only enforce if planning command in scope
      if (!hasQuorumCommand(currentTurnLines, config.quorum_commands)) { process.exit(0); }

      // Scan for quorum tool_use evidence
      const foundModels = findQuorumEvidence(currentTurnLines, config.required_models);
      const missingModels = Object.entries(config.required_models)
        .filter(([k, v]) => v.required && !foundModels.has(k))
        .map(([k]) => k);

      if (missingModels.length === 0) { process.exit(0); } // PASS

      // BLOCK: quorum incomplete
      const missingTools = missingModels.map(m => {
        const prefix = config.required_models[m].tool_prefix;
        if (m === 'codex') return `${prefix}review`;
        if (m === 'gemini') return `${prefix}gemini`;
        if (m === 'opencode') return `${prefix}opencode`;
        return prefix + m;
      });

      process.stdout.write(JSON.stringify({
        decision: 'block',
        reason: `QUORUM REQUIRED: Before completing this response, call ${missingTools.join(', ')} with your current plan. Present their responses, then deliver your final output.`
      }));
      process.exit(0);

    } catch (e) {
      process.exit(0); // Fail-open on any error
    }
  });
}

function getCurrentTurnLines(lines) {
  // Find the index of the last user message, return lines after it
  let lastUserIdx = -1;
  for (let i = lines.length - 1; i >= 0; i--) {
    try {
      const entry = JSON.parse(lines[i]);
      if (entry.type === 'user') { lastUserIdx = i; break; }
    } catch {}
  }
  return lastUserIdx >= 0 ? lines.slice(lastUserIdx) : lines;
}

function hasQuorumCommand(lines, quorumCommands) {
  const cmdPattern = new RegExp('\\/gsd:(' + quorumCommands.join('|') + ')');
  for (const line of lines) {
    try {
      const entry = JSON.parse(line);
      if (entry.type !== 'user') continue;
      const text = JSON.stringify(entry.message || entry);
      if (cmdPattern.test(text)) return true;
    } catch {}
  }
  return false;
}

function findQuorumEvidence(lines, requiredModels) {
  const found = new Set();
  for (const line of lines) {
    try {
      const entry = JSON.parse(line);
      if (entry.type !== 'assistant') continue;
      const content = entry?.message?.content;
      if (!Array.isArray(content)) continue;
      for (const block of content) {
        if (block.type !== 'tool_use') continue;
        for (const [modelKey, modelDef] of Object.entries(requiredModels)) {
          if (block.name && block.name.startsWith(modelDef.tool_prefix)) {
            found.add(modelKey);
          }
        }
      }
    } catch {}
  }
  return found;
}

main();
```

### Pattern 2: UserPromptSubmit Hook — Allowlist Detection and Context Injection

**What:** Detects GSD planning commands in the user's prompt and injects quorum instructions into Claude's context via `additionalContext`.

**When to use:** Fires before Claude processes the prompt — the right moment to set expectations for the upcoming response.

```javascript
#!/usr/bin/env node
// hooks/qgsd-prompt.js
const fs = require('fs');
const path = require('path');
const os = require('os');

const DEFAULT_QUORUM_COMMANDS = [
  'plan-phase', 'new-project', 'new-milestone',
  'discuss-phase', 'verify-work', 'research-phase'
];

const DEFAULT_QUORUM_INSTRUCTIONS = `QUORUM REQUIRED (structural enforcement — Stop hook will verify)

Before presenting any planning output to the user, you MUST:
  1. Call mcp__codex-cli__review with the full plan content
  2. Call mcp__gemini-cli__gemini with the full plan content
  3. Call mcp__opencode__opencode with the full plan content
  4. Present all model responses, resolve concerns, then deliver final output

Fail-open: if a model is UNAVAILABLE (quota/error), note it and proceed with available models.
The Stop hook reads the transcript — skipping quorum will block your response.`;

function loadConfig() {
  const configPath = path.join(os.homedir(), '.claude', 'qgsd-config.json');
  if (!fs.existsSync(configPath)) return null;
  try { return JSON.parse(fs.readFileSync(configPath, 'utf8')); }
  catch { return null; }
}

function main() {
  let raw = '';
  process.stdin.setEncoding('utf8');
  process.stdin.on('data', chunk => raw += chunk);
  process.stdin.on('end', () => {
    try {
      const input = JSON.parse(raw);
      const prompt = (input.prompt || '').trim();

      const config = loadConfig();
      const commands = config?.quorum_commands || DEFAULT_QUORUM_COMMANDS;
      const instructions = config?.quorum_instructions || DEFAULT_QUORUM_INSTRUCTIONS;

      // Explicit allowlist match — anchored to prevent false matches on execute-phase, etc.
      const cmdPattern = new RegExp('^\\s*\\/(gsd:)?(' + commands.join('|') + ')(\\s|$)');
      if (!cmdPattern.test(prompt)) { process.exit(0); }

      // Inject quorum instructions via additionalContext (NOT systemMessage)
      process.stdout.write(JSON.stringify({
        hookSpecificOutput: {
          hookEventName: 'UserPromptSubmit',
          additionalContext: instructions
        }
      }));
      process.exit(0);

    } catch (e) {
      process.exit(0); // Fail-open on any error
    }
  });
}

main();
```

### Pattern 3: Config File — Default + User-Editable

**What:** `~/.claude/qgsd-config.json` defines the quorum commands list, model tool prefixes, fail_mode, and injection text. Hooks read this on every invocation with fallback to hardcoded defaults.

```json
{
  "quorum_commands": [
    "plan-phase", "new-project", "new-milestone",
    "discuss-phase", "verify-work", "research-phase"
  ],
  "fail_mode": "open",
  "required_models": {
    "codex":    { "tool_prefix": "mcp__codex-cli__",  "required": true },
    "gemini":   { "tool_prefix": "mcp__gemini-cli__", "required": true },
    "opencode": { "tool_prefix": "mcp__opencode__",   "required": true }
  },
  "quorum_instructions": "QUORUM REQUIRED (structural enforcement — Stop hook will verify)\n\nBefore presenting any planning output to the user, you MUST:\n  1. Call mcp__codex-cli__review with the full plan content\n  2. Call mcp__gemini-cli__gemini with the full plan content\n  3. Call mcp__opencode__opencode with the full plan content\n  4. Present all model responses, resolve concerns, then deliver final output\n\nFail-open: if a model is UNAVAILABLE (quota/error), note it and proceed with available models.\nThe Stop hook reads the transcript — skipping quorum will block your response."
}
```

### Pattern 4: Build Script Extension

**What:** Extend `scripts/build-hooks.js` to include the two new QGSD hooks in the copy list.

```javascript
// In scripts/build-hooks.js — add to HOOKS_TO_COPY array:
const HOOKS_TO_COPY = [
  'gsd-check-update.js',
  'gsd-statusline.js',
  'qgsd-prompt.js',   // QGSD: UserPromptSubmit hook
  'qgsd-stop.js',     // QGSD: Stop hook
];
```

No bundling step needed — hooks are pure Node.js stdlib.

### Pattern 5: Installer Extension (settings.json Hook Registration)

**What:** Extend `bin/install.js` to register UserPromptSubmit and Stop hook entries in settings.json.

**Key constraints from codebase:**
- Use `buildHookCommand(configDir, 'qgsd-prompt.js')` — same helper GSD already uses
- Idempotency check: `some(entry => entry.hooks.some(h => h.command.includes('qgsd-prompt')))`
- Write default config only if not already present (preserve user customizations)
- Register in user settings only — never in plugin.json (GitHub #10225 bug)

```javascript
// After existing SessionStart hook registration in bin/install.js:

// Register UserPromptSubmit hook (QGSD quorum injection)
if (!settings.hooks.UserPromptSubmit) settings.hooks.UserPromptSubmit = [];
const hasQgsdPromptHook = settings.hooks.UserPromptSubmit.some(entry =>
  entry.hooks && entry.hooks.some(h => h.command && h.command.includes('qgsd-prompt'))
);
if (!hasQgsdPromptHook) {
  settings.hooks.UserPromptSubmit.push({
    hooks: [{ type: 'command', command: buildHookCommand(targetDir, 'qgsd-prompt.js') }]
  });
  console.log(`  ${green}✓${reset} Configured QGSD quorum injection hook`);
}

// Register Stop hook (QGSD quorum gate)
if (!settings.hooks.Stop) settings.hooks.Stop = [];
const hasQgsdStopHook = settings.hooks.Stop.some(entry =>
  entry.hooks && entry.hooks.some(h => h.command && h.command.includes('qgsd-stop'))
);
if (!hasQgsdStopHook) {
  settings.hooks.Stop.push({
    hooks: [{ type: 'command', command: buildHookCommand(targetDir, 'qgsd-stop.js'), timeout: 30 }]
  });
  console.log(`  ${green}✓${reset} Configured QGSD quorum gate hook`);
}

// Write default QGSD config (only if not present — preserve user customizations)
const qgsdConfigPath = path.join(targetDir, 'qgsd-config.json');
if (!fs.existsSync(qgsdConfigPath)) {
  const templatePath = path.join(__dirname, '..', 'templates', 'qgsd-config.json');
  fs.copyFileSync(templatePath, qgsdConfigPath);
  console.log(`  ${green}✓${reset} Wrote QGSD config (qgsd-config.json)`);
}
```

### Anti-Patterns to Avoid

- **Stop hook without stop_hook_active guard:** Creates infinite loop on first missing-quorum block. The guard must be the first statement in the hook body, unconditional.
- **SubagentStop not excluded:** GSD spawns many subagents (gsd-planner, gsd-executor, etc.). Without `hook_event_name !== 'SubagentStop'` guard, every subagent gets blocked. All GSD workflows break.
- **Full-transcript scan without current-turn scoping:** After context compaction, the JSONL no longer contains the original tool_use entries. Scanning full file causes false blocks mid-session.
- **Broad regex on prompt field:** `includes('/gsd:')` matches execute-phase, debug, quick-mode. Use anchored regex with explicit allowlist only.
- **Using `systemMessage` for injection:** `systemMessage` is a UI warning shown to the user, not injected into Claude's context. Only `hookSpecificOutput.additionalContext` goes into Claude's context window.
- **Registering hooks in plugin.json:** GitHub bug #10225 / #12151 silently discards UserPromptSubmit output from plugin hooks. Always register in `~/.claude/settings.json`.
- **Calling model CLIs from hooks:** Hooks execute in Claude Code's environment, not in Claude's context. Spawning codex/gemini subprocesses adds auth fragility. The hook verifies evidence; Claude calls the models.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Hook registration | Custom hook injection code | GSD's existing `buildHookCommand()` + `readSettings()`/`writeSettings()` pattern | Already handles cross-platform path, forward slash normalization, settings.json merge. |
| JSONL parsing | Custom streaming JSONL parser | `JSON.parse()` per filtered line with try/catch | Sessions are <1MB in typical use; stdlib is sufficient and adds zero dependencies. |
| Config loading | Schema-validated config system | Simple `JSON.parse()` + spread merge with hardcoded defaults | Config is simple key-value; full validation framework is overkill and would add dependencies. |
| Infinite loop prevention | Custom session state tracker | `stop_hook_active` flag (provided by Claude Code) | This is exactly what the field is for. Do not re-implement with counter files or env vars. |

**Key insight:** Every custom solution in this domain introduces edge cases that the existing GSD codebase or the Claude Code API already handles correctly. Match the patterns — don't diverge.

---

## Common Pitfalls

### Pitfall 1: Stop Hook Infinite Loop
**What goes wrong:** Hook blocks, Claude continues, hook blocks again, infinite loop.
**Why it happens:** `stop_hook_active` flag not checked. Must be unconditional first guard.
**How to avoid:** `if (input.stop_hook_active) { process.exit(0); }` — first line after stdin parse.
**Warning signs:** Session runs indefinitely; repeated "QUORUM REQUIRED" messages; API usage spikes.

### Pitfall 2: Plugin Hook Output Silently Discarded
**What goes wrong:** UserPromptSubmit hook runs, Claude never sees quorum injection. Silent failure.
**Why it happens:** GitHub bug #10225 / #12151 — plugin.json hooks do not capture stdout.
**How to avoid:** Register ALWAYS in `~/.claude/settings.json`, not `plugin.json`.
**Warning signs:** Hook shows registered in `/hooks` menu but Claude ignores instructions.

### Pitfall 3: Transcript Compaction False Blocks
**What goes wrong:** After `/compact`, Stop hook scans full JSONL, finds no tool_use entries (compacted), blocks everything.
**Why it happens:** Compaction replaces turn-by-turn entries with a summary. Full scan misses the boundary.
**How to avoid:** Scope scan to lines after last user message only (current turn).
**Warning signs:** Hook works for fresh sessions but starts blocking mid-session; triggered by `/compact`.

### Pitfall 4: Subagent Stop Events Breaking GSD Workflows
**What goes wrong:** GSD spawns subagents (gsd-planner, etc.). Stop hook fires for each; blocks all subagents.
**Why it happens:** `hooks` in settings.json are inherited by subagents. Stop fires on SubagentStop too.
**How to avoid:** `if (input.hook_event_name === 'SubagentStop') { process.exit(0); }`
**Warning signs:** `execute-phase` hangs; Task() agents never complete; all GSD workflows broken.

### Pitfall 5: Overly Broad Command Pattern
**What goes wrong:** Hook injects quorum instructions during `/gsd:execute-phase` — violates CLAUDE.md R2.2.
**Why it happens:** Regex matching `/gsd:` prefix catches all GSD commands.
**How to avoid:** Explicit allowlist of exactly 6 commands; anchored regex that requires word boundary after command name.
**Warning signs:** Quorum injection fires on execute-phase; CLAUDE.md R2.2 violation.

### Pitfall 6: MCP Tool Name Hardcoded Instead of Config-Driven
**What goes wrong:** Stop hook checks for `mcp__codex-cli__review` exactly; user renames server to `codex`; hook never detects quorum.
**Why it happens:** Tool names hardcoded in hook script rather than loaded from config.
**How to avoid:** Tool prefixes come from `qgsd-config.json` `required_models[].tool_prefix`. Match by `startsWith(prefix)`.
**Warning signs:** Hook blocks after confirmed quorum runs; user changed MCP server names.

---

## Code Examples

Verified patterns from codebase inspection and official docs:

### Settings.json Hook Registration (from bin/install.js pattern)

```javascript
// Source: bin/install.js lines 1540-1555 (SessionStart hook pattern — replicate for UserPromptSubmit/Stop)
if (!settings.hooks) settings.hooks = {};
if (!settings.hooks.UserPromptSubmit) settings.hooks.UserPromptSubmit = [];

const hasHook = settings.hooks.UserPromptSubmit.some(entry =>
  entry.hooks && entry.hooks.some(h => h.command && h.command.includes('qgsd-prompt'))
);

if (!hasHook) {
  settings.hooks.UserPromptSubmit.push({
    hooks: [{ type: 'command', command: buildHookCommand(targetDir, 'qgsd-prompt.js') }]
  });
}
writeSettings(settingsPath, settings);
```

### Hook Command Path Builder (existing GSD helper)

```javascript
// Source: bin/install.js lines 192-196 (already exists — use as-is)
function buildHookCommand(configDir, hookName) {
  const hooksPath = configDir.replace(/\\/g, '/') + '/hooks/' + hookName;
  return `node "${hooksPath}"`;
}
```

### CommonJS Mode Guard (existing GSD pattern)

```javascript
// Source: bin/install.js lines 1468-1473
// Write package.json to force CommonJS mode — prevents "require is not defined" in ESM projects
fs.writeFileSync(pkgJsonDest, '{"type":"commonjs"}\n');
```

QGSD hooks must be deployed to `~/.claude/` where this package.json already exists (written by GSD installer). No additional CommonJS guard needed for QGSD hooks since they deploy to the same directory.

### Transcript JSONL Structure (verified from live session data)

```jsonl
// User message entry — detect planning commands here
{"type":"user","message":{"role":"user","content":"/gsd:plan-phase 3"},"timestamp":"...","uuid":"..."}

// Assistant tool_use entry — quorum evidence is here
{"type":"assistant","message":{"role":"assistant","content":[{"type":"tool_use","id":"toolu_01...","name":"mcp__codex-cli__review","input":{...}}],"stop_reason":"tool_use"},"timestamp":"..."}
```

### Stop Hook Input Schema (verified from official docs)

```json
{
  "session_id": "abc123",
  "transcript_path": "/Users/.../.claude/projects/.../session.jsonl",
  "cwd": "/Users/.../my-project",
  "permission_mode": "default",
  "hook_event_name": "Stop",
  "stop_hook_active": false,
  "last_assistant_message": "Here is the plan for Phase 3..."
}
```

### UserPromptSubmit Input Schema (verified from official docs)

```json
{
  "session_id": "abc123",
  "transcript_path": "/Users/.../.claude/projects/.../session.jsonl",
  "cwd": "/Users/.../my-project",
  "permission_mode": "default",
  "hook_event_name": "UserPromptSubmit",
  "prompt": "/gsd:plan-phase 3"
}
```

### Block Response (Stop hook output)

```json
{
  "decision": "block",
  "reason": "QUORUM REQUIRED: Before completing this response, call mcp__codex-cli__review, mcp__gemini-cli__gemini, mcp__opencode__opencode with your current plan. Present their responses, then deliver your final output."
}
```

Exit 0 required even when blocking — the JSON is consumed only if exit code is 0.

### Injection Response (UserPromptSubmit hook output)

```json
{
  "hookSpecificOutput": {
    "hookEventName": "UserPromptSubmit",
    "additionalContext": "QUORUM REQUIRED..."
  }
}
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `systemMessage` for hook instructions | `additionalContext` inside `hookSpecificOutput` | Confirmed current (2026-02) | `systemMessage` shows as UI warning; `additionalContext` goes into Claude's actual context. Always use `additionalContext` for instructions. |
| Plugin hooks.json for distribution | User settings.json via installer | Bug confirmed 2024-2025 (#10225, #12151) | Plugin hooks silently discarded for UserPromptSubmit. Install to settings.json or use exit-code-based blocking for Stop hooks in plugins. |
| Blocking via exit 2 | `{"decision":"block","reason":"..."}` stdout with exit 0 | Confirmed current (2026-02) | Exit 2 shows stderr as error UX. JSON stdout gives the `reason` to Claude as instruction. |

**Deprecated/outdated:**
- `exit 2` for Stop hook blocking in plugin context: broken (#10412). Use JSON stdout.
- `systemMessage` field: for UI warnings to user, not Claude instructions.
- Hardcoded MCP tool names in hook scripts: any name change breaks detection silently.

---

## Open Questions

1. **`stop_hook_active` behavior on second Stop invocation after a GSD subagent**
   - What we know: `stop_hook_active: true` fires when Claude Code already caused a continuation due to a prior Stop hook block. STATE.md flags this as a blocker concern: "stop_hook_active behavior on second Stop invocations with GSD subagents must be empirically confirmed against live Claude Code runtime."
   - What's unclear: Whether `stop_hook_active` is set correctly for the main session Stop when GSD subagents have run Stop events first.
   - Recommendation: Implement dual guard (check BOTH `stop_hook_active` AND `hook_event_name === 'SubagentStop'`) and test against a live `/gsd:plan-phase` invocation before shipping. The SubagentStop guard handles the subagent case regardless of `stop_hook_active` behavior.

2. **`last_assistant_message` fast-path value for non-planning turns**
   - What we know: Field confirmed in input schema. Contains the last response text.
   - What's unclear: Whether checking `last_assistant_message` for quorum tool name mentions is a reliable fast-path before JSONL parsing, or whether tool names only appear in the transcript tool_use blocks (not in the response text).
   - Recommendation: Use `last_assistant_message` as a quick early-exit when the message clearly doesn't relate to planning (e.g., it's a short utility response). For quorum positive confirmation, parse the JSONL — tool calls appear in transcript blocks, not always in response text.

3. **`qgsd-config.json` location: `~/.claude/` vs `~/.claude/qgsd-config.json`**
   - What we know: ARCHITECTURE.md specifies `~/.claude/qgsd-config.json`. REQUIREMENTS.md (Phase 2) specifies `~/.claude/qgsd.json`. These use different filenames.
   - What's unclear: REQUIREMENTS.md CONF-01 names the file `qgsd.json`. ARCHITECTURE.md uses `qgsd-config.json`. Phase 1 needs a filename that doesn't conflict with Phase 2's planned name.
   - Recommendation: Use `qgsd-config.json` for Phase 1 (matches ARCHITECTURE.md). Phase 2 (CONF-01) will formalize this — if CONF-01 renames to `qgsd.json`, the Phase 2 installer update handles migration. Keep it simple now, don't preemptively rename.

---

## Implementation Sequence

The build order matches the dependency graph and reduces rework:

```
Step 1: templates/qgsd-config.json
        — Defines config schema; both hooks depend on it.
        — Write once, used by hooks and installer.

Step 2a: hooks/qgsd-stop.js
         — Stop hook is the core gate. Most failure modes live here.
         — Test independently with mock stdin before integration.

Step 2b: hooks/qgsd-prompt.js
         — Simpler than Stop hook. Pattern-match + emit JSON.
         — Can develop in parallel with Step 2a.

Step 3: scripts/build-hooks.js (extend)
        — Add qgsd-prompt.js and qgsd-stop.js to HOOKS_TO_COPY.
        — Run npm run build:hooks to populate hooks/dist/.

Step 4: bin/install.js (extend)
        — Add UserPromptSubmit and Stop hook registration after existing SessionStart logic.
        — Add qgsd-config.json template copy (if not present).
        — Test: npx . --claude --global → verify ~/.claude/hooks/ and settings.json entries.

Step 5: Integration Tests
        5a. Stop hook alone: mock stdin with transcript containing quorum tool_use → should exit 0
        5b. Stop hook alone: mock stdin with transcript missing quorum → should output block JSON
        5c. Stop hook alone: mock stdin with stop_hook_active:true → should exit 0 immediately
        5d. Stop hook alone: mock stdin with hook_event_name:"SubagentStop" → should exit 0
        5e. UserPromptSubmit hook: mock stdin with planning command → should output additionalContext
        5f. UserPromptSubmit hook: mock stdin with execute-phase → should exit 0 silently
        5g. Live test: install, run /gsd:plan-phase, verify Claude sees quorum instructions
        5h. Live test: run /gsd:plan-phase without doing quorum → Stop hook should block
        5i. Live test: run /gsd:plan-phase with quorum → Stop hook should pass
        5j. Live test: run /gsd:execute-phase → verify no injection, no blocking
```

---

## Sources

### Primary (HIGH confidence)

- `https://code.claude.com/docs/en/hooks` — Official hooks reference. All input/output schemas, exit code behavior, `stop_hook_active`, `additionalContext`, `decision:"block"`, `hook_event_name`, timeout fields. Confidence: HIGH.
- `/Users/jonathanborduas/code/QGSD/bin/install.js` — Live GSD installer. `buildHookCommand()`, `readSettings()`/`writeSettings()`, hook registration pattern (SessionStart), idempotency check, `{"type":"commonjs"}` package.json trick. Confidence: HIGH.
- `/Users/jonathanborduas/code/QGSD/hooks/gsd-statusline.js` — Live production hook. Stdin JSON parsing pattern, error handling, silent fail approach. Confidence: HIGH.
- `/Users/jonathanborduas/code/QGSD/hooks/gsd-check-update.js` — Live production SessionStart hook. Detached subprocess pattern, stdin/stdout interaction. Confidence: HIGH.
- `/Users/jonathanborduas/code/QGSD/scripts/build-hooks.js` — Live build script. HOOKS_TO_COPY pattern, hooks/dist/ output. Confirms simple copy (no bundling) is the GSD standard. Confidence: HIGH.
- `/Users/jonathanborduas/code/QGSD/.planning/research/STACK.md` — Prior research. Full Stop hook and UserPromptSubmit examples, plugin manifest schema, alternative analysis. Confidence: HIGH.
- `/Users/jonathanborduas/code/QGSD/.planning/research/ARCHITECTURE.md` — Prior research. Component diagram, data flow, config file design, installer design, implementation sequence. Confidence: HIGH.
- `/Users/jonathanborduas/code/QGSD/.planning/research/PITFALLS.md` — Prior research. Six critical pitfalls with root causes, prevention strategies, recovery costs. Confidence: HIGH.
- `/Users/jonathanborduas/code/QGSD/.planning/REQUIREMENTS.md` — Authoritative requirement definitions for STOP-01 through STOP-09, UPS-01 through UPS-05, META-01 through META-03. Confidence: HIGH.

### Secondary (MEDIUM confidence)

- GitHub Issue #10225, #12151 — Plugin hooks.json UserPromptSubmit output silently discarded. Confirmed workaround: install to user settings.json. Confidence: HIGH (multiple confirmations in issues + first-party GSD codebase verifies install-to-settings pattern).
- GitHub Issue #10412 — Stop hook exit 2 broken in plugin context. Confirmed: use JSON stdout with exit 0. Confidence: HIGH.
- GitHub Issue #10205 — Infinite loop from Stop hooks. Confirms `stop_hook_active` is the correct mechanism. Confidence: HIGH.

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — pure Node.js stdlib; existing GSD hooks confirm the pattern; package.json already has engine requirement.
- Architecture: HIGH — component design confirmed from ARCHITECTURE.md + live codebase; data flow verified from official docs.
- Pitfalls: HIGH — all six critical pitfalls confirmed from official GitHub issues and live codebase; prevention strategies are concrete and testable.
- Implementation sequence: HIGH — dependency order matches build graph confirmed from codebase structure.

**Research date:** 2026-02-20
**Valid until:** 2026-03-22 (30 days — Claude Code hook API is stable; bugs #10225/#12151 are open but workaround is confirmed)
