# Stack Research

**Domain:** QGSD v0.18 — Token Efficiency (New Capabilities Only)
**Researched:** 2026-02-27
**Confidence:** HIGH

---

## Context: Subsequent Milestone — Additive Only

The following capabilities from prior milestones are validated. They must NOT be re-researched or
replaced. All new choices must integrate without breaking them.

**Existing constraints that new choices must satisfy:**

- All `bin/*.cjs` scripts use `'use strict'; require()` — CJS-only. No `import`.
- No ESM migration in scope. ESM-only libraries require a workaround or must be avoided.
- Zero new runtimes. Node.js only. No Python, no Go.
- Existing prod dependencies: `inquirer@^8.2.7`, `keytar@^7.9.0`, `markdown-it@14.1.1`,
  `markdown-it-task-lists@2.1.1`, `comment-parser@1.4.5`.
- Existing dev dependencies: `esbuild@^0.24.0`, `tsup@^8.5.1`, `typescript@^5.9.3`,
  `xstate@^5.28.0`.
- Zero-dep policy for `bin/` scripts where possible. New libraries must justify their weight.
- Hook source files live in `hooks/`, synced to `hooks/dist/`, installed via
  `node bin/install.js --claude --global` to `~/.claude/hooks/`.
- Quorum dispatches via `call-quorum-slot.cjs` subprocess reading `providers.json`.
  Health checks via `check-provider-health.cjs`. Scoreboard writes via
  `update-scoreboard.cjs merge-wave`.
- Node.js runtime: v25.6.1 (confirmed on target machine).

---

## Capability A: Token Observability Layer

### What the feature needs

Track per-sub-agent (qgsd-quorum-slot-worker Task) token consumption across a quorum
round, accumulate the totals, and surface them in `/qgsd:health`. Specifically:

1. After each quorum wave, collect `input_tokens + output_tokens` consumed by each
   slot-worker Task.
2. Write the per-round token summary to a persistent file (`.planning/token-usage.jsonl`
   or appended to an existing observability file).
3. `/qgsd:health` reads the file and displays per-slot totals.

### Decision: SubagentStop hook + JSONL transcript parsing — zero new libraries

**How Claude Code exposes sub-agent token data:**

Claude Code does NOT expose per-sub-agent token metrics directly in the `SubagentStop`
hook payload. The `SubagentStop` event payload (confirmed against official docs, 2026-02)
contains:

```json
{
  "session_id": "...",
  "transcript_path": "~/.claude/projects/.../abc123.jsonl",
  "agent_id": "def456",
  "agent_type": "qgsd-quorum-slot-worker",
  "agent_transcript_path": "~/.claude/projects/.../abc123/subagents/agent-def456.jsonl",
  "last_assistant_message": "...",
  "stop_hook_active": false
}
```

The `agent_transcript_path` field points to the sub-agent's own JSONL file. The JSONL
file has `message.usage` fields on `type: "assistant"` entries, confirmed by direct
inspection of actual subagent transcript files on this machine:

```json
{
  "type": "assistant",
  "message": {
    "model": "claude-sonnet-4-6",
    "usage": {
      "input_tokens": 3,
      "cache_creation_input_tokens": 11033,
      "cache_read_input_tokens": 5232,
      "output_tokens": 1,
      "service_tier": "standard"
    }
  }
}
```

**Approach: SubagentStop hook that reads `agent_transcript_path`**

Register a `SubagentStop` command hook with matcher `qgsd-quorum-slot-worker`. When a
slot-worker finishes, the hook:

1. Receives `agent_transcript_path` in the JSON payload (stdin).
2. Reads the JSONL file and sums all `message.usage` fields across entries where
   `isSidechain !== true` and `isApiErrorMessage !== true`.
3. Extracts `agent_type`, `agent_id`, and the `last_assistant_message` vote line.
4. Appends a structured record to `.planning/token-usage.jsonl`:

```json
{"ts":"2026-02-27T...","agent_id":"def456","agent_type":"qgsd-quorum-slot-worker","slot":"claude-1","input_tokens":14268,"output_tokens":312,"cache_creation_input_tokens":11033,"cache_read_input_tokens":5232}
```

The slot name must be derived from `last_assistant_message` (the vote output already
contains `slot: <name>` in the YAML block) or from a correlation file written by
call-quorum-slot.cjs at dispatch time (preferred — more reliable than parsing output).

