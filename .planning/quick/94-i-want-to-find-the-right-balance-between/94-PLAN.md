---
phase: quick-94
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - bin/unified-mcp-server.mjs
  - bin/manage-agents.cjs
autonomous: true
requirements: [QUICK-94]

must_haves:
  truths:
    - "API keys are NOT written as plaintext in ~/.claude.json env blocks"
    - "unified-mcp-server reads each slot's API key from keytar at startup — one OS prompt per server process, never repeated"
    - "manage-agents editAgent() key display, probe, and hasKey checks use keytar index or live keytar read — not env.ANTHROPIC_API_KEY"
    - "addAgent() saves key to keytar only — does not write plaintext key to ~/.claude.json"
    - "Removing a key in manage-agents removes it from both keytar and the ~/.claude.json env block (no stale plaintext)"
  artifacts:
    - path: "bin/unified-mcp-server.mjs"
      provides: "MCP server with keytar-based API key loading at process startup"
    - path: "bin/manage-agents.cjs"
      provides: "Agent manager that stores keys only in keytar, not ~/.claude.json"
  key_links:
    - from: "bin/manage-agents.cjs addAgent()"
      to: "secrets.cjs set()"
      via: "keytar only — no env.ANTHROPIC_API_KEY write"
      pattern: "secretsLib\\.set\\('qgsd', keytarAccount"
    - from: "bin/unified-mcp-server.mjs startup"
      to: "keytar"
      via: "require('keytar').getPassword at process start"
      pattern: "getPassword.*ANTHROPIC_API_KEY"
---

<objective>
Remove API keys from ~/.claude.json env blocks. Store them only in the OS keychain (keytar). MCP server instances read their key from keytar at startup — one keychain access per server process lifetime, no repeated OS prompts.

Purpose: Keys in ~/.claude.json are plaintext on disk, accessible to any process that reads the file. The keychain is encrypted and access-controlled by the OS. This change achieves security (no plaintext keys on disk) while preserving convenience (one keychain unlock per server restart, not per API call).

Output:
- unified-mcp-server.mjs reads ANTHROPIC_API_KEY from keytar at startup using the slot name convention (ANTHROPIC_API_KEY_<SLOT_UPPER>), falls back to process.env for backward-compat
- manage-agents.cjs addAgent() and editAgent() save keys to keytar only, strip ANTHROPIC_API_KEY from the ~/.claude.json env block
- manage-agents.cjs display/probe/hasKey code uses secretsLib.hasKey() and secretsLib.get() instead of env.ANTHROPIC_API_KEY
</objective>

<execution_context>
@/Users/jonathanborduas/.claude/get-shit-done/workflows/execute-plan.md
@/Users/jonathanborduas/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@bin/secrets.cjs
@bin/unified-mcp-server.mjs
@bin/manage-agents.cjs
</context>

<tasks>

<task type="auto">
  <name>Task 1: Make unified-mcp-server read API key from keytar at startup</name>
  <files>bin/unified-mcp-server.mjs</files>
  <action>
At the top of unified-mcp-server.mjs, after the PROVIDER_SLOT detection block (around line 38), add a keytar-based API key bootstrap:

```js
// ─── Keytar API key bootstrap ─────────────────────────────────────────────────
// If running in PROVIDER_SLOT mode, load the slot's API key from keytar at
// startup (one keychain access per process — no repeated prompts).
// Falls back to ANTHROPIC_API_KEY already in process.env (backward-compat).
if (SLOT && !process.env.ANTHROPIC_API_KEY) {
  const keytarAccount = 'ANTHROPIC_API_KEY_' + SLOT.toUpperCase().replace(/-/g, '_');
  try {
    const { default: keytar } = await import('keytar');
    const secret = await keytar.getPassword('qgsd', keytarAccount);
    if (secret) {
      process.env.ANTHROPIC_API_KEY = secret;
      process.stderr.write(`[unified-mcp-server] Loaded API key for slot ${SLOT} from keychain\n`);
    }
  } catch (e) {
    // keytar unavailable or no entry — continue without it
    process.stderr.write(`[unified-mcp-server] keytar unavailable for slot ${SLOT}: ${e.message}\n`);
  }
}
```

