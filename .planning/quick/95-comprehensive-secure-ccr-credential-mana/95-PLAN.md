---
phase: quick-95
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - bin/ccr-secure-config.cjs
  - bin/ccr-secure-start.cjs
  - bin/manage-agents.cjs
  - hooks/qgsd-session-start.js
  - hooks/dist/qgsd-session-start.js
autonomous: true
requirements: [CCR-SEC-01, CCR-SEC-02, CCR-SEC-03, CCR-SEC-04, CCR-SEC-05, CCR-SEC-06]

must_haves:
  truths:
    - "~/.claude-code-router/config.json has no plaintext API keys (all api_key fields are empty strings)"
    - "Running node bin/ccr-secure-config.cjs populates config.json from keytar and sets chmod 600"
    - "manage-agents.cjs menu item 9 lets user set/view/remove AKASHML_API_KEY, TOGETHER_API_KEY, FIREWORKS_API_KEY in keytar"
    - "SessionStart hook calls ccr-secure-config.cjs so CCR config is populated before each session"
    - "After install sync, ccr-secure-config.cjs runs at Claude Code startup without manual intervention"
  artifacts:
    - path: "bin/ccr-secure-config.cjs"
      provides: "Reads 3 CCR keys from keytar blob, writes ~/.claude-code-router/config.json with chmod 600"
    - path: "bin/ccr-secure-start.cjs"
      provides: "Wrapper: populate config, spawn CCR, wipe keys on exit/SIGTERM"
    - path: "bin/manage-agents.cjs"
      provides: "Menu item 9: Manage CCR providers (set/view/remove 3 keys)"
    - path: "hooks/qgsd-session-start.js"
      provides: "Updated SessionStart hook that also calls ccr-secure-config"
    - path: "hooks/dist/qgsd-session-start.js"
      provides: "Dist copy for install sync"
  key_links:
    - from: "hooks/qgsd-session-start.js"
      to: "bin/ccr-secure-config.cjs"
      via: "execFileSync node call in session start hook"
      pattern: "ccr-secure-config"
    - from: "bin/ccr-secure-config.cjs"
      to: "keytar via bin/secrets.cjs"
      via: "secrets.get('qgsd', 'AKASHML_API_KEY') etc."
      pattern: "secrets\\.get"
    - from: "bin/manage-agents.cjs"
      to: "keytar via bin/secrets.cjs"
      via: "secrets.set/get/delete in manageCcrProviders()"
      pattern: "manageCcrProviders"
---

<objective>
Harden CCR credential storage: move AkashML, Together, and Fireworks API keys from plaintext
~/.claude-code-router/config.json into keytar (using the existing qgsd/secrets blob in bin/secrets.cjs).
Generate config.json on demand from keytar. Integrate into SessionStart hook and manage-agents.cjs.

Purpose: The 3 CCR API keys are currently stored in plaintext in config.json and are compromised.
This task zeroes them out, stores them in keytar, and auto-populates config.json at each Claude Code
session start — so CCR works transparently without exposing secrets at rest.

Output: bin/ccr-secure-config.cjs, bin/ccr-secure-start.cjs, updated manage-agents.cjs (menu item 9),
updated hooks/qgsd-session-start.js, install sync, chmod 600 on config.json.
</objective>

<execution_context>
@/Users/jonathanborduas/.claude/get-shit-done/workflows/execute-plan.md
@/Users/jonathanborduas/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@bin/secrets.cjs
@bin/manage-agents.cjs
@hooks/qgsd-session-start.js
</context>

<tasks>

<task type="auto">
  <name>Task 1: Store keys in keytar, create ccr-secure-config.cjs and ccr-secure-start.cjs, strip plaintext keys</name>
  <files>
    bin/ccr-secure-config.cjs
    bin/ccr-secure-start.cjs
  </files>
  <action>
PREREQUISITE — Store the 3 CCR keys in keytar before zeroing out config.json. Run each command
interactively (set-secret.cjs prompts for the value securely):

  node /Users/jonathanborduas/code/QGSD/bin/set-secret.cjs AKASHML_API_KEY
  node /Users/jonathanborduas/code/QGSD/bin/set-secret.cjs TOGETHER_API_KEY
  node /Users/jonathanborduas/code/QGSD/bin/set-secret.cjs FIREWORKS_API_KEY

