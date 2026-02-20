# Stack Research

**Domain:** Claude Code hook-based plugin extension
**Researched:** 2026-02-20
**Confidence:** HIGH — all hook schemas verified from official docs at code.claude.com/docs/en/hooks and cross-validated against the live GSD codebase (gsd-guardian.py, gsd-statusline.js, gsd-check-update.js, settings.json)

---

## Recommended Stack

### Core Technologies

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| Node.js | >=16.7.0 | Hook runtime | GSD hooks are Node.js; Claude Code itself ships Node; zero install overhead for users who have Claude Code. The existing gsd-statusline.js and gsd-check-update.js confirm Node is already the runtime of record. |
| Python 3 | system (3.9+) | Alternative hook runtime | gsd-guardian.py demonstrates Python works equally well for stateful, complex hooks. Python is preferred when logic involves subprocess calls to external CLIs (gemini, codex). Either runtime is valid; choose based on what the hook does. |
| JSON/JSONL | (no lib) | Transcript parsing | Claude Code transcript files are newline-delimited JSON (one JSON object per line). Node's `JSON.parse()` on each line is the only dependency. No external library needed. |

### Supporting Libraries

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `fs` (Node built-in) | built-in | Read transcript JSONL files, read/write settings.json | Always — the Stop hook reads transcript_path with `fs.readFileSync` |
| `readline` (Node built-in) | built-in | Stream-parse large JSONL transcripts line by line | When transcript files are large (>1MB) and reading the whole file wastes memory |
| `path` (Node built-in) | built-in | Resolve transcript_path and hook script paths | Always |
| `os` (Node built-in) | built-in | Resolve home directory (~/.claude) in install scripts | Install logic only |
| `json` (Python built-in) | built-in | Parse stdin hook input in Python hooks | Always for Python hooks |
| `subprocess` (Python built-in) | built-in | Call gemini/codex CLIs from hooks | When Stage 2 AI analysis is needed (see gsd-guardian.py pattern) |
| `re` (Python built-in) | built-in | Pattern-match user prompts and commit messages | When hook needs to detect command names from prompt text |

### Development Tools

| Tool | Purpose | Notes |
|------|---------|-------|
| `node scripts/build-hooks.js` | Copy hooks from source to `hooks/dist/` for packaging | GSD's existing build script; QGSD will need the same pattern if hooks are bundled in an npm package |
| `/hooks` menu in Claude Code | Interactive hook registration UI | Verify hooks are registered correctly during development without editing settings.json manually |
| `claude --debug` | Show which hooks matched, exit codes, stdout | Primary debugging tool; add `Ctrl+O` for verbose mode in TUI |
| `chmod +x` | Make shell scripts executable | Required for any hook that is not invoked as `node script.js` or `python3 script.py` |

---

## Hook System Architecture

This section documents the actual Claude Code hooks API that QGSD will use.

### How Hooks Register

Hooks are registered in `settings.json` (global: `~/.claude/settings.json`, project: `.claude/settings.json`). The structure is:

```json
{
  "hooks": {
    "UserPromptSubmit": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "node \"/Users/.../.claude/hooks/qgsd-quorum-inject.js\""
          }
        ]
      }
    ],
    "Stop": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "python3 \"/Users/.../.claude/hooks/qgsd-quorum-verify.py\""
          }
        ]
      }
    ]
  }
}
```

The three-level nesting is: event name → array of matcher groups → each group has a `hooks` array of handlers. `UserPromptSubmit` and `Stop` do not support `matcher` (they fire on every occurrence). Adding a `matcher` field to these events is silently ignored.

For plugin distribution via `.claude-plugin/`, hooks go in `hooks/hooks.json` at the plugin root. Claude Code merges plugin hooks with user/project hooks when the plugin is enabled.

### UserPromptSubmit Hook

**When it fires:** Before Claude processes the user's prompt.

**Input schema (received on stdin as JSON):**

```json
{
  "session_id": "abc123",
  "transcript_path": "/Users/.../.claude/projects/.../00893aaf-19fa-41d2-8238-13269b9b3ca0.jsonl",
  "cwd": "/Users/.../my-project",
  "permission_mode": "default",
  "hook_event_name": "UserPromptSubmit",
  "prompt": "/gsd:plan-phase 3"
}
```

Key field: `prompt` — the raw text the user submitted. This is what you match against to detect GSD planning commands.

**Output (written to stdout, exit 0):**

Two equivalent ways to inject context into Claude's conversation:

1. Plain text to stdout (shown as hook output in transcript)
2. JSON with `additionalContext` (injected more discretely, not shown as hook output)

