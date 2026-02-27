# Feature Research

**Domain:** Token efficiency features for QGSD v0.18 — multi-agent quorum orchestration system (Node.js, Claude Code hooks)
**Researched:** 2026-02-27
**Confidence:** HIGH for token observability patterns (Claude Code /cost documentation confirmed); HIGH for tiered model sizing (existing quorum.md already uses model="haiku" for workers); MEDIUM for adaptive fan-out behavior design (first-principles from QGSD quorum.md existing max_quorum_size mechanism); MEDIUM for task envelope schema (IETF draft confirmed direction, schema is QGSD-specific design)

---

## Context: What Is Already Built

This is a SUBSEQUENT MILESTONE. QGSD already has the following relevant infrastructure:

- `commands/qgsd/quorum.md` — full inline R3 protocol with wave-barrier parallel dispatch; `max_quorum_size` config (default 3) already caps workers; `preferSub` sorting (sub-auth slots first); pre-flight provider health check
- `bin/update-scoreboard.cjs` — atomic scoreboard writes per round; `--model`/`--slot`/`--model-id` flags; TP/TN/FP/FN result classification
- `bin/call-quorum-slot.cjs` — bash-callable CLI dispatcher; reads `providers.json` for slot routing
- `bin/check-provider-health.cjs` — provider-level HTTP health probe used at quorum pre-flight
- `commands/qgsd/health.md` + `qgsd-core/workflows/health.md` — validates `.planning/` directory; surfaces `quorum-failures.json` (v0.15 deferred); gsd-tools.cjs validate health; status/errors/warnings/info output format
- `qgsd-core/workflows/plan-phase.md` — researcher → planner → plan-checker → quorum chain; `INIT` JSON from gsd-tools with model resolution; Task spawn pattern with `model=` field
- `hooks/qgsd-stop.js` — quorum verification gate; reads JSONL transcript; conformance event logger
- `hooks/qgsd-prompt.js` — quorum injection hook; dynamic slot list from quorum_active
- `qgsd.json` two-layer config (global `~/.claude/qgsd.json` + per-project `.claude/qgsd.json`; project overwrites global); `quorum.maxSize`/`max_quorum_size` already present
- `agents/qgsd-quorum-slot-worker.md` — haiku-model sub-agent that orchestrates CLI subprocess; reads YAML block; writes vote file
- Activity sidecar `.planning/current-activity.json` — phase/sub_activity/quorum_round tracking

The 4 features below are NEW for v0.18.

---

## Feature Landscape

### Table Stakes (Users Expect These)

