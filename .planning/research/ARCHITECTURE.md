# Architecture Research

**Domain:** QGSD v0.18 — Token Efficiency integration into the quorum pipeline
**Researched:** 2026-02-27
**Confidence:** HIGH (all source files read directly from live codebase; no external APIs; pure in-repo integration analysis)

---

## Context: Subsequent Milestone on the v0.16/v0.17 Baseline

This file answers the integration question for v0.18: **how do the 4 token-efficiency features wire into the existing quorum pipeline?**

The 4 features are:
1. **Token observability** — surface where/how token usage data flows through QGSD
2. **Task envelope** — structured JSON schema passed between research → plan → quorum stages instead of full-text context
3. **Adaptive fan-out** — quorum.md reads `risk_level` from task envelope and sets worker count
4. **Tiered models** — quorum.md / plan-phase reads model tier from config and selects per-role

---

## Existing Architecture Baseline (v0.16/v0.17 Stable)

```
UserPromptSubmit hook (hooks/qgsd-prompt.js)
  │  reads: config-loader.js (quorum_active, quorum.maxSize, agent_config, preferSub)
  │  writes: additionalContext (injected quorum instructions)
  │
  └─ PLANNING COMMAND DETECTED
       │
       → plan-phase.md (GSD workflow, installed to ~/.claude/qgsd/)
            │
            ├─ Step 5:  spawn qgsd-phase-researcher → RESEARCH.md
            ├─ Step 8:  spawn qgsd-planner → *-PLAN.md
            ├─ Step 8.3: [v0.16] plan-to-spec + plan-to-mindmap + FV loop
            ├─ Step 8.5: quorum dispatch inline (R3 protocol from quorum.md)
            │
            └─ quorum.md dispatch (commands/qgsd/quorum.md)
                 │
                 ├─ Provider pre-flight:   check-provider-health.cjs --json
                 ├─ Team capture:          providers.json lookup
                 ├─ Slot sort/cap/bench:   reads quorum.maxSize + quorum_active + preferSub
                 ├─ Round 1 fan-out:       N sibling Task(qgsd-quorum-slot-worker) calls (parallel)
                 │
                 └─ qgsd-quorum-slot-worker.md (agents/)
                      │  parses YAML: slot, round, timeout_ms, repo_dir, mode, question
                      │  optional: artifact_path, review_context, formal_spec_summary,
                      │            verification_result, mindmap_path, skip_context_reads,
                      │            prior_positions, traces
                      │
                      └─ call-quorum-slot.cjs --slot <name> --timeout <ms> --cwd <dir>
                           reads: bin/providers.json (CLI path, args_template, quorum_timeout_ms)
                           spawns: CLI subprocess (codex/gemini/opencode/copilot/ccr)
                           returns: raw text response

Scoreboard (bin/update-scoreboard.cjs):
  → atomic tmpPath + renameSync write to .planning/quorum-scoreboard.json
  → called after each round by quorum.md orchestrator
  → merge-wave subcommand for parallel worker vote batches

Config (hooks/config-loader.js):
  → two-layer shallow merge: DEFAULT_CONFIG + ~/.claude/qgsd.json + .claude/qgsd.json
  → keys: quorum_commands, quorum_active, quorum.maxSize, quorum.preferSub,
           agent_config, model_preferences, circuit_breaker, context_monitor

Data stores:
  .planning/quorum-scoreboard.json     — model performance history
  .planning/quorum-failures.json       — per-slot failure log (call-quorum-slot.cjs)
  .planning/conformance-events.jsonl   — structured hook event log
  .planning/debates/                   — QUORUM_DEBATE.md files per question
  bin/providers.json                   — slot definitions (CLI, model, timeouts)
  ~/.claude/qgsd.json                  — global config
  .claude/qgsd.json                    — project-level config override
```

---

## Feature 1: Token Observability

### What It Is

Surface where token usage data flows through QGSD — Claude Code API usage, sub-agent results returned by slot workers, and scoreboard. Goal: make token cost visible so adaptive decisions (Feature 3) have data to work from.

### Integration Seam

Claude Code exposes token usage in the Stop event payload (`stop_reason`, context window size, `context_tokens_remaining`). The `qgsd-stop.js` hook already reads the Stop event for quorum verification. It is the natural collection point.

Token data from external CLI slot workers (codex, gemini, ccr) is not directly available — CLIs do not emit structured token counts. However, the slot-worker result block is already passed back through `call-quorum-slot.cjs` stdout. A heuristic character-count estimate is the only viable approach for subprocess slot workers.

For Claude itself (the quorum orchestrator), the `CLAUDE_CONTEXT_TOKENS_USED` and context window percentage are already injected by the context monitor hook (`gsd-context-monitor.js`, v0.9). These values can be read from the Stop event payload.

### Integration Points

**Stop hook** (`hooks/qgsd-stop.js`):
- Already receives Stop event with context window data
- Add: read `stop_reason.usage` if present; append token snapshot to `.planning/token-usage.jsonl`
- The Stop hook already calls `appendConformanceEvent()` — same pattern, different file

