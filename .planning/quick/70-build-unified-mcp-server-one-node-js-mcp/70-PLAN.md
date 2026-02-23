---
phase: quick-70
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - bin/unified-mcp-server.mjs
  - bin/providers.json
autonomous: true
requirements: [QUICK-70]

must_haves:
  truths:
    - "Running `node bin/unified-mcp-server.mjs` starts a valid MCP server that speaks stdio transport"
    - "Each of the 4 providers (codex, gemini, opencode, copilot) registers as a distinct MCP tool"
    - "Calling the codex tool executes `codex exec <prompt>` and returns the output"
    - "Calling the gemini tool executes `gemini -p <prompt>` and returns the output"
    - "Calling the opencode tool executes `opencode run <prompt>` and returns the output"
    - "Calling the copilot tool executes `copilot -p <prompt>` and returns the output"
    - "The server reads provider definitions from providers.json (path from UNIFIED_PROVIDERS_CONFIG env var or sibling file)"
  artifacts:
    - path: "bin/unified-mcp-server.mjs"
      provides: "Single MCP stdio server binary driven by providers.json"
      min_lines: 120
    - path: "bin/providers.json"
      provides: "Default provider config for codex/gemini/opencode/copilot"
      contains: "\"providers\""
  key_links:
    - from: "bin/providers.json"
      to: "bin/unified-mcp-server.mjs"
      via: "fs.readFileSync at startup, path from UNIFIED_PROVIDERS_CONFIG env or __dirname sibling"
      pattern: "providers\\.json"
    - from: "bin/unified-mcp-server.mjs"
      to: "spawn(provider.cli)"
      via: "child_process.spawn per tool call"
      pattern: "spawn"
---

<objective>
Build a single Node.js MCP server binary (`bin/unified-mcp-server.mjs`) driven by a JSON config
(`bin/providers.json`) that wraps Codex, Gemini, OpenCode, and Copilot CLI tools as subprocess
providers. Each provider becomes a named MCP tool. The server replaces the 4 separate MCP server
repos currently pointed to in ~/.claude.json.

Purpose: Consolidate 4 external repo dependencies into one file in this project. Config-driven
design means adding a new CLI provider requires only a new entry in providers.json — no code change.

Output: `bin/unified-mcp-server.mjs` + `bin/providers.json` + instructions to wire into ~/.claude.json.
</objective>

<execution_context>
@/Users/jonathanborduas/.claude/get-shit-done/workflows/execute-plan.md
@/Users/jonathanborduas/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md

Existing MCP servers for reference (do NOT modify these):
- /Users/jonathanborduas/code/codex-mcp-server/dist/server.js  (MCP SDK usage pattern)
- /Users/jonathanborduas/code/codex-mcp-server/dist/utils/command.js  (subprocess spawn pattern)
</context>

<tasks>

<task type="auto">
  <name>Task 1: Write providers.json config for all 4 CLI providers</name>
  <files>bin/providers.json</files>
  <action>
Create `bin/providers.json` with a top-level `providers` array. Each entry defines one CLI provider:

```json
{
  "providers": [
    {
      "name": "codex",
      "description": "Execute Codex CLI agent non-interactively for AI coding assistance",
      "cli": "/opt/homebrew/bin/codex",
      "args_template": ["exec", "{prompt}"],
      "prompt_key": "{prompt}",
      "timeout_ms": 300000,
      "env": {}
    },
    {
      "name": "gemini",
      "description": "Query Gemini CLI agent non-interactively",
      "cli": "/opt/homebrew/bin/gemini",
      "args_template": ["-p", "{prompt}"],
      "prompt_key": "{prompt}",
      "timeout_ms": 300000,
      "env": {}
    },
    {
      "name": "opencode",
      "description": "Run OpenCode agent non-interactively with a message",
      "cli": "/opt/homebrew/bin/opencode",
      "args_template": ["run", "{prompt}"],
      "prompt_key": "{prompt}",
      "timeout_ms": 300000,
      "env": {}
    },
    {
      "name": "copilot",
      "description": "Execute GitHub Copilot CLI non-interactively",
      "cli": "/opt/homebrew/bin/copilot",
      "args_template": ["-p", "{prompt}", "--yolo"],
      "prompt_key": "{prompt}",
      "timeout_ms": 300000,
      "env": {}
    }
  ]
}
```

