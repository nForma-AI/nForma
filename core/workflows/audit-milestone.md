<purpose>
Verify milestone achieved its definition of done by aggregating phase verifications, checking cross-phase integration, and assessing requirements coverage. Reads existing VERIFICATION.md files (phases already verified during execute-phase), aggregates tech debt and deferred gaps, then spawns integration checker for cross-phase wiring.
</purpose>

<required_reading>
Read all files referenced by the invoking prompt's execution_context before starting.
</required_reading>

<process>

## 0. Initialize Milestone Context

Parse $ARGUMENTS for:
- Version number (optional — defaults to current milestone)
- `--auto` flag → store as `$AUTO_MODE` (true/false)

If `$AUTO_MODE`:
  Set `MAX_ITERATIONS=3`
  Set `current_iteration` from `--iteration N` argument (default 0)

```bash
INIT=$(node ~/.claude/qgsd/bin/gsd-tools.cjs init milestone-op)
```

Extract from init JSON: `milestone_version`, `milestone_name`, `phase_count`, `completed_phases`, `commit_docs`.

Resolve integration checker model:
```bash
CHECKER_MODEL=$(node ~/.claude/qgsd/bin/gsd-tools.cjs resolve-model qgsd-integration-checker --raw)
```

## 1. Determine Milestone Scope

```bash
# Get phases in milestone (sorted numerically, handles decimals)
node ~/.claude/qgsd/bin/gsd-tools.cjs phases list
```

- Parse version from arguments or detect current from ROADMAP.md
- Identify all phase directories in scope
- Extract milestone definition of done from ROADMAP.md
- Extract requirements mapped to this milestone from REQUIREMENTS.md

## 2. Read All Phase Verifications

For each phase directory, read the VERIFICATION.md:

```bash
# For each phase, use find-phase to resolve the directory (handles archived phases)
PHASE_INFO=$(node ~/.claude/qgsd/bin/gsd-tools.cjs find-phase 01 --raw)
# Extract directory from JSON, then read VERIFICATION.md from that directory
# Repeat for each phase number from ROADMAP.md
```

From each VERIFICATION.md, extract:
- **Status:** passed | gaps_found
- **Critical gaps:** (if any — these are blockers)
- **Non-critical gaps:** tech debt, deferred items, warnings
- **Anti-patterns found:** TODOs, stubs, placeholders
- **Requirements coverage:** which requirements satisfied/blocked

If a phase is missing VERIFICATION.md, flag it as "unverified phase" — this is a blocker.

### 2b. Classify Missing Phases

For any phase with no directory at all, determine whether a plan already exists:

```bash
# Check quick tasks for a plan referencing this phase
ls .planning/quick/*/
# Check if phase plan exists but was never executed
node ~/.claude/qgsd/bin/gsd-tools.cjs find-phase {N} --raw
```

Classify each missing phase as:
- **`plan_exists_not_executed`** — a PLAN.md exists in `.planning/quick/` or a phase plan directory with no SUMMARY.md → plan ready, never run
- **`missing_no_plan`** — no plan found anywhere → needs planning before execution

Track this classification for routing in Step 7.

## 3. Spawn Integration Checker

With phase context collected:

Extract `MILESTONE_REQ_IDS` from REQUIREMENTS.md traceability table — all REQ-IDs assigned to phases in this milestone.

```
Task(
  prompt="Check cross-phase integration and E2E flows.

Phases: {phase_dirs}
Phase exports: {from SUMMARYs}
API routes: {routes created}

Milestone Requirements:
{MILESTONE_REQ_IDS — list each REQ-ID with description and assigned phase}

MUST map each integration finding to affected requirement IDs where applicable.

Verify cross-phase wiring and E2E user flows.",
  subagent_type="qgsd-integration-checker",
  model="{integration_checker_model}",
  description="Audit milestone: integration check"
)
```

## 4. Collect Results

Combine:
- Phase-level gaps and tech debt (from step 2)
- Integration checker's report (wiring gaps, broken flows)

## 5. Check Requirements Coverage (3-Source Cross-Reference)

MUST cross-reference three independent sources for each requirement:

### 5a. Parse REQUIREMENTS.md Traceability Table

Extract all REQ-IDs mapped to milestone phases from the traceability table:
- Requirement ID, description, assigned phase, current status, checked-off state (`[x]` vs `[ ]`)

### 5b. Parse Phase VERIFICATION.md Requirements Tables

For each phase's VERIFICATION.md, extract the expanded requirements table:
- Requirement | Source Plan | Description | Status | Evidence
- Map each entry back to its REQ-ID