**Important limitation:** The `SubagentStop` hook fires for ALL sub-agent spawns, not
just quorum slot-workers. The matcher `qgsd-quorum-slot-worker` filters to only the
relevant sub-agents. This is confirmed in official docs: SubagentStop matches on
`agent_type`, which equals the `subagent_type` passed to `Task()`.

**Hook implementation pattern:**

```javascript
// hooks/qgsd-token-collector.js — SubagentStop hook
'use strict';
const fs = require('fs');
const path = require('path');

let raw = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', c => raw += c);
process.stdin.on('end', () => {
  try {
    const input = JSON.parse(raw);
    if (input.agent_type !== 'qgsd-quorum-slot-worker') { process.exit(0); return; }

    const transcriptPath = input.agent_transcript_path;
    if (!transcriptPath || !fs.existsSync(transcriptPath)) { process.exit(0); return; }

    // Sum usage across all non-sidechain assistant entries
    const lines = fs.readFileSync(transcriptPath, 'utf8').split('\n').filter(l => l.trim());
    let inputTokens = 0, outputTokens = 0, cacheCreate = 0, cacheRead = 0;
    for (const line of lines) {
      try {
        const entry = JSON.parse(line);
        if (entry.type !== 'assistant') continue;
        if (entry.isSidechain === true) continue;
        if (entry.isApiErrorMessage === true) continue;
        const u = entry.message?.usage;
        if (!u) continue;
        inputTokens  += (u.input_tokens ?? 0);
        outputTokens += (u.output_tokens ?? 0);
        cacheCreate  += (u.cache_creation_input_tokens ?? 0);
        cacheRead    += (u.cache_read_input_tokens ?? 0);
      } catch {}
    }

    // Derive slot name from correlation file (preferred) or agent_id
    const corrPath = path.join(process.cwd(), '.planning', `quorum-slot-corr-${input.agent_id}.json`);
    let slot = input.agent_id;
    if (fs.existsSync(corrPath)) {
      try { slot = JSON.parse(fs.readFileSync(corrPath, 'utf8')).slot || slot; } catch {}
      try { fs.unlinkSync(corrPath); } catch {}
    }

    const record = JSON.stringify({
      ts: new Date().toISOString(),
      agent_id: input.agent_id,
      slot,
      input_tokens: inputTokens,
      output_tokens: outputTokens,
      cache_creation_input_tokens: cacheCreate,
      cache_read_input_tokens: cacheRead,
    });

    const logPath = path.join(process.cwd(), '.planning', 'token-usage.jsonl');
    fs.mkdirSync(path.dirname(logPath), { recursive: true });
    fs.appendFileSync(logPath, record + '\n', 'utf8');
    process.exit(0);
  } catch { process.exit(0); } // fail-open
});
```

**Why NOT a polling approach:** No polling mechanism can get per-sub-agent data in
real-time. The SubagentStop hook is the only in-process trigger that fires with the
`agent_transcript_path` field. Polling the transcript directory would be racy.

**Why NOT rely on the main transcript:** The main transcript (`transcript_path`) contains
all turns from all agents interleaved, making it hard to attribute usage to specific
slot-workers without tracking `parentUuid` chains. The `agent_transcript_path` gives a
clean per-agent view with zero attribution ambiguity.

**What is NOT available:** Claude Code does NOT currently expose per-sub-agent token
metrics in a hook payload directly (confirmed: feature request github.com/anthropics/
claude-code/issues/13994, closed as duplicate, still unimplemented as of 2026-02).
Transcript parsing is the only available method.

### Recommended Stack — Capability A

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| `SubagentStop` hook (Claude Code) | current | Trigger on slot-worker completion | Only hook that fires with `agent_transcript_path`; matcher filters to `qgsd-quorum-slot-worker` only |
| JSONL transcript parsing (stdlib) | stdlib | Sum `message.usage` fields from `agent_transcript_path` | Confirmed structure on machine; `input_tokens`/`output_tokens` in every assistant entry |
| `fs.appendFileSync` (stdlib) | stdlib | Write token records to `.planning/token-usage.jsonl` | Append is atomic for records < POSIX PIPE_BUF (4096 bytes); matches conformance-events pattern |
| Correlation file pattern | — | Map `agent_id` → `slot` name | Written by quorum dispatch before Task spawn; cleaned up by hook after read |

**Hook registration (settings.json addition):**