Notes on CLI arg shapes (verified from --help):
- codex: `codex exec <PROMPT>` — prompt as positional after "exec" subcommand
- gemini: `gemini -p "<prompt>"` — headless mode flag
- opencode: `opencode run <message>` — run subcommand with positional message
- copilot: `copilot -p "<prompt>" --yolo` — non-interactive flag; --yolo skips all permission prompts

The `args_template` uses literal `{prompt}` as a placeholder string that the server replaces at
call time with the actual prompt value.
  </action>
  <verify>
    node -e "const d=require('./bin/providers.json'); console.log('providers:', d.providers.map(p=>p.name).join(', '))"
    Expected output: `providers: codex, gemini, opencode, copilot`
  </verify>
  <done>providers.json exists, parses as valid JSON, contains 4 provider entries with correct CLI paths and args_template shapes for each CLI's non-interactive mode.</done>
</task>

<task type="auto">
  <name>Task 2: Write unified-mcp-server.mjs — config-driven MCP stdio server</name>
  <files>bin/unified-mcp-server.mjs</files>
  <action>
Create `bin/unified-mcp-server.mjs` as an ES module (`.mjs`) so it can import
`@modelcontextprotocol/sdk` which is ESM-only.

The server must NOT depend on any package not already available in this project OR in the
existing MCP server repos. Use `@modelcontextprotocol/sdk` from the codex-mcp-server's
node_modules at `/Users/jonathanborduas/code/codex-mcp-server/node_modules/@modelcontextprotocol/sdk`
by using a file:// import or by resolving the path. Simpler: use `createRequire` with the absolute
path. Actually, the cleanest approach without installing the SDK into QGSD is to write the server
using raw JSON-RPC over stdio (no SDK dependency) following the MCP stdio protocol directly.

**Implementation: raw JSON-RPC stdio (no SDK dependency)**

MCP stdio protocol:
- Read newline-delimited JSON from stdin (one JSON-RPC request per line)
- Write newline-delimited JSON responses to stdout
- Log to stderr only (stdout is the MCP channel)
- Handle these methods: `initialize`, `tools/list`, `tools/call`
- Ignore `notifications/initialized` (no response needed)

Structure of `bin/unified-mcp-server.mjs`:

