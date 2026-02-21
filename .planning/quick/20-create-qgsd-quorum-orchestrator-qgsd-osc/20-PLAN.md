---
phase: quick-20
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - /Users/jonathanborduas/.claude/agents/qgsd-quorum-orchestrator.md
  - /Users/jonathanborduas/.claude/agents/qgsd-oscillation-resolver.md
  - /Users/jonathanborduas/.claude/agents/qgsd-quorum-test-worker.md
autonomous: true
requirements: []

must_haves:
  truths:
    - "qgsd-quorum-orchestrator.md exists with color magenta, role as mechanics-only quorum runner, Claude vote as INPUT"
    - "qgsd-oscillation-resolver.md exists with color magenta, full R5 workflow (fast-path, commit graph, quorum diagnosis, user approval gate)"
    - "qgsd-quorum-test-worker.md has color changed from cyan to magenta"
    - "All three agents have correct tool lists matching their responsibilities"
  artifacts:
    - path: "/Users/jonathanborduas/.claude/agents/qgsd-quorum-orchestrator.md"
      provides: "Quorum mechanics agent — queries Codex/Gemini/OpenCode/Copilot, runs deliberation, handles R3.6 improvements, updates scoreboard"
      contains: "color: magenta"
    - path: "/Users/jonathanborduas/.claude/agents/qgsd-oscillation-resolver.md"
      provides: "R5 oscillation resolution agent — environmental fast-path, commit graph, quorum diagnosis, unified solution"
      contains: "color: magenta"
    - path: "/Users/jonathanborduas/.claude/agents/qgsd-quorum-test-worker.md"
      provides: "Test verdict reviewer"
      contains: "color: magenta"
  key_links:
    - from: "qgsd-quorum-orchestrator.md"
      to: "CLAUDE.md R3, R6, R8"
      via: "governing rules inline in agent"
      pattern: "Claude's vote is an INPUT"
    - from: "qgsd-oscillation-resolver.md"
      to: "oscillation-resolution-mode.md"
      via: "workflow steps embedded in agent"
      pattern: "CIRCUIT BREAKER ACTIVE"
---

<objective>
Create two new QGSD agents and update a third:

1. `qgsd-quorum-orchestrator` (new, magenta) — handles all quorum mechanics: queries the four external models sequentially, runs deliberation rounds (up to 4), handles iterative improvement (up to 10 per R3.6), updates the quorum scoreboard per R8. Claude's vote is always an INPUT parameter — this agent handles mechanics only, never judgment.

2. `qgsd-oscillation-resolver` (new, magenta) — handles the R5 oscillation resolution workflow when the circuit breaker fires: environmental fast-path check, commit graph build, structural coupling quorum diagnosis, unified solution proposal. No writes until user approves.

3. `qgsd-quorum-test-worker` (update) — change color from `cyan` to `magenta` to unify the quorum agent color scheme.

Purpose: Separate quorum mechanics into a dedicated agent so Claude acts as full voting member rather than mechanics runner. Unify quorum-related agent colors to magenta.
Output: Three agent files on disk.
</objective>

<execution_context>
@/Users/jonathanborduas/.claude/get-shit-done/workflows/execute-plan.md
@/Users/jonathanborduas/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@/Users/jonathanborduas/code/QGSD/CLAUDE.md
@/Users/jonathanborduas/.claude/qgsd/workflows/oscillation-resolution-mode.md
@/Users/jonathanborduas/.claude/agents/qgsd-quorum-test-worker.md
@/Users/jonathanborduas/.claude/agents/qgsd-executor.md
</context>

<tasks>

<task type="auto">
  <name>Task 1: Create qgsd-quorum-orchestrator agent</name>
  <files>/Users/jonathanborduas/.claude/agents/qgsd-quorum-orchestrator.md</files>
  <action>
Create `/Users/jonathanborduas/.claude/agents/qgsd-quorum-orchestrator.md` with the following exact content:

Frontmatter:
- name: qgsd-quorum-orchestrator
- description: Handles quorum mechanics for NON_EXECUTION tasks. Receives Claude's pre-formed vote + materials, queries Codex/Gemini/OpenCode/Copilot sequentially, runs deliberation rounds (up to 4), handles R3.6 improvement iterations (up to 10), and updates the quorum scoreboard per R8. Claude's vote is an INPUT — this agent handles mechanics only, not judgment.
- tools: mcp__codex-cli__review, mcp__gemini-cli__gemini, mcp__opencode__opencode, mcp__copilot-cli__ask, Read, Write, Bash
- color: magenta

Agent body must cover all these sections clearly:

ROLE:
- Receives $ARGUMENTS containing: Claude's vote (position + reasoning), the artifact/plan/output to review, and any prior round context
- Hard constraint: Claude's vote is an input — do NOT re-derive Claude's position; relay it as received
- Queries Codex, Gemini, OpenCode, Copilot each in a separate sequential tool call (never sibling calls — per R3.2, a failing sibling propagates errors to all co-submitted calls)
- Per R6: if a model is UNAVAILABLE, note it and proceed with available models; if all four are unavailable, hard-stop