**call-quorum-slot.cjs**:
- Already returns raw text response
- Add: emit `[token-est: N]` trailer line (character-count heuristic / 4 for rough token estimate)
- The orchestrator (quorum.md) can parse this trailer from the result block and include in scoreboard update

**update-scoreboard.cjs**:
- Already receives `--task-description` and `--verdict`
- Add: `--tokens-used N` optional flag — stored per round in scoreboard JSON
- Scoreboard schema extension: `rounds[].token_est` field (optional, backwards-compatible)

**quorum.md orchestrator**:
- Already calls `update-scoreboard.cjs` per round
- Add: parse `[token-est: N]` from each slot-worker result block; pass as `--tokens-used` sum

### New Files

| File | Type | Purpose |
|------|------|---------|
| `.planning/token-usage.jsonl` | Runtime artifact | Append-only token snapshot per Stop event |

### Modified Files

| File | What Changes |
|------|-------------|
| `hooks/qgsd-stop.js` | Add token snapshot append to `.planning/token-usage.jsonl` |
| `hooks/dist/qgsd-stop.js` | Sync (mandatory — installer reads from dist/) |
| `bin/call-quorum-slot.cjs` | Emit `[token-est: N]` trailer on stdout |
| `bin/update-scoreboard.cjs` | Add `--tokens-used` optional flag; store in rounds[].token_est |
| `commands/qgsd/quorum.md` | Parse `[token-est: N]` from slot-worker results; pass to scoreboard |

### NOT Modified

| File | Why |
|------|-----|
| `hooks/qgsd-prompt.js` | Token data is post-response, not pre-prompt |
| `agents/qgsd-quorum-slot-worker.md` | Workers don't write to scoreboard or token logs |
| `bin/providers.json` | No new slot-level token metadata needed |

### Hook Install Sync Requirement

Any change to `hooks/qgsd-stop.js` MUST be synced:
```
cp hooks/qgsd-stop.js hooks/dist/qgsd-stop.js
node bin/install.js --claude --global
```
The installer reads from `hooks/dist/` — source edits without sync are silent non-deployments.

---

## Feature 2: Task Envelope

### What It Is

A structured JSON schema passed between the research → plan → quorum stages. Instead of passing full-text context (large RESEARCH.md injected into planner context, full PLAN.md embedded in quorum YAML), the envelope carries a compact structured summary that each stage can read.

### Integration Seam

The handoff points between stages in QGSD are:
1. **research → plan** (plan-phase.md Step 5 → Step 8): researcher writes RESEARCH.md; planner reads it
2. **plan → quorum** (plan-phase.md Step 8 → Step 8.5): planner writes PLAN.md; quorum YAML has `artifact_path`

The task envelope is a **new sidecar file** written at each stage transition:

```
.planning/phases/<phase>/task-envelope.json
```

It is analogous to the existing `TRANSITION-HANDOFF.md` pattern (v0.17 design) — a structured handoff artifact read by the downstream stage. Unlike the handoff, it accumulates data across stages (each stage appends/updates its section).

### Schema

```json
{
  "schema_version": 1,
  "phase": "v0.18-01",
  "created_at": "2026-02-27T...",
  "risk_level": "low | medium | high",
  "research": {
    "summary": "<3-5 sentence distillation of RESEARCH.md>",
    "key_findings": ["finding 1", "finding 2"],
    "confidence": "HIGH | MEDIUM | LOW"
  },
  "plan": {
    "summary": "<1-2 sentence plan description>",
    "wave_count": 3,
    "files_modified": ["hooks/qgsd-stop.js", "bin/update-scoreboard.cjs"],
    "has_hook_edits": true,
    "estimated_risk": "low | medium | high"
  },
  "quorum": {
    "worker_count": 3,
    "rounds": 1,
    "verdict": "APPROVE",
    "token_est_total": 12400
  }
}
```

The `risk_level` field at the top level is set by the researcher (Feature 3 reads it). It reflects the risk tier of the work being planned (not the quorum verdict).

### Integration Points

**plan-phase.md (researcher step)**:
- After RESEARCH.md is written, spawn a lightweight `task-envelope-init.cjs` that creates the initial envelope with `research` section and `risk_level`
- Alternatively (simpler): the researcher agent writes the envelope directly as a structured output artifact

**plan-phase.md (planner step)**:
- After PLAN.md is written, run `task-envelope-update.cjs --section plan` to append the `plan` section
- This is analogous to the FV loop's `plan-to-spec.cjs` call pattern (fast, synchronous, no external deps)

**plan-phase.md (quorum dispatch step)**:
- quorum.md reads `task-envelope.json` and uses `risk_level` to set worker count (Feature 3)
- After consensus, update envelope with `quorum` section

**quorum.md**:
- Add: read `task-envelope.json` from `repo_dir/.planning/phases/<phase>/task-envelope.json`
- The envelope path is passed via the slot-worker YAML as an optional field: `envelope_path`

### New Files

| File | Type | Purpose |
|------|------|---------|
| `bin/task-envelope.cjs` | NEW | Initialize, update, and read task envelope JSON |
| `bin/task-envelope.test.cjs` | NEW | Unit tests for envelope schema validation |

