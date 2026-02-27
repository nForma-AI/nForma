---
phase: quick-114
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - .planning/phases/v0.15-01-health-checker-regex-fix/v0.15-01-01-PLAN.md
autonomous: true
requirements: [QUICK-114]

must_haves:
  truths:
    - "The objective line no longer says 'five' — it says '6'"
    - "The Output line no longer says '5 regex literals replaced, 6th site' — it says '6 regex sites replaced'"
    - "No other content in v0.15-01-01-PLAN.md is changed"
  artifacts:
    - path: ".planning/phases/v0.15-01-health-checker-regex-fix/v0.15-01-01-PLAN.md"
      provides: "Corrected objective and output description"
      contains: "6 regex"
  key_links:
    - from: "objective block line 51"
      to: "accurate site count"
      via: "text edit"
      pattern: "Fix 6 regex"
---

<objective>
Correct the objective line and output description in v0.15-01-01-PLAN.md to say "6 regex sites" instead of "five regex literals" / "5 regex literals".

Purpose: The plan's own task list (Task 2) documents 6 distinct regex replacement sites (Sites 1-6 covering lines 3781, 3788, 3613, 3625, 3833, 3863). The objective paragraph contradicts this by saying "five" and the Output line calls out the 6th site as an afterthought. Both should simply say "6".

Output: Updated PLAN.md with accurate counts.
</objective>

<execution_context>
@/Users/jonathanborduas/.claude/qgsd/workflows/execute-plan.md
@/Users/jonathanborduas/.claude/qgsd/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@.planning/phases/v0.15-01-health-checker-regex-fix/v0.15-01-01-PLAN.md
</context>

<tasks>

<task type="auto">
  <name>Task 1: Fix "five" to "6" in objective and output lines</name>
  <files>.planning/phases/v0.15-01-health-checker-regex-fix/v0.15-01-01-PLAN.md</files>
  <action>
Make exactly two targeted edits in `.planning/phases/v0.15-01-health-checker-regex-fix/v0.15-01-01-PLAN.md`:

**Edit 1 — Objective paragraph (currently line 51):**
Replace:
```
Fix five regex literals in `qgsd-core/bin/gsd-tools.cjs` that use GSD's legacy `NN-name` numeric phase naming, causing 64 false-positive warnings when run against the QGSD repo which uses `v0.X-YY-name` versioned phase directories.
```
With:
```
Fix 6 regex sites in `qgsd-core/bin/gsd-tools.cjs` that use GSD's legacy `NN-name` numeric phase naming, causing 64 false-positive warnings when run against the QGSD repo which uses `v0.X-YY-name` versioned phase directories.
```

**Edit 2 — Output line (currently line 55):**
Replace:
```
Output: Fixed `gsd-tools.cjs` (5 regex literals replaced, 6th site in `cmdValidateConsistency` also fixed), 4 new passing tests in `gsd-tools.test.cjs`, installed copy synced.
```
With:
```
Output: Fixed `gsd-tools.cjs` (6 regex sites replaced across `cmdValidateHealth` and `cmdValidateConsistency`), 4 new passing tests in `gsd-tools.test.cjs`, installed copy synced.
```

No other lines should be modified.
  </action>
  <verify>
```bash
grep -n "regex" /Users/jonathanborduas/code/QGSD/.planning/phases/v0.15-01-health-checker-regex-fix/v0.15-01-01-PLAN.md | head -10
```
Expected: objective line contains "6 regex sites", output line contains "6 regex sites replaced". Neither contains "five" or "5 regex".
  </verify>
  <done>v0.15-01-01-PLAN.md objective says "6 regex sites"; output says "6 regex sites replaced"; no other content changed.</done>
</task>

</tasks>

<verification>
```bash
grep -n "five\|5 regex\|6 regex" /Users/jonathanborduas/code/QGSD/.planning/phases/v0.15-01-health-checker-regex-fix/v0.15-01-01-PLAN.md
```
Expected: two lines matching "6 regex", zero lines matching "five" or "5 regex".
</verification>

<success_criteria>
- Objective paragraph says "Fix 6 regex sites" (not "five regex literals")
- Output line says "6 regex sites replaced across `cmdValidateHealth` and `cmdValidateConsistency`"
- No other content in the file is modified
- File is committed
</success_criteria>

<output>
After completion, create `.planning/quick/114-fix-objective-line-in-v0-15-01-01-plan-m/114-SUMMARY.md`
</output>
