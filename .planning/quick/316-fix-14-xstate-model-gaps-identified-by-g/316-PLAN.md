---
phase: quick-316
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - .planning/formal/evidence/event-vocabulary.json
  - .planning/formal/gates/gate-a-grounding.json
autonomous: true
requirements: []
formal_artifacts: none
---

<objective>
Fix 14 XState model gaps identified by Gate A grounding check (score 0.926, target 0.8 — met).

Gate A reports 176/190 explained entries, with 14 model_gap events where XState replay fails.
These are models in the registry that lack proper conformance trace annotations or have
stale XState event mappings.

This is an incremental improvement task — Gate A target is already met.
</objective>

<tasks>
<task type="auto">
  <name>Identify and document model gap entries</name>
  <files>.planning/formal/gates/gate-a-grounding.json</files>
  <action>
1. Run gate-a-grounding.cjs with per-model-aggregate scope to identify the 14 model_gap entries
2. For each model_gap entry, check if it has proper xstate_event mappings in event-vocabulary.json
3. Add missing mappings to event-vocabulary.json for any actions not yet in the vocabulary
4. Re-run gate-a-grounding.cjs to verify improvement
  </action>
  <verify>node bin/gate-a-grounding.cjs --json | grep model_gap</verify>
  <done>Model gaps reduced, gate-a-grounding.json updated with improved score</done>
</task>
</tasks>