### 5c. Extract SUMMARY.md Frontmatter Cross-Check

For each phase's SUMMARY.md, extract `requirements-completed` from YAML frontmatter:
```bash
for summary in .planning/phases/*-*/*-SUMMARY.md; do
  node ~/.claude/qgsd/bin/gsd-tools.cjs summary-extract "$summary" --fields requirements_completed | jq -r '.requirements_completed'
done
```

### 5d. Status Determination Matrix

For each REQ-ID, determine status using all three sources:

| VERIFICATION.md Status | SUMMARY Frontmatter | REQUIREMENTS.md | → Final Status |
|------------------------|---------------------|-----------------|----------------|
| passed                 | listed              | `[x]`           | **satisfied**  |
| passed                 | listed              | `[ ]`           | **satisfied** (update checkbox) |
| passed                 | missing             | any             | **partial** (verify manually) |
| gaps_found             | any                 | any             | **unsatisfied** |
| missing                | listed              | any             | **partial** (verification gap) |
| missing                | missing             | any             | **unsatisfied** |

### 5e. FAIL Gate and Orphan Detection

**REQUIRED:** Any `unsatisfied` requirement MUST force `gaps_found` status on the milestone audit.

**Orphan detection:** Requirements present in REQUIREMENTS.md traceability table but absent from ALL phase VERIFICATION.md files MUST be flagged as orphaned. Orphaned requirements are treated as `unsatisfied` — they were assigned but never verified by any phase.

## 6. Aggregate into v{version}-MILESTONE-AUDIT.md

Create `.planning/milestones/v{version}-MILESTONE-AUDIT.md` with:

> **Legacy compat:** If `.planning/milestones/` does not exist (pre-v0.27 project), write to `.planning/v{version}-MILESTONE-AUDIT.md` instead. The migration script will auto-relocate it.

```yaml
---
milestone: {version}
audited: {timestamp}
status: passed | gaps_found | tech_debt
scores:
  requirements: N/M
  phases: N/M
  integration: N/M
  flows: N/M
gaps:  # Critical blockers
  requirements:
    - id: "{REQ-ID}"
      status: "unsatisfied | partial | orphaned"
      phase: "{assigned phase}"
      claimed_by_plans: ["{plan files that reference this requirement}"]
      completed_by_plans: ["{plan files whose SUMMARY marks it complete}"]
      verification_status: "passed | gaps_found | missing | orphaned"
      evidence: "{specific evidence or lack thereof}"
  integration: [...]
  flows: [...]
tech_debt:  # Non-critical, deferred
  - phase: 01-auth
    items:
      - "TODO: add rate limiting"
      - "Warning: no password strength validation"
  - phase: 03-dashboard
    items:
      - "Deferred: mobile responsive layout"
---
```

Plus full markdown report with tables for requirements, phases, integration, tech debt.

**Status values:**
- `passed` — all requirements met, no critical gaps, minimal tech debt
- `gaps_found` — critical blockers exist
- `tech_debt` — no blockers but accumulated deferred items need review

## 6b. Update STATE.md

After writing the MILESTONE-AUDIT.md artifact, update STATE.md with the audit result:

```bash
node ~/.claude/qgsd/bin/gsd-tools.cjs state record-session \
  --stopped-at "Milestone ${MILESTONE_VERSION} audit: ${AUDIT_STATUS} (${REQUIREMENTS_SATISFIED}/${REQUIREMENTS_TOTAL} requirements)" \
  --resume-file "None"
```

Where:
- `AUDIT_STATUS` is `passed`, `gaps_found`, or `tech_debt` (from Step 6 status determination)
- `REQUIREMENTS_SATISFIED` is the count of requirements with status `satisfied`
- `REQUIREMENTS_TOTAL` is the total requirement count for the milestone

## 7. Present Results

Route by status (see `<offer_next>`).

</process>

<offer_next>

## Auto-Loop Mode ($AUTO_MODE = true)

**If `$AUTO_MODE`:** Use this section instead of the interactive routing below.

Display:
```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 QGSD ► AUTO-COMPLETE MILESTONE (iteration {current_iteration}/{MAX_ITERATIONS})
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

◆ Audit status: {AUDIT_STATUS} ({REQUIREMENTS_SATISFIED}/{REQUIREMENTS_TOTAL} requirements)
```

### Auto: If passed

Display: `◆ Audit passed — auto-completing milestone {version}...`

```
Task(
  prompt="Run /nf:complete-milestone {version}
  Follow @~/.claude/qgsd/workflows/complete-milestone.md end-to-end.",
  subagent_type="general-purpose",
  description="Auto-complete: milestone {version}"
)
```

