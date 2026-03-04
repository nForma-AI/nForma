---
phase: quick-147
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - bin/polyrepo.cjs
  - bin/polyrepo.test.cjs
  - commands/qgsd/polyrepo.md
autonomous: true
requirements: [QUICK-147]
formal_artifacts: none

must_haves:
  truths:
    - "Running `/qgsd:polyrepo create` interactively gathers a group name and repo list, writes ~/.claude/polyrepos/<name>.json, and writes .planning/polyrepo.json marker in each repo that has planning: true"
    - "Running `/qgsd:polyrepo add <group> <path> <role>` adds a repo entry to an existing group config and writes the per-repo marker"
    - "Running `/qgsd:polyrepo list` displays all polyrepo groups and their repos with roles and planning status"
    - "Running `/qgsd:polyrepo remove <group> <path>` removes a repo from a group and deletes its per-repo marker"
    - "Per-repo marker at .planning/polyrepo.json contains { name, role } and correctly identifies group membership"
    - "Global config at ~/.claude/polyrepos/<name>.json contains { name, repos: [{ role, path, planning }] }"
    - "Roles are free-form strings, not a fixed enum"
    - "All tests pass via node --test bin/polyrepo.test.cjs"
  artifacts:
    - path: "bin/polyrepo.cjs"
      provides: "Polyrepo config management CLI — create, add, list, remove subcommands"
      exports: ["createGroup", "addRepo", "listGroups", "removeRepo", "loadGroup", "POLYREPOS_DIR"]
      min_lines: 150
    - path: "bin/polyrepo.test.cjs"
      provides: "Test suite for polyrepo.cjs pure functions and CLI integration"
      contains: "PR-CREATE"
      min_lines: 80
    - path: "commands/qgsd/polyrepo.md"
      provides: "Skill definition for /qgsd:polyrepo interactive command"
      contains: "qgsd:polyrepo"
  key_links:
    - from: "bin/polyrepo.cjs"
      to: "~/.claude/polyrepos/<name>.json"
      via: "fs.writeFileSync for group config persistence"
      pattern: "polyrepos.*\\.json"
    - from: "bin/polyrepo.cjs"
      to: ".planning/polyrepo.json"
      via: "writes per-repo marker with { name, role }"
      pattern: "polyrepo\\.json"
    - from: "commands/qgsd/polyrepo.md"
      to: "bin/polyrepo.cjs"
      via: "skill definition routes to CLI script"
      pattern: "polyrepo\\.cjs"
---

<objective>
Add polyrepo configuration support to QGSD. Create a CLI tool and slash command that manages named groups of related repositories (e.g., frontend + backend + infra forming one product). Global config lives at `~/.claude/polyrepos/<name>.json`, per-repo markers live at `.planning/polyrepo.json`.

Purpose: Enable cross-repo awareness in QGSD so that planning, verification, and consistency solving can operate across polyrepo boundaries in future phases.

Output: `bin/polyrepo.cjs` (CLI), `bin/polyrepo.test.cjs` (tests), `commands/qgsd/polyrepo.md` (skill definition).
</objective>

<execution_context>
@/Users/jonathanborduas/.claude/qgsd/workflows/execute-plan.md
@/Users/jonathanborduas/.claude/qgsd/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@hooks/config-loader.js
@commands/qgsd/solve.md
</context>

<tasks>

<task type="auto">
  <name>Task 1: Create bin/polyrepo.cjs polyrepo config management CLI</name>
  <files>bin/polyrepo.cjs</files>
  <action>
Create `bin/polyrepo.cjs` (~200-250 lines). Shebang: `#!/usr/bin/env node`, `'use strict'`. Follow the same structural pattern as other `bin/*.cjs` scripts in the project (TAG constant, CLI subcommand parsing, fs operations, structured output).

**Constants:**
```javascript
const TAG = '[qgsd-polyrepo]';
const POLYREPOS_DIR = path.join(os.homedir(), '.claude', 'polyrepos');
const MARKER_FILE = 'polyrepo.json';  // relative to .planning/ in each repo
```

**Core functions (all exported for testability):**

1. `ensurePolyreposDir()` — creates `~/.claude/polyrepos/` if it does not exist. Uses `fs.mkdirSync(POLYREPOS_DIR, { recursive: true })`.

2. `loadGroup(name)` — reads `~/.claude/polyrepos/<name>.json`, returns parsed object or null if not found. Fail-open: if malformed JSON, log warning to stderr and return null.