Features the v0.18 milestone cannot ship without. These are the minimum for "Token Efficiency" to be a credible milestone claim.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Token observability: per-sub-agent token consumption tracking surfaced in /qgsd:health | Any system claiming "token efficiency" must be able to tell users where tokens are going. Without measurement, there is no efficiency. Claude Code's official /cost command shows session-level totals; /qgsd:health is the QGSD-specific diagnostic surface where per-agent breakdown belongs. Production observability platforms (Langfuse, Datadog LLM, Braintrust) all treat per-call/per-agent token attribution as table-stakes for 2025. | MEDIUM | Track tokens_in (input tokens), tokens_out (output tokens), and latency_ms per quorum round, per slot call. Source: Claude Code Task() return value includes usage metadata; call-quorum-slot.cjs subprocess output can include token counts from provider responses. Storage: append to `.planning/quorum-token-log.jsonl` (gitignored, one line per slot call). Health output: new "Token Usage" section in /qgsd:health showing top consumers, round totals, and session totals. Read-only — no repair actions needed. |
| Adaptive quorum fan-out: risk-aware worker count based on task risk_level | QGSD currently dispatches max_quorum_size workers for every quorum round regardless of task complexity. Routing low-risk informational questions through 8 workers is 8x the token cost of routing through 1. Risk-based scaling is a documented production pattern: LLM routing research (requesty.ai, futureagi.com) confirms 30-70% cost reduction by matching model/worker count to task complexity. | MEDIUM | risk_level field on plan-phase quorum calls: low=1 external worker, medium=3 external workers, high=5 external workers (not 8 — cap stays for maximum protection). QGSD-specific: risk_level is derived from the planning command context (quick=low, plan-phase for simple feature=medium, plan-phase for complex architectural change=high). Override via `--risk-level <low|medium|high>` flag. Config key: `quorum.riskFanOut: { low: 1, medium: 3, high: 5 }` in qgsd.json. Existing max_quorum_size becomes the absolute ceiling; riskFanOut values are the contextual defaults. |
| Tiered model sizing: cheap models (haiku) for quorum workers, strong model for planner only | quorum.md already dispatches slot-workers with model="haiku" — this is the correct pattern. v0.18 makes it explicit policy and extends it to the researcher and plan-checker sub-agents, which currently use the model resolved from INIT JSON (which may resolve to Sonnet). The cost differential is ~15-20x between haiku and sonnet for the same token count. Claude Code docs confirm: "For simple subagent tasks, specify model: haiku in your subagent configuration." This is table stakes because it directly addresses the cost-per-quorum-round metric without changing quorum quality. | LOW | Verify and enforce: quorum slot-workers always model="haiku" (already correct in quorum.md). Plan-checker sub-agent: model="haiku" unless checker_model config overrides. Researcher sub-agent: model="haiku" for standard phase research (no deep reasoning required — researcher reads files and summarizes). Planner sub-agent: model="sonnet" (or user-configured planner_model from INIT) — this is the only stage requiring frontier model reasoning. Document the policy explicitly in quorum.md and plan-phase.md. Add `model_tier` field to INIT JSON output from gsd-tools.cjs. |
| Compact context handoffs (task envelope): structured JSON schema replacing full-text duplication between research→plan→quorum stages | Each stage in plan-phase currently passes context as full markdown file paths that sub-agents re-read independently, creating repeated token consumption at each stage boundary. The industry pattern (ACON arxiv 2510.00615; Azure SRE agent context engineering; IETF ADOL draft) is to replace verbose re-reads with a compact structured summary — a "task envelope" — that carries only the fields the next stage needs. In QGSD's case: researcher output → planner needs only structured research_summary (not full RESEARCH.md re-read); planner output → quorum needs only formal_plan_digest (not full PLAN.md re-read by each of N workers). | HIGH | JSON task envelope schema: `{ phase, plan_name, summary, key_decisions[], constraints[], open_questions[], risk_level, wave_count, req_ids[] }`. Generated by researcher at end of research step; consumed by planner without re-reading full RESEARCH.md. Generated by planner at end of planning step; consumed by quorum slot-workers without re-reading full PLAN.md. Storage: `.planning/phases/<phase>/<phase>-ENVELOPE.json`. Envelope is the handoff artifact; full files still exist for human reference and detailed review. Workers read envelope for context; optionally read full PLAN.md if they need detail (explicit read, not default). Reduces repeated context from ~5K tokens/stage to ~300 tokens/stage. |

---

### Differentiators (Competitive Advantage)

Features that set v0.18 apart. Not required for the milestone to be credible, but add measurable value.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Token budget alerts: warn when a quorum round exceeds configurable token threshold | Once token observability is in place (table stakes), budget alerts close the loop: users learn when something is unexpectedly expensive. LLM cost monitoring platforms (Datadog, Maxim, Braintrust) all surface per-call thresholds as a standard feature. QGSD already surfaces warnings in /qgsd:health — token budget warnings fit the existing warning pattern. | LOW | Config key: `quorum.tokenBudget.warnPerRound: 50000` (tokens, default 50K). If any quorum round total exceeds threshold, append a W-class warning to the next /qgsd:health run. Warning format: "W-TOKEN-01: Round N consumed X tokens (budget Y). Slots: slot1=A, slot2=B". No blocking — warn only, consistent with fail-open R6 policy. Depends on token observability (table stakes) being in place first. |
| Benched slot warm-up suppression: skip health_check for benched slots, reducing pre-quorum latency | quorum.md pre-flight currently probes all providers then benches overflow slots. The health_check calls for benched slots consume tokens and add latency for slots that will never be called this round. With token observability surfacing this overhead, suppressing warm-up for benched slots is a natural optimization. | LOW | After `preferSub` sort and cap to active slots, skip provider health_check for benched slots entirely. Benched slots are recorded in the "Benched (backup pool)" log line but not probed. Only dispatch health_check to active slots. Fallback: if an active slot goes UNAVAIL mid-round, pick from benched pool without pre-flight (fail-open). This requires no config change — benching decision already happens before health_check in current quorum.md flow. |
| Envelope diff mode: only re-read full PLAN.md if envelope indicates structural changes since last quorum round | In multi-round deliberation, slot-workers already use `skip_context_reads: true` for Round 2+. The task envelope extends this to Round 1 re-reads: if the envelope `checksum` field matches the previous round's envelope checksum, workers can skip the full PLAN.md read and rely on envelope alone. Reduces per-round overhead for stable plans in deliberation. | MEDIUM | Add `checksum` field to task envelope (SHA-256 of PLAN.md content, hex). Slot-workers compare incoming envelope checksum against their locally cached checksum from Round 1. Match = skip PLAN.md re-read. Mismatch = full re-read. This requires the slot-worker agent to cache the checksum in its local state across rounds — implementable via the YAML block `prior_positions` mechanism already used for deliberation. |