```json
{
  "hooks": {
    "SubagentStop": [
      {
        "matcher": "qgsd-quorum-slot-worker",
        "hooks": [
          {
            "type": "command",
            "command": "node ~/.claude/hooks/qgsd-token-collector.js",
            "async": true
          }
        ]
      }
    ]
  }
}
```

Using `async: true` is correct here — token collection is observational and should not
block the sub-agent stop event. This matches the non-blocking pattern used for the
conformance event logger.

**`/qgsd:health` display:** A new `--tokens` flag (or augmentation of the existing health
output) reads `.planning/token-usage.jsonl`, aggregates by slot, and prints a table:

```
  TOKEN USAGE (last 10 quorum rounds)
  slot         input_tokens   output_tokens   cache_read
  claude-1     142,680        3,120           52,320
  claude-2     89,400         2,890           41,200
  ...
```

No new library needed — `JSON.parse` per line, reduce into slot map, print with
`console.log`.

---

## Capability B: Task Envelope Abstraction

### What the feature needs

Replace free-form prompt text handoffs between research/plan/quorum stages with a compact,
structured JSON object (the "task envelope") that captures what needs to be decided, what
context is available, the risk tier, and which models should be consulted. The envelope is
written to a file (e.g., `.planning/phases/<phase>/TASK_ENVELOPE.json`) before each stage
and read by the downstream stage.

### Decision: Plain JSON schema (hand-written) + `JSON.parse`/`JSON.stringify` — zero new libraries

**Why no schema validation library:**

The task envelope is a small, internal structure used within QGSD's own workflow. It is
not a public API. The schema is stable and fully under QGSD's control. Introducing `zod`
or `ajv` would:

1. Add a prod dependency (zod is ~55KB; ajv is ~120KB with transitive deps).
2. Force ESM handling: zod ships both CJS and ESM, but zod v4 (2025) is pure ESM.
   zod v3 is the CJS-compatible version. This creates a version freeze obligation.
3. Add no real value for a 5-field internal schema: a manual check
   `if (!envelope.version || !envelope.risk_tier)` is clearer and has zero dep cost.

**Recommended envelope schema:**

```json
{
  "schema_version": 1,
  "envelope_id": "<uuid-v4-or-timestamp-hex>",
  "ts": "2026-02-27T14:23:00.000Z",
  "phase": "v0.18-01",
  "stage": "research | plan | quorum | verify",
  "question": "Should the token observability hook use SubagentStop or PostToolUse?",
  "context_digest": {
    "plan_path": ".planning/phases/v0.18-01/PLAN.md",
    "plan_line_count": 142,
    "artifact_paths": [".planning/research/STACK.md"]
  },
  "risk_tier": "routine | elevated | critical",
  "quorum_config": {
    "worker_count": 3,
    "model_tier": "standard | strong",
    "timeout_ms": 30000
  },
  "prior_decisions": []
}
```

**risk_tier drives adaptive fan-out (Capability C):**

| tier | worker_count | rationale |
|------|--------------|-----------|
| `routine` | 1 | Low-stakes tasks: quick implementation step, single-file change |
| `elevated` | 3 | Medium-stakes: multi-file change, architectural decision |
| `critical` | 5 | High-stakes: ROADMAP update, new milestone, security-affecting change |

**envelope_id:** Use `Date.now().toString(16)` (8-char hex) — no uuid library needed.
This matches the PRNG inline precedent (Mulberry32 in gsd-tools.cjs) and produces
unique-enough IDs for file names within a session.

**How the envelope flows:**

```
plan-phase.md  → writes TASK_ENVELOPE.json (stage: "plan", risk_tier computed from plan content)
  └─ quorum dispatch reads TASK_ENVELOPE.json
       └─ worker_count from quorum_config.worker_count
       └─ writes TASK_ENVELOPE.json back with stage: "quorum", prior_decisions appended
  └─ verify-work reads TASK_ENVELOPE.json for audit context
```

**Risk tier classification:** Inline logic in a helper function `classifyRiskTier(planPath)`:

```javascript
function classifyRiskTier(planPath) {
  const text = fs.readFileSync(planPath, 'utf8');
  if (/ROADMAP\.md|new-milestone|milestone\s+complete/i.test(text)) return 'critical';
  if (/architecture|security|breaking change|schema change/i.test(text)) return 'elevated';
  return 'routine';
}
```

This is 10 lines of inline code — no routing library needed.

**File write pattern (atomic):**

