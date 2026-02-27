# Requirements: QGSD v0.18 Token Efficiency

**Defined:** 2026-02-27
**Core Value:** Planning decisions are multi-model verified by structural enforcement, not instruction-following — a Stop hook that reads the transcript makes it impossible for Claude to skip quorum.

## v0.18 Requirements

Requirements for the Token Efficiency milestone. Goal: reduce QGSD's per-run token consumption (currently 380k+ tokens for a single Nyquist-class run) by establishing observability, enforcing tiered model sizing, introducing a structured context handoff, and making quorum fan-out risk-adaptive.

### Token Observability (OBSV)

- [ ] **OBSV-01**: User can see per-slot token consumption ranked by usage in `/qgsd:health` output
- [ ] **OBSV-02**: System appends a structured record to `.planning/token-usage.jsonl` after each quorum slot-worker completes (via `SubagentStop` hook reading `agent_transcript_path`)
- [ ] **OBSV-03**: Token records correctly attribute usage to named slot (`claude-1`, `gemini-1`, etc.) via correlation protocol written at dispatch time
- [ ] **OBSV-04**: CLI-based slots (gemini-1, codex-1) are logged with `tokens: null` — present in log, not omitted

### Tiered Model Sizing (TIER)

- [ ] **TIER-01**: Researcher sub-agent in `plan-phase.md` runs on `haiku` model by default
- [ ] **TIER-02**: Plan-checker sub-agent in `plan-phase.md` runs on `haiku` model by default
- [ ] **TIER-03**: User can override tier assignments via `model_tier_planner` / `model_tier_worker` flat keys in `qgsd.json`

### Task Envelope (ENV)

- [ ] **ENV-01**: After research completes, a `task-envelope.json` sidecar is written to `.planning/phases/<phase>/` with `objective`, `constraints`, `risk_level`, and `target_files`
- [ ] **ENV-02**: After planning completes, envelope is updated with `plan_path` and `key_decisions`
- [ ] **ENV-03**: `quorum.md` reads `risk_level` from envelope when available; fails open when envelope is absent
- [ ] **ENV-04**: Feature is gated by `task_envelope.enabled` in `qgsd.json` (default: `true` when v0.18-03 ships)

### Adaptive Fan-Out (FAN)

- [ ] **FAN-01**: Quorum dispatches 2 workers for `routine` risk_level tasks (vs current 8)
- [ ] **FAN-02**: Quorum dispatches 3 workers for `medium` risk_level tasks
- [ ] **FAN-03**: Quorum dispatches `max_quorum_size` workers for `high` risk_level tasks (unchanged behavior)
- [ ] **FAN-04**: Adaptive fan-out emits `--n N` so `qgsd-stop.js` verifies correct reduced count (R3.5 compliance)
- [ ] **FAN-05**: R6.4 reduced-quorum note emitted in output when fan-out is below `max_quorum_size`
- [ ] **FAN-06**: `--n N` user override takes highest precedence over all adaptive logic

## Future Requirements (v0.19+)

### Token Budget Alerts

- **BDGT-01**: System warns when a quorum round exceeds configurable token threshold (default 50k tokens)
- **BDGT-02**: Cross-session token trend analysis aggregates `token-usage.jsonl` over multiple sessions

### Envelope Enhancements

- **ENV-05**: Envelope diff mode — skip full PLAN.md re-read in deliberation rounds when envelope checksum matches prior round
- **ENV-06**: Benched slot warm-up suppression — skip `health_check` for slots not selected for this round

### Provider Cost Mapping

- **COST-01**: USD cost estimation per provider (Together.xyz / Fireworks / AkashML pricing table)

## Out of Scope

| Feature | Reason |
|---------|--------|
| Token quota hard blocks | Violates R6 fail-open; could deadlock critical phases mid-execution; warn-only is the correct policy |
| Per-slot model override for CLI slots (gemini-cli, codex-cli) | These use provider-configured models; QGSD does not control their model from within the pipeline |
| Lossy context compression (auto-summarization) | Structured extraction (task envelope) is correct; automatic summarization removes details the planner needs, causing failed quorums that cost more tokens than the savings |
| Bypassing quorum for low-risk tasks | Stop hook enforces quorum; bypassing would require modifying core enforcement guarantee; `routine` fan-out satisfies R3.5 minimum (Claude + 1 external) at lowest cost |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| OBSV-01 | Phase v0.18-01 | Pending |
| OBSV-02 | Phase v0.18-01 | Pending |
| OBSV-03 | Phase v0.18-01 | Pending |
| OBSV-04 | Phase v0.18-01 | Pending |
| TIER-01 | Phase v0.18-02 | Pending |
| TIER-02 | Phase v0.18-02 | Pending |
| TIER-03 | Phase v0.18-02 | Pending |
| ENV-01 | Phase v0.18-03 | Pending |
| ENV-02 | Phase v0.18-03 | Pending |
| ENV-03 | Phase v0.18-03 | Pending |
| ENV-04 | Phase v0.18-03 | Pending |
| FAN-01 | Phase v0.18-04 | Pending |
| FAN-02 | Phase v0.18-04 | Pending |
| FAN-03 | Phase v0.18-04 | Pending |
| FAN-04 | Phase v0.18-04 | Pending |
| FAN-05 | Phase v0.18-04 | Pending |
| FAN-06 | Phase v0.18-04 | Pending |

**Coverage:**
- v0.18 requirements: 17 total
- Mapped to phases: 17
- Unmapped: 0 ✓

---
*Requirements defined: 2026-02-27*
*Last updated: 2026-02-27 after initial definition*
