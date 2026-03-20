---
phase: quick-333
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - .planning/formal/model-registry.json
autonomous: true
requirements: []
formal_artifacts: update
---

<objective>
Add requirement mappings to 4 orphaned formal models in .planning/formal/model-registry.json that have no requirement backing (identified by Gate B, gate_b_score=0.9801, 4 orphaned_entries).

These 4 models are all quorum-related specs generated from src/machines/nf-workflow.machine.ts. Mapping them to existing requirements closes the Gate B gap and brings the score to 1.0 (target_met=true).
</objective>

<tasks>
<task type="auto">
  <name>Update model-registry.json requirements arrays for 4 orphaned quorum models</name>
  <files>.planning/formal/model-registry.json</files>
  <action>
Read .planning/formal/model-registry.json. Locate each of the 4 orphaned model entries (keyed by file path) and set their requirements arrays:

1. ".planning/formal/alloy/quorum-votes.als"
   requirements: ["SPEC-03", "COMP-01", "COMP-02", "SIG-04"]

2. ".planning/formal/prism/quorum.pm"
   requirements: ["SOLVE-21", "HEAL-01", "HEAL-02", "CALIB-01"]

3. ".planning/formal/tla/NFQuorum.tla"
   requirements: ["COMP-01", "COMP-02", "CONF-04", "HEAL-01", "SIG-04"]

4. ".planning/formal/tla/NFQuorum_xstate.tla"
   requirements: ["STOP-01", "STOP-06", "STOP-07", "DISP-08", "COMP-01"]

Also update the top-level "last_sync" field to the current ISO timestamp.
Do NOT change any other fields on any model entry.
  </action>
  <verify>
node << 'NF_EVAL'
const fs = require('fs');
const reg = JSON.parse(fs.readFileSync('.planning/formal/model-registry.json', 'utf8'));
const models = reg.models;
const targets = [
  ".planning/formal/alloy/quorum-votes.als",
  ".planning/formal/prism/quorum.pm",
  ".planning/formal/tla/NFQuorum.tla",
  ".planning/formal/tla/NFQuorum_xstate.tla"
];
let allOk = true;
for (const t of targets) {
  const m = models[t];
  if (!m || !m.requirements || m.requirements.length === 0) {
    console.log('FAIL: still orphaned:', t);
    allOk = false;
  } else {
    console.log('OK:', t, '->', m.requirements.join(', '));
  }
}
console.log(allOk ? 'VERIFICATION PASSED' : 'VERIFICATION FAILED');
NF_EVAL
  </verify>
  <done>All 4 model entries have non-empty requirements arrays. last_sync updated.</done>
</task>
</tasks>
