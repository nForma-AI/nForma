---
phase: quick-334
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - core/workflows/model-driven-fix.md
  - commands/nf/solve-remediate.md
  - commands/nf/solve.md
autonomous: true
requirements: []
formal_artifacts: none

must_haves:
  truths:
    - "Phase 5a in model-driven-fix.md dispatches proposed code fix to quorum for unanimous consensus instead of asking the human to apply it"
    - "Phase 5b in model-driven-fix.md auto-dispatches regression remediation via quorum when regressions detected"
    - "Step 3i in solve-remediate.md dispatches reverse-flow candidates to quorum for unanimous consensus instead of asking human"
    - "All three gaps use unanimous (100%) consensus, NOT threshold-based voting"
    - "On dissent, quorum debates and iterates per standard protocol — human escalation only after debate exhaustion"
  artifacts:
    - path: "core/workflows/model-driven-fix.md"
      provides: "Autonomous code-fix gate (5a) and regression auto-remediation (5b)"
      contains: "unanimous"
    - path: "commands/nf/solve-remediate.md"
      provides: "Reverse-flow auto-approval via quorum consensus"
      contains: "unanimous"
    - path: "commands/nf/solve.md"
      provides: "Updated constraint removing discovery-only restriction for reverse flows"
  key_links:
    - from: "core/workflows/model-driven-fix.md Phase 5a"
      to: "nf-quorum-slot-worker dispatch"
      via: "Task(subagent_type=nf-quorum-slot-worker) with unanimous gate"
      pattern: "nf-quorum-slot-worker"
    - from: "commands/nf/solve-remediate.md Step 3i"
      to: "nf-quorum-slot-worker dispatch"
      via: "Task(subagent_type=nf-quorum-slot-worker) with unanimous gate"
      pattern: "nf-quorum-slot-worker"
---

<objective>
Close 3 autonomous formal verification gaps that currently require human intervention, replacing them with unanimous quorum consensus gates.

Purpose: Make the formal verification loop 100% autonomous. Currently, 3 chokepoints pause for human input — code-fix approval, regression remediation, and reverse-flow discovery approval. Each should dispatch to quorum with unanimous consensus requirement, debating on dissent per standard protocol, and only escalating to human as absolute last resort after debate exhaustion.

Output: Updated workflow files (model-driven-fix.md, solve-remediate.md, solve.md) with quorum consensus gates replacing human pauses.
</objective>

<execution_context>
@/Users/jonathanborduas/.claude/nf/workflows/execute-plan.md
@/Users/jonathanborduas/.claude/nf/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@core/workflows/model-driven-fix.md
@commands/nf/solve-remediate.md
@commands/nf/solve.md
@core/workflows/execute-phase.md (reference for unanimous gate pattern — lines 240-257)
@core/references/checkpoints.md (reference for 100% APPROVE pattern)
</context>

<tasks>

<task type="auto">
  <name>Task 1: Replace human pause in model-driven-fix.md Phase 5a and 5b with quorum consensus gates</name>
  <files>core/workflows/model-driven-fix.md</files>
  <action>
Modify Phase 5a (Constrained Fix) and Phase 5b (Cross-Model Regression Check) in model-driven-fix.md.

**Phase 5a — Code-Fix Gate:**

Replace the current human-interactive pattern (lines 317-325: "Fix constraints above. After applying the fix, type 'done' to proceed to neighbor verification.") with a quorum consensus gate:

1. After presenting the constraints block, instead of prompting the user, dispatch the proposed fix to quorum for unanimous approval:

```
**Quorum Code-Fix Gate (autonomous):**

Dispatch the proposed code fix + extracted constraints to quorum for unanimous consensus:

Build quorum question:
  "Review this proposed code fix for bug: {BUG_DESC}
   Constraints from formal model {model_name}:
   {constraint list}
   Simulation status: {converged/not converged/skipped}

   Does this fix satisfy ALL extracted constraints without introducing regressions?
   Vote APPROVE if the fix is sound. Vote BLOCK with specific objection if not."

Dispatch as parallel sibling nf-quorum-slot-worker Tasks (per R3.2):
  - Build $DISPATCH_LIST from active slots
  - Each slot gets the question + constraint context + affected file diffs
  - mode: A, timeout per slot config

Synthesize results, deliberate up to 10 rounds per R3.3.

**Unanimous gate: 100% of valid external voters must vote APPROVE.**
- **APPROVED (unanimous)** -> Auto-apply the fix. Log "Quorum-approved code fix: [summary]". Proceed to Phase 5b.
- **BLOCKED (any BLOCK vote)** -> Quorum debates per standard protocol (slots see prior positions, iterate). Up to max deliberation rounds.
  - If consensus reached after debate -> apply outcome (APPROVE = auto-apply, BLOCK = escalate).
  - If debate exhausted with no consensus -> escalate to human as last resort. Present constraints, dissenting positions, and ask user to decide.
```

