---
phase: quick-96
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - bin/manage-agents.cjs
  - bin/manage-agents.test.cjs
autonomous: true
requirements:
  - QUICK-96
must_haves:
  truths:
    - "Pure functions are reachable via require('./manage-agents.cjs')._pure without running the interactive CLI"
    - "deriveKeytarAccount returns the correct keytar account string for any slot name"
    - "maskKey correctly masks, truncates short keys, and handles null/undefined"
    - "buildKeyStatus returns the correct ANSI-tagged display string for sub/api/ccr/unknown auth types"
    - "buildAgentChoiceLabel returns a padded display string reflecting model and key status"
    - "applyKeyUpdate mutates newEnv correctly for set/remove/keep and calls secretsLib methods with correct args"
    - "applyCcrProviderUpdate calls secretsLib.set or secretsLib.delete with the correct service and key"
    - "node --test bin/manage-agents.test.cjs exits 0 with all tests passing"
  artifacts:
    - path: "bin/manage-agents.cjs"
      provides: "module.exports._pure block exposing all extracted pure functions"
      contains: "module.exports._pure"
    - path: "bin/manage-agents.test.cjs"
      provides: "node:test suite covering all pure functions"
      exports: []
  key_links:
    - from: "bin/manage-agents.test.cjs"
      to: "bin/manage-agents.cjs"
      via: "require('./manage-agents.cjs')._pure"
      pattern: "_pure\\.\\w+"
    - from: "applyKeyUpdate"
      to: "secretsLib"
      via: "injected secretsLib argument (mock in tests)"
      pattern: "secretsLib\\.(set|delete)"
---

<objective>
Extract deterministic logic from bin/manage-agents.cjs into exported pure functions, then write a node:test suite covering each function with 3-5 test cases.

Purpose: Enable unit-testing of the display and mutation logic in manage-agents.cjs without spawning inquirer or touching keychains. The _pure export pattern keeps the interactive CLI unchanged while making the logic independently verifiable.
Output: Updated manage-agents.cjs with _pure export block + new manage-agents.test.cjs passing clean under node --test.
</objective>

<execution_context>
@/Users/jonathanborduas/.claude/get-shit-done/workflows/execute-plan.md
@/Users/jonathanborduas/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@bin/manage-agents.cjs
@bin/secrets.cjs
</context>

<tasks>

<task type="auto">
  <name>Task 1: Extract pure functions and export via _pure</name>
  <files>bin/manage-agents.cjs</files>
  <action>
At the bottom of bin/manage-agents.cjs, immediately before the existing `module.exports = { ... }` line, define and export the following functions via a `module.exports._pure = { ... }` block. Do NOT alter any existing function bodies or the existing module.exports line.

Functions to define (as standalone named functions, defined just above the _pure export block):

1. **deriveKeytarAccount(slotName)**
   - Currently inlined at multiple call sites as: `'ANTHROPIC_API_KEY_' + slotName.toUpperCase().replace(/-/g, '_')`
   - Extract verbatim as a standalone function.

2. **maskKey(key)**
   - Already defined at line ~158. Just add it to the _pure export — do NOT move or redefine it. Reference the existing function.

3. **buildKeyStatus(authType, slotName, secretsLib)**
   - Extracted from editAgent() lines ~455-463 (the agent selector choices builder).
   - Logic: if authType === 'sub' return '\x1b[36m[sub]\x1b[0m'; else derive account via deriveKeytarAccount(slotName), return '\x1b[32m[key ✓]\x1b[0m' if secretsLib && secretsLib.hasKey(account), else '\x1b[90m[no key]\x1b[0m'.
   - secretsLib may be null (treat as no-key in that case).

4. **buildAgentChoiceLabel(name, cfg, providerMap, agentCfg, secretsLib)**
   - Extracted from editAgent() lines ~448-471.
   - Logic: derive model from providerMap lookup via cfg.env.PROVIDER_SLOT, or fall back to cfg.env.CLAUDE_DEFAULT_MODEL or cfg.command or '?'. Get authType from agentCfg[name]?.auth_type. Get keyStatus via buildKeyStatus(authType, name, secretsLib). Return: `${name.padEnd(14)} ${model.slice(0, 36).padEnd(36)} ${keyStatus}`.
   - All arguments may be empty objects/null — handle gracefully.

5. **applyKeyUpdate(updates, keytarAccount, newEnv, secretsLib)**
   - Extracted from editAgent() lines ~749-763.
   - updates: object that may contain `apiKey` key (string value or '__REMOVE__').
   - newEnv: plain object (copy of existing env); this function mutates it and returns it.
   - Logic: if 'apiKey' not in updates, return newEnv unchanged. If updates.apiKey === '__REMOVE__': delete newEnv.ANTHROPIC_API_KEY; if secretsLib, call secretsLib.delete('qgsd', keytarAccount) — do NOT await (caller handles promise). If updates.apiKey is a real value: delete newEnv.ANTHROPIC_API_KEY; if secretsLib, call secretsLib.set('qgsd', keytarAccount, updates.apiKey) — do NOT await; else set newEnv.ANTHROPIC_API_KEY = updates.apiKey. Return newEnv.
   - This function is synchronous except for the fire-and-forget secretsLib calls. Make it synchronous — callers that need to await the keytar operations will await separately. Return newEnv.