### Modified Files

| File | What Changes |
|------|-------------|
| `qgsd-core/workflows/plan-phase.md` | Call `task-envelope.cjs init` after researcher; call `task-envelope.cjs update --section plan` after planner |
| `commands/qgsd/quorum.md` | Read `envelope_path`, parse `risk_level` for adaptive fan-out (Feature 3); update envelope with quorum result |
| `hooks/config-loader.js` | Add `task_envelope.enabled` config key (default: `true`) with validation |
| `hooks/dist/config-loader.js` | Sync |

### Install Sync Requirement

`config-loader.js` edits require sync to `hooks/dist/config-loader.js` before install:
```
cp hooks/config-loader.js hooks/dist/config-loader.js
node bin/install.js --claude --global
```

### NOT Modified

| File | Why |
|------|-----|
| `agents/qgsd-quorum-slot-worker.md` | Slot workers do not read the envelope — only the orchestrator does |
| `bin/update-scoreboard.cjs` | Scoreboard and envelope are separate concerns; scoreboard tracks model performance, envelope tracks pipeline state |
| `hooks/qgsd-stop.js` | No envelope interaction at hook level |

### Reuses Existing Patterns

- **Atomic file writes**: same `tmpPath + renameSync` pattern as scoreboard
- **Config-gated feature**: same `research_enabled` / `formal_verify_enabled` pattern — `task_envelope.enabled: false` skips all envelope operations
- **Sidecar artifact**: same pattern as `.planning/current-activity.json` (v0.4) — no STATE.md schema pollution

---

## Feature 3: Adaptive Fan-Out

### What It Is

quorum.md reads `risk_level` from the task envelope and sets the worker count accordingly, instead of always using `quorum.maxSize` from config. Low-risk tasks use fewer workers (faster, cheaper); high-risk tasks use the full pool.

### Integration Seam

The integration point is the **slot selection step** in `quorum.md`, which already reads `max_quorum_size` from config and applies cap/bench logic. Adaptive fan-out adds a **pre-cap adjustment** based on `risk_level`.

```
Existing flow:
  read quorum.maxSize from config
  → filter unavailable slots
  → sort by preferSub
  → cap to (maxSize - 1) external slots
  → bench remainder

New flow (adaptive):
  read quorum.maxSize from config
  read risk_level from task-envelope.json (if envelope_path present)
  → compute effective_size = risk_tier_map[risk_level] ?? quorum.maxSize
  → filter unavailable slots
  → sort by preferSub
  → cap to (effective_size - 1) external slots
  → bench remainder
```

The `risk_tier_map` defines effective worker counts per tier:

| risk_level | effective_size | Rationale |
|------------|---------------|-----------|
| `low` | `max(2, quorum.minSize)` | At least Claude + 1 external for validity (R3.5) |
| `medium` | `quorum.maxSize` | Normal full quorum |
| `high` | `quorum.maxSize + quorum.highRiskBonus` | Expand pool up to total available slots |

### Config Keys (New)

```json
// ~/.claude/qgsd.json or .claude/qgsd.json
{
  "quorum": {
    "maxSize": 4,
    "preferSub": false,
    "minSize": 2,
    "highRiskBonus": 2,
    "adaptiveFanOut": true
  }
}
```

`adaptiveFanOut: false` disables the feature and restores static `maxSize` behavior. Default: `true` (feature enabled).

### Integration Points

**quorum.md**:
- Read `envelope_path` from the question context (passed by plan-phase.md)
- Parse `risk_level` from envelope JSON
- Compute `effective_size` using `risk_tier_map`
- Log the effective size in the pre-flight display:
  ```
  Adaptive fan-out: risk_level=medium → effective_size=4 (maxSize=4)
  ```

**hooks/config-loader.js**:
- Add `quorum.minSize` and `quorum.highRiskBonus` with validation (default: 2 and 2 respectively)
- Add `quorum.adaptiveFanOut` boolean (default: true)

**hooks/qgsd-prompt.js**:
- The `--n N` override already bypasses config maxSize
- Adaptive fan-out is a quorum.md concern, not a hook concern — no hook changes needed

### Modified Files

| File | What Changes |
|------|-------------|
| `commands/qgsd/quorum.md` | Insert risk_level read + effective_size computation before slot cap step |
| `hooks/config-loader.js` | Add `quorum.minSize`, `quorum.highRiskBonus`, `quorum.adaptiveFanOut` to DEFAULT_CONFIG and validateConfig() |
| `hooks/dist/config-loader.js` | Sync |

### NOT Modified

| File | Why |
|------|-----|
| `hooks/qgsd-prompt.js` | Fan-out is runtime quorum.md logic, not injection-time logic |
| `agents/qgsd-quorum-slot-worker.md` | Workers are unaware of fan-out decisions |
| `bin/update-scoreboard.cjs` | Fan-out count not tracked in scoreboard (round count is sufficient) |
| `bin/providers.json` | No per-slot risk metadata needed |

### Dependency on Feature 2