---

### Anti-Features (Commonly Requested, Often Problematic)

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|-----------------|-------------|
| Token quota hard blocks (stop quorum if budget exceeded) | "Prevent runaway costs" | Hard blocking on token budget creates deadlocks in the autonomous milestone loop — a critical phase could be blocked mid-execution because it hit the token threshold. This violates R6 fail-open policy. Quorum is enforcement infrastructure; blocking it defeats its purpose. | Warn-only token budget alerts (differentiator above). Log to /qgsd:health. Let the user decide to cancel, not the system. |
| Per-slot model override for cost (e.g., use claude-haiku for claude-1 instead of claude-mcp-server's configured model) | "Force cheap models on all workers" | claude-mcp-server instances are pre-configured with specific models (DeepSeek-V3.2, MiniMax-M2.5, etc.) through providers.json and AkashML/Together/Fireworks routing. Overriding their model from within QGSD would require adding a model-swap call before each slot invocation, adding latency and coupling QGSD to provider-specific model APIs. | tiered model sizing policy applies only to the Claude-orchestrated sub-agents (researcher, checker, slot-workers). External CLI slots use whatever model their provider is configured for. |
| Context compression/summarization between stages (lossy) | "Compress RESEARCH.md down to 500 tokens automatically" | Lossy summarization of research removes details the planner may need. Underspecified plans cause failed quorums and re-planning cycles that cost more tokens than the initial savings. The correct answer is a structured extract (task envelope), not lossy compression. | Compact task envelope (table stakes) — structured JSON with explicit fields, lossless for the key decision data (decisions, constraints, req_ids), omitting only narrative prose that sub-agents do not need to act on. |
| Streaming token accounting (real-time counter in quorum output) | "Show me tokens consumed as each slot responds" | Claude Code Task() calls are non-streaming from the orchestrator's perspective — they return after completion. There is no hook point to display incremental token counts during a worker wave. Implementing a polling mechanism would require background Bash processes and custom IPC. | End-of-round token summary appended to the consensus output: "Round N: X total tokens (slot1=A, slot2=B, ...)" — already surfaceable from quorum-token-log.jsonl after the round barrier closes. |
| Replacing quorum with a single high-quality model for low-risk tasks | "Skip quorum entirely on low-risk — just use one model" | Quorum is enforced by the Stop hook (qgsd-stop.js) which reads the JSONL transcript. Bypassing quorum is architecturally impossible without modifying the stop hook — which is the security guarantee QGSD provides. Adaptive fan-out (1 external worker for low-risk) already addresses the cost concern without removing the consensus gate. | Adaptive fan-out with risk_level=low dispatches 1 external worker + Claude. Consensus of 2 models still satisfies R3.5 minimum quorum. Same enforcement guarantee; lower token cost. |

---

## Feature Dependencies

```
[Token observability: quorum-token-log.jsonl writes per slot call]
    └──required by──> [Token budget alerts in /qgsd:health]
    └──required by──> [/qgsd:health token usage section]
    └──provides data for──> [Benched slot warm-up suppression metrics]

[Adaptive quorum fan-out: risk_level → worker count]
    └──reads from──> [quorum.riskFanOut config in qgsd.json]
    └──modifies──> [quorum.md pre-flight slot selection: sort → cap → bench]
    └──requires no change to──> [slot-worker dispatch protocol (YAML block unchanged)]
    └──orthogonal to──> [Task envelope: different optimization dimension]

[Tiered model sizing: haiku for workers, sonnet for planner]
    └──enforces in──> [quorum.md Task dispatch: model="haiku" (already correct)]
    └──enforces in──> [plan-phase.md researcher Task spawn: model="haiku"]
    └──enforces in──> [plan-phase.md checker Task spawn: model="haiku"]
    └──adds to──> [gsd-tools.cjs INIT JSON: model_tier field]
    └──independent of──> [Token observability, adaptive fan-out, task envelope]

[Compact context handoffs: task envelope JSON schema]
    └──generated by──> [qgsd-phase-researcher sub-agent at step end]
    └──consumed by──> [qgsd-planner sub-agent: reads envelope instead of full RESEARCH.md]
    └──generated by──> [qgsd-planner sub-agent at step end]
    └──consumed by──> [quorum slot-workers: reads envelope instead of full PLAN.md by default]
    └──enables──> [Envelope diff mode differentiator (checksum comparison)]
    └──requires changes to──> [plan-phase.md Steps 5/8/8.5: envelope write/read instructions]
    └──requires changes to──> [qgsd-phase-researcher agent: envelope write at completion]
    └──requires changes to──> [qgsd-planner agent: envelope write at completion]
    └──requires changes to──> [quorum slot-worker YAML block: new optional envelope field]
```

### Dependency Notes

- **Token observability is the foundation for budget alerts.** Budget alerts cannot fire without token data being logged. Ship observability before alerts — they are in separate phases.
- **Adaptive fan-out is independent of the envelope.** Fan-out changes the worker count selection step (pre-flight); the envelope changes what context workers receive. No coupling. Can be implemented in parallel phases if desired.
- **Tiered model sizing has zero new dependencies.** It enforces an existing pattern (quorum.md already uses model="haiku") across additional spawn sites. It is the lowest-risk feature to ship first.
- **Task envelope has the most integration surface.** It touches researcher agent, planner agent, slot-worker YAML protocol, and plan-phase.md orchestration. Ship last among table stakes, or in a phase where only one boundary (research→plan OR plan→quorum) is addressed at a time.
- **Envelope diff mode (differentiator) requires the envelope (table stakes) to exist first.** No checksum to compare without the envelope being written in a prior step.

---

## MVP Definition

### Launch With (v0.18 table stakes — minimum for milestone credibility)

The milestone title "Token Efficiency" requires at minimum: measurement (observability), worker scaling (adaptive fan-out), and cost-per-stage reduction (tiered sizing). The task envelope is the largest effort but also the highest token reduction potential.

- [x] **Tiered model sizing** — enforce haiku for researcher/checker, sonnet for planner only; ship first because it has zero new infrastructure
- [x] **Adaptive quorum fan-out** — risk_level → worker count config; extends existing max_quorum_size mechanism
- [x] **Token observability** — quorum-token-log.jsonl writes, /qgsd:health token section; necessary for measuring the other features' impact
- [x] **Compact context handoffs (task envelope)** — JSON schema, researcher/planner write, slot-workers read; highest token savings, most integration work

### Add After Validation (v0.18.x differentiators)

- [ ] **Token budget alerts** — depends on observability; add once baseline token data is established and the typical round cost is known
- [ ] **Benched slot warm-up suppression** — low effort, low risk; add when adaptive fan-out confirms benching behavior is reliable
- [ ] **Envelope diff mode** — add after envelope has been in use for 1-2 milestones and skip_context_reads pattern is proven

### Future Consideration (v0.19+)

- [ ] **Cross-session token trend analysis** — aggregate quorum-token-log.jsonl over multiple sessions; requires persistence strategy; deferred to v0.19 tooling milestone
- [ ] **Provider-level token cost mapping** — map tokens to USD cost per provider (Together/Fireworks/AkashML pricing differs); requires price table maintenance; deferred

---

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority |
|---------|------------|---------------------|----------|
| Tiered model sizing | HIGH (15-20x cost reduction on researcher/checker) | LOW (enforce existing pattern at 2 spawn sites) | P1 |
| Adaptive quorum fan-out | HIGH (3-8x reduction on low/medium-risk quorums) | MEDIUM (risk_level derivation + config schema) | P1 |
| Token observability | HIGH (prerequisite for measuring all other features) | MEDIUM (log writes in call-quorum-slot.cjs + health display) | P1 |
| Compact context handoffs | HIGH (5-15x reduction on per-worker context per round) | HIGH (multi-agent protocol change; 4 integration points) | P2 |
| Token budget alerts | MEDIUM (visible warning; no cost reduction) | LOW (append warning to health output using log data) | P2 |
| Benched slot warm-up suppression | LOW (saves 1-4 health_check calls per quorum round) | LOW (filter benched slots before health_check loop) | P3 |
| Envelope diff mode | MEDIUM (skip full file re-read in deliberation rounds) | MEDIUM (checksum in envelope + slot-worker cache) | P3 |

**Priority key:**
- P1: Must have for launch (v0.18 table stakes)
- P2: Should have, add in v0.18.x
- P3: Nice to have, future consideration

---

## Detailed Feature Behavior

### Feature 1: Token Observability

**What production systems do:** Per-call token attribution is standard (Langfuse, Datadog LLM, Braintrust all track `tokens_in`, `tokens_out`, `latency_ms`, `model`, `agent_id` per call). The QGSD-specific version needs to fit the existing quorum architecture: each slot call goes through `call-quorum-slot.cjs` → CLI subprocess → response text. Token count is available in the provider's API response but is not currently extracted or logged.

**Expected behavior in QGSD:**
- After each slot call completes, `call-quorum-slot.cjs` extracts token usage from the response (if the provider returns it in a parseable format — provider-specific: Together/Fireworks return usage in JSON response body; CLI-based slots like gemini-cli/codex-cli return output text only, no token metadata — mark as "unknown" in log)
- Append one JSON line to `.planning/quorum-token-log.jsonl`:
  ```json
  {"ts":"2026-02-27T10:00:00Z","round":1,"slot":"claude-1","model":"deepseek-ai/DeepSeek-V3.2","tokens_in":2847,"tokens_out":312,"latency_ms":4200,"task":"plan-ph18"}
  ```
- `/qgsd:health` reads the last N entries (default: last 10 quorum rounds) and appends a "Token Usage" section:
  ```
  ## Token Usage (last 10 rounds)
  Total: 42,103 tokens in / 3,847 tokens out
  Highest consumer: claude-3 (qwen-coder) — 8,201 tokens in (avg per round)
  Last quorum: plan-ph18-01 — 14,203 tokens in / 1,842 tokens out
  ```
- Log file is gitignored (disk-only, same pattern as quorum-scoreboard.json)
- No token data available for CLI-based slots (gemini-cli, codex-cli, opencode-cli, copilot-cli) — these go through subprocess text capture only; log `tokens_in: null, tokens_out: null` for these

**Table stakes because:** Without measurement, "token efficiency" is an unverified claim. The log must exist before budget alerts can fire. The health display closes the feedback loop for users.

**QGSD-specific complexity note:** HTTP providers (claude-mcp-server instances: claude-1..6) expose token counts in their response bodies via the Anthropic API `usage` field. CLI providers (gemini-1, codex-1, opencode-1, copilot-1) do not — their output is plain text. The implementation must handle the asymmetry: log `null` for CLI providers rather than failing or skipping the log entry.

---

### Feature 2: Adaptive Quorum Fan-Out

**What production systems do:** Risk-based routing is the dominant cost optimization strategy (requesty.ai, futureagi.com, mindstudio.ai). Low-stakes queries → cheap/fast path; high-stakes queries → expensive/thorough path. The router uses task metadata to classify risk level before dispatching.

**Expected behavior in QGSD:**

The quorum.md `max_quorum_size` mechanism already caps workers. Adaptive fan-out extends this with a contextual default that varies by `risk_level`:

```
risk_level=low    → max_quorum_size override = 2  (Claude + 1 external worker)
risk_level=medium → max_quorum_size override = 4  (Claude + 3 external workers)
risk_level=high   → max_quorum_size override = 6  (Claude + 5 external workers)
```
(One extra than the riskFanOut values because Claude counts as +1 per existing convention.)

`risk_level` is determined by the calling context:
- `/qgsd:quick` tasks: `low` by default (quick decisions, exploratory questions)
- `/qgsd:plan-phase` for a phase tagged `type: minor` in ROADMAP.md: `medium`
- `/qgsd:plan-phase` for a phase tagged `type: major` or with >3 requirements: `high`
- `/qgsd:new-milestone` and `/qgsd:new-project`: `high` (roadmap-level decisions)
- `--risk-level <low|medium|high>` override flag on any quorum-triggering command
- Config default `quorum.defaultRiskLevel: "high"` (conservative fallback if unclassified)

**What changes in quorum.md:**
1. After reading `$QUORUM_ACTIVE` and building `$CLAUDE_MCP_SERVERS`, read `risk_level` from the calling context (passed as a field in the quorum dispatch YAML block or as a command flag)
2. Look up `riskFanOut[risk_level]` from qgsd.json (or use hardcoded defaults above if config absent)
3. Use `riskFanOut[risk_level]` as the effective `max_quorum_size` for this round, unless the global `max_quorum_size` is lower (global cap always wins — never exceed the global ceiling)
4. Continue with existing preferSub sort → cap → bench logic

**What does NOT change:**
- The YAML slot-worker prompt block format is unchanged
- Deliberation rounds always use the same worker count as Round 1 (no dynamic re-sizing mid-quorum)
- `max_quorum_size` in qgsd.json remains the absolute ceiling; riskFanOut is a contextual default below that ceiling
- R3.5 minimum quorum (Claude + 1 external) always applies regardless of risk_level

**Table stakes because:** Dispatching 5-8 workers for a simple quick-task question is the dominant token waste in QGSD. This directly addresses the cost per quorum round without changing the consensus guarantee.

---

### Feature 3: Tiered Model Sizing

**What production systems do:** Tiered model usage is the most documented LLM cost strategy (30-70% cost reduction confirmed by LLM routing platforms). Use the cheapest model that delivers acceptable quality for each stage. Claude Code official docs explicitly endorse: "For simple subagent tasks, specify model: haiku in your subagent configuration."

**Expected behavior in QGSD:**

Current state (partially correct):
- quorum slot-workers: model="haiku" — already correct in quorum.md
- qgsd-phase-researcher: model resolved from INIT JSON (`researcher_model` key) — may be sonnet
- qgsd-planner: model resolved from INIT JSON (`planner_model` key) — correctly sonnet
- qgsd-plan-checker: model resolved from INIT JSON (`checker_model` key) — may be sonnet

Target state after v0.18:
- quorum slot-workers: model="haiku" — no change (already correct)
- qgsd-phase-researcher: model="haiku" — researcher reads files and extracts facts; no frontier reasoning required
- qgsd-planner: model="sonnet" (or user-configured planner_model) — only stage requiring frontier reasoning; no change
- qgsd-plan-checker: model="haiku" — checker applies checklist criteria against plan text; no frontier reasoning required

**What changes:**
1. `gsd-tools.cjs init plan-phase` INIT JSON: add explicit `model_tier` field (`{ researcher: "haiku", planner: "sonnet", checker: "haiku", slot_worker: "haiku" }`) — default values, overridable by user config
2. `plan-phase.md` Step 5 researcher spawn: change from `model="{researcher_model}"` to `model="{model_tier.researcher}"` (defaults to haiku)
3. `plan-phase.md` Step 10 checker spawn: change from `model="{checker_model}"` to `model="{model_tier.checker}"` (defaults to haiku)
4. Add config keys `quorum.modelTiers.researcher`, `quorum.modelTiers.checker` to qgsd.json schema for override capability
5. Document the tier policy explicitly in quorum.md and plan-phase.md

**What does NOT change:**
- Planner model stays sonnet — this is the only stage where frontier reasoning quality directly determines plan correctness
- External CLI slots (claude-mcp-server instances) use their own configured models; QGSD does not override them
- The `model="haiku"` in quorum.md Task dispatch is unchanged (already correct)

**Table stakes because:** Researcher and plan-checker together run on every `plan-phase` invocation before quorum even starts. If either is using sonnet unnecessarily, the cost doubles before the quorum fan-out even matters. This is the most direct token reduction with the lowest implementation risk.

**Complexity note:** LOW. The only change is substituting the model= value at two Task spawn sites in plan-phase.md and updating the INIT JSON schema. No new protocols. No new files. The existing `researcher_model`/`checker_model` config keys become legacy aliases that the new `model_tier` config overrides.

---

### Feature 4: Compact Context Handoffs (Task Envelope)

**What production systems do:** Context compression between agent stages is a recognized production challenge. The 2025 research direction (ACON arxiv 2510.00615; Azure SRE agent context engineering; IETF ADOL draft) is structured extraction rather than lossy summarization. The key insight: downstream agents don't need the narrative prose in a RESEARCH.md — they need the decisions, constraints, and requirement IDs. Replacing a full markdown file re-read with a compact structured JSON handoff reduces context from ~5K tokens to ~300 tokens per boundary crossing.

**Expected behavior in QGSD:**

**Task envelope schema:**
```json
{
  "schema_version": 1,
  "generated_by": "qgsd-phase-researcher | qgsd-planner",
  "phase": "v0.18-01",
  "timestamp": "2026-02-27T10:00:00Z",
  "checksum": "sha256-of-source-file-hex",
  "risk_level": "medium",
  "summary": "Two-sentence summary of what was decided.",
  "key_decisions": [
    "Use quorum-token-log.jsonl for token storage (disk-only, gitignored)",
    "Log null for CLI slots lacking token metadata"
  ],
  "constraints": [
    "No changes to quorum YAML block format (additive only)",
    "Gitignore token log — same pattern as quorum-scoreboard.json"
  ],
  "open_questions": [],
  "req_ids": ["TOK-01", "TOK-02", "FAN-01"],
  "wave_count": 3,
  "plan_count": 4,
  "source_path": ".planning/phases/v0.18-01/v0.18-01-RESEARCH.md"
}
```

Two envelope variants:
1. **Research envelope** — written by qgsd-phase-researcher at end of research step; consumed by qgsd-planner
2. **Plan envelope** — written by qgsd-planner at end of planning step; consumed by quorum slot-workers

**Integration points (all must change together for the feature to work):**

1. `qgsd-phase-researcher` agent — append envelope write instructions at completion: extract key_decisions and constraints from RESEARCH.md, write `<phase>-RESEARCH-ENVELOPE.json` to phase dir
2. `plan-phase.md` Step 8 (planner spawn) — pass `research_envelope_path` instead of `research_path` as primary context; keep `research_path` as fallback if envelope absent
3. `qgsd-planner` agent — read envelope at start (fast, small context); read full RESEARCH.md only if `--detail` mode requested or envelope is absent; write `<phase>-PLAN-ENVELOPE.json` at completion
4. `quorum.md` slot-worker YAML block — add optional `envelope_path` field; if present, workers read envelope before (or instead of) full PLAN.md
5. `qgsd-quorum-slot-worker` agent — if `envelope_path` is present in YAML: read envelope, skip PLAN.md read unless worker explicitly decides it needs detail; if absent, current behavior unchanged

**What does NOT change:**
- Full RESEARCH.md and PLAN.md files still exist on disk — envelope is supplemental, not replacement
- Quorum can still read full PLAN.md by explicit choice; envelope just removes the default "read everything" behavior
- Existing quorum YAML block fields (artifact_path, review_context, etc.) are preserved; envelope_path is additive

**Fail-open:** If envelope file is absent or malformed (JSON parse error), agents fall back to reading the full markdown file. Envelope is an optimization, not a hard requirement. This is consistent with R6 fail-open policy.

**Table stakes because:** Each quorum round with N workers re-reads the same PLAN.md N times. At N=5 workers, a 500-line PLAN.md consumed 5 times per round is the single largest token expenditure in a typical quorum cycle. The envelope replaces N full re-reads with N envelope reads + at most 1-2 selective full reads by workers who need detail.

**HIGH complexity note:** This feature modifies the contract between researcher, planner, and quorum slot-workers. All three agents must be updated in a coordinated way — an incomplete rollout (envelope written but not read, or read but not written) creates a silent degradation. Recommend shipping as a single coordinated phase with end-to-end testing: researcher writes envelope → planner reads envelope → quorum slot-workers read envelope → verify token count reduction via quorum-token-log.jsonl.

---

## Phase Split Recommendation

**Phase v0.18-01: Tiered model sizing + adaptive fan-out config schema**
Rationale: Both are configuration-level changes with low integration surface. Tiered sizing modifies 2 spawn sites; adaptive fan-out adds a config key and modifies the slot selection logic in quorum.md. No new files, no new protocols. Ship these together as the fast wins — they deliver measurable token reduction with low regression risk.
Complexity: LOW-MEDIUM total. Estimated 2-3 plans.

**Phase v0.18-02: Token observability (quorum-token-log.jsonl + /qgsd:health display)**
Rationale: Depends on nothing from Phase 1. Requires changes to call-quorum-slot.cjs (token extraction from provider responses), quorum-token-log.jsonl write logic, and health.md display. Ship after Phase 1 so the health output can show the impact of Phase 1's changes.
Complexity: MEDIUM. Estimated 2-3 plans.

**Phase v0.18-03: Compact context handoffs (task envelope)**
Rationale: Highest integration surface, depends on Phases 1-2 for measurement of impact. Ship last so the full token reduction can be verified end-to-end using the observability from Phase 2.
Complexity: HIGH. Estimated 4-5 plans.

**Differentiators (v0.18.x post-validation):**
- Token budget alerts (LOW effort — depends on Phase 2 data)
- Benched slot warm-up suppression (LOW effort — modifies quorum.md pre-flight)
- Envelope diff mode (MEDIUM effort — depends on Phase 3 envelope being in place)

---

## Competitor Feature Analysis

| Feature | LangChain/LangSmith | LiteLLM | QGSD v0.18 Approach |
|---------|---------------------|---------|---------------------|
| Per-agent token tracking | Full trace-level breakdown with cost attribution | Per-key and per-user tracking with daily breakdowns | quorum-token-log.jsonl: slot-level attribution, surfaced in /qgsd:health; CLI slots log null (no token metadata from subprocess) |
| Risk-based routing | Query complexity classifier → model router | Confidence threshold escalation | risk_level field derived from command context (quick vs plan-phase vs new-milestone); config-driven fan-out table |
| Tiered model sizing | Explicit "use gpt-4o-mini for classification, gpt-4o for generation" | Model routing with complexity thresholds | haiku for researcher/checker/slot-workers; sonnet for planner only; existing quorum.md already correct |
| Context compression | ACON gradient-free compression; session summarization | Prompt caching, semantic caching | Structured task envelope JSON (lossless for decisions/constraints, drops narrative prose) |

---

## Sources

- `/Users/jonathanborduas/code/QGSD/commands/qgsd/quorum.md` — PRIMARY SOURCE. Full inline quorum protocol; `max_quorum_size` mechanism; `preferSub` sorting; slot-worker YAML block format; pre-flight logic; benched pool pattern. Adaptive fan-out extends these.
- `/Users/jonathanborduas/code/QGSD/qgsd-core/workflows/plan-phase.md` — PRIMARY SOURCE. Steps 5/8/8.5/10 researcher/planner/checker spawn points; model= field; files_to_read blocks that envelope will optimize.
- `/Users/jonathanborduas/code/QGSD/.planning/PROJECT.md` — PRIMARY SOURCE. v0.18 target features; existing feature list; constraints (no GSD source modification, global install pattern).
- `/Users/jonathanborduas/code/QGSD/bin/call-quorum-slot.cjs` — PRIMARY SOURCE. HTTP provider dispatch path; token extraction will go here; failure log pattern.
- `/Users/jonathanborduas/code/QGSD/qgsd-core/workflows/health.md` — PRIMARY SOURCE. Warning/error/info code format (W-xxx, E-xxx, I-xxx); token usage section must follow existing output format.
- [Claude Code Manage Costs Documentation](https://code.claude.com/docs/en/costs) — HIGH confidence. Official docs confirm: model="haiku" for subagents is the endorsed pattern; Task() spawns have per-model token cost; /cost shows session totals; agent teams ~7x more tokens than standard sessions.
- [Langfuse Token and Cost Tracking](https://langfuse.com/docs/observability/features/token-and-cost-tracking) — MEDIUM confidence. Per-call token attribution in production observability; trace-level cost breakdown. Confirms table-stakes status of per-agent token tracking.
- [LLM Cost Optimization Guide 2025 — futureagi.com](https://futureagi.com/blogs/llm-cost-optimization-2025) — MEDIUM confidence. 30-70% cost reduction via routing; tiered model usage confirmed as primary strategy.
- [ACON: Optimizing Context Compression for Long-horizon LLM Agents — arXiv 2510.00615](https://arxiv.org/abs/2510.00615) — MEDIUM confidence. Gradient-free context compression framework; confirms structured extraction over lossy summarization as the correct direction.
- [A Token-efficient Data Layer for Agentic Communication — IETF draft-chang-agent-token-efficient-01](https://datatracker.ietf.org/doc/html/draft-chang-agent-token-efficient-01) — MEDIUM confidence. Schema deduplication via JSON $ref; adaptive field inclusion; confirms structured envelope approach.
- [Context Engineering for Reliable AI Agents — Azure SRE Agent blog, Microsoft](https://techcommunity.microsoft.com/blog/appsonazureblog/context-engineering-lessons-from-building-azure-sre-agent/4481200/) — MEDIUM confidence. Context as first-class engineering concern; structured state handoff between agent stages.
- [Intelligent LLM Routing in Enterprise AI — requesty.ai](https://www.requesty.ai/blog/intelligent-llm-routing-in-enterprise-ai-uptime-cost-efficiency-and-model) — LOW confidence (WebSearch summary only). Risk-based routing for uptime + cost efficiency; confirms quorum fan-out as a routing problem.
- [Best AI Model Routers for Multi-Provider LLM Cost Optimization — mindstudio.ai](https://www.mindstudio.ai/blog/best-ai-model-routers-multi-provider-llm-cost-011e6) — LOW confidence (WebSearch summary only). Router pattern: cheap model for classification, expensive model for generation. Directly maps to QGSD's adaptive fan-out design.

---

*Feature research for: QGSD v0.18 — Token Efficiency (4 table-stakes features + 3 differentiators)*
*Researched: 2026-02-27*