Remove the "prompt the user" / "type done" interactive pattern entirely. The fix is auto-applied on unanimous APPROVE.

**Phase 5b — Regression Auto-Remediation:**

After the existing regression detection logic (lines 399-425), when regressions ARE found and $STRICT is false (default), replace the current read-only warning with an autonomous remediation dispatch:

```
**If regressions found and $STRICT is false:**

  Display regression warnings (existing behavior).

  **Auto-Remediation via Quorum Consensus:**

  For each regression in $REGRESSIONS:
    Build quorum question:
      "Regression detected in neighbor model {model_id} ({formalism}): {violation summary}
       Primary fix applied for: {BUG_DESC}
       Constraints: {constraint list}

       Propose a remediation that resolves this regression without reverting the primary fix.
       Vote APPROVE with proposed remediation if feasible. Vote BLOCK if regression requires manual investigation."

    Dispatch as parallel sibling nf-quorum-slot-worker Tasks.
    Synthesize with unanimous gate (100% APPROVE required).

    - **APPROVED (unanimous)** -> Auto-apply the proposed remediation. Log "Quorum-approved regression fix: {model_id}".
    - **BLOCKED or debate exhausted** -> Log warning: "Regression in {model_id} requires manual investigation". Continue to next regression.

  After all regressions processed, proceed to Phase 5c.
```

When $STRICT is true, keep existing behavior (hard block, no auto-remediation).

**Formal invariant compliance:**
- EventualConsensus (quorum invariant): Each quorum dispatch follows WF_vars pattern — enabled slots must eventually fire.
- ResolvedAtWriteOnce (convergence invariant): Fix application is write-once — once quorum approves and fix is applied, the decision is not revisited.
  </action>
  <verify>
    - `grep -n "nf-quorum-slot-worker" core/workflows/model-driven-fix.md` returns matches in Phase 5a and 5b sections
    - `grep -n "unanimous" core/workflows/model-driven-fix.md` returns matches confirming unanimous gate requirement
    - `grep -n "type.*done" core/workflows/model-driven-fix.md` does NOT return the old "type done" interactive prompt
    - `grep -n "debate" core/workflows/model-driven-fix.md` returns matches confirming debate-on-dissent pattern
    - `grep -n "last resort" core/workflows/model-driven-fix.md` returns match confirming human escalation is last resort only
  </verify>
  <done>Phase 5a dispatches code fix to quorum with unanimous gate (auto-apply on consensus, debate on dissent, human only after debate exhaustion). Phase 5b auto-remediates regressions via quorum consensus when not in strict mode. No human-interactive prompts remain in the fix application flow.</done>
</task>

<task type="auto">
  <name>Task 2: Replace human approval in solve-remediate.md Step 3i with quorum consensus gate and update solve.md constraint</name>
  <files>commands/nf/solve-remediate.md, commands/nf/solve.md</files>
  <action>
**solve-remediate.md Step 3i — Reverse-Flow Auto-Approval:**

Replace Phase 2 ("Human Approval (interactive)") in Step 3i (lines 557-590) with a quorum consensus gate. Keep Phase 1 (Discovery) exactly as-is — it remains autonomous discovery.

Replace the current interactive pattern:
```
Accept: [a]ll / [n]one / comma-separated numbers (e.g. 1,3,5) / [s]kip this cycle
Wait for user input via AskUserQuestion.
```

With:

```
**Phase 2 — Quorum Approval (autonomous):**

For each batch of up to 10 candidates (to keep quorum prompts manageable):

  Build quorum question:
    "Review these reverse-traceability candidates discovered by the nForma solver.
     Each candidate is a code module, test, or doc claim that has no requirement backing.
     For each candidate, determine if it represents a GENUINE requirement that should be added to the requirements envelope.

     Candidates:
     {numbered list with source scanner, evidence, candidate description}

     Vote APPROVE with the list of candidate numbers you consider genuine requirements.
     Vote BLOCK if NONE of the candidates are genuine (all are false positives or noise).

     Criteria for genuine: The candidate represents a real user-facing or system capability that the project intentionally provides but has no formal requirement backing."

  Dispatch as parallel sibling nf-quorum-slot-worker Tasks (per R3.2).
  Synthesize results, deliberate up to 10 rounds per R3.3.

  **Unanimous gate: 100% of valid external voters must APPROVE the same candidate set.**
  - **APPROVED (unanimous on candidate set)** -> For each approved candidate, dispatch `/nf:add-requirement` with candidate evidence. Write rejected candidates to `.planning/formal/acknowledged-not-required.json`.
  - **BLOCKED (any BLOCK vote)** -> Quorum debates per standard protocol (slots see prior positions, iterate).
    - If consensus reached after debate -> apply outcome.
    - If debate exhausted with no consensus -> Write ALL candidates in this batch to acknowledged-not-required.json with reason "quorum-no-consensus". Log warning: "Reverse discovery batch: quorum could not reach consensus — candidates shelved. Human review recommended."

  Note: Unlike forward-flow auto-remediation, debate exhaustion here does NOT escalate to human interactively. Instead, candidates are shelved (written to acknowledged-not-required.json) and will not resurface. This keeps the solve loop fully autonomous. The user can review acknowledged-not-required.json at leisure.
```

