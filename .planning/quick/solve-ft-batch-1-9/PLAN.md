---
phase: solve-ft-batch-1-9
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - .planning/formal/generated-stubs/CI-01.stub.test.js
  - .planning/formal/generated-stubs/CI-02.stub.test.js
  - .planning/formal/generated-stubs/CI-03.stub.test.js
  - .planning/formal/generated-stubs/CI-04.stub.test.js
  - .planning/formal/generated-stubs/COMP-01.stub.test.js
  - .planning/formal/generated-stubs/COMP-02.stub.test.js
  - .planning/formal/generated-stubs/COMP-03.stub.test.js
  - .planning/formal/generated-stubs/COMP-04.stub.test.js
  - .planning/formal/generated-stubs/KEY-01.stub.test.js
  - .planning/formal/generated-stubs/KEY-02.stub.test.js
  - .planning/formal/generated-stubs/KEY-03.stub.test.js
  - .planning/formal/generated-stubs/KEY-04.stub.test.js
  - .planning/formal/generated-stubs/LOOP-01.stub.test.js
  - .planning/formal/generated-stubs/LOOP-02.stub.test.js
  - .planning/formal/generated-stubs/LOOP-03.stub.test.js
autonomous: true
requirements: [CI-01, CI-02, CI-03, CI-04, COMP-01, COMP-02, COMP-03, COMP-04, KEY-01, KEY-02, KEY-03, KEY-04, LOOP-01, LOOP-02, LOOP-03]
formal_artifacts: none
---

<objective>
Implement 15 test stubs for batch 9.

For each stub, read the formal model and requirement text, then replace
assert.fail('TODO') with real test logic using node:test + node:assert/strict.

Formal context:
- CI-01: model=.planning/formal/alloy/ci-pipeline-gates.als property=GateStatus text="Automated test suite runs on every pull request and merge to main is blocked when tests fail"
- CI-02: model=.planning/formal/alloy/ci-pipeline-gates.als property=GateStatus text="Linting and formatting checks run in CI and block merge on violations"
- CI-03: model=.planning/formal/alloy/ci-pipeline-gates.als property=GateStatus text="Type checking (if applicable to the language) runs in CI and blocks merge on type errors"
- CI-04: model=.planning/formal/alloy/ci-test-fallback.als property=Bool text="Full-suite test fallback enumerates files via find (never raw globs), enforces --test-timeout=15000 per file and a 5-min"
- COMP-01: model=.planning/formal/alloy/quorum-composition.als property=AllRulesHold text="User can define a `quorum.active` array in `qgsd.json` listing which slots participate in quorum"
- COMP-02: model=.planning/formal/alloy/quorum-policy.als property=UpdatePolicy text="Quorum orchestrator reads `quorum.active` from config instead of a hardcoded agent list; only active slots are called"
- COMP-03: model=.planning/formal/alloy/quorum-policy.als property=UpdatePolicy text="`check-provider-health.chs` and scoreboard tooling derive agent list from `quorum.active` rather than hardcoded arrays"
- COMP-04: model=.planning/formal/alloy/quorum-policy.als property=UpdatePolicy text="Default `quorum.active` is auto-populated at install/migration time based on discovered slots in `~/.claude.json`"
- KEY-01: model=.planning/formal/tla/QGSDKeyManagement.tla property=InputKey text="User can set or update the API key for any agent through the wizard"
- KEY-02: model=.planning/formal/tla/QGSDKeyManagement.tla property=StoreInKeytar text="Key is stored securely via keytar (bin/secrets.cjs)"
- KEY-03: model=.planning/formal/tla/QGSDKeyManagement.tla property=WriteToEnvBlock text="Wizard writes key from keytar to `~/.claude.json` mcpServers env block during apply"
- KEY-04: model=.planning/formal/tla/QGSDKeyManagement.tla property=RestartAgent text="Wizard automatically restarts the agent after key changes take effect"
- LOOP-01: model=.planning/formal/tla/QGSDQuorum.tla property=DeliberationBounded text="PRISM always uses current scoreboard rates via `export-prism-constants` pre-step calibration"
- LOOP-02: model=.planning/formal/tla/QGSDDeliberation.tla property=TotalRoundsBounded text="PostToolUse hook `qgsd-spec-regen.js` auto-regenerates TLA+/Alloy specs on XState machine changes"
- LOOP-03: model=.planning/formal/tla/QGSDPreFilter.tla property=FilterRoundsBounded text="`sensitivity-sweep-feedback.cjs` detects threshold violations and triggers PRISM re-run"
</objective>

<tasks>
<task type="auto">
  <name>Implement stubs: CI-01, CI-02, CI-03, CI-04, COMP-01, COMP-02, COMP-03, COMP-04, KEY-01, KEY-02, KEY-03, KEY-04, LOOP-01, LOOP-02, LOOP-03</name>
  <files>.planning/formal/generated-stubs/CI-01.stub.test.js, .planning/formal/generated-stubs/CI-02.stub.test.js, .planning/formal/generated-stubs/CI-03.stub.test.js, .planning/formal/generated-stubs/CI-04.stub.test.js, .planning/formal/generated-stubs/COMP-01.stub.test.js, .planning/formal/generated-stubs/COMP-02.stub.test.js, .planning/formal/generated-stubs/COMP-03.stub.test.js, .planning/formal/generated-stubs/COMP-04.stub.test.js, .planning/formal/generated-stubs/KEY-01.stub.test.js, .planning/formal/generated-stubs/KEY-02.stub.test.js, .planning/formal/generated-stubs/KEY-03.stub.test.js, .planning/formal/generated-stubs/KEY-04.stub.test.js, .planning/formal/generated-stubs/LOOP-01.stub.test.js, .planning/formal/generated-stubs/LOOP-02.stub.test.js, .planning/formal/generated-stubs/LOOP-03.stub.test.js</files>
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
  <verify>Run: node --test .planning/formal/generated-stubs/CI-01.stub.test.js .planning/formal/generated-stubs/CI-02.stub.test.js .planning/formal/generated-stubs/CI-03.stub.test.js .planning/formal/generated-stubs/CI-04.stub.test.js .planning/formal/generated-stubs/COMP-01.stub.test.js .planning/formal/generated-stubs/COMP-02.stub.test.js .planning/formal/generated-stubs/COMP-03.stub.test.js .planning/formal/generated-stubs/COMP-04.stub.test.js .planning/formal/generated-stubs/KEY-01.stub.test.js .planning/formal/generated-stubs/KEY-02.stub.test.js .planning/formal/generated-stubs/KEY-03.stub.test.js .planning/formal/generated-stubs/KEY-04.stub.test.js .planning/formal/generated-stubs/LOOP-01.stub.test.js .planning/formal/generated-stubs/LOOP-02.stub.test.js .planning/formal/generated-stubs/LOOP-03.stub.test.js</verify>
  <done>No assert.fail('TODO') remains. Each stub has real test logic.</done>
</task>
</tasks>
