---
phase: solve-ft-batch-1-12
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - .planning/formal/generated-stubs/DASH-03.stub.test.js
  - .planning/formal/generated-stubs/ENFC-01.stub.test.js
  - .planning/formal/generated-stubs/ENFC-02.stub.test.js
  - .planning/formal/generated-stubs/ENFC-03.stub.test.js
  - .planning/formal/generated-stubs/HLTH-01.stub.test.js
  - .planning/formal/generated-stubs/HLTH-02.stub.test.js
  - .planning/formal/generated-stubs/HLTH-03.stub.test.js
  - .planning/formal/generated-stubs/MCPENV-01.stub.test.js
  - .planning/formal/generated-stubs/MCPENV-03.stub.test.js
  - .planning/formal/generated-stubs/MCPENV-04.stub.test.js
  - .planning/formal/generated-stubs/META-01.stub.test.js
  - .planning/formal/generated-stubs/META-02.stub.test.js
  - .planning/formal/generated-stubs/META-03.stub.test.js
  - .planning/formal/generated-stubs/MULTI-01.stub.test.js
  - .planning/formal/generated-stubs/MULTI-02.stub.test.js
autonomous: true
requirements: [DASH-03, ENFC-01, ENFC-02, ENFC-03, HLTH-01, HLTH-02, HLTH-03, MCPENV-01, MCPENV-03, MCPENV-04, META-01, META-02, META-03, MULTI-01, MULTI-02]
formal_artifacts: none
---

<objective>
Implement 15 test stubs for batch 12.

For each stub, read the formal model and requirement text, then replace
assert.fail('TODO') with real test logic using node:test + node:assert/strict.

Formal context:
- DASH-03: model=.planning/formal/tla/QGSDDashboard.tla property=ExitDashboard text="Dashboard exits cleanly on Q or Escape, returning to main menu with stdin fully restored (no character-swallowing)"
- ENFC-01: model=.planning/formal/tla/QGSDEnforcement.tla property=BlockDecision text="When circuit breaker is active, hook returns `hookSpecificOutput.permissionDecision:'deny'` blocking Bash execution"
- ENFC-02: model=.planning/formal/tla/QGSDEnforcement.tla property=BuildBlockMessage text="Block reason names the oscillating file set, confirms circuit breaker is active, and lists allowed operations (read-only"
- ENFC-03: model=.planning/formal/tla/QGSDEnforcement.tla property=BuildBlockMessage text="Block reason instructs Claude to perform root cause analysis and map dependencies before resuming; explicitly instructs "
- HLTH-01: model=.planning/formal/alloy/health-validation.als property=Bool text="`validate health` produces zero W005 false positives for versioned phase directories (`v0.X-YY-name` format)"
- HLTH-02: model=.planning/formal/alloy/health-validation.als property=Bool text="`validate health` produces zero W007 false positives for versioned phase directories"
- HLTH-03: model=.planning/formal/alloy/health-validation.als property=Bool text="`validate health` produces zero W002 false positives for versioned phase references in STATE.md"
- MCPENV-01: model=.planning/formal/tla/QGSDMCPEnv.tla property=TypeInvariantHolds text="`.planning/formal/spec/mcp-calls/` contains TLA+ model of MCP environment behavior"
- MCPENV-03: model=.planning/formal/tla/QGSDMCPEnv.tla property=EventualDecision text="MCP availability rates from `run-prism.cjs` feed into the MCP environment model"
- MCPENV-04: model=.planning/formal/prism/mcp-availability.props property=S=? [ "min_quorum_available" ] text="`readMCPAvailabilityRates` exported with composite-key filter; `module.exports` always reachable via require.main guard;"
- META-01: model=.planning/formal/alloy/architecture-registry.als property=Requirement text="GSD planning commands within this repo (new-project, plan-phase, etc.) auto-resolve questions via quorum before escalati"
- META-02: model=.planning/formal/alloy/architecture-registry.als property=Requirement text="Only questions where quorum fails to reach consensus are presented to the user"
- META-03: model=.planning/formal/alloy/architecture-registry.als property=Requirement text="Auto-resolved questions are presented as a list of assumptions before escalated questions"
- MULTI-01: model=.planning/formal/alloy/multi-slot-structure.als property=AgentFamily text="User can have multiple `claude-*` slots (`claude-1` through `claude-N`) each running a different model or provider"
- MULTI-02: model=.planning/formal/alloy/multi-slot-structure.als property=AgentFamily text="User can have multiple `copilot-N`, `opencode-N`, `codex-cli-N`, and `gemini-cli-N` slots as separate `~/.claude.json` e"
</objective>

<tasks>
<task type="auto">
  <name>Implement stubs: DASH-03, ENFC-01, ENFC-02, ENFC-03, HLTH-01, HLTH-02, HLTH-03, MCPENV-01, MCPENV-03, MCPENV-04, META-01, META-02, META-03, MULTI-01, MULTI-02</name>
  <files>.planning/formal/generated-stubs/DASH-03.stub.test.js, .planning/formal/generated-stubs/ENFC-01.stub.test.js, .planning/formal/generated-stubs/ENFC-02.stub.test.js, .planning/formal/generated-stubs/ENFC-03.stub.test.js, .planning/formal/generated-stubs/HLTH-01.stub.test.js, .planning/formal/generated-stubs/HLTH-02.stub.test.js, .planning/formal/generated-stubs/HLTH-03.stub.test.js, .planning/formal/generated-stubs/MCPENV-01.stub.test.js, .planning/formal/generated-stubs/MCPENV-03.stub.test.js, .planning/formal/generated-stubs/MCPENV-04.stub.test.js, .planning/formal/generated-stubs/META-01.stub.test.js, .planning/formal/generated-stubs/META-02.stub.test.js, .planning/formal/generated-stubs/META-03.stub.test.js, .planning/formal/generated-stubs/MULTI-01.stub.test.js, .planning/formal/generated-stubs/MULTI-02.stub.test.js</files>
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
  <verify>Run: node --test .planning/formal/generated-stubs/DASH-03.stub.test.js .planning/formal/generated-stubs/ENFC-01.stub.test.js .planning/formal/generated-stubs/ENFC-02.stub.test.js .planning/formal/generated-stubs/ENFC-03.stub.test.js .planning/formal/generated-stubs/HLTH-01.stub.test.js .planning/formal/generated-stubs/HLTH-02.stub.test.js .planning/formal/generated-stubs/HLTH-03.stub.test.js .planning/formal/generated-stubs/MCPENV-01.stub.test.js .planning/formal/generated-stubs/MCPENV-03.stub.test.js .planning/formal/generated-stubs/MCPENV-04.stub.test.js .planning/formal/generated-stubs/META-01.stub.test.js .planning/formal/generated-stubs/META-02.stub.test.js .planning/formal/generated-stubs/META-03.stub.test.js .planning/formal/generated-stubs/MULTI-01.stub.test.js .planning/formal/generated-stubs/MULTI-02.stub.test.js</verify>
  <done>No assert.fail('TODO') remains. Each stub has real test logic.</done>
</task>
</tasks>
