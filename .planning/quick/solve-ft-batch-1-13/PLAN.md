---
phase: solve-ft-batch-1-13
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - .planning/formal/generated-stubs/MULTI-03.stub.test.js
  - .planning/formal/generated-stubs/NAV-01.stub.test.js
  - .planning/formal/generated-stubs/NAV-02.stub.test.js
  - .planning/formal/generated-stubs/NAV-03.stub.test.js
  - .planning/formal/generated-stubs/PLAN-01.stub.test.js
  - .planning/formal/generated-stubs/PLAN-02.stub.test.js
  - .planning/formal/generated-stubs/PLAN-03.stub.test.js
  - .planning/formal/generated-stubs/PLCY-01.stub.test.js
  - .planning/formal/generated-stubs/PLCY-02.stub.test.js
  - .planning/formal/generated-stubs/PLCY-03.stub.test.js
  - .planning/formal/generated-stubs/PORT-01.stub.test.js
  - .planning/formal/generated-stubs/PORT-02.stub.test.js
  - .planning/formal/generated-stubs/PORT-03.stub.test.js
  - .planning/formal/generated-stubs/PROV-01.stub.test.js
  - .planning/formal/generated-stubs/PROV-02.stub.test.js
autonomous: true
requirements: [MULTI-03, NAV-01, NAV-02, NAV-03, PLAN-01, PLAN-02, PLAN-03, PLCY-01, PLCY-02, PLCY-03, PORT-01, PORT-02, PORT-03, PROV-01, PROV-02]
formal_artifacts: none
---

<objective>
Implement 15 test stubs for batch 13.

For each stub, read the formal model and requirement text, then replace
assert.fail('TODO') with real test logic using node:test + node:assert/strict.

Formal context:
- MULTI-03: model=.planning/formal/alloy/multi-slot-structure.als property=AgentFamily text="Adding a new slot of any family is supported by both direct config edit and via the mcp-setup wizard"
- NAV-01: model=.planning/formal/tla/QGSDTUIModules.tla property=TypeOK text="Main TUI menu is organized into 3 modules (Agents, Requirements, Config) with a 6-character activity bar sidebar showing"
- NAV-02: model=.planning/formal/tla/QGSDTUISessions.tla property=TypeOK text="Sessions module (F4) in nForma TUI embeds interactive Claude Code terminal sessions via blessed-xterm, supporting creati"
- NAV-03: model=.planning/formal/alloy/terminal-emulation-purity.als property=DependencyType text="Sessions terminal widget uses pure-JavaScript @xterm/headless terminal emulation with child_process.spawn, eliminating n"
- PLAN-01: model=.planning/formal/tla/QGSDDeliberation.tla property=TypeOK text="`generate-proposed-changes.cjs` auto-synthesizes TLA+ deltas from PLAN.md truths"
- PLAN-02: model=.planning/formal/tla/QGSDDeliberation.tla property=ProtocolTerminates text="`run-phase-tlc.cjs` provides iterative TLC verification loop gating planning (3-attempt cap)"
- PLAN-03: model=.planning/formal/tla/QGSDPreFilter.tla property=TypeOK text="`quorum-formal-context.cjs` generates formal evidence blocks for quorum slots"
- PLCY-01: model=.planning/formal/alloy/quorum-policy.als property=UpdatePolicy text="User can set quorum timeout (ms) per slot from a dedicated menu shortcut — not buried inside editAgent"
- PLCY-02: model=.planning/formal/alloy/quorum-policy.als property=UpdatePolicy text="User can configure update policy per slot: auto / prompt / skip"
- PLCY-03: model=.planning/formal/alloy/quorum-policy.als property=UpdatePolicy text="Auto-update policy check runs on manage-agents startup for slots configured as `auto`"
- PORT-01: model=.planning/formal/tla/QGSDConfigPortability.tla property=ExportConfig text="User can export full roster config to a portable JSON file — all API key values replaced with `__redacted__` placeholder"
- PORT-02: model=.planning/formal/tla/QGSDConfigPortability.tla property=StartImport text="User can import roster config from JSON file — validates schema, prompts to re-enter any redacted key, confirms before a"
- PORT-03: model=.planning/formal/tla/QGSDConfigPortability.tla property=CreateBackup text="Import creates a timestamped backup of `~/.claude.json` before applying any changes"
- PROV-01: model=.planning/formal/tla/QGSDAgentProvisioning.tla property=ChangeProvider text="User can change the base URL (provider) for an existing agent"
- PROV-02: model=.planning/formal/tla/QGSDAgentProvisioning.tla property=AddAgent text="Wizard offers curated provider list (AkashML, Together.xyz, Fireworks) + custom entry"
</objective>

<tasks>
<task type="auto">
  <name>Implement stubs: MULTI-03, NAV-01, NAV-02, NAV-03, PLAN-01, PLAN-02, PLAN-03, PLCY-01, PLCY-02, PLCY-03, PORT-01, PORT-02, PORT-03, PROV-01, PROV-02</name>
  <files>.planning/formal/generated-stubs/MULTI-03.stub.test.js, .planning/formal/generated-stubs/NAV-01.stub.test.js, .planning/formal/generated-stubs/NAV-02.stub.test.js, .planning/formal/generated-stubs/NAV-03.stub.test.js, .planning/formal/generated-stubs/PLAN-01.stub.test.js, .planning/formal/generated-stubs/PLAN-02.stub.test.js, .planning/formal/generated-stubs/PLAN-03.stub.test.js, .planning/formal/generated-stubs/PLCY-01.stub.test.js, .planning/formal/generated-stubs/PLCY-02.stub.test.js, .planning/formal/generated-stubs/PLCY-03.stub.test.js, .planning/formal/generated-stubs/PORT-01.stub.test.js, .planning/formal/generated-stubs/PORT-02.stub.test.js, .planning/formal/generated-stubs/PORT-03.stub.test.js, .planning/formal/generated-stubs/PROV-01.stub.test.js, .planning/formal/generated-stubs/PROV-02.stub.test.js</files>
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
  <verify>Run: node --test .planning/formal/generated-stubs/MULTI-03.stub.test.js .planning/formal/generated-stubs/NAV-01.stub.test.js .planning/formal/generated-stubs/NAV-02.stub.test.js .planning/formal/generated-stubs/NAV-03.stub.test.js .planning/formal/generated-stubs/PLAN-01.stub.test.js .planning/formal/generated-stubs/PLAN-02.stub.test.js .planning/formal/generated-stubs/PLAN-03.stub.test.js .planning/formal/generated-stubs/PLCY-01.stub.test.js .planning/formal/generated-stubs/PLCY-02.stub.test.js .planning/formal/generated-stubs/PLCY-03.stub.test.js .planning/formal/generated-stubs/PORT-01.stub.test.js .planning/formal/generated-stubs/PORT-02.stub.test.js .planning/formal/generated-stubs/PORT-03.stub.test.js .planning/formal/generated-stubs/PROV-01.stub.test.js .planning/formal/generated-stubs/PROV-02.stub.test.js</verify>
  <done>No assert.fail('TODO') remains. Each stub has real test logic.</done>
</task>
</tasks>
