# Architecture Research

**Domain:** Claude Code plugin extension for hook-based multi-model quorum enforcement
**Researched:** 2026-02-20
**Confidence:** HIGH (Claude Code hooks API verified against official docs; transcript format verified against live QGSD session data)

## Standard Architecture

### System Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                    User (Claude Code session)                    │
│                                                                  │
│   /gsd:plan-phase, /gsd:new-project, /gsd:new-milestone ...     │
└───────────────────────────┬─────────────────────────────────────┘
                            │ UserPromptSubmit fires
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│                 QGSD Hook Layer (~/.claude/hooks/)               │
│                                                                  │
│  ┌────────────────────┐        ┌──────────────────────────────┐  │
│  │ qgsd-prompt.js     │        │ qgsd-stop.js                 │  │
│  │ (UserPromptSubmit) │        │ (Stop hook)                  │  │
│  │                    │        │                              │  │
│  │ 1. Read stdin JSON │        │ 1. Read stdin JSON           │  │
│  │ 2. Check prompt    │        │ 2. Check stop_hook_active    │  │
│  │ 3. Match against   │        │ 3. Parse transcript_path     │  │
│  │    quorum-commands │        │ 4. Scan for MCP tool_use     │  │
│  │    from config     │        │ 5. Verify Codex+Gemini+OC    │  │
│  │ 4. If match:       │        │ 6. PASS: exit 0              │  │
│  │    inject quorum   │        │    BLOCK: decision:"block"   │  │
│  │    instructions    │        │    + reason                  │  │
│  │    via stdout      │        └──────────────────────────────┘  │
│  └────────────────────┘                                          │
│                                                                  │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │ qgsd-config.js  (shared config reader)                     │  │
│  │  - Reads ~/.claude/qgsd-config.json                        │  │
│  │  - Provides: quorum_commands[], fail_mode, model_names{}   │  │
│  └────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│              GSD Layer (unmodified, zero coupling)               │
│  ~/.claude/commands/gsd/plan-phase.md                            │
│  ~/.claude/commands/gsd/new-project.md                           │
│  ~/.claude/agents/gsd-planner.md                                 │
│  ... (GSD continues operating normally)                          │
└─────────────────────────────────────────────────────────────────┘
```

### Component Responsibilities

| Component | Responsibility | Communicates With |
|-----------|----------------|-------------------|
| `qgsd-prompt.js` (UserPromptSubmit hook) | Detect GSD planning commands; inject quorum instructions into Claude's context via stdout | Claude Code (via stdout `additionalContext`); reads `qgsd-config.json` |
| `qgsd-stop.js` (Stop hook) | Read transcript JSONL; verify Codex/Gemini/OpenCode tool_use evidence exists; block or pass | Claude Code (via `decision`/`reason` JSON output); reads `qgsd-config.json` and `transcript_path` |
| `qgsd-config.js` (shared module) | Parse `~/.claude/qgsd-config.json`; provide quorum command list, model names, fail_mode | Both hooks require it |
| `qgsd-config.json` (config file) | User-editable configuration: which commands require quorum, which models count, fail_mode | Read by `qgsd-config.js` at hook runtime |
| `bin/install.js` (installer) | Copy hooks to `~/.claude/hooks/`; register hook events in `~/.claude/settings.json`; write default config | `~/.claude/settings.json`, `~/.claude/hooks/` |

---

## Recommended Project Structure

```
QGSD/
├── bin/
│   └── install.js              # Installer: copies hooks, writes settings.json entries, writes default config
├── hooks/
│   ├── qgsd-prompt.js          # Source: UserPromptSubmit hook
│   ├── qgsd-stop.js            # Source: Stop hook
│   ├── qgsd-config.js          # Source: shared config reader (bundled into each hook at build time)
│   └── dist/
│       ├── qgsd-prompt.js      # Bundled (esbuild): self-contained, no require('../qgsd-config')
│       └── qgsd-stop.js        # Bundled (esbuild): self-contained
├── scripts/
│   └── build-hooks.js          # esbuild: bundle hooks/src → hooks/dist
├── templates/
│   └── qgsd-config.json        # Default config written during install
└── package.json
```

### Structure Rationale

- **`hooks/dist/`**: GSD pattern — hooks are bundled with esbuild into self-contained files before distribution. No `require()` resolution issues after install since there is no `node_modules` at `~/.claude/`.
- **`qgsd-config.js` as shared module**: Both hooks need the same config parsing logic. Bundle time (not runtime) dependency avoids inter-file require at `~/.claude/hooks/`.
- **`templates/qgsd-config.json`**: Installer writes a default config so the system works out-of-the-box with zero user config required.

---

## Architectural Patterns

### Pattern 1: UserPromptSubmit — Pattern Matching and Context Injection

**What:** The `UserPromptSubmit` hook receives the user's raw prompt text in the `prompt` field of stdin JSON. It checks whether the prompt starts with or contains a known GSD planning command. If matched, it prints quorum instructions to stdout, which Claude Code adds to Claude's context before processing begins.

**When to use:** The only moment QGSD can inject instructions at the right time — before Claude processes the command, so Claude knows to run quorum before producing planning output.

**Pattern detection logic:**

```javascript
// stdin JSON from Claude Code
const input = JSON.parse(stdinData);
const prompt = input.prompt || '';