This step MUST complete before writing the files or zeroing config.json. Use spawnSync with
stdio: 'inherit' so the user can type interactively.

CREATE bin/ccr-secure-config.cjs with this logic:
- Header: #!/usr/bin/env node, 'use strict'
- Requires: fs, path, os, child_process.execSync
- findSecrets() helper: tries ~/.claude/qgsd-bin/secrets.cjs first, then __dirname/secrets.cjs
- CONFIG_PATH = path.join(os.homedir(), '.claude-code-router', 'config.json')
- main() async function:
  1. Load secrets; if not found, write to stderr and exit 0 (fail-silent)
  2. Get AKASHML_API_KEY, TOGETHER_API_KEY, FIREWORKS_API_KEY via secrets.get('qgsd', keyName)
  3. If all three are null/undefined, write warning to stderr and exit 0
  4. Read CONFIG_PATH as JSON; if missing, write stderr and exit 1
  5. Build providerKeyMap = { akashml: akashKey, together: togetherKey, fireworks: fireworksKey }
  6. Iterate config.providers array; for each provider, if provider.name.toLowerCase() matches a key
     in providerKeyMap AND the value is non-null, set provider.api_key = value; count patched++
  7. Write config back to CONFIG_PATH with mode 0o600
  8. Run: execSync('chmod 600 ' + CONFIG_PATH) to enforce permissions on existing files
     (Note: chmod path must be shell-safe — use execFileSync instead: execFileSync('chmod', ['600', CONFIG_PATH]))
  9. Print: '[ccr-secure-config] Populated N provider key(s)' to stdout
- Call main().catch(...) at bottom

CREATE bin/ccr-secure-start.cjs with this logic:
- Header: #!/usr/bin/env node, 'use strict'
- Requires: fs, path, os, child_process (execFileSync + spawn)
- CONFIG_PATH = same as above
- SECURE_CONFIG = path.join(__dirname, 'ccr-secure-config.cjs')
- wipeKeys() sync function: reads CONFIG_PATH JSON, sets all provider.api_key to '', writes back
  with mode 0o600; wrapped in try/catch (silent fail if file missing)
- main() async function:
  1. Parse argv[2] as ccrBin, argv.slice(3) as ccrArgs
  2. If no ccrBin, print usage to stderr and exit 1
  3. Run ccr-secure-config.cjs: execFileSync(process.execPath, [SECURE_CONFIG], { stdio: 'inherit' })
     Catch errors: print to stderr and exit 1
  4. Spawn CCR: const child = spawn(ccrBin, ccrArgs, { stdio: 'inherit' })
  5. child.on('exit', code => { wipeKeys(); process.exit(code ?? 0) })
  6. process.on('SIGTERM', () => { child.kill('SIGTERM'); wipeKeys(); process.exit(0) })
  7. process.on('SIGINT', () => { child.kill('SIGINT'); wipeKeys(); process.exit(0) })
- Call main().catch(...) at bottom

ZERO OUT plaintext keys in ~/.claude-code-router/config.json:
After the above files are created and keys are stored in keytar, run a node inline script that:
  1. Reads ~/.claude-code-router/config.json
  2. Sets all provider.api_key fields to ''
  3. Writes back to CONFIG_PATH
  4. Runs execFileSync('chmod', ['600', CONFIG_PATH])
  5. Prints "Keys zeroed out"
  </action>
  <verify>
1. node --check bin/ccr-secure-config.cjs  (no syntax errors)
2. node --check bin/ccr-secure-start.cjs  (no syntax errors)
3. node bin/ccr-secure-config.cjs  (exits 0, prints "Populated N provider key(s)" where N >= 1)
4. ls -l ~/.claude-code-router/config.json  (shows -rw------- i.e. 600)
5. python3 -c "import json,os; c=json.load(open(os.path.expanduser('~/.claude-code-router/config.json'))); print('CLEAN' if all(p.get('api_key','') == '' for p in c['providers']) else 'HAS KEYS')"
   After running wipe script → CLEAN; after ccr-secure-config → keys populated in memory only during script run
  </verify>
  <done>
    - bin/ccr-secure-config.cjs and bin/ccr-secure-start.cjs exist with no syntax errors
    - 3 CCR keys stored in keytar under service 'qgsd'
    - ~/.claude-code-router/config.json has all api_key set to empty string
    - chmod 600 confirmed on config.json
    - node bin/ccr-secure-config.cjs populates keys from keytar successfully
  </done>
