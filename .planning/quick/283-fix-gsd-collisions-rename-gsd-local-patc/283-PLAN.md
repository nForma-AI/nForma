---
phase: quick-283
plan: 283
type: execute
wave: 1
depends_on: []
files_modified:
  - hooks/gsd-context-monitor.js -> hooks/nf-context-monitor.js
  - hooks/gsd-context-monitor.test.js -> hooks/nf-context-monitor.test.js
  - hooks/dist/gsd-context-monitor.js -> hooks/dist/nf-context-monitor.js
  - hooks/dist/gsd-context-monitor.test.js -> hooks/dist/nf-context-monitor.test.js
  - hooks/config-loader.js
  - hooks/dist/config-loader.js
  - bin/install.js
  - commands/nf/reapply-patches.md
autonomous: true
formal_artifacts: none

must_haves:
  truths:
    - "No file or string reference to 'gsd-context-monitor' remains in hooks/, bin/install.js, or commands/"
    - "No file or string reference to 'gsd-local-patches' remains in bin/install.js or commands/nf/reapply-patches.md"
    - "Old gsd-context-monitor hook name is in OLD_HOOK_MAP for migration cleanup"
    - "Hook tests pass after rename"
    - "Install succeeds after all changes"
  artifacts:
    - path: "hooks/nf-context-monitor.js"
      provides: "Renamed context monitor hook"
    - path: "hooks/nf-context-monitor.test.js"
      provides: "Renamed test file"
    - path: "hooks/dist/nf-context-monitor.js"
      provides: "Dist copy of renamed hook"
    - path: "hooks/dist/nf-context-monitor.test.js"
      provides: "Dist copy of renamed test"
  key_links:
    - from: "bin/install.js"
      to: "hooks/dist/nf-context-monitor.js"
      via: "DEFAULT_HOOK_PRIORITIES and PostToolUse hook wiring"
      pattern: "nf-context-monitor"
    - from: "hooks/config-loader.js"
      to: "nf-context-monitor"
      via: "HOOK_NAMES and DEFAULT_PRIORITIES maps"
      pattern: "nf-context-monitor"
---

<objective>
Rename the last two GSD-prefixed identifiers to nf-prefixed equivalents:
1. `gsd-local-patches` directory name constant -> `nf-local-patches`
2. `gsd-context-monitor` hook files and references -> `nf-context-monitor`

Purpose: Complete the rebrand from GSD to nF naming. These two collisions were missed in the original rebrand (quick-186).
Output: Renamed hook files, updated references in install.js/config-loader/reapply-patches, migration entry in OLD_HOOK_MAP.
</objective>

<execution_context>
@/Users/jonathanborduas/.claude/nf/workflows/execute-plan.md
@/Users/jonathanborduas/.claude/nf/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@hooks/gsd-context-monitor.js
@hooks/gsd-context-monitor.test.js
@hooks/config-loader.js
@bin/install.js
@commands/nf/reapply-patches.md
</context>

<tasks>