// Command matching: slash-prefixed GSD planning commands
// Matches "/gsd:plan-phase", "/gsd:plan-phase 2", "  /gsd:new-project ..."
const COMMAND_PATTERN = /^\s*\/gsd:(plan-phase|new-project|new-milestone|discuss-phase|verify-work|research-phase)/;

if (COMMAND_PATTERN.test(prompt)) {
  // Inject quorum instructions via additionalContext
  process.stdout.write(JSON.stringify({
    hookSpecificOutput: {
      hookEventName: "UserPromptSubmit",
      additionalContext: quorumInstructions
    }
  }));
}
process.exit(0);
```

**Trade-offs:**
- Regex on prompt text is the only mechanism available (no structured command metadata in the hook payload)
- Risk: user can invoke commands with leading whitespace or in different capitalizations — pattern must be robust
- Pattern must match the config's `quorum_commands` list dynamically, not be hardcoded

### Pattern 2: Stop Hook — Transcript Parsing for Evidence

**What:** The `Stop` hook fires when Claude finishes responding. It reads the `transcript_path` JSONL file, scans for `tool_use` content blocks with MCP tool names matching Codex, Gemini, and OpenCode, and blocks if the required evidence is missing.

**When to use:** The only moment that provides a hard gate — Claude cannot deliver planning output without passing this check.

**Transcript JSONL structure (verified against live QGSD sessions):**

Each line in the JSONL is a JSON object. The relevant lines for quorum detection:

```jsonl
{"type":"assistant","timestamp":"...","uuid":"...","message":{"model":"...","id":"...","type":"message","role":"assistant","content":[{"type":"tool_use","id":"toolu_01...","name":"mcp__codex-cli__codex","input":{...}}],"stop_reason":"tool_use","usage":{...}}}
{"type":"assistant","timestamp":"...","uuid":"...","message":{"role":"assistant","content":[{"type":"tool_use","id":"toolu_02...","name":"mcp__gemini-cli__gemini","input":{...}}]}}
{"type":"assistant","timestamp":"...","uuid":"...","message":{"role":"assistant","content":[{"type":"tool_use","id":"toolu_03...","name":"mcp__opencode__opencode","input":{...}}]}}
```

**Stop hook parsing logic:**

```javascript
const input = JSON.parse(stdinData);

// Infinite loop guard: if already in a stop hook continuation, pass
if (input.stop_hook_active) {
  process.exit(0);
}

// Read and parse transcript
const lines = fs.readFileSync(input.transcript_path, 'utf8').trim().split('\n');
const foundModels = new Set();

