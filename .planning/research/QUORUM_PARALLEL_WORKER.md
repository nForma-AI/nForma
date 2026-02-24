# Quorum Parallel Worker — Design Research

**Project:** QGSD
**File:** `.planning/research/QUORUM_PARALLEL_WORKER.md`
**Researched:** 2026-02-24
**Confidence:** HIGH — all findings derived from reading live source files in this repo

---

## 1. What We Are Designing

A `qgsd-quorum-worker` sub-agent that can be spawned in parallel via the Claude `Task` tool, one per quorum slot, to replace the current sequential `call-quorum-slot.cjs` loop in `qgsd-quorum-orchestrator.md`.

**Goal:** Cut total quorum wall-clock time from `N × timeout` to `max(slot_timeout)` by running all slots simultaneously.

---

## 2. Existing Agent Anatomy (Observed Patterns)

Every agent in `agents/` shares the same structure. Observed across `qgsd-quorum-test-worker.md`, `qgsd-plan-checker.md`, `qgsd-executor.md`, `qgsd-verifier.md`, `qgsd-planner.md`, and `qgsd-quorum-orchestrator.md`.

### Frontmatter Schema

```yaml
---
name: <agent-name>
description: <one-line description of what spawns this and what it returns>
tools: <comma-separated list — only tools the agent actually uses>
color: <terminal color label>
---
```

No other frontmatter fields are used. All behavioral logic lives in the markdown body.

### Tool Declarations in Existing Agents

| Agent | Tools |
|---|---|
| `qgsd-quorum-orchestrator` | Read, Write, Bash, Task, Glob, Grep |
| `qgsd-quorum-test-worker` | Read |
| `qgsd-plan-checker` | Read, Bash, Glob, Grep |
| `qgsd-executor` | Read, Write, Edit, Bash, Grep, Glob |
| `qgsd-verifier` | Read, Write, Bash, Grep, Glob |
| `qgsd-planner` | Read, Write, Bash, Glob, Grep, WebFetch, mcp__context7__* |

**Key observation for the worker:** The `qgsd-quorum-test-worker` only has `Read`. This is intentional — it receives its full bundle in `$ARGUMENTS` and only needs to read auxiliary files. The quorum worker has a similar read-heavy profile but needs `Bash` to call `call-quorum-slot.cjs` (one slot per worker invocation).

**Worker tool set:** `Read, Bash, Glob, Grep`

- `Read` — read CLAUDE.md, STATE.md, artifact files referenced by the question
- `Bash` — invoke `call-quorum-slot.cjs` for exactly one slot
- `Glob` / `Grep` — locate repo files that are relevant to the question before answering

No `Write` needed. The worker does not commit, update scoreboard, or persist anything. Scoreboard updates and result collection are the orchestrator's responsibility after the parallel wave completes.

---

## 3. How `call-quorum-slot.cjs` Works (Current Sequential Path)

Source: `bin/call-quorum-slot.cjs`

```
stdin prompt → providers.json lookup → subprocess or HTTP dispatch → stdout result
```

The script:
1. Reads `providers.json` from a set of well-known search paths (including from `~/.claude.json` `unified-1` mcpServer config)
2. Matches `--slot <name>` against `providers[].name`
3. For `type: "subprocess"`: spawns the CLI with `args_template`, passes prompt via `--slot` positional, captures stdout/stderr
4. For `type: "http"`: makes a chat/completions POST, returns `choices[0].message.content`
5. Exits 0 on success, 1 on timeout/error

**Current providers in `providers.json`:**

| Slot | Type | Model | `quorum_timeout_ms` |
|---|---|---|---|
| `codex-1` | subprocess | gpt-5.3-codex | 30000 |
| `gemini-1` | subprocess | gemini-3-pro-preview | 30000 |
| `opencode-1` | subprocess | grok-code-fast-1 | 30000 |
| `copilot-1` | subprocess | gpt-4.1 | 30000 |
| `claude-1` | subprocess (ccr) | DeepSeek-V3.2 | 20000 |
| `claude-2` | subprocess (ccr) | MiniMax-M2.5 | 20000 |
| `claude-3` | subprocess (ccr) | Qwen3-Coder-480B | 30000 |
| `claude-4` | subprocess (ccr) | Kimi-K2 | 30000 |
| `claude-5` | subprocess (ccr) | Llama-4-Maverick | 10000 |
| `claude-6` | subprocess (ccr) | GLM-5 | 8000 |

All slots are subprocess-type (no pure HTTP slots in current `providers.json`). Workers invoke `call-quorum-slot.cjs` identically regardless of underlying provider type — the script handles the dispatch.

