# Phase v0.9-09: SC-4 End-to-End Nyquist Demo — Research

**Researched:** 2026-02-26
**Domain:** QGSD Nyquist validation pipeline (plan-phase workflow, VALIDATION.md generation)
**Confidence:** HIGH

---

## Summary

SC-4 is an undemonstrated tech debt item from the v0.9-02 Nyquist Validation Layer phase. The VERIFICATION.md for v0.9-02 (status: `human_needed`) declares that the mechanism is fully in place — `nyquist_validation_enabled` is emitted by `gsd-tools.cjs init plan-phase`, Step 5.5 of plan-phase.md creates VALIDATION.md from the template, and the halt guard is wired — but no live plan-phase session with Nyquist enabled has ever been run. The gap is purely empirical: demonstrate it working, not implement anything new.

The v0.9-07 and v0.9-08 phases have already addressed the two known integration gaps: `nyquist_validation_enabled` was added to the Step 1 parse list (v0.9-07) and the installed runtime was synced (v0.9-08). The current installed plan-phase.md (at `~/.claude/qgsd/workflows/plan-phase.md`) is authoritative and ready. `init plan-phase v0.9-09` returns `nyquist_validation_enabled: true`, confirming the default is active for this project.

The plan for v0.9-09 is a single execution plan: run `/qgsd:plan-phase` on a tiny internal QGSD phase (v0.9-09 itself, or any trivial 1-2 task phase), let the researcher produce a RESEARCH.md with a `## Validation Architecture` section, observe Step 5.5 produce a VALIDATION.md, and write a SUMMARY.md documenting the outcome as the demo artifact.