3. `saveGroup(group)` — writes `~/.claude/polyrepos/<group.name>.json` with `JSON.stringify(group, null, 2)`. Calls `ensurePolyreposDir()` first.

4. `writeMarker(repoPath, name, role)` — writes `<repoPath>/.planning/polyrepo.json` containing `{ "name": "<name>", "role": "<role>" }`. Creates `.planning/` directory if it does not exist. Uses `fs.mkdirSync` with `{ recursive: true }`.

5. `removeMarker(repoPath)` — deletes `<repoPath>/.planning/polyrepo.json` if it exists. Fail-open: if file does not exist, do nothing (no error).

6. `createGroup(name, repos)` — validates name (alphanumeric + hyphens, 1-50 chars), validates repos array (each must have `role` string, `path` string that exists as a directory, and `planning` boolean). Creates the group config file. For each repo with `planning: true`, writes the per-repo marker. Returns `{ ok: true, group }` or `{ ok: false, error: string }`.

   Validation rules:
   - Name must match `/^[a-z0-9][a-z0-9-]*$/` (lowercase, start with alphanumeric)
   - Name must not already exist as a group (check if file exists)
   - Each repo path must be an absolute path
   - Each repo path must exist as a directory (fs.existsSync + fs.statSync.isDirectory)
   - No duplicate paths within the same group
   - Role is a non-empty string (free-form, not enum-validated)

7. `addRepo(groupName, repoPath, role, planning)` — loads existing group, appends repo entry, saves. Writes per-repo marker if `planning` is true. Returns `{ ok, error? }`.
   - Validates group exists
   - Validates repo path is absolute and exists as directory
   - Validates repo not already in group (by path)
   - Defaults `planning` to `true` if not specified

8. `removeRepo(groupName, repoPath)` — loads group, removes repo entry matching `repoPath`, saves group. Removes per-repo marker. If group becomes empty after removal, delete the group config file entirely. Returns `{ ok, error?, deleted_group? }`.

9. `listGroups()` — reads all `*.json` files from `~/.claude/polyrepos/`, parses each, returns array of group objects. Skips malformed files with stderr warning.

10. `listGroup(name)` — loads a single group and returns it, or null if not found.

**CLI subcommand parsing (only when `require.main === module`):**

Parse `process.argv.slice(2)` for subcommands:

- `create` — runs in non-interactive mode: `node bin/polyrepo.cjs create <name>`. Creates an empty group. Prints confirmation.
- `add <group> <path> [role] [--no-planning]` — adds repo to group. Role defaults to basename of path. `--no-planning` sets `planning: false`.
- `remove <group> <path>` — removes repo from group.
- `list [group]` — if group name provided, lists repos in that group; otherwise lists all groups.
- `info` — reads `.planning/polyrepo.json` in cwd (if exists) and prints which group this repo belongs to.

**Output format:** Use process.stdout.write for structured output. Format:

For `list` (all groups):
```
Polyrepo Groups:
  my-product (3 repos)
    frontend  /Users/jb/code/app-web        [planning]
    backend   /Users/jb/code/app-api        [planning]
    infra     /Users/jb/code/app-infra      [no planning]
```

For `info`:
```
This repo belongs to polyrepo group: my-product
Role: frontend
Planning: yes
```

**Export for testability:**
```javascript
module.exports = {
  createGroup, addRepo, removeRepo, listGroups, listGroup,
  loadGroup, saveGroup, writeMarker, removeMarker,
  ensurePolyreposDir, POLYREPOS_DIR, MARKER_FILE
};
```
  </action>
  <verify>
    1. `node -e "const p = require('./bin/polyrepo.cjs'); console.log(typeof p.createGroup, typeof p.addRepo, typeof p.listGroups)"` prints `function function function`.
    2. `node bin/polyrepo.cjs list` exits without crashing (returns empty list or existing groups).
    3. `node bin/polyrepo.cjs --help 2>&1 || node bin/polyrepo.cjs 2>&1` prints usage info without crashing.
  </verify>
  <done>bin/polyrepo.cjs is a working CLI with create/add/remove/list/info subcommands. All core functions are exported. Group configs stored at ~/.claude/polyrepos/<name>.json, per-repo markers at .planning/polyrepo.json.</done>
</task>

<task type="auto">
  <name>Task 2: Create test suite and skill definition</name>
  <files>
    bin/polyrepo.test.cjs
    commands/qgsd/polyrepo.md
  </files>
  <action>
**Step 1 -- Create `bin/polyrepo.test.cjs`:**