```json
{
  "hookSpecificOutput": {
    "hookEventName": "UserPromptSubmit",
    "additionalContext": "Instructions Claude sees but user does not see as hook output"
  }
}
```

To block the prompt entirely (reject it, erase from context):

```json
{
  "decision": "block",
  "reason": "Shown to user, not to Claude"
}
```

**What `additionalContext` actually does:** It injects a string into Claude's context window as if it were part of the system prompt, but scoped to this turn. Claude sees it and follows it. The user does not see it in the chat UI as a hook output (unlike plain stdout). This is the mechanism for injecting quorum instructions without the user seeing a noisy output block every time they run a command.

**What `systemMessage` does:** A warning shown to the user in the UI. Not added to Claude's context. Use for user-facing warnings only.

**Exit code 2 behavior:** Blocks the prompt and erases it. The user sees stderr text as an error. Use only for hard rejection (blocked commands, policy violations).

### Stop Hook

**When it fires:** When Claude finishes responding and would stop. Does NOT fire on user interrupts.

**Input schema (received on stdin as JSON):**

```json
{
  "session_id": "abc123",
  "transcript_path": "/Users/.../.claude/projects/.../00893aaf-19fa-41d2-8238-13269b9b3ca0.jsonl",
  "cwd": "/Users/.../my-project",
  "permission_mode": "default",
  "hook_event_name": "Stop",
  "stop_hook_active": false,
  "last_assistant_message": "Here is the plan for Phase 3..."
}
```

Key fields:
- `stop_hook_active`: `true` when Claude Code is already continuing because a Stop hook previously blocked. **You MUST check this field to prevent infinite loops.** If `stop_hook_active` is already `true`, your hook must allow Claude to stop (exit 0 with no blocking decision).
- `transcript_path`: Path to the JSONL file containing the full session. Read this to verify quorum evidence.
- `last_assistant_message`: The text of Claude's last response, available without parsing the transcript. Useful for quick checks on response content.

**Output to block Claude from stopping (prevent response delivery):**

```json
{
  "decision": "block",
  "reason": "Quorum not complete. You must call mcp__codex-cli__review and mcp__gemini-cli__gemini before delivering this planning output."
}
```

The `reason` string is fed back to Claude as an instruction — it becomes Claude's next prompt. Claude then continues working based on that reason.

**Output to allow Claude to stop (no-op):**

Exit 0 with no output, or exit 0 with any JSON that omits `decision`.

**What "preventDefault" means in Stop hooks:** The `decision: "block"` field is the mechanism. There is no literal `preventDefault` function — it is conceptual. Returning `{"decision": "block", "reason": "..."}` prevents the stop event from completing (i.e., prevents Claude from delivering its response) and feeds `reason` back as Claude's next instruction.

**Critical: the infinite loop problem.** If the Stop hook always returns `decision: "block"`, Claude will loop forever. The pattern is:
1. Check `stop_hook_active`. If `true`, exit 0 (allow stop).
2. Read the transcript. If quorum evidence is present, exit 0.
3. If quorum is missing, return `decision: "block"` with instructions to run quorum.

### Transcript JSONL Format

The `transcript_path` file is a newline-delimited JSON file. Each line is a JSON object. From inspection of live transcripts at `~/.claude/projects/`:

**User message entry:**
```json
{
  "parentUuid": null,
  "isSidechain": false,
  "userType": "external",
  "cwd": "/Users/.../my-project",
  "sessionId": "abc123",
  "version": "2.1.32",
  "type": "user",
  "message": {
    "role": "user",
    "content": "/gsd:plan-phase 3"
  },
  "uuid": "ea5a2a16-...",
  "timestamp": "2026-02-12T06:21:50.976Z"
}
```

**Assistant message with tool use:**
```json
{
  "parentUuid": "...",
  "isSidechain": false,
  "type": "assistant",
  "message": {
    "role": "assistant",
    "model": "claude-sonnet-4-6",
    "id": "msg_01...",
    "content": [
      {
        "type": "tool_use",
        "id": "toolu_01...",
        "name": "mcp__codex-cli__review",
        "input": { "prompt": "..." }
      }
    ],
    "stop_reason": "tool_use"
  },
  "uuid": "...",
  "timestamp": "2026-02-12T06:21:53.941Z"
}
```

**What to look for in a Stop hook verifying quorum:** Search transcript lines where `message.content` is an array and any element has `type === "tool_use"` and `name` matches `mcp__codex-cli__review`, `mcp__gemini-cli__gemini`, or `mcp__opencode__opencode`. The presence of those tool_use entries confirms quorum tool calls were made.