```javascript
// Same atomic write pattern as scoreboard and conformance events
const tmpPath = envelopePath + '.tmp';
fs.writeFileSync(tmpPath, JSON.stringify(envelope, null, 2), 'utf8');
fs.renameSync(tmpPath, envelopePath); // POSIX atomic
```

### Recommended Stack — Capability B

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| Plain JSON (stdlib) | stdlib | Task envelope serialization | 5-field schema; `JSON.parse`/`JSON.stringify`; atomic write via `renameSync` matches existing scoreboard pattern |
| `fs.renameSync` (stdlib) | stdlib | Atomic envelope file write | POSIX atomic on same volume; precedent in `update-scoreboard.cjs` |
| Inline `classifyRiskTier()` | — | Determine risk_tier from plan text | Regex scan on plan content; 10 lines; no routing library needed |

**What NOT to use:**

| Avoid | Why |
|-------|-----|
| `zod` | v4 is ESM-only; v3 is CJS but creates a version freeze; overkill for a 5-field internal schema |
| `ajv` | 120KB with transitive deps; JSON Schema validator overkill for internal use |
| `joi` | Large bundle; designed for user input validation, not small internal structs |
| Any UUID library | `Date.now().toString(16)` sufficient for session-scoped file naming |

---

## Capability C: Adaptive Quorum Fan-Out

### What the feature needs

Instead of always dispatching all 8+ active slots, use the `risk_tier` from the task
envelope to determine how many workers to spawn. The injection logic in `qgsd-prompt.js`
(UserPromptSubmit hook) and the quorum protocol in `quorum.md` must read `worker_count`
from the envelope and cap the fan-out accordingly.

### Decision: Config extension + envelope-driven cap — zero new libraries

**Current mechanism:** `qgsd-prompt.js` builds the slot list from `config.quorum_active`
and applies `config.quorum.maxSize` as a cap. The `--n N` flag allows a per-command
override.

**New mechanism:** Before dispatching, check whether a TASK_ENVELOPE.json exists for the
current phase. If it does, use `quorum_config.worker_count` as the fan-out count. If not,
fall back to the existing `maxSize` config.

**Envelope lookup logic in `qgsd-prompt.js`:**

```javascript
function readEnvelopeWorkerCount(cwd) {
  // Find the current phase from STATE.md or .planning/current-activity.json
  // Then read .planning/phases/<phase>/TASK_ENVELOPE.json
  // Return quorum_config.worker_count or null
  try {
    const actPath = path.join(cwd, '.planning', 'current-activity.json');
    if (!fs.existsSync(actPath)) return null;
    const act = JSON.parse(fs.readFileSync(actPath, 'utf8'));
    const phase = act.phase;
    if (!phase) return null;
    const envPath = path.join(cwd, '.planning', 'phases', phase, 'TASK_ENVELOPE.json');
    if (!fs.existsSync(envPath)) return null;
    const env = JSON.parse(fs.readFileSync(envPath, 'utf8'));
    const count = env?.quorum_config?.worker_count;
    return (Number.isInteger(count) && count >= 1) ? count : null;
  } catch { return null; }
}
```

This is additive to `qgsd-prompt.js` — the existing `--n N` override takes precedence
over the envelope, which takes precedence over `maxSize` config. Priority order:

```
--n N flag (CLI) > TASK_ENVELOPE.json worker_count > config.quorum.maxSize > activeSlots.length
```

**Worker tiers:**

| risk_tier | worker_count | Slots used (from quorum_active, ordered) |
|-----------|--------------|------------------------------------------|
| `routine` | 1 | Fastest available slot (sub-first if preferSub) |
| `elevated` | 3 | Top 3 from ordered pool |
| `critical` | 5 | Top 5 from ordered pool |

The existing `orderedSlots.slice(0, externalSlotCap)` in `qgsd-prompt.js` already
implements this cap. The only change is the source of `externalSlotCap`.

**`qgsd-stop.js` enforcement:** The Stop hook already enforces `maxSize` as a ceiling on
successful responses. The same `quorumSizeOverride` logic that handles `--n N` must also
handle envelope-based caps. The Stop hook needs the same `readEnvelopeWorkerCount()`
function (or a simplified version reading only the worker_count from the envelope).

**Why NOT a config key for risk classification:** Risk tier is plan-specific, not
project-specific. A per-project config key like `quorum.riskTier: "elevated"` would be
wrong — the tier must come from the current plan content, not a static config. The
envelope is the right place.

