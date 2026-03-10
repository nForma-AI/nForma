---
phase: solve-ft-batch-2-1
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - .planning/formal/generated-stubs/UX-04.stub.test.js
  - .planning/formal/generated-stubs/UX-05.stub.test.js
  - .planning/formal/generated-stubs/UX-06.stub.test.js
  - .planning/formal/generated-stubs/REL-03.stub.test.js
  - .planning/formal/generated-stubs/REL-04.stub.test.js
autonomous: true
requirements: [UX-04, UX-05, UX-06, REL-03, REL-04]
formal_artifacts: none
---

<objective>
Implement 5 test stubs for UX and REL requirements.

For each stub, read its recipe JSON for pre-resolved context, then replace
assert.fail('TODO') with real test logic using node:test + node:assert/strict.

Formal context:
- UX-04: model=.planning/formal/alloy/ux-interaction-safety.als property=Bool text="Every user-initiated action produces immediate feedback (loading/disabled state) and completion feedback"
  recipe=.planning/formal/generated-stubs/UX-04.stub.recipe.json
- UX-05: model=.planning/formal/alloy/ux-interaction-safety.als property=Bool text="Destructive actions require explicit confirmation or provide undo"
  recipe=.planning/formal/generated-stubs/UX-05.stub.recipe.json
- UX-06: model=.planning/formal/alloy/ux-interaction-safety.als property=Bool text="Error messages are human-readable, explain what went wrong, and suggest a next step"
  recipe=.planning/formal/generated-stubs/UX-06.stub.recipe.json
- REL-03: model=.planning/formal/alloy/reliability-hardening.als property=Bool text="Failures in external services are caught and handled gracefully"
  recipe=.planning/formal/generated-stubs/REL-03.stub.recipe.json
- REL-04: model=.planning/formal/alloy/reliability-hardening.als property=Bool text="Long-running operations show progress indication and can be cancelled"
  recipe=.planning/formal/generated-stubs/REL-04.stub.recipe.json
</objective>

<tasks>
<task type="auto">
  <name>Implement stubs: UX-04, UX-05, UX-06, REL-03, REL-04</name>
  <files>.planning/formal/generated-stubs/UX-04.stub.test.js, .planning/formal/generated-stubs/UX-05.stub.test.js, .planning/formal/generated-stubs/UX-06.stub.test.js, .planning/formal/generated-stubs/REL-03.stub.test.js, .planning/formal/generated-stubs/REL-04.stub.test.js</files>
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
  <verify>node --test .planning/formal/generated-stubs/UX-04.stub.test.js .planning/formal/generated-stubs/UX-05.stub.test.js .planning/formal/generated-stubs/UX-06.stub.test.js .planning/formal/generated-stubs/REL-03.stub.test.js .planning/formal/generated-stubs/REL-04.stub.test.js</verify>
  <done>No assert.fail('TODO') remains. Each stub has real test logic.</done>
</task>
</tasks>
