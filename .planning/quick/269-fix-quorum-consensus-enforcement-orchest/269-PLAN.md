---
phase: quick-269
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - commands/nf/quorum.md
  - core/workflows/quick.md
  - core/workflows/execute-phase.md
autonomous: true
formal_artifacts: none

must_haves:
  truths:
    - "Claude/orchestrator position is labeled ADVISORY and excluded from vote tallies"
    - "A BLOCK vote from any valid external voter prevents consensus — no override or rationalization permitted"
    - "Consensus requires 100% agreement among valid (non-UNAVAIL) external voters — no majority-based approval"
    - "When a BLOCK occurs, the system enters deliberation or escalation — never manufactures consensus"
  artifacts:
    - path: "commands/nf/quorum.md"
      provides: "Primary quorum protocol with orchestrator-is-facilitator rules"
      contains: "ADVISORY"
    - path: "core/workflows/quick.md"
      provides: "Step 5.7 quorum processing without orchestrator self-voting"
      contains: "facilitator"
    - path: "core/workflows/execute-phase.md"
      provides: "Checkpoint and verification quorum without orchestrator self-voting"
      contains: "facilitator"
  key_links:
    - from: "commands/nf/quorum.md"
      to: "core/workflows/quick.md"
      via: "quorum protocol referenced by Step 5.7"
      pattern: "commands/nf/quorum\\.md"
    - from: "commands/nf/quorum.md"
      to: "core/workflows/execute-phase.md"
      via: "quorum protocol referenced by checkpoint_handling and verify_phase_goal"
      pattern: "commands/nf/quorum\\.md"
---

<objective>
Fix quorum consensus enforcement so that: (1) the orchestrator (Claude) is a facilitator only and NEVER counts as a voter in tallies, (2) a BLOCK vote from any valid external voter is absolute and triggers deliberation/escalation, and (3) consensus requires 100% unanimity among valid external voters with no majority-based override.

Purpose: The current protocol allows the orchestrator to self-vote, rationalize away BLOCK votes, and accept majority-based approval — all of which violate the quorum's structural enforcement guarantee. This fix makes consensus determination mechanistic rather than interpretive.

Output: Updated quorum.md, quick.md, and execute-phase.md with explicit anti-gaming rules.
</objective>

<execution_context>
@/Users/jonathanborduas/.claude/nf/workflows/execute-plan.md
@/Users/jonathanborduas/.claude/nf/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@commands/nf/quorum.md
@core/workflows/quick.md
@core/workflows/execute-phase.md
@.planning/formal/spec/quorum/invariants.md
</context>

<tasks>

<task type="auto">
  <name>Task 1: Add consensus enforcement rules to quorum.md</name>
  <files>commands/nf/quorum.md</files>
  <action>
Add a new top-level section titled `## Consensus Enforcement Rules` immediately after the `</dispatch_pattern>` closing tag and before `<mode_detection>`. This section establishes the three invariants that govern ALL consensus determination (Mode A and Mode B). The rules are:

**RULE CE-1: Orchestrator Is Facilitator Only**
- Claude's position (`$CLAUDE_POSITION`) is ADVISORY context provided to external voters to help them form informed positions.
- Claude's position MUST NOT be counted as a vote in any consensus tally.
- The consensus tally counts ONLY external slot-worker votes (from `$DISPATCH_LIST`).
- When displaying the positions table, Claude's row MUST be labeled `Claude (ADVISORY — not a vote)`.

**RULE CE-2: BLOCK Is Absolute**
- A BLOCK (or REJECT in Mode B) vote from ANY single valid (non-UNAVAIL) external voter prevents consensus from being reached.
- The orchestrator MUST NOT override, rationalize away, dismiss, or reinterpret a BLOCK vote. The BLOCK stands as-is.
- When a BLOCK occurs: the system MUST enter deliberation (provide the BLOCK rationale to all voters for the next round) or escalate after max rounds.
- Prohibited phrases in orchestrator reasoning: "despite the BLOCK", "overriding the BLOCK because", "the BLOCK analysis was inaccurate", "majority overrides the BLOCK".

**RULE CE-3: Unanimity Required**
- Consensus means 100% of valid (non-UNAVAIL) external voters agree on the same verdict.
- There is NO majority-based approval. 2-out-of-3 APPROVE with 1 BLOCK is NOT consensus — it is a disagreement requiring deliberation.
- UNAVAIL voters are excluded from the denominator (they are not valid voters for this round).
- If only 1 external voter is valid and they APPROVE, that is consensus (1/1 = 100%).

Then update the following existing sections to reference these rules:

1. **"Claude's position (Round 1)"** section (Mode A): Change the header to `### Claude's advisory position (Round 1)` and add after the code block: `This position is ADVISORY per CE-1. It is shared with external voters as context but is NOT counted in the consensus tally.`

2. **"Evaluate Round 1 — check for consensus"** section (Mode A): Replace `If all available models agree` with: `If all valid (non-UNAVAIL) external voters agree (CE-3 unanimity) → skip to Consensus output. Claude's advisory position is NOT counted in this check. If ANY external voter voted BLOCK, consensus is NOT reached regardless of other votes (CE-2).`

