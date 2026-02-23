---
name: qgsd:quorum
description: Answer a question using full quorum consensus (Claude + native CLI agents + all configured claude-mcp-server instances) following CLAUDE.md R3 protocol. Use when no arguments provided to answer the current conversation's open question.
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
Run a question or prompt through the full QGSD quorum (R3 protocol): Claude + native CLI agents (Codex, Gemini, OpenCode, Copilot) + all claude-mcp-server instances configured in `~/.claude.json`.

**Two modes** based on context:
- **Mode A — Pure Question**: No commands required. Claude forms its own position first, then queries each model sequentially, deliberates to consensus.
- **Mode B — Execution + Trace Review**: Running commands is necessary before a verdict is possible. Claude runs them, preserves full traces, quorum reviews traces and gives verdicts.
</objective>

<orchestrator_delegation>
**Preferred execution path:** spawn the `qgsd-quorum-orchestrator` agent, which encapsulates
the full R3 protocol (provider pre-flight, team identity, Mode A/B, deliberation, scoreboard).

Resolve the question to pass:

1. If $ARGUMENTS is non-empty → use it directly as the question/prompt.
2. If $ARGUMENTS is empty → scan the current conversation using this priority order:
   - **Priority 1** — Most recent message containing `?` without a substantive answer yet.
   - **Priority 2** — Most recent message describing a choice/trade-off (keywords: "should we", "which approach", "option A vs", "do we", "whether to").
   - **Priority 3** — Most recent open concern or blocker ("not sure", "concern", "blocker", "unclear", "wondering").
   - If none found: stop with `"No open question found. Provide one explicitly: /qgsd:quorum <question>"`

When question is inferred, display before spawning:
```
Using conversation context as question (Priority N - [type]):
"[inferred question text]"
```

Then spawn the orchestrator:

```
Task(
  subagent_type="qgsd-quorum-orchestrator",
  prompt="[resolved question or bundle]"
)
```

The orchestrator returns a structured consensus verdict. Relay it to the user.

**Fallback:** If the orchestrator is unavailable, execute the full protocol inline using
the steps in the `<mode_detection>` and subsequent sections below.
</orchestrator_delegation>

<mode_detection>
**Default: Mode A.**

Switch to **Mode B** only if the question/prompt explicitly requires running commands before answering — e.g.:
- "should we approve this plan", "does this pass", "is this safe to execute"
- "run [command] and tell me if...", "verify that [thing] works"
- "review the output of...", "check if the tests pass and then..."

If $ARGUMENTS is empty: use the most recent open question or decision from the current conversation context as the question.
</mode_detection>

---

> **SEQUENTIAL CALLS ONLY — NO SIBLING TOOL CALLS**
> Every MCP tool call and every Task spawn in this command MUST be issued as a separate, standalone message turn — never batched or co-submitted as sibling calls. This applies to identity checks, health checks, inference calls, and Task subagent dispatches. A single failure in a sibling batch propagates "Sibling tool call errored" to all co-submitted calls, corrupting the entire quorum. When in doubt: one call, then wait for the response, then proceed.

---

### Provider pre-flight (run once before team capture)

Before any model calls, run a fast HTTP probe of the underlying LLM providers:

```bash
node "$HOME/.claude/qgsd-bin/check-provider-health.cjs" --json
```

Parse the JSON output. Build two structures:

1. **`$PROVIDER_STATUS`**: `{ providerName: healthy }` — map of provider name to up/down status.

2. **`$CLAUDE_MCP_SERVERS`**: flat list of `{ serverName, model, providerName, available }` — extracted from the `servers[]` and `models[]` arrays in each provider entry. A server's `available` is `false` if its provider's `healthy` is `false`.

Any server with `available: false` must be marked UNAVAIL immediately — skip its health_check and inference calls entirely. This prevents hangs from unresponsive provider endpoints.