<task type="auto">
  <name>Task 1: Rename gsd-context-monitor files and update all internal references</name>
  <files>
    hooks/nf-context-monitor.js (new, from rename)
    hooks/nf-context-monitor.test.js (new, from rename)
    hooks/dist/nf-context-monitor.js (new, from rename)
    hooks/dist/nf-context-monitor.test.js (new, from rename)
    hooks/config-loader.js
    hooks/dist/config-loader.js
  </files>
  <action>
    1. **Rename hook files** using `git mv` (preserves history):
       - `git mv hooks/gsd-context-monitor.js hooks/nf-context-monitor.js`
       - `git mv hooks/gsd-context-monitor.test.js hooks/nf-context-monitor.test.js`
       - `git mv hooks/dist/gsd-context-monitor.js hooks/dist/nf-context-monitor.js`
       - `git mv hooks/dist/gsd-context-monitor.test.js hooks/dist/nf-context-monitor.test.js`

    2. **Update internal references in renamed files:**
       - In `hooks/nf-context-monitor.js`: Replace all `gsd-context-monitor` strings with `nf-context-monitor` (comment header line 2, warning message line 88, shouldRunHook call line 95, malformed JSON warning line 263)
       - In `hooks/nf-context-monitor.test.js`: Replace all `gsd-context-monitor` strings with `nf-context-monitor` (comment header lines 2-3, HOOK_PATH reference line 17)
       - In `hooks/dist/nf-context-monitor.js`: Same replacements as source
       - In `hooks/dist/nf-context-monitor.test.js`: Same replacements as source

    3. **Update config-loader.js** (both hooks/ and hooks/dist/):
       - Line 50: `'gsd-context-monitor'` -> `'nf-context-monitor'` (in HOOK_NAMES array)
       - Line 68: `'gsd-context-monitor'` -> `'nf-context-monitor'` (in another HOOK_NAMES array)
       - Line 95: `'gsd-context-monitor': 50` -> `'nf-context-monitor': 50` (in DEFAULT_PRIORITIES)
  </action>
  <verify>
    - `grep -r 'gsd-context-monitor' hooks/` returns NO matches
    - `node --test hooks/nf-context-monitor.test.js` passes
    - `node --test hooks/config-loader.test.js` passes
  </verify>
  <done>
    All hook files renamed from gsd-context-monitor to nf-context-monitor. All internal string references updated. No gsd-context-monitor references remain in hooks/ directory. Tests pass.
  </done>
</task>

<task type="auto">
  <name>Task 2: Update install.js references and add migration entry, rename patches constant</name>
  <files>
    bin/install.js
    commands/nf/reapply-patches.md
  </files>
  <action>
    **Part A — gsd-context-monitor references in install.js:**

    1. Line 34 `DEFAULT_HOOK_PRIORITIES`: Change `'gsd-context-monitor': 50` to `'nf-context-monitor': 50`
    2. Line 1354: Change the filter string from `'gsd-context-monitor'` to `'nf-context-monitor'`
    3. Line 2236: Change the `.includes('gsd-context-monitor')` check to `.includes('nf-context-monitor')`
    4. Line 2240: Change `buildHookCommand(targetDir, 'gsd-context-monitor.js')` to `buildHookCommand(targetDir, 'nf-context-monitor.js')`
    5. **Add old name to OLD_HOOK_MAP** (line ~2144): The PostToolUse entry currently has `['qgsd-spec-regen', 'qgsd-context-monitor']`. Add `'gsd-context-monitor'` to this array so old hook entries get cleaned up during migration:
       `PostToolUse: ['qgsd-spec-regen', 'qgsd-context-monitor', 'gsd-context-monitor'],`

    **Part B — gsd-local-patches rename:**

    6. Line 1729: Change `const PATCHES_DIR_NAME = 'gsd-local-patches'` to `const PATCHES_DIR_NAME = 'nf-local-patches'`
    7. Lines 1793, 1824, 1850: Update any comment or console.log strings that say `gsd-local-patches` to `nf-local-patches`

    **Part C — reapply-patches.md:**

    8. In `commands/nf/reapply-patches.md`, update ALL references:
       - Line 18: `PATCHES_DIR=~/.claude/gsd-local-patches` -> `PATCHES_DIR=~/.claude/nf-local-patches`
       - Line 21: `./.claude/gsd-local-patches` -> `./.claude/nf-local-patches`
       - Line 55: `gsd-local-patches/` -> `nf-local-patches/`
       - Line 86: `gsd-local-patches/` -> `nf-local-patches/`
       - Line 87: `gsd-local-patches/` -> `nf-local-patches/`
  </action>
  <verify>
    - `grep -n 'gsd-context-monitor' bin/install.js` returns NO matches
    - `grep -n 'gsd-local-patches' bin/install.js` returns NO matches
    - `grep -n 'gsd-local-patches' commands/nf/reapply-patches.md` returns NO matches
    - `grep 'gsd-context-monitor' bin/install.js` in OLD_HOOK_MAP section DOES still have it (that is correct — old names must remain in OLD_HOOK_MAP for migration cleanup)
    - Wait — clarification: the OLD_HOOK_MAP entry uses `'qgsd-context-monitor'` (with q prefix), not `'gsd-context-monitor'`. We are ADDING `'gsd-context-monitor'` as a new entry. So verify: `grep "gsd-context-monitor" bin/install.js` should match ONLY inside the OLD_HOOK_MAP array (1 match).
  </verify>
  <done>
    install.js wires nf-context-monitor (not gsd-context-monitor). OLD_HOOK_MAP includes gsd-context-monitor for migration. PATCHES_DIR_NAME is nf-local-patches. reapply-patches.md references nf-local-patches throughout.
  </done>