</task>

<task type="auto">
  <name>Task 2: Add "Manage CCR providers" menu item 9 to manage-agents.cjs</name>
  <files>
    bin/manage-agents.cjs
  </files>
  <action>
Add a manageCcrProviders() async function and wire it into mainMenu() as choice 9.

Place the new function immediately before the mainMenu() function (around line 1272 before the
"// Main menu" comment block).

CCR_KEY_NAMES constant (place at top of the new block):
  const CCR_KEY_NAMES = [
    { key: 'AKASHML_API_KEY',   label: 'AkashML API Key'       },
    { key: 'TOGETHER_API_KEY',  label: 'Together.xyz API Key'   },
    { key: 'FIREWORKS_API_KEY', label: 'Fireworks API Key'      },
  ];

manageCcrProviders() async function logic:
1. Lazy-load secretsLib: try candidate paths in order:
   - path.join(os.homedir(), '.claude', 'qgsd-bin', 'secrets.cjs')
   - path.join(__dirname, 'secrets.cjs')
   Use fs.existsSync + require(); catch errors silently.
2. If secretsLib is null, print error and return.
3. Prompt with inquirer list: 'Manage CCR Provider Keys'
   Choices: 'Set / update a key' (value: 'set'), 'View stored keys (masked)' (value: 'view'),
            'Remove a key' (value: 'remove'), 'Back' (value: 'back')
4. If 'back': return.
5. If 'view': for each key in CCR_KEY_NAMES, call secretsLib.get('qgsd', key).
   Display: first 6 chars + '...' + last 4 chars if present, else '(not set)'.
   Print formatted table and return.
6. If 'set' or 'remove': prompt with inquirer list to pick which key (choices from CCR_KEY_NAMES).
   - 'set': prompt type:'password' for the value; call secretsLib.set('qgsd', selectedKey, value.trim())
     Print confirmation with green checkmark.
   - 'remove': prompt for confirm (default false); if confirmed call secretsLib.delete('qgsd', selectedKey)
     NOTE: secrets.cjs exports delete as del(service, key) — call secretsLib.delete('qgsd', selectedKey)
     Print yellow confirmation.

In mainMenu() choices array, add BEFORE the '0. Exit' entry:
  { name: '9. Manage CCR provider keys', value: 'ccr-keys' },

In the if/else handler block in mainMenu(), add:
  else if (action === 'ccr-keys') await manageCcrProviders();
  </action>
  <verify>
1. node --check bin/manage-agents.cjs  (no syntax errors)
2. node -e "const m = require('./bin/manage-agents.cjs'); console.log('ok')"  (prints 'ok', no errors)
3. Grep for 'ccr-keys' in bin/manage-agents.cjs  (appears in both choices and handler)
4. Grep for 'manageCcrProviders' in bin/manage-agents.cjs  (function defined)
  </verify>
  <done>
    - manage-agents.cjs has manageCcrProviders() function with set/view/remove flows
    - Menu item 9 "Manage CCR provider keys" appears in mainMenu() choices
    - Handler wired: else if (action === 'ccr-keys') await manageCcrProviders()
    - node --check passes — no syntax errors
  </done>
</task>

<task type="auto">
  <name>Task 3: Update SessionStart hook to call ccr-secure-config, sync dist, run install</name>
  <files>
    hooks/qgsd-session-start.js
    hooks/dist/qgsd-session-start.js
  </files>
  <action>
Edit hooks/qgsd-session-start.js to add CCR config population after the existing secrets sync.