### Recommended Stack — Capability C

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| `readEnvelopeWorkerCount()` helper | — | Read worker_count from TASK_ENVELOPE.json | Additive to existing hook logic; 15 lines; reads `current-activity.json` for phase context |
| `qgsd-prompt.js` extension | existing | Apply envelope cap to fan-out | Priority chain: `--n N` > envelope > maxSize > pool length |
| `qgsd-stop.js` extension | existing | Enforce envelope-based ceiling in Stop hook | Same `maxSize` path; add envelope fallback before config.quorum.maxSize |

**What NOT to add:**

| Avoid | Why |
|-------|-----|
| Dedicated risk-router bin/ script | Overkill; inline `classifyRiskTier()` + envelope write is sufficient |
| Per-project qgsd.json `riskTier` key | Static config cannot reflect per-plan risk; envelope is plan-scoped |
| ML-based complexity classifier | No training data; heuristic regex achieves the 1/3/5 split well enough |

---

## Capability D: Tiered Model Sizing

### What the feature needs

Route quorum workers to cheaper/faster models for `routine` tasks and reserve
stronger models for `critical` decisions. The existing `model_preferences` config in
`qgsd.json` allows per-slot model overrides. The new feature adds an envelope-driven
tier that automatically switches slot model assignments based on `risk_tier`.

### Decision: Envelope-driven model tier map in qgsd.json — zero new libraries

**Current model assignment:** `qgsd.json` has `model_preferences: { "claude-1": "deepseek-ai/DeepSeek-V3.2" }`.
These are static overrides injected into the quorum prompt by `qgsd-prompt.js`.

**New mechanism:** Add a `model_tiers` config block to `qgsd.json`:

```json
{
  "model_tiers": {
    "standard": {
      "claude-1": "deepseek-ai/DeepSeek-V3.2",
      "claude-2": "MiniMaxAI/MiniMax-M2.5",
      "claude-3": "Qwen/Qwen3-Coder-480B-A35B-Instruct-FP8"
    },
    "strong": {
      "claude-1": "deepseek-ai/DeepSeek-R1",
      "claude-2": "MiniMaxAI/MiniMax-M1-5B",
      "claude-3": "Qwen/QwQ-72B-Preview"
    }
  }
}
```

The `quorum_config.model_tier` field in the task envelope (`"standard"` or `"strong"`)
selects which map to use. `qgsd-prompt.js` applies the selected tier's model assignments
instead of the static `model_preferences`.

**Tier assignment in `classifyRiskTier()`:**

| risk_tier | model_tier | rationale |
|-----------|------------|-----------|
| `routine` | `standard` | Cheap/fast models sufficient for low-stakes review |
| `elevated` | `standard` | Standard models; 3 workers provide diversity |
| `critical` | `strong` | Best available models; 5 workers; stakes justify cost |

**Model tier injection in `qgsd-prompt.js`:**

```javascript
// After envelope read: determine effective model preferences
const modelTier = envelope?.quorum_config?.model_tier ?? 'standard';
const tierPrefs = (config.model_tiers ?? {})[modelTier] ?? {};
const effectivePrefs = { ...(config.model_preferences ?? {}), ...tierPrefs };
// tierPrefs overrides static model_preferences for this quorum round
```

The injection block (the "Model overrides" section appended to instructions) uses
`effectivePrefs` instead of `config.model_preferences` directly.

**Why this beats static `model_preferences`:**

Static preferences are set once globally. For a routine phase (single-file fix),
dispatching 5 workers with expensive models wastes quota. With tiered sizing, the same
`quorum_active` pool is used but with cheaper models and fewer workers for routine tasks.

**Config backward compatibility:** `model_preferences` continues to work as the
fallback when no `model_tiers` is configured. The feature is additive.

**Providers.json `quorum_timeout_ms`:** The `providers.json` already has per-slot
`quorum_timeout_ms` values (claude-5: 10000ms, claude-6: 8000ms). For `standard` tier
workers, shorter timeouts are appropriate. The envelope can carry
`quorum_config.timeout_ms` to override per-round. This is a one-line change in
`call-quorum-slot.cjs` (already reads `--timeout` flag).

