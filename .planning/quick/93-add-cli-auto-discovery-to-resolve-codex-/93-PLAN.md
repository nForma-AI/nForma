---
phase: quick-93
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - bin/resolve-cli.cjs
  - bin/manage-agents.cjs
autonomous: true
requirements: [QUICK-93]

must_haves:
  truths:
    - "resolve-cli.cjs returns a full path when the CLI is found via which, Homebrew, npm global, or known system paths"
    - "resolve-cli.cjs returns the bare name as fallback when nothing is found (OS resolves at spawn)"
    - "manage-agents.cjs add flow auto-resolves cli field when user enters a bare name like 'codex' or leaves cli blank"
    - "manage-agents.cjs edit flow auto-resolves cli field when user changes the cli entry to a bare name"
    - "providers.json is NOT modified by this change — resolution happens at config time via manage-agents.cjs only"
  artifacts:
    - path: "bin/resolve-cli.cjs"
      provides: "CLI path resolution utility with priority-ordered search"
      exports: ["resolveCli"]
    - path: "bin/manage-agents.cjs"
      provides: "Updated add/edit flows that call resolveCli for subprocess providers"
      contains: "resolveCli"
  key_links:
    - from: "bin/manage-agents.cjs"
      to: "bin/resolve-cli.cjs"
      via: "require('./resolve-cli.cjs')"
      pattern: "resolveCli"
    - from: "addSubprocessAgent / editSubprocessAgent"
      to: "providers.json cli field"
      via: "resolved path written at config time"
      pattern: "cli.*resolveCli"
---

<objective>
Add CLI auto-discovery to the QGSD subprocess provider system so users are not required to know or type full Homebrew paths.

Purpose: `providers.json` currently hardcodes `/opt/homebrew/bin/` for every subprocess CLI. On Linux, nix, or non-standard installs this path is wrong and causes silent spawn failures. Discovery at `manage-agents.cjs` config time means the saved path is always accurate for the current machine.

Output:
- `bin/resolve-cli.cjs` — resolution utility, importable and callable standalone
- `bin/manage-agents.cjs` — updated add/edit flows for subprocess provider type
</objective>

<execution_context>
@/Users/jonathanborduas/.claude/get-shit-done/workflows/execute-plan.md
@/Users/jonathanborduas/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@bin/providers.json
@bin/manage-agents.cjs
</context>

<tasks>

<task type="auto">
  <name>Task 1: Create bin/resolve-cli.cjs</name>
  <files>bin/resolve-cli.cjs</files>
  <action>
Create `/Users/jonathanborduas/code/QGSD/bin/resolve-cli.cjs` as a CommonJS module exporting a single synchronous function `resolveCli(name)`.

Resolution order (stop at first hit):
1. `which <name>` via `spawnSync('which', [name], { encoding: 'utf8' })` — trim stdout, return if exit 0 and non-empty
2. Known Homebrew prefixes: `['/opt/homebrew/bin', '/usr/local/bin']` — check `fs.existsSync(prefix + '/' + name)` in order, return first match
3. npm global bin: run `spawnSync('npm', ['root', '-g'], { encoding: 'utf8' })` — trim output, compute `path.join(npmRoot, '..', 'bin', name)` — return if `fs.existsSync` passes
4. Common system paths: `['/usr/bin', '/usr/local/bin']` — check `fs.existsSync`, return first match (deduplicated with step 2 if needed)
5. Fallback: return `name` bare (let the OS resolve at spawn time)

Module shape:
```js
'use strict';
const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');

function resolveCli(name) {
  // 1. which
  // 2. homebrew prefixes
  // 3. npm global
  // 4. system paths
  // 5. bare fallback
}

module.exports = { resolveCli };
```

Also add a standalone CLI interface so the utility can be tested directly:
```
node bin/resolve-cli.cjs codex
# prints: /opt/homebrew/bin/codex  (or wherever it's found)
```

When called as main (`require.main === module`): read `process.argv[2]` as name, print result to stdout.

Do NOT throw on missing CLIs — always return a string.
  </action>
  <verify>
node /Users/jonathanborduas/code/QGSD/bin/resolve-cli.cjs codex
node /Users/jonathanborduas/code/QGSD/bin/resolve-cli.cjs gemini
node /Users/jonathanborduas/code/QGSD/bin/resolve-cli.cjs opencode
node /Users/jonathanborduas/code/QGSD/bin/resolve-cli.cjs some-nonexistent-tool-xyz
  </verify>
  <done>
- Each invocation prints a non-empty string (full path or bare name)
- Known tools print a path beginning with `/`
- `some-nonexistent-tool-xyz` prints `some-nonexistent-tool-xyz` (bare fallback, no crash)
  </done>
</task>

<task type="auto">
  <name>Task 2: Integrate resolveCli into manage-agents.cjs add/edit flows</name>
  <files>bin/manage-agents.cjs</files>
  <action>