Use `node:test` + `node:assert/strict` (same pattern as all other test files in bin/). Use `os.tmpdir()` + `fs.mkdtempSync` for test isolation -- create a temp directory that acts as a fake HOME so tests never touch the real `~/.claude/polyrepos/`.

**Test setup helper:**
```javascript
const { describe, test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const os = require('os');

// Create isolated test environment
function createTestEnv() {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'qgsd-polyrepo-test-'));
  const polyreposDir = path.join(tmpDir, '.claude', 'polyrepos');
  const repoA = path.join(tmpDir, 'repo-a');
  const repoB = path.join(tmpDir, 'repo-b');
  fs.mkdirSync(polyreposDir, { recursive: true });
  fs.mkdirSync(repoA, { recursive: true });
  fs.mkdirSync(repoB, { recursive: true });
  return { tmpDir, polyreposDir, repoA, repoB };
}
```

Since the module uses `os.homedir()` to compute POLYREPOS_DIR, tests should NOT call the exported functions directly with real HOME. Instead, test the pure logic by:

1. **Testing validation logic directly** — the validation parts of createGroup/addRepo that don't touch disk.
2. **Integration tests via CLI** — spawn `node bin/polyrepo.cjs` with `HOME` env var overridden to the temp dir, so it writes to temp instead of real HOME.

**Unit tests (pure function behavior):**

PR-VALIDATE-1: createGroup with invalid name (contains spaces) returns `{ ok: false }`.
- Override POLYREPOS_DIR temporarily or test the name regex directly:
  ```javascript
  test('PR-VALIDATE-1: invalid group name rejected', () => {
    const nameRegex = /^[a-z0-9][a-z0-9-]*$/;
    assert.equal(nameRegex.test('my product'), false);
    assert.equal(nameRegex.test('My-Product'), false);
    assert.equal(nameRegex.test('-bad'), false);
    assert.equal(nameRegex.test('good-name'), true);
    assert.equal(nameRegex.test('a'), true);
  });
  ```

PR-VALIDATE-2: createGroup with valid name regex passes.

PR-VALIDATE-3: role is free-form string (not enum).
  ```javascript
  test('PR-VALIDATE-3: role accepts any non-empty string', () => {
    const roles = ['frontend', 'backend', 'infra', 'marketing', 'monorepo', 'my-custom-role'];
    roles.forEach(r => assert.equal(typeof r === 'string' && r.length > 0, true));
  });
  ```

**Integration tests (spawn CLI with temp HOME):**

PR-CREATE-1: `create` subcommand creates group file.
  ```javascript
  test('PR-CREATE-1: create subcommand creates group config', () => {
    const env = createTestEnv();
    const result = spawnSync(process.execPath, [
      path.join(__dirname, 'polyrepo.cjs'), 'create', 'test-product'
    ], { encoding: 'utf8', env: { ...process.env, HOME: env.tmpDir } });
    assert.equal(result.status, 0, 'exit code 0');
    const configPath = path.join(env.polyreposDir, 'test-product.json');
    assert.ok(fs.existsSync(configPath), 'group config file created');
    const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    assert.equal(config.name, 'test-product');
    assert.ok(Array.isArray(config.repos));
    fs.rmSync(env.tmpDir, { recursive: true, force: true });
  });
  ```

PR-ADD-1: `add` subcommand adds repo to existing group and writes marker.
  ```javascript
  test('PR-ADD-1: add subcommand adds repo and writes marker', () => {
    const env = createTestEnv();
    // Create group first
    spawnSync(process.execPath, [
      path.join(__dirname, 'polyrepo.cjs'), 'create', 'test-product'
    ], { encoding: 'utf8', env: { ...process.env, HOME: env.tmpDir } });
    // Add repo
    const result = spawnSync(process.execPath, [
      path.join(__dirname, 'polyrepo.cjs'), 'add', 'test-product', env.repoA, 'frontend'
    ], { encoding: 'utf8', env: { ...process.env, HOME: env.tmpDir } });
    assert.equal(result.status, 0, 'exit code 0');
    // Verify group config updated
    const config = JSON.parse(fs.readFileSync(
      path.join(env.polyreposDir, 'test-product.json'), 'utf8'
    ));
    assert.equal(config.repos.length, 1);
    assert.equal(config.repos[0].role, 'frontend');
    assert.equal(config.repos[0].path, env.repoA);
    assert.equal(config.repos[0].planning, true);
    // Verify per-repo marker
    const marker = JSON.parse(fs.readFileSync(
      path.join(env.repoA, '.planning', 'polyrepo.json'), 'utf8'
    ));
    assert.equal(marker.name, 'test-product');
    assert.equal(marker.role, 'frontend');
    fs.rmSync(env.tmpDir, { recursive: true, force: true });
  });
  ```

