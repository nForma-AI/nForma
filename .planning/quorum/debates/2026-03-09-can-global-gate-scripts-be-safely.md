# Quorum Debate
Question: Can the global gate scripts (gate-a-grounding.cjs, gate-b-abstraction.cjs, gate-c-validation.cjs) and their output directory (.planning/formal/gates/) be safely removed in favor of the per-model gate system (compute-per-model-gates.cjs)?
Date: 2026-03-09
Consensus: APPROVE
Rounds: 2

## Round 1
| Model | Position | Citations |
|---|---|---|
| Claude | YES — per-model can derive aggregates trivially | bin/gate-a-grounding.cjs, bin/compute-per-model-gates.cjs, bin/nf-solve.cjs |
| codex-1 | UNAVAIL (timeout) | — |
| opencode-1 (T1 fallback) | NO — global gates have unique aggregate scores, adapter logic needed | — |
| gemini-1 | UNAVAIL (auth error) | — |
| copilot-1 (T1 fallback) | UNAVAIL (timeout) | — |
| claude-1 (T2 fallback) | CONDITIONAL YES — need --aggregate mode; diagnostic fields not replicated | bin/gate-a-grounding.cjs, bin/nf-solve.cjs, bin/cross-layer-dashboard.cjs |

## Round 2
| Model | Position | Citations |
|---|---|---|
| Claude | CONDITIONAL YES — revised; need --aggregate mode before removal | bin/gate-a-grounding.cjs:8-18, bin/compute-per-model-gates.cjs:101-135, bin/nf-solve.cjs:2115-2221 |
| opencode-1 (T1 fallback) | CONDITIONAL YES — revised from NO; gap is bridgeable, global gate logic already exported as modules | bin/nf-solve.cjs:2123-2241, bin/cross-layer-dashboard.cjs:130-175, bin/gate-a-grounding.cjs:483 |
| claude-1 (T2 fallback) | CONDITIONAL YES — aggregate adapter required; boolean pass/fail destroys residual granularity | bin/gate-a-grounding.cjs:198-310, bin/compute-per-model-gates.cjs:101-135, bin/nf-solve.cjs:2133-2241 |

## Outcome
CONDITIONAL YES — all available models agree the global gates CAN be safely removed, but only after a migration:

1. Add `--aggregate` flag to `compute-per-model-gates.cjs` that runs the same trace-replay and classification logic, emitting continuous 0-1 scores + diagnostic breakdowns (unexplained_counts, orphaned_entries, gap lists)
2. Migrate 4 consumers: nf-solve.cjs sweep functions, cross-layer-dashboard.cjs collectGateData, run-formal-verify.cjs pipeline steps
3. Verify with existing gate tests against the new aggregate path
4. Only then delete gate-a-grounding.cjs, gate-b-abstraction.cjs, gate-c-validation.cjs, their test files, and .planning/formal/gates/

Key finding: per-model gates return boolean pass/fail only. nf-solve.cjs residual scoring uses Math.ceil((1-score)*10) which requires continuous 0-1 values — booleans would produce only 0 or 10, destroying score granularity.
