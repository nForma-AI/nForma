---
phase: solve-ft-batch-1-1
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - .planning/formal/generated-stubs/CONF-01.stub.test.js
  - .planning/formal/generated-stubs/CONF-02.stub.test.js
  - .planning/formal/generated-stubs/CONF-03.stub.test.js
  - .planning/formal/generated-stubs/CONF-04.stub.test.js
  - .planning/formal/generated-stubs/CONF-05.stub.test.js
  - .planning/formal/generated-stubs/CONF-06.stub.test.js
  - .planning/formal/generated-stubs/CONF-07.stub.test.js
  - .planning/formal/generated-stubs/CONF-08.stub.test.js
  - .planning/formal/generated-stubs/CONF-09.stub.test.js
  - .planning/formal/generated-stubs/CONF-10.stub.test.js
  - .planning/formal/generated-stubs/CONF-11.stub.test.js
  - .planning/formal/generated-stubs/CONF-12.stub.test.js
  - .planning/formal/generated-stubs/INST-01.stub.test.js
  - .planning/formal/generated-stubs/INST-02.stub.test.js
  - .planning/formal/generated-stubs/INST-03.stub.test.js
autonomous: true
requirements: [CONF-01, CONF-02, CONF-03, CONF-04, CONF-05, CONF-06, CONF-07, CONF-08, CONF-09, CONF-10, CONF-11, CONF-12, INST-01, INST-02, INST-03]
formal_artifacts: none
---

<objective>
Implement 15 test stubs for batch 1.

For each stub, read the formal model and requirement text, then replace
assert.fail('TODO') with real test logic using node:test + node:assert/strict.

Formal context:
- CONF-01: model=.planning/formal/alloy/config-two-layer.als property=ConfigLayer text="Global config at `~/.claude/qgsd.json` — installed once, applies to all projects"
- CONF-02: model=.planning/formal/alloy/config-two-layer.als property=ConfigLayer text="Per-project override at `.claude/qgsd.json` — merged with global, project values take precedence"
- CONF-03: model=.planning/formal/alloy/config-two-layer.als property=ConfigLayer text="Config contains: `quorum_commands` (array of command names), `required_models` (dict of MCP tool entries: { tool_prefix,"
- CONF-04: model=.planning/formal/alloy/config-two-layer.als property=ConfigLayer text="Fail-open behavior: when a quorum model is unavailable, Stop hook passes and logs reduced quorum notification"
- CONF-05: model=.planning/formal/alloy/config-two-layer.als property=ConfigLayer text="Config validates on read — malformed config falls back to hardcoded defaults with warning"
- CONF-06: model=.planning/formal/alloy/config-two-layer.als property=ConfigLayer text="qgsd.json schema extended with `circuit_breaker.oscillation_depth` (integer, default: 3) — minimum commits touching same"
- CONF-07: model=.planning/formal/alloy/config-two-layer.als property=ConfigLayer text="qgsd.json schema extended with `circuit_breaker.commit_window` (integer, default: 6) — number of recent commits to analy"
- CONF-08: model=.planning/formal/alloy/config-two-layer.als property=ConfigLayer text="Circuit breaker config values validated on load; invalid values fall back to defaults with stderr warning"
- CONF-09: model=.planning/formal/alloy/config-two-layer.als property=ConfigLayer text="Two-layer config merge (global + project) applies to `circuit_breaker` settings identically to existing merge behavior"
- CONF-10: model=.planning/formal/alloy/config-zero-providers.als property=Bool text="Configuration layer validates and gracefully degrades when providers.json contains zero providers, falling back to solo "
- CONF-11: model=.planning/formal/alloy/polyrepo-config.als property=PolyrepoGroup text="Global polyrepo registry at ~/.claude/polyrepos/<name>.json and per-repo marker at .planning/polyrepo.json enable named "
- CONF-12: model=.planning/formal/alloy/polyrepo-config.als property=PolyrepoGroup text="Per-repo marker at .planning/polyrepo.json supports an optional `docs` field with merge-semantic key-value pairs (user, "
- INST-01: model=.planning/formal/alloy/install-scope.als property=NoConflict text="Installer detects no configured quorum agents and prompts user to run `/qgsd:mcp-setup`"
- INST-02: model=.planning/formal/alloy/install-scope.als property=AllEquivalence text="QGSD's package.json pins GSD version — version lockstep ensures hook compatibility"
- INST-03: model=.planning/formal/alloy/install-scope.als property=InstallIdempotent text="Installer writes hooks to `~/.claude/settings.json` directly (not plugin.json hooks — stdout is silently discarded per G"
</objective>

<tasks>
<task type="auto">
  <name>Implement stubs: CONF-01, CONF-02, CONF-03, CONF-04, CONF-05, CONF-06, CONF-07, CONF-08, CONF-09, CONF-10, CONF-11, CONF-12, INST-01, INST-02, INST-03</name>
  <files>.planning/formal/generated-stubs/CONF-01.stub.test.js, .planning/formal/generated-stubs/CONF-02.stub.test.js, .planning/formal/generated-stubs/CONF-03.stub.test.js, .planning/formal/generated-stubs/CONF-04.stub.test.js, .planning/formal/generated-stubs/CONF-05.stub.test.js, .planning/formal/generated-stubs/CONF-06.stub.test.js, .planning/formal/generated-stubs/CONF-07.stub.test.js, .planning/formal/generated-stubs/CONF-08.stub.test.js, .planning/formal/generated-stubs/CONF-09.stub.test.js, .planning/formal/generated-stubs/CONF-10.stub.test.js, .planning/formal/generated-stubs/CONF-11.stub.test.js, .planning/formal/generated-stubs/CONF-12.stub.test.js, .planning/formal/generated-stubs/INST-01.stub.test.js, .planning/formal/generated-stubs/INST-02.stub.test.js, .planning/formal/generated-stubs/INST-03.stub.test.js</files>
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
  <verify>Run: node --test .planning/formal/generated-stubs/CONF-01.stub.test.js .planning/formal/generated-stubs/CONF-02.stub.test.js .planning/formal/generated-stubs/CONF-03.stub.test.js .planning/formal/generated-stubs/CONF-04.stub.test.js .planning/formal/generated-stubs/CONF-05.stub.test.js .planning/formal/generated-stubs/CONF-06.stub.test.js .planning/formal/generated-stubs/CONF-07.stub.test.js .planning/formal/generated-stubs/CONF-08.stub.test.js .planning/formal/generated-stubs/CONF-09.stub.test.js .planning/formal/generated-stubs/CONF-10.stub.test.js .planning/formal/generated-stubs/CONF-11.stub.test.js .planning/formal/generated-stubs/CONF-12.stub.test.js .planning/formal/generated-stubs/INST-01.stub.test.js .planning/formal/generated-stubs/INST-02.stub.test.js .planning/formal/generated-stubs/INST-03.stub.test.js</verify>
  <done>No assert.fail('TODO') remains. Each stub has real test logic.</done>
</task>
</tasks>