IMPORTANT: This block is async, so it must run before the stdin readline handler starts processing. Move the `createInterface` call and `rl.on('line', ...)` setup into a top-level async IIFE or make the existing module top-level code await this block. The cleanest approach: wrap the bootstrap + rl setup in a single `async function main() { ... }; main()` at the bottom of the file. The existing non-async top-level code (imports, config load, provider setup, function defs) stays as-is above main().

Do NOT change the readline handler logic or any tool dispatch logic — only add the keytar bootstrap and wrap the startup sequence in async main().

The fallback chain for ANTHROPIC_API_KEY in runSlotHttpProvider (line 411) and runHealthCheck (line 420) already reads `process.env.ANTHROPIC_API_KEY` — no change needed there since the bootstrap sets process.env.
  </action>
  <verify>
    1. `node bin/unified-mcp-server.mjs` starts without errors (stderr: `[unified-mcp-server] started [all-providers]`)
    2. With `PROVIDER_SLOT=claude-1` and no ANTHROPIC_API_KEY in env, the server starts and logs either "Loaded API key from keychain" or "keytar unavailable" — it does NOT crash
    3. `node -e "const s=require('./bin/secrets.cjs'); s.set('qgsd','ANTHROPIC_API_KEY_TEST','sk-test').then(()=>console.log('ok'))"` succeeds
  </verify>
  <done>unified-mcp-server.mjs loads ANTHROPIC_API_KEY from keytar when PROVIDER_SLOT is set and key is not already in process.env. No crashes on missing keytar or missing key entry.</done>
</task>

<task type="auto">
  <name>Task 2: Strip plaintext keys from manage-agents — keytar-only storage</name>
  <files>bin/manage-agents.cjs</files>
  <action>
Make three targeted changes to manage-agents.cjs:

**Change A — addAgent() (around line 364-368):**
When a key is provided during agent creation, save it to keytar only. Do NOT write `env.ANTHROPIC_API_KEY`.

Before (line 367):
```js
if (answers.apiKey.trim()) env.ANTHROPIC_API_KEY = answers.apiKey.trim();
```

After:
```js
// Key stored in keytar only — not written to ~/.claude.json
if (answers.apiKey.trim() && secretsLib) {
  const keytarAccount = 'ANTHROPIC_API_KEY_' + slotName.toUpperCase().replace(/-/g, '_');
  await secretsLib.set('qgsd', keytarAccount, answers.apiKey.trim());
} else if (answers.apiKey.trim()) {
  // Fallback: write to env if keytar unavailable (graceful degradation)
  env.ANTHROPIC_API_KEY = answers.apiKey.trim();
}
```

Also load secretsLib near the top of addAgent() — it's already in editAgent() but add it to addAgent():
```js
let secretsLib = null;
try { secretsLib = require('./secrets.cjs'); } catch (_) {}
```

**Change B — editAgent() API key display and hasKey check (around lines 478, 520, 605, 611):**

The display card (line 478) and field selector (line 520) read `env.ANTHROPIC_API_KEY`. Since the key is now in keytar, derive a masked display value from keytar:

After building `const env = existing.env || {};` (around line 464), add:
```js
// Load key from keytar for display (key is no longer in env block)
const keytarAccount = 'ANTHROPIC_API_KEY_' + slotName.toUpperCase().replace(/-/g, '_');
let keytarKey = null;
if (secretsLib) {
  try { keytarKey = await secretsLib.get('qgsd', keytarAccount); } catch (_) {}
}
// Use for display: prefer keytar value, fallback to env (legacy)
const displayKey = keytarKey || env.ANTHROPIC_API_KEY || null;
```

Then replace `env.ANTHROPIC_API_KEY` with `displayKey` in:
- Line 478: `row('Key    ', maskKey(env.ANTHROPIC_API_KEY))` → `row('Key    ', maskKey(displayKey))`
- Line 520: field chooser display → `maskKey(displayKey)`
- Line 605: `const hasKey = !!env.ANTHROPIC_API_KEY;` → `const hasKey = !!(displayKey || (secretsLib && secretsLib.hasKey(keytarAccount)));`
- Line 611: `maskKey(env.ANTHROPIC_API_KEY)` → `maskKey(displayKey)`

