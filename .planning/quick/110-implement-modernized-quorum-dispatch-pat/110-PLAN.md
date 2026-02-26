---
phase: quick-110
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - commands/qgsd/quorum.md
  - qgsd-core/workflows/quick.md
  - qgsd-core/workflows/discuss-phase.md
  - qgsd-core/workflows/execute-phase.md
  - qgsd-core/workflows/plan-phase.md
  - agents/qgsd-quorum-slot-worker.md
autonomous: true
requirements: [QUICK-110]

must_haves:
  truths:
    - "Every qgsd-quorum-slot-worker Task dispatch includes model=\"haiku\""
    - "Deliberation rounds (R2+) pass skip_context_reads: true in the YAML block — slot-worker skips re-reading CLAUDE.md, STATE.md, artifact on rounds after the first"
    - "All five dispatch sites are updated consistently — quorum.md, quick.md, discuss-phase.md, execute-phase.md, plan-phase.md"
    - "Slot-worker agent documents the skip_context_reads behavior — step 2 is skipped when this flag is true and round > 1"
  artifacts:
    - path: "commands/qgsd/quorum.md"
      provides: "Primary quorum dispatch — Round 1 and deliberation rounds updated with haiku + skip flag"
      contains: "model=\"haiku\""
    - path: "agents/qgsd-quorum-slot-worker.md"
      provides: "Slot-worker agent with skip_context_reads handling documented"
      contains: "skip_context_reads"
    - path: "qgsd-core/workflows/quick.md"
      provides: "Quick workflow quorum dispatch updated with haiku"
      contains: "model=\"haiku\""
    - path: "qgsd-core/workflows/discuss-phase.md"
      provides: "Discuss-phase quorum dispatch updated with haiku"
      contains: "model=\"haiku\""
    - path: "qgsd-core/workflows/execute-phase.md"
      provides: "Execute-phase quorum dispatch updated with haiku"
      contains: "model=\"haiku\""
    - path: "qgsd-core/workflows/plan-phase.md"
      provides: "Plan-phase quorum dispatch updated with haiku"
      contains: "model=\"haiku\""
  key_links:
    - from: "commands/qgsd/quorum.md (deliberation rounds)"
      to: "agents/qgsd-quorum-slot-worker.md (step 2 skip logic)"
      via: "skip_context_reads: true in YAML block"
      pattern: "skip_context_reads"
---

<objective>
Modernize the quorum slot-worker dispatch pattern with two efficiency improvements:
(1) Add `model="haiku"` to all slot-worker Task calls — workers are orchestrators not reasoners,
haiku is faster and cheaper with zero quality loss.
(2) Add `skip_context_reads: true` to deliberation round YAML blocks — slot-workers skip redundant
re-reads of CLAUDE.md, STATE.md, and artifact on rounds after Round 1. Maintains stateless
one-shot worker design while eliminating repeated file reads on every deliberation round.

Purpose: Reduce deliberation latency and haiku token cost. For a 3-round deliberation with 4 slots,
this eliminates ~8 redundant file reads (CLAUDE.md ~150L, STATE.md ~140L per re-read).
Output: Updated quorum.md + slot-worker agent + 4 workflow files.

Quorum consensus: Round 2 deliberation reached consensus on option (b) — narrower scope for Task 2.
Full persistent agent redesign with AWAITING_NEXT_ROUND + resume= was blocked by Gemini as overly
complex. Simple skip_context_reads flag approach was approved by all available models.
</objective>

<execution_context>
@/Users/jonathanborduas/.claude/qgsd/workflows/execute-plan.md
@/Users/jonathanborduas/.claude/qgsd/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/ROADMAP.md
@.planning/STATE.md
@commands/qgsd/quorum.md
@agents/qgsd-quorum-slot-worker.md
@qgsd-core/workflows/quick.md
@qgsd-core/workflows/discuss-phase.md
@qgsd-core/workflows/execute-phase.md
@qgsd-core/workflows/plan-phase.md
</context>

<tasks>

