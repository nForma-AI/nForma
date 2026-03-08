---
phase: quick-222
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - .claude/rules/git-workflow.md
  - .claude/rules/coding-style.md
  - hooks/nf-destructive-git-guard.js
  - hooks/nf-destructive-git-guard.test.js
  - hooks/dist/nf-destructive-git-guard.js
  - hooks/dist/nf-destructive-git-guard.test.js
  - scripts/build-hooks.js
  - bin/install.js
autonomous: true
formal_artifacts: none
must_haves:
  truths:
    - "Claude is warned before running git stash, git checkout --, or git reset --hard when uncommitted changes exist"
    - "CLAUDE.md rules explicitly state commit-before-destructive-ops and validate-before-apply patterns"
    - "The destructive git guard hook is installed and active in the standard profile"
    - "The hook follows fail-open pattern -- never blocks, only warns via stderr"
  artifacts:
    - path: ".claude/rules/git-workflow.md"
      provides: "Updated rules with commit-before-destructive-ops mandate"
      contains: "commit before destructive"
    - path: ".claude/rules/coding-style.md"
      provides: "Updated rules with validate-before-apply pattern"
      contains: "validate.*before"
    - path: "hooks/nf-destructive-git-guard.js"
      provides: "PreToolUse hook that detects destructive git commands and warns"
      min_lines: 60
    - path: "hooks/nf-destructive-git-guard.test.js"
      provides: "Test coverage for the destructive git guard"
      min_lines: 40
    - path: "hooks/dist/nf-destructive-git-guard.js"
      provides: "Dist copy of the hook"
    - path: "bin/install.js"
      provides: "Hook registration for nf-destructive-git-guard"
      contains: "nf-destructive-git-guard"
  key_links:
    - from: "bin/install.js"
      to: "hooks/dist/nf-destructive-git-guard.js"
      via: "buildHookCommand registration"
      pattern: "nf-destructive-git-guard"
    - from: "scripts/build-hooks.js"
      to: "hooks/nf-destructive-git-guard.js"
      via: "HOOKS_TO_COPY array"
      pattern: "nf-destructive-git-guard"
    - from: "hooks/nf-destructive-git-guard.js"
      to: "hooks/config-loader.js"
      via: "require('./config-loader')"
      pattern: "require.*config-loader"
---

<objective>
Create concrete nForma improvements based on 15-session usage analysis insights. Three friction areas identified: (1) git stash operations undoing completed work, (2) initial implementations missing key requirements, (3) pipeline format/infrastructure assumption mismatches.

Purpose: Prevent the most common Claude Code friction patterns by adding automated guards and explicit rules that catch destructive operations and requirement gaps before they cause rework cycles.
Output: Updated CLAUDE.md rules, a new PreToolUse hook for destructive git guard, and tests.
</objective>

<execution_context>
@/Users/jonathanborduas/.claude/nf/workflows/execute-plan.md
@/Users/jonathanborduas/.claude/nf/templates/summary.md
</execution_context>

<context>
@.claude/rules/git-workflow.md
@.claude/rules/coding-style.md
@hooks/nf-circuit-breaker.js
@hooks/config-loader.js
@bin/install.js
@scripts/build-hooks.js
</context>

<tasks>

<task type="auto">
  <name>Task 1: Add session-insight-driven rules to CLAUDE.md rule files</name>
  <files>.claude/rules/git-workflow.md, .claude/rules/coding-style.md</files>
  <action>
Update `.claude/rules/git-workflow.md` to add a new section "## Destructive Operations Guard" with these rules derived from the session insights:

1. **Commit before destructive git ops**: Before running `git stash`, `git checkout -- .`, `git reset --hard`, or `git clean -f`, ALWAYS commit or confirm that all modified files are either committed or intentionally discardable. Rationale: 15-session analysis showed git stash repeatedly reverted already-completed fixes, creating re-do cycles.

2. **Verify stash is necessary**: Before `git stash`, check if the working changes conflict with the intended operation. Often a targeted `git checkout -- <specific-file>` is safer than a blanket stash. Never stash as a "just in case" step.

