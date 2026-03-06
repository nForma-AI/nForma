---
phase: quick-192
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - core/workflows/execute-plan.md
autonomous: true
requirements: [WORKFLOW-CHAIN-01]
formal_artifacts: none

must_haves:
  truths:
    - "When execute-plan finishes the last plan of the last phase, it chains into audit-milestone logic instead of suggesting complete-milestone directly"
    - "Yolo mode auto-invokes /nf:audit-milestone on Route C milestone completion"
    - "Interactive mode suggests /nf:audit-milestone as the primary next step on Route C"
    - "Gap closure detection works identically to transition.md Route B logic"
  artifacts:
    - path: "core/workflows/execute-plan.md"
      provides: "Route C with audit-milestone chaining"
      contains: "audit-milestone"
  key_links:
    - from: "core/workflows/execute-plan.md"
      to: "core/workflows/transition.md"
      via: "Route C mirrors transition.md Route B milestone-complete logic"
      pattern: "audit-milestone"
---

<objective>
Fix execute-plan.md Route C (milestone done) to chain into transition.md's audit-milestone logic instead of directly suggesting `/nf:complete-milestone`.

Purpose: Currently, when the last plan of the last phase completes, execute-plan Route C suggests `/nf:complete-milestone` + `/nf:verify-work` + `/nf:add-phase`, bypassing the mandatory audit step. The transition.md workflow correctly chains into `/nf:audit-milestone` first (which itself gates complete-milestone). Route C must mirror this pattern to ensure milestone audits are never skipped.

Output: Updated execute-plan.md with Route C expanded to include gap-closure detection, yolo auto-invoke, and interactive suggestion — matching transition.md Route B exactly.
</objective>

<execution_context>
@/Users/jonathanborduas/.claude/nf/workflows/execute-plan.md
@/Users/jonathanborduas/.claude/nf/templates/summary.md
</execution_context>

<context>
@core/workflows/execute-plan.md (lines 416-431: offer_next step with Route C)
@core/workflows/transition.md (lines 450-537: offer_next_phase step Route B milestone-complete logic)
</context>

<tasks>

<task type="auto">
  <name>Task 1: Expand Route C in execute-plan.md offer_next step to chain into audit-milestone</name>
  <files>core/workflows/execute-plan.md</files>
  <action>
In `core/workflows/execute-plan.md`, replace the `offer_next` step (lines 416-431) with an expanded version that:

1. Keeps Route A (more plans) and Route B (phase done, more phases) UNCHANGED in the summary table.

2. Replaces Route C's one-liner table entry with a full expanded section BELOW the table. The table row for Route C should say: `Show banner, detect gap closure, chain into audit-milestone (see below)`.

3. After the table (before "All routes: `/clear` first for fresh context."), add a new section for Route C expansion that mirrors transition.md's Route B logic (lines 451-537). Specifically:

**Step 1: Detect gap closure phase**
```bash
# Check if the completed phase's ROADMAP.md entry has a Gap Closure marker
IS_GAP_CLOSURE=$(grep -A 4 "^### Phase ${COMPLETED_PHASE}:" .planning/ROADMAP.md | grep -c '\*\*Gap Closure:\*\*')
# IS_GAP_CLOSURE=0 -> primary path (first audit before completing)
# IS_GAP_CLOSURE=1+ -> re-audit path (gap closure phase just finished)
```

**Step 2a: Gap Closure re-audit path (IS_GAP_CLOSURE=1+)**

Yolo mode:
```
Phase {X} plan complete — all plans finished.

Gap closure phase finished — re-auditing milestone {version}

Auto-continuing: Re-run milestone audit to verify gaps are closed
```
Exit and invoke SlashCommand("/nf:audit-milestone {version} --auto")

Interactive mode:
```
## Phase {X}: {Phase Name} Complete

Gap closure phase finished.

---

## Next Up

**Re-audit Milestone {version}** — verify gap closure succeeded

`/nf:audit-milestone {version}`

<sub>`/clear` first - fresh context window</sub>

---
```

**Step 2b: Primary completion path (IS_GAP_CLOSURE=0)**

Yolo mode:
```
Phase {X} plan complete — all plans finished.

Milestone {version} is 100% complete — all {N} phases finished!

Auto-continuing: Run milestone audit before completing
```
Exit and invoke SlashCommand("/nf:audit-milestone {version} --auto")

