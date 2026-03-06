---
phase: solve-ft-batch-1-8
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - .planning/formal/generated-stubs/QUORUM-04.stub.test.js
  - .planning/formal/generated-stubs/QUORUM-05.stub.test.js
  - .planning/formal/generated-stubs/UPS-01.stub.test.js
  - .planning/formal/generated-stubs/UPS-02.stub.test.js
  - .planning/formal/generated-stubs/UPS-03.stub.test.js
  - .planning/formal/generated-stubs/UPS-04.stub.test.js
  - .planning/formal/generated-stubs/UPS-05.stub.test.js
  - .planning/formal/generated-stubs/ARCH-01.stub.test.js
  - .planning/formal/generated-stubs/ARCH-02.stub.test.js
  - .planning/formal/generated-stubs/ARCH-03.stub.test.js
  - .planning/formal/generated-stubs/ARCH-10.stub.test.js
  - .planning/formal/generated-stubs/CALIB-01.stub.test.js
  - .planning/formal/generated-stubs/CALIB-02.stub.test.js
  - .planning/formal/generated-stubs/CALIB-03.stub.test.js
  - .planning/formal/generated-stubs/CALIB-04.stub.test.js
autonomous: true
requirements: [QUORUM-04, QUORUM-05, UPS-01, UPS-02, UPS-03, UPS-04, UPS-05, ARCH-01, ARCH-02, ARCH-03, ARCH-10, CALIB-01, CALIB-02, CALIB-03, CALIB-04]
formal_artifacts: none
---

<objective>
Implement 15 test stubs for batch 8.

For each stub, read the formal model and requirement text, then replace
assert.fail('TODO') with real test logic using node:test + node:assert/strict.

Formal context:
- QUORUM-04: model=.planning/formal/tla/QGSDQuorum.tla property=EventualConsensus text="A quorum round reaches consensus when all voting members return the same verdict AND none propose further improvements; "
- QUORUM-05: model=.planning/formal/tla/QGSDDeliberationRevision.tla property=RevisePosition text="All quorum members (including Claude) MUST review prior-round positions from other voters and revise their own position "
- UPS-01: model=.planning/formal/tla/QGSDPromptHook.tla property=TypeOK text="UserPromptSubmit hook detects GSD planning commands via explicit allowlist regex match against prompt field"
- UPS-02: model=.planning/formal/tla/QGSDPromptHook.tla property=PlanningFromAllowlist text="Allowlist contains exactly 6 commands: new-project, plan-phase, new-milestone, discuss-phase, verify-work, research-phas"
- UPS-03: model=.planning/formal/tla/QGSDPromptHook.tla property=InjectQuorum text="UserPromptSubmit hook injects quorum instructions via `hookSpecificOutput.additionalContext` (not systemMessage — goes i"
- UPS-04: model=.planning/formal/tla/QGSDPromptHook.tla property=InjectQuorum text="Injected context names the exact MCP tools to call and instructs Claude to present model responses before delivering fin"
- UPS-05: model=.planning/formal/tla/QGSDPromptHook.tla property=DetectNonPlanningCommand text="UserPromptSubmit hook never fires on execute-phase or other non-planning commands"
- ARCH-01: model=.planning/formal/alloy/architecture-registry.als property=Requirement text="All formal models declared in `.planning/formal/model-registry.json` as single source of truth with provenance tracking"
- ARCH-02: model=.planning/formal/alloy/architecture-registry.als property=Requirement text="`promote-model.cjs` provides atomic promotion from per-phase specs to canonical specs with duplicate detection"
- ARCH-03: model=.planning/formal/alloy/architecture-registry.als property=Requirement text="`accept-debug-invariant.cjs` writes debug-discovered invariants directly to canonical specs with session provenance"
- ARCH-10: model=.planning/formal/alloy/codebase-arch-constraints.als property=Bool text="QGSD, as a Claude Code plugin, MUST NOT bundle LLM SDKs; Haiku/Sonnet/Opus calls MUST use the Agent tool's model paramet"
- CALIB-01: model=.planning/formal/alloy/availability-parsing.als property=ParseCorrect text="`.planning/formal/policy.yaml` is the single authoritative source for PRISM calibration parameters"
- CALIB-02: model=.planning/formal/alloy/availability-parsing.als property=YearRolloverHandled text="`run-prism.cjs` reads `policy.yaml` and writes `writeCheckResult` with `observation_window` metadata"
- CALIB-03: model=.planning/formal/alloy/availability-parsing.als property=FallbackIsNull text="`read-policy.cjs` exposes all policy fields with typed interface"
- CALIB-04: model=.planning/formal/alloy/provider-failure.als property=Bool text="`policy.conservative_priors.tp_rate` and `policy.conservative_priors.unavail` from `.planning/formal/policy.yaml` wire d"
</objective>

<tasks>
<task type="auto">
  <name>Implement stubs: QUORUM-04, QUORUM-05, UPS-01, UPS-02, UPS-03, UPS-04, UPS-05, ARCH-01, ARCH-02, ARCH-03, ARCH-10, CALIB-01, CALIB-02, CALIB-03, CALIB-04</name>
  <files>.planning/formal/generated-stubs/QUORUM-04.stub.test.js, .planning/formal/generated-stubs/QUORUM-05.stub.test.js, .planning/formal/generated-stubs/UPS-01.stub.test.js, .planning/formal/generated-stubs/UPS-02.stub.test.js, .planning/formal/generated-stubs/UPS-03.stub.test.js, .planning/formal/generated-stubs/UPS-04.stub.test.js, .planning/formal/generated-stubs/UPS-05.stub.test.js, .planning/formal/generated-stubs/ARCH-01.stub.test.js, .planning/formal/generated-stubs/ARCH-02.stub.test.js, .planning/formal/generated-stubs/ARCH-03.stub.test.js, .planning/formal/generated-stubs/ARCH-10.stub.test.js, .planning/formal/generated-stubs/CALIB-01.stub.test.js, .planning/formal/generated-stubs/CALIB-02.stub.test.js, .planning/formal/generated-stubs/CALIB-03.stub.test.js, .planning/formal/generated-stubs/CALIB-04.stub.test.js</files>
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
  <verify>Run: node --test .planning/formal/generated-stubs/QUORUM-04.stub.test.js .planning/formal/generated-stubs/QUORUM-05.stub.test.js .planning/formal/generated-stubs/UPS-01.stub.test.js .planning/formal/generated-stubs/UPS-02.stub.test.js .planning/formal/generated-stubs/UPS-03.stub.test.js .planning/formal/generated-stubs/UPS-04.stub.test.js .planning/formal/generated-stubs/UPS-05.stub.test.js .planning/formal/generated-stubs/ARCH-01.stub.test.js .planning/formal/generated-stubs/ARCH-02.stub.test.js .planning/formal/generated-stubs/ARCH-03.stub.test.js .planning/formal/generated-stubs/ARCH-10.stub.test.js .planning/formal/generated-stubs/CALIB-01.stub.test.js .planning/formal/generated-stubs/CALIB-02.stub.test.js .planning/formal/generated-stubs/CALIB-03.stub.test.js .planning/formal/generated-stubs/CALIB-04.stub.test.js</verify>
  <done>No assert.fail('TODO') remains. Each stub has real test logic.</done>
</task>
</tasks>
