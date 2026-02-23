---
phase: quick-63
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - .planning/phases/v0.7-03-wizard-composition-screen/v0.7-03-VERIFICATION.md
autonomous: true
requirements: []
gap_closure: true

must_haves:
  truths:
    - "~/.claude/commands/qgsd/mcp-setup.md contains Edit Quorum Composition (>= 4 occurrences)"
    - "REQUIREMENTS.md marks WIZ-08 and WIZ-09 as [x] complete"
    - "VERIFICATION.md status field reflects both gaps are closed"
  artifacts:
    - path: "~/.claude/commands/qgsd/mcp-setup.md"
      provides: "Runtime copy of mcp-setup wizard with Composition Screen content"
      contains: "Edit Quorum Composition"
    - path: ".planning/REQUIREMENTS.md"
      provides: "Requirement tracking with WIZ-08/09 marked complete"
      contains: "[x] **WIZ-08**"
    - path: ".planning/phases/v0.7-03-wizard-composition-screen/v0.7-03-VERIFICATION.md"
      provides: "Updated verification status"
      contains: "status: complete"
  key_links:
    - from: "commands/qgsd/mcp-setup.md (repo source)"
      to: "~/.claude/commands/qgsd/mcp-setup.md (runtime)"
      via: "node bin/install.js --claude --global"
      pattern: "Edit Quorum Composition"
---

<objective>
Close the two gaps identified in v0.7-03-VERIFICATION.md: (1) install sync to propagate composition screen content to the runtime copy, and (2) mark WIZ-08/09 complete in REQUIREMENTS.md.

Purpose: Phase v0.7-03 is verified 8/10 — these two gaps prevent the phase from being marked fully complete.
Output: Updated VERIFICATION.md confirming both gaps closed; no source code changes required.
</objective>

<execution_context>
@/Users/jonathanborduas/.claude/get-shit-done/workflows/execute-plan.md
@/Users/jonathanborduas/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@.planning/phases/v0.7-03-wizard-composition-screen/v0.7-03-VERIFICATION.md
</context>

<tasks>

<task type="auto">
  <name>Task 1: Confirm gap closure and update VERIFICATION.md</name>
  <files>.planning/phases/v0.7-03-wizard-composition-screen/v0.7-03-VERIFICATION.md</files>
  <action>
    Before making any changes, verify the current state of both gaps:

    Gap 1 — Install sync:
    - Run: grep -c "Edit Quorum Composition" ~/.claude/commands/qgsd/mcp-setup.md
    - Run: wc -l ~/.claude/commands/qgsd/mcp-setup.md
    - Expected: count >= 4, line count >= 1370

    If gap 1 is already closed (count >= 4): document as already resolved.
    If gap 1 is still open: run `node /Users/jonathanborduas/code/QGSD/bin/install.js --claude --global` then re-verify.

    Gap 2 — REQUIREMENTS.md:
    - Run: grep -n "WIZ-08\|WIZ-09" /Users/jonathanborduas/code/QGSD/.planning/REQUIREMENTS.md
    - Expected: lines 36-37 show [x], lines 93-94 show "Complete"

    If gap 2 is already closed ([x] present): document as already resolved.
    If gap 2 is still open: edit .planning/REQUIREMENTS.md — change lines 36-37 from `[ ]` to `[x]` for WIZ-08 and WIZ-09; change lines 93-94 from "Pending" to "Complete".

    After confirming both gaps are closed, update the VERIFICATION.md frontmatter:
    - Change `status: gaps_found` to `status: complete`
    - Change `score: 8/10 must-haves verified` to `score: 10/10 must-haves verified`
    - Update gap entries: change `status: failed` to `status: resolved` for both gaps
    - Add a `resolved_at` field with today's date (2026-02-23) to each gap entry
    - Add a note explaining each gap was already closed by commits after initial verification
  </action>
  <verify>
    grep -c "Edit Quorum Composition" ~/.claude/commands/qgsd/mcp-setup.md  # expect >= 4
    grep "WIZ-08\|WIZ-09" /Users/jonathanborduas/code/QGSD/.planning/REQUIREMENTS.md  # expect [x] on both
    grep "status:" /Users/jonathanborduas/code/QGSD/.planning/phases/v0.7-03-wizard-composition-screen/v0.7-03-VERIFICATION.md  # expect complete
  </verify>
  <done>
    ~/.claude/commands/qgsd/mcp-setup.md returns >= 4 for "Edit Quorum Composition" grep count.
    REQUIREMENTS.md shows [x] for WIZ-08 and WIZ-09 with "Complete" in traceability table.
    VERIFICATION.md status field reads "complete" and score reads "10/10".
  </done>
</task>

</tasks>

<verification>
grep -c "Edit Quorum Composition" ~/.claude/commands/qgsd/mcp-setup.md
grep "\- \[x\] \*\*WIZ-08\|WIZ-09" /Users/jonathanborduas/code/QGSD/.planning/REQUIREMENTS.md
grep "^status:" /Users/jonathanborduas/code/QGSD/.planning/phases/v0.7-03-wizard-composition-screen/v0.7-03-VERIFICATION.md
</verification>

<success_criteria>
- ~/.claude/commands/qgsd/mcp-setup.md: >= 4 occurrences of "Edit Quorum Composition", >= 1370 lines
- .planning/REQUIREMENTS.md: WIZ-08 and WIZ-09 both [x], traceability rows both "Complete"
- v0.7-03-VERIFICATION.md: status=complete, score=10/10, both gap entries status=resolved
</success_criteria>

<output>
After completion, create `.planning/quick/63-fix-v0-7-03-gaps-run-install-sync-and-ma/63-SUMMARY.md`
</output>
