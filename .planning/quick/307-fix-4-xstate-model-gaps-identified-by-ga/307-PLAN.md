---
phase: 307-fix-4-xstate-model-gaps-identified-by-ga
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - .planning/formal/model-registry.json
autonomous: true
requirements: [UPPAAL-04, UPPAAL-05, TC-01, H2M-01]
formal_artifacts: none
---

<objective>
Fix 4 Gate A model gaps where formal models have no passing grounding traces.

Root cause analysis:
1. formalism-selection.als → references UPPAAL-04 which does NOT exist in requirements.json (phantom)
2. model-registry-parity.als → references UPPAAL-05 which does NOT exist in requirements.json (phantom)
3. v8-coverage-digest.als → references TC-01 (real) but no passing trace
4. hypothesis-measurement.als → references H2M-01 (real) but no passing trace

Fix strategy:
- For #1 and #2: Update model-registry.json to replace phantom requirement IDs with real ones:
  - formalism-selection.als: UPPAAL-04 → SCHEMA-03 (verification runners emit requirement_ids per formalism)
  - model-registry-parity.als: UPPAAL-05 → INTG-05 (model registry extended with gate fields per formalism)
- For #3 and #4: These have real requirements but lack grounding traces. The Gate A grounding check uses per-model evidence. Add requirement annotations (@requirement comments) to the Alloy models to enable traceability mapping, and ensure the model-registry entries have the correct requirement IDs to ground via unit test coverage paths.
</objective>

<tasks>
<task type="auto">
  <name>Fix phantom and ungrounded requirement mappings in model-registry.json</name>
  <files>.planning/formal/model-registry.json</files>
  <action>
1. Read .planning/formal/model-registry.json
2. Find the entry for formalism-selection.als and replace requirements: ["UPPAAL-04"] with requirements: ["SCHEMA-03"]
3. Find the entry for model-registry-parity.als and replace requirements: ["UPPAAL-05"] with requirements: ["INTG-05"]
4. Verify TC-01 and H2M-01 entries for v8-coverage-digest.als and hypothesis-measurement.als have correct requirement arrays
5. Write the updated model-registry.json
  </action>
  <verify>node -c to validate JSON syntax of model-registry.json; grep for UPPAAL-04 and UPPAAL-05 should return empty</verify>
  <done>All 4 models have valid, existing requirement IDs in model-registry.json</done>
</task>
</tasks>