for (const line of lines) {
  try {
    const entry = JSON.parse(line);
    if (entry.type !== 'assistant') continue;
    if (!entry.message || !Array.isArray(entry.message.content)) continue;

    for (const block of entry.message.content) {
      if (block.type !== 'tool_use') continue;
      const name = block.name || '';
      if (name.startsWith('mcp__codex-cli__')) foundModels.add('codex');
      if (name.startsWith('mcp__gemini-cli__')) foundModels.add('gemini');
      if (name.startsWith('mcp__opencode__')) foundModels.add('opencode');
    }
  } catch (e) { /* skip malformed lines */ }
}

const required = config.required_models; // ['codex', 'gemini', 'opencode']
const missing = required.filter(m => !foundModels.has(m));

if (missing.length > 0) {
  // BLOCK: quorum not satisfied
  process.stdout.write(JSON.stringify({
    decision: "block",
    reason: `Quorum incomplete. Missing: ${missing.join(', ')}. Run quorum then retry.`
  }));
  process.exit(0);  // exit 0 required for JSON output to be processed
}
// PASS: exit 0 with no output
process.exit(0);
```

**Trade-offs:**
- `stop_hook_active` guard is critical — without it, the Stop hook blocks indefinitely. Must check this before scanning.
- Transcript scanning is O(n) on session length — acceptable for typical session sizes (hundreds of lines)
- The hook reads the full transcript each time Stop fires, not just the current turn. This means quorum evidence anywhere in the session suffices — this is intentional (quorum is per-session for the planning command, not per-response)
- JSONL parsing must be defensive: malformed lines should be skipped, not crash the hook

### Pattern 3: Scope Filtering — Only Block When a Planning Command Was Detected

**What:** The Stop hook must distinguish between sessions where a planning command was issued (and quorum is required) versus general sessions (where Stop should always pass). This is solved by checking whether the transcript contains a user message matching a quorum command.

**Why:** Without scope filtering, every Claude Code session in every project would be blocked at Stop if quorum tool calls were not present, breaking all non-GSD work.

**Implementation options (in priority order):**

1. **Preferred:** Scan transcript for user messages matching quorum commands. If none found, Stop hook passes immediately.
2. **Alternative:** UserPromptSubmit hook writes a session marker file (`/tmp/qgsd-{session_id}.json`) that the Stop hook reads. Clean up on SessionEnd. Downside: file system coordination, cleanup complexity.

Option 1 is self-contained and has no side effects. The transcript already contains all the information needed.

```javascript
// In qgsd-stop.js — check if this session had a planning command
function sessionHasPlanningCommand(lines, quorumCommands) {
  const cmdPattern = new RegExp(
    '\\/gsd:(' + quorumCommands.join('|').replace(/-/g, '\\-') + ')'
  );
  for (const line of lines) {
    try {
      const entry = JSON.parse(line);
      if (entry.type !== 'user') continue;
      // User messages: content can be string or array
      const text = typeof entry.message === 'string'
        ? entry.message
        : JSON.stringify(entry.message);
      if (cmdPattern.test(text)) return true;
    } catch (e) {}
  }
  return false;
}
```

---

## Data Flow

### Command Invocation to Quorum Verification

```
User types: /gsd:plan-phase 2
          │
          │ UserPromptSubmit fires
          ▼
qgsd-prompt.js
  reads stdin: { prompt: "/gsd:plan-phase 2", transcript_path: "...", session_id: "..." }
  matches COMMAND_PATTERN → true
  reads qgsd-config.json → quorum_commands, quorum_instructions
  writes to stdout: { hookSpecificOutput: { hookEventName: "UserPromptSubmit", additionalContext: "..." } }
  exit 0
          │
          │ Claude Code adds additionalContext to Claude's context window
          ▼