**Critical constraint:** `call-quorum-slot.cjs` does NOT support multiple slots per invocation. One call = one slot. This maps cleanly to one worker = one slot.

---

## 4. What `$ARGUMENTS` the Worker Receives

The orchestrator spawns one Task per active slot. Each Task's `prompt` argument is the complete input to the worker agent — this becomes `$ARGUMENTS` in the agent.

The worker `$ARGUMENTS` must contain everything the worker needs to:

1. Know which slot to call
2. Build the quorum prompt
3. Know the mode (A = pure question, B = execution trace review)
4. Know the round number (1 = initial, 2+ = deliberation)
5. Know prior positions (deliberation rounds only)
6. Know the repo path (for `--cwd` to `call-quorum-slot.cjs`)
7. Know the slot timeout
8. Optionally: an artifact path to read before answering

### Proposed `$ARGUMENTS` Structure

The orchestrator passes a structured block. The worker parses it by line-prefix matching (same pattern used in `qgsd-quorum-orchestrator.md` for `artifact_path:` and `cwd:`).

```
slot: <slotName>
round: <integer>
timeout_ms: <integer>
repo_dir: <absolute path>
mode: A | B
question: <the question text>

[artifact_path: <path>]          # optional
[artifact_line_count: <integer>] # optional, provided when artifact_path is set

[prior_positions:                # only present in round 2+
• Claude:    <position summary>
• <slot>:    <position summary or UNAVAIL>
...]

[traces:                         # only present in Mode B
=== Command: <cmd> ===
Exit code: N
Output:
<full stdout/stderr>
]
```

This format is consistent with how the orchestrator currently builds prompts for `call-quorum-slot.cjs` — it is just the same prompt passed as structured ARGUMENTS to the worker instead of piped to a bash heredoc.

---

## 5. Required Structured Output

The worker returns a single structured block. The orchestrator parses this after all Task calls complete.

```
slot: <slotName>
round: <integer>
verdict: APPROVE | REJECT | FLAG | UNAVAIL | <free text for Mode A>
reasoning: <2-4 sentence summary of the slot's response>
raw: |
  <full raw output from call-quorum-slot.cjs — truncated to 2000 chars if longer>
unavail_message: <first 500 chars of raw output, only if verdict is UNAVAIL>
```

**Rules:**

- `verdict` for Mode A: The slot's stated position, condensed. If the slot output is parseable as APPROVE/BLOCK/DELIBERATE, use that. Otherwise use a 3-5 word label.
- `verdict` for Mode B: Must be one of `APPROVE | REJECT | FLAG | UNAVAIL`. Parse from `verdict:` line in the slot's response.
- `reasoning`: Always present. Distilled from the slot response. If UNAVAIL, reasoning = error description.
- `raw`: Always present. Enables the orchestrator to do its own parsing if needed.
- `unavail_message`: Only present when verdict is UNAVAIL. Used by orchestrator to call `update-scoreboard.cjs set-availability`.

---

## 6. How the Orchestrator Collects Results After a Parallel Wave

The orchestrator spawns all active slots as simultaneous Task calls. Claude's Task tool is parallel when multiple Task calls are issued in the same message turn.

**Collection pattern:**

```
# Orchestrator spawns N workers in one message turn (parallel Task calls):
Task(subagent_type=qgsd-quorum-worker, prompt="slot: codex-1\nround: 1\n...")
Task(subagent_type=qgsd-quorum-worker, prompt="slot: gemini-1\nround: 1\n...")
Task(subagent_type=qgsd-quorum-worker, prompt="slot: claude-3\nround: 1\n...")
... (one per active slot)

# All Tasks return. Orchestrator receives N result strings.
# Orchestrator parses each result for: slot, round, verdict, reasoning, raw, unavail_message

# For each result where verdict == UNAVAIL:
#   Call update-scoreboard.cjs set-availability --slot <slot> --message <unavail_message>

# Orchestrator then renders the positions table and runs consensus check.
```

**Key constraint from existing orchestrator (R3.2):** The current orchestrator enforces "SEQUENTIAL CALLS ONLY — NO SIBLING TOOL CALLS." This constraint applies to the orchestrator calling models directly via `call-quorum-slot.cjs`. Spawning workers via `Task` is a different pattern — workers handle the actual model calls, and the orchestrator delegates instead of calling directly.

**This means the orchestrator rules need a targeted update:** The no-sibling-calls constraint exists to prevent race conditions and result confusion when the orchestrator itself is sequencing output. With a dedicated worker agent collecting results, the constraint does not apply to the Task spawn wave — it applies to any Bash calls the orchestrator makes after receiving worker results (e.g., scoreboard updates must remain sequential).

