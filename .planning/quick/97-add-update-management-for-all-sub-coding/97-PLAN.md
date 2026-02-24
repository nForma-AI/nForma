---
phase: quick-97
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - bin/update-agents.cjs
  - bin/manage-agents.cjs
autonomous: true
requirements:
  - QUICK-97
must_haves:
  truths:
    - "Running 'Update coding agents' from manage-agents.cjs main menu shows a table with CLI, install method, current version, latest version, and status for all 5 agents"
    - "User can select 'Update all outdated' and each outdated agent is upgraded via the correct command (brew upgrade / npm install -g / gh extension upgrade)"
    - "User can select an individual agent to update from a filtered list of outdated agents"
    - "User can skip without making changes"
    - "If a CLI is not installed, status shows '? unknown' and it is excluded from update prompts"
  artifacts:
    - path: "bin/update-agents.cjs"
      provides: "Standalone update management module with detect/display/update logic"
      exports: ["updateAgents"]
    - path: "bin/manage-agents.cjs"
      provides: "Main menu with item 10 wired to updateAgents()"
      contains: "update-agents"
  key_links:
    - from: "bin/manage-agents.cjs"
      to: "bin/update-agents.cjs"
      via: "require('./update-agents.cjs')"
      pattern: "require.*update-agents"
    - from: "bin/update-agents.cjs"
      to: "bin/providers.json"
      via: "require('./providers.json') — deduplicate by cli path"
      pattern: "providers\\.json"
---

<objective>
Add a full update management flow for all sub-coding agent CLIs (codex, gemini, opencode, copilot, ccr).

Purpose: Developers can check and upgrade all quorum agents from a single menu item without manually knowing install methods or package names.
Output: bin/update-agents.cjs (new module) + menu item 10 wired in bin/manage-agents.cjs.
</objective>

<execution_context>
@/Users/jonathanborduas/.claude/get-shit-done/workflows/execute-plan.md
@/Users/jonathanborduas/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@bin/providers.json
@bin/resolve-cli.cjs
@bin/manage-agents.cjs
</context>

<tasks>

<task type="auto">
  <name>Task 1: Create bin/update-agents.cjs — detect, display, and update logic</name>
  <files>bin/update-agents.cjs</files>
  <action>
Create `/Users/jonathanborduas/code/QGSD/bin/update-agents.cjs` as a CommonJS module exporting `updateAgents()`.

**Package/formula/extension map (hardcoded in the module):**
```js
const CLI_META = {
  codex:   { installType: 'npm-global',    pkg: '@openai/codex' },
  gemini:  { installType: 'npm-global',    pkg: '@google/gemini-cli' },
  opencode:{ installType: 'npm-global',    pkg: 'opencode' },
  copilot: { installType: 'gh-extension',  ext: 'github/gh-copilot' },
  ccr:     { installType: 'npm-global',    pkg: 'claude-code-router' },
};
```

**Step 1 — Build unique CLI list from providers.json:**
- `require('./providers.json')` and extract `providers[]`
- Deduplicate by `cli` path (basename of `cli` field = binary name)
- Map each unique binary name through `CLI_META` to get installType + pkg/ext
- Only include binaries that appear in `CLI_META`; silently skip others

**Step 2 — Detect current version per install type:**
- `npm-global`: run `spawnSync('npm', ['list', '-g', pkg, '--depth=0', '--json'], { encoding: 'utf8', timeout: 8000 })` → parse `.dependencies[pkg].version`; fallback `null`
- `gh-extension`: run `spawnSync('gh', ['extension', 'list'], { encoding: 'utf8', timeout: 6000 })` → find line matching `copilot` and extract version token (format: `github/gh-copilot  v1.2.3`); fallback `null`
- `ccr` uses npm-global (package: `claude-code-router`)

**Step 3 — Detect latest version per install type:**
- `npm-global`: run `spawnSync('npm', ['view', pkg, 'version'], { encoding: 'utf8', timeout: 8000 })` → `.stdout.trim()`; fallback `null`
- `gh-extension`: run `spawnSync('gh', ['extension', 'upgrade', '--dry-run', 'copilot'], { encoding: 'utf8', stderr: 'pipe', timeout: 8000 })` — if output contains "already up to date" then latest == current; otherwise parse version from output or set `latest = null` with status `? unknown`

Note: brew is NOT used (all 5 CLIs map to npm-global or gh-extension per CLI_META above, even though providers.json shows `/opt/homebrew/bin/` paths — those binaries exist there via npm symlinks or gh extension install, not via brew formulas).

**Step 4 — Build status row per CLI:**
```
status = current === null ? '? unknown'
       : latest === null  ? '? unknown'
       : semverGte(current, latest) ? '✓ up to date'
       : '↑ update available'
```
For semver comparison, implement a simple `semverGte(a, b)` that strips leading `v`, splits by `.`, compares numeric components. Do not pull in `semver` package.

