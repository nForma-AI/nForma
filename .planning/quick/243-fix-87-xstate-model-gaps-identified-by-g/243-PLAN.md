---
phase: quick-243
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - .planning/formal/semantics/observed-fsm.json
autonomous: true
requirements: []
formal_artifacts: none
---

<objective>
Fix 87 XState model gaps identified by Gate A grounding check by regenerating
the observed FSM from the current trace corpus. The model gaps occur because
the observed FSM was stale — generated from older trace data while per-model
gate scoring replays newer traces against it.
</objective>

<tasks>
<task type="auto">
  <name>Regenerate observed FSM from current trace corpus</name>
  <files>.planning/formal/semantics/observed-fsm.json</files>
  <action>
Run `node bin/observed-fsm.cjs` to rebuild the observed FSM from the current
conformance trace corpus. This dual-mode replay (per-event isolation +
per-session chains) will capture all transitions currently in the traces,
closing the model_gap between L1 evidence and L2 semantics.
  </action>
  <verify>Check that gate-a grounding score improves after regeneration</verify>
  <done>observed-fsm.json is freshly generated from current traces</done>
</task>
</tasks>
