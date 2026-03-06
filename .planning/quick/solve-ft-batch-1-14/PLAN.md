---
phase: solve-ft-batch-1-14
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - .planning/formal/generated-stubs/PROV-03.stub.test.js
  - .planning/formal/generated-stubs/REDACT-01.stub.test.js
  - .planning/formal/generated-stubs/REDACT-02.stub.test.js
  - .planning/formal/generated-stubs/REDACT-03.stub.test.js
  - .planning/formal/generated-stubs/SCBD-01.stub.test.js
  - .planning/formal/generated-stubs/SCBD-02.stub.test.js
  - .planning/formal/generated-stubs/SCBD-03.stub.test.js
  - .planning/formal/generated-stubs/SCHEMA-01.stub.test.js
  - .planning/formal/generated-stubs/SCHEMA-03.stub.test.js
  - .planning/formal/generated-stubs/SCHEMA-04.stub.test.js
  - .planning/formal/generated-stubs/SENS-01.stub.test.js
  - .planning/formal/generated-stubs/SENS-02.stub.test.js
  - .planning/formal/generated-stubs/SENS-03.stub.test.js
  - .planning/formal/generated-stubs/SLOT-01.stub.test.js
  - .planning/formal/generated-stubs/SLOT-02.stub.test.js
autonomous: true
requirements: [PROV-03, REDACT-01, REDACT-02, REDACT-03, SCBD-01, SCBD-02, SCBD-03, SCHEMA-01, SCHEMA-03, SCHEMA-04, SENS-01, SENS-02, SENS-03, SLOT-01, SLOT-02]
formal_artifacts: none
---

<objective>
Implement 15 test stubs for batch 14.

For each stub, read the formal model and requirement text, then replace
assert.fail('TODO') with real test logic using node:test + node:assert/strict.

Formal context:
- PROV-03: model=.planning/formal/tla/QGSDAgentProvisioning.tla property=ChangeProvider text="Wizard updates `~/.claude.json` ANTHROPIC_BASE_URL and restarts agent on apply"
- REDACT-01: model=.planning/formal/tla/QGSDCIChecks.tla property=CompleteRedaction text="`check-trace-redaction.cjs` checks traces for PII/secret patterns and emits `check-results.ndjson`"
- REDACT-02: model=.planning/formal/tla/QGSDCIChecks.tla property=CompleteRedaction text="Redaction check runs as CI step in `run-formal-verify.cjs`"
- REDACT-03: model=.planning/formal/tla/QGSDCIChecks.tla property=CompleteRedaction text="Redaction violations emit `result=fail` (not warn)"
- SCBD-01: model=.planning/formal/alloy/scoreboard-recompute.als property=RecomputeIdempotent text="Scoreboard tracks performance by slot name (`claude-1`, `copilot-1`) — slot is the stable key"
- SCBD-02: model=.planning/formal/alloy/scoreboard-recompute.als property=NoVoteLoss text="Each scoreboard entry displays the current model loaded in that slot as context"
- SCBD-03: model=.planning/formal/alloy/scoreboard-recompute.als property=NoDoubleCounting text="When a slot's model changes, a new scoreboard row is created for that slot"
- SCHEMA-01: model=.planning/formal/alloy/schema-extensions.als property=Requirement text="`model-registry.json` entries gain a `requirements` array (string[]) listing the requirement IDs each model covers; exis"
- SCHEMA-03: model=.planning/formal/alloy/schema-extensions.als property=Requirement text="Each verification runner (run-tlc.cjs, run-alloy.cjs, run-prism.cjs, CI lint steps) emits `requirement_ids` in its NDJSO"
- SCHEMA-04: model=.planning/formal/alloy/schema-extensions.als property=Requirement text="`requirements.json` envelope gains an optional `formal_models` array (string[]) per requirement, listing model file path"
- SENS-01: model=.planning/formal/tla/QGSDSensitivity.tla property=StartSweep text="`bin/run-sensitivity-sweep.cjs` varies key model parameters (at minimum: quorum size N across its full range, timeout th"
- SENS-02: model=.planning/formal/tla/QGSDSensitivity.tla property=InjectContext text="`plan-phase.md` step 8.3 (FV gate) is extended to also run `run-sensitivity-sweep.cjs` (fail-open) and inject `SENSITIVI"
- SENS-03: model=.planning/formal/tla/QGSDSensitivity.tla property=GenerateReport text="`bin/sensitivity-report.cjs` generates `.planning/formal/sensitivity-report.md` — a human-readable ranked list of sensit"
- SLOT-01: model=.planning/formal/tla/QGSDQuorum.tla property=QuorumCeilingMet text="User sees all quorum agents referred to by slot name (`claude-1`, `copilot-1`, `gemini-cli-1`, etc.) in all QGSD output "
- SLOT-02: model=.planning/formal/tla/QGSDRecruiting.tla property=TypeOK text="Migration script renames existing `~/.claude.json` mcpServers entries from model-based names to slot names automatically"
</objective>

<tasks>
<task type="auto">
  <name>Implement stubs: PROV-03, REDACT-01, REDACT-02, REDACT-03, SCBD-01, SCBD-02, SCBD-03, SCHEMA-01, SCHEMA-03, SCHEMA-04, SENS-01, SENS-02, SENS-03, SLOT-01, SLOT-02</name>
  <files>.planning/formal/generated-stubs/PROV-03.stub.test.js, .planning/formal/generated-stubs/REDACT-01.stub.test.js, .planning/formal/generated-stubs/REDACT-02.stub.test.js, .planning/formal/generated-stubs/REDACT-03.stub.test.js, .planning/formal/generated-stubs/SCBD-01.stub.test.js, .planning/formal/generated-stubs/SCBD-02.stub.test.js, .planning/formal/generated-stubs/SCBD-03.stub.test.js, .planning/formal/generated-stubs/SCHEMA-01.stub.test.js, .planning/formal/generated-stubs/SCHEMA-03.stub.test.js, .planning/formal/generated-stubs/SCHEMA-04.stub.test.js, .planning/formal/generated-stubs/SENS-01.stub.test.js, .planning/formal/generated-stubs/SENS-02.stub.test.js, .planning/formal/generated-stubs/SENS-03.stub.test.js, .planning/formal/generated-stubs/SLOT-01.stub.test.js, .planning/formal/generated-stubs/SLOT-02.stub.test.js</files>
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
  <verify>Run: node --test .planning/formal/generated-stubs/PROV-03.stub.test.js .planning/formal/generated-stubs/REDACT-01.stub.test.js .planning/formal/generated-stubs/REDACT-02.stub.test.js .planning/formal/generated-stubs/REDACT-03.stub.test.js .planning/formal/generated-stubs/SCBD-01.stub.test.js .planning/formal/generated-stubs/SCBD-02.stub.test.js .planning/formal/generated-stubs/SCBD-03.stub.test.js .planning/formal/generated-stubs/SCHEMA-01.stub.test.js .planning/formal/generated-stubs/SCHEMA-03.stub.test.js .planning/formal/generated-stubs/SCHEMA-04.stub.test.js .planning/formal/generated-stubs/SENS-01.stub.test.js .planning/formal/generated-stubs/SENS-02.stub.test.js .planning/formal/generated-stubs/SENS-03.stub.test.js .planning/formal/generated-stubs/SLOT-01.stub.test.js .planning/formal/generated-stubs/SLOT-02.stub.test.js</verify>
  <done>No assert.fail('TODO') remains. Each stub has real test logic.</done>
</task>
</tasks>