Interactive mode:
```
## Phase {X}: {Phase Name} Complete

Milestone {version} is 100% complete — all {N} phases finished!

---

## Next Up

**Audit Milestone {version}** — verify requirements before completing

`/nf:audit-milestone {version}`

<sub>`/clear` first - fresh context window</sub>

---
```

Keep the "All routes: `/clear` first for fresh context." line at the end.

IMPORTANT: Do NOT change any other steps in the file. Only modify the `offer_next` step content. Preserve the exact XML structure (`<step name="offer_next">` ... `</step>`).

Do NOT add emoji characters to the file. The transition.md source uses emoji but execute-plan.md does not — maintain execute-plan.md's existing style.

STYLE NOTE: The `<if mode="yolo">` and `<if mode="interactive">` XML blocks used in the Route C expansion are intentional and consistent with execute-plan.md's existing XML step structure (the file already uses XML tags like `<step name="...">`, `<if>` conditionals, etc.). Do not hesitate about this style — it matches the file's conventions.
  </action>
  <verify>
1. `grep "audit-milestone" core/workflows/execute-plan.md` returns matches in the Route C section.
2. `grep "complete-milestone" core/workflows/execute-plan.md` returns NO matches (audit-milestone replaces the direct complete-milestone suggestion). NOTE: Before editing, verify whether `complete-milestone` appears anywhere else in the file outside Route C. If it does, scope the grep to only the `offer_next` step region (e.g., `sed -n '/offer_next/,/<\/step>/p' core/workflows/execute-plan.md | grep "complete-milestone"`) to avoid false negatives from unrelated occurrences.
3. `grep "IS_GAP_CLOSURE" core/workflows/execute-plan.md` returns matches (gap closure detection present).
4. `grep -c "offer_next" core/workflows/execute-plan.md` returns exactly 2 (the step name tag and closing tag — no duplication).
5. The rest of the file is unchanged: `grep -c '<step name=' core/workflows/execute-plan.md` returns the same count as before the edit.
  </verify>
  <done>Route C in execute-plan.md chains into /nf:audit-milestone with gap-closure detection, matching transition.md Route B logic. Both yolo (auto-invoke) and interactive (suggest) paths are present. The direct /nf:complete-milestone suggestion is removed.</done>
</task>

<task type="auto">
  <name>Task 2: Install sync — deploy updated workflow to ~/.claude/nf/</name>
  <files>core/workflows/execute-plan.md</files>
  <action>
Workflows install to `~/.claude/nf/` and the installed copy is what actually runs. After editing `core/workflows/execute-plan.md`, run install sync:

```bash
node bin/install.js --claude --global
```

This copies `core/workflows/execute-plan.md` to `~/.claude/nf/workflows/execute-plan.md` so the live runtime picks up the Route C changes.
  </action>
  <verify>
1. `diff core/workflows/execute-plan.md ~/.claude/nf/workflows/execute-plan.md` — should show no differences (installed copy matches source).
2. `grep "audit-milestone" ~/.claude/nf/workflows/execute-plan.md` — confirms the installed copy has the Route C changes.
  </verify>
  <done>The installed workflow at ~/.claude/nf/workflows/execute-plan.md matches the updated source and includes Route C audit-milestone chaining.</done>
</task>

</tasks>

<verification>
- `grep "audit-milestone" core/workflows/execute-plan.md` — confirms audit chaining present
- `grep -v "^--" core/workflows/execute-plan.md | grep "complete-milestone"` — should return NO matches (removed)
- `grep "IS_GAP_CLOSURE" core/workflows/execute-plan.md` — confirms gap closure detection
- Route A and Route B table entries are unchanged
- File parses correctly as markdown with no broken XML tags
</verification>

<success_criteria>
- execute-plan.md Route C chains into audit-milestone instead of suggesting complete-milestone directly
- Gap closure detection logic matches transition.md pattern
- Yolo mode auto-invokes /nf:audit-milestone
- Interactive mode suggests /nf:audit-milestone as primary next action
- No other steps in execute-plan.md are modified
</success_criteria>

<output>
After completion, create `.planning/quick/192-fix-execute-plan-route-c-to-chain-into-t/192-SUMMARY.md`
</output>