<task type="auto">
  <name>Task 1: Add model="haiku" to all slot-worker Task dispatches</name>
  <files>
    commands/qgsd/quorum.md
    qgsd-core/workflows/quick.md
    qgsd-core/workflows/discuss-phase.md
    qgsd-core/workflows/execute-phase.md
    qgsd-core/workflows/plan-phase.md
  </files>
  <action>
In each file, find every `Task(subagent_type="qgsd-quorum-slot-worker", ...)` call or prose
description referencing a qgsd-quorum-slot-worker Task dispatch, and add `model="haiku"`.

Rationale to document inline (in code blocks where applicable):
"model=\"haiku\" — slot-workers are orchestrators (read files, build prompt, run Bash subprocess),
NOT reasoners. The actual reasoning is done by the external CLI. Haiku is faster with zero quality loss."

**Specific sites to update:**

commands/qgsd/quorum.md — find all Task() call examples with subagent_type="qgsd-quorum-slot-worker":
  1. Mode A Round 1 dispatch example block — add `model="haiku",` after subagent_type parameter
  2. Mode A deliberation dispatch block — same
  3. Mode B Round 1 dispatch example block — same
  4. Mode B deliberation dispatch block — same
  All four blocks have the same Task() call structure; add model="haiku" to each.

qgsd-core/workflows/quick.md — two quorum checkpoints described in prose:
  1. Near "Mode B — artifact review" / "Dispatch all active slots as sibling `qgsd-quorum-slot-worker` Tasks"
  2. Near "human_needed" filter / "Dispatch all active slots as sibling `qgsd-quorum-slot-worker` Tasks"
  Update prose to: "Dispatch all active slots as sibling `qgsd-quorum-slot-worker` Tasks with
  `model=\"haiku\"` (one per slot)"

qgsd-core/workflows/discuss-phase.md — two R4 pre-filter quorum dispatches in prose:
  Both lines say "Dispatch all active slots as sibling `qgsd-quorum-slot-worker` Tasks (one per slot)"
  Update both to add `model="haiku"`.

qgsd-core/workflows/execute-phase.md — two quorum checkpoints in prose:
  Same pattern. Update both.

qgsd-core/workflows/plan-phase.md — one quorum dispatch in prose:
  Same pattern. Update it.

Do NOT add `model="haiku"` to non-slot-worker Tasks (qgsd-executor, qgsd-planner, qgsd-verifier,
qgsd-plan-checker, qgsd-executor, general-purpose, etc.) — those use config-driven models.
  </action>
  <verify>
grep -n 'model="haiku"' /Users/jonathanborduas/code/QGSD/commands/qgsd/quorum.md
grep -n 'haiku' /Users/jonathanborduas/code/QGSD/qgsd-core/workflows/quick.md
grep -n 'haiku' /Users/jonathanborduas/code/QGSD/qgsd-core/workflows/discuss-phase.md
grep -n 'haiku' /Users/jonathanborduas/code/QGSD/qgsd-core/workflows/execute-phase.md
grep -n 'haiku' /Users/jonathanborduas/code/QGSD/qgsd-core/workflows/plan-phase.md
  </verify>
  <done>
All 5 files contain `haiku` references at every qgsd-quorum-slot-worker dispatch site. No
non-slot-worker Tasks were given model="haiku". grep confirms presence in each file.
  </done>
</task>

<task type="auto">
  <name>Task 2: Add skip_context_reads flag for deliberation rounds</name>
  <files>
    commands/qgsd/quorum.md
    agents/qgsd-quorum-slot-worker.md
  </files>
  <action>
**Context:** On every deliberation round (R2+), the slot-worker currently re-reads CLAUDE.md,
STATE.md, and the artifact from scratch. These files do not change between rounds. The optimization:
pass `skip_context_reads: true` in the YAML block so the worker skips Step 2 on rounds after
the first.

This preserves the stateless one-shot worker design — no persistent agent architecture needed.

**Part A — Update agents/qgsd-quorum-slot-worker.md:**

1. Add `skip_context_reads` to the Optional fields block in Step 1 (Parse arguments):
   ```
   skip_context_reads: <true|false>   — R2+ only; when true, skip Step 2 repo reads
   ```