3. **`$QUORUM_ACTIVE`**: read from `~/.claude/qgsd.json` (project config takes precedence over global):
```bash
node -e "
const fs = require('fs'), os = require('os'), path = require('path');
const globalCfg = path.join(os.homedir(), '.claude', 'qgsd.json');
const projCfg   = path.join(process.cwd(), '.claude', 'qgsd.json');
let cfg = {};
for (const f of [globalCfg, projCfg]) {
  try { Object.assign(cfg, JSON.parse(fs.readFileSync(f, 'utf8'))); } catch(_){}
}
console.log(JSON.stringify(cfg.quorum_active || []));
"
```
If `$QUORUM_ACTIVE` is empty (`[]`), all entries in `$CLAUDE_MCP_SERVERS` participate.
If non-empty, intersect: only servers whose `serverName` appears in `$QUORUM_ACTIVE` are called.
A server in `$QUORUM_ACTIVE` but absent from `$CLAUDE_MCP_SERVERS` = skip silently (fail-open).

**Pre-flight slot skip:** After building `$CLAUDE_MCP_SERVERS`, immediately filter the list for the quorum run:
- For each server with `available: false`, log: `Pre-flight skip: <serverName> (<providerName> DOWN)`
- Remove these servers from the working list for all subsequent steps (team capture, Round 1, deliberation).
- Reorder the remaining working list: healthy servers first (preserving discovery order within each group).
- Log the final working list as: `Active slots: <slot1>, <slot2>, ...`

**min_quorum_size check:** Read `min_quorum_size` from `~/.claude/qgsd.json` (project config takes precedence; default: 3 if absent):
```bash
node -e "
const fs = require('fs'), os = require('os'), path = require('path');
const globalCfg = path.join(os.homedir(), '.claude', 'qgsd.json');
const projCfg   = path.join(process.cwd(), '.claude', 'qgsd.json');
let cfg = {};
for (const f of [globalCfg, projCfg]) {
  try { Object.assign(cfg, JSON.parse(fs.readFileSync(f, 'utf8'))); } catch(_){}
}
console.log(cfg.min_quorum_size ?? 3);
"
```
Count available slots (those not marked UNAVAIL and passing $QUORUM_ACTIVE filter). Include Claude itself as +1.
If `availableCount < min_quorum_size`:
  - If $ARGUMENTS contains `--force-quorum`: log warning `[WARN] Quorum below min_quorum_size (N available, min M) — proceeding due to --force-quorum` and continue.
  - Otherwise: stop with:
    ```
    QUORUM BLOCKED: Only N model(s) available (min_quorum_size = M).
    Available: [list slots]
    UNAVAIL:   [list skipped slots with reason]
    Re-run with --force-quorum to override, or wait for providers to recover.
    ```

Display pre-flight result inline (one line):
```
Provider pre-flight: <providerName>=✓/✗ ...  (<N> claude-mcp servers found)
```

---

### Team identity capture (idempotent — run once per session)

Before any quorum round, capture the active team fingerprint. The scoreboard only updates if the composition has changed.

**Native CLI agents** — call `identity` sequentially (skip UNAVAIL per R6):

1. `mcp__codex-cli-1__identity` → parse JSON response
2. `mcp__gemini-cli-1__identity` → parse JSON response
3. `mcp__opencode-1__identity` → parse JSON response
4. `mcp__copilot-1__identity` → parse JSON response

**claude-mcp-server instances** — iterate over `$CLAUDE_MCP_SERVERS` in order:

For each server in `$CLAUDE_MCP_SERVERS` (skip if `available: false`):
- Call `mcp__<serverName>__health_check`
- If response contains `"healthy": true` → add to TEAM_JSON:
  `"<serverName>": { "type": "claude-mcp", "model": "<model>" }`
- Else → mark that server UNAVAIL

**Timeout guard:** Each `mcp__<serverName>__health_check` and inference call must complete within the slot's `quorum_timeout_ms` value from `providers.json` (fallback: 30000ms if field absent). Read the full providers.json once at the start of team capture and build a lookup map `$SLOT_TIMEOUTS: { slotName: quorum_timeout_ms }`. Apply the slot's timeout to every subsequent call to that slot (team capture, Round 1, deliberation).

The display name for a claude-mcp server is the slot name as-is (e.g., `claude-1`, `claude-2`). For native CLI agents: `codex-cli-1`, `gemini-cli-1`, etc. No prefix stripping. For claude-mcp servers, capture the full `model` field from `health_check` (e.g. `deepseek-ai/DeepSeek-V3`) — use it as `--model-id` with `--slot` when updating the scoreboard; do NOT derive a short key.

Build `TEAM_JSON` as a JSON object keyed by display name:
- Native agents use keys: `codex`, `gemini`, `opencode`, `copilot`
- claude-mcp servers use their stripped display name