Log line update: `"Reverse discovery: {N} candidates presented to quorum, {M} approved (unanimous), {K} rejected, {J} shelved (no consensus)"`

**solve.md — Update Constraint 7:**

In the "Important Constraints" section (line 190), replace:
```
7. **Reverse flows are discovery-only** -- C->R, T->R, and D->R never auto-remediate. They surface candidates for human approval. Reverse residuals do NOT count toward the automatable total or affect the convergence check.
```

With:
```
7. **Reverse flows use quorum consensus** -- C->R, T->R, and D->R candidates are discovered autonomously then dispatched to quorum for unanimous consensus approval. On unanimous APPROVE, candidates auto-promote to requirements. On debate exhaustion without consensus, candidates are shelved to acknowledged-not-required.json. Reverse residuals do NOT count toward the automatable total or affect the convergence check.
```

**Formal invariant compliance:**
- EventualConsensus (quorum invariant): Reverse-flow quorum dispatch follows same WF_vars pattern as all other quorum calls.
- EventualTermination (convergence invariant): Shelving on debate exhaustion ensures the solve loop always terminates — no infinite human-wait blocking.
  </action>
  <verify>
    - `grep -n "nf-quorum-slot-worker" commands/nf/solve-remediate.md` returns match in Step 3i section
    - `grep -n "unanimous" commands/nf/solve-remediate.md` returns match confirming unanimous gate
    - `grep -n "AskUserQuestion" commands/nf/solve-remediate.md` does NOT return any match (no interactive human prompts remain)
    - `grep -n "quorum consensus" commands/nf/solve.md` returns match in constraint 7
    - `grep -n "discovery-only" commands/nf/solve.md` does NOT return match (old constraint removed)
    - `grep -n "acknowledged-not-required" commands/nf/solve-remediate.md` returns match confirming shelving behavior on no-consensus
  </verify>
  <done>Step 3i dispatches reverse-flow candidates to quorum with unanimous gate. Approved candidates auto-promote to requirements. No-consensus candidates are shelved (not escalated to human). solve.md constraint 7 updated to reflect quorum consensus pattern instead of discovery-only.</done>
</task>

</tasks>

<verification>
All three gaps closed with consistent pattern:
1. `grep -c "nf-quorum-slot-worker" core/workflows/model-driven-fix.md` >= 2 (Phase 5a + 5b)
2. `grep -c "nf-quorum-slot-worker" commands/nf/solve-remediate.md` >= 1 (Step 3i)
3. `grep -c "unanimous" core/workflows/model-driven-fix.md commands/nf/solve-remediate.md` >= 3 (one per gap)
4. `grep -c "AskUserQuestion\|type.*done" core/workflows/model-driven-fix.md commands/nf/solve-remediate.md` == 0 (no human-interactive prompts in these sections)
5. `grep "quorum consensus" commands/nf/solve.md` confirms updated constraint 7
</verification>

<success_criteria>
- Phase 5a (code-fix gate): Quorum unanimous consensus auto-applies fix, debates on dissent, human escalation only after debate exhaustion
- Phase 5b (regression remediation): Quorum unanimous consensus auto-remediates regressions when not in strict mode
- Step 3i (reverse-flow approval): Quorum unanimous consensus auto-approves genuine candidates, shelves no-consensus candidates
- All three use the same established pattern: parallel nf-quorum-slot-worker dispatch, 100% APPROVE unanimous gate, deliberation on dissent, last-resort escalation
- No AskUserQuestion or interactive human prompts remain in the modified sections
- solve.md constraint 7 reflects the new quorum consensus pattern
</success_criteria>

<output>
After completion, create `.planning/quick/334-close-3-autonomous-formal-verification-g/334-SUMMARY.md`
</output>