2. Update Step 2 — Read repository context:
   Add a guard at the top of the step:
   ```
   **Skip guard:** If `skip_context_reads: true` AND `round > 1`, skip this entire step.
   The orchestrator guarantees that files read in Round 1 have not changed. Proceed directly
   to Step 3 — the artifact content, CLAUDE.md, and STATE.md are not re-read.
   ```
   Preserve all existing Step 2 content below the guard (it applies to Round 1 and any fresh spawn).

3. No other changes to the slot-worker — Steps 3, 4, 5 remain identical.

**Part B — Update commands/qgsd/quorum.md deliberation round dispatch:**

In both Mode A and Mode B deliberation sections, add `skip_context_reads: true` to the YAML
block dispatched to each slot. The deliberation YAML block currently looks like:

```
slot: <slotName>
round: <round_number>
timeout_ms: <slot_timeout>
repo_dir: <absolute path>
mode: A
question: <question text>
prior_positions: |
  ...
```

Update to add the skip flag:
```
slot: <slotName>
round: <round_number>
timeout_ms: <slot_timeout>
repo_dir: <absolute path>
mode: A
question: <question text>
skip_context_reads: true
prior_positions: |
  ...
```

Add a comment above the YAML block:
"# skip_context_reads: true — worker already read CLAUDE.md, STATE.md, artifact in Round 1.
# Skipping re-reads saves ~2 file reads per slot per deliberation round."

Apply to BOTH Mode A deliberation section and Mode B deliberation section.

Do NOT add skip_context_reads to Round 1 YAML blocks — Round 1 must always read full context.
  </action>
  <verify>
grep -n "skip_context_reads" /Users/jonathanborduas/code/QGSD/agents/qgsd-quorum-slot-worker.md
grep -n "skip_context_reads" /Users/jonathanborduas/code/QGSD/commands/qgsd/quorum.md
# Round 1 blocks should NOT have skip_context_reads:
grep -B5 "skip_context_reads" /Users/jonathanborduas/code/QGSD/commands/qgsd/quorum.md | grep "round: 1" || echo "OK: no round:1 block has skip_context_reads"
  </verify>
  <done>
agents/qgsd-quorum-slot-worker.md has skip guard in Step 2. quorum.md has skip_context_reads: true
in both Mode A and Mode B deliberation YAML blocks. Round 1 YAML blocks do not have the flag.
  </done>
</task>

</tasks>

<verification>
Run after both tasks complete:

1. Confirm haiku coverage across all dispatch sites:
   grep -rn 'model="haiku"\|haiku' /Users/jonathanborduas/code/QGSD/commands/qgsd/quorum.md /Users/jonathanborduas/code/QGSD/qgsd-core/workflows/quick.md /Users/jonathanborduas/code/QGSD/qgsd-core/workflows/discuss-phase.md /Users/jonathanborduas/code/QGSD/qgsd-core/workflows/execute-phase.md /Users/jonathanborduas/code/QGSD/qgsd-core/workflows/plan-phase.md

2. Confirm skip_context_reads appears in slot-worker and quorum.md:
   grep -c "skip_context_reads" /Users/jonathanborduas/code/QGSD/agents/qgsd-quorum-slot-worker.md
   grep -c "skip_context_reads" /Users/jonathanborduas/code/QGSD/commands/qgsd/quorum.md

3. Confirm non-slot-worker Tasks are untouched (no spurious haiku):
   grep -n "haiku" /Users/jonathanborduas/code/QGSD/qgsd-core/workflows/execute-phase.md
   (should only appear on lines containing "slot-worker")
</verification>

<success_criteria>
- All qgsd-quorum-slot-worker Task dispatches across 5 files include model="haiku"
- Slot-worker Step 2 has skip guard: when skip_context_reads: true AND round > 1, skip file reads
- quorum.md deliberation YAML blocks (Mode A and Mode B) include skip_context_reads: true
- Round 1 YAML blocks do NOT have skip_context_reads
- No non-slot-worker Tasks were given model="haiku"
- No persistent agent / AWAITING_NEXT_ROUND / resume= changes (quorum consensus rejected this approach)
</success_criteria>

<output>
After completion, create `.planning/quick/110-implement-modernized-quorum-dispatch-pat/110-SUMMARY.md`
</output>
