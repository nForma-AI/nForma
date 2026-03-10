---
phase: quick-266
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - core/bin/gsd-tools.cjs
  - core/workflows/quick.md
  - core/references/planning-config.md
  - core/workflows/settings.md
autonomous: true
formal_artifacts: none
must_haves:
  truths:
    - "Running `init quick` on a protected branch returns `is_protected: true` and a computed `quick_branch_name`"
    - "Running `init quick` on a feature branch returns `is_protected: false` and `quick_branch_name: null`"
    - "The quick workflow creates a new branch when on a protected branch and --no-branch is not set"
    - "The quick workflow skips branch creation when --no-branch flag is passed"
    - "The quick workflow commits directly when already on a feature branch"
    - "Config fields `git.additional_protected_branches` and `git.quick_branch_template` are documented and configurable"
  artifacts:
    - path: "core/bin/gsd-tools.cjs"
      provides: "Protected branch detection and quick_branch_name computation in cmdInitQuick"
      contains: "is_protected"
    - path: "core/workflows/quick.md"
      provides: "Step 2.5 branching logic and --no-branch flag parsing"
      contains: "no-branch"
    - path: "core/references/planning-config.md"
      provides: "Documentation for additional_protected_branches and quick_branch_template"
      contains: "additional_protected_branches"
    - path: "core/workflows/settings.md"
      provides: "New config fields in settings display"
      contains: "additional_protected_branches"
  key_links:
    - from: "core/bin/gsd-tools.cjs"
      to: "core/workflows/quick.md"
      via: "init quick JSON output consumed by workflow Step 2"
      pattern: "is_protected.*quick_branch_name"
    - from: "core/references/planning-config.md"
      to: "core/bin/gsd-tools.cjs"
      via: "config schema documents fields loaded by loadConfig"
      pattern: "additional_protected_branches"
---

<objective>
Add smart branch management to the quick workflow so that running `/nf:quick` on a protected branch (main, master, or user-configured) automatically creates a feature branch `nf/quick-{number}-{slug}`, while committing directly on existing feature branches. Includes `--no-branch` escape hatch.

Purpose: Prevent accidental commits to protected branches during quick tasks, matching standard git workflow expectations.
Output: Updated gsd-tools.cjs with branch detection, updated quick.md workflow with branching step, updated config docs and settings.
</objective>

<execution_context>
@/Users/jonathanborduas/.claude/nf/workflows/execute-plan.md
@/Users/jonathanborduas/.claude/nf/templates/summary.md
</execution_context>

<context>
@core/bin/gsd-tools.cjs
@core/workflows/quick.md
@core/references/planning-config.md
@core/workflows/settings.md
</context>

<tasks>

<task type="auto">
  <name>Task 1: Add branch detection to gsd-tools.cjs and config fields</name>
  <files>core/bin/gsd-tools.cjs</files>
  <action>
**1a. Add config defaults** (in the `defaults` object at ~line 174):

Add two new fields after `milestone_branch_template`:
- `additional_protected_branches: []`
- `quick_branch_template: 'nf/quick-{number}-{slug}'`

**1b. Add config loading** (in the `return` block of `loadConfig` at ~line 211):

Add two new fields after `milestone_branch_template`:
- `additional_protected_branches: get('additional_protected_branches', { section: 'git', field: 'additional_protected_branches' }) ?? defaults.additional_protected_branches`
- `quick_branch_template: get('quick_branch_template', { section: 'git', field: 'quick_branch_template' }) ?? defaults.quick_branch_template`

**1c. Add branch detection to `cmdInitQuick`** (at ~line 4803, before the `result` object construction):

Detect current branch using `execSync('git rev-parse --abbrev-ref HEAD', { cwd, encoding: 'utf-8' }).trim()` wrapped in try/catch (fallback to `'unknown'`).

Detect remote default branch using `execSync('git symbolic-ref refs/remotes/origin/HEAD', { cwd, encoding: 'utf-8' }).trim().replace('refs/remotes/origin/', '')` wrapped in try/catch (fallback to `null`).

Build protected branches set: combine `defaultBranch` (or fallback to `['main', 'master']` if null) with `config.additional_protected_branches`, deduplicate via `Set`.

Check if `currentBranch` matches any protected pattern. For entries containing `*`, convert to regex (`*` becomes `.*`). Otherwise do exact string match.

Compute `quickBranchName`: if protected, use `config.quick_branch_template` with `{number}` replaced by `String(nextNum)` and `{slug}` replaced by `slug || 'task'`. If not protected, set to `null`.

Note: `execSync` is already imported and used throughout gsd-tools.cjs -- no new imports needed.

**1d. Add to the `result` object** (inside `cmdInitQuick`, ~line 4803):

Add these four fields:
- `current_branch: currentBranch`
- `is_protected: isProtected`
- `quick_branch_name: quickBranchName`
- `protected_branches: protectedBranches`
  </action>
  <verify>
Run: `node core/bin/gsd-tools.cjs init quick "test branch detection" --raw` and confirm the JSON output includes `current_branch`, `is_protected`, `quick_branch_name`, and `protected_branches` fields. On main branch, `is_protected` should be `true` and `quick_branch_name` should match pattern `nf/quick-{N}-test-branch-detection`.
  </verify>
  <done>
`cmdInitQuick` returns branch detection fields. `loadConfig` reads `additional_protected_branches` and `quick_branch_template` from config. Protected branch detection works for exact matches and glob patterns.
  </done>
</task>

<task type="auto">
  <name>Task 2: Add branching step to quick workflow and update docs</name>
  <files>core/workflows/quick.md, core/references/planning-config.md, core/workflows/settings.md</files>
  <action>
**2a. Update quick.md Step 1** -- add `--no-branch` flag parsing alongside `--full`:

In the "Parse `$ARGUMENTS`" section at the top of Step 1, add a bullet:
`- \`--no-branch\` flag -> store as $NO_BRANCH (default: false)`

**2b. Update quick.md Step 2** -- add to the init JSON parse list:
Add `current_branch`, `is_protected`, `quick_branch_name`, `protected_branches` to the fields parsed from the init JSON.

**2c. Add new Step 2.5** between Step 2 (Initialize) and Step 3 (Create task directory):

Title: `**Step 2.5: Handle branching (smart default)**`

Content:
- Parse from init JSON: `current_branch`, `is_protected`, `quick_branch_name`, `protected_branches`.
- If `$NO_BRANCH` is true: skip branching. Report "Branch creation skipped (--no-branch)."
- If `is_protected` is true AND `$NO_BRANCH` is false: run `git checkout -b "${quick_branch_name}"`. Report with a `::` prefix showing the protected branch and the created branch name. Store `$CREATED_BRANCH = quick_branch_name`.
- If `is_protected` is false: report "On feature branch ${current_branch} -- committing here." Store `$CREATED_BRANCH = null`.

Add a `---` separator before Step 3.

**2d. Update completion banners** in both the non-full banner (~line 479) and the full-mode banner (~line 802):

Add after the Commit line:
```
Branch: ${CREATED_BRANCH || current_branch}
${CREATED_BRANCH ? '-> Ready for PR' : ''}
```

**2e. Update core/references/planning-config.md**:

In the `config_schema` JSON block, add to the `"git"` object:
```json
"additional_protected_branches": [],
"quick_branch_template": "nf/quick-{number}-{slug}"
```

Add two rows to the config table:
- `git.additional_protected_branches` | `[]` | Extra branches to protect (supports `*` globs like `release/*`)
- `git.quick_branch_template` | `"nf/quick-{number}-{slug}"` | Branch name template for quick tasks

Add a new `<smart_branching_behavior>` section after `</branching_strategy_behavior>` documenting: how protected branch detection works (remote HEAD, fallback to main/master), the `--no-branch` escape hatch, template variables (`{number}`, `{slug}`), and glob support for `additional_protected_branches`.

**2f. Update core/workflows/settings.md**:

In the `config_flow` step's confirmation display table (the final table after `update_config`), add two rows:
- `Protected Branches` | `{list or "default (main/master)"}`
- `Quick Branch Template` | `{template}`

After the existing "Quick commands" section at the bottom, add:
```
Advanced git config (set in .planning/config.json):
- git.additional_protected_branches: ["develop", "release/*"]
- git.quick_branch_template: "nf/quick-{number}-{slug}"
```

Do NOT add new AskUserQuestion prompts for these -- they are power-user config fields.
  </action>
  <verify>
1. Read `core/workflows/quick.md` and confirm: `--no-branch` is parsed in Step 1, Step 2 parses branch fields, Step 2.5 exists with branching logic, completion banners include branch info.
2. Read `core/references/planning-config.md` and confirm: config table has `additional_protected_branches` and `quick_branch_template` rows, smart branching section exists.
3. Read `core/workflows/settings.md` and confirm: new fields mentioned in config display.
  </verify>
  <done>
Quick workflow parses `--no-branch`, creates branches on protected branches, commits directly on feature branches, and shows branch info in completion banners. Config reference documents new fields. Settings workflow mentions new fields.
  </done>
</task>

<task type="auto">
  <name>Task 3: Sync and install updated files</name>
  <files>core/workflows/quick.md, core/bin/gsd-tools.cjs, core/references/planning-config.md, core/workflows/settings.md</files>
  <action>
Sync the edited source files to their installed locations and re-run the installer. Per MEMORY.md, edits to workflow and bin source files MUST sync to installed locations.

Run these commands:
```bash
cp core/workflows/quick.md ~/.claude/nf/workflows/quick.md
cp core/workflows/settings.md ~/.claude/nf/workflows/settings.md
cp core/references/planning-config.md ~/.claude/nf/references/planning-config.md
cp core/bin/gsd-tools.cjs ~/.claude/nf/bin/gsd-tools.cjs
node bin/install.js --claude --global
```
  </action>
  <verify>
1. Run: `diff core/workflows/quick.md ~/.claude/nf/workflows/quick.md` -- should show no differences.
2. Run: `diff core/bin/gsd-tools.cjs ~/.claude/nf/bin/gsd-tools.cjs` -- should show no differences.
3. Run: `node ~/.claude/nf/bin/gsd-tools.cjs init quick "test install" --raw` -- should return valid JSON with branch detection fields.
  </verify>
  <done>
All modified files synced to installed locations. Installer completes without error. Installed gsd-tools.cjs returns branch detection fields from `init quick`.
  </done>
</task>

</tasks>

<verification>
- `node core/bin/gsd-tools.cjs init quick "test" --raw` returns JSON with `is_protected`, `current_branch`, `quick_branch_name`, `protected_branches`
- `core/workflows/quick.md` contains Step 2.5 with branching logic and `--no-branch` flag
- `core/references/planning-config.md` documents `additional_protected_branches` and `quick_branch_template`
- `core/workflows/settings.md` mentions the new config fields
- Installed files match source files (no drift)
</verification>

<success_criteria>
- Protected branch detection works via `git symbolic-ref` (no network) with fallback to main/master
- Config supports `git.additional_protected_branches` array with glob patterns
- Quick workflow auto-creates branch on protected branches, skips on feature branches
- `--no-branch` flag overrides branch creation
- Completion banner shows branch info
- All files synced and installed
</success_criteria>

<output>
After completion, create `.planning/quick/266-add-smart-branch-management-to-quick-wor/266-SUMMARY.md`
</output>