</task>

<task type="auto">
  <name>Task 3: Sync dist and run installer</name>
  <files>
    hooks/dist/config-loader.js
    hooks/dist/nf-context-monitor.js
  </files>
  <action>
    1. Ensure hooks/dist/ copies are in sync:
       - `cp hooks/config-loader.js hooks/dist/config-loader.js`
       - `cp hooks/nf-context-monitor.js hooks/dist/nf-context-monitor.js`
       - `cp hooks/nf-context-monitor.test.js hooks/dist/nf-context-monitor.test.js`
       (The git mv in Task 1 already handled the dist rename, but ensure content is identical to source)

    2. Run the installer to propagate changes:
       `node bin/install.js --claude --global`

    3. Verify no gsd-context-monitor hook remains in installed settings:
       `grep -r 'gsd-context-monitor' ~/.claude/settings.json` should return NO matches
       `grep -r 'nf-context-monitor' ~/.claude/settings.json` should return a match

    4. Final sweep — confirm no gsd-context-monitor or gsd-local-patches references remain in active code:
       `grep -rn 'gsd-context-monitor' hooks/ bin/install.js commands/` — should return ONLY the OLD_HOOK_MAP entry in install.js
       `grep -rn 'gsd-local-patches' bin/install.js commands/` — should return NO matches
  </action>
  <verify>
    - `node bin/install.js --claude --global` exits 0
    - `grep 'gsd-context-monitor' ~/.claude/settings.json` returns NO matches
    - `grep 'nf-context-monitor' ~/.claude/settings.json` returns a match
    - `grep -rn 'gsd-local-patches' bin/install.js commands/nf/reapply-patches.md` returns 0 matches
    - `node --test hooks/nf-context-monitor.test.js` passes
  </verify>
  <done>
    Dist files synced. Installer ran successfully. Installed hooks reference nf-context-monitor. No stale gsd-* references remain in active code paths. Rebrand collision fully resolved.
  </done>
</task>

</tasks>

<verification>
- `grep -rn 'gsd-context-monitor' hooks/ bin/install.js commands/ hooks/dist/` returns ONLY the OLD_HOOK_MAP migration entry
- `grep -rn 'gsd-local-patches' bin/install.js commands/` returns 0 matches
- `node --test hooks/nf-context-monitor.test.js` passes
- `node --test hooks/config-loader.test.js` passes
- `node bin/install.js --claude --global` exits 0
- `ls hooks/gsd-context-monitor*` returns "No such file"
</verification>

<success_criteria>
1. Zero references to gsd-context-monitor in hooks/, commands/, or bin/install.js (except OLD_HOOK_MAP migration entry)
2. Zero references to gsd-local-patches in bin/install.js or commands/nf/reapply-patches.md
3. Hook files renamed to nf-context-monitor with all internal strings updated
4. OLD_HOOK_MAP includes gsd-context-monitor for migration cleanup of existing installs
5. Installer runs clean and installs nf-context-monitor hook
6. All hook tests pass
</success_criteria>

<output>
After completion, create `.planning/quick/283-fix-gsd-collisions-rename-gsd-local-patc/SUMMARY.md`
</output>
