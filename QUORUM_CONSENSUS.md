# QGSD Quorum Consensus - Formal Verification of Agent Transitions

## Question
What formalism could we use to verify that all transitions are logically sound between our agents in the QGSD state machine — acknowledging Claude Code won't follow them exactly, but wanting the system to be "close" to a verified design?

## Consensus Answer
A hybrid formal verification approach that combines structural and probabilistic methods. Use Labeled Transition Systems (LTS) or Statecharts to model the deterministic control structure of the QGSD state machine, augmented with probabilistic extensions (MDPs/POMDPs) to account for uncertainty in agent behavior. Apply temporal logic (LTL/CTL) for safety and liveness properties, with probabilistic temporal logic (PCTL) for quantitative bounds. Verify the design using model checkers like PRISM or NuSMV, and complement with runtime verification techniques including trace alignment and conformance testing to ensure deployed agents remain "close" to the verified design.

## Supporting Positions
- Claude: Probabilistic model checking (MDPs/POMDPs) with temporal logic (CTL/PCTL) for quantitative verification
- OpenCode: Model checking with probabilistic extensions (PRISM), LTL, conformance testing with trace alignment
- Copilot: Hybrid formalism: model control structure as hierarchical LTS/TLA+ for deterministic invariants and embed probabilistic choices as MDPs/POMDPs, expressing safety/liveness in LTL/CTL and quantitative bounds in PCTL. Verify design-time with NuSMV/PRISM (or Storm) and add runtime assertion checking plus trace-alignment/conformance testing.
- Claude-2: Labeled Transition Systems (LTS) augmented with probabilistic extensions, verified via CTL/LTL model checking, with runtime assertion checking as a practical complement for deployment

## Notes
Several providers were unavailable during this consensus round:
- Codex: Usage limit
- Gemini: Capacity limit
- Copilot: Timeout
- Claude-3: Timeout
- Claude-4: API error
- Claude-5: Timeout
- Claude-6: API error