```
#!/usr/bin/env node
// unified-mcp-server.mjs — config-driven MCP stdio server
// Implements raw JSON-RPC stdio (no SDK dependency)

import { createRequire } from 'module';
import { fileURLToPath } from 'url';
import { dirname, join, resolve } from 'path';
import { spawn } from 'child_process';
import { createInterface } from 'readline';
import fs from 'fs';

const __dirname = dirname(fileURLToPath(import.meta.url));

// ─── Load providers config ────────────────────────────────────────────────────
const configPath = process.env.UNIFIED_PROVIDERS_CONFIG
  ?? join(__dirname, 'providers.json');
let providers;
try {
  providers = JSON.parse(fs.readFileSync(configPath, 'utf8')).providers;
} catch (e) {
  process.stderr.write(`[unified-mcp-server] Failed to load config: ${e.message}\n`);
  process.exit(1);
}

// ─── MCP response helpers ─────────────────────────────────────────────────────
function send(obj) {
  process.stdout.write(JSON.stringify(obj) + '\n');
}

function sendResult(id, result) {
  send({ jsonrpc: '2.0', id, result });
}

function sendError(id, code, message) {
  send({ jsonrpc: '2.0', id, error: { code, message } });
}

// ─── Build tool definitions from providers ────────────────────────────────────
function buildTools() {
  return providers.map(p => ({
    name: p.name,
    description: p.description,
    inputSchema: {
      type: 'object',
      properties: {
        prompt: {
          type: 'string',
          description: 'The prompt or task to send to the provider CLI',
        },
        timeout_ms: {
          type: 'number',
          description: `Timeout in milliseconds (default: ${p.timeout_ms ?? 300000})`,
        },
      },
      required: ['prompt'],
    },
  }));
}

// ─── Subprocess execution ─────────────────────────────────────────────────────
const MAX_BUFFER = 10 * 1024 * 1024; // 10MB

async function runProvider(provider, toolArgs) {
  const prompt = toolArgs.prompt;
  const timeoutMs = toolArgs.timeout_ms ?? provider.timeout_ms ?? 300000;

  // Substitute {prompt} placeholder in args_template
  const args = provider.args_template.map(a =>
    a === '{prompt}' ? prompt : a
  );

  const env = { ...process.env, ...(provider.env ?? {}) };

  return new Promise((resolve) => {
    const child = spawn(provider.cli, args, {
      env,
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    child.stdin.end(); // providers are non-interactive; close stdin immediately

    let stdout = '';
    let stderr = '';
    let truncated = false;
    let timedOut = false;

    const timer = setTimeout(() => {
      timedOut = true;
      child.kill('SIGTERM');
      setTimeout(() => { if (!child.killed) child.kill('SIGKILL'); }, 5000);
    }, timeoutMs);

    child.stdout.on('data', d => {
      if (!truncated) {
        const chunk = d.toString();
        if (stdout.length + chunk.length > MAX_BUFFER) {
          stdout += chunk.slice(0, MAX_BUFFER - stdout.length);
          truncated = true;
        } else {
          stdout += chunk;
        }
      }
    });

    child.stderr.on('data', d => {
      stderr += d.toString().slice(0, 4096); // keep stderr brief
    });

    child.on('close', (code) => {
      clearTimeout(timer);
      const output = stdout || stderr || '(no output)';
      const suffix = timedOut ? `\n\n[TIMED OUT after ${timeoutMs}ms]`
        : truncated ? '\n\n[OUTPUT TRUNCATED at 10MB]' : '';
      const exitNote = (code !== 0 && !timedOut) ? `\n\n[exit code ${code}]` : '';
      resolve(output + suffix + exitNote);
    });

    child.on('error', (err) => {
      clearTimeout(timer);
      resolve(`[spawn error: ${err.message}]`);
    });
  });
}

// ─── Request handlers ─────────────────────────────────────────────────────────
const toolMap = new Map(providers.map(p => [p.name, p]));

async function handleRequest(req) {
  const { id, method, params } = req;

  if (method === 'initialize') {
    sendResult(id, {
      protocolVersion: '2024-11-05',
      serverInfo: { name: 'unified-mcp-server', version: '1.0.0' },
      capabilities: { tools: {} },
    });
    return;
  }

  if (method === 'notifications/initialized') {
    return; // no response for notifications
  }

  if (method === 'tools/list') {
    sendResult(id, { tools: buildTools() });
    return;
  }

  if (method === 'tools/call') {
    const toolName = params?.name;
    const toolArgs = params?.arguments ?? {};
    const provider = toolMap.get(toolName);

    if (!provider) {
      sendResult(id, {
        content: [{ type: 'text', text: `Unknown tool: ${toolName}` }],
        isError: true,
      });
      return;
    }

    try {
      const output = await runProvider(provider, toolArgs);
      sendResult(id, {
        content: [{ type: 'text', text: output }],
        isError: false,
      });
    } catch (err) {
      sendResult(id, {
        content: [{ type: 'text', text: `Error: ${err.message}` }],
        isError: true,
      });
    }
    return;
  }

  // Unknown method — return method not found error
  if (id !== undefined && id !== null) {
    sendError(id, -32601, `Method not found: ${method}`);
  }
}

// ─── Stdin line reader ────────────────────────────────────────────────────────
const rl = createInterface({ input: process.stdin });

rl.on('line', async (line) => {
  const trimmed = line.trim();
  if (!trimmed) return;
  let req;
  try {
    req = JSON.parse(trimmed);
  } catch (e) {
    sendError(null, -32700, 'Parse error');
    return;
  }
  await handleRequest(req);
});

rl.on('close', () => process.exit(0));

process.stderr.write('[unified-mcp-server] started\n');
```

This implementation:
1. No external dependencies — pure Node.js builtins + fs/readline/child_process
2. Reads providers.json at startup (path from UNIFIED_PROVIDERS_CONFIG env or sibling file)
3. Registers one MCP tool per provider
4. For each tool/call: builds args by substituting `{prompt}` in args_template, spawns subprocess
5. Captures stdout (10MB max), applies SIGTERM+SIGKILL soft timeout
6. Returns stdout as MCP tool result text

**After writing the file, make it executable:**
```
chmod +x bin/unified-mcp-server.mjs
```

**Verification smoke test** — test tools/list round-trip manually:
```bash
echo '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2024-11-05","clientInfo":{"name":"test","version":"1.0"},"capabilities":{}}}' | node bin/unified-mcp-server.mjs
```
Expected: JSON response with `serverInfo.name: "unified-mcp-server"` and `capabilities.tools`.

