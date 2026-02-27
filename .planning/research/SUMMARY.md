# Project Research Summary

**Project:** QGSD v0.18 — Token Efficiency
**Domain:** Retrofitting token observability, risk-adaptive routing, and structured context handoffs into an existing multi-agent quorum orchestration pipeline (Node.js, Claude Code hooks)
**Researched:** 2026-02-27
**Confidence:** HIGH

## Executive Summary

QGSD v0.18 introduces four token-efficiency features into a mature pipeline that already handles multi-model quorum consensus, iterative plan verification, and structured agent handoffs. The research establishes a clear, validated approach grounded entirely in the existing codebase: zero new npm dependencies are required for any of the four features. Token observability reads per-agent usage data from the `agent_transcript_path` field exposed by Claude Code's `SubagentStop` hook; adaptive fan-out extends the existing `--n N` override mechanism already understood by both `qgsd-prompt.js` and `qgsd-stop.js`; tiered model sizing enforces a pattern that is already partially correct in `quorum.md` (slot-workers already use `model="haiku"`); and the task envelope is a plain JSON sidecar file that follows the same atomic-write and config-gate patterns used by the scoreboard, conformance event log, and circuit breaker state files.

The recommended phase ordering is determined by strict dependency chains and by the constraint that the Stop hook's quorum evidence detection must never be broken. Features 3 (adaptive fan-out) and 4 (tiered models) both read from the task envelope, so the envelope (Feature 2) must ship before them. Feature 1 (token observability) is architecturally independent but should ship first to establish a measurement baseline against which the impact of the other three features can be verified. This ordering also isolates the highest-risk integration work (the task envelope's multi-agent protocol change) to a later phase where the observability infrastructure can confirm it is working. The four features deliver a coherent risk-responsive quorum stack: the envelope captures plan risk level, adaptive fan-out converts risk level to worker count, and tiered models convert risk level to model quality — all observable through the token log.

The dominant risk is protocol contract breakage between the dispatch layer and the Stop hook's quorum verification logic. `qgsd-stop.js` makes binary decisions (`quorum_complete` vs `quorum_block`) based on the `subagent_type="qgsd-quorum-slot-worker"` string and the worker count implied by the `--n N` token in the injected prompt. Any change that dispatches fewer workers without emitting `--n N`, or that uses a different `subagent_type`, silently blocks every plan delivery even after valid quorum completes. The second major risk is the shallow-merge trap in `config-loader.js`: any nested config object introduced for tiered models will be silently replaced by a partial project override, reverting unspecified tier sub-keys to `undefined`. Both risks are avoidable through design choices made at the schema and dispatch level before implementation begins.

## Key Findings

### Recommended Stack

All four v0.18 capabilities are implemented using Node.js stdlib and extensions to existing files. The zero-new-dependency constraint is not a compromise — it is the correct decision for each feature. Token observability uses `SubagentStop` hook + JSONL transcript parsing (`fs.readFileSync` + `JSON.parse`): this is the only in-process trigger that receives `agent_transcript_path`, which contains per-agent usage data confirmed via direct inspection of actual subagent transcript files on this machine. The task envelope uses `JSON.parse`/`JSON.stringify` + `fs.renameSync` atomic writes, following the exact pattern used by the scoreboard. Adaptive fan-out is a 15-line extension to `qgsd-prompt.js` that reads `worker_count` from the envelope file. Tiered model sizing is a 10-line extension that merges `model_tiers` config into the existing `model_preferences` injection path.

**Core technologies:**
- `SubagentStop` hook (Claude Code, current): trigger for token collection — only hook that fires with `agent_transcript_path`; matcher `qgsd-quorum-slot-worker` scopes it to quorum workers only
- JSONL transcript parsing (Node.js stdlib): sum `message.usage` fields from `agent_transcript_path`; structure confirmed via direct transcript inspection (`input_tokens`, `output_tokens`, `cache_creation_input_tokens`, `cache_read_input_tokens`)
- `fs.appendFileSync` (stdlib): append token records to `.planning/token-usage.jsonl`; atomic for records under 4KB (POSIX PIPE_BUF); matches conformance-events pattern
- `fs.renameSync` atomic write (stdlib): task envelope writes; same pattern as `update-scoreboard.cjs`
- `readEnvelopeWorkerCount()` helper (inline, 15 lines): reads `worker_count` from `TASK_ENVELOPE.json` via `current-activity.json` phase lookup; additive to existing hook logic
- `model_tiers` config key in `qgsd.json`: per-tier model assignment map; extends existing `model_preferences` pattern; no new data structure