3. **Post-stash verification**: After any `git stash pop` or `git stash apply`, immediately verify that the previously-completed work is still intact by running relevant tests or diffing against the expected state.

Update `.claude/rules/coding-style.md` to add a new section "## Validate Before Apply" with these rules:

1. **Validate model/config references before applying**: When configuring model names, API endpoints, or provider references, verify they exist in the current provider map (`bin/providers.json`) or package.json before writing config. Rationale: sessions showed non-existent model names being configured, causing downstream failures.

2. **Verify refactors preserve extraction**: When refactoring code that was previously extracted into separate modules/functions, verify the refactored version still imports from the extracted location rather than re-inlining the content. Run `grep` to confirm import statements reference the extracted module. Rationale: sub-skill refactors re-inlined previously extracted content.

3. **Pre-flight infrastructure checks**: Before running automated pipelines (test suites, build scripts, deployment), verify the expected file formats and infrastructure state match assumptions. Check that input files exist and match expected schemas before processing.
  </action>
  <verify>
Confirm rules are present:
```bash
grep -c "Destructive Operations Guard" .claude/rules/git-workflow.md
grep -c "commit before destructive" .claude/rules/git-workflow.md
grep -c "Validate Before Apply" .claude/rules/coding-style.md
grep -c "Verify refactors preserve" .claude/rules/coding-style.md
```
All should return 1.
  </verify>
  <done>git-workflow.md contains Destructive Operations Guard section with 3 rules; coding-style.md contains Validate Before Apply section with 3 rules. All rules are specific and cite the session-analysis rationale.</done>
</task>

<task type="auto">
  <name>Task 2: Create PreToolUse destructive-git-guard hook with tests</name>
  <files>hooks/nf-destructive-git-guard.js, hooks/nf-destructive-git-guard.test.js</files>
  <action>
Create `hooks/nf-destructive-git-guard.js` -- a PreToolUse hook that detects destructive git commands and emits a stderr warning when uncommitted changes exist. Follow the exact patterns from `nf-circuit-breaker.js`:

- `'use strict'` at top
- CommonJS require
- `require('./config-loader')` for `loadConfig`, `shouldRunHook`, `validateHookInput`
- Profile guard pattern (check `shouldRunHook('nf-destructive-git-guard', profile)`)
- Fail-open: try/catch wrapping entire main, `process.exit(0)` on any error
- Read stdin JSON, parse PreToolUse event
- Hook stdout is decision channel -- debug output goes to stderr only

Detection logic:
1. Extract `tool_name` and `tool_input` from the event. Only act when `tool_name === 'Bash'` (or `bash`).
2. Extract the command string from `tool_input.command`.
3. Match against destructive git regex: `/^\s*git\s+(stash|checkout\s+--\s+\.|reset\s+--hard|clean\s+-f)/`
4. Also match: `/^\s*git\s+checkout\s+--\s+\S/` (targeted file checkout)
5. If a destructive command is detected:
   a. Run `git status --porcelain` to check for uncommitted changes
   b. If uncommitted changes exist, emit a stderr warning: `[nf] WARNING: Destructive git operation detected ('git stash' / 'git reset --hard' / etc.) with uncommitted changes. Consider committing first to avoid losing completed work.`
   c. Do NOT block -- always allow the tool call through (warn-only, same as the preemptive evidence check in circuit-breaker)
6. If no uncommitted changes, exit silently (the operation is safe).

The hook MUST NOT write any decision to stdout for the warn-only case -- just stderr warning and exit(0). This means the tool call proceeds unblocked.

Create `hooks/nf-destructive-git-guard.test.js` using vitest patterns matching existing test files (e.g., `nf-console-guard.test.js`). Tests:

1. Empty stdin -> exits 0 (fail-open)
2. Non-Bash tool -> exits 0 (no action)
3. Read-only git command (git log) -> exits 0
4. `git stash` with clean working tree -> exits 0, no stderr warning
5. `git stash` with dirty working tree -> exits 0 with stderr warning containing "Destructive git operation"
6. `git reset --hard` with dirty tree -> exits 0 with stderr warning
7. `git checkout -- .` with dirty tree -> exits 0 with stderr warning

For tests that check dirty/clean tree: mock `spawnSync` to control `git status --porcelain` output. Follow the mocking patterns from existing hook tests.
  </action>
  <verify>
```bash
npx vitest run hooks/nf-destructive-git-guard.test.js
```
All tests pass. Also verify the hook runs without error on empty input:
```bash
echo '{}' | node hooks/nf-destructive-git-guard.js; echo "exit: $?"
```
Should exit 0.
  </verify>
  <done>Hook file exists with destructive git detection regex, stderr-only warning, fail-open pattern. Test file has 7+ test cases covering fail-open, no-op, and warning scenarios. All tests pass.</done>
</task>

<task type="auto">
  <name>Task 3: Register hook in install.js, add to build-hooks, sync to dist</name>
  <files>bin/install.js, scripts/build-hooks.js, hooks/dist/nf-destructive-git-guard.js, hooks/dist/nf-destructive-git-guard.test.js</files>
  <action>
Three integration steps:

1. **Register in bin/install.js**: Add a `buildHookCommand` entry for `nf-destructive-git-guard` in the PreToolUse hooks section. Follow the exact pattern of the existing `nf-circuit-breaker` registration. The hook should be registered for the `PreToolUse` event. Set priority to `Normal` (50) -- this is advisory, not critical path.

2. **Add to scripts/build-hooks.js**: Add `'nf-destructive-git-guard.js'` to the `HOOKS_TO_COPY` array, alongside the other nf-* hooks.

3. **Sync to dist**: Copy both files:
```bash
cp hooks/nf-destructive-git-guard.js hooks/dist/
cp hooks/nf-destructive-git-guard.test.js hooks/dist/
```

4. **Run build-hooks**: `node scripts/build-hooks.js` to verify the copy pipeline works.

5. **Run install** (dry verification only): `node bin/install.js --claude --global` to verify the hook is registered without errors.

6. **Run verify-hooks-sync**: `node scripts/verify-hooks-sync.cjs` to confirm no drift.

Do NOT add to OLD_HOOK_MAP (that is for migration cleanup of renamed hooks only).
  </action>
  <verify>
```bash
grep 'nf-destructive-git-guard' bin/install.js
grep 'nf-destructive-git-guard' scripts/build-hooks.js
node scripts/verify-hooks-sync.cjs
diff hooks/nf-destructive-git-guard.js hooks/dist/nf-destructive-git-guard.js
npm test
```
All commands succeed. grep finds matches. verify-hooks-sync passes. diff shows no differences. npm test passes (no regressions).
  </verify>
  <done>Hook is registered in install.js for PreToolUse event, listed in HOOKS_TO_COPY, synced to dist, verify-hooks-sync passes, full test suite passes.</done>
</task>

</tasks>

<verification>
- `grep -c "Destructive Operations Guard" .claude/rules/git-workflow.md` returns 1
- `grep -c "Validate Before Apply" .claude/rules/coding-style.md` returns 1
- `npx vitest run hooks/nf-destructive-git-guard.test.js` passes all tests
- `node scripts/verify-hooks-sync.cjs` exits 0
- `npm test` passes with no regressions
- `grep 'nf-destructive-git-guard' bin/install.js` finds the registration
</verification>

<success_criteria>
Three concrete improvements implemented from session insights: (1) CLAUDE.md rules preventing commit-before-destructive-ops violations and validate-before-apply gaps, (2) a PreToolUse hook that warns on destructive git operations when uncommitted changes exist, (3) the hook is fully integrated into the install/build/dist pipeline with tests.
</success_criteria>

<output>
After completion, create `.planning/quick/222-use-those-insights-to-recommend-improvem/222-SUMMARY.md`
</output>
