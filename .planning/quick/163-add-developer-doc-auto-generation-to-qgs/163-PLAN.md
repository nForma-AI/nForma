---
phase: quick-163
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - bin/qgsd-solve.cjs
  - commands/qgsd/solve.md
autonomous: true
requirements:
  - QUICK-163
formal_artifacts: none

must_haves:
  truths:
    - "When R->D gaps exist, solve auto-dispatches /qgsd:quick to generate developer doc entries (docs/dev/) — no longer manual-only"
    - "User docs (docs/) are never auto-modified — only developer docs (docs/dev/) are auto-generated"
    - "sweepRtoD uses only developer-category doc files when computing residual, not user-category files"
    - "The /qgsd:quick dispatch in Step 3f includes the requirement ID, requirement text, and relevant source files so the executor can write a meaningful doc entry"
    - "Step 3g (D->C) remains informational — stale path/CLI claims still require human judgment"
  artifacts:
    - path: "bin/qgsd-solve.cjs"
      provides: "sweepRtoD filters to developer-only docs when developer category is present"
      contains: "category === 'developer'"
    - path: "commands/qgsd/solve.md"
      provides: "Step 3f dispatches /qgsd:quick for R->D remediation with requirement context"
      contains: "qgsd:quick"
  key_links:
    - from: "commands/qgsd/solve.md Step 3f"
      to: "/qgsd:quick"
      via: "dispatch with requirement IDs + text + source file hints"
      pattern: "qgsd:quick.*Generate developer doc"
---

<objective>
Add developer doc auto-generation to the solve skill's R->D gap remediation.

Purpose: R->D gaps currently stall as "manual review required" even when developer docs (docs/dev/) are auto-generatable from code and requirements. User docs (docs/) must stay human-controlled. This change makes solve automatically dispatch /qgsd:quick to write doc entries into docs/dev/ for each undocumented requirement — closing the gap autonomously.

Output:
- bin/qgsd-solve.cjs — sweepRtoD scoped to developer-category docs
- commands/qgsd/solve.md — Step 3f dispatches /qgsd:quick with full context
</objective>

<execution_context>
@/Users/jonathanborduas/.claude/qgsd/workflows/execute-plan.md
@/Users/jonathanborduas/.claude/qgsd/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/STATE.md
@bin/qgsd-solve.cjs
@commands/qgsd/solve.md
@.planning/polyrepo.json
</context>

<tasks>

<task type="auto">
  <name>Task 1: Scope sweepRtoD to developer-category docs only</name>
  <files>bin/qgsd-solve.cjs</files>
  <action>
In `sweepRtoD()` (around line 767), after `discoverDocFiles()` is called, filter the doc files to developer-category only when at least one developer-category file is present.

Current code:
```js
const docFiles = discoverDocFiles();
```

Change to:
```js
const allDiscovered = discoverDocFiles();
// Only scan developer-category docs for R->D gap detection.
// User docs (category='user') are human-controlled and must not drive auto-remediation.
// Fall back to all docs only if no developer-category files exist (legacy setup).
const developerDocs = allDiscovered.filter(f => f.category === 'developer');
const docFiles = developerDocs.length > 0 ? developerDocs : allDiscovered;
```

Also update the detail object returned at the end of sweepRtoD to include `developer_docs_only: developerDocs.length > 0` so callers know which scoping was applied.

The rest of the function (`allDocContent` assembly loop, coverage check) remains unchanged — it now operates on the filtered set.

Rationale: `polyrepo.json` maps `developer` → `docs/dev/` and `user` → `docs/`. User docs are human-authored narrative; developer docs are reference material derived from code and requirements. Only developer docs should trigger automated gap-closure dispatch.
  </action>
  <verify>
```bash
node bin/qgsd-solve.cjs --report-only --json | node -e "
  const d = JSON.parse(require('fs').readFileSync('/dev/stdin','utf8'));
  console.log('r_to_d residual:', d.residual_vector.r_to_d.residual);
  console.log('detail:', JSON.stringify(d.residual_vector.r_to_d.detail, null, 2));
"
```
Output should show `doc_files_scanned` count matching only files under `docs/dev/` (2 files), not `docs/` broadly.
  </verify>
  <done>sweepRtoD returns residual based on developer docs only; `doc_files_scanned` reflects the docs/dev/ count; no test regressions (`node --test bin/*.test.cjs` if tests exist)</done>
</task>

<task type="auto">
  <name>Task 2: Add auto-remediation dispatch to Step 3f in solve.md</name>
  <files>commands/qgsd/solve.md</files>
  <action>
Replace the current Step 3f body (lines ~214-229 in solve.md) with an active remediation dispatch. The replacement must:

