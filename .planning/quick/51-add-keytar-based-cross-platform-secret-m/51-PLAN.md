---
phase: quick-51
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - bin/secrets.cjs
  - bin/set-secret.cjs
  - hooks/qgsd-session-start.js
  - hooks/dist/qgsd-session-start.js
  - package.json
  - bin/install.js
autonomous: true
requirements: [QUICK-51]

must_haves:
  truths:
    - "node bin/set-secret.cjs API_KEY myvalue stores the value in the OS keychain under service 'qgsd'"
    - "node bin/set-secret.cjs API_KEY myvalue patches the matching env entry in ~/.claude.json mcpServers"
    - "qgsd-session-start.js runs syncToClaudeJson on every session start, keeping ~/.claude.json current"
    - "install.js registers qgsd-session-start.js as a SessionStart hook (alongside check-update)"
    - "install.js uninstall removes the session-start sync hook from SessionStart"
    - "If keytar is not installed, secrets.cjs throws a clear error rather than crashing with a native binding message"
  artifacts:
    - path: "bin/secrets.cjs"
      provides: "keytar wrapper with set/get/delete/list/syncToClaudeJson"
      exports: ["set", "get", "delete", "list", "syncToClaudeJson"]
    - path: "bin/set-secret.cjs"
      provides: "CLI entry: node bin/set-secret.cjs <KEY> <value>"
      contains: "syncToClaudeJson"
    - path: "hooks/qgsd-session-start.js"
      provides: "SessionStart hook source file"
      contains: "syncToClaudeJson"
    - path: "hooks/dist/qgsd-session-start.js"
      provides: "SessionStart hook installed copy (read by install.js via hooks/dist/)"
      contains: "syncToClaudeJson"
    - path: "package.json"
      provides: "keytar listed as dependency"
      contains: "keytar"
  key_links:
    - from: "bin/set-secret.cjs"
      to: "bin/secrets.cjs"
      via: "require('./secrets.cjs')"
      pattern: "require.*secrets"
    - from: "hooks/qgsd-session-start.js"
      to: "bin/secrets.cjs"
      via: "require from installed path (~/.claude/qgsd-bin/secrets.cjs)"
      pattern: "syncToClaudeJson"
    - from: "bin/install.js"
      to: "hooks/dist/qgsd-session-start.js"
      via: "readdirSync(hooks/dist) copies all .js files to ~/.claude/qgsd/hooks/"
      pattern: "qgsd-session-start"
    - from: "bin/secrets.cjs syncToClaudeJson"
      to: "~/.claude.json mcpServers[*].env"
      via: "JSON read-patch-write"
      pattern: "mcpServers"
---

<objective>
Add keytar-based cross-platform secret management to QGSD so MCP API keys are stored in the OS keychain instead of plaintext in ~/.claude.json or ~/.zshrc.

Purpose: QGSD becomes the owner of MCP secrets — set once, synced automatically on every session start.
Output: bin/secrets.cjs, bin/set-secret.cjs, hooks/qgsd-session-start.js, hooks/dist/qgsd-session-start.js, package.json dep, install.js hook registration.
</objective>

<execution_context>
@/Users/jonathanborduas/.claude/get-shit-done/workflows/execute-plan.md
@/Users/jonathanborduas/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
</context>

<tasks>

<task type="auto">
  <name>Task 1: Create bin/secrets.cjs keytar wrapper and bin/set-secret.cjs CLI</name>
  <files>bin/secrets.cjs, bin/set-secret.cjs, package.json</files>
  <action>
**package.json** — add `"keytar": "^7.9.0"` to `"dependencies": {}`. Keep all existing fields unchanged.