3. **"Deliberation rounds (R3.3)"** section: After `Stop deliberation immediately upon CONSENSUS`, add: `CONSENSUS per CE-3: all valid external voters agree. A single BLOCK from any external voter means consensus has NOT been reached — continue deliberation.`

4. **"Consensus output"** section: In the display template, change `│ Claude │` row to `│ Claude (ADVISORY) │`. After the `Supporting positions:` block, add: `External voter tally: {N} APPROVE / {N} BLOCK / {N} UNAVAIL (Claude's position excluded per CE-1)`

5. **"Collect verdicts"** section (Mode B): Before the existing consensus determination rules, add: `Apply CE-1, CE-2, CE-3. Claude's verdict is ADVISORY — excluded from the tally below. Only external voter verdicts are counted:`

6. **"max_quorum_size check"** section: Change `Include Claude itself as +1` to `Claude is the facilitator and does NOT count toward max_quorum_size. Count only external slots.` Update the count logic: `availableCount` should count only external slots, not include Claude.

Do NOT change any other sections, dispatch patterns, slot-worker dispatch, scoreboard updates, fallback rules, or QUORUM_DEBATE.md format. The scoreboard still records Claude's advisory position — it's the TALLY that excludes Claude.
  </action>
  <verify>
Run these checks against the updated file:
```bash
grep -c "ADVISORY" commands/nf/quorum.md  # Should be >= 5
grep -c "CE-1\|CE-2\|CE-3" commands/nf/quorum.md  # Should be >= 8
grep "BLOCK Is Absolute" commands/nf/quorum.md  # Should match
grep "Unanimity Required" commands/nf/quorum.md  # Should match
grep "Orchestrator Is Facilitator" commands/nf/quorum.md  # Should match
grep -c "majority" commands/nf/quorum.md  # Check context — should appear in prohibition, not endorsement
```
  </verify>
  <done>
quorum.md contains the three CE rules (CE-1, CE-2, CE-3) as a standalone enforceable section. All existing consensus-determination language references these rules. Claude's position is explicitly labeled ADVISORY throughout. BLOCK is documented as absolute with prohibited override phrases. Unanimity is required with no majority fallback.
  </done>
</task>

<task type="auto">
  <name>Task 2: Update quick.md and execute-phase.md quorum invocations</name>
  <files>core/workflows/quick.md, core/workflows/execute-phase.md</files>
  <action>
**In core/workflows/quick.md — Step 5.7:**

1. Find the line `Form your own position on the current plan: does it correctly address the task description? Are tasks atomic and safe? State your vote as 1-2 sentences (APPROVE or BLOCK with rationale).`

   Replace with: `Form your ADVISORY position on the current plan (per CE-1 from quorum.md, your position is context for external voters — NOT a vote in the tally). State your analysis as 1-2 sentences. This is shared with external voters to inform their independent decisions.`

2. Find the Route section with `- **BLOCKED** ->`. Ensure the BLOCKED route says: `Report the blocker to the user. A BLOCK from any external voter is absolute (CE-2) — do NOT override or rationalize it away. Do not execute. **Break loop.**`

3. In Step 6.5.1 (Quorum review of VERIFICATION.md), find `Form your own position: does VERIFICATION.md confirm all must_haves are met and no invariants violated? State your vote as APPROVE or BLOCK with 1-2 sentences.`

   Replace with: `Form your ADVISORY analysis (per CE-1 — not a vote in the tally): does VERIFICATION.md confirm all must_haves are met and no invariants violated? State your analysis as 1-2 sentences to share with external voters.`

4. In the quorum resolution loop for human_needed (under Step 6.5), find `Form your own position: can each item be verified via available tools (grep, file reads, quorum-test)? State your vote as APPROVE (can resolve programmatically) or BLOCK (genuinely requires human eyes) with 1-2 sentence rationale per item.`

   Replace with: `Form your ADVISORY analysis (per CE-1 — not a vote in the tally): can each item be verified via available tools? State your analysis as 1-2 sentences to share with external voters.`

**In core/workflows/execute-phase.md — checkpoint_handling step:**

1. Find the auto-mode human-verify section with `Form your own position: can each verification criterion be confirmed via available tools (grep, file reads, test runs, curl)? Vote APPROVE or BLOCK with rationale.`

   Replace with: `Form your ADVISORY analysis (per CE-1 from quorum.md — not a vote in the tally): can each verification criterion be confirmed via available tools? State your analysis as 1-2 sentences to share with external voters.`

2. In the same section, the line `**Unanimous gate: 100% APPROVE required.** Unlike standard quorum majority, ALL responding workers must vote APPROVE.` — update to: `**Unanimous gate (CE-3): 100% of valid external voters must vote APPROVE. Claude's advisory analysis is excluded from the tally. A BLOCK from any external voter is absolute (CE-2) — escalate to user.**`