**Parsing pattern (Node.js):**

```javascript
const fs = require('fs');

function readTranscript(transcriptPath) {
  const lines = fs.readFileSync(transcriptPath, 'utf8')
    .split('\n')
    .filter(line => line.trim());
  return lines.map(line => {
    try { return JSON.parse(line); }
    catch { return null; }
  }).filter(Boolean);
}

function findToolUseCalls(entries, toolNamePattern) {
  const found = [];
  for (const entry of entries) {
    if (!entry.message || !Array.isArray(entry.message.content)) continue;
    for (const block of entry.message.content) {
      if (block.type === 'tool_use' && toolNamePattern.test(block.name)) {
        found.push({ name: block.name, id: block.id, input: block.input });
      }
    }
  }
  return found;
}
```

**Parsing pattern (Python):**

```python
import json

def read_transcript(transcript_path):
    entries = []
    with open(transcript_path, 'r') as f:
        for line in f:
            line = line.strip()
            if not line:
                continue
            try:
                entries.append(json.loads(line))
            except json.JSONDecodeError:
                pass
    return entries

def find_tool_use_calls(entries, tool_names):
    found = []
    for entry in entries:
        msg = entry.get('message', {})
        content = msg.get('content', [])
        if not isinstance(content, list):
            continue
        for block in content:
            if block.get('type') == 'tool_use' and block.get('name') in tool_names:
                found.append(block)
    return found
```

### Plugin manifest (`.claude-plugin/plugin.json`)

For distributing QGSD as a Claude Code plugin (vs. a standalone npm installer), the manifest lives at `.claude-plugin/plugin.json`. Only `name` is required; all other fields are metadata:

```json
{
  "name": "qgsd",
  "version": "1.0.0",
  "description": "Quorum enforcement layer for GSD planning commands",
  "author": {
    "name": "TACHES"
  },
  "hooks": "./hooks/hooks.json"
}
```

All component directories (`commands/`, `agents/`, `hooks/`) must be at the **plugin root**, not inside `.claude-plugin/`. Only `plugin.json` goes in `.claude-plugin/`.

The `hooks/hooks.json` file in the plugin root uses the same format as `settings.json` hooks but wraps them:

```json
{
  "description": "QGSD quorum enforcement hooks",
  "hooks": {
    "UserPromptSubmit": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "${CLAUDE_PLUGIN_ROOT}/hooks/qgsd-quorum-inject.js"
          }
        ]
      }
    ],
    "Stop": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "${CLAUDE_PLUGIN_ROOT}/hooks/qgsd-quorum-verify.py",
            "timeout": 30
          }
        ]
      }
    ]
  }
}
```

`${CLAUDE_PLUGIN_ROOT}` is the environment variable Claude Code sets to the plugin's absolute path. Always use it instead of hardcoded paths so the plugin works regardless of where it is installed.

**Plugin installation scope:** Plugins install to `~/.claude/settings.json` (user scope, default) or `.claude/settings.json` (project scope). QGSD targets user scope to match GSD's global install behavior.

---

## Complete Stop Hook Example (Node.js)

A full Stop hook that reads the transcript, checks for quorum evidence, and blocks with `decision: "block"` if quorum is missing:

```javascript
#!/usr/bin/env node
/**
 * QGSD Stop Hook — Quorum verification gate
 * Reads transcript JSONL, looks for Codex/Gemini/OpenCode tool_use calls,
 * blocks if quorum is missing and stop_hook_active is false.
 */

const fs = require('fs');

const QUORUM_TOOLS = [
  'mcp__codex-cli__review',
  'mcp__gemini-cli__gemini',
  'mcp__opencode__opencode',
];

// Minimum number of distinct quorum tools that must appear
const QUORUM_MIN = 2;

function main() {
  let input = '';
  process.stdin.setEncoding('utf8');
  process.stdin.on('data', chunk => input += chunk);
  process.stdin.on('end', () => {
    try {
      const hookData = JSON.parse(input);

      // CRITICAL: prevent infinite loops
      if (hookData.stop_hook_active) {
        process.exit(0);
      }

      const transcriptPath = hookData.transcript_path;
      if (!transcriptPath || !fs.existsSync(transcriptPath)) {
        process.exit(0); // fail-open: can't read transcript
      }

      // Parse transcript JSONL
      const lines = fs.readFileSync(transcriptPath, 'utf8')
        .split('\n')
        .filter(l => l.trim());

      const toolsFound = new Set();
      for (const line of lines) {
        let entry;
        try { entry = JSON.parse(line); } catch { continue; }
        const content = entry?.message?.content;
        if (!Array.isArray(content)) continue;
        for (const block of content) {
          if (block.type === 'tool_use' && QUORUM_TOOLS.includes(block.name)) {
            toolsFound.add(block.name);
          }
        }
      }

      if (toolsFound.size < QUORUM_MIN) {
        const missing = QUORUM_TOOLS.filter(t => !toolsFound.has(t));
        console.log(JSON.stringify({
          decision: 'block',
          reason: `QUORUM INCOMPLETE. You must call these tools before delivering planning output: ${missing.join(', ')}. Call them now with the full plan content, resolve any concerns, then respond to the user.`
        }));
        return;
      }

      // Quorum verified — allow Claude to stop
      process.exit(0);

    } catch (e) {
      // Fail-open: parse error means we can't verify, let Claude stop
      process.exit(0);
    }
  });
}

main();
```