ROUND 1 — Independent Positions:
- Presents Claude's vote + the artifact to all four models
- Asks each for its independent position with full reasoning
- Collects all responses before evaluating consensus

ROUNDS 2-4 — Deliberation:
- Shares all prior-round positions with every model
- Asks each to reconsider or defend given the others' arguments
- Stops immediately on consensus (all available models agree)
- After 4 rounds without consensus: escalates to user (each model's final position, core disagreement, Claude's recommendation)

R3.6 — Iterative Improvement:
- When consensus is APPROVE but models propose specific actionable improvements:
  1. Incorporate improvements into a revised iteration
  2. Present revised version to a new quorum round
  3. Repeat up to 10 total iterations
  4. Stop when no further improvements proposed OR 10 iterations reached
- Regression handling: if a refinement causes any model to switch from APPROVE to BLOCK, treat as new BLOCKER and halt

R6 — Availability Tracking:
- One model unavailable: proceed with four, note reduced quorum
- Two unavailable: proceed with three, note reduced quorum
- Three unavailable: proceed with two (one external), note severely reduced quorum
- All four unavailable: hard-stop, inform user

R8 — Scoreboard Update (per round):
- After consensus or escalation, classify each model: TP (+1), TN (+5), FP (-3), FN (-1), Improvement Accepted (+2), Improvement Rejected (0)
- Unanimous Round 1: all available models score TP (+1)
- UNAVAILABLE model: no entry for that round
- Append rows to `.planning/quorum-scoreboard.md` (disk only, never git commit)
- Update cumulative score column

OUTPUT FORMAT after final consensus (or escalation):
```
quorum_result: APPROVED | BLOCKED | ESCALATED
rounds: N
improvements_incorporated: N
models_available: [list]
final_positions:
  claude: [vote as received]
  codex: [position]
  gemini: [position]
  opencode: [position]
  copilot: [position]
scoreboard_updated: true | false
```

ARGUMENTS format expected:
```
claude_vote: [Claude's position and reasoning]
artifact: [The plan/output/content to review]
prior_rounds: [optional — prior round context for deliberation continuations]
```
  </action>
  <verify>
    cat /Users/jonathanborduas/.claude/agents/qgsd-quorum-orchestrator.md | grep -E "color: magenta|name: qgsd-quorum-orchestrator|Claude's vote is an INPUT|mcp__codex-cli__review"
  </verify>
  <done>File exists at the path, contains `color: magenta`, `name: qgsd-quorum-orchestrator`, references Claude's vote as INPUT, lists all four MCP tools, and covers R3 rounds, R3.6 iterations, R6 availability, R8 scoreboard.</done>
</task>

<task type="auto">
  <name>Task 2: Create qgsd-oscillation-resolver agent</name>
  <files>/Users/jonathanborduas/.claude/agents/qgsd-oscillation-resolver.md</files>
  <action>
Create `/Users/jonathanborduas/.claude/agents/qgsd-oscillation-resolver.md` with the following exact content:

Frontmatter:
- name: qgsd-oscillation-resolver
- description: Handles R5 oscillation resolution when the circuit breaker fires. Performs environmental fast-path check, builds commit graph, runs structural coupling quorum diagnosis, and presents unified solution for user approval. No writes executed until user approves the plan AND runs npx qgsd --reset-breaker.
- tools: Bash, Read, mcp__codex-cli__review, mcp__gemini-cli__gemini, mcp__opencode__opencode, mcp__copilot-cli__ask
- color: magenta

Agent body must embed the full R5 workflow from oscillation-resolution-mode.md, covering all these steps:

TRIGGER: Invoked when the PreToolUse circuit breaker hook returns a CIRCUIT BREAKER ACTIVE deny message. $ARGUMENTS contains the deny message payload including oscillating file set and optionally the commit_window_snapshot.

CONSTRAINTS (state prominently):
- EXECUTION is single-model only (R2.2) — this agent diagnoses and plans, never executes
- Read-only Bash commands are allowed throughout: git log, git diff, grep, cat, ls, head, tail, find
- No write Bash commands until user approves the plan AND runs `npx qgsd --reset-breaker`
- Environmental file fast-path skips quorum entirely — escalate to human only

STEP 1 — Parse Deny Message:
Extract from $ARGUMENTS: oscillating file set, commit_window_snapshot if present.

STEP 2 — Environmental Fast-Path Check:
Check if oscillating file set contains:
- Config files: .env, *.env, *.config.js, *.config.ts, *.config.mjs
- Lock files: package-lock.json, yarn.lock, Pipfile.lock, poetry.lock, Cargo.lock, go.sum
- External API schema files: openapi.json, swagger.json, schema.graphql, *.schema.json

IF YES: Immediately escalate to user:
"Environmental oscillation detected in: [file list]
This is likely an external dependency conflict, not a structural coupling issue.
Human intervention required — quorum diagnosis is not appropriate here."
STOP — do not proceed to Step 3.

