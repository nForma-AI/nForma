---
phase: solve-ft-batch-1-11
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - .planning/formal/generated-stubs/SYNC-03.stub.test.js
  - .planning/formal/generated-stubs/SYNC-04.stub.test.js
  - .planning/formal/generated-stubs/UNIF-01.stub.test.js
  - .planning/formal/generated-stubs/UNIF-02.stub.test.js
  - .planning/formal/generated-stubs/UNIF-03.stub.test.js
  - .planning/formal/generated-stubs/UNIF-04.stub.test.js
  - .planning/formal/generated-stubs/VERIFY-01.stub.test.js
  - .planning/formal/generated-stubs/VERIFY-02.stub.test.js
  - .planning/formal/generated-stubs/VERIFY-03.stub.test.js
  - .planning/formal/generated-stubs/VERIFY-04.stub.test.js
  - .planning/formal/generated-stubs/AGENT-01.stub.test.js
  - .planning/formal/generated-stubs/AGENT-02.stub.test.js
  - .planning/formal/generated-stubs/AGENT-03.stub.test.js
  - .planning/formal/generated-stubs/DASH-01.stub.test.js
  - .planning/formal/generated-stubs/DASH-02.stub.test.js
autonomous: true
requirements: [SYNC-03, SYNC-04, UNIF-01, UNIF-02, UNIF-03, UNIF-04, VERIFY-01, VERIFY-02, VERIFY-03, VERIFY-04, AGENT-01, AGENT-02, AGENT-03, DASH-01, DASH-02]
formal_artifacts: none
---

<objective>
Implement 15 test stubs for batch 11.

For each stub, read the formal model and requirement text, then replace
assert.fail('TODO') with real test logic using node:test + node:assert/strict.

Formal context:
- SYNC-03: model=.planning/formal/alloy/gsd-sync-invariants.als property=Bool text="QGSD changelog explicitly tracks which GSD version it is compatible with"
- SYNC-04: model=.planning/formal/alloy/gsd-sync-invariants.als property=Bool text="No QGSD code modifies any GSD source files — all additions are in separate files (`hooks/qgsd-stop.js`, `hooks/qgsd-prom"
- UNIF-01: model=.planning/formal/alloy/unified-check-results.als property=FVTool text="All FV checkers append normalized JSON to `check-results.ndjson` — `{ tool, check_id, result, detail, ts }`"
- UNIF-02: model=.planning/formal/alloy/unified-check-results.als property=FVTool text="`run-formal-verify.cjs` generates `check-results.ndjson` as canonical output artifact"
- UNIF-03: model=.planning/formal/alloy/unified-check-results.als property=FVTool text="Triage bundle reads from `check-results.ndjson`, not tool stdout; CI enforcement steps run inside orchestrator before su"
- UNIF-04: model=.planning/formal/alloy/unified-check-results.als property=FVTool text="CI step exits non-zero when any `result=fail` entry exists in `check-results.ndjson`"
- VERIFY-01: model=.planning/formal/alloy/verification-integration.als property=Bool text="`qgsd-verifier` agent runs `run-formal-verify` after implementation and includes `check-results.ndjson` digest in `VERIF"
- VERIFY-02: model=.planning/formal/alloy/verification-integration.als property=Bool text="`VERIFICATION.md` template gains a `## Formal Verification` section summarizing pass/fail/warn counts per formalism (tla"
- VERIFY-03: model=.planning/formal/alloy/headless-execution.als property=Bool text="Formal model runners (Alloy, TLA+, PRISM, UPPAAL) MUST execute in headless mode — no GUI windows or AWT initialization. "
- VERIFY-04: model=.planning/formal/alloy/jvm-heap-sequential.als property=Bool text="All JVM-spawning formal model runners (TLC and Alloy) MUST include -Xms64m and -Xmx heap cap flags before -jar, defaulti"
- AGENT-01: model=.planning/formal/tla/QGSDAgentProvisioning.tla property=AddAgent text="User can add a new claude-mcp-server instance (name, provider, model, key)"
- AGENT-02: model=.planning/formal/tla/QGSDAgentProvisioning.tla property=RemoveAgent text="User can remove an existing agent from the roster"
- AGENT-03: model=.planning/formal/tla/QGSDAgentProvisioning.tla property=VerifyAgent text="Wizard runs identity ping to verify connectivity after provisioning new agent"
- DASH-01: model=.planning/formal/tla/QGSDDashboard.tla property=OpenDashboard text="User can open a live health dashboard from main menu showing all slots' provider, model, and health status"
- DASH-02: model=.planning/formal/tla/QGSDDashboard.tla property=RefreshDashboard text="Dashboard refreshes on keypress (space / r) with a visible "last updated" timestamp shown at bottom"
</objective>

<tasks>
<task type="auto">
  <name>Implement stubs: SYNC-03, SYNC-04, UNIF-01, UNIF-02, UNIF-03, UNIF-04, VERIFY-01, VERIFY-02, VERIFY-03, VERIFY-04, AGENT-01, AGENT-02, AGENT-03, DASH-01, DASH-02</name>
  <files>.planning/formal/generated-stubs/SYNC-03.stub.test.js, .planning/formal/generated-stubs/SYNC-04.stub.test.js, .planning/formal/generated-stubs/UNIF-01.stub.test.js, .planning/formal/generated-stubs/UNIF-02.stub.test.js, .planning/formal/generated-stubs/UNIF-03.stub.test.js, .planning/formal/generated-stubs/UNIF-04.stub.test.js, .planning/formal/generated-stubs/VERIFY-01.stub.test.js, .planning/formal/generated-stubs/VERIFY-02.stub.test.js, .planning/formal/generated-stubs/VERIFY-03.stub.test.js, .planning/formal/generated-stubs/VERIFY-04.stub.test.js, .planning/formal/generated-stubs/AGENT-01.stub.test.js, .planning/formal/generated-stubs/AGENT-02.stub.test.js, .planning/formal/generated-stubs/AGENT-03.stub.test.js, .planning/formal/generated-stubs/DASH-01.stub.test.js, .planning/formal/generated-stubs/DASH-02.stub.test.js</files>
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
  <verify>Run: node --test .planning/formal/generated-stubs/SYNC-03.stub.test.js .planning/formal/generated-stubs/SYNC-04.stub.test.js .planning/formal/generated-stubs/UNIF-01.stub.test.js .planning/formal/generated-stubs/UNIF-02.stub.test.js .planning/formal/generated-stubs/UNIF-03.stub.test.js .planning/formal/generated-stubs/UNIF-04.stub.test.js .planning/formal/generated-stubs/VERIFY-01.stub.test.js .planning/formal/generated-stubs/VERIFY-02.stub.test.js .planning/formal/generated-stubs/VERIFY-03.stub.test.js .planning/formal/generated-stubs/VERIFY-04.stub.test.js .planning/formal/generated-stubs/AGENT-01.stub.test.js .planning/formal/generated-stubs/AGENT-02.stub.test.js .planning/formal/generated-stubs/AGENT-03.stub.test.js .planning/formal/generated-stubs/DASH-01.stub.test.js .planning/formal/generated-stubs/DASH-02.stub.test.js</verify>
  <done>No assert.fail('TODO') remains. Each stub has real test logic.</done>
</task>
</tasks>