Omit UNAVAIL models entirely.

Detect Claude's model ID from: `CLAUDE_MODEL` env var → `ANTHROPIC_MODEL` env var → current session model name from system context.

Run:
```bash
node "$HOME/.claude/qgsd-bin/update-scoreboard.cjs" init-team \
  --claude-model "<claude_model_id>" \
  --team '<TEAM_JSON>'
```

The command prints `[init-team] fingerprint: <fp> | no change` if unchanged, or `[init-team] fingerprint: <fp> (updated from <old>) | N agents, M MCPs, P plugins` if updated. Then proceed to Mode A or Mode B.

---

## Mode A — Pure Question

### Parse question

If $ARGUMENTS is empty, scan the current conversation using this priority order:

Priority 1 - Explicit question: Find the most recent message containing a literal "?" that has not yet received a substantive answer. Use that as the question.

Priority 2 - Pending decision: Find the most recent message that describes a choice or trade-off between options (keywords: "should we", "which approach", "option A vs", "do we", "whether to"). Use that as the question.

Priority 3 - Open concern or blocker: Find the most recent message that raises a concern, flags a risk, or states something is unclear (keywords: "not sure", "concern", "blocker", "question:", "unclear", "wondering"). Restate it as a question.

If none of the above applies: stop with:
"No open question found. Looked for: explicit '?' question, pending decision, or open concern in recent conversation. Provide a question explicitly: /qgsd:quorum <question>"

When a question is inferred via any priority, Claude MUST display before proceeding:
"Using conversation context as question (Priority N - [type]):
"[inferred question text]""

Display:
```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 QGSD ► QUORUM: Mode A — Pure Question
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Question: [question]
```

### Claude's position (Round 1)

Before querying any model, state Claude's own answer and reasoning:
```
Claude (Round 1): [answer + reasoning — 2–4 sentences]
```

Store as `$CLAUDE_POSITION`.

### Query models (sequential)

Query each model with identical prompts — each call MUST be a **separate, sequential tool call** (not sibling calls in the same message, per R3.2):

Prompt template:
```
QGSD Quorum — Round 1

Question: [question]

You are one of the quorum members evaluating this question independently. Give your honest answer with reasoning. Be concise (3–6 sentences). State your position clearly. Do not defer to other models.
```

Call order (sequential):

**Native CLI agents** (hardcoded tool names):
1. `mcp__codex-cli-1__review`
2. `mcp__gemini-cli-1__gemini`
3. `mcp__opencode-1__opencode`
4. `mcp__copilot-1__ask`

**claude-mcp instances** (dynamic — iterate over available servers in `$CLAUDE_MCP_SERVERS` order):
For each server with `available: true` and healthy from team capture:
- Call `mcp__<serverName>__claude` with the query prompt (field name: `prompt`)

Handle UNAVAILABLE per R6: note unavailability, continue with remaining models.

### Evaluate Round 1 — check for consensus

Display all positions as a table with one row per team member (native agents first, then claude-mcp servers in discovery order):

```
┌──────────────┬──────────────────────────────────────────────────────────┐
│ Model        │ Round 1 Position                                         │
├──────────────┼──────────────────────────────────────────────────────────┤
│ Claude       │ [summary]                                                │
│ Codex        │ [summary or UNAVAIL]                                     │
│ Gemini       │ [summary or UNAVAIL]                                     │
│ OpenCode     │ [summary or UNAVAIL]                                     │
│ Copilot      │ [summary or UNAVAIL]                                     │
│ <display-name for each claude-mcp server, dynamically> │ [summary or UNAVAIL] │
└──────────────┴──────────────────────────────────────────────────────────┘
```

If all available models agree → skip to **Consensus output**.

### Deliberation rounds (R3.3)

Run up to 3 deliberation rounds (max 4 total rounds including Round 1).

For each round, share **all prior positions** with every model and ask each to reconsider or defend.

Deliberation prompt template:
```
QGSD Quorum — Round [N] Deliberation

Question: [question]

Prior positions:
• Claude:    [position]
• Codex:     [position or UNAVAIL]
• Gemini:    [position or UNAVAIL]
• OpenCode:  [position or UNAVAIL]
• Copilot:   [position or UNAVAIL]
[one line per claude-mcp server: • <display-name>: [position or UNAVAIL]]

Given the above, do you maintain your answer or revise it? State your updated position clearly (2–4 sentences).
```

