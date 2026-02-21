---
phase: quick-10
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - docs/USER-GUIDE.md
  - README.md
  - CHANGELOG.md
autonomous: true
requirements: []

must_haves:
  truths:
    - "docs/USER-GUIDE.md Brownfield & Utilities table contains a row for /qgsd:quorum-test"
    - "README.md Utilities table contains a row for /qgsd:quorum-test"
    - "CHANGELOG.md header says 'All notable changes to QGSD' not 'GSD'"
    - "README.md prose references to the tool use 'QGSD' not 'GSD' (excluding: $GSD token badge, gsd/ branch template config values, gsd-* agent names, ~/.claude/commands/gsd/ filesystem paths, community port names)"
  artifacts:
    - path: "docs/USER-GUIDE.md"
      provides: "Updated Brownfield & Utilities table with /qgsd:quorum-test row"
      contains: "quorum-test"
    - path: "README.md"
      provides: "Updated Utilities table with /qgsd:quorum-test + fixed QGSD prose"
      contains: "quorum-test"
    - path: "CHANGELOG.md"
      provides: "Fixed header: All notable changes to QGSD"
      contains: "QGSD"
  key_links:
    - from: "README.md Utilities table"
      to: "commands/qgsd/quorum-test.md"
      via: "command existence"
      pattern: "qgsd:quorum-test"
---

<objective>
Sync all docs with the QGSD framework. Two concrete gaps:
1. /qgsd:quorum-test is missing from command reference tables in both USER-GUIDE.md and README.md
2. Multiple "GSD" prose references in README.md and CHANGELOG.md still use the old name

Purpose: Users reading the docs see the full, accurate command set. The tool is called QGSD in all user-facing prose.
</objective>

<tasks>

<task type="auto">
  <name>Task 1: Add /qgsd:quorum-test to command reference tables</name>
  <files>docs/USER-GUIDE.md, README.md</files>
  <action>
**docs/USER-GUIDE.md** — Brownfield & Utilities table (around line 191):

Add a new row for `/qgsd:quorum-test` after the `/qgsd:debug` row:

```
| `/qgsd:quorum-test` | Run multi-model quorum on a plan or verification artifact | During checkpoint:verify or manual plan review |
```

**README.md** — Utilities table (around line 507):

Add a new row for `/qgsd:quorum-test` after the `/qgsd:debug` row:

```
| `/qgsd:quorum-test` | Run multi-model quorum on a plan or verification artifact |
```

Also fix the two command descriptions in README.md that still say "GSD":
- Line 473: "Update GSD with changelog preview" → "Update QGSD with changelog preview"
- Line 474: "Join the GSD Discord community" → "Join the QGSD Discord community"
  </action>
  <verify>
    grep -n "quorum-test" /Users/jonathanborduas/code/QGSD/docs/USER-GUIDE.md | grep -v "^[0-9]*:.*│"
    grep -n "quorum-test" /Users/jonathanborduas/code/QGSD/README.md
    Both must return matches in the command table sections.
  </verify>
  <done>
    Both command reference tables list /qgsd:quorum-test with a description. Navigation table "Update" and "Discord" descriptions say QGSD.
  </done>
</task>

<task type="auto">
  <name>Task 2: Fix stale GSD prose in README.md and CHANGELOG.md</name>
  <files>README.md, CHANGELOG.md</files>
  <action>
**CHANGELOG.md** line 3:
- "All notable changes to GSD will be documented in this file." → "All notable changes to QGSD will be documented in this file."

**README.md** — Replace the following prose "GSD" occurrences with "QGSD" (tool name references only):

Lines to update (exact strings):
1. "GSD fixes that. It's the context engineering layer" → "QGSD fixes that. It's the context engineering layer"
2. "GSD evolves fast. Update periodically:" → "QGSD evolves fast. Update periodically:"
3. "GSD is designed for frictionless automation." → "QGSD is designed for frictionless automation."
4. "This is how GSD is intended to be used" → "This is how QGSD is intended to be used"
5. "Execute ad-hoc task with GSD guarantees" → "Execute ad-hoc task with QGSD guarantees"
6. "GSD stores project settings in" → "QGSD stores project settings in"
7. "Control how GSD handles branches" → "Control how QGSD handles branches"
8. "Commits to current branch (default GSD behavior)" → "Commits to current branch (default QGSD behavior)"
9. "At milestone completion, GSD offers squash merge" → "At milestone completion, QGSD offers squash merge"
10. "GSD's codebase mapping and analysis commands" → "QGSD's codebase mapping and analysis commands"
11. "GSD includes built-in protections against committing secrets" → "QGSD includes built-in protections against committing secrets"
12. "To remove GSD completely:" → "To remove QGSD completely:"
13. "This removes all GSD commands, agents, hooks, and settings" → "This removes all QGSD commands, agents, hooks, and settings"

Do NOT change:
- `$GSD Token` badge (line 13) — token name
- `gsd/phase-{phase}-{slug}` / `gsd/{milestone}-{slug}` — config value defaults in table
- `~/.claude/commands/gsd/` — filesystem path (actual install directory)
- `gsd-opencode`, `gsd-gemini` — community port project names
- "So I built GSD." (line 53) — historical origin story context, intentionally kept
  </action>
  <verify>
    grep -n "^All notable changes to GSD" /Users/jonathanborduas/code/QGSD/CHANGELOG.md
    # Must return no results (should now say QGSD)
    grep -n "All notable changes to QGSD" /Users/jonathanborduas/code/QGSD/CHANGELOG.md
    # Must return 1 result
    grep -n "GSD fixes that\|GSD evolves fast\|GSD is designed\|GSD is intended\|GSD guarantees\|GSD stores\|GSD handles\|default GSD\|milestone.*GSD\|GSD's codebase\|GSD includes\|remove GSD\|removes all GSD" /Users/jonathanborduas/code/QGSD/README.md
    # Must return no results
  </verify>
  <done>
    CHANGELOG.md says "QGSD". All 13 prose "GSD" tool-name references in README.md now say "QGSD". $GSD token badge, gsd/ branch templates, filesystem paths, and community port names unchanged.
  </done>
</task>

</tasks>

<verification>
After both tasks complete:
- grep -n "quorum-test" docs/USER-GUIDE.md — must return table row matches
- grep -n "quorum-test" README.md — must return table row match
- grep "All notable changes to QGSD" CHANGELOG.md — must match
- grep -c "GSD\b" README.md — count should be low (only intentional: "So I built GSD", $GSD badge, gsd/ templates, filesystem paths, community ports)
</verification>

<success_criteria>
A user reading the docs after this task sees: (1) /qgsd:quorum-test listed in all command reference tables, (2) consistent QGSD branding throughout prose, (3) CHANGELOG header says QGSD.
</success_criteria>

<output>
After completion, create `.planning/quick/10-review-all-docs-for-qgsd-framework-sync-/10-SUMMARY.md`
</output>
