---
phase: quick-227
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - bin/gate-a-grounding.cjs
autonomous: true
requirements: []
formal_artifacts: none
---

<objective>
Fix Gate A grounding check to treat vocabulary entries with `classification: "observability"` or `classification: "instrumentation_gap"` as known non-FSM actions that are "explained" without requiring an XState event mapping.

Currently, `security_sweep` (classification: observability) and `undefined` (classification: instrumentation_gap) are in event-vocabulary.json but have `xstate_event: null`. The grounding check at Step 2 classifies them as `instrumentation_bug` because `mapToXStateEvent()` returns null. This inflates the unexplained count by ~8195 events.

The fix: after confirming an action is in the vocabulary (Step 1), check if its vocabulary entry has a non-FSM classification before attempting XState mapping (Step 2). If so, count as explained (methodology skip equivalent).
</objective>

<tasks>
<task type="auto">
  <name>Add non-FSM classification check to gate-a-grounding.cjs</name>
  <files>bin/gate-a-grounding.cjs</files>
  <action>
Between Step 1 (vocabulary check) and Step 2 (XState mapping), add a check:
1. Look up the vocabulary entry for the action
2. If the entry has `classification` equal to "observability" or "instrumentation_gap", count as explained and continue
3. This avoids hitting the no_xstate_map instrumentation_bug path for known non-FSM events
  </action>
  <verify>node bin/gate-a-grounding.cjs --json | node -e "const d=JSON.parse(require('fs').readFileSync('/dev/stdin','utf8')); console.log('instrumentation_bug:', d.unexplained_counts.instrumentation_bug); process.exit(d.unexplained_counts.instrumentation_bug < 100 ? 0 : 1)"</verify>
  <done>Gate A instrumentation_bug count drops from 8195 to near 0. security_sweep and undefined actions are explained as non-FSM.</done>
</task>
</tasks>
