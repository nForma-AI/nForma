---
phase: solve-ft-batch-2-2
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - .planning/formal/generated-stubs/SEC-05.stub.test.js
  - .planning/formal/generated-stubs/SEC-06.stub.test.js
  - .planning/formal/generated-stubs/SEC-07.stub.test.js
  - .planning/formal/generated-stubs/SEC-08.stub.test.js
autonomous: true
requirements: [SEC-05, SEC-06, SEC-07, SEC-08]
formal_artifacts: none
---

<objective>
Implement 4 test stubs for SEC requirements.

For each stub, read its recipe JSON for pre-resolved context, then replace
assert.fail('TODO') with real test logic using node:test + node:assert/strict.

Formal context:
- SEC-05: model=.planning/formal/alloy/security-hardening.als property=ScanResult text="Pre-commit hook runs secret scanning to block commits containing API keys, tokens, passwords"
  recipe=.planning/formal/generated-stubs/SEC-05.stub.recipe.json
- SEC-06: model=.planning/formal/alloy/security-hardening.als property=ScanResult text="CI pipeline runs deep secret scanning across full repo history on every PR"
  recipe=.planning/formal/generated-stubs/SEC-06.stub.recipe.json
- SEC-07: model=.planning/formal/alloy/security-hardening.als property=ScanResult text="All external input is validated and sanitized at system boundaries"
  recipe=.planning/formal/generated-stubs/SEC-07.stub.recipe.json
- SEC-08: model=.planning/formal/alloy/security-hardening.als property=ScanResult text="Dependencies are scanned for known vulnerabilities in CI"
  recipe=.planning/formal/generated-stubs/SEC-08.stub.recipe.json
</objective>

<tasks>
<task type="auto">
  <name>Implement stubs: SEC-05, SEC-06, SEC-07, SEC-08</name>
  <files>.planning/formal/generated-stubs/SEC-05.stub.test.js, .planning/formal/generated-stubs/SEC-06.stub.test.js, .planning/formal/generated-stubs/SEC-07.stub.test.js, .planning/formal/generated-stubs/SEC-08.stub.test.js</files>
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
  <verify>node --test .planning/formal/generated-stubs/SEC-05.stub.test.js .planning/formal/generated-stubs/SEC-06.stub.test.js .planning/formal/generated-stubs/SEC-07.stub.test.js .planning/formal/generated-stubs/SEC-08.stub.test.js</verify>
  <done>No assert.fail('TODO') remains. Each stub has real test logic.</done>
</task>
</tasks>
