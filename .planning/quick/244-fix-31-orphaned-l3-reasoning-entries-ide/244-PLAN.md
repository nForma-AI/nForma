---
phase: quick-244
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - .planning/formal/reasoning/failure-mode-catalog.json
  - .planning/formal/reasoning/hazard-model.json
  - .planning/formal/reasoning/risk-heatmap.json
autonomous: true
requirements: []
formal_artifacts: none
---

<objective>
Fix 31 orphaned L3 reasoning entries identified by Gate B by regenerating all
L3 reasoning artifacts (failure mode catalog, hazard model, risk heatmap)
from the current model registry and trace data, ensuring derived_from links
reference valid L2 semantics sources.
</objective>

<tasks>
<task type="auto">
  <name>Regenerate L3 reasoning artifacts</name>
  <files>.planning/formal/reasoning/</files>
  <action>
Run failure-mode-catalog.cjs, hazard-model.cjs, and risk-heatmap.cjs to
rebuild all L3 artifacts from current L2 semantics data. This ensures
derived_from links are valid and fresh.
  </action>
  <verify>Re-run gate-b scoring to verify orphaned count decreases</verify>
  <done>All L3 reasoning artifacts regenerated with valid L2 back-links</done>
</task>
</tasks>
