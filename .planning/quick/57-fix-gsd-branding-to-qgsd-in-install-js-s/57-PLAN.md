---
phase: quick-57
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - bin/install.js
  - get-shit-done/workflows/quick.md
autonomous: true
requirements: []
must_haves:
  truths:
    - "The statusline prompt in install.js reads 'QGSD includes a statusline' and 'Replace with QGSD statusline'"
    - "The quick task completion banners in get-shit-done/workflows/quick.md read 'QGSD > QUICK TASK COMPLETE'"
  artifacts:
    - path: "bin/install.js"
      provides: "Installer with corrected QGSD branding in statusline prompt"
      contains: "QGSD includes a statusline"
    - path: "get-shit-done/workflows/quick.md"
      provides: "Quick workflow with corrected QGSD completion banners"
      contains: "QGSD > QUICK TASK COMPLETE"
  key_links:
    - from: "get-shit-done/workflows/quick.md"
      to: "~/.claude/qgsd/workflows/quick.md"
      via: "install.js copyWithPathReplacement (get-shit-done/ -> qgsd/)"
      pattern: "QGSD > QUICK TASK COMPLETE"
---

<objective>
Fix residual "GSD" branding in two locations where it should read "QGSD":

1. The statusline conflict prompt in bin/install.js (lines 1977, 1983)
2. The quick task completion banners in get-shit-done/workflows/quick.md (lines 340, 440)

Purpose: Consistent QGSD branding throughout the installer UI and workflow output.
Output: Updated bin/install.js and get-shit-done/workflows/quick.md with corrected strings.
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
  <name>Task 1: Fix GSD branding in install.js statusline prompt</name>
  <files>bin/install.js</files>
  <action>
    In bin/install.js, find the statusline conflict prompt block (around line 1972-1984).
    Make exactly two string replacements:

    Line 1977: Change
      `  GSD includes a statusline showing:`
    to
      `  QGSD includes a statusline showing:`

    Line 1983: Change
      `  ${cyan}2${reset}) Replace with GSD statusline`
    to
      `  ${cyan}2${reset}) Replace with QGSD statusline`

    Do not touch any other lines. These are the only two "GSD" occurrences in this block.
    All other "GSD" references in the file (comments, uninstall messages, internal variable names)
    are intentional references to upstream GSD or legacy cleanup — leave them unchanged.
  </action>
  <verify>
    grep -n "GSD includes\|Replace with GSD\|QGSD includes\|Replace with QGSD" /Users/jonathanborduas/code/QGSD/bin/install.js
    Expected output shows lines 1977 and 1983 with "QGSD", not "GSD".
  </verify>
  <done>
    bin/install.js contains "QGSD includes a statusline showing:" and "Replace with QGSD statusline"
    at the statusline prompt. No "GSD includes" or "Replace with GSD statusline" remains.
  </done>
</task>

<task type="auto">
  <name>Task 2: Fix GSD completion banners in quick.md</name>
  <files>get-shit-done/workflows/quick.md</files>
  <action>
    In get-shit-done/workflows/quick.md, find the two completion banner blocks.
    Make exactly two string replacements:

    Line 340: Change
      `GSD > QUICK TASK COMPLETE`
    to
      `QGSD > QUICK TASK COMPLETE`

    Line 440: Change
      `GSD > QUICK TASK COMPLETE (FULL MODE)`
    to
      `QGSD > QUICK TASK COMPLETE (FULL MODE)`

    The other "GSD" occurrences in this file (line 2: "GSD guarantees", line 273:
    "GSD_DECISION" HTML comment token) are intentional — leave them unchanged.
    "GSD guarantees" refers to the upstream GSD system property; "GSD_DECISION" is
    a machine-readable token used by quorum hooks.
  </action>
  <verify>
    grep -n "GSD > QUICK TASK\|QGSD > QUICK TASK" /Users/jonathanborduas/code/QGSD/get-shit-done/workflows/quick.md
    Expected: two lines both reading "QGSD > QUICK TASK COMPLETE" (with and without FULL MODE).
  </verify>
  <done>
    get-shit-done/workflows/quick.md contains "QGSD > QUICK TASK COMPLETE" and
    "QGSD > QUICK TASK COMPLETE (FULL MODE)" — no bare "GSD > QUICK TASK" lines remain.
  </done>
</task>

</tasks>

<verification>
After both tasks complete:

1. grep -n "GSD includes\|Replace with GSD statusline" bin/install.js
   → No matches (all occurrences corrected to QGSD)

2. grep -n "^GSD > QUICK TASK" get-shit-done/workflows/quick.md
   → No matches (all corrected to QGSD)

3. grep -n "QGSD includes\|Replace with QGSD\|QGSD > QUICK TASK" bin/install.js get-shit-done/workflows/quick.md
   → Shows 4 matches total: 2 in install.js, 2 in quick.md
</verification>

<success_criteria>
- "QGSD includes a statusline showing:" appears in bin/install.js statusline prompt
- "Replace with QGSD statusline" appears in bin/install.js statusline menu option
- "QGSD > QUICK TASK COMPLETE" appears in get-shit-done/workflows/quick.md (non-full-mode banner)
- "QGSD > QUICK TASK COMPLETE (FULL MODE)" appears in get-shit-done/workflows/quick.md (full-mode banner)
- Intentional upstream "GSD" references (GSD guarantees, GSD_DECISION token, uninstall messages) left unchanged
</success_criteria>

<output>
After completion, create `.planning/quick/57-fix-gsd-branding-to-qgsd-in-install-js-s/57-SUMMARY.md`
</output>
