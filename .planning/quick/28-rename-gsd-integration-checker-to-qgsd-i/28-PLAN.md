---
phase: quick-28
plan: 28
type: execute
wave: 1
depends_on: []
files_modified:
  - get-shit-done/bin/gsd-tools.cjs
  - ~/.claude/qgsd/bin/gsd-tools.cjs
autonomous: true
requirements: [QUICK-28]
must_haves:
  truths:
    - "MODEL_PROFILES in source gsd-tools.cjs uses key 'qgsd-integration-checker'"
    - "MODEL_PROFILES in installed gsd-tools.cjs uses key 'qgsd-integration-checker'"
    - "No occurrence of 'gsd-integration-checker' remains in either file"
  artifacts:
    - path: "get-shit-done/bin/gsd-tools.cjs"
      provides: "MODEL_PROFILES with renamed key"
      contains: "qgsd-integration-checker"
    - path: "~/.claude/qgsd/bin/gsd-tools.cjs"
      provides: "Installed MODEL_PROFILES with renamed key"
      contains: "qgsd-integration-checker"
  key_links:
    - from: "get-shit-done/bin/gsd-tools.cjs"
      to: "~/.claude/qgsd/bin/gsd-tools.cjs"
      via: "identical MODEL_PROFILES key"
      pattern: "qgsd-integration-checker"
---

<objective>
Rename the MODEL_PROFILES key from 'gsd-integration-checker' to 'qgsd-integration-checker' in both the source and installed gsd-tools.cjs files to complete the QGSD namespace migration.

Purpose: Eliminates the last stale gsd- prefixed key in MODEL_PROFILES, keeping the namespace consistent with the QGSD rebranding.
Output: Both files updated with 'qgsd-integration-checker' at line 149.
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
  <name>Task 1: Rename key in source gsd-tools.cjs</name>
  <files>get-shit-done/bin/gsd-tools.cjs</files>
  <action>
    In /Users/jonathanborduas/code/QGSD/get-shit-done/bin/gsd-tools.cjs at line 149, change:
      'gsd-integration-checker':  { quality: 'sonnet', balanced: 'sonnet', budget: 'haiku' },
    to:
      'qgsd-integration-checker': { quality: 'sonnet', balanced: 'sonnet', budget: 'haiku' },

    Only change the key string. Do not alter the value object, whitespace alignment, or any other line.
  </action>
  <verify>grep -n 'integration-checker' /Users/jonathanborduas/code/QGSD/get-shit-done/bin/gsd-tools.cjs</verify>
  <done>Output shows 'qgsd-integration-checker' at line 149 and zero occurrences of 'gsd-integration-checker'.</done>
</task>

<task type="auto">
  <name>Task 2: Rename key in installed gsd-tools.cjs (disk-only)</name>
  <files>~/.claude/qgsd/bin/gsd-tools.cjs</files>
  <action>
    In ~/.claude/qgsd/bin/gsd-tools.cjs at line 149, change:
      'gsd-integration-checker':  { quality: 'sonnet', balanced: 'sonnet', budget: 'haiku' },
    to:
      'qgsd-integration-checker': { quality: 'sonnet', balanced: 'sonnet', budget: 'haiku' },

    This is a disk-only update (installed file, outside git repo) — consistent with project convention for ~/.claude/qgsd/ files per Phase 17 precedent. No git commit for this file.
  </action>
  <verify>grep -n 'integration-checker' ~/.claude/qgsd/bin/gsd-tools.cjs</verify>
  <done>Output shows 'qgsd-integration-checker' at line 149 and zero occurrences of 'gsd-integration-checker'.</done>
</task>

</tasks>

<verification>
After both tasks:
  grep 'gsd-integration-checker' /Users/jonathanborduas/code/QGSD/get-shit-done/bin/gsd-tools.cjs ~/.claude/qgsd/bin/gsd-tools.cjs

Expected: no output (zero matches in either file).

  grep 'qgsd-integration-checker' /Users/jonathanborduas/code/QGSD/get-shit-done/bin/gsd-tools.cjs ~/.claude/qgsd/bin/gsd-tools.cjs

Expected: one match per file at line 149.
</verification>

<success_criteria>
- 'gsd-integration-checker' does not appear in either file
- 'qgsd-integration-checker' appears exactly once in each file at line 149
- All other MODEL_PROFILES entries are unchanged
</success_criteria>

<output>
After completion, create `.planning/quick/28-rename-gsd-integration-checker-to-qgsd-i/28-SUMMARY.md` with what was changed and verification output.

Commit source file only:
  node /Users/jonathanborduas/.claude/get-shit-done/bin/gsd-tools.cjs commit "feat(quick-28): rename gsd-integration-checker to qgsd-integration-checker in MODEL_PROFILES" --files get-shit-done/bin/gsd-tools.cjs
</output>
