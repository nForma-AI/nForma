---
phase: solve-ft-batch-1-3
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - .planning/formal/generated-stubs/STOP-07.stub.test.js
  - .planning/formal/generated-stubs/STOP-08.stub.test.js
  - .planning/formal/generated-stubs/STOP-09.stub.test.js
  - .planning/formal/generated-stubs/WIZ-01.stub.test.js
  - .planning/formal/generated-stubs/WIZ-02.stub.test.js
  - .planning/formal/generated-stubs/WIZ-03.stub.test.js
  - .planning/formal/generated-stubs/WIZ-04.stub.test.js
  - .planning/formal/generated-stubs/WIZ-05.stub.test.js
  - .planning/formal/generated-stubs/WIZ-08.stub.test.js
  - .planning/formal/generated-stubs/WIZ-09.stub.test.js
  - .planning/formal/generated-stubs/WIZ-10.stub.test.js
  - .planning/formal/generated-stubs/WIZ-11.stub.test.js
  - .planning/formal/generated-stubs/OBS-01.stub.test.js
  - .planning/formal/generated-stubs/OBS-02.stub.test.js
  - .planning/formal/generated-stubs/OBS-03.stub.test.js
autonomous: true
requirements: [STOP-07, STOP-08, STOP-09, WIZ-01, WIZ-02, WIZ-03, WIZ-04, WIZ-05, WIZ-08, WIZ-09, WIZ-10, WIZ-11, OBS-01, OBS-02, OBS-03]
formal_artifacts: none
---

<objective>
Implement 15 test stubs for batch 3.

For each stub, read the formal model and requirement text, then replace
assert.fail('TODO') with real test logic using node:test + node:assert/strict.

Formal context:
- STOP-07: model=.planning/formal/tla/QGSDStopHook.tla property=LivenessProperty3 text="Stop hook blocks with `{"decision": "block", "reason": "..."}` when quorum is missing — reason includes exact tool names"
- STOP-08: model=.planning/formal/alloy/transcript-scan.als property=BoundaryCorrectCheck text="Block reason message format: "QUORUM REQUIRED: Before completing this /qgsd:[command] response, call [tool1], [tool2], ["
- STOP-09: model=.planning/formal/alloy/transcript-scan.als property=PairingUniqueCheck text="Stop hook passes (exits 0, no decision field) when quorum evidence found or no planning command in scope"
- WIZ-01: model=.planning/formal/tla/QGSDSetupWizard.tla property=WizardStartsCorrectly text="User can run `/qgsd:mcp-setup` to start the MCP configuration wizard"
- WIZ-02: model=.planning/formal/tla/QGSDSetupWizard.tla property=EnterFirstRun text="First run (no configured agents) presents a guided linear onboarding flow step by step"
- WIZ-03: model=.planning/formal/tla/QGSDSetupWizard.tla property=EnterMenu text="Re-run shows the current agent roster as a navigable menu"
- WIZ-04: model=.planning/formal/tla/QGSDSetupWizard.tla property=SelectAgent text="Each agent in the menu shows current model, provider, and key status (present/missing)"
- WIZ-05: model=.planning/formal/tla/QGSDSetupWizard.tla property=ConfirmChanges text="User confirms before changes are applied; wizard restarts affected agents after apply"
- WIZ-08: model=.planning/formal/tla/QGSDSetupWizard.tla property=EditComposition text="`/qgsd:mcp-setup` re-run menu includes an "Edit Quorum Composition" option"
- WIZ-09: model=.planning/formal/tla/QGSDSetupWizard.tla property=EditComposition text="Composition screen shows all discovered slots with on/off toggle for `quorum.active` inclusion"
- WIZ-10: model=.planning/formal/tla/QGSDSetupWizard.tla property=AddSlot text="User can add a new slot for any family (claude, copilot, opencode, codex-cli, gemini-cli) from within the wizard, which "
- WIZ-11: model=.planning/formal/alloy/settings-hub.als property=Bool text="User can run /qgsd:settings to access a guided project manager hub with state-aware dashboard (milestone, progress, phas"
- OBS-01: model=.planning/formal/prism/observability-delivery.props property=S=? [ "any_delivery" ] text="Each quorum round emits structured telemetry (slot, round, verdict, latency_ms, provider status) to a per-session log fi"
- OBS-02: model=.planning/formal/prism/observability-delivery.props property=S=? [ "full_delivery" ] text="Scoreboard tracks quorum delivery rate -- percentage of calls that achieved target vote count (3/3 vs degraded 2/3)"
- OBS-03: model=.planning/formal/prism/observability-delivery.props property=S=? [ "slot1_unavail" ] text="Each slot gets a flakiness score from recent UNAVAIL/timeout frequency; high-flakiness slots deprioritized in dispatch o"
</objective>

<tasks>
<task type="auto">
  <name>Implement stubs: STOP-07, STOP-08, STOP-09, WIZ-01, WIZ-02, WIZ-03, WIZ-04, WIZ-05, WIZ-08, WIZ-09, WIZ-10, WIZ-11, OBS-01, OBS-02, OBS-03</name>
  <files>.planning/formal/generated-stubs/STOP-07.stub.test.js, .planning/formal/generated-stubs/STOP-08.stub.test.js, .planning/formal/generated-stubs/STOP-09.stub.test.js, .planning/formal/generated-stubs/WIZ-01.stub.test.js, .planning/formal/generated-stubs/WIZ-02.stub.test.js, .planning/formal/generated-stubs/WIZ-03.stub.test.js, .planning/formal/generated-stubs/WIZ-04.stub.test.js, .planning/formal/generated-stubs/WIZ-05.stub.test.js, .planning/formal/generated-stubs/WIZ-08.stub.test.js, .planning/formal/generated-stubs/WIZ-09.stub.test.js, .planning/formal/generated-stubs/WIZ-10.stub.test.js, .planning/formal/generated-stubs/WIZ-11.stub.test.js, .planning/formal/generated-stubs/OBS-01.stub.test.js, .planning/formal/generated-stubs/OBS-02.stub.test.js, .planning/formal/generated-stubs/OBS-03.stub.test.js</files>
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
  <verify>Run: node --test .planning/formal/generated-stubs/STOP-07.stub.test.js .planning/formal/generated-stubs/STOP-08.stub.test.js .planning/formal/generated-stubs/STOP-09.stub.test.js .planning/formal/generated-stubs/WIZ-01.stub.test.js .planning/formal/generated-stubs/WIZ-02.stub.test.js .planning/formal/generated-stubs/WIZ-03.stub.test.js .planning/formal/generated-stubs/WIZ-04.stub.test.js .planning/formal/generated-stubs/WIZ-05.stub.test.js .planning/formal/generated-stubs/WIZ-08.stub.test.js .planning/formal/generated-stubs/WIZ-09.stub.test.js .planning/formal/generated-stubs/WIZ-10.stub.test.js .planning/formal/generated-stubs/WIZ-11.stub.test.js .planning/formal/generated-stubs/OBS-01.stub.test.js .planning/formal/generated-stubs/OBS-02.stub.test.js .planning/formal/generated-stubs/OBS-03.stub.test.js</verify>
  <done>No assert.fail('TODO') remains. Each stub has real test logic.</done>
</task>
</tasks>