**bin/secrets.cjs** — create CJS module (no shebang, used as require'd library):

```js
'use strict';
const SERVICE = 'qgsd';

// Lazy-load keytar with a graceful error if the native addon is missing
function getKeytar() {
  try {
    return require('keytar');
  } catch (e) {
    throw new Error(
      'keytar native addon not found. Run `npm install keytar` (requires libsecret-dev on Linux).\n' +
      'Original error: ' + e.message
    );
  }
}

async function set(service, key, value) {
  await getKeytar().setPassword(service, key, value);
}

async function get(service, key) {
  return getKeytar().getPassword(service, key);
}

async function del(service, key) {
  return getKeytar().deletePassword(service, key);
}

async function list(service) {
  return getKeytar().findCredentials(service);
  // returns [{account, password}]
}

/**
 * Reads all secrets stored under `service` from the keychain,
 * then patches matching env keys in every mcpServers entry in ~/.claude.json.
 *
 * Algorithm:
 *   1. Load all credentials for the service (account = env var name, password = value)
 *   2. Read ~/.claude.json (parse JSON; if missing/corrupt, log warning and return)
 *   3. Iterate claudeJson.mcpServers — for each server with an `env` block,
 *      for each credential whose account name appears as a key in `env`,
 *      overwrite `env[account]` with the credential's password.
 *   4. Write the patched JSON back to ~/.claude.json with 2-space indent.
 */
async function syncToClaudeJson(service) {
  const os = require('os');
  const fs = require('fs');
  const path = require('path');

  const claudeJsonPath = path.join(os.homedir(), '.claude.json');

  let credentials;
  try {
    credentials = await list(service);
  } catch (e) {
    process.stderr.write('[qgsd-secrets] keytar unavailable: ' + e.message + '\n');
    return;
  }

  if (!credentials || credentials.length === 0) return;

  // Build a lookup map: { ACCOUNT_NAME: password }
  const credMap = {};
  for (const c of credentials) {
    credMap[c.account] = c.password;
  }

  let raw;
  try {
    raw = fs.readFileSync(claudeJsonPath, 'utf8');
  } catch (e) {
    process.stderr.write('[qgsd-secrets] ~/.claude.json not found, skipping sync\n');
    return;
  }

  let claudeJson;
  try {
    claudeJson = JSON.parse(raw);
  } catch (e) {
    process.stderr.write('[qgsd-secrets] ~/.claude.json is invalid JSON, skipping sync\n');
    return;
  }

  if (!claudeJson.mcpServers || typeof claudeJson.mcpServers !== 'object') return;

  let patched = 0;
  for (const serverName of Object.keys(claudeJson.mcpServers)) {
    const server = claudeJson.mcpServers[serverName];
    if (!server.env || typeof server.env !== 'object') continue;
    for (const envKey of Object.keys(server.env)) {
      if (credMap[envKey] !== undefined) {
        server.env[envKey] = credMap[envKey];
        patched++;
      }
    }
  }

  if (patched > 0) {
    fs.writeFileSync(claudeJsonPath, JSON.stringify(claudeJson, null, 2));
  }
}

module.exports = { set, get, delete: del, list, syncToClaudeJson, SERVICE };
```

**bin/set-secret.cjs** — create CJS CLI entry point:

```js
#!/usr/bin/env node
'use strict';
/**
 * set-secret.cjs
 * Usage: node bin/set-secret.cjs <KEY_NAME> <value>
 *
 * Stores KEY_NAME=value in the OS keychain under service "qgsd",
 * then syncs all qgsd secrets into ~/.claude.json mcpServers env blocks.
 */
const { set, syncToClaudeJson, SERVICE } = require('./secrets.cjs');

const [,, keyName, ...valueParts] = process.argv;
if (!keyName || valueParts.length === 0) {
  console.error('Usage: node bin/set-secret.cjs <KEY_NAME> <value>');
  process.exit(1);
}
const value = valueParts.join(' ');

(async () => {
  try {
    await set(SERVICE, keyName, value);
    console.log(`[qgsd] Stored ${keyName} in keychain (service: ${SERVICE})`);
    await syncToClaudeJson(SERVICE);
    console.log('[qgsd] Synced keychain secrets to ~/.claude.json');
  } catch (e) {
    console.error('[qgsd] Error:', e.message);
    process.exit(1);
  }
})();
```
  </action>
  <verify>
    1. `node -e "const s = require('./bin/secrets.cjs'); console.log(typeof s.set, typeof s.syncToClaudeJson);"` from `/Users/jonathanborduas/code/QGSD` prints `function function`.
    2. `grep '"keytar"' package.json` outputs a line with keytar.
    3. `node bin/set-secret.cjs` (no args) prints usage and exits non-zero.
  </verify>
  <done>
    bin/secrets.cjs exports set/get/delete/list/syncToClaudeJson. bin/set-secret.cjs CLI accepts KEY VALUE and exits non-zero on missing args. package.json lists keytar as a dependency.
  </done>
</task>

<task type="auto">
  <name>Task 2: Create hooks/qgsd-session-start.js, hooks/dist/qgsd-session-start.js, and wire into install.js</name>
  <files>hooks/qgsd-session-start.js, hooks/dist/qgsd-session-start.js, bin/install.js</files>
  <action>
**hooks/qgsd-session-start.js** — create SessionStart hook source file (identical content also written to hooks/dist/qgsd-session-start.js — see below):

```js
#!/usr/bin/env node
// hooks/qgsd-session-start.js
// SessionStart hook — syncs QGSD keychain secrets into ~/.claude.json
// on every session start so mcpServers env blocks always reflect current keychain state.
//
// Runs synchronously (hook expects process to exit) — uses async IIFE with catch.

'use strict';

const path = require('path');
const os = require('os');

// Locate secrets.cjs — try installed global path first, then local dev path.
//
// IMPORTANT: install.js copies bin/*.cjs to ~/.claude/qgsd-bin/ (not ~/.claude/qgsd/bin/).
// See bin/install.js line ~1679: binDest = path.join(targetDir, 'qgsd-bin')
// where targetDir = os.homedir() + '/.claude'.
function findSecrets() {
  const candidates = [
    path.join(os.homedir(), '.claude', 'qgsd-bin', 'secrets.cjs'),  // installed path
    path.join(__dirname, '..', 'bin', 'secrets.cjs'),                 // local dev path
  ];
  for (const p of candidates) {
    try {
      return require(p);
    } catch (_) {}
  }
  return null;
}

(async () => {
  const secrets = findSecrets();
  if (!secrets) {
    // silently skip — QGSD may not be installed yet or keytar absent
    process.exit(0);
  }
  try {
    await secrets.syncToClaudeJson(secrets.SERVICE);
  } catch (e) {
    // Non-fatal — write to stderr for debug logs, but never block session start
    process.stderr.write('[qgsd-session-start] sync error: ' + e.message + '\n');
  }
  process.exit(0);
})();
```

**hooks/dist/qgsd-session-start.js** — create the installed copy with identical content to hooks/qgsd-session-start.js above. This is the file that install.js picks up via `readdirSync(hooks/dist)` and copies into `~/.claude/qgsd/hooks/`. All other hooks follow this same source/dist dual-file pattern (e.g., hooks/qgsd-prompt.js + hooks/dist/qgsd-prompt.js).

The content of hooks/dist/qgsd-session-start.js is byte-for-byte identical to hooks/qgsd-session-start.js above.

**bin/install.js** — add session-start sync hook registration and uninstall cleanup.

Locate the block starting at ~line 1726 (`const hasGsdUpdateHook = ...`). After the existing `if (!hasGsdUpdateHook)` block that pushes the update-check hook (around line 1739, after the `console.log` for "Configured update check hook"), add the session-start sync hook registration:

```js
    // Register QGSD session-start secret sync hook
    const hasGsdSessionStartHook = settings.hooks.SessionStart.some(entry =>
      entry.hooks && entry.hooks.some(h => h.command && h.command.includes('qgsd-session-start'))
    );
    if (!hasGsdSessionStartHook) {
      settings.hooks.SessionStart.push({
        hooks: [
          {
            type: 'command',
            command: buildHookCommand(targetDir, 'qgsd-session-start.js')
          }
        ]
      });
      console.log(`  ${green}✓${reset} Configured QGSD secret sync hook (SessionStart)`);
    }
```

Locate the uninstall block that filters SessionStart (~line 1076-1093). The filter predicate currently checks for `qgsd-check-update` and `qgsd-statusline`. Extend it to also remove `qgsd-session-start`:

```js
          const hasGsdHook = entry.hooks.some(h =>
            h.command && (
              h.command.includes('qgsd-check-update') ||
              h.command.includes('qgsd-statusline') ||
              h.command.includes('qgsd-session-start')
            )
          );
```

Also extend the "Removed GSD hooks from settings" log message to mention the sync hook (optional but useful for clarity — only if the log is a single generic message, leave it as-is to avoid drift).

Note: install.js already uses `readdirSync(hooksSrc)` to copy all `.js` files from `hooks/dist/` to the installed hooks directory. No additional copy-list changes are needed — placing the file in `hooks/dist/` is sufficient for it to be installed.
  </action>
  <verify>
    1. `node -e "require('./hooks/qgsd-session-start.js')"` exits 0 (secrets not installed → silently skips).
    2. `ls hooks/dist/qgsd-session-start.js` confirms the dist copy exists.
    3. `grep 'qgsd-session-start' bin/install.js` returns at least 2 matches (registration + uninstall filter).
    4. Run `node bin/install.js --help 2>&1 || true` — install.js parses without syntax errors.
    5. `grep 'qgsd-bin/secrets.cjs' hooks/qgsd-session-start.js` confirms the correct installed path is the first candidate.
    6. `grep 'qgsd-bin/secrets.cjs' hooks/dist/qgsd-session-start.js` confirms the dist copy also has the correct path.
  </verify>
  <done>
    hooks/qgsd-session-start.js (source) and hooks/dist/qgsd-session-start.js (installed copy) both exist with identical content. findSecrets() first candidate is ~/.claude/qgsd-bin/secrets.cjs (matching install.js binDest). install.js registers the hook as a SessionStart entry and removes it on uninstall. The dist copy is automatically installed into ~/.claude/qgsd/hooks/ by the existing readdirSync loop.
  </done>
</task>

</tasks>

<verification>
After both tasks complete:
1. Module loads cleanly: `node -e "const s = require('./bin/secrets.cjs'); console.log(Object.keys(s))"` → `[ 'set', 'get', 'delete', 'list', 'syncToClaudeJson', 'SERVICE' ]`
2. CLI guards: `node bin/set-secret.cjs` exits 1 with usage message.
3. Hook is silent on missing keytar: `node hooks/qgsd-session-start.js` exits 0.
4. Dist copy exists: `ls hooks/dist/qgsd-session-start.js` succeeds.
5. install.js registers and unregisters session-start hook: `grep -c 'qgsd-session-start' bin/install.js` >= 2.
6. package.json: `grep '"keytar"' package.json` shows the dependency.
7. Correct installed path: `grep 'qgsd-bin/secrets.cjs' hooks/dist/qgsd-session-start.js` succeeds.
</verification>

<success_criteria>
- bin/secrets.cjs: keytar wrapper with graceful fallback, syncToClaudeJson patches ~/.claude.json mcpServers env keys found in keychain
- bin/set-secret.cjs: CLI stores to keychain then syncs; validates args
- hooks/qgsd-session-start.js: SessionStart hook source file, silent on absent keytar, non-blocking on errors
- hooks/dist/qgsd-session-start.js: installed copy (identical content), picked up by install.js readdirSync loop
- findSecrets() first candidate: ~/.claude/qgsd-bin/secrets.cjs (matching install.js binDest = path.join(targetDir, 'qgsd-bin'))
- package.json: keytar listed under dependencies
- bin/install.js: registers session-start hook on install, removes it on uninstall
</success_criteria>

<output>
After completion, create `.planning/quick/51-add-keytar-based-cross-platform-secret-m/51-SUMMARY.md`
</output>
