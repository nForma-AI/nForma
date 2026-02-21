---
name: qgsd:quorum
description: Answer a question using full quorum consensus (Claude + Codex + Gemini + OpenCode + Copilot) following CLAUDE.md R3 protocol. Use when no arguments provided to answer the current conversation's open question.
argument-hint: "[question or prompt]"
allowed-tools:
  - Read
  - Write
  - Bash
  - Task
  - Glob
  - Grep
---

<objective>
Run a question or prompt through the full QGSD quorum (R3 protocol): Claude + Codex + Gemini + OpenCode + Copilot.

**Two modes** based on context:
- **Mode A — Pure Question**: No commands required. Claude forms its own position first, then queries each model sequentially, deliberates to consensus.
- **Mode B — Execution + Trace Review**: Running commands is necessary before a verdict is possible. Claude runs them, preserves full traces, quorum reviews traces and gives verdicts.
</objective>

<mode_detection>
**Default: Mode A.**

Switch to **Mode B** only if the question/prompt explicitly requires running commands before answering — e.g.:
- "should we approve this plan", "does this pass", "is this safe to execute"
- "run [command] and tell me if...", "verify that [thing] works"
- "review the output of...", "check if the tests pass and then..."

If `$ARGUMENTS` is empty: use the most recent open question or decision from the current conversation context as the question.
</mode_detection>

---

## Mode A — Pure Question

### Step 1: Parse question

Input is `$ARGUMENTS`. If empty, identify the open question from conversation context and display:
```
Using conversation context as question: "[inferred question]"
```

If no question can be inferred, stop: "Usage: /qgsd:quorum <question or prompt>"

Display:
```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 QGSD ► QUORUM: Mode A — Pure Question
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Question: [question]

Forming Claude's position...
```

### Step 2: Claude forms position (Round 1)

Before querying any model, state Claude's own answer and reasoning:
```
Claude (Round 1): [answer + reasoning — 2–4 sentences]
```

Store as `$CLAUDE_POSITION`.

### Step 3: Query each model sequentially

Query each model with identical prompts — each call MUST be a **separate, sequential tool call** (not sibling calls in the same message, per R3.2):

Prompt template:
```
QGSD Quorum — Round 1

Question: [question]

You are one of five quorum members evaluating this question independently. Give your honest answer with reasoning. Be concise (3–6 sentences). State your position clearly. Do not defer to other models.
```

Call order (sequential):
1. `mcp__codex-cli__review`
2. `mcp__gemini-cli__gemini`
3. `mcp__opencode__opencode`
4. `mcp__copilot-cli__ask`

Handle UNAVAILABLE per R6: note unavailability, continue with remaining models.

### Step 4: Evaluate Round 1 — check for consensus

Display all positions:
```
┌──────────────┬──────────────────────────────────────────────────────────┐
│ Model        │ Round 1 Position                                         │
├──────────────┼──────────────────────────────────────────────────────────┤
│ Claude       │ [summary]                                                │
│ Codex        │ [summary or UNAVAIL]                                     │
│ Gemini       │ [summary or UNAVAIL]                                     │
│ OpenCode     │ [summary or UNAVAIL]                                     │
│ Copilot      │ [summary or UNAVAIL]                                     │
└──────────────┴──────────────────────────────────────────────────────────┘
```

If all available models agree → skip to **Step 6 (consensus output)**.

### Step 5: Deliberation rounds (R3.3)

Run up to 3 deliberation rounds (max 4 total rounds including Round 1).

For each round, share **all prior positions** with every model and ask each to reconsider or defend.

Deliberation prompt template:
```
QGSD Quorum — Round [N] Deliberation

Question: [question]

Prior positions:
• Claude: [position]
• Codex: [position or UNAVAIL]
• Gemini: [position or UNAVAIL]
• OpenCode: [position or UNAVAIL]
• Copilot: [position or UNAVAIL]

Given the above, do you maintain your answer or revise it? State your updated position clearly (2–4 sentences).
```

Each model is called **sequentially** (not as sibling calls).

Stop deliberation **immediately** upon CONSENSUS (all available models agree).

After 4 total rounds with no consensus → **Step 7 (escalate)**.

### Step 6: Consensus output

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 QGSD ► QUORUM CONSENSUS REACHED
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Question: [question]
Rounds to consensus: [N]

CONSENSUS ANSWER:
[Full consensus answer — detailed and actionable]

Supporting positions:
• Claude:    [brief]
• Codex:     [brief or UNAVAIL]
• Gemini:    [brief or UNAVAIL]
• OpenCode:  [brief or UNAVAIL]
• Copilot:   [brief or UNAVAIL]
```

Update the scoreboard: for each model that voted this round, run:

```bash
node bin/update-scoreboard.cjs \
  --model <model_name> \
  --result <vote_code> \
  --task "<task_label>" \
  --round <round_number> \
  --verdict <VERDICT>
```

`--model` values: claude, gemini, opencode, copilot, codex
`--result` values: TP, TN, FP, FN, TP+ (improvement accepted), UNAVAIL (model skipped), or leave as empty string if model did not participate
`--task` label: short identifier, e.g. "quick-25" or "plan-ph17"
`--round`: the round number that just completed
`--verdict`: the consensus verdict (APPROVE | BLOCK | DELIBERATE | CONSENSUS | GAPS_FOUND)

Run one command per model per round. Each call is atomic and idempotent — if re-run for the same task+round+model it overwrites that model's vote and recalculates from scratch.

### Step 7: Escalate — no consensus after 4 rounds

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 QGSD ► QUORUM ESCALATING — NO CONSENSUS AFTER 4 ROUNDS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Question: [question]

Final positions:
• Claude:    [position + key reasoning]
• Codex:     [position + key reasoning or UNAVAIL]
• Gemini:    [position + key reasoning or UNAVAIL]
• OpenCode:  [position + key reasoning or UNAVAIL]
• Copilot:   [position + key reasoning or UNAVAIL]

Core disagreement: [1–2 sentences on what models disagree about]

Claude's recommendation: [Claude's position with rationale]
```