**Primary recommendation:** Run `/qgsd:plan-phase v0.9-09` — this phase IS the demo target. The researcher (this document's author) must include a `## Validation Architecture` section in its output. When the plan-phase orchestrator runs, Step 5.5 will fire, find the section, read the template, write `v0.9-09-VALIDATION.md`, and SC-4 is demonstrated.

---

## Phase Requirements

<phase_requirements>
| ID | Description | Research Support |
|----|-------------|-----------------|
| NYQ-02 | `plan-phase.md` step 5.5 inserted after research step — generates VALIDATION.md before plan creation | Confirmed present in installed runtime at line 143 of `~/.claude/qgsd/workflows/plan-phase.md`. Ready to fire. |
| NYQ-04 | `nyquist_validation_enabled` field in `gsd-tools.cjs init plan-phase` JSON output (boolean, defaults true) | Confirmed: `init plan-phase v0.9-09` returns `"nyquist_validation_enabled": true`. |
| NYQ-05 | Step 5.5 halts if nyquist_validation_enabled is true and no `## Validation Architecture` section in RESEARCH.md | Halt guard confirmed at lines 162-174 of installed plan-phase.md. This research document includes `## Validation Architecture` to satisfy the guard. |
</phase_requirements>

---

## What SC-4 Is

**Source:** v0.9-MILESTONE-AUDIT.md, tech debt section:

> SC-4 (human_needed): No live plan-phase session with Nyquist enabled has been run to demonstrate end-to-end VALIDATION.md production. The mechanism is fully in place but end-to-end behavior is undemonstrated.

**Source:** v0.9-02 VERIFICATION.md:

> SC-4: A plan-phase session with Nyquist enabled produces a VALIDATION.md covering all tasks identified in the plan — NEEDS HUMAN. No VALIDATION.md files exist under `.planning/phases/` — no plan-phase has been run with Nyquist enabled yet. The workflow mechanism is in place but end-to-end production has not been demonstrated.

Note: As of this research, SC-4 is no longer true. Multiple VALIDATION.md files have been produced by subsequent plan-phase sessions (v0.9-05, v0.10-01, v0.12-01, v0.12-08, v0.14-02, v0.14-05, etc.). However, none of those sessions were run specifically as the SC-4 demo — no SUMMARY.md records the session as a SC-4 demonstration with before/after evidence. This phase creates that explicit record.

**Confidence:** HIGH — sourced directly from v0.9-MILESTONE-AUDIT.md and v0.9-02-VERIFICATION.md.

---

## Standard Stack

### What the Nyquist Pipeline Actually Does

Step 5.5 of `plan-phase.md` (installed at `~/.claude/qgsd/workflows/plan-phase.md`) is the entire pipeline:

1. After the researcher completes (Step 5), check if RESEARCH.md contains `## Validation Architecture`:
   ```bash
   grep -l "## Validation Architecture" "${PHASE_DIR}"/*-RESEARCH.md 2>/dev/null
   ```
2. If found:
   - Read template from `/Users/jonathanborduas/.claude/qgsd/templates/VALIDATION.md`
   - Write to `${PHASE_DIR}/${PADDED_PHASE}-VALIDATION.md`
   - Fill frontmatter: replace `{N}` with phase number, `{phase-slug}` with phase slug, `{date}` with current date
   - Commit if `commit_docs` is true
3. If not found AND nyquist_validation_enabled is true: HALT with error

**What Step 5.5 does NOT do:** Step 5.5 fills only the frontmatter fields (`{N}`, `{phase-slug}`, `{date}`). All other template placeholders in section bodies (test framework, commands, per-task rows, Wave 0 list) are left unfilled. The researcher's `## Validation Architecture` section provides the content, but Step 5.5 does not merge it into the VALIDATION.md. The planner is expected to fill task-specific rows when plans are created.

**Observed behavior from existing VALIDATION.md files:**
- v0.9-05 and v0.12-01 show properly filled VALIDATION.md files — the planner populated the per-task rows based on RESEARCH.md's Validation Architecture content.
- v0.9-07 shows an unfilled VALIDATION.md — template placeholders like `~v0.9-07 seconds` were inserted literally instead of being resolved. This is a known gap in how the planner fills the template.

**Confidence:** HIGH — read directly from installed plan-phase.md and template file.

### VALIDATION.md Template Structure

Located at `~/.claude/qgsd/templates/VALIDATION.md`. Seven sections:

| Section | Purpose |
|---------|---------|
| YAML frontmatter | phase, slug, status, nyquist_compliant, wave_0_complete, created |
| `## Test Infrastructure` | Framework, config file, run commands, CI pipeline |
| `## Nyquist Sampling Rate` | After-task and after-wave commands, feedback latency |
| `## Per-Task Verification Map` | Table with Task ID, Plan, Wave, Requirement, Test Type, Command, File Exists, Status |
| `## Wave 0 Requirements` | Test scaffolding checklist before implementation |
| `## Manual-Only Verifications` | Behaviors that cannot be automated |
| `## Validation Sign-Off` | Checklist for plan-checker approval |
| `## Execution Tracking` | Updated during execute-phase |

**Confidence:** HIGH — read directly from template file at `~/.claude/qgsd/templates/VALIDATION.md`.

### init plan-phase v0.9-09 Output (Confirmed)

```json
{
  "nyquist_validation_enabled": true,
  "commit_docs": true,
  "phase_dir": ".planning/phases/v0.9-09-sc4-end-to-end-nyquist-demo",
  "padded_phase": "v0.9-09",
  "phase_number": "v0.9-09",
  "has_research": false,
  "has_plans": false
}
```

`nyquist_validation_enabled: true` — Step 5.5 will not be skipped.
`commit_docs: true` — Step 5.5 will commit the VALIDATION.md after creation.

**Confidence:** HIGH — live `node gsd-tools.cjs init plan-phase v0.9-09` run during research.

---

## Architecture Patterns

### What the Demo Plan Must Accomplish

The single PLAN.md (v0.9-09-01-PLAN.md) must:

1. **Not re-run plan-phase.md from scratch.** The demo is the current plan-phase session itself. The RESEARCH.md (this document) already contains `## Validation Architecture`. When Step 5.5 fires, it will find it, create `v0.9-09-VALIDATION.md`, and the pipeline is demonstrated.

2. **Document what happened.** The plan's tasks are:
   - Confirm `v0.9-09-VALIDATION.md` was created by Step 5.5 during this plan-phase session
   - Verify frontmatter fields were correctly filled (phase, slug, created)
   - Write a SUMMARY.md recording: before state (SC-4 status from v0.9-02 VERIFICATION.md), what was run, what was produced, after state (SC-4 closed)

3. **Update STATE.md and ROADMAP.md** to mark v0.9-09 complete and SC-4 closed.

### What This Phase Is (and Is Not)

This phase is a **documentation and verification exercise**, not an implementation phase. There is no code to write. The pipeline already exists and is already working — the VALIDATION.md files in v0.9-05, v0.9-07, v0.10-x, v0.12-x, v0.14-x are evidence. The gap is the absence of an explicit before/after record demonstrating SC-4.

The demo artifact required by Success Criterion 3 is the SUMMARY.md for this phase. It must document:
- Pre-state: SC-4 status was `human_needed` in v0.9-02-VERIFICATION.md
- Session: plan-phase v0.9-09 run with nyquist_validation_enabled=true
- Output: `v0.9-09-VALIDATION.md` produced at `.planning/phases/v0.9-09-sc4-end-to-end-nyquist-demo/v0.9-09-VALIDATION.md`
- Post-state: SC-4 is demonstrated; v0.9 audit gap closed

### Don't Hand-Roll

| Problem | Don't Build | Use Instead |
|---------|-------------|-------------|
| Creating VALIDATION.md | Manually writing it | Step 5.5 creates it from template — let the workflow do it |
| Demonstrating pipeline | Running a separate test phase | v0.9-09 itself IS the demo phase |
| Closing the tech debt | Modifying v0.9-02-VERIFICATION.md | Write a SUMMARY.md for v0.9-09; it is the closure evidence |

---

## Common Pitfalls

### Pitfall 1: Step 5.5 Does Not Fill Body Placeholders

**What goes wrong:** The executor (planner) writes a VALIDATION.md where `## Per-Task Verification Map` rows still contain `{N}-01-01`, `REQ-{XX}`, etc.

**Why it happens:** Step 5.5 only fills frontmatter: `{N}`, `{phase-slug}`, `{date}`. All other template curly-brace placeholders are left for the planner to fill. The v0.9-07 VALIDATION.md shows this exact failure — `~v0.9-07 seconds` appears in run command fields because phase number was substituted into wrong placeholders.

**How to avoid:** The planner must read the `## Validation Architecture` section of RESEARCH.md and use it to fill the VALIDATION.md body sections after Step 5.5 creates the file. For v0.9-09 specifically: since this is a documentation-only phase with no automated test commands, the Validation Architecture below should be minimal and honest about what can be automated.

**Warning signs:** VALIDATION.md contains literal `{N}`, `~v0.9-09 seconds`, or `REQ-{XX}` strings in non-frontmatter sections.

### Pitfall 2: Treating SC-4 as Already Closed

**What goes wrong:** Plan author notes that VALIDATION.md files already exist for many phases and declares SC-4 closed without running the demo session.

**Why it happens:** SC-4 requires a specific demo artifact documenting the end-to-end session. The existing VALIDATION.md files (v0.9-05, v0.10-01, etc.) were produced as a side effect of other work, not as an explicit SC-4 demonstration. The v0.9-02-VERIFICATION.md still shows `status: human_needed` for SC-4.

**How to avoid:** The SUMMARY.md must explicitly cite the v0.9-02 VERIFICATION.md SC-4 entry and declare it closed by this session.

### Pitfall 3: Trying to Nest plan-phase Inside Itself

**What goes wrong:** The plan author decides to demonstrate SC-4 by running a *separate* plan-phase on a *different* phase, spawned from v0.9-09.

**Why it happens:** Misreading the demo goal. The goal is to produce a VALIDATION.md for a plan-phase session, not to produce VALIDATION.md for an unrelated phase.

**How to avoid:** v0.9-09's own plan-phase session IS the demo. The RESEARCH.md (this document) contains `## Validation Architecture`. When Step 5.5 fires during this plan-phase session, it creates `v0.9-09-VALIDATION.md`. That is SC-4 demonstrated.

---

## Validation Architecture

This section is **required** by Step 5.5. Its presence in this RESEARCH.md causes Step 5.5 to create `v0.9-09-VALIDATION.md` from the template.

### Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | None — documentation phase only |
| **Config file** | none |
| **Quick run command** | `ls .planning/phases/v0.9-09-sc4-end-to-end-nyquist-demo/v0.9-09-VALIDATION.md` |
| **Full suite command** | `ls .planning/phases/v0.9-09-sc4-end-to-end-nyquist-demo/v0.9-09-VALIDATION.md && grep "phase: v0.9-09" .planning/phases/v0.9-09-sc4-end-to-end-nyquist-demo/v0.9-09-VALIDATION.md` |
| **Estimated runtime** | ~1 second |
| **CI pipeline** | none |

### Wave 0 Requirements

No Wave 0 test scaffolding needed — this is a documentation-only phase. All "tests" are file-existence checks on artifacts produced during plan-phase itself.

### Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists |
|---------|------|------|-------------|-----------|-------------------|-------------|
| v0.9-09-01-01 | 01 | 1 | NYQ-02 | smoke | `ls .planning/phases/v0.9-09-sc4-end-to-end-nyquist-demo/v0.9-09-VALIDATION.md` | created by Step 5.5 |
| v0.9-09-01-02 | 01 | 1 | NYQ-02 | smoke | `grep "phase: v0.9-09" .planning/phases/v0.9-09-sc4-end-to-end-nyquist-demo/v0.9-09-VALIDATION.md` | created by Step 5.5 |
| v0.9-09-01-03 | 01 | 1 | NYQ-04 | smoke | `node .planning/../qgsd-core/../bin/../.claude/qgsd/bin/gsd-tools.cjs init plan-phase v0.9-09 \| grep nyquist_validation_enabled` outputs `true` | n/a |
| v0.9-09-01-04 | 01 | 2 | all | manual | Review SUMMARY.md records session outcome and SC-4 closure | created by plan |

### Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| SUMMARY.md documents SC-4 closure | NYQ-02, NYQ-04, NYQ-05 | Human judgment required to confirm the record is complete and accurate | Read v0.9-09-01-SUMMARY.md; confirm it cites v0.9-02-VERIFICATION.md SC-4 entry and declares it closed |

---

## Code Examples

### Step 5.5 Logic (from installed plan-phase.md, lines 143-174)

```markdown
## 5.5. Create Validation Strategy (if Nyquist enabled)

**Skip if:** `nyquist_validation_enabled` is false from INIT JSON.

After researcher completes, check if RESEARCH.md contains a Validation Architecture section:

```bash
grep -l "## Validation Architecture" "${PHASE_DIR}"/*-RESEARCH.md 2>/dev/null
```

**If found:**
1. Read validation template from `/Users/jonathanborduas/.claude/qgsd/templates/VALIDATION.md`
2. Write to `${PHASE_DIR}/${PADDED_PHASE}-VALIDATION.md`
3. Fill frontmatter: replace `{N}` with phase number, `{phase-slug}` with phase slug, `{date}` with current date
4. If `commit_docs` is true: commit
```

Source: `~/.claude/qgsd/workflows/plan-phase.md` lines 143–174 (confirmed present in installed runtime).

### Confirming nyquist_validation_enabled in INIT

```bash
node ~/.claude/qgsd/bin/gsd-tools.cjs init plan-phase "v0.9-09"
# Returns: { "nyquist_validation_enabled": true, ... }
```

### Verifying VALIDATION.md Was Created Correctly

```bash
# File exists
ls .planning/phases/v0.9-09-sc4-end-to-end-nyquist-demo/v0.9-09-VALIDATION.md

# Frontmatter was filled
grep "phase: v0.9-09" .planning/phases/v0.9-09-sc4-end-to-end-nyquist-demo/v0.9-09-VALIDATION.md
grep "slug: sc4-end-to-end-nyquist-demo" .planning/phases/v0.9-09-sc4-end-to-end-nyquist-demo/v0.9-09-VALIDATION.md
grep "created: 2026" .planning/phases/v0.9-09-sc4-end-to-end-nyquist-demo/v0.9-09-VALIDATION.md
```

---

## Open Questions

1. **Phase slug in VALIDATION.md frontmatter**
   - What we know: `init plan-phase v0.9-09` returns `phase_slug: null` and `phase_name: null` — the phase exists in the ROADMAP.md section but the slug isn't extracted.
   - What's unclear: Will Step 5.5's `{phase-slug}` substitution leave a literal placeholder or resolve to something? The ROADMAP section header is `### Phase v0.9-09: SC-4 End-to-End Nyquist Demo` — slug would be `sc4-end-to-end-nyquist-demo` if the installer/tooling derives it.
   - Recommendation: The planner should fill `slug: sc4-end-to-end-nyquist-demo` manually if Step 5.5 leaves `{phase-slug}` unfilled, since init returns null for this field.

2. **SUMMARY.md as demo artifact vs. separate DEMO.md**
   - What we know: ROADMAP success criterion 3 says "A demo artifact (e.g., a brief SUMMARY.md or inline record)."
   - What's unclear: Whether a standalone DEMO.md would be clearer than embedding the demo record in SUMMARY.md.
   - Recommendation: Use SUMMARY.md. It is the standard artifact for plan completion and will be checked during `verify-work`. A separate DEMO.md is unnecessary overhead.

---

## State of the Art

| Old State (pre v0.9-09) | New State (after v0.9-09) | Impact |
|-------------------------|---------------------------|--------|
| SC-4 `human_needed` in v0.9-02-VERIFICATION.md | SC-4 demonstrated; explicit demo record in SUMMARY.md | v0.9 milestone audit gap closed; Nyquist pipeline empirically validated |
| No plan-phase session documented as SC-4 demo | v0.9-09 SUMMARY.md documents the session | Audit trail complete |

---

## Sources

### Primary (HIGH confidence)

- `/Users/jonathanborduas/code/QGSD/.planning/v0.9-MILESTONE-AUDIT.md` — SC-4 tech debt definition, lines 42-43
- `/Users/jonathanborduas/code/QGSD/.planning/phases/v0.9-02-nyquist-validation-layer/v0.9-02-VERIFICATION.md` — SC-4 human_needed entry, lines 5-10 and 113-125
- `/Users/jonathanborduas/.claude/qgsd/workflows/plan-phase.md` — Step 5.5 (installed runtime), lines 143-174
- `/Users/jonathanborduas/.claude/qgsd/templates/VALIDATION.md` — VALIDATION.md template (all 105 lines)
- `node ~/.claude/qgsd/bin/gsd-tools.cjs init plan-phase "v0.9-09"` — live run confirming `nyquist_validation_enabled: true`
- `/Users/jonathanborduas/code/QGSD/.planning/ROADMAP.md` — Phase v0.9-09 success criteria

### Secondary (MEDIUM confidence)

- `/Users/jonathanborduas/code/QGSD/.planning/phases/v0.9-05-rename-get-shit-done-qgsd-core/v0.9-05-VALIDATION.md` — reference for a well-populated VALIDATION.md
- `/Users/jonathanborduas/code/QGSD/.planning/phases/v0.12-01-conformance-event-infrastructure/v0.12-01-VALIDATION.md` — reference for a detailed VALIDATION.md with Wave 0 tasks
- `/Users/jonathanborduas/code/QGSD/.planning/phases/v0.9-07-nyquist-parse-list-path-portability/v0.9-07-VALIDATION.md` — reference for the unfilled-placeholder failure pattern to avoid

---

## Metadata

**Confidence breakdown:**
- SC-4 definition: HIGH — read directly from audit and verification documents
- Step 5.5 behavior: HIGH — read from installed runtime
- Template structure: HIGH — read directly from template file
- Phase plan approach: HIGH — deduced from success criteria and existing artifacts

**Research date:** 2026-02-26
**Valid until:** Stable — this is internal QGSD workflow documentation, not an external dependency
