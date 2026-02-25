---
phase: quick-101
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - agents/qgsd-quorum-slot-worker.md
  - agents/qgsd-quorum-orchestrator.md
  - agents/qgsd-quorum-worker.md
  - agents/qgsd-quorum-synthesizer.md
  - commands/qgsd/quorum.md
  - CLAUDE.md
autonomous: true
requirements: [QUICK-101]

must_haves:
  truths:
    - "qgsd-quorum-slot-worker.md uses Bash (cqs.cjs) only — tools list is Read, Bash, Glob, Grep, no MCP tools"
    - "Orchestrator runs up to 10 deliberation rounds with inline synthesis — no separate synthesizer Task spawned"
    - "Each orchestrator round dispatches all slot workers as parallel Task siblings with description='<slotName> quorum R<N>'"
    - "After each round, orchestrator synthesizes results inline and checks consensus before launching next round"
    - "Cross-pollination: R1 results are bundled and injected into R2+ worker prompts"
    - "quorum.md fallback dispatches Mode B workers as parallel Tasks (not sequential)"
    - "CLAUDE.md R3.3 says 10 rounds before escalation"
    - "qgsd-quorum-worker.md and qgsd-quorum-synthesizer.md have deprecation notices at top"
  artifacts:
    - path: "agents/qgsd-quorum-slot-worker.md"
      provides: "Unified worker agent — Bash cqs.cjs only"
      contains: "tools: Read, Bash, Glob, Grep"
    - path: "agents/qgsd-quorum-orchestrator.md"
      provides: "Orchestrator with 10-round loop + inline synthesis"
      contains: "10 rounds"
    - path: "agents/qgsd-quorum-worker.md"
      provides: "Deprecated old worker"
      contains: "DEPRECATED"
    - path: "agents/qgsd-quorum-synthesizer.md"
      provides: "Deprecated synthesizer"
      contains: "DEPRECATED"
    - path: "commands/qgsd/quorum.md"
      provides: "Fallback command with parallel Task dispatch"
      contains: "parallel"
    - path: "CLAUDE.md"
      provides: "Policy with 10-round cap"
      contains: "10 rounds"
  key_links:
    - from: "agents/qgsd-quorum-orchestrator.md"
      to: "agents/qgsd-quorum-slot-worker.md"
      via: "Task(subagent_type=qgsd-quorum-slot-worker, description='<slotName> quorum R<N>')"
      pattern: "qgsd-quorum-slot-worker"
    - from: "agents/qgsd-quorum-slot-worker.md"
      to: "call-quorum-slot.cjs"
      via: "Bash node call-quorum-slot.cjs"
      pattern: "call-quorum-slot.cjs"
---

<objective>
Unify the quorum agent stack: rewrite the slot-worker to use Bash (cqs.cjs) only, rewrite the orchestrator to run a 10-round parallel loop with inline synthesis, update the quorum.md fallback and CLAUDE.md policy, and deprecate the old worker and synthesizer agents.

Purpose: The old architecture used a separate synthesizer Task per round, adding latency and complexity. The new design has the orchestrator synthesize results inline, runs up to 10 rounds (not 2), and uses a clean unified worker that relies only on cqs.cjs — no MCP tool juggling in the worker.

Output: All 6 files updated; quorum runs faster and can reach consensus over more rounds; "Running N agents" UI works via Task description= in the orchestrator.
</objective>

<execution_context>
@/Users/jonathanborduas/.claude/get-shit-done/workflows/execute-plan.md
@/Users/jonathanborduas/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@/Users/jonathanborduas/code/QGSD/.planning/STATE.md
@/Users/jonathanborduas/code/QGSD/agents/qgsd-quorum-orchestrator.md
@/Users/jonathanborduas/code/QGSD/agents/qgsd-quorum-slot-worker.md
@/Users/jonathanborduas/code/QGSD/agents/qgsd-quorum-worker.md
@/Users/jonathanborduas/code/QGSD/agents/qgsd-quorum-synthesizer.md
@/Users/jonathanborduas/code/QGSD/commands/qgsd/quorum.md
@/Users/jonathanborduas/code/QGSD/CLAUDE.md
</context>

<tasks>

<task type="auto">
  <name>Task 1: Rewrite slot-worker to Bash-only + add deprecation notices to old agents</name>
  <files>
    agents/qgsd-quorum-slot-worker.md
    agents/qgsd-quorum-worker.md
    agents/qgsd-quorum-synthesizer.md
  </files>
  <action>
