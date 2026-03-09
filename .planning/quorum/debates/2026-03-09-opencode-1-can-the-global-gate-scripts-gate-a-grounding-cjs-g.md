---
date: 2026-03-09
question: "Can the global gate scripts (gate-a-grounding.cjs, gate-b-abstraction.cjs, gate-c-validation.cjs) and their output directory (.planning/formal/gates/) be safely removed in favor of the per-model gate system (compute-per-model-gates.cjs)?"
slot: opencode-1
round: 2
mode: "A"
verdict: CONDITIONAL YES — The global gate scripts (gate-a-grounding.cjs, gate-b-abstraction.cjs, gate-c-validation.cjs) and their output directory (.planning/formal/gates/) CAN be safely removed in favor of the per-model gate system (compute-per-model-gates.cjs), but only after adding an --aggregate mode to compute-per-model-gates.cjs that produces continuous scores and diagnostic details matching what nf-solve.cjs and cross-layer-dashboard.cjs expect from the global gate JSON files.

citations:
- bin/n
matched_requirement_ids: [UPPAAL-03, UPPAAL-01, GATE-02, GATE-04, SOLVE-05, TRACE-01, TRACE-04, TRACE-05, TRIAGE-01, UPPAAL-02, CALIB-04, EVID-04, GATE-01, INST-11, SCBD-01, SCHEMA-01, SCHEMA-03, SENS-01, SOLVE-11, TRACE-02]
artifact_path: ""
---

# Debate Trace: opencode-1 on round 2

## Reasoning
CONDITIONAL YES — The global gate scripts (gate-a-grounding.cjs, gate-b-abstraction.cjs, gate-c-validation.cjs) and their output directory (.planning/formal/gates/) CAN be safely removed in favor of the per-model gate system (compute-per-model-gates.cjs), but only after adding an --aggregate mode to compute-per-model-gates.cjs that produces continuous scores and diagnostic details matching what nf

## Citations
(none)