Adaptive fan-out depends on the task envelope (Feature 2). The `risk_level` field in the envelope is the data source. If the envelope is absent (task_envelope.enabled: false), adaptive fan-out falls back to static `quorum.maxSize`. This is the correct fail-open behavior.

---

## Feature 4: Tiered Models

### What It Is

quorum.md and plan-phase.md read a model tier from config and select models per-role based on tier. Example: fast/cheap models for low-risk quorum review; frontier models for high-risk plan verification.

### What "Tier" Means

A tier is a named preset that maps roles to model selections. The three roles in QGSD are:
- **orchestrator** — the Claude Code model running quorum.md (Claude itself; not directly configurable)
- **slot-worker** — the model parameter on each Task spawn (`model="haiku"` currently hardcoded in quorum.md)
- **external** — the LLM behind each slot CLI (providers.json `model` field)

The feasible tier implementation targets the **slot-worker** role (the haiku model used as the orchestrator sub-agent) and, for ccr-based slots, the model passed via `--model` in args_template.

### Integration Seam

**quorum.md slot-worker Task dispatch**:

Currently hardcoded in quorum.md:
```
Task(subagent_type="qgsd-quorum-slot-worker", model="haiku", max_turns=100, ...)
```

With tiers, the `model=` parameter is resolved from config:
```
model_for_tier = config.quorum.tierMap[effective_tier].slotWorkerModel ?? "haiku"
Task(subagent_type="qgsd-quorum-slot-worker", model=model_for_tier, max_turns=100, ...)
```

**providers.json per-slot tier override**:

Each provider entry can declare a `tier` field. The quorum orchestrator uses this to filter or sort slots by tier when `adaptiveFanOut` selects from the pool.

```json
// providers.json (existing slot entry, new field)
{
  "name": "claude-5",
  "model": "meta-llama/Llama-4-Maverick-17B-128E-Instruct-FP8",
  "tier": "fast",
  ...
}
```

**qgsd.json tier map**:

```json
{
  "quorum": {
    "tierMap": {
      "fast": {
        "slotWorkerModel": "claude-haiku-4-5-20251001",
        "preferredSlots": ["claude-5", "claude-6", "copilot-1"]
      },
      "standard": {
        "slotWorkerModel": "claude-haiku-4-5-20251001",
        "preferredSlots": []
      },
      "frontier": {
        "slotWorkerModel": "claude-sonnet-4-6",
        "preferredSlots": ["gemini-1", "codex-1", "claude-3"]
      }
    },
    "defaultTier": "standard"
  }
}
```

### Integration Points

**quorum.md**:
- After computing `risk_level` (Feature 3), compute `effective_tier`:
  ```
  effective_tier = risk_level === "high" ? "frontier" :
                   risk_level === "low"  ? "fast" : config.quorum.defaultTier
  ```
- Resolve `slotWorkerModel` from `tierMap[effective_tier]`
- Use `slotWorkerModel` in all Task dispatches (replacing hardcoded `model="haiku"`)
- Log tier in pre-flight:
  ```
  Tier: frontier (risk_level=high) → slot-worker model: claude-sonnet-4-6
  ```

**providers.json**:
- Add optional `tier` field to each provider entry
- `check-provider-health.cjs` reads tier for display purposes only
- No behavioral change — tier is informational metadata unless `tierMap.preferredSlots` is used

**hooks/config-loader.js**:
- Add `quorum.tierMap` and `quorum.defaultTier` to DEFAULT_CONFIG and validation
- `tierMap` validation: must be object; each tier value must be object with `slotWorkerModel` string
- Default: no `tierMap` (feature disabled); `defaultTier: "standard"`

**plan-phase.md**:
- Read `effective_tier` from the task envelope after quorum dispatch to inform retry decisions
- Upgrade tier on deliberation: if quorum reaches round 3+ without consensus, bump tier to next level

### Modified Files

| File | What Changes |
|------|-------------|
| `commands/qgsd/quorum.md` | Resolve `effective_tier` from risk_level; use `slotWorkerModel` in Task dispatch; log tier in pre-flight |
| `hooks/config-loader.js` | Add `quorum.tierMap`, `quorum.defaultTier` to DEFAULT_CONFIG and validateConfig() |
| `hooks/dist/config-loader.js` | Sync |
| `bin/providers.json` | Add `"tier"` field to each provider entry |
| `qgsd-core/workflows/plan-phase.md` | Read envelope tier after quorum to inform retry behavior |

### NOT Modified

| File | Why |
|------|-----|
| `agents/qgsd-quorum-slot-worker.md` | Workers don't select their own model — Task dispatch sets model= |
| `bin/update-scoreboard.cjs` | Scoreboard tracks performance by slot, not tier |
| `bin/call-quorum-slot.cjs` | Slot dispatch is unchanged — CLI args come from providers.json |
| `hooks/qgsd-stop.js` | No tier behavior at Stop gate level |

### Dependency on Feature 3

Tiered models and adaptive fan-out are designed as a coupled pair: Feature 3 determines effective worker count from risk_level; Feature 4 determines effective model quality from risk_level. Both read from the task envelope (Feature 2). The three features form a coherent risk-responsive quorum stack.