### Recommended Stack — Capability D

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| `model_tiers` config key in `qgsd.json` | — | Per-tier model assignment map | Extends existing `model_preferences` pattern; no new data structure needed |
| `qgsd-prompt.js` extension | existing | Read envelope tier, apply tier model map | 10-line addition; `effectivePrefs = { ...model_preferences, ...tierPrefs }` |
| `providers.json` `quorum_timeout_ms` | existing | Per-slot timeout already present | Envelope carries `timeout_ms` override; `call-quorum-slot.cjs` already reads `--timeout` |

**What NOT to add:**

| Avoid | Why |
|-------|-----|
| Per-slot ML routing (RouteLLM pattern) | No training data; static tier map achieves the goal without an inference step |
| Separate `model-router.cjs` script | Overkill; 10-line inline merge in qgsd-prompt.js is sufficient |
| `model_tiers` as a YAML file | All QGSD config is JSON; no reason to introduce YAML for one config block |
| Separate `providers-strong.json` | One providers.json with model names driven by qgsd.json tier config is simpler |

---

## Summary: Net New npm Dependencies for v0.18

All four capabilities are implemented with Node.js stdlib and extensions to existing files.
**Zero new npm dependencies required.**

| Package | Decision | Rationale |
|---------|----------|-----------|
| `zod` / `ajv` | SKIP | 5-field internal schema; inline validation is clearer and smaller |
| Any UUID library | SKIP | `Date.now().toString(16)` sufficient for session-scoped IDs |
| Any schema validation library | SKIP | Internal structs only; manual null-checks sufficient |

---

## Implementation Touch Points (Existing Files)

| File | Change Type | What Changes |
|------|-------------|-------------|
| `hooks/qgsd-token-collector.js` | NEW | SubagentStop hook; reads `agent_transcript_path`, sums usage, appends to `token-usage.jsonl` |
| `hooks/qgsd-prompt.js` | EXTEND | Add `readEnvelopeWorkerCount()` and envelope-driven model tier selection |
| `hooks/qgsd-stop.js` | EXTEND | Add envelope-based worker count cap to `maxSize` resolution |
| `bin/check-provider-health.cjs` | EXTEND | Add `--tokens` display section reading `.planning/token-usage.jsonl` |
| `hooks/config-loader.js` | EXTEND | Add `model_tiers` to config schema and merge logic |
| `bin/qgsd.cjs` health subcommand | EXTEND | Surface token-usage.jsonl in `qgsd health` output |
| `bin/providers.json` | EXTEND (optional) | Add per-tier model entries if strong-tier models differ from standard |
| `~/.claude/settings.json` | EXTEND (install) | Register new `SubagentStop` hook for `qgsd-token-collector.js` |

**Files that do NOT change:**

- `bin/call-quorum-slot.cjs` — already accepts `--timeout` flag; no change needed
- `bin/update-scoreboard.cjs` — token data is separate from scoreboard; no cross-contamination
- `agents/qgsd-quorum-orchestrator.md` — deprecated; not touched
- `commands/qgsd/quorum.md` — inline quorum protocol; envelope is read by hook before dispatch

---

## Integration Architecture

```
UserPromptSubmit (qgsd-prompt.js)
  └─ readEnvelopeWorkerCount(cwd)
       └─ reads .planning/current-activity.json → phase name
       └─ reads .planning/phases/<phase>/TASK_ENVELOPE.json
            └─ worker_count → fan-out cap
            └─ model_tier → select from config.model_tiers
  └─ builds instructions with capped slot list + effective model prefs
  └─ writes quorum-slot-corr-<uuid>.json per slot (agent_id correlation)

[Quorum slot-worker Tasks execute in parallel]

SubagentStop (qgsd-token-collector.js)  [fires async per slot]
  └─ reads agent_transcript_path JSONL
  └─ sums message.usage.{input_tokens, output_tokens}
  └─ reads quorum-slot-corr-<agent_id>.json → slot name
  └─ appends to .planning/token-usage.jsonl

Stop (qgsd-stop.js)
  └─ readEnvelopeWorkerCount(cwd) → maxSize
  └─ enforces ceiling on successful slot responses

qgsd health --tokens
  └─ reads .planning/token-usage.jsonl
  └─ aggregates by slot, prints table
```

---

## Version Compatibility