Claude processes /gsd:plan-phase 2
  Sees quorum instructions in context
  Calls mcp__codex-cli__review (or mcp__codex-cli__codex)
  Calls mcp__gemini-cli__gemini
  Calls mcp__opencode__opencode
  Produces planning output
          │
          │ Claude finishes responding → Stop fires
          ▼
qgsd-stop.js
  reads stdin: { transcript_path: "...", stop_hook_active: false, ... }
  stop_hook_active = false → proceed
  reads transcript_path JSONL line by line
  scans for type=="assistant" lines → message.content[] → tool_use blocks
    finds name=="mcp__codex-cli__review" → adds 'codex' to foundModels
    finds name=="mcp__gemini-cli__gemini" → adds 'gemini' to foundModels
    finds name=="mcp__opencode__opencode" → adds 'opencode' to foundModels
  checks user messages for planning command → found
  missing = [] (all models present)
  exit 0 (no output = PASS)
          │
          ▼
Claude delivers planning output to user
```

### Quorum Missing — Block Path

```
Claude finishes WITHOUT calling quorum models
          │
          │ Stop fires
          ▼
qgsd-stop.js
  scans transcript → foundModels = { 'codex' } (gemini missing, opencode missing)
  missing = ['gemini', 'opencode']
  writes to stdout: { decision: "block", reason: "Quorum incomplete. Missing: gemini, opencode. ..." }
  exit 0
          │
          │ Claude Code reads decision:"block"
          │ Claude continues with reason as instruction
          ▼
Claude calls mcp__gemini-cli__gemini, mcp__opencode__opencode
          │
          │ Stop fires again
          ▼
qgsd-stop.js
  stop_hook_active = true → exit 0 immediately (pass)
  (This prevents infinite loop when Claude was already caused to continue by a stop hook)