---

## Complete UserPromptSubmit Hook Example (Python)

A UserPromptSubmit hook that detects GSD planning commands and injects quorum instructions:

```python
#!/usr/bin/env python3
"""
QGSD Quorum Inject — UserPromptSubmit hook
Detects GSD planning commands and injects multi-model review instructions.
"""

import json
import re
import sys

GSD_GUARDED_COMMANDS = [
    "plan-phase", "verify-work", "new-milestone",
    "new-project", "discuss-phase", "research-phase",
]

QUORUM_INJECTION = """
QUORUM REQUIRED (QGSD enforcement — cannot be skipped)

Before presenting any planning output to the user, you MUST:
  1. Call mcp__codex-cli__review with the full plan content
  2. Call mcp__gemini-cli__gemini with the full plan content
  3. Resolve ALL concerns raised before presenting to the user

If a model is UNAVAILABLE (quota/error), note it and proceed with available models.
Do not skip this step. A Stop hook will verify compliance in the transcript.
""".strip()


def main():
    try:
        hook_input = json.load(sys.stdin)
    except Exception:
        sys.exit(0)

    prompt = hook_input.get("prompt", "")
    pattern = "|".join(re.escape(cmd) for cmd in GSD_GUARDED_COMMANDS)
    if not re.search(rf"/(gsd:)?({pattern})", prompt):
        sys.exit(0)  # Not a guarded command — do nothing

    output = {
        "hookSpecificOutput": {
            "hookEventName": "UserPromptSubmit",
            "additionalContext": QUORUM_INJECTION
        }
    }
    print(json.dumps(output))


if __name__ == "__main__":
    main()
```

---

## Alternatives Considered