**What NOT to add:**
- `zod` / `ajv`: ESM footprint (zod v4 is pure ESM); 5-field internal schema does not justify the dep
- Any UUID library: `Date.now().toString(16)` is sufficient for session-scoped file naming
- OpenTelemetry / Prometheus / `pino` / `winston`: designed for microservices; `.planning/token-usage.jsonl` with `appendFileSync` is the correct QGSD pattern
- SQLite: overkill; JSONL append is correct at QGSD's scale (hundreds of rounds per session)

### Expected Features

**Must have (table stakes — v0.18 milestone is not credible without all four):**
- Tiered model sizing: enforce `model="haiku"` for researcher/checker sub-agents; only planner uses sonnet; policy already correct in `quorum.md` for slot-workers, needs extending to two additional spawn sites in `plan-phase.md` — P1 because it has zero new infrastructure and delivers the highest cost reduction (15-20x per researcher/checker invocation)
- Adaptive quorum fan-out: `risk_level` → worker count via envelope; extends existing `max_quorum_size` mechanism; reduces token cost 3-8x on low/medium-risk quorums without weakening the consensus guarantee — P1 because it targets the dominant token waste (dispatching 8 workers for a simple quick-task)
- Token observability: per-slot token tracking via `SubagentStop` hook; `.planning/token-usage.jsonl` writes; `/qgsd:health` token section — P1 because measurement must precede verification of the other features' impact
- Compact context handoffs (task envelope): JSON schema passed research → plan → quorum; eliminates N full PLAN.md re-reads per quorum round (N=5 workers × 500-line PLAN.md is the single largest token expenditure per round) — P2 due to highest integration surface (4 integration points: researcher, planner, quorum.md, plan-phase.md)

**Should have (differentiators — add in v0.18.x post-validation):**
- Token budget alerts: warn when a quorum round exceeds configurable threshold (default 50K tokens); depends on observability data being established first; warn-only, consistent with R6 fail-open
- Benched slot warm-up suppression: skip `health_check` for benched slots (over-cap slots that will not be dispatched this round); low effort, follows from confirmed benching behavior
- Envelope diff mode: skip full PLAN.md re-read in deliberation rounds when envelope checksum matches prior round; medium effort, requires envelope to have been in use for 1-2 milestones first

**Defer to v0.19+:**
- Cross-session token trend analysis: aggregate `token-usage.jsonl` over multiple sessions; requires persistence strategy beyond current disk-only pattern
- Provider-level token cost mapping: USD cost per provider (Together/Fireworks/AkashML pricing differs); requires price table maintenance; out of scope for v0.18

**Anti-features (explicitly excluded):**
- Token quota hard blocks: violates R6 fail-open; could deadlock critical phases mid-execution; warn-only is the correct policy
- Per-slot model override for external CLI slots (gemini-cli, codex-cli): these use provider-configured models; QGSD does not override them from within the pipeline
- Lossy context compression: structured extraction (task envelope) is correct; automatic summarization removes details the planner needs, causing failed quorums that cost more tokens than the savings

### Architecture Approach

The v0.18 architecture is purely additive to the stable v0.16/v0.17 baseline. No existing workflow steps are restructured. The four features insert at well-defined seams: the `SubagentStop` hook slot (new hook registration), the `qgsd-prompt.js` worker count resolution path (additive helper), the `quorum.md` slot selection step (pre-cap adjustment), and the `plan-phase.md` stage transition boundaries (envelope init/update calls). The task envelope follows the same sidecar artifact pattern as `current-activity.json` (v0.4) and `conformance-events.jsonl` — a per-context file that accumulates data without polluting STATE.md. Two new bin/ scripts are required (`task-envelope.cjs`, `task-envelope.test.cjs`) and one new hook file (`qgsd-token-collector.js`). All other changes are extensions to existing files.