For the pre-flight probe (line 651):
```js
const apiKeyForProbe = keytarKey || env.ANTHROPIC_API_KEY || updates.apiKey || '';
```

**Change C — editAgent() apply block (around lines 729-737):**
When saving a new key, do NOT write `newEnv.ANTHROPIC_API_KEY`. Remove the plaintext write. When removing, still delete from env for cleanup of legacy entries:

```js
if ('apiKey' in updates) {
  const keytarAccount = 'ANTHROPIC_API_KEY_' + slotName.toUpperCase().replace(/-/g, '_');
  if (updates.apiKey === '__REMOVE__') {
    delete newEnv.ANTHROPIC_API_KEY;  // clean up legacy plaintext entry
    if (secretsLib) secretsLib.delete('qgsd', keytarAccount).catch(() => {});
  } else {
    // Store in keytar only — remove plaintext from ~/.claude.json
    delete newEnv.ANTHROPIC_API_KEY;
    if (secretsLib) {
      await secretsLib.set('qgsd', keytarAccount, updates.apiKey);
    } else {
      // Fallback: write plaintext if keytar unavailable
      newEnv.ANTHROPIC_API_KEY = updates.apiKey;
    }
  }
}
```

**Also fix removeAgent() display (around line 899-901):**
The remove agent list shows `hasKey` based on `cfg.env.ANTHROPIC_API_KEY`. Change to use secretsLib.hasKey():
```js
const account = 'ANTHROPIC_API_KEY_' + name.toUpperCase().replace(/-/g, '_');
const hasKey = !!(cfg.env && cfg.env.ANTHROPIC_API_KEY) || (secretsLib && secretsLib.hasKey(account));
```
Add secretsLib loading near the top of removeAgent() same pattern as editAgent().
  </action>
  <verify>
    1. `node bin/manage-agents.cjs` starts without syntax errors: `node -e "require('./bin/manage-agents.cjs')"` exits cleanly (or shows inquirer prompt — no crash)
    2. After running "Set new key" in edit agent flow, confirm `~/.claude.json` does NOT contain the new key value under that agent's env block
    3. Confirm `node -e "const s=require('./bin/secrets.cjs'); s.get('qgsd','ANTHROPIC_API_KEY_CLAUDE_1').then(v=>console.log('keytar has key:', !!v))"` returns true after setting a key
    4. The agent selector still shows [key ✓] for agents whose key is in keytar index
  </verify>
  <done>
    - addAgent() and editAgent() write API keys to keytar only, not to ~/.claude.json env blocks
    - Display, hasKey check, and pre-flight probe all read from keytar (not env block)
    - Removing a key deletes it from keytar and cleans up any legacy plaintext env entry
    - Fallback to env write if keytar is unavailable (graceful degradation on systems without keytar)
  </done>
</task>

</tasks>

<verification>
1. `node bin/unified-mcp-server.mjs` starts without errors
2. `node -e "require('./bin/manage-agents.cjs')"` — no syntax errors
3. After setting a key via manage-agents: `cat ~/.claude.json | grep -v ANTHROPIC_API_KEY` — key should NOT appear in ~/.claude.json
4. `node -e "const s=require('./bin/secrets.cjs'); s.get('qgsd','ANTHROPIC_API_KEY_CLAUDE_1').then(v=>console.log(!!v))"` — returns true
5. Existing agents with legacy plaintext keys in ~/.claude.json continue to work (unified-mcp-server falls back to process.env which Claude Code injects from the env block)
</verification>

<success_criteria>
- API keys are stored only in the OS keychain — ~/.claude.json contains no plaintext API key values for newly-set or updated keys
- unified-mcp-server reads its slot's key from keytar once at startup, caching in process.env for the process lifetime — no repeated OS keychain prompts
- manage-agents shows correct key status (set/unset) using keytar index, not ~/.claude.json
- Legacy agents (with plaintext keys already in ~/.claude.json) still function — the fallback path (process.env from ~/.claude.json env block injection) remains intact
</success_criteria>

<output>
After completion, create `.planning/quick/94-i-want-to-find-the-right-balance-between/94-SUMMARY.md`
</output>
