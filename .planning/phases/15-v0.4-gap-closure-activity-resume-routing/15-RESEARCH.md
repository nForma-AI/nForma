# Phase 15: v0.4 Gap Closure — Activity Resume Routing — Research

**Researched:** 2026-02-21
**Domain:** Workflow document patching — activity-set JSON schema correction and routing table gap closure
**Confidence:** HIGH

---

## Summary

Phase 15 closes two concrete, well-scoped gaps found during the v0.4 milestone audit. Both gaps are in documentation/workflow files (`.md` files), not in executable code. No new CLI commands, no schema changes, no new logic — only surgical edits to two existing workflow files with exact patch locations already identified.

**Gap 1 — ACT-02 (partial):** `oscillation-resolution-mode.md` Steps 4 and 5 write `circuit_breaker` activity-set calls without a `phase` field. The `phase` field IS in scope because this workflow is invoked exclusively from within `execute-phase`, which has already resolved `PHASE_NUMBER`. The fix is adding `"phase":"${PHASE_NUMBER}"` to both JSON payloads — two one-line additions.

**Gap 2 — ACT-04 (unsatisfied):** `resume-project.md`'s 13-row routing table has no rows for `activity=new_milestone`. The two `new_milestone` sub_activities (`researching`, `creating_roadmap`) fall through to wrong matches. The fix is adding two unambiguous rows keyed on `activity=new_milestone` and the `oscillation_diagnosis`/`awaiting_approval` rows need a note about the `{phase}` field now being available post-Fix 1.

Both source files (`get-shit-done/workflows/`) and their installed copies (`~/.claude/qgsd/workflows/`) must be patched. The installer's `copyWithPathReplacement` function handles path substitution on reinstall, but the installed copy serves as the live runtime and must be manually patched now (same dual-update pattern established in Phase 14).

**Primary recommendation:** Single plan covering both fixes in sequence. Fix oscillation-resolution-mode.md first (source + installed), then fix resume-project.md routing table (source + installed). Both fixes are line-level edits with zero risk of regression.

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| ACT-02 | Activity schema: `{ activity, sub_activity, phase?, plan?, wave?, debug_round?, checkpoint?, quorum_round?, updated }` — all fields except `activity` and `updated` are optional; unknown fields are preserved | Fix 1 adds missing `phase` field to 2 of 15 activity-set calls in oscillation-resolution-mode.md. Schema is already correct everywhere else — this is a targeted patch. |
| ACT-04 | `resume-work` reads current-activity.json and routes to the exact recovery point — displaying the interrupted state before resuming execution | Fix 2 adds 2 missing routing rows for `activity=new_milestone` to the 13-row routing table in resume-project.md. Post-Fix 1, the `oscillation_diagnosis` and `awaiting_approval` rows will also render correct `{phase}` values. |
</phase_requirements>

---

## Architecture Patterns

### Pattern 1: Dual-File Update (Source + Installed)

Established in Phase 14, confirmed by Phase 14-04-SUMMARY.md:

- **Source:** `get-shit-done/workflows/<file>.md` — uses `~/.claude/` paths (the canonical repo representation)
- **Installed:** `~/.claude/qgsd/workflows/<file>.md` — uses `/Users/jonathanborduas/.claude/` absolute paths (written by installer's `copyWithPathReplacement`)

Both must be updated. The diff between source and installed is purely path substitution (`~/.claude/` → `/Users/jonathanborduas/.claude/`). Both files are functionally identical except for this substitution.

**Verified live:** `diff` confirms installed copies differ from source only by absolute vs tilde path expansion. No other divergence.

### Pattern 2: Activity-Set JSON Payload Format

From `execute-phase.md` and other workflows, the established pattern is:

```bash
node ~/.claude/qgsd/bin/gsd-tools.cjs activity-set \
  "{\"activity\":\"circuit_breaker\",\"sub_activity\":\"oscillation_diagnosis\",\"phase\":\"${PHASE_NUMBER}\"}"
```

- `phase` field is always a quoted string (`"${PHASE_NUMBER}"`) in execute-phase.md
- This matches the existing execute-phase.md activity-set calls at lines 82-84 and the checkpoint/debug tracking calls
- The `activity-set` CLI overwrites `updated` with `new Date().toISOString()` — caller value is discarded (STATE.md decision)

### Pattern 3: Resume-Project Routing Table Format

Current routing table header and rows (from `resume-project.md` lines 164–178):

```markdown
| sub_activity | Recovery |
|---|---|
| executing_plan | `/qgsd:execute-phase {phase}` — executor will skip completed plans and resume from the interrupted plan |
| oscillation_diagnosis | `/qgsd:execute-phase {phase}` — oscillation resolution quorum was running |
```

The table uses `sub_activity` as the primary key. The `planning` row has an `(activity=quick)` qualifier inline — this is the disambiguation pattern already used in the table. New `new_milestone` rows must use the same disambiguation pattern.

---

## Detailed Fix Specification

### Fix 1: `oscillation-resolution-mode.md` — Add `phase` field

**Root cause:** PHASE_NUMBER context flow
- `oscillation-resolution-mode.md` is invoked as a sub-workflow from `execute-phase.md`, not as a standalone command
- At the point of invocation, `execute-phase` has already run `INIT=$(node ... init execute-phase "${PHASE_ARG}")` and extracted `phase_number` as `${PHASE_NUMBER}`
- The `oscillation-resolution-mode.md` document states in its `<constraints>` section: "See CLAUDE.md R5" — it is embedded workflow context, sharing the parent's variable scope
- `${PHASE_NUMBER}` is therefore in scope when Steps 4 and 5 execute

**Confidence: HIGH** — Verified by reading execute-phase.md lines 19-22 (INIT parse extracts `phase_number`) and lines 74-83 (activity-set with `${PHASE_NUMBER}` already used in execute_waves step). The oscillation workflow is triggered from within execute_waves, after PHASE_NUMBER is set.

**Source file:** `/Users/jonathanborduas/code/QGSD/get-shit-done/workflows/oscillation-resolution-mode.md`
**Installed file:** `/Users/jonathanborduas/.claude/qgsd/workflows/oscillation-resolution-mode.md`

**Step 4 fix (line 65, source):**
```
Before: "{\"activity\":\"circuit_breaker\",\"sub_activity\":\"oscillation_diagnosis\"}"
After:  "{\"activity\":\"circuit_breaker\",\"sub_activity\":\"oscillation_diagnosis\",\"phase\":\"${PHASE_NUMBER}\"}"
```

**Step 5 fix (line 93, source):**
```
Before: "{\"activity\":\"circuit_breaker\",\"sub_activity\":\"awaiting_approval\"}"
After:  "{\"activity\":\"circuit_breaker\",\"sub_activity\":\"awaiting_approval\",\"phase\":\"${PHASE_NUMBER}\"}"
```

Both lines in the installed copy use absolute path (`/Users/jonathanborduas/.claude/qgsd/bin/gsd-tools.cjs`) — the JSON payload edit is identical.

### Fix 2: `resume-project.md` — Add `activity=new_milestone` routing rows

**Root cause:** Routing table keyed by `sub_activity` only
- The `researching` sub_activity appears in both `plan-phase.md` (phase researcher running) and `new-milestone.md` (milestone research running)
- The current routing table row `| researching | /qgsd:plan-phase {phase} |` matches the `plan-phase` case but is WRONG for the `new-milestone` case
- The `creating_roadmap` sub_activity from `new-milestone.md` has NO row at all

**Source file:** `/Users/jonathanborduas/code/QGSD/get-shit-done/workflows/resume-project.md`
**Installed file:** `/Users/jonathanborduas/.claude/qgsd/workflows/resume-project.md`

**New rows to add** (after the `quorum` row, before the `oscillation_diagnosis` row — grouping new_milestone with plan-phase adjacent rows):

```markdown
| researching (activity=new_milestone) | `/qgsd:new-milestone` — milestone research was running |
| creating_roadmap | `/qgsd:new-milestone` — roadmapper was spawning |
```

**Existing `researching` row** (line 171) must be disambiguated from general `researching` to clarify it applies to `plan-phase` context:

```markdown
Before: | researching | `/qgsd:plan-phase {phase}` — researcher was running, re-trigger with --research flag |
After:  | researching (activity=plan_phase) | `/qgsd:plan-phase {phase}` — researcher was running, re-trigger with --research flag |
```

**After Fix 1**, the `oscillation_diagnosis` and `awaiting_approval` rows will render usable commands because the `phase` field is now included in the stored activity payload. No change to these rows themselves is required in resume-project.md — but a clarifying note is appropriate:

The audit document (v0.4-MILESTONE-AUDIT.md line 189) recommended: "update documentation row for oscillation_diagnosis/awaiting_approval to note that {phase} requires manual insertion when context is unavailable." However, once Fix 1 is applied, the `{phase}` value will ALWAYS be available for these rows. No documentation note is needed — Fix 1 makes the limitation moot.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead |
|---------|-------------|-------------|
| Syncing source and installed | Script to auto-sync | Manual dual-update per Phase 14 pattern — two targeted edits, not a complex sync mechanism |
| Phase number availability | Read from STATE.md | Use `${PHASE_NUMBER}` from parent execute-phase init — it's already in scope |

---

## Common Pitfalls

### Pitfall 1: Forgetting the Installed Copy
**What goes wrong:** Patching only the source (`get-shit-done/workflows/`) but not the installed copy (`~/.claude/qgsd/workflows/`). The live runtime reads the installed copy — source changes don't take effect until reinstall.
**How to avoid:** Always update both files. Verify with `diff` after patching.

### Pitfall 2: Wrong Path Format in Installed Copy
**What goes wrong:** Copying the source's `~/.claude/` path style into the installed copy, which expects absolute paths.
**How to avoid:** Source uses `~/.claude/qgsd/bin/gsd-tools.cjs`. Installed uses `/Users/jonathanborduas/.claude/qgsd/bin/gsd-tools.cjs`. Apply the same path substitution manually.

### Pitfall 3: Phase Field Type
**What goes wrong:** Writing `"phase":${PHASE_NUMBER}` (unquoted integer) instead of `"phase":"${PHASE_NUMBER}"` (quoted string).
**How to avoid:** Follow the established pattern from `execute-phase.md` lines 82-84 — `phase` is always quoted string. The tech debt note in the audit report acknowledges the inconsistency with `plan-phase.md` (which uses bare integer), but no consumer enforces type today and execute-phase.md's style is correct.

### Pitfall 4: Sub-Activity Disambiguation
**What goes wrong:** Adding `new_milestone` rows without disambiguating the existing `researching` row, leaving ambiguity about which row matches which activity.
**How to avoid:** Add `(activity=plan_phase)` qualifier to the existing `researching` row AND add new rows with `(activity=new_milestone)` qualifier. The `planning (activity=quick)` row already demonstrates this disambiguation pattern.

---

## Code Examples

### Correct activity-set call with phase field (from execute-phase.md)
```bash
# Source: execute-phase.md lines 81-84
node ~/.claude/qgsd/bin/gsd-tools.cjs activity-set \
  "{\"activity\":\"execute_phase\",\"sub_activity\":\"executing_plan\",\"phase\":\"${PHASE_NUMBER}\",\"plan\":\"${PLAN_FILE}\",\"wave\":${WAVE_N}}"
```

### Current broken call (oscillation-resolution-mode.md Step 4)
```bash
# Source: oscillation-resolution-mode.md lines 64-65
node ~/.claude/qgsd/bin/gsd-tools.cjs activity-set \
  "{\"activity\":\"circuit_breaker\",\"sub_activity\":\"oscillation_diagnosis\"}"
# Missing: "phase":"${PHASE_NUMBER}"
```

### Fixed call (oscillation-resolution-mode.md Step 4)
```bash
node ~/.claude/qgsd/bin/gsd-tools.cjs activity-set \
  "{\"activity\":\"circuit_breaker\",\"sub_activity\":\"oscillation_diagnosis\",\"phase\":\"${PHASE_NUMBER}\"}"
```

### Current routing table (broken for new_milestone)
```markdown
| sub_activity | Recovery |
|---|---|
| researching | `/qgsd:plan-phase {phase}` — researcher was running, re-trigger with --research flag |
| planning | `/qgsd:plan-phase {phase}` — planner was running, re-trigger plan-phase |
| checking_plan | `/qgsd:plan-phase {phase}` — checker was running, re-trigger plan-phase |
| quorum | `/qgsd:plan-phase {phase}` — QUORUM was in progress (round {quorum_round}), re-trigger plan-phase |
| oscillation_diagnosis | `/qgsd:execute-phase {phase}` — oscillation resolution quorum was running |
| awaiting_approval | `/qgsd:execute-phase {phase}` — unified solution is ready, user approval is needed |
| executing | `/qgsd:quick` — quick task execution was in progress |
| planning (activity=quick) | `/qgsd:quick` — quick task planning was in progress |
```

### Fixed routing table (new_milestone rows added, researching disambiguated)
```markdown
| sub_activity | Recovery |
|---|---|
| researching (activity=plan_phase) | `/qgsd:plan-phase {phase}` — researcher was running, re-trigger with --research flag |
| planning | `/qgsd:plan-phase {phase}` — planner was running, re-trigger plan-phase |
| checking_plan | `/qgsd:plan-phase {phase}` — checker was running, re-trigger plan-phase |
| quorum | `/qgsd:plan-phase {phase}` — QUORUM was in progress (round {quorum_round}), re-trigger plan-phase |
| researching (activity=new_milestone) | `/qgsd:new-milestone` — milestone research was running |
| creating_roadmap | `/qgsd:new-milestone` — roadmapper was spawning |
| oscillation_diagnosis | `/qgsd:execute-phase {phase}` — oscillation resolution quorum was running |
| awaiting_approval | `/qgsd:execute-phase {phase}` — unified solution is ready, user approval is needed |
| executing | `/qgsd:quick` — quick task execution was in progress |
| planning (activity=quick) | `/qgsd:quick` — quick task planning was in progress |
```

---

## File Inventory

All files to be modified in Phase 15:

| File | Location | What Changes |
|------|----------|--------------|
| `oscillation-resolution-mode.md` | `/Users/jonathanborduas/code/QGSD/get-shit-done/workflows/` | Step 4 + Step 5: add `"phase":"${PHASE_NUMBER}"` to JSON payloads |
| `oscillation-resolution-mode.md` | `/Users/jonathanborduas/.claude/qgsd/workflows/` | Same edits with absolute path in the bash call |
| `resume-project.md` | `/Users/jonathanborduas/code/QGSD/get-shit-done/workflows/` | Routing table: disambiguate `researching` row + add 2 `new_milestone` rows |
| `resume-project.md` | `/Users/jonathanborduas/.claude/qgsd/workflows/` | Same routing table edits (path-expanded version already identical in table content) |
| `REQUIREMENTS.md` | `.planning/REQUIREMENTS.md` | Mark ACT-02 and ACT-04 `[x]` (currently `[ ]` per traceability table) |

---

## Open Questions

1. **Should `creating_roadmap` row include `{phase}` in the recovery command?**
   - What we know: `new-milestone.md` Step 10 writes `activity=new_milestone, sub_activity=creating_roadmap` — no `phase` field is written because new-milestone.md hasn't defined phases yet (the roadmapper hasn't run). So `{phase}` would be `undefined` in this row.
   - What's unclear: Should the recovery command be `/qgsd:new-milestone` with no phase argument, or should it note the phase limitation?
   - Recommendation: Use `/qgsd:new-milestone` with no `{phase}` substitution for this row — the workflow has no phase context yet. The note in the row description is sufficient.