6. **applyCcrProviderUpdate(subAction, selectedKey, keyValue, secretsLib)**
   - Extracted from manageCcrProviders() lines ~1344-1375 (set/remove branch only, not the 'view' branch).
   - subAction: 'set' | 'remove'.
   - keyValue: string (used only for 'set').
   - Returns a Promise (calls await secretsLib.set or secretsLib.delete).
   - Logic: if subAction === 'set': await secretsLib.set('qgsd', selectedKey, keyValue); return { action: 'set', key: selectedKey }. If subAction === 'remove': await secretsLib.delete('qgsd', selectedKey); return { action: 'remove', key: selectedKey }. Otherwise return null.

Then append this block at the very end (after the existing module.exports line):

```js
module.exports._pure = {
  deriveKeytarAccount,
  maskKey,
  buildKeyStatus,
  buildAgentChoiceLabel,
  applyKeyUpdate,
  applyCcrProviderUpdate,
};
```

Important constraints:
- The existing `module.exports = { readClaudeJson, writeClaudeJson, getGlobalMcpServers, mainMenu }` line must remain unchanged.
- Do NOT move maskKey — define deriveKeytarAccount, buildKeyStatus, buildAgentChoiceLabel, applyKeyUpdate, applyCcrProviderUpdate as new named functions in a clearly demarcated section (add a comment `// ---------------------------------------------------------------------------\n// Pure functions (exported via _pure for testing)\n// ---------------------------------------------------------------------------`).
- Do NOT alter inquirer-coupled flow in editAgent(), manageCcrProviders(), or any other existing function.
- maskKey is already defined at the top of the file; include it in _pure by reference only.
  </action>
  <verify>
    node -e "const m = require('./bin/manage-agents.cjs'); const p = m._pure; console.log(Object.keys(p).join(', '));"
    Expected output: deriveKeytarAccount, maskKey, buildKeyStatus, buildAgentChoiceLabel, applyKeyUpdate, applyCcrProviderUpdate (all six present).
    Also verify: node -e "const {_pure:p} = require('./bin/manage-agents.cjs'); console.log(p.deriveKeytarAccount('claude-7'));"
    Expected output: ANTHROPIC_API_KEY_CLAUDE_7
  </verify>
  <done>
    require('./bin/manage-agents.cjs')._pure exposes all six functions. deriveKeytarAccount('claude-7') returns 'ANTHROPIC_API_KEY_CLAUDE_7'. No existing behavior changes — the file still runs as an interactive CLI when invoked directly.
  </done>
</task>

<task type="auto">
  <name>Task 2: Write node:test suite for all pure functions</name>
  <files>bin/manage-agents.test.cjs</files>
  <action>
Create bin/manage-agents.test.cjs using node:test and node:assert. The file must require the _pure exports and test each function with 3-5 cases. No mocking framework — use plain objects as mock secretsLib.

Structure:

```js
'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { _pure } = require('./manage-agents.cjs');
const { deriveKeytarAccount, maskKey, buildKeyStatus, buildAgentChoiceLabel, applyKeyUpdate, applyCcrProviderUpdate } = _pure;
```

**deriveKeytarAccount — 4 cases:**
1. 'claude-7' → 'ANTHROPIC_API_KEY_CLAUDE_7'
2. 'deepseek' → 'ANTHROPIC_API_KEY_DEEPSEEK'
3. 'my-agent-2' → 'ANTHROPIC_API_KEY_MY_AGENT_2'
4. 'UPPER' → 'ANTHROPIC_API_KEY_UPPER' (already uppercase, no dashes)

**maskKey — 5 cases:**
1. null → '(not set)'
2. '' → '(not set)'  (empty string is falsy)
3. 'short' (5 chars, <= 12) → '***'
4. 'sk-1234567890abcd' (16 chars, > 12) → first 8 + '...' + last 4
5. 'sk-ant-api03-ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789' → first 8 + '...' + last 4

**buildKeyStatus — 4 cases:**
1. authType='sub', any slotName, secretsLib=null → '\x1b[36m[sub]\x1b[0m'
2. authType='api', slotName='claude-7', secretsLib with hasKey returning true → '\x1b[32m[key ✓]\x1b[0m'
3. authType='api', slotName='claude-7', secretsLib with hasKey returning false → '\x1b[90m[no key]\x1b[0m'
4. authType=undefined, slotName='x', secretsLib=null → '\x1b[90m[no key]\x1b[0m'