Update the scoreboard: for each model that voted this round, run:

```bash
node bin/update-scoreboard.cjs \
  --model <model_name> \
  --result <vote_code> \
  --task "<task_label>" \
  --round <round_number> \
  --verdict <VERDICT>
```

`--model` values: claude, gemini, opencode, copilot, codex
`--result` values: TP, TN, FP, FN, TP+ (improvement accepted), UNAVAIL (model skipped), or leave as empty string if model did not participate
`--task` label: short identifier, e.g. "quick-25" or "plan-ph17"
`--round`: the round number that just completed
`--verdict`: the consensus verdict (APPROVE | BLOCK | DELIBERATE | CONSENSUS | GAPS_FOUND)

Run one command per model per round. Each call is atomic and idempotent — if re-run for the same task+round+model it overwrites that model's vote and recalculates from scratch.

---

## Mode B — Execution + Trace Review

### Step 1: Parse commands

Extract command(s) to run from `$ARGUMENTS`. If unclear, ask the user to specify.

Display:
```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 QGSD ► QUORUM: Mode B — Execution + Trace Review
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Question: [original question]
Commands: [list]

Running commands...
```

### Step 2: Execute and capture traces

Run each command, capturing full stdout + stderr + exit code.

Store as `$TRACES`:
```
=== Command: [cmd] ===
Exit code: N
Output:
[full output — not summarized]
```

Claude also gives its own verdict before dispatching workers.

### Step 3: Assemble review bundle

```
QUESTION: [original question]

=== EXECUTION TRACES ===
$TRACES
```

### Step 4: Dispatch parallel quorum workers via Task

Task subagents are isolated subprocesses — parallel dispatch is safe (a failing Task does not propagate to co-submitted Tasks, unlike direct sibling MCP calls).

Worker prompt template:
```
QGSD Quorum — Execution Review

[bundle]

Question: [original question]

Review the execution traces above. Give:

verdict: APPROVE | REJECT | FLAG
reasoning: [2–4 sentences grounded in the actual trace output — not assumptions]

APPROVE if output clearly shows the question is satisfied.
REJECT if output shows it is NOT satisfied.
FLAG if output is ambiguous or requires human judgment.
```

Dispatch (single parallel message — all four as sibling Task calls):
- `Task(subagent_type="general-purpose", prompt="Call mcp__gemini-cli__gemini with the following prompt. Pass the full literal bundle inline — do not summarize or truncate: [full worker prompt with bundle inlined]")`
- `Task(subagent_type="general-purpose", prompt="Call mcp__opencode__opencode with the following prompt. Pass the full literal bundle inline — do not summarize or truncate: [full worker prompt with bundle inlined]")`
- `Task(subagent_type="general-purpose", prompt="Call mcp__copilot-cli__ask with the following prompt. Pass the full literal bundle inline — do not summarize or truncate: [full worker prompt with bundle inlined]")`
- `Task(subagent_type="general-purpose", prompt="Call mcp__codex-cli__review with the following prompt. Pass the full literal bundle inline — do not summarize or truncate: [full worker prompt with bundle inlined]")`

### Step 5: Collect verdicts

Parse each worker response for `verdict:` and `reasoning:` lines. Mark non-parseable as `UNAVAIL`.

Determine consensus:
- All available APPROVE → `APPROVE`
- Any REJECT → `REJECT`
- All FLAG (no APPROVE, no REJECT) → `FLAG`
- Mixed APPROVE/FLAG → `FLAG`
- All UNAVAIL → stop: "All quorum models unavailable — cannot evaluate."

If split: run deliberation (up to 3 rounds) with traces always included in context.

### Step 6: Output consensus verdict

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 QGSD ► QUORUM VERDICT
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

┌──────────────┬──────────────┬──────────────────────────────────────────┐
│ Model        │ Verdict      │ Reasoning                                │
├──────────────┼──────────────┼──────────────────────────────────────────┤
│ Claude       │ [verdict]    │ [summary]                                │
│ Gemini       │ [verdict]    │ [summary or UNAVAIL]                     │
│ OpenCode     │ [verdict]    │ [summary or UNAVAIL]                     │
│ Copilot      │ [verdict]    │ [summary or UNAVAIL]                     │
│ Codex        │ [verdict]    │ [summary or UNAVAIL]                     │
├──────────────┼──────────────┼──────────────────────────────────────────┤
│ CONSENSUS    │ [verdict]    │ [N APPROVE, N REJECT, N FLAG, N UNAVAIL] │
└──────────────┴──────────────┴──────────────────────────────────────────┘

[rationale — what the traces showed]
```

Update the scoreboard: for each model that voted this round, run:

```bash
node bin/update-scoreboard.cjs \
  --model <model_name> \
  --result <vote_code> \
  --task "<task_label>" \
  --round <round_number> \
  --verdict <VERDICT>
```

`--model` values: claude, gemini, opencode, copilot, codex
`--result` values: TP, TN, FP, FN, TP+ (improvement accepted), UNAVAIL (model skipped), or leave as empty string if model did not participate
`--task` label: short identifier, e.g. "quick-25" or "plan-ph17"
`--round`: the round number that just completed
`--verdict`: the consensus verdict (APPROVE | BLOCK | DELIBERATE | CONSENSUS | GAPS_FOUND)

Run one command per model per round. Each call is atomic and idempotent — if re-run for the same task+round+model it overwrites that model's vote and recalculates from scratch.