---

## Complete System Architecture — v0.18

```
UserPromptSubmit hook (hooks/qgsd-prompt.js)    [UNCHANGED]
  │
  └─ PLANNING COMMAND DETECTED
       │
       → plan-phase.md (GSD workflow)            [MODIFIED: envelope init + update calls]
            │
            ├─ Step 5:  qgsd-phase-researcher → RESEARCH.md
            │    └─ NEW: task-envelope.cjs init  → task-envelope.json (risk_level set)
            │
            ├─ Step 8:  qgsd-planner → *-PLAN.md
            │    └─ NEW: task-envelope.cjs update --section plan
            │
            ├─ Step 8.3: [v0.16] FV loop         [UNCHANGED]
            │
            ├─ Step 8.5: quorum dispatch          [MODIFIED: envelope_path passed to orchestrator]
            │
            └─ quorum.md dispatch                 [MODIFIED: adaptive fan-out + tiered models]
                 │
                 ├─ Provider pre-flight           [UNCHANGED]
                 ├─ Team capture                  [UNCHANGED]
                 ├─ NEW: Read task-envelope.json (if envelope_path present)
                 │         → risk_level → effective_size (Feature 3)
                 │         → risk_level → effective_tier → slotWorkerModel (Feature 4)
                 ├─ Slot sort/cap/bench           [MODIFIED: uses effective_size]
                 ├─ Round N fan-out               [MODIFIED: uses slotWorkerModel in Task dispatch]
                 │
                 └─ qgsd-quorum-slot-worker.md    [UNCHANGED]
                      └─ call-quorum-slot.cjs     [MODIFIED: emits [token-est: N] trailer]
                           returns: raw text + token estimate

Stop hook (hooks/qgsd-stop.js)                  [MODIFIED: appends token snapshot]
  └─ NEW: append to .planning/token-usage.jsonl

update-scoreboard.cjs                           [MODIFIED: --tokens-used flag]
  └─ atomic write to .planning/quorum-scoreboard.json

bin/task-envelope.cjs                           [NEW]
  → init, update, read operations on task-envelope.json

bin/providers.json                              [MODIFIED: tier field per slot]
hooks/config-loader.js                          [MODIFIED: new quorum sub-keys + task_envelope]
hooks/dist/config-loader.js                     [SYNC REQUIRED]
```

---

## Component Boundaries

| Component | Responsibility | Communicates With |
|-----------|----------------|-------------------|
| `bin/task-envelope.cjs` | Initialize, update, read task envelope JSON; validate schema | `plan-phase.md` (called at each stage boundary) |
| `commands/qgsd/quorum.md` | Adaptive fan-out + tiered model selection from envelope + token parse | `task-envelope.cjs` (reads), `call-quorum-slot.cjs` (receives token trailer), `update-scoreboard.cjs` (passes --tokens-used) |
| `hooks/qgsd-stop.js` | Token snapshot append per Stop event | `.planning/token-usage.jsonl` (writes) |
| `bin/call-quorum-slot.cjs` | Slot subprocess dispatch; new: emit token estimate trailer | `quorum.md` (returns stdout with trailer) |
| `bin/update-scoreboard.cjs` | Atomic scoreboard write; new: store token estimate per round | `.planning/quorum-scoreboard.json` (atomic write) |
| `hooks/config-loader.js` | Config load/validate; new: quorum tier keys + task_envelope key | All hooks + quorum.md (reads config) |
| `qgsd-core/workflows/plan-phase.md` | Pipeline orchestration; new: envelope init/update calls | `task-envelope.cjs` (invokes), `quorum.md` (passes envelope_path) |

---

## Recommended Project Structure (New Files Only)

```
bin/
├── task-envelope.cjs       # NEW — init/update/read task envelope
├── task-envelope.test.cjs  # NEW — unit tests (schema, update idempotency, fail-open)
.planning/
├── token-usage.jsonl       # RUNTIME ARTIFACT — append-only token snapshots
.planning/phases/<phase>/
├── task-envelope.json      # RUNTIME ARTIFACT — per-phase, created by task-envelope.cjs
```

---

## Data Flow — v0.18 Token-Aware Pipeline

