---
phase: quick-198
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - hooks/nf-post-edit-format.js
  - hooks/nf-console-guard.js
  - hooks/config-loader.js
  - bin/install.js
  - .claude/rules/security.md
  - .claude/rules/coding-style.md
  - .claude/rules/testing.md
  - .claude/rules/git-workflow.md
autonomous: true
requirements: [ECC-01, ECC-02, ECC-03]
formal_artifacts: none

must_haves:
  truths:
    - "Editing a .js/.ts/.cjs/.mjs file triggers auto-format via prettier or biome if available"
    - "Post-edit format hook fails open when no formatter is configured"
    - "Stop hook warns about leftover console.log in modified files without blocking"
    - "Claude Code auto-loads project rules from .claude/rules/ directory"
  artifacts:
    - path: "hooks/nf-post-edit-format.js"
      provides: "PostToolUse hook for auto-formatting edited JS/TS files"
      min_lines: 40
    - path: "hooks/nf-console-guard.js"
      provides: "Stop hook that warns about console.log in git-modified files"
      min_lines: 30
    - path: ".claude/rules/security.md"
      provides: "Security rules for Claude Code sessions"
      min_lines: 5
    - path: ".claude/rules/coding-style.md"
      provides: "Coding style rules"
      min_lines: 5
    - path: ".claude/rules/testing.md"
      provides: "Testing conventions"
      min_lines: 5
    - path: ".claude/rules/git-workflow.md"
      provides: "Git workflow rules"
      min_lines: 5
  key_links:
    - from: "bin/install.js"
      to: "hooks/nf-post-edit-format.js"
      via: "PostToolUse hook registration with matcher Edit"
      pattern: "nf-post-edit-format"
    - from: "bin/install.js"
      to: "hooks/nf-console-guard.js"
      via: "Stop hook registration"
      pattern: "nf-console-guard"
    - from: "hooks/config-loader.js"
      to: "hooks/nf-post-edit-format.js"
      via: "HOOK_PROFILE_MAP includes nf-post-edit-format"
      pattern: "nf-post-edit-format"
---

<objective>
Implement three best-practice improvements from the everything-claude-code analysis: (1) a PostToolUse hook that auto-formats JS/TS files after Edit operations, (2) a Stop hook that warns about leftover console.log statements in modified files, and (3) a modular .claude/rules/ directory with project-specific rule files.

Purpose: Improve code quality guardrails and session consistency by catching formatting issues at edit-time, debug leftovers at stop-time, and loading project conventions automatically.
Output: Two new hook files registered in install.js, four rule files in .claude/rules/.
</objective>

<execution_context>
@/Users/jonathanborduas/.claude/nf/workflows/execute-plan.md
@/Users/jonathanborduas/.claude/nf/templates/summary.md
</execution_context>

<context>
@hooks/gsd-context-monitor.js (PostToolUse hook pattern reference)
@hooks/nf-stop.js (Stop hook pattern reference)
@hooks/nf-spec-regen.js (PostToolUse hook with tool_name matching)
@hooks/config-loader.js (HOOK_PROFILE_MAP, shouldRunHook, loadConfig)
@bin/install.js (hook registration pattern — search for "Register nForma" blocks near line 1920)
</context>

<tasks>

<task type="auto">
  <name>Task 1: Create post-edit auto-format and console-guard hooks</name>
  <files>
    hooks/nf-post-edit-format.js
    hooks/nf-console-guard.js
  </files>
  <action>
Create `hooks/nf-post-edit-format.js` — a PostToolUse hook that auto-formats JS/TS files after Edit:

1. Follow the exact stdin-reading pattern from `hooks/nf-spec-regen.js` (stdin collect, JSON.parse, try/catch fail-open).
2. Load config via `require('./config-loader')` and call `shouldRunHook('nf-post-edit-format', profile)` — exit 0 if inactive.
3. Check `input.tool_name === 'Edit'` — exit 0 if not Edit.
4. Extract `input.tool_input.file_path` — exit 0 if not matching `/\.(js|ts|cjs|mjs|jsx|tsx)$/`.
5. Auto-detect formatter: check for `node_modules/.bin/prettier` first, then `node_modules/.bin/biome` in `input.cwd || process.cwd()`. If neither exists, exit 0 (fail-open, no formatter available).
6. Run the detected formatter via `spawnSync` with the file path and `--write` flag (prettier: `--write`, biome: `format --write`). Timeout 10s.
7. On success, output JSON with `hookSpecificOutput.additionalContext` = short message like `[auto-format] Formatted {filename} with {formatter}`.
8. On failure, output warning but still exit 0 (fail-open).

Create `hooks/nf-console-guard.js` — a Stop hook that warns about console.log:

1. Follow the exact stdin-reading pattern from `hooks/nf-stop.js` (stdin collect, JSON.parse, try/catch fail-open).
2. Load config via `require('./config-loader')` and call `shouldRunHook('nf-console-guard', profile)` — exit 0 if inactive.
3. Run `git diff --cached --name-only` AND `git diff --name-only` via `spawnSync` to get all modified files. Combine and dedupe.
4. Filter to only `.js`, `.ts`, `.cjs`, `.mjs`, `.jsx`, `.tsx` files.
5. For each file, read contents and scan for `console.log` statements using regex `/^\s*console\.log\b/gm` (only match lines starting with console.log, not commented-out ones — skip lines starting with `//` or `*`).
6. If any found, output JSON with `decision: 'warn'` (NOT `block`) and `reason` listing the files and line counts. Example: `"CONSOLE.LOG WARNING: Found console.log statements in: hooks/nf-post-edit-format.js (2 occurrences). Consider removing debug logging before shipping."`.
7. If none found, exit 0 silently.
8. IMPORTANT: This hook must NEVER use `decision: 'block'` — it is advisory only. Use the Stop hook output format: `{ decision: "warn", reason: "..." }` for warnings that do not block.

Both hooks must use `'use strict'` and follow the existing fail-open pattern (outer try/catch → exit 0).
  </action>
  <verify>
Run `node -c hooks/nf-post-edit-format.js && node -c hooks/nf-console-guard.js` to verify syntax. Then run `echo '{}' | node hooks/nf-post-edit-format.js; echo $?` — should exit 0 (fail-open on empty input). Same for console-guard: `echo '{}' | node hooks/nf-console-guard.js; echo $?` — should exit 0.
  </verify>
  <done>
Both hook files exist, pass syntax check, and exit 0 on empty/minimal input (fail-open behavior confirmed).
  </done>
</task>

<task type="auto">
  <name>Task 2: Register hooks in install.js and config-loader.js, sync to dist</name>
  <files>
    bin/install.js
    hooks/config-loader.js
  </files>
  <action>
**In `hooks/config-loader.js`:**

1. Add `'nf-post-edit-format'` and `'nf-console-guard'` to the `standard` Set in `HOOK_PROFILE_MAP` (around line 43).
2. Add both to the `strict` Set as well (around line 55).
3. Do NOT add to `minimal` — these are quality-of-life hooks, not core safety hooks.

**In `bin/install.js` — Registration (install path, after nf-spec-regen block near line 1943):**

Add two new registration blocks following the exact pattern of the nf-spec-regen block:

1. Post-edit format hook (PostToolUse with matcher):
```javascript
// Register nForma post-edit format hook (PostToolUse — auto-format JS/TS after Edit)
if (!settings.hooks.PostToolUse) settings.hooks.PostToolUse = [];
const hasPostEditFormatHook = settings.hooks.PostToolUse.some(entry =>
  entry.hooks && entry.hooks.some(h => h.command && h.command.includes('nf-post-edit-format'))
);
if (!hasPostEditFormatHook) {
  settings.hooks.PostToolUse.push({
    matcher: 'Edit',
    hooks: [{ type: 'command', command: buildHookCommand(targetDir, 'nf-post-edit-format.js') }]
  });
  console.log(`  ${green}✓${reset} Configured nForma post-edit format hook (PostToolUse)`);
}
```

2. Console guard hook (Stop):
```javascript
// Register nForma console guard hook (Stop — warn about leftover console.log)
if (!settings.hooks.Stop) settings.hooks.Stop = [];
const hasConsoleGuardHook = settings.hooks.Stop.some(entry =>
  entry.hooks && entry.hooks.some(h => h.command && h.command.includes('nf-console-guard'))
);
if (!hasConsoleGuardHook) {
  settings.hooks.Stop.push({
    hooks: [{ type: 'command', command: buildHookCommand(targetDir, 'nf-console-guard.js') }]
  });
  console.log(`  ${green}✓${reset} Configured nForma console guard hook (Stop)`);
}
```

**In `bin/install.js` — Uninstall path (near line 1193-1215):**

Add uninstall blocks for both hooks, following the nf-spec-regen uninstall pattern:

1. For nf-post-edit-format: filter PostToolUse entries containing 'nf-post-edit-format'.
2. For nf-console-guard: filter Stop entries containing 'nf-console-guard'.

**Sync to dist:**

After all edits, copy both new hook files and the updated config-loader to hooks/dist/:
```bash
cp hooks/nf-post-edit-format.js hooks/dist/
cp hooks/nf-console-guard.js hooks/dist/
cp hooks/config-loader.js hooks/dist/
```

Then run `node bin/install.js --claude --global` to install.
  </action>
  <verify>
Run `node bin/install.js --claude --global` and confirm output includes the two new hook registration messages. Then verify `cat ~/.claude/settings.json | grep -c 'nf-post-edit-format'` returns 1 and `cat ~/.claude/settings.json | grep -c 'nf-console-guard'` returns 1.
  </verify>
  <done>