Then test tools/list:
```bash
printf '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2024-11-05","clientInfo":{"name":"test","version":"1.0"},"capabilities":{}}}\n{"jsonrpc":"2.0","id":2,"method":"tools/list","params":{}}\n' | node bin/unified-mcp-server.mjs
```
Expected: Second response includes `tools` array with 4 entries: codex, gemini, opencode, copilot.

**Wire into ~/.claude.json** — After verifying, update `~/.claude.json` to replace the 4 separate
MCP server entries with 4 entries each pointing at `unified-mcp-server.mjs` with a
`UNIFIED_PROVIDER` env var identifying which tool to expose. Wait — actually the server exposes ALL
4 tools from a single process. So the correct wiring is ONE entry in ~/.claude.json:

```json
"unified-1": {
  "type": "stdio",
  "command": "node",
  "args": ["/Users/jonathanborduas/code/QGSD/bin/unified-mcp-server.mjs"],
  "env": {}
}
```

This single server instance registers tools named `codex`, `gemini`, `opencode`, `copilot`.
Claude Code will call them as `mcp__unified-1__codex`, `mcp__unified-1__gemini`, etc.

Do NOT remove the existing 4 entries (codex-1, gemini-1, opencode-1, copilot-1) from ~/.claude.json
during this task — that would break quorum. The existing entries stay as fallback. Only ADD the
`unified-1` entry. The user can manually remove the old entries after verifying the unified server
works in a real quorum call.

Update ~/.claude.json by reading the current content, adding the `unified-1` key to the
`mcpServers` object, and writing it back. Use fs.readFileSync / JSON.parse / JSON.stringify(d, null, 2).
  </action>
  <verify>
    # Test 1: MCP initialize + tools/list smoke test (no subprocess call):
    printf '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2024-11-05","clientInfo":{"name":"test","version":"1.0"},"capabilities":{}}}\n{"jsonrpc":"2.0","id":2,"method":"tools/list","params":{}}\n' | node /Users/jonathanborduas/code/QGSD/bin/unified-mcp-server.mjs 2>/dev/null | python3 -c "import sys,json; lines=[json.loads(l) for l in sys.stdin]; tools=lines[1]['result']['tools']; print([t['name'] for t in tools])"
    Expected: ['codex', 'gemini', 'opencode', 'copilot']

    # Test 2: unified-1 entry exists in ~/.claude.json:
    node -e "const d=JSON.parse(require('fs').readFileSync(require('os').homedir()+'/.claude.json','utf8')); console.log('unified-1:', d.mcpServers['unified-1'] ? 'present' : 'MISSING')"
    Expected: unified-1: present
  </verify>
  <done>
    1. `node bin/unified-mcp-server.mjs` starts cleanly (no error on stderr except "[unified-mcp-server] started")
    2. tools/list returns 4 tools: codex, gemini, opencode, copilot
    3. ~/.claude.json has a `unified-1` entry pointing at the binary
    4. Existing codex-1, gemini-1, opencode-1, copilot-1 entries are preserved (not removed)
  </done>
</task>

</tasks>

<verification>
Run the following checks after both tasks complete:

1. JSON validity of providers.json:
   node -e "const d=require('./bin/providers.json'); console.log(d.providers.map(p=>p.name))"

2. MCP protocol smoke test (tools/list round-trip):
   printf '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2024-11-05","clientInfo":{"name":"test","version":"1.0"},"capabilities":{}}}\n{"jsonrpc":"2.0","id":2,"method":"tools/list","params":{}}\n' | node bin/unified-mcp-server.mjs 2>/dev/null

3. ~/.claude.json has unified-1 entry:
   node -e "const d=JSON.parse(require('fs').readFileSync(require('os').homedir()+'/.claude.json','utf8')); console.log('unified-1 args:', d.mcpServers['unified-1']?.args)"
</verification>

<success_criteria>
- bin/unified-mcp-server.mjs exists, is executable, has no syntax errors
- bin/providers.json exists with 4 provider entries (codex, gemini, opencode, copilot)
- MCP tools/list returns all 4 tool names via stdin pipe test
- ~/.claude.json contains `unified-1` entry pointing at the binary
- Existing codex-1/gemini-1/opencode-1/copilot-1 entries are still present in ~/.claude.json (fallback preserved)
- No new npm dependencies added to package.json
</success_criteria>

<output>
After completion, create `.planning/quick/70-build-unified-mcp-server-one-node-js-mcp/70-SUMMARY.md`
with what was built, files created, and the ~/.claude.json wiring instructions.
</output>