Edit `/Users/jonathanborduas/code/QGSD/bin/manage-agents.cjs` to import and use `resolveCli` for subprocess provider flows.

**Import at top of file (after existing requires):**
```js
const { resolveCli } = require('./resolve-cli.cjs');
```

**Subprocess provider detection:** a provider is "subprocess" when the user's entry for the `cli` field is either blank OR a bare name (no path separator `/`).

**In `addAgent()` flow:**
The current `addAgent()` collects a `command` (Node command like `node`) and `args`, not a `cli` field — this is for HTTP/stdio MCP agents, not subprocess providers. Since `providers.json` subprocess providers are a separate config file from `~/.claude.json` mcpServers, the integration point is different.

Looking at the actual shape: `providers.json` holds subprocess providers with a `cli` field. `~/.claude.json` holds MCP server slots. `manage-agents.cjs` currently manages MCP slots only.

**The correct integration point:** Add a new menu option "7. Add subprocess provider" and "8. Edit subprocess provider" that read/write `bin/providers.json` directly, with auto-resolution of the `cli` field.

Implement `addSubprocessProvider()`:
- Prompt for: `name` (e.g. `codex-3`), `cli` (bare name or full path, e.g. `codex`), `description`, `mainTool`, `model`, `args_template` (comma-separated, default `exec,{prompt}`), `timeout_ms` (default `300000`), `quorum_timeout_ms` (default `30000`)
- After user enters `cli`: if the value has no `/` (bare name), call `resolveCli(value)` and show the resolved path — e.g. `  Resolved: /opt/homebrew/bin/codex`
- Write the RESOLVED path (not the bare name) into the `cli` field in providers.json
- Read providers.json from `path.join(__dirname, 'providers.json')`, push new entry, write back (atomic: write to `.tmp`, rename)

Implement `editSubprocessProvider()`:
- List current subprocess providers from providers.json (filter `type === 'subprocess'`)
- For the selected provider, show current `cli` value
- If user changes `cli` to a bare name (no `/`), call `resolveCli` and display resolved path before saving
- Write back the resolved path

Add options to main menu:
```
{ name: '7. Add subprocess provider', value: 'add-sub' },
{ name: '8. Edit subprocess provider', value: 'edit-sub' },
```

Wire into `mainMenu()` dispatch: `else if (action === 'add-sub') await addSubprocessProvider();` etc.

Keep all existing `addAgent()` / `editAgent()` logic completely unchanged — those manage MCP slots in `~/.claude.json`. The new functions manage subprocess providers in `providers.json`.
  </action>
  <verify>
node /Users/jonathanborduas/code/QGSD/bin/manage-agents.cjs --help 2>/dev/null || echo "interactive only"
node -e "
const m = require('/Users/jonathanborduas/code/QGSD/bin/manage-agents.cjs');
console.log(typeof m.readClaudeJson === 'function' ? 'OK: exports intact' : 'FAIL: exports broken');
"
node -e "
const { resolveCli } = require('/Users/jonathanborduas/code/QGSD/bin/resolve-cli.cjs');
console.log('resolveCli(codex):', resolveCli('codex'));
console.log('resolveCli(nonexistent-xyz):', resolveCli('nonexistent-xyz'));
"
  </verify>
  <done>
- `require('./manage-agents.cjs')` succeeds without errors
- `readClaudeJson` and other existing exports are still present
- `resolveCli` import does not crash the module
- Menu options 7 and 8 exist in the choices array
- `addSubprocessProvider` and `editSubprocessProvider` functions are defined
- When a bare CLI name is entered, the resolved full path is written to providers.json (verifiable by inspecting the written entry)
  </done>
</task>

</tasks>

<verification>
node /Users/jonathanborduas/code/QGSD/bin/resolve-cli.cjs codex
node /Users/jonathanborduas/code/QGSD/bin/resolve-cli.cjs gemini
node -e "const { resolveCli } = require('/Users/jonathanborduas/code/QGSD/bin/resolve-cli.cjs'); console.log(resolveCli('opencode')); console.log(resolveCli('no-such-cli'));"
node -e "require('/Users/jonathanborduas/code/QGSD/bin/manage-agents.cjs'); console.log('load OK');"
</verification>

<success_criteria>
- `bin/resolve-cli.cjs` exists, exports `resolveCli(name)`, returns full path for installed CLIs and bare name fallback for unknown ones
- `bin/manage-agents.cjs` loads cleanly, all prior exports intact, includes `resolveCli` import and two new menu options (7, 8) for subprocess provider management
- `providers.json` is NOT touched by this task — only write to it when user explicitly adds/edits a subprocess provider via the new menu options
- `unified-mcp-server.mjs` is NOT modified
</success_criteria>

<output>
After completion, create `.planning/quick/93-add-cli-auto-discovery-to-resolve-codex-/93-SUMMARY.md` with:
- What was built
- Files modified
- Verification results
- Commit hash
</output>
