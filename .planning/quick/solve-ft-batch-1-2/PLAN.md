---
phase: solve-ft-batch-1-2
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - .planning/formal/generated-stubs/INST-04.stub.test.js
  - .planning/formal/generated-stubs/INST-05.stub.test.js
  - .planning/formal/generated-stubs/INST-06.stub.test.js
  - .planning/formal/generated-stubs/INST-07.stub.test.js
  - .planning/formal/generated-stubs/INST-08.stub.test.js
  - .planning/formal/generated-stubs/INST-09.stub.test.js
  - .planning/formal/generated-stubs/INST-10.stub.test.js
  - .planning/formal/generated-stubs/INST-11.stub.test.js
  - .planning/formal/generated-stubs/INST-12.stub.test.js
  - .planning/formal/generated-stubs/STOP-01.stub.test.js
  - .planning/formal/generated-stubs/STOP-02.stub.test.js
  - .planning/formal/generated-stubs/STOP-03.stub.test.js
  - .planning/formal/generated-stubs/STOP-04.stub.test.js
  - .planning/formal/generated-stubs/STOP-05.stub.test.js
  - .planning/formal/generated-stubs/STOP-06.stub.test.js
autonomous: true
requirements: [INST-04, INST-05, INST-06, INST-07, INST-08, INST-09, INST-10, INST-11, INST-12, STOP-01, STOP-02, STOP-03, STOP-04, STOP-05, STOP-06]
formal_artifacts: none
---

<objective>
Implement 15 test stubs for batch 2.

For each stub, read the formal model and requirement text, then replace
assert.fail('TODO') with real test logic using node:test + node:assert/strict.

Formal context:
- INST-04: model=.planning/formal/alloy/install-scope.als property=RollbackSoundCheck text="Installer adds UserPromptSubmit and Stop hook entries to `~/.claude/settings.json` hooks section"
- INST-05: model=.planning/formal/alloy/install-scope.als property=ConfigSyncCompleteCheck text="Installer performs validation before registering hooks: checks MCPs are configured in Claude Code settings, warns if Cod"
- INST-06: model=.planning/formal/tla/QGSDInstallerIdempotency.tla property=Install text="Installer is idempotent — running `npx qgsd@latest` again updates hooks and config without duplicating entries"
- INST-07: model=.planning/formal/tla/QGSDInstallerIdempotency.tla property=OverridesPreserved text="Installer respects existing per-project `.claude/qgsd.json` overrides during updates"
- INST-08: model=.planning/formal/tla/QGSDInstallerIdempotency.tla property=BreakerAlwaysRegistered text="Installer registers PreToolUse circuit breaker hook in `~/.claude/settings.json` alongside existing hooks"
- INST-09: model=.planning/formal/tla/QGSDInstallerIdempotency.tla property=DefaultConfigPresent text="Installer writes default `circuit_breaker` config block to qgsd.json on first install"
- INST-10: model=.planning/formal/tla/QGSDInstallerIdempotency.tla property=OverridesPreserved text="Reinstall (idempotent) adds missing `circuit_breaker` config block without overwriting user-modified values"
- INST-11: model=.planning/formal/alloy/bin-path-resolution.als property=Dir text="Bin scripts resolve ROOT from process.cwd() (the invoking project directory) rather than __dirname (the script install l"
- INST-12: model=.planning/formal/alloy/baseline-merge-idempotent.als property=ReqText text="Baseline requirements are merged into .planning/formal/requirements.json using an idempotent CLI tool that matches on te"
- STOP-01: model=.planning/formal/tla/QGSDStopHook.tla property=TypeOK text="Stop hook reads transcript JSONL for tool_use entries matching configured quorum model names"
- STOP-02: model=.planning/formal/tla/QGSDStopHook.tla property=SafetyInvariant1 text="Stop hook checks `stop_hook_active` flag first — if true, exits 0 immediately (infinite loop prevention)"
- STOP-03: model=.planning/formal/tla/QGSDStopHook.tla property=SafetyInvariant2 text="Stop hook checks `hook_event_name` — if `SubagentStop`, exits 0 immediately (subagent exclusion)"
- STOP-04: model=.planning/formal/tla/QGSDStopHook.tla property=SafetyInvariant3 text="Stop hook scopes transcript search to current turn only (lines since last user message boundary) — survives context comp"
- STOP-05: model=.planning/formal/tla/QGSDStopHook.tla property=LivenessProperty1 text="Stop hook reads transcript JSONL as the authoritative source of quorum evidence — no fast-path pre-check (design decisio"
- STOP-06: model=.planning/formal/tla/QGSDStopHook.tla property=LivenessProperty2 text="Stop hook verifies quorum only when a configured planning command was issued in the current turn (scope filtering)"
</objective>

<tasks>
<task type="auto">
  <name>Implement stubs: INST-04, INST-05, INST-06, INST-07, INST-08, INST-09, INST-10, INST-11, INST-12, STOP-01, STOP-02, STOP-03, STOP-04, STOP-05, STOP-06</name>
  <files>.planning/formal/generated-stubs/INST-04.stub.test.js, .planning/formal/generated-stubs/INST-05.stub.test.js, .planning/formal/generated-stubs/INST-06.stub.test.js, .planning/formal/generated-stubs/INST-07.stub.test.js, .planning/formal/generated-stubs/INST-08.stub.test.js, .planning/formal/generated-stubs/INST-09.stub.test.js, .planning/formal/generated-stubs/INST-10.stub.test.js, .planning/formal/generated-stubs/INST-11.stub.test.js, .planning/formal/generated-stubs/INST-12.stub.test.js, .planning/formal/generated-stubs/STOP-01.stub.test.js, .planning/formal/generated-stubs/STOP-02.stub.test.js, .planning/formal/generated-stubs/STOP-03.stub.test.js, .planning/formal/generated-stubs/STOP-04.stub.test.js, .planning/formal/generated-stubs/STOP-05.stub.test.js, .planning/formal/generated-stubs/STOP-06.stub.test.js</files>
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
  <verify>Run: node --test .planning/formal/generated-stubs/INST-04.stub.test.js .planning/formal/generated-stubs/INST-05.stub.test.js .planning/formal/generated-stubs/INST-06.stub.test.js .planning/formal/generated-stubs/INST-07.stub.test.js .planning/formal/generated-stubs/INST-08.stub.test.js .planning/formal/generated-stubs/INST-09.stub.test.js .planning/formal/generated-stubs/INST-10.stub.test.js .planning/formal/generated-stubs/INST-11.stub.test.js .planning/formal/generated-stubs/INST-12.stub.test.js .planning/formal/generated-stubs/STOP-01.stub.test.js .planning/formal/generated-stubs/STOP-02.stub.test.js .planning/formal/generated-stubs/STOP-03.stub.test.js .planning/formal/generated-stubs/STOP-04.stub.test.js .planning/formal/generated-stubs/STOP-05.stub.test.js .planning/formal/generated-stubs/STOP-06.stub.test.js</verify>
  <done>No assert.fail('TODO') remains. Each stub has real test logic.</done>
</task>
</tasks>
