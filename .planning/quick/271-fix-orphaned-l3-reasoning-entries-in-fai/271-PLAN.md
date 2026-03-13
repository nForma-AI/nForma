---
phase: quick-271
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - .planning/formal/reasoning/failure-mode-catalog.json
autonomous: true
requirements: [GATE-02]
formal_artifacts: update
---

<objective>
Fix 107+ orphaned L3 reasoning entries in failure-mode-catalog.json identified by Gate B.
Root cause: artifact paths used doubled "formal/" prefix and refs used comma-separated IDs
instead of array filter format that gate-b-abstraction.cjs can resolve.
</objective>

<tasks>
<task type="auto">
  <name>Fix artifact paths and ref formats in failure-mode-catalog.json</name>
  <files>.planning/formal/reasoning/failure-mode-catalog.json</files>
  <action>
1. Strip doubled "formal/" prefix from all derived_from artifact paths
2. Convert comma-separated requirement ID refs to array filter format (requirements[id=X])
3. Fix TLA+ L3 refs that crash gate-b JSON parser — redirect to valid L2 sources
4. For requirement IDs not present in requirements.json, redirect to invariant-catalog.json
  </action>
  <verify>node gate-b-abstraction.cjs --project-root=$(pwd) should show 0 orphaned entries</verify>
  <done>Gate B score = 100%, 0 orphaned entries</done>
</task>
</tasks>
