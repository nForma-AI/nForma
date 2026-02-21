---
phase: quick-7
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - docs/USER-GUIDE.md
autonomous: true
requirements: []

must_haves:
  truths:
    - "The Execution Wave Coordination diagram shows checkpoint:verify as an automated gate (no human pause)"
    - "The diagram shows checkpoint:verify calling quorum-test and branching to PASS vs BLOCK"
    - "The diagram shows the 3-round debug loop on BLOCK"
    - "The diagram shows escalation to checkpoint:human-verify after 3 failed debug rounds"
    - "The diagram shows checkpoint:human-verify as the terminal human gate (used only on escalation)"
  artifacts:
    - path: "docs/USER-GUIDE.md"
      provides: "Updated Execution Wave Coordination diagram with checkpoint:verify pipeline"
      contains: "checkpoint:verify"
  key_links:
    - from: "docs/USER-GUIDE.md Execution Wave Coordination diagram"
      to: "commands/qgsd/execute-phase.md Rules 1-4"
      via: "diagram accuracy"
      pattern: "checkpoint:verify.*quorum-test"
---

<objective>
Update the "Execution Wave Coordination" diagram in docs/USER-GUIDE.md to reflect the checkpoint:verify flow shipped in quick task 6.

Purpose: The current diagram shows a simple executor → verifier path. The checkpoint:verify pipeline (executor auto-calls quorum-test, 3-round debug loop, escalation to checkpoint:human-verify) is now live in qgsd:execute-phase and needs to be documented accurately so users understand the automation.

Output: Updated USER-GUIDE.md with a diagram that accurately reflects the four checkpoint handling rules from commands/qgsd/execute-phase.md.
</objective>

<execution_context>
@~/.claude/get-shit-done/workflows/execute-plan.md
@~/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@.planning/quick/6-build-checkpoint-verify-flow-into-qgsd-e/6-SUMMARY.md
@commands/qgsd/execute-phase.md
</context>

<tasks>

<task type="auto">
  <name>Task 1: Update Execution Wave Coordination diagram in USER-GUIDE.md</name>
  <files>docs/USER-GUIDE.md</files>
  <action>
Replace the existing "Execution Wave Coordination" diagram (lines 100-119 in docs/USER-GUIDE.md) with an updated version that shows the full checkpoint:verify pipeline.

The current diagram ends with a simple Verifier block that splits into PASS/FAIL. Replace it so that:

1. After wave executors complete, the flow enters the plan step loop
2. Each checkpoint:verify step calls /qgsd:quorum-test automatically (no human pause)
3. PASS from quorum-test continues execution
4. BLOCK/REVIEW-NEEDED enters the debug loop (up to 3 rounds of /qgsd:debug + re-run quorum-test)
5. After 3 failed debug rounds, escalates to checkpoint:human-verify (human gate)
6. checkpoint:human-verify is labeled as "escalation only" or "human gate"

The updated diagram block should replace the existing one at the "Execution Wave Coordination" section. Keep all other content in the file unchanged.

Use ASCII box-drawing characters consistent with the existing diagram style (box-drawing chars like ─, │, ├, └, ┌, ┐, ┘, ┤, ┬, ┼, ▼, ▲ as used elsewhere in the file).

The new diagram should look approximately like this (adjust spacing for alignment):

```
  /qgsd:execute-phase N
         │
         ├── Analyze plan dependencies
         │
         ├── Wave 1 (independent plans):
         │     ├── Executor A (fresh 200K context) -> commit
         │     └── Executor B (fresh 200K context) -> commit
         │
         ├── Wave 2 (depends on Wave 1):
         │     └── Executor C (fresh 200K context) -> commit
         │
         └── For each plan step (checkpoint type handling):
               │
               ├── checkpoint:verify (automated gate)
               │     │
               │     └── /qgsd:quorum-test
               │           │
               │           ├── PASS -> continue execution
               │           │
               │           └── BLOCK/REVIEW-NEEDED
               │                 │
               │                 └── /qgsd:debug loop (max 3 rounds)
               │                       │
               │                       ├── Round N: fix -> re-run quorum-test
               │                       │     └── PASS -> continue execution
               │                       │
               │                       └── After 3 rounds, still failing
               │                             │
               │                             ▼
               └── checkpoint:human-verify (escalation only)
                     └── Human confirms before continuing
```

After the diagram section, do NOT add any new sections. The checkpoint type reference table already exists in commands/qgsd/execute-phase.md — do not duplicate it in the user guide unless it naturally fits. The diagram alone is sufficient.
  </action>
  <verify>
    1. grep -n "checkpoint:verify" /Users/jonathanborduas/code/QGSD/docs/USER-GUIDE.md
    2. grep -n "quorum-test" /Users/jonathanborduas/code/QGSD/docs/USER-GUIDE.md
    3. grep -n "debug loop" /Users/jonathanborduas/code/QGSD/docs/USER-GUIDE.md
    4. grep -n "checkpoint:human-verify" /Users/jonathanborduas/code/QGSD/docs/USER-GUIDE.md
    All four commands must return matches within the Execution Wave Coordination section.
  </verify>
  <done>
    The Execution Wave Coordination diagram in docs/USER-GUIDE.md shows the full pipeline:
    checkpoint:verify → /qgsd:quorum-test → PASS (continue) or BLOCK → /qgsd:debug loop (3 rounds max) → still failing → checkpoint:human-verify (human gate).
    All other USER-GUIDE.md content is unchanged.
  </done>
</task>

</tasks>

<verification>
After task completion:
- grep -n "checkpoint:verify" /Users/jonathanborduas/code/QGSD/docs/USER-GUIDE.md — must return matches in Execution Wave Coordination section
- grep -n "quorum-test" /Users/jonathanborduas/code/QGSD/docs/USER-GUIDE.md — must return matches
- grep -n "debug loop" /Users/jonathanborduas/code/QGSD/docs/USER-GUIDE.md — must return matches
- The rest of USER-GUIDE.md (table of contents, command reference, configuration, troubleshooting) must be intact
</verification>

<success_criteria>
The Execution Wave Coordination diagram accurately reflects the checkpoint:verify automation pipeline introduced in quick task 6. A user reading the diagram can understand: (1) checkpoint:verify is automated, (2) quorum-test is the verifier, (3) failures enter a 3-round debug loop, (4) checkpoint:human-verify is the human escalation target only.
</success_criteria>

<output>
After completion, create `.planning/quick/7-update-docs-user-guide-md-with-checkpoin/7-SUMMARY.md`
</output>