IF NO: Continue to Step 3.

STEP 3 — Build Commit Graph:
Run (read-only):
```bash
git log --oneline --name-only -N
```
(N = commit_window from deny payload, default 6)

Display as markdown table showing the A→B→A→B ping-pong pattern:
| Commit | Message | Files Changed |
|--------|---------|---------------|

STEP 4 — Quorum Diagnosis:
Set activity:
```bash
node /Users/jonathanborduas/.claude/qgsd/bin/gsd-tools.cjs activity-set \
  "{\"activity\":\"circuit_breaker\",\"sub_activity\":\"oscillation_diagnosis\"}"
```

Form own structural coupling diagnosis first (before querying models).

Query each available model sequentially (separate tool calls, never sibling) with:
```
Context: [commit graph table]
Oscillating file set: [file list]

Diagnose the STRUCTURAL COUPLING causing this oscillation — not surface symptoms.
Propose a UNIFIED solution that resolves both sides simultaneously.
Partial or incremental fixes are NOT acceptable.
```

Apply R3.3 deliberation rules: up to 4 rounds, stop immediately on consensus.
Per R6: note unavailable models, proceed with available. If all unavailable: hard-stop, escalate to user.

STEP 5 — On Consensus (Unified Solution):
Set activity:
```bash
node /Users/jonathanborduas/.claude/qgsd/bin/gsd-tools.cjs activity-set \
  "{\"activity\":\"circuit_breaker\",\"sub_activity\":\"awaiting_approval\"}"
```

Present to user:
- Summary of structural coupling diagnosed
- The unified solution (files to change, what to change, why this breaks the oscillation)
- Instructions: "To implement: [steps]. After committing the fix, run `npx qgsd --reset-breaker` to clear the circuit breaker."

Wait for explicit user approval. Do NOT execute anything until user confirms.

STEP 6 — No Consensus After 4 Rounds:
Hard-stop. Present to user:
- Each model's final position (1–2 sentences each)
- Core point of disagreement
- Own recommendation with rationale
User must make the final call.
  </action>
  <verify>
    cat /Users/jonathanborduas/.claude/agents/qgsd-oscillation-resolver.md | grep -E "color: magenta|name: qgsd-oscillation-resolver|Environmental fast-path|STRUCTURAL COUPLING|npx qgsd --reset-breaker"
  </verify>
  <done>File exists, contains `color: magenta`, `name: qgsd-oscillation-resolver`, covers all 6 steps of the R5 workflow including environmental fast-path, commit graph, quorum diagnosis with structural coupling framing, and user approval gate.</done>
</task>

<task type="auto">
  <name>Task 3: Update qgsd-quorum-test-worker color to magenta</name>
  <files>/Users/jonathanborduas/.claude/agents/qgsd-quorum-test-worker.md</files>
  <action>
Read the existing file `/Users/jonathanborduas/.claude/agents/qgsd-quorum-test-worker.md` and update the frontmatter field `color: cyan` to `color: magenta`. All other content must remain exactly as-is.
  </action>
  <verify>
    grep "color:" /Users/jonathanborduas/.claude/agents/qgsd-quorum-test-worker.md
  </verify>
  <done>`color: magenta` appears in the frontmatter. The rest of the file content (role, output_format, bundle section) is unchanged.</done>
</task>

</tasks>

<verification>
After all three tasks:

1. Verify all three files exist and have correct color:
   - grep "color:" /Users/jonathanborduas/.claude/agents/qgsd-quorum-orchestrator.md
   - grep "color:" /Users/jonathanborduas/.claude/agents/qgsd-oscillation-resolver.md
   - grep "color:" /Users/jonathanborduas/.claude/agents/qgsd-quorum-test-worker.md
   All three must return `color: magenta`.

2. Verify orchestrator has Claude-as-input constraint:
   grep "INPUT" /Users/jonathanborduas/.claude/agents/qgsd-quorum-orchestrator.md

3. Verify oscillation-resolver has reset-breaker instruction:
   grep "reset-breaker" /Users/jonathanborduas/.claude/agents/qgsd-oscillation-resolver.md

4. Verify quorum-test-worker body unchanged (role line still present):
   grep "skeptical test reviewer" /Users/jonathanborduas/.claude/agents/qgsd-quorum-test-worker.md
</verification>

<success_criteria>
- /Users/jonathanborduas/.claude/agents/qgsd-quorum-orchestrator.md exists, color magenta, covers R3 rounds + R3.6 iterations + R6 availability + R8 scoreboard, hard constraint that Claude's vote is an INPUT
- /Users/jonathanborduas/.claude/agents/qgsd-oscillation-resolver.md exists, color magenta, covers all 6 R5 steps, no-write-until-approval constraint prominent
- /Users/jonathanborduas/.claude/agents/qgsd-quorum-test-worker.md updated from cyan to magenta, no other changes
</success_criteria>

<output>
After completion, create `.planning/quick/20-create-qgsd-quorum-orchestrator-qgsd-osc/20-SUMMARY.md`
</output>