```
1. User runs /qgsd:plan-phase v0.18-01

2. UserPromptSubmit hook → injects quorum instructions (unchanged)

3. plan-phase.md Step 5: qgsd-phase-researcher
     → writes .planning/phases/v0.18-01/RESEARCH.md
     → task-envelope.cjs init --phase v0.18-01 --risk-level medium
       writes .planning/phases/v0.18-01/task-envelope.json
         { risk_level: "medium", research: { summary: "..." } }

4. plan-phase.md Step 8: qgsd-planner
     → writes .planning/phases/v0.18-01/v0.18-01-01-PLAN.md
     → task-envelope.cjs update --section plan
       updates task-envelope.json
         { plan: { wave_count: 3, files_modified: [...], has_hook_edits: true } }

5. plan-phase.md Step 8.5: quorum dispatch
     quorum.md receives: envelope_path = .planning/phases/v0.18-01/task-envelope.json
     │
     ├─ reads risk_level = "medium"
     │    → effective_size = 4 (quorum.maxSize, medium tier)
     │    → effective_tier = "standard"
     │    → slotWorkerModel = "claude-haiku-4-5-20251001"
     │
     ├─ slots capped to 3 external (Claude + 3 = 4 total)
     │
     └─ Round 1 fan-out:
           Task(qgsd-quorum-slot-worker, model="claude-haiku-4-5-20251001", ...)
                    ↓ (4 parallel Tasks)
           call-quorum-slot.cjs --slot gemini-1 ...
                    ↓
           stdout: "<gemini response text>\n[token-est: 3200]"
                    ↓
           quorum.md parses token-est: 3200 + 2800 + 3100 + 3300 = 12400 total
           update-scoreboard.cjs --tokens-used 12400 --verdict APPROVE

6. Stop hook fires
     → reads Stop event context window data
     → appends to .planning/token-usage.jsonl:
         { ts: "...", phase: "v0.18-01", context_tokens: 45000, ... }

7. task-envelope.cjs update --section quorum
     → task-envelope.json final state:
         { risk_level: "medium", research: {...}, plan: {...},
           quorum: { worker_count: 4, rounds: 1, verdict: "APPROVE", token_est_total: 12400 } }
```

---

## Build Order (Dependency Graph)

Features 2 → 3 → 4 are coupled: the task envelope must exist before adaptive fan-out can read it, and adaptive fan-out must determine the effective tier before tiered models can select the model. Feature 1 (observability) is independent and can be built first or in parallel.

```
Phase 1 — Token Observability (independent; establishes data foundation)
  1a. hooks/qgsd-stop.js: token snapshot append
  1b. hooks/dist/qgsd-stop.js: sync
  1c. node bin/install.js --claude --global
  1d. bin/call-quorum-slot.cjs: [token-est: N] trailer emit
  1e. bin/update-scoreboard.cjs: --tokens-used flag + rounds[].token_est field
  1f. commands/qgsd/quorum.md: parse trailer + pass to scoreboard

  Why first: establishes token data that other features can reference.
  Hook sync is required here — qgsd-stop.js edit goes through dist/.
  Independent of envelope/fan-out/tier logic.

Phase 2 — Task Envelope (foundation for Features 3 + 4)
  2a. bin/task-envelope.cjs: init/update/read implementation
  2b. bin/task-envelope.test.cjs: unit tests (schema, idempotency, fail-open on missing file)
  2c. hooks/config-loader.js: add task_envelope.enabled key
  2d. hooks/dist/config-loader.js: sync
  2e. node bin/install.js --claude --global
  2f. qgsd-core/workflows/plan-phase.md: insert envelope init + update calls
  2g. node bin/install.js --claude --global  (plan-phase.md is installed to ~/.claude/qgsd/)

  Why second: Features 3 and 4 both read from the envelope.
  config-loader.js edit requires hook sync (2d + 2e).
  plan-phase.md edit requires install sync (2g).

Phase 3 — Adaptive Fan-Out (depends on Feature 2 envelope)
  3a. hooks/config-loader.js: add quorum.minSize, quorum.highRiskBonus, quorum.adaptiveFanOut
  3b. hooks/dist/config-loader.js: sync
  3c. node bin/install.js --claude --global
  3d. commands/qgsd/quorum.md: insert risk_level read + effective_size computation

  Why third: reads risk_level from envelope (Feature 2 must exist).
  config-loader.js edit requires hook sync.
  quorum.md is a command file (not a hook) — no install sync needed for quorum.md itself,
  but the installed copy at ~/.claude/qgsd/commands/qgsd/quorum.md must be updated:
  node bin/install.js --claude --global covers this.

Phase 4 — Tiered Models (depends on Features 2 + 3)
  4a. bin/providers.json: add "tier" field to each provider entry
  4b. hooks/config-loader.js: add quorum.tierMap, quorum.defaultTier
  4c. hooks/dist/config-loader.js: sync
  4d. node bin/install.js --claude --global
  4e. commands/qgsd/quorum.md: resolve effective_tier + slotWorkerModel; update Task dispatch
  4f. qgsd-core/workflows/plan-phase.md: read tier from envelope for retry decisions
  4g. node bin/install.js --claude --global

  Why last: depends on effective_size from Phase 3 (fan-out determines the pool to tier-filter).
  providers.json edit: bin/install.js syncs providers.json to ~/.claude/qgsd-bin/.
  Multiple install syncs in this phase — plan-phase.md and quorum.md both change.
```

### Dependency Summary

```
Phase 1 (Token Observability)     ← no dependencies; can run independently
  ↓
Phase 2 (Task Envelope)           ← no feature dependencies; must precede 3 + 4
  ↓
Phase 3 (Adaptive Fan-Out)        ← depends on Phase 2 (envelope risk_level)
  ↓
Phase 4 (Tiered Models)           ← depends on Phases 2 + 3 (envelope + effective_size)
```

Phases 1 and 2 can be ordered either way, but Phase 2 before Phase 1 is preferable because the envelope schema includes `quorum.token_est_total` — having the schema defined before writing token data to it is cleaner.

