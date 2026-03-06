---
phase: solve-ft-batch-1-6
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - .planning/formal/generated-stubs/MCP-06.stub.test.js
  - .planning/formal/generated-stubs/TRACE-01.stub.test.js
  - .planning/formal/generated-stubs/TRACE-02.stub.test.js
  - .planning/formal/generated-stubs/TRACE-03.stub.test.js
  - .planning/formal/generated-stubs/TRACE-04.stub.test.js
  - .planning/formal/generated-stubs/TRACE-05.stub.test.js
  - .planning/formal/generated-stubs/TRACE-06.stub.test.js
  - .planning/formal/generated-stubs/ANNOT-01.stub.test.js
  - .planning/formal/generated-stubs/ANNOT-02.stub.test.js
  - .planning/formal/generated-stubs/ANNOT-03.stub.test.js
  - .planning/formal/generated-stubs/ANNOT-04.stub.test.js
  - .planning/formal/generated-stubs/ANNOT-05.stub.test.js
  - .planning/formal/generated-stubs/DECOMP-01.stub.test.js
  - .planning/formal/generated-stubs/DECOMP-02.stub.test.js
  - .planning/formal/generated-stubs/DECOMP-03.stub.test.js
autonomous: true
requirements: [MCP-06, TRACE-01, TRACE-02, TRACE-03, TRACE-04, TRACE-05, TRACE-06, ANNOT-01, ANNOT-02, ANNOT-03, ANNOT-04, ANNOT-05, DECOMP-01, DECOMP-02, DECOMP-03]
formal_artifacts: none
---

<objective>
Implement 15 test stubs for batch 6.

For each stub, read the formal model and requirement text, then replace
assert.fail('TODO') with real test logic using node:test + node:assert/strict.

Formal context:
- MCP-06: model=.planning/formal/alloy/mcp-detection.als property=MCPServer text="Stop hook matches tool_use names by prefix (e.g. `mcp__codex-cli__` matches both `mcp__codex-cli__codex` and `mcp__codex"
- TRACE-01: model=.planning/formal/alloy/traceability-annotations.als property=ModelType text="`bin/generate-traceability-matrix.cjs` reads model-registry, requirements.json, and check-results.ndjson to produce `.pl"
- TRACE-02: model=.planning/formal/alloy/traceability-annotations.als property=ModelType text="The traceability matrix includes a `coverage_summary` section: total requirements, covered count, coverage percentage, l"
- TRACE-03: model=.planning/formal/alloy/traceability-annotations.als property=ModelType text="The traceability matrix is generated as a step in `run-formal-verify.cjs` after all checks complete"
- TRACE-04: model=.planning/formal/alloy/traceability-annotations.als property=ModelType text="Bidirectional validation detects asymmetric links (model claims requirement X but requirement X does not claim that mode"
- TRACE-05: model=.planning/formal/alloy/traceability-annotations.als property=ModelType text="CI guard warns when formal coverage percentage drops below a configurable threshold (default 15%) compared to the previo"
- TRACE-06: model=.planning/formal/alloy/formal-test-trace.als property=Bool text="The /qgsd:formal-test-sync command cross-references formal model invariants with unit test coverage, validates formal co"
- ANNOT-01: model=.planning/formal/alloy/traceability-annotations.als property=ModelType text="All 11 TLA+ model files contain `@requirement` structured comments on each property/invariant, mapping it to specific re"
- ANNOT-02: model=.planning/formal/alloy/traceability-annotations.als property=ModelType text="All 8 Alloy model files contain `@requirement` structured comments on each assertion/check, mapping it to specific requi"
- ANNOT-03: model=.planning/formal/alloy/traceability-annotations.als property=ModelType text="All 3 PRISM .props files contain `@requirement` structured comments on each property, mapping it to specific requirement"
- ANNOT-04: model=.planning/formal/alloy/traceability-annotations.als property=ModelType text="`bin/extract-annotations.cjs` parses `@requirement` comments from TLA+, Alloy, and PRISM files and returns a structured "
- ANNOT-05: model=.planning/formal/alloy/traceability-annotations.als property=ModelType text="The traceability matrix generator reads extracted annotations as a primary data source, with model-registry `requirement"
- DECOMP-01: model=.planning/formal/alloy/state-space-analysis.als property=RiskLevel text="`bin/analyze-state-space.cjs` reads TLA+ .cfg files and model variables to estimate state-space size per model and class"
- DECOMP-02: model=.planning/formal/alloy/state-space-analysis.als property=RiskLevel text="The state-space analyzer flags models using unbounded domains (Nat, Int without constraints) as HIGH risk"
- DECOMP-03: model=.planning/formal/alloy/state-space-analysis.als property=RiskLevel text="When a model is split into sub-models, the traceability matrix validates that no requirement loses coverage (pre-split c"
</objective>