| Recommended | Alternative | When to Use Alternative |
|-------------|-------------|-------------------------|
| Command hook (`type: "command"`) | Prompt hook (`type: "prompt"`) | Use prompt hooks for simple yes/no decisions where you want an LLM to evaluate rather than deterministic logic. For QGSD, command hooks are correct because quorum verification is deterministic (scan transcript for tool names). |
| Command hook (`type: "command"`) | Agent hook (`type: "agent"`) | Use agent hooks when verification requires using Claude Code tools (Read, Grep, Glob). For QGSD, the transcript is a single file at a known path — `fs.readFileSync` is sufficient, no agent needed. |
| Node.js for Stop hook | Python for Stop hook | Either works. Node matches GSD's existing hook runtime. Python is better when subprocess calls to external CLIs are needed (gsd-guardian.py pattern). For QGSD's Stop hook (pure transcript parsing), Node.js is simpler. |
| Global install (`~/.claude/`) | Plugin distribution (`.claude-plugin/`) | Plugin distribution is correct for distributing to other users via a marketplace. For v1 (personal use, matches GSD's install model), global install via npm installer is simpler and avoids marketplace setup. |
| `additionalContext` field | Plain stdout | Plain stdout works but appears as visible hook output in the transcript UI. `additionalContext` injects context discretely. Use `additionalContext` for instructions you want Claude to follow but don't want cluttering the user's view. |
| `stop_hook_active` guard | Counter/session state | The `stop_hook_active` flag is the correct mechanism — it is provided by Claude Code precisely for this purpose. Do not try to implement your own counter. |

## What NOT to Use

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| Calling gemini/codex CLIs directly from Stop hook | Fragile (auth, PATH, quota), adds latency to every response, breaks in CI/remote environments | Verify via transcript evidence that the MCP tool calls already happened during Claude's turn |
| `exit 2` in Stop hook to block | Exit 2 does block the stop, but stderr is shown to the user as an error — wrong UX. Also doesn't feed instructions to Claude | Return `{"decision": "block", "reason": "..."}` via stdout with exit 0 |
| `systemMessage` for quorum instructions | `systemMessage` is shown as a warning to the user in the UI, not injected into Claude's context | `additionalContext` inside `hookSpecificOutput` — this goes into Claude's context, not the user's view |
| Async hooks for Stop/UserPromptSubmit | `async: true` means the hook cannot block or return decisions — the action has already proceeded | Synchronous command hooks (the default) |
| Hardcoded absolute paths in hook scripts | Breaks for other users, breaks after moving `~/.claude` | Use `${CLAUDE_PLUGIN_ROOT}` in plugin hooks.json, or compute path from `os.homedir()` at runtime in the hook script |

---

## Stack Patterns by Variant

**If distributing via npm (matching GSD's pattern):**
- Write hooks as standalone Node.js or Python scripts
- Place in `hooks/` directory in the repo
- Build step copies to `hooks/dist/` (see `scripts/build-hooks.js`)
- Installer (`bin/install.js`) copies `hooks/dist/` to `~/.claude/hooks/` and registers them in `settings.json`
- No bundling needed — hooks are pure Node.js/Python with stdlib only

**If distributing as a Claude Code plugin:**
- Place hook scripts in `hooks/` or `scripts/` at plugin root
- Register them in `hooks/hooks.json` using `${CLAUDE_PLUGIN_ROOT}/...` paths
- Create `.claude-plugin/plugin.json` with `"hooks": "./hooks/hooks.json"`
- Users install with `claude plugin install qgsd@your-marketplace`

**If hooks need to scope by project (per-project quorum config):**
- Read a config file from `process.cwd()` or `hookData.cwd` at hook runtime
- Fall back to global defaults if no project config exists
- This avoids per-project install while supporting per-project customization

---

## Version Compatibility

| Package | Compatible With | Notes |
|---------|-----------------|-------|
| Claude Code hooks API | claude-code >= 1.x | The `additionalContext`, `stop_hook_active`, `last_assistant_message` fields are present in the current API (verified from code.claude.com/docs/en/hooks, 2026-02). `stop_hook_active` is critical for QGSD — verify it exists before shipping. |
| Node.js | >= 16.7.0 | Matches GSD's engine requirement. All stdlib APIs used (fs, path, readline, os) are available in Node 16+. |
| Python | >= 3.6 | f-strings and json stdlib used. No external dependencies. |

---

## Sources

- `https://code.claude.com/docs/en/hooks` — Official hooks reference. All input/output schemas, exit code behavior, `stop_hook_active`, `additionalContext`, `decision: "block"`, `preventDefault` equivalent. Confidence: HIGH.
- `https://code.claude.com/docs/en/plugins-reference` — Official plugin manifest schema (`.claude-plugin/plugin.json`), hooks.json format, `${CLAUDE_PLUGIN_ROOT}`, component directory layout. Confidence: HIGH.
- `/Users/jonathanborduas/.claude/hooks/gsd-guardian.py` — Live production UserPromptSubmit hook. Shows stdin JSON parsing, prompt regex matching, `systemMessage` output, subprocess calls to gemini/codex CLIs. Confidence: HIGH (first-party codebase evidence).
- `/Users/jonathanborduas/.claude/hooks/gsd-statusline.js` — Live production StatusLine hook. Shows stdin JSON schema fields (`model`, `session_id`, `context_window`, `workspace`). Confidence: HIGH.
- `/Users/jonathanborduas/.claude/hooks/gsd-check-update.js` — Live production SessionStart hook. Shows detached subprocess pattern for background work. Confidence: HIGH.
- `/Users/jonathanborduas/.claude/settings.json` — Live settings.json. Confirms hooks registration schema (three-level nesting: event → matcher group array → hooks array). Confidence: HIGH.
- `/Users/jonathanborduas/.claude/projects/*/subagents/*.jsonl` (sampled) — Live transcript JSONL files. Confirms per-line JSON format, fields: `parentUuid`, `isSidechain`, `sessionId`, `type` (user/assistant/progress), `message.role`, `message.content` (array of blocks), `message.content[].type` (text/tool_use), `message.content[].name` (tool name), `timestamp`. Confidence: HIGH.
- `/Users/jonathanborduas/code/QGSD/bin/install.js` — GSD installer. Shows how hooks are registered into settings.json programmatically, how hook paths are built (`buildHookCommand`), and the `{"type":"commonjs"}` package.json trick to prevent ESM conflicts. Confidence: HIGH.

---

*Stack research for: Claude Code hook-based plugin (QGSD — quorum enforcement layer)*
*Researched: 2026-02-20*