---

## Architectural Patterns to Follow

### Pattern 1: Additive Optional Fields in YAML Blocks

**What:** New envelope fields (`envelope_path`) are optional in the quorum.md slot-worker YAML block. If absent, quorum.md falls back to static `maxSize` and default tier.

**Why:** This is how `artifact_path`, `review_context`, `formal_spec_summary` all work. Workers already have conditional logic per optional field. Zero regression risk.

**Implementation note:** In `commands/qgsd/quorum.md`, the envelope read must be wrapped in a try/catch — if the file is missing or malformed, log a warning and proceed with defaults.

### Pattern 2: Config Gate for Every New Feature

**What:** Each feature has a config gate: `task_envelope.enabled`, `quorum.adaptiveFanOut`, `quorum.tierMap` (absence = disabled).

**Why:** `research_enabled`, `formal_verify_enabled` — every optional pipeline step has a config gate. Lets users disable features in CI or for fast iteration without modifying workflow files.

### Pattern 3: Atomic Writes for All Persistent Artifacts

**What:** `task-envelope.cjs` uses `tmpPath + fs.renameSync` for all writes to `task-envelope.json`.

**Why:** The scoreboard write pattern (`bin/update-scoreboard.cjs`) is the established QGSD pattern for concurrent-safe writes. The envelope is written by plan-phase.md which is synchronous, but following the pattern prevents torn writes on crash.

### Pattern 4: Hook Edit Requires dist/ Sync + Install Run

**What:** Any edit to `hooks/qgsd-stop.js`, `hooks/qgsd-prompt.js`, or `hooks/config-loader.js` MUST be followed by:
```
cp hooks/<file>.js hooks/dist/<file>.js
node bin/install.js --claude --global
```

**Why:** The installer reads from `hooks/dist/` and writes to `~/.claude/hooks/`. Source edits without sync are silent non-deployments. This is the most common QGSD integration mistake.

### Pattern 5: Fail-Open on Envelope Absence

**What:** If `task-envelope.json` is missing, unreadable, or missing the `risk_level` field, all envelope-dependent features (adaptive fan-out, tiered models) fall back to their static config values.

**Why:** CLAUDE.md R6 (fail-open). The envelope is a value-add. A missing envelope must never block quorum from running.

---

## Anti-Patterns to Avoid

### Anti-Pattern 1: Writing Token Estimates to providers.json

**What people do:** Add a `token_cost_per_1k` field to providers.json entries and use it for cost calculations.

**Why it's wrong:** providers.json is a static config read by multiple scripts. Token cost changes frequently and varies by prompt length — it should not be in the slot registry. Mixing cost metadata with dispatch config creates a maintenance burden.

**Instead:** Token observability (Feature 1) tracks runtime estimates in `token-usage.jsonl`. Cost analysis is a post-hoc query over that append-only log, not a real-time calculation in the dispatch path.

### Anti-Pattern 2: Hardcoding risk_level in quorum.md

**What people do:** Add a static `risk_level = "medium"` default in quorum.md and skip reading the envelope.

**Why it's wrong:** The static value defeats the purpose of adaptive fan-out. Worse, it silently ignores the envelope even when it exists, making the feature appear to work while doing nothing.

**Instead:** Always read the envelope if `envelope_path` is present. Fall back to static `maxSize` only when the envelope is absent or `risk_level` is missing.

### Anti-Pattern 3: Deep-Merging quorum.tierMap

**What people do:** Deep-merge `quorum.tierMap` so a project config can override only the `frontier` tier without specifying all tiers.

**Why it's wrong:** `config-loader.js` uses intentional shallow merge (Key Decision: "shallow merge for config layering"). Deep-merging `quorum` would be the only exception and would add special-case logic to `validateConfig()`.

**Instead:** Follow the shallow merge convention. If a project config sets `quorum: { tierMap: {...} }`, it must provide all tier entries it needs. Document this clearly in the config key description.

### Anti-Pattern 4: Making Adaptive Fan-Out Override the --n N Flag

**What people do:** Apply the adaptive effective_size even when `--n N` was passed by the user.

**Why it's wrong:** The `--n N` flag is a user override — it explicitly overrides config. Adaptive fan-out is a config-level feature. User intent beats config every time.

**Instead:** In quorum.md, the precedence order is: `--n N` flag (highest) → adaptive effective_size (if envelope present) → static `quorum.maxSize` (default). This matches the existing `quorumSizeOverride` precedence in `qgsd-prompt.js`.

---

## Integration Points Summary Table

### Existing Files — Change Type