**Major components:**
1. `hooks/qgsd-token-collector.js` (NEW) — SubagentStop hook; reads `agent_transcript_path` JSONL, sums `message.usage` fields across non-sidechain assistant entries, correlates `agent_id` to slot name via correlation file written by dispatch before spawn, appends structured record to `.planning/token-usage.jsonl`; `async: true` (non-blocking, observational)
2. `bin/task-envelope.cjs` (NEW) — init, update, and read operations on `task-envelope.json` per phase; atomic writes via `tmpPath + renameSync`; schema validation with fail-open on missing file; `task_envelope.enabled` config gate
3. `hooks/qgsd-prompt.js` (EXTENDED) — `readEnvelopeWorkerCount()` helper reads `worker_count` from task envelope via `current-activity.json` phase lookup; priority chain: `--n N flag > envelope worker_count > config.quorum.maxSize > pool length`; envelope-driven model tier selection (`effectivePrefs = { ...model_preferences, ...tierPrefs }`)
4. `hooks/qgsd-stop.js` (EXTENDED) — add envelope-based worker count cap to `maxSize` resolution; same `quorumSizeOverride` path that handles `--n N`; no change to `wasSlotWorkerUsed()` contract (subagent_type string unchanged)
5. `commands/qgsd/quorum.md` (MODIFIED) — read `envelope_path` → parse `risk_level` → compute `effective_size` (adaptive fan-out) and `effective_tier` (tiered models); log decisions in pre-flight; update envelope with quorum section after consensus
6. `qgsd-core/workflows/plan-phase.md` (MODIFIED) — insert `task-envelope.cjs init` after researcher step; `task-envelope.cjs update --section plan` after planner step; pass `envelope_path` to quorum dispatch; enforce `model="haiku"` at researcher and checker Task spawn sites
7. `hooks/config-loader.js` (EXTENDED) — add `model_tiers`, `task_envelope.enabled`, `quorum.minSize`, `quorum.highRiskBonus`, `quorum.adaptiveFanOut`, `quorum.tierMap`, `quorum.defaultTier` to DEFAULT_CONFIG and `validateConfig()`

**Key architectural patterns:**
- Additive optional fields in YAML blocks: `envelope_path` is optional in quorum.md slot-worker YAML; absent = fall back to static `maxSize` and default tier; zero regression risk
- Config gate for every new feature: `task_envelope.enabled`, `quorum.adaptiveFanOut`, `quorum.tierMap` absence = disabled; consistent with `research_enabled`, `formal_verify_enabled` pattern
- Fail-open on envelope absence: missing/malformed `task-envelope.json` causes all envelope-dependent features to fall back to static config; R6 compliance; envelope is optimization not hard requirement
- Hook edit requires dist/ sync + install: `hooks/qgsd-token-collector.js`, `hooks/qgsd-stop.js`, `hooks/config-loader.js` edits ALL require `cp hooks/<file>.js hooks/dist/<file>.js && node bin/install.js --claude --global`
- Flat config keys for tier config: avoid nested objects that would be silently lost on partial project override via shallow merge; `model_tier_cheap` not `model_tiers: { cheap: ... }`

### Critical Pitfalls

1. **Token count assumed available in hook payloads — it is not** — `SubagentStop` payload contains `agent_transcript_path`, not `token_usage`. Read the transcript file to sum usage. Verify exact payload shape via `node bin/review-mcp-logs.cjs` before writing any observability code. Designing around an assumed field that returns `undefined` will silently emit no logs with no error (fail-open hooks).

2. **Task envelope or new subagent_type breaks Stop hook quorum evidence detection** — `qgsd-stop.js` `wasSlotWorkerUsed()` (line 157) matches exactly `"qgsd-quorum-slot-worker"`. Any new dispatch variant using a different subagent_type silently blocks every plan delivery. The envelope MUST be delivered as fields in the YAML prompt body, never as a change to `subagent_type`. If `wasSlotWorkerUsed()` must change, it MUST be updated in the same plan phase as the dispatch change, with hook sync and install run in the same plan.

3. **Adaptive fan-out that does not emit `--n N` blocks every reduced-fan-out turn** — The Stop hook ceiling check reads worker count from `parseQuorumSizeFlag()` which scans for the `--n N` token in prompt text. Adaptive logic that silently slices `cappedSlots` to fewer workers without emitting `--n N` causes Stop to block every reduced-fan-out turn. All fan-out sizing MUST flow through the `--n N` injection path. This also constitutes an R3.5 violation if available models are silently excluded.