**Step 5 — Display table:**
Use `console.log` with ANSI coloring (no external table library):
```
  CLI       Install       Current   Latest    Status
  ───────── ──────────── ──────────  ──────────  ─────────────────
  codex     npm-global   1.2.3     1.3.0     ↑ update available
  gemini    npm-global   0.1.5     0.1.5     ✓ up to date
  opencode  npm-global   0.3.1     0.3.1     ✓ up to date
  copilot   gh-extension 2.1.0     2.1.0     ✓ up to date
  ccr       npm-global   1.0.2     1.0.3     ↑ update available
```
Color: `↑ update available` in yellow (`\x1b[33m`), `✓ up to date` in green (`\x1b[32m`), `? unknown` in dim (`\x1b[90m`).

**Step 6 — Prompt and update:**
Use `inquirer` (already in package.json) for the prompt. If zero outdated agents, skip prompt and print "All agents are up to date."

If outdated agents exist:
```js
const { action } = await inquirer.prompt([{
  type: 'list',
  name: 'action',
  message: 'Update options:',
  choices: [
    { name: 'Update all outdated', value: 'all' },
    { name: 'Select individual agents', value: 'select' },
    { name: 'Skip', value: 'skip' },
  ],
}]);
```

For `select`: show checkbox prompt with only outdated CLIs; user picks subset.

For `all` or selected subset: run update for each:
- `npm-global`: `spawnSync('npm', ['install', '-g', `${pkg}@latest`], { stdio: 'inherit', timeout: 60000 })`
- `gh-extension`: `spawnSync('gh', ['extension', 'upgrade', 'copilot'], { stdio: 'inherit', timeout: 30000 })`

Print `\n  Updated: <cli>` after each or show error if spawnSync status !== 0.

**Module export:**
```js
module.exports = { updateAgents };
```

**No top-level await. Use async function `updateAgents()`.** All spawnSync calls get try/catch returning null on error. Do not use `exec` or `execSync` — use `spawnSync` for version detection (consistent with rest of codebase).
  </action>
  <verify>
Run: `node -e "const {updateAgents} = require('./bin/update-agents.cjs'); console.log('loaded ok');"` from `/Users/jonathanborduas/code/QGSD` — must print "loaded ok" without throwing.
Run: `node -e "const {updateAgents} = require('./bin/update-agents.cjs'); updateAgents().catch(e=>{console.error(e);process.exit(1)});"` — must display the version table and exit cleanly (no crash, even if some CLIs are not installed).
  </verify>
  <done>
`bin/update-agents.cjs` exists, loads without error, prints a version status table for all 5 CLIs, and prompts for update action (or prints "All agents are up to date." if nothing to update).
  </done>
</task>

<task type="auto">
  <name>Task 2: Wire menu item 10 in bin/manage-agents.cjs</name>
  <files>bin/manage-agents.cjs</files>
  <action>
Edit `/Users/jonathanborduas/code/QGSD/bin/manage-agents.cjs` to add menu item 10.

**1. Add require at top of file** (after existing requires, around line 11):
```js
const { updateAgents } = require('./update-agents.cjs');
```

**2. Add menu choice** in the `mainMenu()` choices array, after the `ccr-keys` entry and before the `0. Exit` entry. The current structure around lines 1397–1403 is:
```js
{ name: '9. Manage CCR provider keys', value: 'ccr-keys' },
new inquirer.Separator(),
{ name: '0. Exit', value: 'exit' },
```
Change to:
```js
{ name: '9. Manage CCR provider keys', value: 'ccr-keys' },
new inquirer.Separator(),
{ name: '10. Update coding agents', value: 'update-agents' },
new inquirer.Separator(),
{ name: '0. Exit', value: 'exit' },
```

**3. Add handler** in the `if/else if` dispatch block after the `ccr-keys` handler (around line 1417):
```js
else if (action === 'ccr-keys') await manageCcrProviders();
else if (action === 'update-agents') await updateAgents();
```

Do NOT touch any other part of the file. Do not reformat or reorder existing code.
  </action>
  <verify>
Run: `node -e "require('./bin/manage-agents.cjs')" 2>&1` — must load without syntax errors.
Run: `grep -n "update-agents\|updateAgents\|Update coding" /Users/jonathanborduas/code/QGSD/bin/manage-agents.cjs` — must show 3 matches (require line, choice line, handler line).
  </verify>
  <done>
`bin/manage-agents.cjs` has the require for update-agents.cjs, menu item 10 "Update coding agents", and the dispatch handler. Running `node bin/manage-agents.cjs` shows item 10 in the main menu.
  </done>
</task>

</tasks>

<verification>
1. `node bin/manage-agents.cjs` — main menu shows items 1–10 plus 0. Exit
2. Select item 10 — update table renders showing all 5 CLIs with version info
3. `node -e "const {updateAgents}=require('./bin/update-agents.cjs'); updateAgents()" 2>&1` — exits cleanly (no unhandled rejections)
4. `grep "update-agents" bin/manage-agents.cjs` — shows require, choice, and handler
</verification>

<success_criteria>
- `bin/update-agents.cjs` exists and exports `updateAgents()`
- Version table displays codex, gemini, opencode, copilot, ccr with correct install type labels
- Update prompt appears when outdated agents exist; "All agents are up to date." otherwise
- Menu item 10 in manage-agents.cjs routes to updateAgents()
- No regressions: existing menu items 1–9 still work
</success_criteria>

<output>
After completion, create `.planning/quick/97-add-update-management-for-all-sub-coding/97-SUMMARY.md`
</output>