| File | Change Type | What Changes | Hook Sync Required? |
|------|-------------|--------------|---------------------|
| `hooks/qgsd-stop.js` | Modified | Append token snapshot to token-usage.jsonl | YES — dist/ sync + install |
| `hooks/dist/qgsd-stop.js` | Modified (sync) | Receives qgsd-stop.js changes | — (is the sync target) |
| `hooks/config-loader.js` | Modified | Add task_envelope.enabled; quorum.minSize, highRiskBonus, adaptiveFanOut, tierMap, defaultTier | YES — dist/ sync + install |
| `hooks/dist/config-loader.js` | Modified (sync) | Receives config-loader.js changes | — (is the sync target) |
| `bin/call-quorum-slot.cjs` | Modified | Emit `[token-est: N]` trailer on stdout | NO — bin/ is installed, not dist/ |
| `bin/update-scoreboard.cjs` | Modified | Add --tokens-used flag; store rounds[].token_est | NO |
| `commands/qgsd/quorum.md` | Modified | Read envelope_path → risk_level → effective_size + effective_tier; parse token trailer; log adaptive decisions | NO — installed via bin/install.js |
| `qgsd-core/workflows/plan-phase.md` | Modified | Insert task-envelope.cjs init call after researcher; update call after planner; pass envelope_path to quorum | NO — installed via bin/install.js |
| `bin/providers.json` | Modified | Add "tier" field to each provider entry | NO — installed via bin/install.js |

### New Files

| File | Purpose |
|------|---------|
| `bin/task-envelope.cjs` | Initialize, update, read task envelope JSON with schema validation |
| `bin/task-envelope.test.cjs` | Unit tests: schema validation, update idempotency, fail-open on missing file, shallow merge behavior |

### NOT Modified (Architectural Boundary)

| File | Why Not Modified |
|------|-----------------|
| `agents/qgsd-quorum-slot-worker.md` | Workers are unaware of envelope, fan-out decisions, or tier selection — those are orchestrator concerns |
| `hooks/qgsd-prompt.js` | Token/envelope/fan-out are runtime quorum.md concerns; prompt injection is pre-response |
| `bin/update-scoreboard.cjs` (schema) | Scoreboard tracks per-model performance; token estimates are a separate concern in token-usage.jsonl |
| `bin/check-provider-health.cjs` | Provider health is about reachability, not tier or token cost |
| `formal/tla/QGSDQuorum.tla` | Formal spec does not model token budgets |

---

## Scalability Considerations

| Concern | Per quorum round | At 10 workers | At 100 phases |
|---------|-----------------|---------------|---------------|
| task-envelope.cjs read | <5ms (JSON file read) | negligible | negligible |
| token-est parsing | <1ms per slot result | ~10ms total | negligible |
| token-usage.jsonl append | <5ms (appendFileSync) | negligible | grows at ~200 bytes/Stop event; compactable |
| adaptive fan-out computation | <1ms (simple arithmetic) | negligible | negligible |
| slotWorkerModel change | no perf impact | no perf impact | depends on model latency |

No new performance bottlenecks are introduced. The largest change is `slotWorkerModel` in Task dispatch — using `claude-sonnet-4-6` instead of `claude-haiku-4-5-20251001` for high-risk tiers will increase slot-worker latency 2-3x but is gated on `risk_level=high` only.

---

## Reuse of Existing Patterns

| Existing Pattern | Used By Feature |
|-----------------|-----------------|
| `tmpPath + renameSync` atomic write (scoreboard) | Feature 2: task-envelope.cjs writes |
| `appendFileSync` append-only log (conformance-events.jsonl) | Feature 1: token-usage.jsonl |
| Optional YAML fields with `[if present]` guards (slot-worker) | Feature 2: envelope_path, risk_level |
| Config gate: `enabled` boolean (research_enabled, formal_verify_enabled) | Features 2, 3, 4 |
| `slotToToolCall()` slot → tool name mapping (config-loader.js) | Feature 4: tier → model mapping follows same lookup table pattern |
| Two-layer shallow config merge (config-loader.js) | Features 2, 3, 4: new config keys follow existing merge semantics |
| `--n N` user override takes precedence over config (qgsd-prompt.js) | Feature 3: `--n N` overrides adaptive effective_size |
| dist/ sync requirement (all hook edits) | Feature 1 (qgsd-stop.js) + Features 2/3/4 (config-loader.js) |

---

## Sources

- Live source reads: `hooks/qgsd-prompt.js`, `hooks/qgsd-stop.js`, `hooks/config-loader.js`, `commands/qgsd/quorum.md`, `agents/qgsd-quorum-slot-worker.md`, `bin/call-quorum-slot.cjs`, `bin/update-scoreboard.cjs`, `bin/providers.json`, `bin/qgsd.cjs`, `.planning/PROJECT.md`
- Prior architecture research: `.planning/research/ARCHITECTURE.md` (v0.16 Formal Plan Verification, 2026-02-26)
- Config system: `hooks/config-loader.js` DEFAULT_CONFIG; Key Decisions in PROJECT.md ("shallow merge for config layering")
- Install sync pattern: PROJECT.md Key Decisions ("installer sync is canonical mechanism for qgsd-core/ edits")
- Atomic write pattern: PROJECT.md Key Decisions ("Atomic write: tmpPath + renameSync at all scoreboard write sites")
- Hook install constraint: PROJECT.md Key Decisions ("hooks/dist/ new files are gitignored; existing tracked files updated via git add -f")

---

*Architecture research for: QGSD v0.18 Token Efficiency*
*Researched: 2026-02-27*