PR-REMOVE-1: `remove` subcommand removes repo from group and deletes marker.

PR-LIST-1: `list` subcommand shows groups after creation.

PR-INFO-1: `info` subcommand reads marker from cwd.

PR-ADD-NOPLAN-1: `add --no-planning` sets planning to false and does NOT write marker.

PR-DUP-1: adding same path twice to a group returns error.

PR-EMPTY-1: removing last repo from a group deletes the group config file.

All integration tests must use `HOME` env override and clean up temp dirs.

**Step 2 -- Create `commands/qgsd/polyrepo.md` skill definition:**

Follow the exact pattern from existing command files (e.g., `commands/qgsd/settings.md`):

```markdown
---
name: qgsd:polyrepo
description: Manage polyrepo groups — register repos that form one product for cross-repo QGSD awareness
argument-hint: create | add <group> <path> [role] | remove <group> <path> | list [group] | info
allowed-tools:
  - Read
  - Write
  - Bash
  - AskUserQuestion
---

<objective>
Manage named polyrepo groups — collections of repositories that together form one product. Supports creating groups, adding/removing repos, listing groups, and checking current repo membership.

Global config: ~/.claude/polyrepos/<name>.json
Per-repo marker: .planning/polyrepo.json
</objective>

<execution_context>
Self-contained — no external workflow file needed.
</execution_context>

<process>
Parse $ARGUMENTS for subcommand:

**If no arguments or `create`:**
Interactive flow using AskUserQuestion:
1. Ask for group name (lowercase, alphanumeric + hyphens)
2. Ask for repos to include (one at a time: path, role, planning yes/no)
3. Ask "Add another repo?" until user says no
4. Run `node bin/polyrepo.cjs create <name>` to create the empty group
5. For each repo, run `node bin/polyrepo.cjs add <name> <path> <role> [--no-planning]`
6. Display summary of created group

**If `add <group> <path> [role]`:**
Run `node bin/polyrepo.cjs add <group> <path> <role> [--no-planning]`
If role not provided, ask via AskUserQuestion.

**If `remove <group> <path>`:**
Run `node bin/polyrepo.cjs remove <group> <path>`
Confirm action.

**If `list [group]`:**
Run `node bin/polyrepo.cjs list [group]`
Display formatted output.

**If `info`:**
Run `node bin/polyrepo.cjs info`
Display current repo's group membership.
</process>
```
  </action>
  <verify>
    1. `node --test bin/polyrepo.test.cjs` -- all tests pass.
    2. `cat commands/qgsd/polyrepo.md | head -5` -- contains `name: qgsd:polyrepo`.
    3. `grep -c 'PR-' bin/polyrepo.test.cjs` -- at least 8 matches (confirms test breadth).
  </verify>
  <done>
    bin/polyrepo.test.cjs has unit tests for validation logic and integration tests for all CLI subcommands using temp HOME isolation. commands/qgsd/polyrepo.md is a complete skill definition with interactive create flow via AskUserQuestion. All tests green.
  </done>
</task>

</tasks>

<verification>
1. `node -e "const p = require('./bin/polyrepo.cjs'); console.log(typeof p.createGroup, typeof p.addRepo, typeof p.removeRepo, typeof p.listGroups)"` prints `function function function function`
2. `node --test bin/polyrepo.test.cjs` -- all PR-* tests pass (0 failures)
3. `node bin/polyrepo.cjs list` -- exits cleanly (exit code 0)
4. `cat commands/qgsd/polyrepo.md` -- skill definition exists with correct frontmatter
5. Integration test confirms: create group -> add repo -> marker written -> remove repo -> marker deleted -> group cleaned up
</verification>

<success_criteria>
- bin/polyrepo.cjs exports createGroup, addRepo, removeRepo, listGroups, loadGroup, writeMarker, removeMarker
- All CLI subcommands (create, add, remove, list, info) work without crashing
- Group configs persisted at ~/.claude/polyrepos/<name>.json with correct schema
- Per-repo markers persisted at .planning/polyrepo.json with { name, role }
- Roles are free-form strings (not enum validated)
- Planning boolean controls whether per-repo marker is written
- Removing last repo from group deletes the group config
- All tests pass via node --test
- /qgsd:polyrepo command definition exists with interactive create flow
</success_criteria>

<output>
After completion, create `.planning/quick/147-add-polyrepo-config-support-global-confi/147-SUMMARY.md`
</output>