The current async IIFE calls secrets.syncToClaudeJson(secrets.SERVICE) then exits.
Add a new try/catch block AFTER the syncToClaudeJson call and BEFORE process.exit(0):

  // Populate CCR config from keytar (fail-silent — CCR may not be installed)
  try {
    const { execFileSync } = require('child_process');
    const nodeFsRef = require('fs');
    const ccrCandidates = [
      path.join(os.homedir(), '.claude', 'qgsd-bin', 'ccr-secure-config.cjs'),
      path.join(__dirname, '..', 'bin', 'ccr-secure-config.cjs'),
    ];
    let ccrConfigPath = null;
    for (const p of ccrCandidates) {
      if (nodeFsRef.existsSync(p)) { ccrConfigPath = p; break; }
    }
    if (ccrConfigPath) {
      execFileSync(process.execPath, [ccrConfigPath], { stdio: 'pipe', timeout: 10000 });
    }
  } catch (e) {
    process.stderr.write('[qgsd-session-start] CCR config error: ' + e.message + '\n');
  }

Keep ALL existing code unchanged (findSecrets function, require statements at top, etc.).
Only add the new block inside the existing IIFE.

AFTER editing the source file, run these commands in sequence:
  cp /Users/jonathanborduas/code/QGSD/hooks/qgsd-session-start.js /Users/jonathanborduas/code/QGSD/hooks/dist/qgsd-session-start.js
  node /Users/jonathanborduas/code/QGSD/bin/install.js --claude --global

The installer copies bin/*.cjs to ~/.claude/qgsd-bin/ automatically, so ccr-secure-config.cjs
will be available at the installed path used by the hook.
  </action>
  <verify>
1. node --check hooks/qgsd-session-start.js  (no syntax errors)
2. diff hooks/qgsd-session-start.js hooks/dist/qgsd-session-start.js  (no diff)
3. grep 'ccr-secure-config' ~/.claude/hooks/qgsd-session-start.js  (installed copy has the call)
4. ls ~/.claude/qgsd-bin/ccr-secure-config.cjs  (installed)
5. node hooks/qgsd-session-start.js  (exits 0, completes within 15 seconds)
  </verify>
  <done>
    - hooks/qgsd-session-start.js calls ccr-secure-config.cjs (fail-silent) after secrets sync
    - hooks/dist/qgsd-session-start.js matches source exactly
    - Install ran successfully: ~/.claude/qgsd-bin/ccr-secure-config.cjs exists
    - ~/.claude/hooks/qgsd-session-start.js contains ccr-secure-config reference
    - Next Claude Code session start will auto-populate CCR config from keytar
  </done>
</task>

</tasks>

<verification>
After all 3 tasks complete:

1. node --check bin/ccr-secure-config.cjs  — no errors
2. node --check bin/ccr-secure-start.cjs  — no errors
3. node --check bin/manage-agents.cjs  — no errors
4. node --check hooks/qgsd-session-start.js  — no errors
5. ls -l ~/.claude-code-router/config.json  — shows -rw------- (chmod 600)
6. python3 -c "import json,os; c=json.load(open(os.path.expanduser('~/.claude-code-router/config.json'))); print('CLEAN' if all(p.get('api_key','') == '' for p in c['providers']) else 'FAIL')"  — CLEAN
7. node bin/ccr-secure-config.cjs  — prints "Populated N provider key(s)" (N = 1, 2, or 3)
8. ls ~/.claude/qgsd-bin/ccr-secure-config.cjs  — exists (install succeeded)
</verification>

<success_criteria>
- ~/.claude-code-router/config.json: all api_key fields are empty strings (no plaintext keys at rest)
- config.json has chmod 600
- bin/ccr-secure-config.cjs populates config.json from keytar on demand
- bin/ccr-secure-start.cjs wraps CCR spawn with pre-populate + post-wipe lifecycle
- manage-agents.cjs menu item 9 allows set/view/remove of the 3 CCR provider keys via keytar
- SessionStart hook calls ccr-secure-config.cjs at each Claude Code startup (fail-silent)
- Install sync complete: ~/.claude/qgsd-bin/ccr-secure-config.cjs and ~/.claude/hooks/qgsd-session-start.js are current
</success_criteria>

<output>
After completion, create .planning/quick/95-comprehensive-secure-ccr-credential-mana/95-SUMMARY.md
</output>
