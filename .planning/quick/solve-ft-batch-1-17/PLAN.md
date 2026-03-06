---
phase: solve-ft-batch-1-17
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - .planning/formal/generated-stubs/PLAT-01.stub.test.js
  - .planning/formal/generated-stubs/RECV-01.stub.test.js
  - .planning/formal/generated-stubs/REN-03.stub.test.js
  - .planning/formal/generated-stubs/SAFE-01.stub.test.js
  - .planning/formal/generated-stubs/STD-10.stub.test.js
  - .planning/formal/generated-stubs/VIS-01.stub.test.js
autonomous: true
requirements: [PLAT-01, RECV-01, REN-03, SAFE-01, STD-10, VIS-01]
formal_artifacts: none
---

<objective>
Implement 6 test stubs for batch 17.

For each stub, read the formal model and requirement text, then replace
assert.fail('TODO') with real test logic using node:test + node:assert/strict.

Formal context:
- PLAT-01: model=.planning/formal/alloy/platform-install-compat.als property=Platform text="QGSD installs and operates correctly on macOS, Ubuntu, and Windows without platform-specific workarounds"
- RECV-01: model=.planning/formal/tla/QGSDQuorum.tla property=EventualConsensus text="`npx qgsd --reset-breaker` CLI flag clears `.claude/circuit-breaker-state.json` and logs confirmation — enables manual r"
- REN-03: model=.planning/formal/alloy/codebase-arch-constraints.als property=Bool text="All hardcoded `get-shit-done/` path strings removed from `bin/gsd-tools.cjs`, workflow files, agent files, and template "
- SAFE-01: model=.planning/formal/alloy/quorum-votes.als property=ThresholdPasses text="`--repair` cannot silently overwrite a rich STATE.md (>50 lines) without explicit `--force` flag; guard fires and repair"
- STD-10: model=.planning/formal/alloy/codebase-arch-constraints.als property=Bool text="gemini-mcp-server npm package name is unscoped (`gemini-mcp-server`, not `@tuannvm/gemini-mcp-server`) — `~/.claude.json"
- VIS-01: model=.planning/formal/alloy/health-validation.als property=Bool text="`/qgsd:health` surfaces W008 warning when a quorum slot has ≥3 failures recorded in `quorum-failures.json`"
</objective>

<tasks>
<task type="auto">
  <name>Implement stubs: PLAT-01, RECV-01, REN-03, SAFE-01, STD-10, VIS-01</name>
  <files>.planning/formal/generated-stubs/PLAT-01.stub.test.js, .planning/formal/generated-stubs/RECV-01.stub.test.js, .planning/formal/generated-stubs/REN-03.stub.test.js, .planning/formal/generated-stubs/SAFE-01.stub.test.js, .planning/formal/generated-stubs/STD-10.stub.test.js, .planning/formal/generated-stubs/VIS-01.stub.test.js</files>
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
  <verify>Run: node --test .planning/formal/generated-stubs/PLAT-01.stub.test.js .planning/formal/generated-stubs/RECV-01.stub.test.js .planning/formal/generated-stubs/REN-03.stub.test.js .planning/formal/generated-stubs/SAFE-01.stub.test.js .planning/formal/generated-stubs/STD-10.stub.test.js .planning/formal/generated-stubs/VIS-01.stub.test.js</verify>
  <done>No assert.fail('TODO') remains. Each stub has real test logic.</done>
</task>
</tasks>
