---
phase: solve-ft-batch-1-15
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - .planning/formal/generated-stubs/SLOT-04.stub.test.js
  - .planning/formal/generated-stubs/SPEC-01.stub.test.js
  - .planning/formal/generated-stubs/SPEC-03.stub.test.js
  - .planning/formal/generated-stubs/SPEC-04.stub.test.js
  - .planning/formal/generated-stubs/UPPAAL-01.stub.test.js
  - .planning/formal/generated-stubs/UPPAAL-02.stub.test.js
  - .planning/formal/generated-stubs/UPPAAL-03.stub.test.js
  - .planning/formal/generated-stubs/UX-01.stub.test.js
  - .planning/formal/generated-stubs/UX-02.stub.test.js
  - .planning/formal/generated-stubs/UX-03.stub.test.js
  - .planning/formal/generated-stubs/CRED-01.stub.test.js
  - .planning/formal/generated-stubs/CRED-02.stub.test.js
  - .planning/formal/generated-stubs/DRIFT-01.stub.test.js
  - .planning/formal/generated-stubs/DRIFT-02.stub.test.js
  - .planning/formal/generated-stubs/EVID-01.stub.test.js
autonomous: true
requirements: [SLOT-04, SPEC-01, SPEC-03, SPEC-04, UPPAAL-01, UPPAAL-02, UPPAAL-03, UX-01, UX-02, UX-03, CRED-01, CRED-02, DRIFT-01, DRIFT-02, EVID-01]
formal_artifacts: none
---

<objective>
Implement 15 test stubs for batch 15.

For each stub, read the formal model and requirement text, then replace
assert.fail('TODO') with real test logic using node:test + node:assert/strict.

Formal context:
- SLOT-04: model=.planning/formal/tla/QGSDRecruiting.tla property=SubslotsFirst text="`mcp-status`, `mcp-set-model`, `mcp-update`, `mcp-restart` accept and display slot names correctly"
- SPEC-01: model=.planning/formal/tla/QGSDStopHook.tla property=SafetyInvariant1 text="Stop hook formalized in `QGSDStopHook.tla` + `MCStopHook.cfg`, TLC verifies safety + liveness"
- SPEC-03: model=.planning/formal/alloy/quorum-composition.als property=AllRulesHold text="Quorum composition verified in `quorum-composition.als` — 3 composition rules hold"
- SPEC-04: model=.planning/formal/tla/QGSDSpecGeneration.tla property=StartPhaseSpec text="`generate-phase-spec.cjs` translates PLAN.md `must_haves: truths:` to TLA+ PROPERTY stubs"
- UPPAAL-01: model=.planning/formal/alloy/uppaal-model-reqs.als property=Bool text="A UPPAAL timed automaton model (`.planning/formal/uppaal/quorum-races.xml`) captures the concurrency structure of the qu"
- UPPAAL-02: model=.planning/formal/alloy/uppaal-model-reqs.als property=Bool text="`bin/run-uppaal.cjs` executes the UPPAAL model checker (verifyta CLI) against `quorum-races.xml` and writes a check resu"
- UPPAAL-03: model=.planning/formal/alloy/uppaal-model-reqs.als property=Bool text="The model surfaces at least two critical measurement points as annotated properties: (a) the minimum inter-slot response"
- UX-01: model=.planning/formal/alloy/ux-feedback-safety.als property=Bool text="Every user-initiated action produces immediate feedback (loading/disabled state) and completion feedback (result message"
- UX-02: model=.planning/formal/alloy/ux-feedback-safety.als property=Bool text="Destructive actions (delete, reset, remove, overwrite) require explicit confirmation or provide undo within a reasonable"
- UX-03: model=.planning/formal/alloy/ux-feedback-safety.als property=Bool text="Error messages are human-readable, explain what went wrong, and suggest a next step or recovery action"
- CRED-01: model=.planning/formal/tla/QGSDAccountManager.tla property=TypeOK text="User can rotate API keys across multiple slots in a single batch flow from the main menu"
- CRED-02: model=.planning/formal/tla/QGSDAccountManager.tla property=ActiveIsPoolMember text="Key validity status persists to `qgsd.json` after each health probe (enables DISP-03 badge to survive across sessions wi"
- DRIFT-01: model=.planning/formal/tla/QGSDCIChecks.tla property=CompleteDrift text="`check-trace-schema-drift.cjs` detects schema drift and emits `check-results.ndjson`"
- DRIFT-02: model=.planning/formal/tla/QGSDCIChecks.tla property=CompleteDrift text="Schema drift check runs as CI step in `run-formal-verify.cjs`"
- EVID-01: model=.planning/formal/alloy/evidence-triage.als property=Confidence text="`never_observed` path entries in `validate-traces.cjs` evidence output carry `confidence: low|medium|high` based on trac"
</objective>

<tasks>
<task type="auto">
  <name>Implement stubs: SLOT-04, SPEC-01, SPEC-03, SPEC-04, UPPAAL-01, UPPAAL-02, UPPAAL-03, UX-01, UX-02, UX-03, CRED-01, CRED-02, DRIFT-01, DRIFT-02, EVID-01</name>
  <files>.planning/formal/generated-stubs/SLOT-04.stub.test.js, .planning/formal/generated-stubs/SPEC-01.stub.test.js, .planning/formal/generated-stubs/SPEC-03.stub.test.js, .planning/formal/generated-stubs/SPEC-04.stub.test.js, .planning/formal/generated-stubs/UPPAAL-01.stub.test.js, .planning/formal/generated-stubs/UPPAAL-02.stub.test.js, .planning/formal/generated-stubs/UPPAAL-03.stub.test.js, .planning/formal/generated-stubs/UX-01.stub.test.js, .planning/formal/generated-stubs/UX-02.stub.test.js, .planning/formal/generated-stubs/UX-03.stub.test.js, .planning/formal/generated-stubs/CRED-01.stub.test.js, .planning/formal/generated-stubs/CRED-02.stub.test.js, .planning/formal/generated-stubs/DRIFT-01.stub.test.js, .planning/formal/generated-stubs/DRIFT-02.stub.test.js, .planning/formal/generated-stubs/EVID-01.stub.test.js</files>
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
  <verify>Run: node --test .planning/formal/generated-stubs/SLOT-04.stub.test.js .planning/formal/generated-stubs/SPEC-01.stub.test.js .planning/formal/generated-stubs/SPEC-03.stub.test.js .planning/formal/generated-stubs/SPEC-04.stub.test.js .planning/formal/generated-stubs/UPPAAL-01.stub.test.js .planning/formal/generated-stubs/UPPAAL-02.stub.test.js .planning/formal/generated-stubs/UPPAAL-03.stub.test.js .planning/formal/generated-stubs/UX-01.stub.test.js .planning/formal/generated-stubs/UX-02.stub.test.js .planning/formal/generated-stubs/UX-03.stub.test.js .planning/formal/generated-stubs/CRED-01.stub.test.js .planning/formal/generated-stubs/CRED-02.stub.test.js .planning/formal/generated-stubs/DRIFT-01.stub.test.js .planning/formal/generated-stubs/DRIFT-02.stub.test.js .planning/formal/generated-stubs/EVID-01.stub.test.js</verify>
  <done>No assert.fail('TODO') remains. Each stub has real test logic.</done>
</task>
</tasks>