4. **Tiered model config as nested object causes silent data loss via shallow merge** — `config-loader.js` uses strict shallow spread (`{ ...DEFAULT_CONFIG, ...global, ...project }`). A project `.claude/qgsd.json` that sets `quorum: { tierMap: { fast: {...} } }` (without specifying all tiers) silently replaces the entire `quorum` block, reverting unspecified tiers to `undefined`. Use flat config keys or require full block replacement with a `validateConfig()` warning that backfills missing sub-keys from defaults.

5. **Hook install sync omitted after hook edits — silent non-deployment** — source edits to `hooks/` are ignored at runtime; `~/.claude/hooks/` is what Claude Code loads. Every plan modifying any hook file MUST include: `cp hooks/<name>.js hooks/dist/<name>.js && node bin/install.js --claude --global`. Verify with `diff hooks/dist/<name>.js ~/.claude/hooks/<name>.js` — diff must be empty. This has burned QGSD before (Phase v0.13-06 INT-03).

## Implications for Roadmap

Based on combined research, 4 table-stakes features decompose into 4 implementation phases in strict dependency order. Features 3 (adaptive fan-out) and 4 (tiered models) both require the task envelope (Feature 2) for their runtime inputs. Token observability (Feature 1) is independent but ships first to establish baseline measurement.

### Phase v0.18-01: Token Observability Foundation

**Rationale:** Independent of all other features; establishes the measurement baseline that validates the impact of Phases 2-4. Ships first because: (a) it proves the `SubagentStop` hook + `agent_transcript_path` transcript parsing approach works before that infrastructure is relied on by health display; (b) the token log data makes the improvements from later phases visible and verifiable; (c) this phase has the lowest integration surface (new hook + extension to two existing scripts).
**Delivers:** `hooks/qgsd-token-collector.js` (SubagentStop hook); `.planning/token-usage.jsonl` append-only log; `/qgsd:health` token usage section (reads log, aggregates by slot); correlation file protocol (`quorum-slot-corr-<agent_id>.json`) written by `qgsd-prompt.js` at dispatch, read and cleaned up by hook; `~/.claude/settings.json` SubagentStop hook registration.
**Addresses:** Token observability table-stakes feature from FEATURES.md.
**Stack used:** `SubagentStop` hook (Claude Code); `fs.readFileSync` + `JSON.parse` (transcript parsing); `fs.appendFileSync` (JSONL log); Node.js stdlib throughout.
**Avoids:** Pitfall 1 (verify payload shape via `review-mcp-logs.cjs` before coding; design around `agent_transcript_path` not assumed `token_usage` field); Pitfall 5 (hook sync + install required for new hook registration).

### Phase v0.18-02: Tiered Model Sizing

**Rationale:** Lowest integration surface of the remaining three features. Enforces a pattern that is already partially correct (quorum.md already uses `model="haiku"` for slot-workers); extends it to the researcher and checker spawn sites in `plan-phase.md`. No new protocols, no new files beyond config schema additions. Ships second because its changes to `plan-phase.md` and `config-loader.js` establish clean baseline state before Phase 3 modifies the same config-loader and Phase 4 modifies the same plan-phase.md.
**Delivers:** `model="haiku"` enforced at researcher Task spawn (plan-phase.md Step 5) and checker Task spawn (plan-phase.md Step 10); `model_tiers` config key in `qgsd.json` schema; `quorum.tierMap`, `quorum.defaultTier` in `config-loader.js` DEFAULT_CONFIG and `validateConfig()`; `model_tier` field in `gsd-tools.cjs` INIT JSON output; explicit documentation of tier policy in `quorum.md` and `plan-phase.md`.
**Addresses:** Tiered model sizing table-stakes feature from FEATURES.md.
**Stack used:** Config extension only; no new npm packages.
**Avoids:** Pitfall 4 (flat config keys or full-block replacement semantics with `validateConfig()` backfill warning); Pitfall 5 (config-loader.js edit requires dist/ sync + install).

### Phase v0.18-03: Task Envelope