**agents/qgsd-quorum-slot-worker.md — full rewrite:**

Keep the same argument interface and output format but:
- Change `tools: "*"` to `tools: Read, Bash, Glob, Grep`
- Remove Step 4 (MCP tool lookup) and Step 5 MCP primary path entirely
- Step 4 becomes: "Call the slot via Bash (cqs.cjs)" — no MCP at all, no fallback
- Update description in frontmatter to: "Unified quorum slot worker — spawned as a parallel Task by the orchestrator, one per active slot. Reads repo context, calls the slot via call-quorum-slot.cjs (Bash), and returns a structured result block. No MCP tools — Bash only."
- The description= field on the Task call (set by the ORCHESTRATOR, not by this worker) creates the "⏺ Running N agents" UI display. Note this in the role section.
- Keep all existing prompt construction logic (Mode A / Mode B, prior_positions, traces, artifact_path)
- Keep the output format block unchanged

The Bash call pattern to use (Step 4, renumbered):
```bash
node "$HOME/.claude/qgsd-bin/call-quorum-slot.cjs" \
  --slot <slot> \
  --timeout <timeout_ms> \
  --cwd <repo_dir> <<'WORKER_PROMPT'
<$SLOT_PROMPT>
WORKER_PROMPT
```

If this exits non-zero OR output contains `TIMEOUT`: verdict = UNAVAIL.

Keep Step 5 (renamed from 6) — Parse output and return result — unchanged.

**agents/qgsd-quorum-worker.md — prepend deprecation notice:**

Insert at the very top of the file (before the YAML frontmatter `---`):
```
<!-- DEPRECATED: This agent is superseded by qgsd-quorum-slot-worker.md as of quick-101. Do not use. The orchestrator now spawns qgsd-quorum-slot-worker for all slot calls. This file is kept for reference only. -->
```

**agents/qgsd-quorum-synthesizer.md — prepend deprecation notice:**

Insert at the very top of the file (before the YAML frontmatter `---`):
```
<!-- DEPRECATED: This agent is superseded by inline synthesis in qgsd-quorum-orchestrator.md as of quick-101. The orchestrator now synthesizes results itself without spawning a separate synthesizer Task. This file is kept for reference only. -->
```
  </action>
  <verify>
    - Read agents/qgsd-quorum-slot-worker.md and confirm: tools line says "Read, Bash, Glob, Grep", no MCP tool step, Bash call pattern present
    - Read agents/qgsd-quorum-worker.md and confirm deprecation comment at top
    - Read agents/qgsd-quorum-synthesizer.md and confirm deprecation comment at top
  </verify>
  <done>
    - slot-worker uses only Bash for slot calls
    - old worker and synthesizer have visible deprecation notices
  </done>
</task>

<task type="auto">
  <name>Task 2: Rewrite orchestrator — 10-round parallel loop with inline synthesis</name>
  <files>
    agents/qgsd-quorum-orchestrator.md
  </files>
  <action>
Major rewrite of the orchestrator. Keep Pre-step, Step 1 (provider pre-flight), and Step 2 (team identity capture) exactly as-is — those are correct. Replace Mode A and Mode B sections with the new design.

**Key changes:**

1. **tools line:** Keep `tools: Read, Write, Bash, Task, Glob, Grep` as-is.

2. **Remove all `qgsd-quorum-synthesizer` Task spawns.** The orchestrator synthesizes inline.

3. **Round loop (applies identically to Mode A and Mode B):**

Replace the 2-round structure (Round 1 → Barrier/Synthesizer → Round 2 → Barrier/Synthesizer → done) with a loop of up to 10 rounds:

```
$MAX_ROUNDS = 10
$CURRENT_ROUND = 1
$CROSS_POLL_BUNDLE = ""   (empty on Round 1, populated after each round)
$CONSENSUS_REACHED = false

LOOP while $CURRENT_ROUND <= $MAX_ROUNDS and not $CONSENSUS_REACHED:

  Display banner before each round:
  ─────────────────────────────────────────────
   QGSD ► QUORUM Round $CURRENT_ROUND / up to $MAX_ROUNDS
  ─────────────────────────────────────────────

  Dispatch all active slots as SIBLING Task calls (one message turn):
    Task(
      subagent_type="qgsd-quorum-slot-worker",
      description="<slotName> quorum R<$CURRENT_ROUND>",
      prompt="""
  slot: <slotName>
  round: $CURRENT_ROUND
  timeout_ms: <$SLOT_TIMEOUTS[slotName]>
  repo_dir: <$REPO_DIR>
  mode: A | B
  question: <question text>
  [artifact_path: <$ARTIFACT_PATH>]
  [traces: <$TRACES>]          # Mode B only
  [prior_positions: |          # Round 2+ only, from $CROSS_POLL_BUNDLE
    <$CROSS_POLL_BUNDLE>]
  """
    )
    (one Task per active slot — all sibling calls in same message turn)

  Collect all worker result blocks → store as $ROUND_RESULTS

  Process UNAVAIL results (sequential Bash calls):
    For each result where verdict=UNAVAIL:
      node "$HOME/.claude/qgsd-bin/update-scoreboard.cjs" set-availability ...

  Display results table after collecting all results:
  ┌──────────────┬──────────────────────────────────────────────────────────┐
  │ Model        │ Round $CURRENT_ROUND Position                           │
  ├──────────────┼──────────────────────────────────────────────────────────┤
  │ Claude       │ [Claude's own position — stated before dispatching workers]│
  │ <slot>       │ [verdict/reasoning or UNAVAIL]                          │
  └──────────────┴──────────────────────────────────────────────────────────┘

  INLINE SYNTHESIS (orchestrator does this itself — no Task):
    Filter available results (exclude verdict=UNAVAIL).
    Mode A consensus: all available positions point to same conclusion?
    Mode B consensus: all available APPROVE, OR any REJECT?
    (Mode A free-form convergence judgment; Mode B binary rules as before)

    If CONSENSUS:
      $CONSENSUS_REACHED = true
      Break loop

    If NO CONSENSUS:
      Build $CROSS_POLL_BUNDLE:
        "Prior positions:\n"
        + for each result: "• <slot>: <reasoning>\n"
        + UNAVAIL slots: "• <slot>: UNAVAIL\n"
      $CURRENT_ROUND += 1
      Continue loop

After loop:
  If $CONSENSUS_REACHED → Consensus output
  Else (exhausted 10 rounds) → Escalate
```

4. **Claude's own position:** Claude states its own position (and for Mode B, its own verdict) BEFORE dispatching the first worker wave in Round 1. Store as `$CLAUDE_POSITION`. Include Claude in the results table as the first row each round. In Round 2+, include Claude's position in the cross-poll bundle as `• Claude: <$CLAUDE_POSITION>`.

5. **Consensus output:** Same banners and scoreboard update logic as before. Reference the round number at which consensus was reached.

6. **Escalate banner:** Update to say "NO CONSENSUS AFTER 10 ROUNDS" (not 4).

7. **Scoreboard update:** Remains the same merge-wave pattern. Run after consensus or escalation. Covers all rounds that ran.

8. **Remove the old "### Barrier N — Synthesizer" sections entirely.** The synthesis is now inline prose in the orchestrator's reasoning between tool calls — no Task spawn.

Write the full updated orchestrator markdown. Preserve all of Step 1, Step 2, Pre-step, and the scoreboard update patterns. Replace only the round-execution sections.
  </action>
  <verify>
    - Read agents/qgsd-quorum-orchestrator.md and confirm: no "qgsd-quorum-synthesizer" appears, "10" appears in the loop cap, "description=" field in Task spawn shows "&lt;slotName&gt; quorum R&lt;N&gt;", "qgsd-quorum-slot-worker" is the subagent_type
    - Grep for "qgsd-quorum-synthesizer" in the file — should return 0 matches
    - Grep for "10" in the file — should find the round cap
  </verify>
  <done>
    - Orchestrator runs 10-round loop
    - No synthesizer Task spawned
    - Each round displays banner + results table
    - Cross-pollination bundle built and injected into next round
    - Escalation says "10 ROUNDS"
  </done>
</task>

<task type="auto">
  <name>Task 3: Update quorum.md fallback + CLAUDE.md R3.3 round cap</name>
  <files>
    commands/qgsd/quorum.md
    CLAUDE.md
  </files>
  <action>
**commands/qgsd/quorum.md:**

The fallback path (used when orchestrator unavailable) needs two updates:

1. **Mode B worker dispatch — change from sequential to parallel:**

Find the section "Dispatch quorum workers via Task (sequential — one at a time)" and rewrite it as parallel dispatch. The note should say:

"Dispatch all worker Tasks as parallel sibling calls in one message turn (all in the same message). Use the same Task description= convention: description='&lt;slotName&gt; quorum R&lt;N&gt;'. This matches the orchestrator's behavior and gives the nice parallel UI."