Both hooks are registered in install.js (install and uninstall paths), added to HOOK_PROFILE_MAP in config-loader.js, synced to hooks/dist/, and successfully installed to ~/.claude/hooks/ via install.js.
  </done>
</task>

<task type="auto">
  <name>Task 3: Create modular .claude/rules/ directory with project-specific rules</name>
  <files>
    .claude/rules/security.md
    .claude/rules/coding-style.md
    .claude/rules/testing.md
    .claude/rules/git-workflow.md
  </files>
  <action>
Create `.claude/rules/` directory and four project-specific rule files. These are Claude Code auto-loaded rules (per https://docs.anthropic.com/en/docs/claude-code/settings#settings-files-and-precedence). Content must be nForma-specific, not generic boilerplate.

**`.claude/rules/security.md`:**
- Never commit .env files, API keys, or secrets to git
- All hook files must use fail-open pattern (try/catch wrapping process.exit(0))
- Hook stdout is the decision channel — never write debug output to stdout, use stderr
- MCP server credentials live in ~/.claude.json, never in repo files
- The `NF_CLAUDE_JSON` env var is for testing only — never set in production

**`.claude/rules/coding-style.md`:**
- All hook files use `'use strict'` at the top
- Use CommonJS (`require`/`module.exports`) for hooks and bin/ scripts — NOT ESM
- The sole ESM exception is `bin/unified-mcp-server.mjs`
- Config loading: always use `require('./config-loader')` with `loadConfig()` and `shouldRunHook()`
- Two-layer config merge: DEFAULT_CONFIG -> ~/.claude/nf.json (global) -> .claude/nf.json (project)
- All hooks read stdin as JSON, process, write JSON to stdout (or nothing for no-op)
- Prefer `spawnSync` for subprocess calls in hooks (synchronous hooks)

**`.claude/rules/testing.md`:**
- Test files live alongside source in hooks/dist/ (e.g., nf-stop.test.js)
- Run tests with `npm test` — uses vitest
- Hook tests must verify fail-open behavior (empty input -> exit 0)
- When editing hooks, always run the corresponding test file to verify
- Known pre-existing failures: 11 in secrets.test.cjs (unimplemented patchClaudeJsonForKey), nf-precompact.test.js hangs (stdin listener)

**`.claude/rules/git-workflow.md`:**
- Install sync required: edits to hook source files in `hooks/` MUST be copied to `hooks/dist/` then run `node bin/install.js --claude --global`
- The installer reads from `hooks/dist/` NOT `hooks/` — the dist copy is what gets installed to `~/.claude/hooks/`
- Planning artifacts use `node bin/gsd-tools.cjs commit` for commits
- Machine build: `npm run build:machines` produces `dist/machines/nf-workflow.machine.js` (NOT .cjs)
- Skill prefix is `/nf:` — all commands use this prefix (e.g., /nf:quick, /nf:solve)
  </action>
  <verify>
Run `ls .claude/rules/` to confirm all four files exist. Run `wc -l .claude/rules/*.md` to confirm each has meaningful content (at least 5 lines). Verify Claude Code will auto-load them by checking they are in `.claude/rules/` (the documented auto-load path).
  </verify>
  <done>
Four rule files exist in .claude/rules/ with nForma-specific content covering security, coding style, testing conventions, and git workflow. Claude Code will auto-load these per session.
  </done>
</task>

</tasks>

<verification>
1. `node -c hooks/nf-post-edit-format.js` — syntax valid
2. `node -c hooks/nf-console-guard.js` — syntax valid
3. `echo '{}' | node hooks/nf-post-edit-format.js; echo $?` — exits 0
4. `echo '{}' | node hooks/nf-console-guard.js; echo $?` — exits 0
5. `grep 'nf-post-edit-format' hooks/config-loader.js` — found in HOOK_PROFILE_MAP
6. `grep 'nf-console-guard' hooks/config-loader.js` — found in HOOK_PROFILE_MAP
7. `grep 'nf-post-edit-format' bin/install.js` — found in registration and uninstall
8. `grep 'nf-console-guard' bin/install.js` — found in registration and uninstall
9. `ls .claude/rules/` — four .md files present
10. `node bin/install.js --claude --global` — succeeds with both hooks registered
</verification>

<success_criteria>
- Two new hooks (nf-post-edit-format.js, nf-console-guard.js) are created, registered, and installed
- Post-edit format triggers on Edit tool for JS/TS files, auto-detects prettier/biome, fails open
- Console guard warns about console.log on Stop, never blocks
- Both hooks are in HOOK_PROFILE_MAP for standard and strict profiles
- Four .claude/rules/ files provide nForma-specific project conventions
- All hooks follow fail-open pattern and existing codebase conventions
</success_criteria>

<output>
After completion, create `.planning/quick/198-implement-ecc-best-practices-post-edit-a/198-SUMMARY.md`
</output>