1. Keep the informational display of undocumented requirement IDs.
2. Extract requirement text and relevant source file hints from `residual_vector.r_to_d.detail.undocumented_requirements` and the requirements envelope (`.formal/requirements.json`).
3. Dispatch `/qgsd:quick` to generate developer doc entries. Group into batches of 10 IDs max.

New Step 3f text:

```
### 3f. R->D Gaps (residual_vector.r_to_d.residual > 0)

Requirements that shipped but are not mentioned in developer docs (docs/dev/).
User docs (docs/) are human-controlled and are never auto-modified.

Display the undocumented requirement IDs from `residual_vector.r_to_d.detail.undocumented_requirements`:

```
R->D: {N} requirement(s) undocumented in developer docs:
  - REQ-01
  - REQ-02
  ...
```

Then auto-remediate by dispatching `/qgsd:quick` to generate developer doc entries:

1. Read `.formal/requirements.json` to get the text/description for each undocumented requirement ID.
2. For each undocumented ID, identify the most relevant source file(s) by grepping the codebase for the requirement ID and its key terms (use Grep tool).
3. Group IDs into batches of up to 10.
4. For each batch, dispatch:

```
/qgsd:quick Generate developer doc entries for requirements {IDS}: For each requirement ID, read its text from .formal/requirements.json, read the relevant source files identified by searching for the ID and key terms, then append a new section to docs/dev/requirements-coverage.md (create the file if it does not exist). Each section must follow this format:

## {REQ-ID}: {requirement title or first 80 chars of text}

**Requirement:** {full requirement text}

**Implementation:** {1-3 sentence summary of how the codebase satisfies this requirement, citing specific files/functions}

**Source files:** {comma-separated list of relevant source files}

Do NOT modify docs/ (user docs). Only write to docs/dev/requirements-coverage.md.
```

Wait for each batch to complete before dispatching the next. If a batch fails, log the failure and continue.

Log: `"R->D: dispatching auto-generation for {N} requirement(s) into docs/dev/requirements-coverage.md"`
```

Also update the iteration loop note in Step 5 to include r_to_d in `automatable_residual` now that it has active remediation. Change the comment in Step 5:

Current:
```
- Compute `automatable_residual` = r_to_f + f_to_t + c_to_f + t_to_c + f_to_c (exclude r_to_d and d_to_c which are manual-only)
```

New:
```
- Compute `automatable_residual` = r_to_f + f_to_t + c_to_f + t_to_c + f_to_c + r_to_d (exclude d_to_c which is manual-only)
```

Also update the Step 6 summary table note:

Current:
```
Note: R->D and D->C gaps require manual review.
```

New:
```
Note: R->D gaps are auto-remediated by generating developer doc entries in docs/dev/requirements-coverage.md. D->C gaps (stale file paths, CLI commands, dependencies) require manual review.
```
  </action>
  <verify>
Read the updated solve.md and confirm:
- Step 3f no longer says "Do NOT dispatch any skill — this is informational only"
- Step 3f contains "/qgsd:quick Generate developer doc entries"
- Step 3f mentions "docs/dev/requirements-coverage.md"
- Step 5 automatable_residual includes r_to_d
- Step 6 final note distinguishes R->D (auto) from D->C (manual)
  </verify>
  <done>solve.md Step 3f dispatches /qgsd:quick with requirement text + source file hints; Step 5 iteration loop counts r_to_d in automatable residual; Step 6 note updated; D->C remains informational-only</done>
</task>

</tasks>

<verification>
1. `node bin/qgsd-solve.cjs --report-only --json` runs without error; r_to_d detail shows `doc_files_scanned` = number of files in docs/dev/ only (2 currently)
2. `grep -n "qgsd:quick Generate developer doc" commands/qgsd/solve.md` returns a match in Step 3f
3. `grep -n "informational only" commands/qgsd/solve.md` returns 0 matches for Step 3f (D->C may still have it)
4. `grep -n "automatable_residual.*r_to_d" commands/qgsd/solve.md` returns a match
</verification>

<success_criteria>
- sweepRtoD in bin/qgsd-solve.cjs filters to developer-category docs when available, with fallback to all docs
- Step 3f in solve.md dispatches /qgsd:quick batches with requirement ID, text, and source file hints targeting docs/dev/requirements-coverage.md
- User docs (docs/) are never mentioned as a target for auto-generation
- Step 5 iteration loop correctly includes r_to_d in automatable_residual
- D->C (Step 3g) remains informational-only
</success_criteria>

<output>
After completion, create `.planning/quick/163-add-developer-doc-auto-generation-to-qgs/163-SUMMARY.md`
</output>