Replace:
```
Task subagents must be dispatched **sequentially**, one per message turn.
```
With:
```
Task subagents for each round MAY be dispatched as **parallel sibling calls** in one message turn — one Task per slot. The description= field on each Task creates the "⏺ Running N agents" parallel UI. Use description="<slotName> quorum R<roundN>".
```

2. **Round cap — change "4 rounds" to "10 rounds":**

Find: "Run up to 3 deliberation rounds (max 4 total rounds including Round 1)."
Replace with: "Run up to 9 deliberation rounds (max 10 total rounds including Round 1)."

Find the escalation banner text: "NO CONSENSUS AFTER 4 ROUNDS"
Replace with: "NO CONSENSUS AFTER 10 ROUNDS"

Find the escalation prose: "After 4 total rounds with no consensus → **Escalate**."
Replace with: "After 10 total rounds with no consensus → **Escalate**."

Remove or replace the comment block starting with "> **SEQUENTIAL CALLS ONLY — NO SIBLING TOOL CALLS**" in the quorum.md main body. Replace with:

"> **Worker Task dispatch is PARALLEL per round.** Dispatch all slot workers for a given round as sibling Task calls in one message turn. Between rounds (Bash scoreboard calls, set-availability) remain sequential."

**CLAUDE.md:**

Find in R3.3 Deliberation Rules table:
```
| Any model BLOCK | BLOCK state. Run deliberation (up to 4 rounds). |
```
Replace with:
```
| Any model BLOCK | BLOCK state. Run deliberation (up to 10 rounds total). |
```

Find the prose after the table:
```
Deliberation: share all positions with all models simultaneously (one call each, still sequential). Re-vote. Repeat until consensus or 4 rounds exhausted.
```
Replace with:
```
Deliberation: share all positions with all models simultaneously (one call each, still sequential). Re-vote. Repeat until consensus or 10 rounds exhausted.
```

Find R3.4 Escalation:
```
If 4 deliberation rounds complete without consensus, Claude MUST escalate to the user with:
```
Replace with:
```
If 10 rounds complete without consensus, Claude MUST escalate to the user with:
```
  </action>
  <verify>
    - Grep for "4 rounds" in CLAUDE.md — should return 0 matches
    - Grep for "10 rounds" in CLAUDE.md — should find 2-3 matches (R3.3 table, R3.3 prose, R3.4)
    - Grep for "sequential" in commands/qgsd/quorum.md — the SEQUENTIAL warning note should be replaced
    - Grep for "parallel" in commands/qgsd/quorum.md — should find updated dispatch note
    - Grep for "10 ROUNDS" in commands/qgsd/quorum.md — should find escalation banner
  </verify>
  <done>
    - CLAUDE.md consistently says 10 rounds throughout R3.3 and R3.4
    - quorum.md fallback dispatches workers in parallel per round
    - quorum.md escalation banner says 10 rounds
  </done>
</task>

</tasks>

<verification>
After all tasks:
1. `grep -r "qgsd-quorum-synthesizer" /Users/jonathanborduas/code/QGSD/agents/qgsd-quorum-orchestrator.md` — must return empty
2. `grep "tools:" /Users/jonathanborduas/code/QGSD/agents/qgsd-quorum-slot-worker.md` — must show "Read, Bash, Glob, Grep" (not "*")
3. `grep "10" /Users/jonathanborduas/code/QGSD/agents/qgsd-quorum-orchestrator.md` — must find the 10-round cap
4. `grep "DEPRECATED" /Users/jonathanborduas/code/QGSD/agents/qgsd-quorum-worker.md` — must find deprecation notice
5. `grep "DEPRECATED" /Users/jonathanborduas/code/QGSD/agents/qgsd-quorum-synthesizer.md` — must find deprecation notice
6. `grep "4 rounds" /Users/jonathanborduas/code/QGSD/CLAUDE.md` — must return empty
</verification>

<success_criteria>
- Quorum system uses one worker type (slot-worker, Bash-only) instead of two
- Orchestrator runs up to 10 rounds with inline synthesis — no extra agent spawns
- "⏺ Running N agents" UI display works via Task description= field
- Old agents deprecated but retained for reference
- CLAUDE.md policy and quorum.md fallback consistently say 10 rounds
- No install.js changes needed (install copies all qgsd-*.md automatically)
</success_criteria>

<output>
After completion, create `.planning/quick/101-unified-quorum-new-slot-worker-agent-orc/101-SUMMARY.md` documenting what was changed, key decisions made, and any deviations from the plan.
</output>