```

**Important:** `stop_hook_active` is `true` on the second Stop invocation when Claude continued due to a prior Stop hook block. The hook must pass immediately in this case to avoid infinite loops. The correct logic is: if `stop_hook_active` is `true`, check if quorum is now satisfied; if yes, pass; if no, also pass (to avoid loop) and rely on the prior block having injected the instructions.

**Revised stop_hook_active handling:**

```javascript
if (input.stop_hook_active) {
  // Don't re-block: Claude was already instructed to run quorum.
  // If it still didn't, blocking again creates an infinite loop.
  // Trust that the prior block message was seen.
  process.exit(0);
}
```

---

## Config File Design

### `~/.claude/qgsd-config.json`

```json
{
  "quorum_commands": [
    "plan-phase",
    "new-project",
    "new-milestone",
    "discuss-phase",
    "verify-work",
    "research-phase"
  ],
  "fail_mode": "open",
  "required_models": {
    "codex": { "tool_prefix": "mcp__codex-cli__", "required": true },
    "gemini": { "tool_prefix": "mcp__gemini-cli__", "required": true },
    "opencode": { "tool_prefix": "mcp__opencode__", "required": true }
  },
  "quorum_instructions": "QUORUM REQUIRED: Before producing planning output, you MUST call Codex (mcp__codex-cli__review), Gemini (mcp__gemini-cli__gemini), and OpenCode (mcp__opencode__opencode) per CLAUDE.md R3. The Stop hook will verify this. Fail-open: if a model is UNAVAILABLE (returns error), note it and proceed with remaining models."
}
```

**Field semantics:**

| Field | Type | Description |
|-------|------|-------------|
| `quorum_commands` | string[] | Command slugs (after `/gsd:`) that trigger quorum injection and verification |
| `fail_mode` | `"open"` | `"open"` = proceed when models are unavailable (v1 only; `"closed"` is future). Must match CLAUDE.md R6 |
| `required_models` | object | Map of model keys to tool prefix and required flag. `tool_prefix` used for transcript scanning |
| `quorum_instructions` | string | The additionalContext text injected by UserPromptSubmit hook. User-editable to customize instructions |

**Config loading:**

```javascript
function loadConfig() {
  const configPath = path.join(os.homedir(), '.claude', 'qgsd-config.json');
  if (!fs.existsSync(configPath)) {
    // Return hardcoded defaults — do not fail if config missing
    return DEFAULT_CONFIG;
  }
  try {
    return JSON.parse(fs.readFileSync(configPath, 'utf8'));
  } catch (e) {
    // Malformed config = fail open, use defaults
    return DEFAULT_CONFIG;
  }
}
```

---

## Installer Design

### How QGSD Installs Into `~/.claude/settings.json`

GSD's installer pattern (verified from `bin/install.js`): read `settings.json`, add hook entries, write back. QGSD follows the identical pattern.

**Entries to add in `settings.json`:**

```json
{
  "hooks": {
    "UserPromptSubmit": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "node \"/Users/username/.claude/hooks/qgsd-prompt.js\""
          }
        ]
      }
    ],
    "Stop": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "node \"/Users/username/.claude/hooks/qgsd-stop.js\"",
            "timeout": 30
          }
        ]
      }
    ]
  }
}
```

**Notes:**
- `UserPromptSubmit` has no matcher support (always fires on every prompt) — no `matcher` field needed
- `Stop` has no matcher support — no `matcher` field needed
- The `timeout` on the Stop hook should be conservative (30s) since transcript parsing is synchronous I/O
- Hook commands use absolute paths with the actual home directory expanded (same as GSD's `buildHookCommand()`)

**Installer responsibilities:**

1. Detect `~/.claude/` (global install target — v1 is global only, matching GSD)
2. Copy `hooks/dist/qgsd-prompt.js` → `~/.claude/hooks/qgsd-prompt.js`
3. Copy `hooks/dist/qgsd-stop.js` → `~/.claude/hooks/qgsd-stop.js`
4. Write default `~/.claude/qgsd-config.json` (if not already present — preserve user customizations)
5. Read `~/.claude/settings.json`, add `UserPromptSubmit` and `Stop` hook entries, write back
6. Report success with instructions

---

## Anti-Patterns

### Anti-Pattern 1: Blocking on Every Stop

**What people do:** Register a Stop hook that always scans for quorum and blocks if not found, regardless of whether the session involved a GSD planning command.

**Why it's wrong:** Every Claude Code session in every project gets blocked. Non-GSD work, non-planning commands (like `/gsd:execute-phase`), and general coding sessions all fail until the user calls three external model CLIs.

**Do this instead:** Scope the Stop hook. Scan user messages in the transcript first — only proceed with quorum verification if a planning command was detected in this session.

### Anti-Pattern 2: Infinite Stop Hook Loop

**What people do:** Always block in the Stop hook when quorum is missing, including when `stop_hook_active` is `true`.

**Why it's wrong:** When Claude continues due to a Stop hook block, Claude Code sets `stop_hook_active: true` on the next Stop invocation. Blocking again creates an infinite loop that never terminates the session.

**Do this instead:** Check `stop_hook_active` first. If `true`, exit 0 immediately. Claude was already instructed to run quorum; trust the instruction.

### Anti-Pattern 3: Calling Model CLIs Directly From Hooks

**What people do:** From the Stop or UserPromptSubmit hook, spawn subprocess calls to `codex`, `gemini`, or `opencode` CLIs to actually run the quorum.

**Why it's wrong:** Hooks execute in Claude Code's environment, not inside Claude's context. Spawning CLIs from hooks adds auth complexity (each CLI needs its own credentials), fragile subprocess management, and timeout risks. The quorum tools (`mcp__codex-cli__review` etc.) are already available to Claude through MCPs — Claude should call them, not the hook.

**Do this instead:** The hook's job is injection (UserPromptSubmit) and verification (Stop). Claude itself calls the quorum tools. The Stop hook only reads evidence, it never produces quorum output.

### Anti-Pattern 4: Modifying GSD Source Files

**What people do:** Patch `gsd-planner.md` or `gsd-roadmapper.md` to include quorum instructions directly.

**Why it's wrong:** GSD updates overwrite those files. QGSD must be zero-coupling — it works on top of GSD without touching any GSD file. Any GSD update must be transparent to QGSD.

**Do this instead:** All QGSD logic lives in the hook layer only. QGSD installs independently alongside GSD with no shared files.

### Anti-Pattern 5: Hardcoding Tool Names in Stop Hook

**What people do:** Check for `mcp__codex-cli__codex` specifically (the interactive codex tool) rather than `mcp__codex-cli__*` prefix.

**Why it's wrong:** Claude may use `mcp__codex-cli__review` (the review-specific tool) rather than `mcp__codex-cli__codex`. The CLAUDE.md policy specifies "Codex" as a model, not a specific tool name. Hardcoding the tool name breaks when users call different Codex MCP tools.

**Do this instead:** Match on tool name prefix (`mcp__codex-cli__`), not exact tool name. This matches any tool from the Codex MCP server.

---

## Build Order — Dependencies Between Components

```
1. qgsd-config.js           (no dependencies — pure config parsing)
        ↓