**Rationale:** Foundation for Phase 4 (adaptive fan-out reads `risk_level` from envelope) and Phase 4's tiered model extension (reads `model_tier` from envelope). Ships third because: (a) Phases 3 and 4 are blocked on the envelope existing; (b) this phase has the most integration surface (researcher agent, planner agent, quorum.md, plan-phase.md) and deserves its own phase for careful end-to-end testing; (c) token observability from Phase 1 can measure envelope read overhead and confirm the context reduction claim.
**Delivers:** `bin/task-envelope.cjs` (init/update/read with atomic writes and schema validation); `bin/task-envelope.test.cjs` (unit tests: schema, idempotency, fail-open on missing file); `task_envelope.enabled` config gate in `config-loader.js`; `plan-phase.md` Step 5 and Step 8 envelope init/update calls; `quorum.md` optional `envelope_path` field reading with fail-open fallback; `qgsd-planner` and `qgsd-phase-researcher` agent instructions updated to write envelope at completion.
**Addresses:** Compact context handoffs table-stakes feature from FEATURES.md.
**Stack used:** `JSON.parse`/`JSON.stringify` + `fs.renameSync` (atomic writes); Node.js stdlib.
**Avoids:** Pitfall 2 (envelope delivered as YAML body fields, never as subagent_type change; `wasSlotWorkerUsed()` unchanged); Pitfall 5 (config-loader.js + plan-phase.md edits require dist/ sync + install); anti-pattern 3 (shallow merge: project config must provide full tierMap or use validateConfig() backfill).

### Phase v0.18-04: Adaptive Fan-Out and Coupled Tier Dispatch

**Rationale:** Depends on Phase 3 envelope (reads `risk_level`) and Phase 2 tiered model config (reads `effective_tier`). The two features are designed as a coupled pair — adaptive fan-out determines effective worker count from risk_level, tiered models determine effective slot-worker model from risk_level — and share the same quorum.md insertion point. Shipping together avoids two separate modifications to the same slot-selection code block.
**Delivers:** `readEnvelopeWorkerCount()` helper in `qgsd-prompt.js` (reads envelope via `current-activity.json` phase lookup); priority chain `--n N > envelope worker_count > config.quorum.maxSize > pool length` implemented in both `qgsd-prompt.js` and `qgsd-stop.js`; `quorum.md` adaptive fan-out logic (risk_level → effective_size, logged in pre-flight); `quorum.md` tier dispatch logic (effective_tier → slotWorkerModel in Task dispatch); `quorum.minSize`, `quorum.highRiskBonus`, `quorum.adaptiveFanOut` config keys; R6.4 reduced-quorum log when fan-out is below maxSize.
**Addresses:** Adaptive quorum fan-out table-stakes feature from FEATURES.md; completes tiered model sizing (now envelope-driven).
**Stack used:** Config extension; no new npm packages.
**Avoids:** Pitfall 3 (`--n N` injection MUST be emitted for any reduced fan-out; Stop hook reads count from prompt text only); Pitfall 5 (qgsd-prompt.js + qgsd-stop.js edits require dist/ sync + install); anti-pattern 4 (`--n N` user override takes highest precedence over adaptive logic).

### Phase Ordering Rationale

- **Phase 1 → Phases 2-4 (measurement first):** Token observability ships first so the health output can quantify the impact of each subsequent phase. Without the log baseline, improvement claims are unverified.
- **Phase 2 before Phase 3 (config schema stability):** Tiered model sizing introduces `config-loader.js` additions (`model_tiers`, `quorum.tierMap`). Phase 3 also modifies `config-loader.js` (adds `task_envelope.enabled`). Completing Phase 2 first establishes a stable config schema before Phase 3's additions. Reduces merge surface.
- **Phase 3 before Phase 4 (hard data dependency):** Adaptive fan-out reads `risk_level` from `task-envelope.json`. Tiered model dispatch reads `model_tier` from `task-envelope.json`. Both features are inoperable (fall back to static defaults) without the envelope being written by the researcher and planner. Phase 4 can technically be partially functional without the envelope (static defaults), but the adaptive behavior only activates with Phase 3 in place.
- **Phases 2 and 3 are independently sequenced (no coupling between them):** They touch non-overlapping protocol surfaces. If timeline requires it, Phase 3 could swap with Phase 2 — but Phase 2 first is preferable for config schema stability.
- **Phase 4 last (depends on both Phase 2 and Phase 3):** Cannot fully test adaptive fan-out without an envelope providing `risk_level`. Cannot fully test tier dispatch without `model_tiers` config from Phase 2.