---

## 7. Reference: `qgsd-quorum-test-worker.md` as Structural Model

The test worker (`agents/qgsd-quorum-test-worker.md`) is the clearest reference for what a quorum worker agent looks like. Its structure:

```markdown
---
name: qgsd-quorum-test-worker
description: <what it evaluates and what it returns>
tools: Read
color: cyan
---

<role>
You are a [skeptical role]. You receive [input description].
You answer: [question 1], [question 2].
Your job is NOT to [common failure mode]. It is to [actual job].
</role>

<output_format>
Return ONLY this structure — no prose, no explanation, no markdown headers:

[structured key-value block]

Rules:
- [verdict-to-condition mapping]
</output_format>

<bundle>
$ARGUMENTS
</bundle>
```

**What the quorum worker adapts:**

1. `<role>` — skeptical evaluator posture + instruction to read repo files before answering
2. `<output_format>` — the `slot/round/verdict/reasoning/raw/unavail_message` schema
3. `<arguments>` — parsed $ARGUMENTS block
4. `<execution>` — the Bash call to `call-quorum-slot.cjs` and the file-reading preamble

The test worker uses a `<bundle>` tag. The quorum worker uses an `<arguments>` tag for the structured fields, and provides an explicit `<execution>` section describing how to use Bash to make the single slot call.

---

## 8. Worker Execution Flow (What the Agent Does)

The worker is simple compared to the orchestrator. It has three steps:

### Step 1: Parse $ARGUMENTS

Extract all fields from the structured block: `slot`, `round`, `timeout_ms`, `repo_dir`, `mode`, `question`, optionally `artifact_path`, `artifact_line_count`, `prior_positions`, `traces`.

### Step 2: Grounding Read (Before Calling the Slot)

Before invoking the slot, the worker itself reads relevant repo files. This is the "IMPORTANT: Before answering..." instruction currently embedded in the per-slot prompt in the orchestrator. Moving it to the worker means the worker can verify what files actually exist before injecting them into the prompt.

```
Read CLAUDE.md (if exists in repo_dir)
Read .planning/STATE.md (if exists in repo_dir)
If artifact_path is set: Read artifact_path
Use Grep/Glob to find files directly relevant to the question
```

The worker then summarizes what it found. This summary goes into the prompt sent to the slot model.

### Step 3: Build and Execute Slot Call

The worker constructs the heredoc prompt for `call-quorum-slot.cjs`. For Round 1 Mode A:

```bash
node "$HOME/.claude/qgsd-bin/call-quorum-slot.cjs" \
  --slot <slot> \
  --timeout <timeout_ms> \
  --cwd <repo_dir> <<'QUORUM_PROMPT'
QGSD Quorum — Round <round>

Repository: <repo_dir>

Question: <question>

[Artifact block if artifact_path was provided]

[Repo context the worker found in Step 2]

You are one of the quorum members evaluating this question independently. Give your
honest answer with reasoning. Be concise (3–6 sentences). State your position clearly.
Do not defer to other models.
QUORUM_PROMPT
```

For Round 2+ (deliberation), the `prior_positions` block is included before the update prompt.

For Mode B (execution trace review), the `traces` block is included.

### Step 4: Return Structured Result

Parse the output from `call-quorum-slot.cjs`. Build and return the structured result block:

```
slot: <slotName>
round: <round>
verdict: <parsed or summarized>
reasoning: <2-4 sentences>
raw: |
  <first 2000 chars of output>
[unavail_message: <first 500 chars, only if UNAVAIL>]
```

---

## 9. Proposed Agent Definition

```markdown
---
name: qgsd-quorum-worker
description: >
  Quorum slot worker — spawned in parallel by qgsd-quorum-orchestrator, one per active
  slot. Reads relevant repo files, calls exactly one quorum slot via call-quorum-slot.cjs,
  and returns a structured verdict block. Handles both Mode A (pure question) and Mode B
  (execution trace review), Round 1 and deliberation rounds.
tools: Read, Bash, Glob, Grep
color: cyan
---
```

Full body sections (in order):

1. `<role>` — single-slot evaluator; reads repo first, calls one slot, returns structured output; no scoreboard updates; no commits
2. `<arguments>` — `$ARGUMENTS` schema with all fields documented
3. `<execution>` — Step 1 (parse), Step 2 (read repo), Step 3 (call slot), Step 4 (return)
4. `<output_format>` — the `slot/round/verdict/reasoning/raw/unavail_message` schema with rules
5. `<error_handling>` — timeout → verdict: UNAVAIL; non-zero exit → verdict: UNAVAIL; no output → verdict: UNAVAIL