| Component | Node.js Requirement | CJS via `require()` | Notes |
|-----------|--------------------|--------------------|-------|
| `SubagentStop` hook | Claude Code current | N/A (hook event) | `agent_transcript_path` field confirmed in official docs |
| JSONL parsing (stdlib) | stdlib | YES | `fs.readFileSync` + JSON.parse; confirmed structure in real transcript files |
| Envelope JSON (stdlib) | stdlib | YES | `JSON.parse`/`JSON.stringify` + `fs.renameSync`; zero deps |
| `model_tiers` config | stdlib | YES | Additive to existing config-loader.js; no new schema dep |

---

## What NOT to Add (Anti-patterns for v0.18)

| Avoid | Why |
|-------|-----|
| OpenTelemetry / metrics SDK | 20+ transitive deps; designed for microservices; QGSD is a CLI plugin |
| Prometheus client library | Same concern; server-push metrics architecture wrong for a CLI hook |
| `pino` / `winston` logging | `.planning/token-usage.jsonl` with `appendFileSync` is the right pattern (matches conformance-events.jsonl) |
| PostToolUse hook for token tracking | PostToolUse fires for all tool calls (Bash, Read, etc.); matcher cannot filter to only Task calls for slot-workers specifically by agent_type |
| SQLite for token storage | Overkill; JSONL append is the correct pattern at QGSD's scale (100s of rounds/session) |
| `zod` for envelope validation | ESM footprint; 5-field schema does not justify the dep |
| Real-time WebSocket dashboard | Out of scope; `/qgsd:health` CLI output is sufficient |
| Per-command token budget enforcement | Phase 1: observability only; budget enforcement is a future v0.19+ feature |

---

## Key Architectural Decisions

| Decision | Rationale |
|----------|-----------|
| SubagentStop hook for token collection | Only hook that provides `agent_transcript_path`; correct scoping with matcher `qgsd-quorum-slot-worker` |
| `agent_transcript_path` transcript parsing | Direct per-agent JSONL contains unambiguous per-agent token data; main transcript requires `parentUuid` chain traversal |
| Correlation file for agent_id → slot mapping | `agent_id` (e.g. `def456`) is assigned by Claude Code at Task spawn time; cannot be predicted; correlation file written before spawn by qgsd-prompt.js, read by hook after SubagentStop |
| Async hook for token collection | Token collection is observational; should not block agent stop event; `async: true` in hook config |
| Envelope-first, config fallback | Envelope provides plan-specific fan-out and model tier; static config provides project-wide defaults; neither breaks the other |
| risk_tier → worker_count: 1/3/5 | Odd numbers for potential majority-vote computation; 1 for rubber-stamp tasks, 3 for standard multi-perspective review, 5 for high-stakes decisions |
| `model_tiers` in qgsd.json (not providers.json) | providers.json describes available CLI tools; model assignment is a user preference — belongs in user config |

---

## Sources

- Claude Code Hooks reference (code.claude.com/docs/en/hooks) — SubagentStop payload schema,
  `agent_transcript_path` field, SubagentStop matcher values, `async` hook option. Confidence: HIGH.
- Feature request github.com/anthropics/claude-code/issues/13994 — confirms per-sub-agent
  metrics NOT in hook payload; closed as duplicate; transcript parsing is the only method.
  Confidence: HIGH.
- Direct transcript inspection on target machine:
  `~/.claude/projects/-Users-jonathanborduas-code-QGSD/0120a8af.../subagents/agent-ae63d1e.jsonl`
  — confirmed `message.usage.{input_tokens, output_tokens, cache_creation_input_tokens,
  cache_read_input_tokens}` structure. Confidence: HIGH.
- Main transcript inspection:
  `~/.claude/projects/-Users-jonathanborduas-code-QGSD/0120a8af.../0120a8af....jsonl`
  — confirmed same usage structure in main session entries. Confidence: HIGH.
- liambx.com/blog/claude-code-log-analysis-with-duckdb — confirmed JSONL structure,
  `isSidechain`/`isApiErrorMessage` filter fields, `message.usage` path. Confidence: MEDIUM.
- QGSD source inspection: `hooks/qgsd-prompt.js`, `hooks/qgsd-stop.js`, `bin/call-quorum-slot.cjs`,
  `bin/providers.json`, `bin/check-provider-health.cjs` — existing patterns confirmed. Confidence: HIGH.
- WebSearch "tiered LLM model routing cost optimization 2025" — confirmed industry pattern for
  cheap/fast vs strong models by task complexity. Confidence: MEDIUM.

---

*Stack research for: QGSD v0.18 Token Efficiency — new capabilities only*
*Researched: 2026-02-27*