### Research Flags

Phases likely needing deeper research during planning:
- **Phase v0.18-01 (Token Observability):** MEDIUM research need. The correlation file protocol (mapping `agent_id` assigned at Task spawn time to the slot name known before spawn) is new infrastructure. The timing of `agent_id` assignment by Claude Code is not documented — verify via MCP logs whether `agent_id` is predictable before spawn or only assignable after. If not predictable pre-spawn, the correlation file must be written after spawn using a different keying strategy. Address during Phase v0.18-01 planning before implementing the hook.
- **Phase v0.18-04 (Adaptive Fan-Out):** MEDIUM research need. The `--n N` injection mechanism must be verified to reach `qgsd-stop.js`'s `parseQuorumSizeFlag()` correctly when the number comes from the envelope (not user input). Verify via a test quorum turn with an envelope-driven reduced fan-out that `conformance-events.jsonl` shows `quorum_complete` not `quorum_block`. The R3.5 compliance notification format (R6.4 reduced-quorum log) must be explicitly designed and tested.

Phases with standard patterns (skip research-phase):
- **Phase v0.18-02 (Tiered Model Sizing):** LOW research need. Extends existing `model="haiku"` pattern already in `quorum.md`. Config key additions follow the exact same schema as `research_enabled`/`formal_verify_enabled`. The only decision is flat vs nested config structure — research has already resolved this (flat keys required given shallow merge semantics). No new API surface.
- **Phase v0.18-03 (Task Envelope):** LOW-MEDIUM research need. The envelope schema is first-principles design, but the integration points are fully mapped (4 points with exact file/line context from architecture research). The `bin/task-envelope.cjs` init/update/read pattern follows the scoreboard pattern precisely. The main uncertainty is the exact YAML block syntax for the optional `envelope_path` field — verify against the existing `artifact_path` optional field pattern in `qgsd-quorum-slot-worker.md` during planning.

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | Zero new npm deps confirmed with rationale for each rejected library; `SubagentStop` `agent_transcript_path` field confirmed via official docs AND direct transcript inspection on this machine; all implementation patterns trace to existing working code in the codebase |
| Features | HIGH for table stakes; MEDIUM for differentiators | Table stakes confirmed via PRIMARY SOURCE reads of `quorum.md`, `plan-phase.md`, `qgsd-prompt.js`, `qgsd-stop.js`; differentiators (budget alerts, envelope diff mode) are additive and well-bounded; feature dependencies fully mapped |
| Architecture | HIGH | All integration seams identified via live source inspection; build order dependency graph derived from actual file dependencies; component boundary table covers all 7 modified/new files with change type and sync requirements; UNCHANGED files documented with rationale |
| Pitfalls | HIGH | All 5 critical pitfalls grounded in live source inspection of the exact code paths at risk (`wasSlotWorkerUsed()` line 157, `parseQuorumSizeFlag()` line 364 in `qgsd-stop.js`; shallow merge line 259 in `config-loader.js`; `merge-wave` subcommand in `update-scoreboard.cjs`; CLAUDE.md R3.5/R6.4 requirements); recovery strategies provided for each |

**Overall confidence:** HIGH

### Gaps to Address

- **`agent_id` assignment timing:** The correlation file protocol assumes that `agent_id` is assigned after Task spawn and that `qgsd-prompt.js` writes the correlation file before the SubagentStop event fires for that agent. This timing assumption needs verification in Phase v0.18-01 planning. Fallback: use `last_assistant_message` vote line parsing (the vote output already contains `slot:` in the YAML block) as a secondary slot-name derivation method.

- **`--n N` emission verification for envelope-driven fan-out:** Phase v0.18-04 requires that the adaptive fan-out logic emits `--n N` into the prompt text so `qgsd-stop.js` reads it correctly. The exact injection point in `qgsd-prompt.js` where `--n N` is synthesized needs to be verified during Phase v0.18-04 planning — confirm it is the same code path that the Stop hook scans, not a different injection location.

- **Envelope `risk_level` classification accuracy:** The `classifyRiskTier()` heuristic (regex scan for ROADMAP, architecture, security, breaking change keywords) may misclassify phases. Post-Phase 3, monitor token logs to confirm low-risk phases are actually receiving `routine` classification and the fan-out reduction is occurring. If misclassification is common, the regex keyword list needs tuning.