Display final result and exit.

### Auto: If tech_debt

Treat `tech_debt` as `gaps_found` — tech debt items are gaps that need closure before the milestone can complete.

Display: `◆ Audit found tech debt — treating as gaps for auto-closure...`

Fall through to the gaps_found path below.

### Auto: If gaps_found (also handles tech_debt)

Increment `current_iteration`.

**Safety check — MAX_ITERATIONS:**

If `current_iteration > MAX_ITERATIONS` (3):

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 QGSD ► AUTO-COMPLETE HALTED (iteration {current_iteration}/{MAX_ITERATIONS})
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

◆ Max iterations reached. Remaining gaps:

{list of unsatisfied requirements and integration gaps}

Investigate manually:
  cat .planning/milestones/v{version}-MILESTONE-AUDIT.md
  /nf:plan-milestone-gaps
  /nf:complete-milestone {version}  (accept current state)
```

HALT. Do NOT continue looping.

**Safety check — User gate after iteration 2:**

If `current_iteration == 2`:

```
AskUserQuestion(
  header: "Continue?",
  question: "Auto-complete iteration 2/3 complete — gaps remain. Continue to iteration 3?",
  options: [
    { label: "Yes, continue", description: "Attempt one more gap closure cycle" },
    { label: "Abort", description: "Stop here, investigate manually" }
  ],
  multiSelect: false
)
```

If "Abort" → halt with current state summary and manual next steps.

**Gap closure — Step 1: Run /nf:solve to close consistency gaps**

Before planning new phases, run `/nf:solve` to auto-remediate consistency-level gaps
(F→C, T→C, R→D, D→C, P→F, etc.). Many audit gaps stem from stale formal models,
missing test coverage, or requirement drift — solve handles these without new phases.

Display: `◆ Running /nf:solve to close consistency gaps before planning...`

```
Task(
  prompt="Run /nf:solve

  Context: Milestone {version} audit found gaps. Run the full 8-layer solve pipeline
  to auto-remediate consistency gaps before we plan structural gap-closure phases.

  Follow @~/.claude/qgsd/workflows/solve.md end-to-end.",
  subagent_type="general-purpose",
  description="Auto-complete: solve consistency gaps (iteration {current_iteration})"
)
```

After solve completes, display: `◆ Solve complete. Proceeding to gap classification...`

**Gap closure — Step 2: Pre-routing check:**

Check gap classification from Step 2b:

- If ALL unsatisfied requirements are from phases classified as `plan_exists_not_executed`:
  → Display: `◆ All gap phases have plans — auto-executing...`
  → Auto-execute each phase (lowest first):
  ```
  Task(
    prompt="Run /nf:execute-phase {phase} --auto",
    subagent_type="general-purpose",
    description="Auto-complete: execute gap phase {phase} (iteration {current_iteration})"
  )
  ```
  → After all execute, re-audit by invoking:
  ```
  SlashCommand("/nf:audit-milestone {version} --auto --iteration {current_iteration}")
  ```

- If ANY phase is `missing_no_plan`:
  → Display: `◆ Gap phases need planning — auto-spawning plan-milestone-gaps...`
  → Spawn plan-milestone-gaps:
  ```
  Task(
    prompt="Run /nf:plan-milestone-gaps --auto

  Audit file: .planning/milestones/v{version}-MILESTONE-AUDIT.md
  Milestone: {version}
  Missing phases (no plan): {list of missing_no_plan phase names and their unsatisfied requirements}

  Follow @~/.claude/qgsd/workflows/plan-milestone-gaps.md to create gap closure phases.
  plan-milestone-gaps Step 10 will auto-spawn plan-phase for the first gap phase.
  After planning, execute all gap phases.",
    subagent_type="general-purpose",
    description="Auto-complete: plan & execute gaps (iteration {current_iteration})"
  )
  ```
  → After plan-milestone-gaps completes (which triggers plan-phase → execute → transition chain):
  → Re-audit by invoking:
  ```
  SlashCommand("/nf:audit-milestone {version} --auto --iteration {current_iteration}")
  ```

---

## Interactive Mode ($AUTO_MODE = false)

Output this markdown directly (not as a code block). Route based on status:

**Pre-routing check (gaps_found only):** Before using the standard gaps_found output, check gap classification from Step 2b:

- If ALL unsatisfied requirements are from phases classified as `plan_exists_not_executed` (zero `missing_no_plan` phases):
  → Present the audit summary (gaps, cross-phase issues, broken flows)
  → Then **auto-execute**: follow `@~/.claude/qgsd/workflows/execute-phase.md` for each missing phase in sequence (lowest phase number first)
  → After all executions complete, re-run the audit check and present the final result
  → Do NOT show the `/nf:plan-milestone-gaps` suggestion

- If ANY phase is `missing_no_plan`: use standard gaps_found routing below

---

**If passed:**

## ✓ Milestone {version} — Audit Passed

**Score:** {N}/{M} requirements satisfied
**Report:** .planning/milestones/v{version}-MILESTONE-AUDIT.md

All requirements covered. Cross-phase integration verified. E2E flows complete.

───────────────────────────────────────────────────────────────

## ▶ Next Up

**Complete milestone** — archive and tag

/nf:complete-milestone {version}

<sub>/clear first → fresh context window</sub>

───────────────────────────────────────────────────────────────

---

**If gaps_found:**

## ⚠ Milestone {version} — Gaps Found

**Score:** {N}/{M} requirements satisfied
**Report:** .planning/milestones/v{version}-MILESTONE-AUDIT.md

### Unsatisfied Requirements

{For each unsatisfied requirement:}
- **{REQ-ID}: {description}** (Phase {X})
  - {reason}

### Cross-Phase Issues

{For each integration gap:}
- **{from} → {to}:** {issue}

### Broken Flows

{For each flow gap:}
- **{flow name}:** breaks at {step}

───────────────────────────────────────────────────────────────

## ▶ Next Up

**Planning gap closure phases** — auto-spawning planner

```
Task(
  prompt="Run /nf:plan-milestone-gaps workflow.

Audit file: .planning/v{version}-MILESTONE-AUDIT.md
Milestone: {version}
Missing phases (no plan): {list of missing_no_plan phase names and their unsatisfied requirements}

Follow @~/.claude/qgsd/workflows/plan-milestone-gaps.md to create gap closure phases in ROADMAP.md.",
  subagent_type="general-purpose",
  description="Plan milestone gaps: {version}"
)
```

───────────────────────────────────────────────────────────────

**Also available:**
- cat .planning/v{version}-MILESTONE-AUDIT.md — see full report
- /nf:complete-milestone {version} — proceed anyway (accept tech debt)

───────────────────────────────────────────────────────────────

---

**If tech_debt (no blockers but accumulated debt):**

## ⚡ Milestone {version} — Tech Debt Review

**Score:** {N}/{M} requirements satisfied
**Report:** .planning/milestones/v{version}-MILESTONE-AUDIT.md

All requirements met. No critical blockers. Accumulated tech debt needs review.

### Tech Debt by Phase

{For each phase with debt:}
**Phase {X}: {name}**
- {item 1}
- {item 2}

### Total: {N} items across {M} phases

───────────────────────────────────────────────────────────────

## ▶ Options

**A. Complete milestone** — accept debt, track in backlog

/nf:complete-milestone {version}

**B. Plan cleanup phase** — address debt before completing

/nf:plan-milestone-gaps

<sub>/clear first → fresh context window</sub>

───────────────────────────────────────────────────────────────
</offer_next>

<success_criteria>
- [ ] Milestone scope identified
- [ ] All phase VERIFICATION.md files read
- [ ] SUMMARY.md `requirements-completed` frontmatter extracted for each phase
- [ ] REQUIREMENTS.md traceability table parsed for all milestone REQ-IDs
- [ ] 3-source cross-reference completed (VERIFICATION + SUMMARY + traceability)
- [ ] Orphaned requirements detected (in traceability but absent from all VERIFICATIONs)
- [ ] Tech debt and deferred gaps aggregated
- [ ] Integration checker spawned with milestone requirement IDs
- [ ] v{version}-MILESTONE-AUDIT.md created with structured requirement gap objects
- [ ] FAIL gate enforced — any unsatisfied requirement forces gaps_found status
- [ ] Missing phases classified as plan_exists_not_executed vs missing_no_plan (Step 2b)
- [ ] If all gaps are executable: auto-execute phases then re-audit instead of routing to plan-milestone-gaps
- [ ] Results presented with actionable next steps
- [ ] (--auto) `$AUTO_MODE` parsed from arguments
- [ ] (--auto) If passed → auto-invoke complete-milestone
- [ ] (--auto) If tech_debt → auto-invoke complete-milestone (accept debt)
- [ ] (--auto) If gaps_found → auto plan-gaps → execute → re-audit loop
- [ ] (--auto) MAX_ITERATIONS=3 enforced (hard halt)
- [ ] (--auto) User confirmation gate after iteration 2
- [ ] (--auto) Iteration counter passed via --iteration flag across re-invocations
</success_criteria>
