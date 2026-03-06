---
phase: quick-195
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - core/workflows/audit-milestone.md
  - commands/nf/audit-milestone.md
autonomous: true
formal_artifacts: none
requirements: [QUICK-195]

must_haves:
  truths:
    - "When audit finds tech_debt in auto mode, it runs the same solve→plan→execute→re-audit loop as gaps_found"
    - "When audit finds tech_debt in interactive mode, it auto-spawns plan-milestone-gaps instead of just showing options"
    - "The --auto flag success criteria matches the actual auto-mode behavior for tech_debt"
    - "The argument-hint in the command file documents --auto flag"
  artifacts:
    - path: "core/workflows/audit-milestone.md"
      provides: "Tech debt auto-remediation loop in both auto and interactive modes"
      contains: "tech_debt"
    - path: "commands/nf/audit-milestone.md"
      provides: "Command definition with --auto flag"
      contains: "--auto"
  key_links:
    - from: "core/workflows/audit-milestone.md (Auto: If tech_debt)"
      to: "core/workflows/audit-milestone.md (Auto: If gaps_found)"
      via: "fall-through behavior"
      pattern: "Treat.*tech_debt.*as.*gaps_found"
    - from: "core/workflows/audit-milestone.md (Interactive tech_debt)"
      to: "core/workflows/plan-milestone-gaps.md"
      via: "Task spawn for auto-remediation"
      pattern: "plan-milestone-gaps"
---

<objective>
Update the nf:audit-milestone workflow to add automated tech debt remediation in both auto and interactive modes.

Purpose: Currently, the interactive tech_debt path only shows manual options (complete or plan cleanup). The auto-mode correctly falls through to the gap closure loop but the success criteria contradicts this. This task aligns the interactive path to also auto-spawn remediation and fixes the success criteria.

Output: Updated audit-milestone.md workflow and command files.
</objective>

<execution_context>
@/Users/jonathanborduas/.claude/nf/workflows/execute-plan.md
@/Users/jonathanborduas/.claude/nf/templates/summary.md
</execution_context>

<context>
@core/workflows/audit-milestone.md
@commands/nf/audit-milestone.md
@core/workflows/plan-milestone-gaps.md
</context>

<tasks>

<task type="auto">
  <name>Task 1: Update audit-milestone workflow tech_debt routing in both modes</name>
  <files>core/workflows/audit-milestone.md</files>
  <action>
Make three targeted changes to `core/workflows/audit-milestone.md`:

**Change 1 — Interactive tech_debt path (lines ~463-495):**

Replace the current interactive tech_debt section that just shows "Options A/B" with an active auto-remediation flow. After presenting the tech debt summary, auto-spawn `plan-milestone-gaps` via a Task call instead of listing it as a passive option. Structure:

1. Keep the tech debt summary display (phase-by-phase listing, total count)
2. Replace the passive "Options A/B" block with an active Task spawn:
   - Display: `Spawning tech debt remediation planner...`
   - Task spawn to `/nf:plan-milestone-gaps` with the audit file path, milestone version, and tech debt items as context
   - Keep "Also available" footer with `/nf:complete-milestone {version}` as alternative (accept debt)

The new interactive tech_debt block should mirror the interactive gaps_found block's pattern: present findings, then auto-spawn the planner.

**Change 2 — Fix success criteria contradiction (line ~514):**

Change line 514 from:
```
- [ ] (--auto) If tech_debt → auto-invoke complete-milestone (accept debt)
```
To:
```
- [ ] (--auto) If tech_debt → treat as gaps_found, run solve→plan→execute→re-audit loop
```

This matches the actual auto-mode behavior on lines 252-258 which already treats tech_debt as gaps_found.

**Change 3 — Add interactive tech_debt success criterion:**

Add a new success criterion:
```
- [ ] (interactive) If tech_debt → auto-spawn plan-milestone-gaps for remediation
```

Do NOT change the auto-mode tech_debt handling (lines 252-258) -- it already correctly falls through to gaps_found. Only change the interactive path and the success criteria.
  </action>
  <verify>
Verify by checking:
1. `grep -n "tech_debt" core/workflows/audit-milestone.md` -- should show the updated interactive path with Task spawn and corrected success criteria
2. `grep -c "plan-milestone-gaps" core/workflows/audit-milestone.md` -- count should increase by 1 (new Task spawn in interactive tech_debt section)
3. `grep "auto-invoke complete-milestone.*accept debt" core/workflows/audit-milestone.md` -- should return NO results (contradiction removed)
4. `grep "treat as gaps_found" core/workflows/audit-milestone.md` -- should appear in success criteria
  </verify>
  <done>
Interactive tech_debt path auto-spawns plan-milestone-gaps instead of showing passive options. Success criteria line 514 matches actual auto-mode behavior (treat as gaps_found, not accept debt). New success criterion added for interactive tech_debt auto-remediation.
  </done>
</task>

<task type="auto">
  <name>Task 2: Sync command file and install updated workflow</name>
  <files>commands/nf/audit-milestone.md</files>
  <action>
**Step 1 — Update command file argument-hint:**

In `commands/nf/audit-milestone.md`, the argument-hint already shows `"[version] [--auto]"`. No change needed there unless the description needs updating. Update the objective description to mention tech debt auto-remediation:

Change the objective from:
```
Verify milestone achieved its definition of done. Check requirements coverage, cross-phase integration, and end-to-end flows.
```
To:
```
Verify milestone achieved its definition of done. Check requirements coverage, cross-phase integration, and end-to-end flows. Auto-remediates tech debt and gaps via solve→plan→execute loop.
```

**Step 2 — Install updated workflow:**

Copy the updated workflow to the installed location:
```bash
cp core/workflows/audit-milestone.md ~/.claude/nf/workflows/audit-milestone.md
```

This ensures the installed copy at `~/.claude/nf/workflows/` matches the source.
  </action>
  <verify>
1. `grep "Auto-remediates" commands/nf/audit-milestone.md` -- should show updated description
2. `diff core/workflows/audit-milestone.md ~/.claude/nf/workflows/audit-milestone.md` -- should show no differences (install synced)
  </verify>
  <done>
Command file description updated to mention tech debt auto-remediation. Installed workflow copy synced with source.
  </done>
</task>

</tasks>

<verification>
1. The interactive tech_debt path now spawns plan-milestone-gaps automatically
2. The auto-mode tech_debt path is unchanged (still falls through to gaps_found correctly)
3. Success criteria are internally consistent -- no contradictions between documented behavior and actual routing
4. Installed workflow at ~/.claude/nf/workflows/ matches source
</verification>

<success_criteria>
- Interactive tech_debt audit result triggers auto-remediation via plan-milestone-gaps Task spawn
- Auto-mode tech_debt behavior unchanged (already correct -- falls through to gaps_found loop)
- Success criteria line 514 fixed to match actual behavior
- Command file description mentions auto-remediation capability
- Installed workflow synced
</success_criteria>

<output>
After completion, create `.planning/quick/195-add-automated-audit-plan-execute-loop-to/195-SUMMARY.md`
</output>
