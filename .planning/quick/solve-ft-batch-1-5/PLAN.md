---
phase: solve-ft-batch-1-5
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - .planning/formal/generated-stubs/SOLVE-04.stub.test.js
  - .planning/formal/generated-stubs/SOLVE-05.stub.test.js
  - .planning/formal/generated-stubs/SOLVE-06.stub.test.js
  - .planning/formal/generated-stubs/SOLVE-7.stub.test.js
  - .planning/formal/generated-stubs/DISP-01.stub.test.js
  - .planning/formal/generated-stubs/DISP-02.stub.test.js
  - .planning/formal/generated-stubs/DISP-03.stub.test.js
  - .planning/formal/generated-stubs/DISP-04.stub.test.js
  - .planning/formal/generated-stubs/DISP-05.stub.test.js
  - .planning/formal/generated-stubs/DISP-06.stub.test.js
  - .planning/formal/generated-stubs/MCP-01.stub.test.js
  - .planning/formal/generated-stubs/MCP-02.stub.test.js
  - .planning/formal/generated-stubs/MCP-03.stub.test.js
  - .planning/formal/generated-stubs/MCP-04.stub.test.js
  - .planning/formal/generated-stubs/MCP-05.stub.test.js
autonomous: true
requirements: [SOLVE-04, SOLVE-05, SOLVE-06, SOLVE-7, DISP-01, DISP-02, DISP-03, DISP-04, DISP-05, DISP-06, MCP-01, MCP-02, MCP-03, MCP-04, MCP-05]
formal_artifacts: none
---

<objective>
Implement 15 test stubs for batch 5.

For each stub, read the formal model and requirement text, then replace
assert.fail('TODO') with real test logic using node:test + node:assert/strict.

Formal context:
- SOLVE-04: model=.planning/formal/alloy/solver-doc-layers.als property=Requirement text="Scope R→D gap detection to developer-category documentation files (docs/dev/) and automatically dispatch /qgsd:quick bat"
- SOLVE-05: model=.planning/formal/alloy/solver-portability.als property=Bool text="When qgsd:solve runs in another project, run-formal-verify.cjs discovers and verifies that project's formal models (from"
- SOLVE-06: model=.planning/formal/alloy/solver-portability.als property=Bool text="qgsd-solve diagnostic engine provides reverse traceability sweeps (C→R, T→R, D→R) that discover implementation artifacts"
- SOLVE-7: model=.planning/formal/alloy/solve-ft-recipe.als property=Bool text="The solve F->T remediation pipeline SHALL provide pre-resolved context (requirement text, formal property definition, so"
- DISP-01: model=.planning/formal/tla/QGSDDispatchPipeline.tla property=HealthProbe text="qgsd-prompt.js runs a fast health probe (<3s) per provider before building the dispatch list -- dead providers' slots ex"
- DISP-02: model=.planning/formal/tla/QGSDDispatchPipeline.tla property=AvailabilityFilter text="qgsd-prompt.js reads scoreboard `availability` windows and excludes slots whose `available_at` is in the future from dis"
- DISP-03: model=.planning/formal/tla/QGSDDispatchPipeline.tla property=SuccessRateSort text="Dispatch list ordered by recent success rate (from scoreboard slot stats) rather than static FALLBACK-01 tier sequence -"
- DISP-04: model=.planning/formal/tla/QGSDDispatchPipeline.tla property=PromptBuild text="Prompt construction (Mode A/B, Round 1/2+, artifact injection, prior_positions, review_context, improvements request) ha"
- DISP-05: model=.planning/formal/tla/QGSDDispatchPipeline.tla property=ParseOutput text="Output parsing (verdict, reasoning, citations, improvements extraction from raw CLI output) happens in JavaScript with s"
- DISP-06: model=.planning/formal/alloy/dispatch-formal-context.als property=Bool text="Quorum dispatch prompts inject a matched subset of formal requirements (from .planning/formal/requirements.json) based o"
- MCP-01: model=.planning/formal/alloy/mcp-detection.als property=MCPServer text="Installer reads `~/.claude.json` to auto-detect MCP server names for Codex, Gemini, OpenCode"
- MCP-02: model=.planning/formal/alloy/mcp-detection.als property=MCPServer text="Detection matches server names containing "codex", "gemini", "opencode" (case-insensitive keyword match)"
- MCP-03: model=.planning/formal/alloy/mcp-detection.als property=MCPServer text="Detected names written to `~/.claude/qgsd.json` as `required_models` on install"
- MCP-04: model=.planning/formal/alloy/mcp-detection.als property=MCPServer text="If detection finds no matching servers, installer falls back to hardcoded defaults: `mcp__codex-cli__`, `mcp__gemini-cli"
- MCP-05: model=.planning/formal/alloy/mcp-detection.als property=MCPServer text="User can manually edit `qgsd.json` to override detected names"
</objective>

<tasks>
<task type="auto">
  <name>Implement stubs: SOLVE-04, SOLVE-05, SOLVE-06, SOLVE-7, DISP-01, DISP-02, DISP-03, DISP-04, DISP-05, DISP-06, MCP-01, MCP-02, MCP-03, MCP-04, MCP-05</name>
  <files>.planning/formal/generated-stubs/SOLVE-04.stub.test.js, .planning/formal/generated-stubs/SOLVE-05.stub.test.js, .planning/formal/generated-stubs/SOLVE-06.stub.test.js, .planning/formal/generated-stubs/SOLVE-7.stub.test.js, .planning/formal/generated-stubs/DISP-01.stub.test.js, .planning/formal/generated-stubs/DISP-02.stub.test.js, .planning/formal/generated-stubs/DISP-03.stub.test.js, .planning/formal/generated-stubs/DISP-04.stub.test.js, .planning/formal/generated-stubs/DISP-05.stub.test.js, .planning/formal/generated-stubs/DISP-06.stub.test.js, .planning/formal/generated-stubs/MCP-01.stub.test.js, .planning/formal/generated-stubs/MCP-02.stub.test.js, .planning/formal/generated-stubs/MCP-03.stub.test.js, .planning/formal/generated-stubs/MCP-04.stub.test.js, .planning/formal/generated-stubs/MCP-05.stub.test.js</files>
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
  <verify>Run: node --test .planning/formal/generated-stubs/SOLVE-04.stub.test.js .planning/formal/generated-stubs/SOLVE-05.stub.test.js .planning/formal/generated-stubs/SOLVE-06.stub.test.js .planning/formal/generated-stubs/SOLVE-7.stub.test.js .planning/formal/generated-stubs/DISP-01.stub.test.js .planning/formal/generated-stubs/DISP-02.stub.test.js .planning/formal/generated-stubs/DISP-03.stub.test.js .planning/formal/generated-stubs/DISP-04.stub.test.js .planning/formal/generated-stubs/DISP-05.stub.test.js .planning/formal/generated-stubs/DISP-06.stub.test.js .planning/formal/generated-stubs/MCP-01.stub.test.js .planning/formal/generated-stubs/MCP-02.stub.test.js .planning/formal/generated-stubs/MCP-03.stub.test.js .planning/formal/generated-stubs/MCP-04.stub.test.js .planning/formal/generated-stubs/MCP-05.stub.test.js</verify>
  <done>No assert.fail('TODO') remains. Each stub has real test logic.</done>
</task>
</tasks>