Each model is called **sequentially** (not as sibling calls).

Stop deliberation **immediately** upon CONSENSUS (all available models agree).

After 4 total rounds with no consensus → **Escalate**.

### Consensus output

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
[one line per claude-mcp server: • <display-name>: [brief or UNAVAIL]]
```

Update the scoreboard: for each model that voted this round, run:

```bash
# For native agents:
node "$HOME/.claude/qgsd-bin/update-scoreboard.cjs" \
  --model <model_name> \
  --result <vote_code> \
  --task "<task_label>" \
  --round <round_number> \
  --verdict <VERDICT> \
  --task-description "<question or topic being debated>"

# For each claude-mcp server (use slot + full model-id, NOT --model):
node "$HOME/.claude/qgsd-bin/update-scoreboard.cjs" \
  --slot <slotName> \
  --model-id <fullModelId> \
  --result <vote_code> \
  --task "<task_label>" \
  --round <round_number> \
  --verdict <VERDICT> \
  --task-description "<question or topic being debated>"
```

- `--model` for native agents: `claude`, `gemini`, `opencode`, `copilot`, `codex`
- For claude-mcp servers: use `--slot <slotName>` (e.g. `claude-1`) and `--model-id <fullModelId>` (e.g. `deepseek-ai/DeepSeek-V3` — the exact string returned by health_check, NOT a derived short key). This writes to `data.slots{}` with composite key `<slot>:<model-id>`.
- `--result` values: TP, TN, FP, FN, TP+ (improvement accepted), or leave as empty string if model did not participate. Skip calling update-scoreboard entirely for models that were UNAVAIL.
- `--task` label: short identifier, e.g. "quick-25" or "plan-ph17"
- `--round`: the round number that just completed
- `--verdict`: the consensus verdict (APPROVE | BLOCK | DELIBERATE | CONSENSUS | GAPS_FOUND)
- `--task-description`: the full debate question/topic (the `[question]` value). Used by Haiku to auto-classify the category. Omit if the question is too long (>500 chars) — use a shortened summary instead.

Run one command per model per round. Each call is atomic and idempotent — if re-run for the same task+round+model it overwrites that model's vote and recalculates from scratch.

### Escalate — no consensus after 4 rounds

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
[one line per claude-mcp server: • <display-name>: [position + key reasoning or UNAVAIL]]

Core disagreement: [1–2 sentences on what models disagree about]

Claude's recommendation: [Claude's position with rationale]
```

Update the scoreboard: for each model that voted this round, run:

```bash
# For native agents:
node "$HOME/.claude/qgsd-bin/update-scoreboard.cjs" \
  --model <model_name> \
  --result <vote_code> \
  --task "<task_label>" \
  --round <round_number> \
  --verdict <VERDICT> \
  --task-description "<question or topic being debated>"

# For each claude-mcp server (use slot + full model-id, NOT --model):
node "$HOME/.claude/qgsd-bin/update-scoreboard.cjs" \
  --slot <slotName> \
  --model-id <fullModelId> \
  --result <vote_code> \
  --task "<task_label>" \
  --round <round_number> \
  --verdict <VERDICT> \
  --task-description "<question or topic being debated>"
```

- `--model` for native agents: `claude`, `gemini`, `opencode`, `copilot`, `codex`
- For claude-mcp servers: use `--slot <slotName>` (e.g. `claude-1`) and `--model-id <fullModelId>` (e.g. `deepseek-ai/DeepSeek-V3` — the exact string returned by health_check, NOT a derived short key). This writes to `data.slots{}` with composite key `<slot>:<model-id>`.
- `--result` values: TP, TN, FP, FN, TP+ (improvement accepted), or leave as empty string if model did not participate. Skip calling update-scoreboard entirely for models that were UNAVAIL.
- `--round`: the round number that just completed
- `--verdict`: the consensus verdict (APPROVE | BLOCK | DELIBERATE | CONSENSUS | GAPS_FOUND)

Run one command per model per round. Each call is atomic and idempotent.

---

## Mode B — Execution + Trace Review

### Parse commands

Extract command(s) to run from $ARGUMENTS. If unclear, ask the user to specify.