3. In the `verify_phase_goal` step, find the `human_needed` handler with `Form your own position: can each item be verified via available tools (grep, file reads, quorum-test)? State your vote as APPROVE (can resolve programmatically) or BLOCK (genuinely needs human eyes) with 1-2 sentence rationale.`

   Replace with: `Form your ADVISORY analysis (per CE-1 — not a vote in the tally): can each item be verified via available tools? State your analysis as 1-2 sentences to share with external voters.`

4. In the `gaps_found` handler, find `Form your own position: are these gaps auto-resolvable via plan-phase --gaps, or do they require human review? State your vote APPROVE (auto-resolvable) or BLOCK (needs human) with 1-2 sentence rationale.`

   Replace with: `Form your ADVISORY analysis (per CE-1 — not a vote in the tally): are these gaps auto-resolvable? State your analysis as 1-2 sentences to share with external voters.`

Do NOT change any Task dispatch patterns, subagent_type values, model parameters, scoreboard commands, activity-set calls, or structural workflow logic. Only the orchestrator's self-characterization and consensus determination language changes.
  </action>
  <verify>
Run these checks:
```bash
# quick.md should no longer tell orchestrator to "vote"
grep -c "State your vote" core/workflows/quick.md  # Should be 0
grep -c "ADVISORY" core/workflows/quick.md  # Should be >= 3

# execute-phase.md should no longer tell orchestrator to "vote"
grep -c "State your vote" core/workflows/execute-phase.md  # Should be 0
grep -c "ADVISORY" core/workflows/execute-phase.md  # Should be >= 3
grep "CE-1\|CE-2\|CE-3" core/workflows/execute-phase.md  # Should have references
```
  </verify>
  <done>
All quorum invocations in quick.md and execute-phase.md characterize Claude's position as ADVISORY (not a vote), reference CE-1/CE-2/CE-3 rules from quorum.md, and no longer use "State your vote" language for the orchestrator. BLOCK handling explicitly prohibits override/rationalization.
  </done>
</task>

<task type="auto">
  <name>Task 3: Sync updated workflow files to installed locations</name>
  <files>core/workflows/quick.md, core/workflows/execute-phase.md</files>
  <action>
Per project memory ("Workflow sync required"): edits to core/workflows/ must be synced to the installed location. The installer copies FROM core/workflows/ TO ~/.claude/nf/workflows/, so the repo source is canonical.

After Tasks 1 and 2 are committed, sync the modified workflows:

```bash
cp core/workflows/quick.md ~/.claude/nf/workflows/quick.md
cp core/workflows/execute-phase.md ~/.claude/nf/workflows/execute-phase.md
```

Note: commands/nf/quorum.md does NOT need install sync — it is read directly from the repo by the command router.

Verify the installed copies match the repo source:
```bash
diff core/workflows/quick.md ~/.claude/nf/workflows/quick.md
diff core/workflows/execute-phase.md ~/.claude/nf/workflows/execute-phase.md
```
Both diffs should produce no output (files identical).
  </action>
  <verify>
```bash
diff core/workflows/quick.md ~/.claude/nf/workflows/quick.md && echo "quick.md synced" || echo "MISMATCH"
diff core/workflows/execute-phase.md ~/.claude/nf/workflows/execute-phase.md && echo "execute-phase.md synced" || echo "MISMATCH"
```
  </verify>
  <done>
Installed workflow copies at ~/.claude/nf/workflows/ match the repo source files. Next install will not silently revert the consensus enforcement changes.
  </done>
</task>

</tasks>

<verification>
After all tasks complete:
1. `grep -c "ADVISORY" commands/nf/quorum.md` returns >= 5
2. `grep "CE-1" commands/nf/quorum.md` matches (rule exists)
3. `grep "CE-2" commands/nf/quorum.md` matches (rule exists)
4. `grep "CE-3" commands/nf/quorum.md` matches (rule exists)
5. `grep -c "State your vote" core/workflows/quick.md` returns 0
6. `grep -c "State your vote" core/workflows/execute-phase.md` returns 0
7. `diff core/workflows/quick.md ~/.claude/nf/workflows/quick.md` produces no output
8. `diff core/workflows/execute-phase.md ~/.claude/nf/workflows/execute-phase.md` produces no output
9. The formal invariant EventualConsensus is preserved: BLOCK triggers deliberation (not override), so the system still eventually reaches DECIDED via deliberation rounds or escalation.
</verification>

<success_criteria>
- The orchestrator cannot count itself as a voter (CE-1 enforced in all quorum invocations)
- A single BLOCK from any external voter prevents consensus (CE-2 enforced with prohibited phrases)
- Consensus requires 100% unanimity among external voters (CE-3 enforced, no majority fallback)
- All three workflow files updated and consistent
- Installed workflow copies synced
- EventualConsensus liveness invariant preserved (deliberation/escalation paths intact)
</success_criteria>

<output>
After completion, create `.planning/quick/269-fix-quorum-consensus-enforcement-orchest/269-SUMMARY.md`
</output>
