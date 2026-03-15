---
phase: quick-299
plan: 299
type: execute
wave: 1
depends_on: []
files_modified:
  - .planning/formal/model-registry.json
autonomous: true
requirements: [QUORUM-02, SAFE-01, SAFE-04, CRED-01, CRED-02, QUORUM-01]
formal_artifacts: none
---

<objective>
Add requirement mappings to 3 models in model-registry.json that Gate B identified as having no purpose backing (no requirements array).

Models:
1. .planning/formal/alloy/quorum-votes.als -> QUORUM-02, SAFE-01, SAFE-04 (from @requirement annotations in the .als file)
2. .planning/formal/petri/account-manager-petri-net.dot -> CRED-01, CRED-02 (OAuth credential pool management)
3. .planning/formal/petri/quorum-petri-net.dot -> QUORUM-01, QUORUM-02 (quorum voting FSM)
</objective>

<tasks>
<task type="auto">
  <name>Add requirements arrays to 3 orphaned models in model-registry.json</name>
  <files>.planning/formal/model-registry.json</files>
  <action>
For each of the 3 models, add a "requirements" array to their entry in model-registry.json:
1. quorum-votes.als: ["QUORUM-02", "SAFE-01", "SAFE-04"]
2. account-manager-petri-net.dot: ["CRED-01", "CRED-02"]
3. quorum-petri-net.dot: ["QUORUM-01", "QUORUM-02"]
  </action>
  <verify>node -e to confirm all 3 models now have non-empty requirements arrays</verify>
  <done>All 3 models have requirements arrays. Gate B score should improve from 0.969.</done>
</task>
</tasks>
