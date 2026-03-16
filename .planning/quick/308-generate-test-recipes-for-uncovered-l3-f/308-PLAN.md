---
phase: 308-generate-test-recipes-for-uncovered-l3-f
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - .planning/formal/test-recipes/test-recipes.json
  - .planning/formal/reasoning/failure-mode-catalog.json
autonomous: true
requirements: []
formal_artifacts: none
---

<objective>
Improve Gate C test recipe coverage from 0.453 (87/192 validated) by generating failure mode entries and test recipes for uncovered formal models.

Root cause analysis:
- test-recipe-gen.cjs generates 123 recipes from the failure-mode-catalog.json
- failure-mode-catalog.json only contains 123 failure modes (all FSM transition-derived)
- Gate C checks ALL 192 formal models, but only 87 have matching test recipes
- 105 models (mostly Alloy structural checks) lack failure mode catalog entries entirely

Fix strategy:
1. Identify models without failure mode catalog entries
2. Generate synthetic failure mode entries for the highest-risk uncovered models (critical/high tier)
3. Run test-recipe-gen.cjs to regenerate recipes from the enriched catalog
</objective>

<tasks>
<task type="auto">
  <name>Generate failure modes for uncovered Alloy models</name>
  <files>.planning/formal/reasoning/failure-mode-catalog.json, .planning/formal/test-recipes/test-recipes.json</files>
  <action>
1. Read per-model-gates.json to identify the 105 models failing Gate C
2. Read failure-mode-catalog.json to see which models already have failure modes
3. For each uncovered model:
   a. Read the model file to extract the key property/assertion being checked
   b. Generate a failure mode entry with format: FM-{model-name}-OMISSION
   c. Classify risk tier based on per-model-gates stability_status and gate_maturity
4. Append new failure mode entries to failure-mode-catalog.json
5. Run test-recipe-gen.cjs to regenerate recipes from enriched catalog
  </action>
  <verify>node bin/test-recipe-gen.cjs should report more than 123 recipes</verify>
  <done>failure-mode-catalog.json enriched with entries for uncovered models; test-recipe-gen.cjs produces expanded recipe set</done>
</task>
</tasks>