---

## 10. Orchestrator Changes Required

The parallel worker design requires targeted changes to `qgsd-quorum-orchestrator.md`:

### 10a. The No-Sibling-Calls Rule Needs Scoping

Current text:
> **SEQUENTIAL CALLS ONLY — NO SIBLING TOOL CALLS.**
> Every model call and every Task spawn MUST be issued as a separate, standalone message turn

This must be updated to:
> **SEQUENTIAL CALLS ONLY — NO SIBLING TOOL CALLS** — except for the parallel worker wave.
> Task spawns for the worker wave are explicitly parallel (one Task per slot in a single message turn).
> All Bash calls (scoreboard updates, file reads, health checks) remain sequential.

### 10b. Round 1 Query Block Replacement

The current sequential `call-quorum-slot.cjs` Bash calls in "Query models (sequential)" are replaced by a single message turn that issues one `Task(subagent_type=qgsd-quorum-worker, ...)` per active slot.

### 10c. Deliberation Rounds

Same replacement: each deliberation round issues one Task per slot simultaneously, passing `prior_positions` in the arguments.

### 10d. Result Collection and UNAVAIL Recording

After the Task wave returns, the orchestrator:
1. Parses each worker result (slot/round/verdict/reasoning/raw fields)
2. For any result with `verdict: UNAVAIL` and a non-empty `unavail_message`: calls `update-scoreboard.cjs set-availability` (sequential Bash)
3. Builds the positions table from parsed verdicts
4. Runs consensus check as before

---

## 11. Benefits vs Current Sequential Design

| Dimension | Current (sequential) | Parallel workers |
|---|---|---|
| Wall-clock time (N available slots) | `N × avg_timeout` | `max(slot_timeout)` |
| Worst case (all slots timeout) | `N × 30s` = 180s for 6 slots | `30s` (all timeout together) |
| Complexity | Single orchestrator script | Orchestrator + worker agent |
| Error isolation | Slot failure can affect loop state | Each worker isolated |
| Round 1 vs deliberation | Same sequential approach | Same parallel approach |
| Scoreboard updates | Inline in orchestrator | Orchestrator-only, after wave |

---

## 12. Open Questions

**Q1: Does the Task tool in Claude Code support truly parallel execution of multiple Task calls issued in one turn?**

Based on reading the orchestrator's existing instruction ("Every model call and every Task spawn MUST be issued as a separate, standalone message turn"), the orchestrator author believed Task calls would be sequential unless explicitly batched. The parallel worker design only works if Claude Code's Task tool runs simultaneous spawns concurrently. This needs empirical validation before the orchestrator rewrite.

**Q2: Context window for worker prompts with large trace bundles (Mode B)**

Mode B execution traces can be large. If a worker receives a 10KB trace bundle in `$ARGUMENTS` and also reads repo files, it may hit context limits before calling its slot. Mitigation: the orchestrator truncates traces before passing to workers (e.g., 4KB cap per trace block).

**Q3: Worker timeout coordination**

If a worker's slot times out at 30s, the Task itself runs for ~30s. If the orchestrator waits for all Tasks to complete before proceeding, the wave duration is bounded by the slowest non-timed-out slot. Workers that time out will return `verdict: UNAVAIL` quickly (after the `quorum_timeout_ms` fires inside `call-quorum-slot.cjs`). No special orchestrator-level timeout needed.

**Q4: `quorum_timeout_ms` discoverability**

Currently the orchestrator reads `quorum_timeout_ms` from `providers.json` and passes `--timeout <ms>` to `call-quorum-slot.cjs`. For the worker design, the orchestrator must pre-resolve timeouts before the Task wave and pass `timeout_ms: <value>` in each worker's `$ARGUMENTS`. Workers must not read `providers.json` themselves — that would require adding `Read` to find it (it lives in a variable path) or `Bash` just for that, adding complexity.

---

## 13. Confidence Assessment

| Area | Confidence | Source |
|---|---|---|
| Agent frontmatter schema | HIGH | Read all 12 agent files |
| `call-quorum-slot.cjs` behavior | HIGH | Full source read |
| Tool set for worker | HIGH | Derived from test-worker pattern + execution needs |
| Structured output schema | HIGH | Derived from Mode A/B response formats in orchestrator |
| Orchestrator result collection pattern | HIGH | Derived from existing positions table parsing logic |
| Parallel Task execution semantics | LOW | Not confirmed empirically — needs validation (Q1) |
| Context window impact of large trace bundles | MEDIUM | Estimated, not measured |