2. **Should `researching` row disambiguation be `(activity=plan_phase)` or `(activity!=new_milestone)`?**
   - Recommendation: Use positive `(activity=plan_phase)` — matches the `(activity=quick)` disambiguation pattern already in the table. Consistent and explicit.

---

## Sources

### Primary (HIGH confidence)
- `/Users/jonathanborduas/code/QGSD/get-shit-done/workflows/oscillation-resolution-mode.md` — Full read, lines 60–95 (Steps 4 and 5, exact JSON payloads)
- `/Users/jonathanborduas/code/QGSD/get-shit-done/workflows/resume-project.md` — Full read, lines 158–178 (routing table)
- `/Users/jonathanborduas/code/QGSD/get-shit-done/workflows/execute-phase.md` — Full read, lines 19–22 (PHASE_NUMBER extraction), lines 74–84 (activity-set with PHASE_NUMBER), lines 184–233 (checkpoint tracking)
- `/Users/jonathanborduas/code/QGSD/get-shit-done/workflows/new-milestone.md` — Full read, lines 113–115 (researching activity-set), lines 277–279 (creating_roadmap activity-set)
- `/Users/jonathanborduas/code/QGSD/.planning/v0.4-MILESTONE-AUDIT.md` — Audit report with exact line references and gap specifications
- `diff` output — Confirmed source vs installed file differences are path substitution only

### Secondary (MEDIUM confidence)
- `.planning/STATE.md` — Decisions section, Phase 14 activity tracking patterns
- `.planning/phases/14-activity-tracking/14-04-SUMMARY.md` — Dual-file update pattern confirmation

---

## Metadata

**Confidence breakdown:**
- Fix 1 (oscillation-resolution-mode.md phase field): HIGH — PHASE_NUMBER scope verified by reading execute-phase.md; exact lines identified from diff
- Fix 2 (resume-project.md routing): HIGH — Routing table format verified by reading live file; new_milestone sub_activities verified from new-milestone.md source
- Dual-update pattern: HIGH — Phase 14 precedent confirmed by SUMMARY.md and live diff

**Research date:** 2026-02-21
**Valid until:** No expiry — this is a codebase-specific analysis of static files