2. qgsd-prompt.js           (depends on: qgsd-config.js)
   qgsd-stop.js             (depends on: qgsd-config.js)
        ↓
3. build-hooks.js           (bundles qgsd-prompt + qgsd-config → dist/qgsd-prompt.js)
                            (bundles qgsd-stop + qgsd-config → dist/qgsd-stop.js)
        ↓
4. templates/qgsd-config.json  (no code dependencies — data only; defines defaults)
        ↓
5. bin/install.js           (depends on: dist/hooks, templates/qgsd-config.json, package.json)
        ↓
6. package.json             (ties it all together: bin, files, build scripts)
```

**Build constraints:**
- Hooks must be bundled before distribution (same as GSD). `hooks/dist/` is in `package.json` `files`, not `hooks/` (source).
- `qgsd-config.js` must be bundled INTO each hook (not a separate file at `~/.claude/hooks/`) because there is no `node_modules` in the install target directory.
- The Stop hook must handle missing `transcript_path` gracefully (e.g., empty session) — exit 0 silently.

**Implementation sequence for a single developer:**

```
Phase 1: Foundation
  1a. qgsd-config.js        — config schema + defaults
  1b. templates/config.json — matching default config file

Phase 2: Hook Bodies (can develop in parallel after Phase 1)
  2a. qgsd-prompt.js        — UserPromptSubmit: pattern match + inject
  2b. qgsd-stop.js          — Stop: transcript parse + verify

