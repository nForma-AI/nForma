---
phase: solve-ft-batch-2-3
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - .planning/formal/generated-stubs/CI-05.stub.test.js
  - .planning/formal/generated-stubs/CI-06.stub.test.js
autonomous: true
requirements: [CI-05, CI-06]
formal_artifacts: none
---

<objective>
Implement 2 test stubs for CI requirements.

For each stub, read its recipe JSON for pre-resolved context, then replace
assert.fail('TODO') with real test logic using node:test + node:assert/strict.

Formal context:
- CI-05: model=.planning/formal/alloy/ci-quality-gates.als property=GateStatus text="Linting and formatting checks run in CI and block merge on violations"
  recipe=.planning/formal/generated-stubs/CI-05.stub.recipe.json
- CI-06: model=.planning/formal/alloy/ci-quality-gates.als property=GateStatus text="Type checking runs in CI and blocks merge on type errors"
  recipe=.planning/formal/generated-stubs/CI-06.stub.recipe.json
</objective>

<tasks>
<task type="auto">
  <name>Implement stubs: CI-05, CI-06</name>
  <files>.planning/formal/generated-stubs/CI-05.stub.test.js, .planning/formal/generated-stubs/CI-06.stub.test.js</files>
  <action>
For each stub:
1. Read .planning/formal/generated-stubs/{ID}.stub.recipe.json
2. Read the stub file (.stub.test.js)
3. Use recipe.formal_property.definition as the property under test
4. Import from recipe.import_hint (adjust relative path if needed)
5. Follow recipe.test_strategy:
   - structural: assert function/export exists with correct signature
   - behavioral: call function with known input, assert output matches formal property
   - constant: assert code constant === formal value from property definition
6. If recipe.source_files is empty, use Grep to find the implementing module
7. Replace assert.fail('TODO') with real test logic using node:test + node:assert/strict
  </action>
  <verify>node --test .planning/formal/generated-stubs/CI-05.stub.test.js .planning/formal/generated-stubs/CI-06.stub.test.js</verify>
  <done>No assert.fail('TODO') remains. Each stub has real test logic.</done>
</task>
</tasks>
