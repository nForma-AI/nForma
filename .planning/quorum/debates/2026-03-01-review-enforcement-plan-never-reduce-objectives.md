# Quorum Debate
Question: Review enforcement plan for "never reduce objectives to match reality" todo — A+B hybrid approach (prompt rules + checker diff + R9 policy). Right scope? What's missing?
Date: 2026-03-01
Consensus: APPROVE
Rounds: 1

## Round 1
| Model | Position | Citations |
|---|---|---|
| Claude | Right scope. B is still LLM-semantic, not truly structural code. Missing generate-phase-spec.cjs coverage (.formal/spec/ mentioned in todo but not in plan). | plan-phase.md:249-251, verify-phase.md:76-85 |
| codex-1 (primary) | UNAVAIL (timeout) | -- |
| opencode-1 (T1 fallback for codex-1) | Approach appropriate. Redundant enforcement across agents. Gap: needs explicit criteria for what "weakening objectives" means to avoid interpretive ambiguity. | plan-phase.md:249-251 (phase_req_ids immutability), verify-phase.md:76-85 (must_haves derivation) |
| gemini-1 (primary) | UNAVAIL (timeout) | -- |
| copilot-1 (T1 fallback for gemini-1) | UNAVAIL (timeout) | -- |
| claude-1 (T2 fallback) | UNAVAIL (timeout) | -- |
| claude-3 (T2 fallback) | UNAVAIL (credit limit) | -- |
| claude-4 (T2 fallback for gemini-1) | Well-scoped but structurally incomplete. Detection (B) without prevention. Add pre-verification baseline capture from ROADMAP success_criteria at verify-phase entry point. | plan-phase.md:429-434 (revision loop), verify-phase.md:88-96 (must-haves verification) |

## Outcome
All three available models (Claude, opencode-1, claude-4) converge on APPROVE with enhancements. The A+B+C approach is the right scope and v0.22 deferral is correct. Three specific gaps identified:

1. **Define "weakening" explicitly** (opencode-1): Concrete criteria needed — relaxing thresholds, removing invariants, softening "must" to "should", reducing success criterion count.
2. **Pre-verification baseline capture** (claude-4): verify-phase.md should read ROADMAP success_criteria as immutable baseline BEFORE loading PLAN must_haves. Compare and flag deviations at entry — converts detection into prevention.
3. **Cover generate-phase-spec.cjs** (Claude): Truths fed to spec generation must match ROADMAP criteria. If truths are weakened in PLANs, TLA+ PROPERTY stubs inherit the weakness.