Display:
```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 QGSD ► QUORUM: Mode B — Execution + Trace Review
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Question: [original question]
Commands: [list]

Running commands...
```

### Execute and capture traces

Run each command, capturing full stdout + stderr + exit code.

Store as `$TRACES`:
```
=== Command: [cmd] ===
Exit code: N
Output:
[full output — not summarized]
```

Claude also gives its own verdict before dispatching workers.

### Assemble review bundle

```
QUESTION: [original question]

=== EXECUTION TRACES ===
$TRACES
```

### Dispatch quorum workers via Task (sequential — one at a time)

Task subagents must be dispatched **sequentially**, one per message turn. Do NOT co-submit multiple Task calls in the same message, even though Task subagents are isolated. Sibling Task calls still produce "Sibling tool call errored" propagation in Claude Code when any one fails.

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

Dispatch (sequential — one Task per message turn):

**Native agents** (hardcoded):
- `Task(subagent_type="general-purpose", prompt="Call mcp__gemini-cli-1__gemini with the following prompt. Pass the full literal bundle inline — do not summarize or truncate: [full worker prompt with bundle inlined]")`
- `Task(subagent_type="general-purpose", prompt="Call mcp__opencode-1__opencode with the following prompt. Pass the full literal bundle inline — do not summarize or truncate: [full worker prompt with bundle inlined]")`
- `Task(subagent_type="general-purpose", prompt="Call mcp__copilot-1__ask with the following prompt. Pass the full literal bundle inline — do not summarize or truncate: [full worker prompt with bundle inlined]")`
- `Task(subagent_type="general-purpose", prompt="Call mcp__codex-cli-1__review with the following prompt. Pass the full literal bundle inline — do not summarize or truncate: [full worker prompt with bundle inlined]")`

**claude-mcp instances** (dynamic — one Task per available server in `$CLAUDE_MCP_SERVERS`):
For each server with `available: true` and healthy from team capture:
- `Task(subagent_type="general-purpose", prompt="Call mcp__<serverName>__claude with prompt=[full worker prompt with bundle inlined]. Pass the full literal bundle inline — do not summarize or truncate.")`

### Collect verdicts

Parse each worker response for `verdict:` and `reasoning:` lines. Mark non-parseable as `UNAVAIL`.

Determine consensus:
- All available APPROVE → `APPROVE`
- Any REJECT → `REJECT`
- All FLAG (no APPROVE, no REJECT) → `FLAG`
- Mixed APPROVE/FLAG → `FLAG`
- All UNAVAIL → stop: "All quorum models unavailable — cannot evaluate."

If split: run deliberation (up to 3 rounds) with traces always included in context.

### Output consensus verdict

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
│ <display-name for each claude-mcp server, dynamically> │ [verdict] │ [summary or UNAVAIL] │
├──────────────┼──────────────┼──────────────────────────────────────────┤
│ CONSENSUS    │ [verdict]    │ [N APPROVE, N REJECT, N FLAG, N UNAVAIL] │
└──────────────┴──────────────┴──────────────────────────────────────────┘

[rationale — what the traces showed]
```

Update the scoreboard with the same `update-scoreboard.cjs` pattern as Mode A.

`--model` for native agents: `claude`, `gemini`, `opencode`, `copilot`, `codex`
`--slot` for claude-mcp servers: use the slot name (e.g. `claude-1`); `--model-id`: use the `model` field returned by the `health_check` response (e.g. `deepseek-ai/DeepSeek-V3`). Use `--slot` + `--model-id` instead of `--model` for all claude-mcp instances.
`--result` values: TP, TN, FP, FN, TP+ (improvement accepted), UNAVAIL (model skipped), or leave as empty string if model did not participate
`--task` label: short identifier, e.g. "quick-25" or "plan-ph17"
`--round`: the round number that just completed
`--verdict`: the consensus verdict (APPROVE | BLOCK | DELIBERATE | CONSENSUS | GAPS_FOUND)
`--task-description`: a brief description of what was being verified/reviewed (from $ARGUMENTS or a short summary). Used by Haiku to auto-classify. Optional — omit if not meaningful.

Run one command per model per round. Each call is atomic and idempotent — if re-run for the same task+round+model it overwrites that model's vote and recalculates from scratch.