- **`VALID_MODELS` guard in `update-scoreboard.cjs`:** If Phase v0.18-04 introduces new slot family names for tiered model groups, those names must be added to the `VALID_MODELS` array at line 44 of `update-scoreboard.cjs`. Omitting this causes silent UNAVAIL counting errors. Verify during Phase v0.18-04 planning.

## Sources

### Primary (HIGH confidence)
- `/Users/jonathanborduas/code/QGSD/hooks/qgsd-stop.js` — `wasSlotWorkerUsed()` line 157; ceiling check line 486; `parseQuorumSizeFlag()` line 364; confirms exact subagent_type contract and `--n N` override path
- `/Users/jonathanborduas/code/QGSD/hooks/qgsd-prompt.js` — `parseQuorumSizeFlag()` line 109; `cappedSlots` line 211; `externalSlotCap` logic; confirms `--n N` is the authoritative fan-out control channel
- `/Users/jonathanborduas/code/QGSD/hooks/config-loader.js` — shallow merge line 259: `{ ...DEFAULT_CONFIG, ...(globalObj || {}), ...(projectObj || {}) }`; confirms partial override pitfall for nested config objects
- `/Users/jonathanborduas/code/QGSD/bin/update-scoreboard.cjs` — `VALID_MODELS` line 44; `merge-wave` subcommand structure; confirms token field handling must go through merge-wave
- `/Users/jonathanborduas/code/QGSD/commands/qgsd/quorum.md` — full inline R3 protocol; `max_quorum_size` mechanism; `preferSub` sorting; slot-worker YAML block format; benched pool pattern
- `/Users/jonathanborduas/code/QGSD/qgsd-core/workflows/plan-phase.md` — Steps 5/8/8.5/10 researcher/planner/checker spawn points; model= field; files_to_read blocks that envelope will optimize
- `/Users/jonathanborduas/code/QGSD/.planning/PROJECT.md` — v0.18 target features; existing feature list; constraints (no GSD source modification, global install pattern)
- `/Users/jonathanborduas/code/QGSD/CLAUDE.md` — R3.5 minimum quorum; R6.2-R6.4 fail-open and reduced-quorum documentation requirements
- Claude Code Hooks reference (code.claude.com/docs/en/hooks) — SubagentStop payload schema; `agent_transcript_path` field; SubagentStop matcher values; `async` hook option
- Direct transcript inspection on target machine: `~/.claude/projects/.../subagents/agent-ae63d1e.jsonl` — confirmed `message.usage.{input_tokens, output_tokens, cache_creation_input_tokens, cache_read_input_tokens}` structure
- Feature request github.com/anthropics/claude-code/issues/13994 — confirms per-sub-agent metrics NOT in hook payload; transcript parsing is the only available method

### Secondary (MEDIUM confidence)
- Claude Code Manage Costs Documentation (code.claude.com/docs/en/costs) — `model="haiku"` for subagents is the endorsed pattern; agent teams ~7x more tokens than standard sessions
- ACON: Optimizing Context Compression for Long-horizon LLM Agents (arXiv 2510.00615) — structured extraction over lossy summarization; confirms task envelope direction
- IETF draft-chang-agent-token-efficient-01 — schema deduplication via JSON $ref; adaptive field inclusion; confirms structured envelope approach
- Context Engineering for Reliable AI Agents (Azure SRE Agent, Microsoft) — context as first-class engineering concern; structured state handoff between agent stages
- LLM Cost Optimization Guide 2025 (futureagi.com) — 30-70% cost reduction via routing; tiered model usage confirmed as primary strategy
- Langfuse Token and Cost Tracking — per-call token attribution as table-stakes for production observability
- liambx.com/blog/claude-code-log-analysis-with-duckdb — confirmed JSONL structure; `isSidechain`/`isApiErrorMessage` filter fields; `message.usage` path

### Tertiary (LOW confidence)
- requesty.ai/mindstudio.ai LLM routing guides — risk-based routing for cost efficiency; confirms quorum fan-out as a routing problem; WebSearch summaries only

---
*Research completed: 2026-02-27*
*Ready for roadmap: yes*
