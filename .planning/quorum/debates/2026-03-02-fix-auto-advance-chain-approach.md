# Quorum Debate
Question: Which approach should we use to fix auto-advance not continuing to the next phase: Option A (plan-phase continues chain itself via tail-call Skill invocation), Option B (top-level loop orchestrator), or Option C (execute-phase returns structured result, caller loops)?
Date: 2026-03-02
Consensus: APPROVE
Rounds: 2

## Round 1
| Model | Position | Citations |
|---|---|---|
| Claude | Option A — tail-call Skill invocation from plan-phase. Smallest change, each Skill invocation creates new context. | plan-phase.md:671-681 (return handler prints "Next:" instead of invoking) |
| codex-1 | UNAVAIL | — |
| opencode-1 (T1 fallback) | Option C — structured return + caller loop. Maintains orchestrator's lean context, no nested Tasks. | plan-phase.md:659-669, execute-phase.md:514-542 |
| gemini-1 | UNAVAIL | — |
| copilot-1 (T1 fallback) | UNAVAIL | — |
| claude-1 (T1 fallback) | Option C — leverages STATE.md re-entrancy pattern, least invasive, maintains separation of concerns. | plan-phase.md:659-669, execute-phase.md:514-541, PROJECT.md:77-84 |
| claude-2 (T1 fallback) | UNAVAIL | — |

## Round 2
| Model | Position | Citations |
|---|---|---|
| Claude | Updated to Option C — Option A still executes inside the Task (nested), while Option C returns structured data to the top-level caller, keeping the chain flat. | execute-phase.md:514-537, plan-phase.md:671-681 |

## Outcome
Consensus on Option C: execute-phase returns structured result (PHASE_COMPLETE + next_phase identifier), plan-phase parses the return and invokes Skill(plan-phase NEXT --auto) at the top level. Two changes needed: (1) execute-phase offer_next returns structured signal instead of running transition inline, (2) plan-phase return handler invokes next plan-phase instead of printing "Next: ...". This keeps the chain flat with no nested Tasks.
