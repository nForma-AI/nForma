---
phase: quick-326
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - commands/nf/solve-diagnose.md
  - core/workflows/close-formal-gaps.md
  - ~/.claude/nf/workflows/close-formal-gaps.md
autonomous: true
requirements: []
formal_artifacts: none

must_haves:
  truths:
    - "solve-diagnose flags files with 3+ related boolean flags as implicit FSM candidates in its diagnostic output"
    - "solve-diagnose flags files with string/enum variables having 3+ distinct values used in conditionals as implicit FSM candidates"
    - "close-formal-gaps includes 'implicit FSM' as a recognized gap type when scanning for uncovered files"
    - "close-formal-gaps suggests running fsm-to-tla.cjs --scaffold-config when an implicit FSM gap is detected"
    - "core/workflows/close-formal-gaps.md is in sync with the installed ~/.claude/nf/workflows/close-formal-gaps.md"
  artifacts:
    - path: "commands/nf/solve-diagnose.md"
      provides: "Implicit FSM detection step added after git churn heatmap in Step 1"
      contains: "fsm_candidates"
    - path: "core/workflows/close-formal-gaps.md"
      provides: "Implicit FSM gap type in Step 1 detect_gaps, with fsm-to-tla.cjs suggestion"
      contains: "implicit_fsm"
  key_links:
    - from: "commands/nf/solve-diagnose.md"
      to: "output_contract JSON"
      via: "fsm_candidates array field added to JSON output schema"
      pattern: "fsm_candidates"
    - from: "core/workflows/close-formal-gaps.md"
      to: "~/.claude/nf/workflows/close-formal-gaps.md"
      via: "cp sync command"
      pattern: "implicit_fsm"
---

<objective>
Add implicit state machine detection heuristics to two nForma workflows:
1. `solve-diagnose` — detects ad-hoc control flow patterns (3+ related boolean flags OR enum-like strings with 3+ distinct values in conditionals) in hot-zone files, appends FSM candidates to diagnostic output
2. `close-formal-gaps` — recognizes "implicit FSM" as a coverage gap type, suggests `bin/fsm-to-tla.cjs --scaffold-config` when such gaps are found

Purpose: Close the detection gap — plan-phase.md and solve-remediate.md already bias toward state machines, but no workflow currently catches *existing* implicit FSMs before they're formally modeled.

Output: Modified solve-diagnose.md (commands/nf/), modified close-formal-gaps.md (core/workflows/ + installed copy synced).
</objective>

<execution_context>
@/Users/jonathanborduas/.claude/nf/workflows/execute-plan.md
</execution_context>

<context>
@.planning/STATE.md
@commands/nf/solve-diagnose.md
@core/workflows/close-formal-gaps.md
</context>

<tasks>

<task type="auto">
  <name>Task 1: Add implicit FSM detection step to solve-diagnose</name>
  <files>commands/nf/solve-diagnose.md</files>
  <action>
After the "Issue Classification" block at the end of `<process>` (after the `node bin/issue-classifier.cjs` paragraph, before `</process>`), insert a new subsection titled `### Implicit State Machine Detection`.

The section should read:

```markdown
### Implicit State Machine Detection

Scan the top files from the git churn heatmap (up to top 10 by churn score) for implicit state machine patterns. Use Grep on each file path extracted from `git-heatmap.json` (`heatmap.top_files[].file`).

**Heuristic A — Multi-flag boolean cluster:**
For each file, search for boolean variable declarations or assignments (lines matching `(bool|boolean|let|var|const)\s+\w+(Pending|Active|Done|Started|Running|Stopped|Failed|Ready|Busy|Locked|Open|Closed|Enabled|Disabled)\s*[=:]`). If 3 or more such flags appear in the same file, record it as an FSM candidate with reason `"multi-flag-boolean"`.

**Heuristic B — Enum-like string state variable:**
For each file, search for patterns where a single variable is compared against 3 or more distinct string literals in conditional branches (e.g., `if.*===\s*['"][A-Z_]+['"]` or `case\s+['"][A-Z_]+['"]:`). If the same variable name appears in 3+ such comparisons, record it as an FSM candidate with reason `"enum-string-state"`.

Both heuristics are **fail-open**: if grep errors or returns no output, skip silently and proceed.

Log results:
- If 0 candidates found: `"Step 1 FSM scan: No implicit state machine patterns detected in top ${N} heatmap files"`
- If candidates found: `"Step 1 FSM scan: {count} implicit FSM candidate(s) detected — recommend extraction + fsm-to-tla.cjs --scaffold-config"`
  For each candidate, log: `"  {file}: {reason} (flags: {matched_names_or_values})"`

Store the candidates array as `fsm_candidates` in the solve context.
```

Also add `"fsm_candidates": []` to the `<output_contract>` JSON schema block (the JSON object in the output_contract section) — add it as a sibling of `"issues"` with description `/* implicit FSM candidates from heatmap scan */`.
  </action>
  <verify>grep -n "fsm_candidates" /Users/jonathanborduas/code/QGSD/commands/nf/solve-diagnose.md | head -5</verify>
  <done>"fsm_candidates" appears in both the process section (detection step) and the output_contract JSON schema in commands/nf/solve-diagnose.md</done>
</task>

<task type="auto">
  <name>Task 2: Add implicit FSM gap type to close-formal-gaps and sync installed copy</name>
  <files>
    core/workflows/close-formal-gaps.md
    ~/.claude/nf/workflows/close-formal-gaps.md
  </files>
  <action>
In `core/workflows/close-formal-gaps.md`, within the `<step name="detect_gaps">` block (Step 1), after the coverage gap summary table display (after the `Otherwise, present the categories...` paragraph but before the `**Bug context parsing (MRF-01):**` block), insert a new subsection:

```markdown
### Implicit FSM Gap Detection

After computing uncovered requirements, scan source files that have NO formal model coverage for implicit state machine patterns. This surfaces code that should be formally modeled as a state machine but hasn't been flagged via requirements yet.

For each source file path found in `.planning/formal/evidence/git-heatmap.json` (top 10 by churn) that is NOT already covered by a model in the registry:

1. Run a grep for multi-flag boolean clusters: `grep -cE "(Pending|Active|Done|Started|Running|Stopped|Failed|Ready|Busy|Locked|Open|Closed|Enabled|Disabled)\s*[=:]" {file}` — if count ≥ 3, record as implicit FSM gap.
2. Run a grep for enum-like string comparisons: `grep -cE "===\s*['\"][A-Z_]{3,}['\"]|case\s+['\"][A-Z_]{3,}['\"]:" {file}` — if count ≥ 3, record as implicit FSM gap.

This is **fail-open**: grep errors or missing heatmap are silently skipped.

If implicit FSM gaps are found, append a section to the coverage gap summary:

```
Implicit FSM Candidates (no formal model yet)
─────────────────────────────────────────────
  src/foo/bar.ts                multi-flag-boolean  (Pending, Active, Done, ...)
  src/hooks/dispatch.ts         enum-string-state   (IDLE, RUNNING, FAILED, ...)

Recommended action: run `node bin/fsm-to-tla.cjs --scaffold-config` to generate
TLA+ scaffold configs for these files, then use close-formal-gaps to cover them.
```

If `--batch` is active, log the implicit FSM candidates but proceed without pausing. If not in batch mode, present these alongside uncovered requirements so the user can decide whether to address them in this session.
```

After editing, sync the file to the installed location:
```bash
cp /Users/jonathanborduas/code/QGSD/core/workflows/close-formal-gaps.md ~/.claude/nf/workflows/close-formal-gaps.md
```
  </action>
  <verify>grep -n "implicit_fsm\|Implicit FSM\|fsm-to-tla" /Users/jonathanborduas/code/QGSD/core/workflows/close-formal-gaps.md | head -10 && grep -n "Implicit FSM" ~/.claude/nf/workflows/close-formal-gaps.md | head -5</verify>
  <done>"Implicit FSM" detection block appears in core/workflows/close-formal-gaps.md Step 1, and the installed ~/.claude/nf/workflows/close-formal-gaps.md matches (grep finds the same text in both files)</done>
</task>

</tasks>

<verification>
1. `grep -n "fsm_candidates" commands/nf/solve-diagnose.md` returns at least 2 matches (process section + output_contract)
2. `grep -n "Implicit FSM" core/workflows/close-formal-gaps.md` returns matches in detect_gaps step
3. `grep -n "fsm-to-tla" core/workflows/close-formal-gaps.md` returns the scaffold suggestion
4. `diff core/workflows/close-formal-gaps.md ~/.claude/nf/workflows/close-formal-gaps.md` returns no diff (files in sync)
5. Both heuristics are documented as fail-open (no blocking on grep errors)
</verification>

<success_criteria>
- solve-diagnose output_contract JSON schema includes fsm_candidates field
- solve-diagnose Step 1 scan logs FSM candidates from top heatmap files using both heuristics
- close-formal-gaps Step 1 detect_gaps shows implicit FSM candidates alongside requirement coverage gaps
- close-formal-gaps recommends fsm-to-tla.cjs --scaffold-config for detected implicit FSMs
- core/workflows/close-formal-gaps.md and ~/.claude/nf/workflows/close-formal-gaps.md are identical after sync
- No existing workflow behavior changed — both additions are additive and fail-open
</success_criteria>

<output>
After completion, create `.planning/quick/326-add-implicit-state-machine-detection-to-/326-SUMMARY.md` with:
- Files modified
- What was added to each workflow
- Verification commands run and their output
</output>