<tasks>
<task type="auto">
  <name>Implement stubs: MCP-06, TRACE-01, TRACE-02, TRACE-03, TRACE-04, TRACE-05, TRACE-06, ANNOT-01, ANNOT-02, ANNOT-03, ANNOT-04, ANNOT-05, DECOMP-01, DECOMP-02, DECOMP-03</name>
  <files>.planning/formal/generated-stubs/MCP-06.stub.test.js, .planning/formal/generated-stubs/TRACE-01.stub.test.js, .planning/formal/generated-stubs/TRACE-02.stub.test.js, .planning/formal/generated-stubs/TRACE-03.stub.test.js, .planning/formal/generated-stubs/TRACE-04.stub.test.js, .planning/formal/generated-stubs/TRACE-05.stub.test.js, .planning/formal/generated-stubs/TRACE-06.stub.test.js, .planning/formal/generated-stubs/ANNOT-01.stub.test.js, .planning/formal/generated-stubs/ANNOT-02.stub.test.js, .planning/formal/generated-stubs/ANNOT-03.stub.test.js, .planning/formal/generated-stubs/ANNOT-04.stub.test.js, .planning/formal/generated-stubs/ANNOT-05.stub.test.js, .planning/formal/generated-stubs/DECOMP-01.stub.test.js, .planning/formal/generated-stubs/DECOMP-02.stub.test.js, .planning/formal/generated-stubs/DECOMP-03.stub.test.js</files>
  <action>
For each stub:
1. Read the stub file
2. Read the formal model (find the property/invariant definition)
3. Read the .stub.recipe.json sidecar if it exists for pre-resolved context
4. Grep codebase for the source module implementing this requirement
5. Replace assert.fail('TODO') with test logic that imports the source
   module and asserts the invariant behavior
6. For behavioral reqs that cannot be unit-tested directly, test the
   structural constraint (function exists, constants match, exports present)
  </action>
  <verify>Run: node --test .planning/formal/generated-stubs/MCP-06.stub.test.js .planning/formal/generated-stubs/TRACE-01.stub.test.js .planning/formal/generated-stubs/TRACE-02.stub.test.js .planning/formal/generated-stubs/TRACE-03.stub.test.js .planning/formal/generated-stubs/TRACE-04.stub.test.js .planning/formal/generated-stubs/TRACE-05.stub.test.js .planning/formal/generated-stubs/TRACE-06.stub.test.js .planning/formal/generated-stubs/ANNOT-01.stub.test.js .planning/formal/generated-stubs/ANNOT-02.stub.test.js .planning/formal/generated-stubs/ANNOT-03.stub.test.js .planning/formal/generated-stubs/ANNOT-04.stub.test.js .planning/formal/generated-stubs/ANNOT-05.stub.test.js .planning/formal/generated-stubs/DECOMP-01.stub.test.js .planning/formal/generated-stubs/DECOMP-02.stub.test.js .planning/formal/generated-stubs/DECOMP-03.stub.test.js</verify>
  <done>No assert.fail('TODO') remains. Each stub has real test logic.</done>
</task>
</tasks>