For cases 2-3, mock secretsLib as: `{ hasKey: (account) => account === 'ANTHROPIC_API_KEY_CLAUDE_7' }` or similar.

**buildAgentChoiceLabel — 4 cases:**
1. Happy path: name='claude-7', cfg with env.PROVIDER_SLOT='claude-7', providerMap={'claude-7': {model:'gpt-4o'}}, agentCfg={'claude-7': {auth_type:'sub'}}, secretsLib=null → label starts with 'claude-7' and contains 'gpt-4o' and '[sub]' ANSI tag
2. Missing providerMap entry falls back to CLAUDE_DEFAULT_MODEL: cfg.env.CLAUDE_DEFAULT_MODEL='my-model', providerMap={}, agentCfg={}, secretsLib=null → label contains 'my-model'
3. No model at all: cfg={env:{}}, providerMap={}, agentCfg={}, secretsLib=null → label contains '?'
4. Name is padded to 14 chars: name='x', check that the returned string has name portion padded (length of name section === 14)

**applyKeyUpdate — 5 cases:**
1. No apiKey in updates → newEnv returned unchanged (same reference or same keys)
2. updates.apiKey = '__REMOVE__', secretsLib=null → ANTHROPIC_API_KEY deleted from newEnv (if it was there)
3. updates.apiKey = '__REMOVE__', secretsLib mock → secretsLib.delete called with ('qgsd', 'ACCOUNT') — track calls
4. updates.apiKey = 'sk-real-key', secretsLib mock → ANTHROPIC_API_KEY removed from newEnv, secretsLib.set called with ('qgsd', 'ACCOUNT', 'sk-real-key')
5. updates.apiKey = 'sk-real-key', secretsLib=null → newEnv.ANTHROPIC_API_KEY = 'sk-real-key' (fallback plaintext)

For cases 3-4, create a tracking mock:
```js
const calls = [];
const mockLib = {
  set: (s, k, v) => { calls.push(['set', s, k, v]); return Promise.resolve(); },
  delete: (s, k) => { calls.push(['del', s, k]); return Promise.resolve(); },
};
```
After calling applyKeyUpdate, assert on calls array.

**applyCcrProviderUpdate — 4 cases:**
1. subAction='set', selectedKey='AKASHML_API_KEY', keyValue='abc123' → returns {action:'set', key:'AKASHML_API_KEY'}, secretsLib.set called with ('qgsd','AKASHML_API_KEY','abc123')
2. subAction='remove', selectedKey='TOGETHER_API_KEY' → returns {action:'remove', key:'TOGETHER_API_KEY'}, secretsLib.delete called
3. subAction='set' with FIREWORKS_API_KEY → set called with correct key name
4. subAction='unknown' → returns null, no secretsLib calls

All test assertions use assert.strictEqual, assert.ok, assert.deepStrictEqual. Use async test blocks where needed (applyCcrProviderUpdate is async).

After writing the file, run: node --test bin/manage-agents.test.cjs
If any test fails, fix the _pure function or the test until all pass. The file must be clean (no pending tests, no skipped tests, exit 0).
  </action>
  <verify>
    node --test /Users/jonathanborduas/code/QGSD/bin/manage-agents.test.cjs
    Expected: all test suites pass, process exits 0. Output should show passing counts for all 6 function groups.
  </verify>
  <done>
    node --test bin/manage-agents.test.cjs exits 0. All test cases for deriveKeytarAccount, maskKey, buildKeyStatus, buildAgentChoiceLabel, applyKeyUpdate, and applyCcrProviderUpdate pass without errors or skips.
  </done>
</task>

</tasks>

<verification>
1. node -e "const {_pure:p} = require('./bin/manage-agents.cjs'); console.log(Object.keys(p))" → lists all 6 function names
2. node --test bin/manage-agents.test.cjs → exits 0, all tests pass
3. node bin/manage-agents.cjs --help (or just require it) — no crash, interactive menu still works
4. grep -c 'module.exports._pure' bin/manage-agents.cjs → 1 (exactly one _pure export block)
5. grep 'module.exports = ' bin/manage-agents.cjs → original export line still present and unchanged
</verification>

<success_criteria>
- bin/manage-agents.cjs exports _pure with 6 functions: deriveKeytarAccount, maskKey, buildKeyStatus, buildAgentChoiceLabel, applyKeyUpdate, applyCcrProviderUpdate
- bin/manage-agents.test.cjs exists and passes node --test with exit code 0
- Existing interactive CLI behaviour is unchanged (no modifications to inquirer-coupled functions)
- No new npm dependencies required (node:test and node:assert are built-in)
</success_criteria>

<output>
After completion, create .planning/quick/96-refactor-manage-agents-cjs-to-extract-pu/96-SUMMARY.md with:
- What was extracted (list of functions)
- Test results (pass count)
- Any deviations from plan
</output>