Phase 3: Build
  3a. build-hooks.js        — esbuild bundler (copy from GSD's build-hooks.js pattern)
  3b. Verify: node hooks/dist/qgsd-prompt.js (with mock stdin)
  3c. Verify: node hooks/dist/qgsd-stop.js (with real transcript JSONL)

Phase 4: Installer
  4a. bin/install.js        — copy hooks, write settings.json entries, write config
  4b. Test: npx . → verify ~/.claude/hooks/ and settings.json entries

Phase 5: Integration Test
  5a. Install, trigger /gsd:plan-phase, verify injection in Claude context
  5b. Verify Stop blocks when quorum missing
  5c. Verify Stop passes when quorum present
  5d. Verify non-planning commands pass Stop without quorum requirement
```

---

## How QGSD Coexists With GSD

**Zero coupling design:**

| Dimension | GSD | QGSD | Coupling |
|-----------|-----|------|---------|
| Commands (`~/.claude/commands/gsd/`) | owns all `/gsd:*` commands | never touches | none |
| Agents (`~/.claude/agents/`) | owns all `gsd-*.md` agents | never touches | none |
| Workflows (`~/.claude/get-shit-done/`) | owns all workflows | never touches | none |
| Hooks (`~/.claude/hooks/`) | owns `gsd-statusline.js`, `gsd-check-update.js` | adds `qgsd-prompt.js`, `qgsd-stop.js` | file-level coexistence only |
| `settings.json` | adds `SessionStart` hook, `statusLine` | adds `UserPromptSubmit` hook, `Stop` hook | additive merge, no conflicts |
| Config | none relevant | `qgsd-config.json` (separate file) | none |

**GSD updates:** When the user runs `npx get-shit-done-cc@latest`, GSD updates its own files. QGSD's `qgsd-prompt.js`, `qgsd-stop.js`, and `qgsd-config.json` are untouched. The `settings.json` hook registrations persist.

**QGSD updates:** When QGSD updates, it overwrites `qgsd-prompt.js` and `qgsd-stop.js`, and merges new hook entries (idempotent: check before adding). GSD files are untouched.

---

## Integration Points

### Internal Boundaries

| Boundary | Communication | Notes |
|----------|---------------|-------|
| Claude Code → qgsd-prompt.js | JSON via stdin (UserPromptSubmit payload) | `prompt`, `transcript_path`, `session_id`, `cwd` |
| qgsd-prompt.js → Claude Code | JSON via stdout (additionalContext) | `hookSpecificOutput.additionalContext` string |
| Claude Code → qgsd-stop.js | JSON via stdin (Stop payload) | `transcript_path`, `stop_hook_active`, `last_assistant_message` |
| qgsd-stop.js → Claude Code | JSON via stdout OR exit 0 | `decision:"block"` + `reason`, or silent exit 0 for pass |
| qgsd-stop.js → transcript_path JSONL | Filesystem read (synchronous) | JSONL at `~/.claude/projects/{project_hash}/{session_id}.jsonl` |
| qgsd-config.js → qgsd-config.json | Filesystem read (synchronous) | `~/.claude/qgsd-config.json` |

### External Services

| Service | Integration Pattern | Notes |
|---------|---------------------|-------|
| Codex MCP | Claude Code calls `mcp__codex-cli__*` tools | Quorum evidence only; QGSD never calls directly |
| Gemini MCP | Claude Code calls `mcp__gemini-cli__*` tools | Quorum evidence only; QGSD never calls directly |
| OpenCode MCP | Claude Code calls `mcp__opencode__*` tools | Quorum evidence only; QGSD never calls directly |
| npm registry | Version check on install (future) | Same pattern as GSD's `gsd-check-update.js` |

---

## Sources

- [Claude Code Hooks Reference](https://code.claude.com/docs/en/hooks) — HIGH confidence (official Anthropic docs). UserPromptSubmit payload, Stop payload, `stop_hook_active`, `decision`/`reason` JSON output, `additionalContext` in hookSpecificOutput, exit code behavior.
- Live QGSD session transcript (`~/.claude/projects/-Users-jonathanborduas-code-QGSD/8053c02f...jsonl`) — HIGH confidence (first-party data). Verified: `type:"assistant"`, `message.content[].type:"tool_use"`, `name:"mcp__codex-cli__codex"`, `name:"mcp__gemini-cli__gemini"`, `name:"mcp__opencode__opencode"`. Found 4 MCP calls total (1 Codex, 1 Gemini, 2 OpenCode).
- GSD installer source (`/Users/jonathanborduas/code/QGSD/bin/install.js`) — HIGH confidence (source code). `buildHookCommand()`, `settings.json` merge pattern, hooks/dist/ copy logic, global install path resolution.
- GSD hooks source (`/Users/jonathanborduas/code/QGSD/hooks/gsd-statusline.js`, `gsd-check-update.js`) — HIGH confidence (source code). Stdin JSON parsing pattern, error handling, silent fail approach.
- `/Users/jonathanborduas/code/QGSD/.planning/PROJECT.md` — HIGH confidence (authoritative project context). Architecture decision: UserPromptSubmit + Stop hook (A+C), fail-open, plugin extension only.

---
*Architecture research for: QGSD — Claude Code plugin, hook-based multi-model quorum enforcement*
*Researched: 2026-02-20*
