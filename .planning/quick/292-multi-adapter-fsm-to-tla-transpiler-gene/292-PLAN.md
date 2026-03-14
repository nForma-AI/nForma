---
phase: quick-292
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - bin/adapters/ir.cjs
  - bin/adapters/ir.test.cjs
  - bin/adapters/emitter-tla.cjs
  - bin/adapters/emitter-tla.test.cjs
  - bin/adapters/xstate-v5.cjs
  - bin/adapters/xstate-v5.test.cjs
  - bin/adapters/detect.cjs
  - bin/adapters/detect.test.cjs
  - bin/adapters/registry-update.cjs
  - bin/adapters/scaffold-config.cjs
  - bin/adapters/scaffold-config.test.cjs
  - bin/adapters/xstate-v4.cjs
  - bin/adapters/xstate-v4.test.cjs
  - bin/adapters/jsm.cjs
  - bin/adapters/jsm.test.cjs
  - bin/adapters/robot.cjs
  - bin/adapters/robot.test.cjs
  - bin/adapters/asl.cjs
  - bin/adapters/asl.test.cjs
  - bin/adapters/stately.cjs
  - bin/adapters/stately.test.cjs
  - bin/adapters/python-transitions.cjs
  - bin/adapters/python-transitions.test.cjs
  - bin/adapters/sismic.cjs
  - bin/adapters/sismic.test.cjs
  - bin/adapters/looplab-fsm.cjs
  - bin/adapters/looplab-fsm.test.cjs
  - bin/adapters/qmuntal-stateless.cjs
  - bin/adapters/qmuntal-stateless.test.cjs
  - bin/fsm-to-tla.cjs
  - bin/fsm-to-tla.test.cjs
  - bin/xstate-to-tla.cjs
  - bin/generate-formal-specs.cjs
  - hooks/nf-spec-regen.js
  - hooks/dist/nf-spec-regen.js
  - package.json
autonomous: true
formal_artifacts: none
requirements: []

must_haves:
  truths:
    - "Any XState v5 machine file produces identical TLA+ output via both old (xstate-to-tla.cjs) and new (fsm-to-tla.cjs) CLI paths"
    - "Each of the 10 adapters can parse an inline fixture string into a valid MachineIR that passes validateIR()"
    - "Auto-detection picks the correct adapter for each framework's source format"
    - "The spec-regen hook triggers fsm-to-tla.cjs for configurable file patterns, not just nf-workflow.machine.ts"
    - "Existing test suite (xstate-to-tla.test.cjs) continues to pass unchanged"
    - "generate-formal-specs.cjs uses shared registry-update.cjs for model registry writes"
  artifacts:
    - path: "bin/adapters/ir.cjs"
      provides: "MachineIR schema definition and validateIR() validator"
      exports: ["MachineIR", "validateIR"]
    - path: "bin/adapters/emitter-tla.cjs"
      provides: "TLA+ emitter consuming MachineIR"
      exports: ["emitTLA"]
    - path: "bin/adapters/xstate-v5.cjs"
      provides: "XState v5 adapter"
      exports: ["id", "name", "extensions", "detect", "extract"]
    - path: "bin/fsm-to-tla.cjs"
      provides: "Unified CLI entry point for all adapters"
      min_lines: 80
    - path: "bin/adapters/detect.cjs"
      provides: "Auto-detection registry running all adapters"
      exports: ["detectFramework", "listAdapters"]
    - path: "bin/adapters/registry-update.cjs"
      provides: "Shared updateModelRegistry extracted from generate-formal-specs.cjs"
      exports: ["updateModelRegistry"]
  key_links:
    - from: "bin/fsm-to-tla.cjs"
      to: "bin/adapters/detect.cjs"
      via: "require + detectFramework()"
      pattern: "require.*detect"
    - from: "bin/fsm-to-tla.cjs"
      to: "bin/adapters/emitter-tla.cjs"
      via: "require + emitTLA(ir)"
      pattern: "require.*emitter-tla"
    - from: "bin/xstate-to-tla.cjs"
      to: "bin/fsm-to-tla.cjs"
      via: "spawnSync delegation"
      pattern: "fsm-to-tla"
    - from: "hooks/nf-spec-regen.js"
      to: "bin/fsm-to-tla.cjs"
      via: "spawnSync call"
      pattern: "fsm-to-tla"
    - from: "bin/generate-formal-specs.cjs"
      to: "bin/adapters/registry-update.cjs"
      via: "require + updateModelRegistry()"
      pattern: "require.*registry-update"
    - from: "bin/adapters/xstate-v5.cjs"
      to: "bin/adapters/ir.cjs"
      via: "require + validateIR()"
      pattern: "require.*ir"
  consumers:
    - artifact: "bin/fsm-to-tla.cjs"
      consumed_by: "bin/xstate-to-tla.cjs (thin wrapper), hooks/nf-spec-regen.js, package.json scripts"
      integration: "spawnSync delegation from backward-compat wrapper and hook"
      verify_pattern: "fsm-to-tla"
    - artifact: "bin/adapters/registry-update.cjs"
      consumed_by: "bin/generate-formal-specs.cjs"
      integration: "require() replacing inline updateModelRegistry function"
      verify_pattern: "registry-update"
---

<objective>
Generalize bin/xstate-to-tla.cjs into a multi-adapter FSM-to-TLA+ transpiler supporting 10 state machine frameworks (XState v5/v4, javascript-state-machine, Robot, AWS Step Functions, Stately, Python transitions, sismic, looplab/fsm, qmuntal/stateless) via a plugin/adapter architecture with shared MachineIR.

Purpose: Enable formal verification of state machines from any framework, not just XState v5 in nForma's own repo. Every adapter parses its framework into a shared MachineIR, then a single TLA+ emitter produces the spec.

Output: 30+ new files in bin/adapters/, unified CLI bin/fsm-to-tla.cjs, backward-compatible thin wrapper, generalized hook.
</objective>

<execution_context>
@/Users/jonathanborduas/.claude/nf/workflows/execute-plan.md
@/Users/jonathanborduas/.claude/nf/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@bin/xstate-to-tla.cjs
@bin/xstate-to-tla.test.cjs
@bin/generate-formal-specs.cjs
@hooks/nf-spec-regen.js
@.planning/formal/tla/guards/nf-workflow.json
</context>

<tasks>

<!-- ═══════════════════════════════════════════════════════════════════════════ -->
<!-- WAVE 1 — Foundation: IR, Emitter, XState-v5 adapter, CLI, backward compat -->
<!-- ═══════════════════════════════════════════════════════════════════════════ -->

<task type="auto">
  <name>Task 1: Create IR schema and validateIR()</name>
  <files>bin/adapters/ir.cjs, bin/adapters/ir.test.cjs</files>
  <action>
Create `bin/adapters/` directory. Create `bin/adapters/ir.cjs` exporting:

1. `MachineIR` — JSDoc typedef (not runtime class) documenting the schema:
   ```
   {
     machineId: string,        // e.g. "nf-workflow"
     initial: string,          // initial state name
     stateNames: string[],     // all states
     finalStates: string[],    // absorbing states (may be empty)
     transitions: [{
       fromState: string,
       event: string,
       guard: string|null,     // guard name (not TLA+ expr)
       target: string|null,
       assignedKeys: string[]  // context vars modified
     }],
     ctxVars: string[],        // context variable names (post skip-filter)
     ctxDefaults: object,      // var -> default value
     sourceFile: string,       // relative path to source
     framework: string         // adapter id (e.g. "xstate-v5")
   }
   ```

2. `validateIR(ir)` — returns `{ valid: boolean, errors: string[] }`. Checks:
   - All required fields present and correct types
   - `initial` is in `stateNames`
   - `finalStates` are all in `stateNames`
   - Each transition's `fromState` is in `stateNames`
   - Each transition's `target` (if non-null) is in `stateNames`
   - `framework` is a non-empty string

Tests in `ir.test.cjs`: valid IR passes, missing fields fail, invalid references fail, empty framework fails.
  </action>
  <verify>node --test bin/adapters/ir.test.cjs</verify>
  <done>validateIR() correctly validates well-formed IR and rejects malformed IR with specific error messages.</done>
</task>

<task type="auto">
  <name>Task 2: Extract TLA+ emitter from xstate-to-tla.cjs</name>
  <files>bin/adapters/emitter-tla.cjs, bin/adapters/emitter-tla.test.cjs</files>
  <action>
Extract lines 230-484 of `bin/xstate-to-tla.cjs` (the TLA+ generation logic) into `bin/adapters/emitter-tla.cjs`.

Export `emitTLA(ir, options)` where:
- `ir` is a validated MachineIR object
- `options` is `{ moduleName, configPath, userGuards, userVars, outDir, dry, sourceFile }`
- Returns `{ tlaContent: string, cfgContent: string, tlaOutPath: string, cfgOutPath: string }`

The emitter must:
1. Require `bin/adapters/ir.cjs` and call `validateIR(ir)` — throw if invalid
2. Derive action names using the same toCamel + disambiguation logic (lines 194-228)
3. Generate TLA+ VARIABLES, TypeOK, Init, Actions, Next, Spec sections
4. Generate .cfg content
5. In non-dry mode, write files to disk and call `require('./registry-update').updateModelRegistry()` if registry-update exists (fail-open if not yet created)

Also extract helpers: `toCamel()`, `genUnchanged()`, `genAssignLine()`, `genAction()`, `genFinalSelfLoop()`.

The emitter header comment should say "GENERATED by bin/fsm-to-tla.cjs" (not xstate-to-tla.cjs).

Tests in `emitter-tla.test.cjs`: Construct a minimal MachineIR inline (3 states, 2 transitions, 1 guard, 1 ctxVar), call `emitTLA()` with `dry: true`, verify:
- tlaContent contains MODULE header
- tlaContent contains VARIABLES section with state and the ctxVar
- tlaContent contains Init with correct initial state
- cfgContent contains SPECIFICATION Spec
- Invalid IR throws
  </action>
  <verify>node --test bin/adapters/emitter-tla.test.cjs</verify>
  <done>emitTLA() produces valid TLA+ and .cfg content from any MachineIR, matching the output format of the original xstate-to-tla.cjs.</done>
</task>

<task type="auto">
  <name>Task 3: Extract XState v5 adapter</name>
  <files>bin/adapters/xstate-v5.cjs, bin/adapters/xstate-v5.test.cjs</files>
  <action>
Extract lines 97-228 of `bin/xstate-to-tla.cjs` (the XState parsing logic) into `bin/adapters/xstate-v5.cjs`.

Export the adapter contract:
- `id` = `"xstate-v5"`
- `name` = `"XState v5"`
- `extensions` = `[".ts", ".js", ".tsx", ".jsx"]`
- `detect(filePath, content)` — returns confidence 0-100:
  - 90 if content has `createMachine` AND an export with `.config.states` shape
  - 70 if content has `createMachine` import from `xstate`
  - 50 if filePath ends with `.machine.ts` or `.machine.js`
  - 0 otherwise
- `extract(filePath, options)` — uses esbuild buildSync to compile TS to temp CJS, requires it, duck-types for `v.config.states`, extracts states/transitions/guards/assignedKeys, applies options.userVars skip-filter, returns validated MachineIR

The extract function must:
1. Accept `options: { userVars, configPath }` — userVars for skip filtering
2. Use the same esbuild compile + require + duck-type pattern from current xstate-to-tla.cjs lines 97-134
3. Use the same parseTransitions() logic from lines 156-190
4. Return IR via `require('./ir').validateIR()` — throw on failure
5. Clean up temp bundle in finally block

Tests in `xstate-v5.test.cjs`:
- `detect()` returns high confidence for content with `createMachine` + `.config.states`
- `detect()` returns 0 for Python content
- `extract()` on the real machine file `src/machines/nf-workflow.machine.ts` produces valid IR with correct machineId, states, initial state (use --dry equivalent by just checking the returned IR structure)
  </action>
  <verify>node --test bin/adapters/xstate-v5.test.cjs</verify>
  <done>XState v5 adapter correctly parses the real nf-workflow.machine.ts into MachineIR matching the structure the old monolith produced.</done>
</task>

<task type="auto">
  <name>Task 4: Create auto-detection registry and scaffold-config</name>
  <files>bin/adapters/detect.cjs, bin/adapters/detect.test.cjs, bin/adapters/scaffold-config.cjs, bin/adapters/scaffold-config.test.cjs</files>
  <action>
**detect.cjs** — Auto-detection registry.

Export:
- `listAdapters()` — returns array of all adapter modules (lazy-loaded via require)
- `detectFramework(filePath, content)` — runs each adapter's `detect(filePath, content)`, returns `{ adapter, confidence }` for highest confidence above 60, or `null` if none match
- `getAdapter(frameworkId)` — returns adapter by id string, throws if not found

Adapter discovery: hardcoded require list of all 10 adapters (no filesystem scanning). Each adapter required inside the function call (lazy) so missing adapters fail-open with a warning.

**scaffold-config.cjs** — Generates starter config JSON.

Export `scaffoldConfig(ir)`:
- Takes a MachineIR, produces a JSON object matching the config format in `.planning/formal/tla/guards/nf-workflow.json`
- For each unique guard name in transitions: `guards[guardName] = "TRUE  \\* FIXME: provide TLA+ expression for <guardName>"`
- For each ctxVar: `vars[varName] = "FIXME: 'skip' | 'const' | 'event' | TLA+ expression"`
- Returns the object (caller writes to disk)

Tests:
- detect.test.cjs: `detectFramework()` on XState content returns xstate-v5 with high confidence; on unknown content returns null; `getAdapter("xstate-v5")` returns adapter with correct id
- scaffold-config.test.cjs: Given IR with 2 guards and 3 vars, output has correct FIXME entries
  </action>
  <verify>node --test bin/adapters/detect.test.cjs && node --test bin/adapters/scaffold-config.test.cjs</verify>
  <done>Auto-detection correctly identifies XState v5 sources and scaffold generates valid starter configs.</done>
</task>

<task type="auto">
  <name>Task 5: Create registry-update shared module</name>
  <files>bin/adapters/registry-update.cjs</files>
  <action>
Extract the `updateModelRegistry()` function from `bin/generate-formal-specs.cjs` lines 45-76 into `bin/adapters/registry-update.cjs`.

Export `updateModelRegistry(absPath, options)` where options is `{ dry, projectRoot }`:
- `dry` — if true, skip (same as current behavior)
- `projectRoot` — defaults to `path.join(__dirname, '..', '..')` (the repo root)
- Same logic: reads model-registry.json, bumps version, atomic write via tmp+rename
- Fail-open: warns and returns if registry not found

No separate test file needed — this is a pure extraction with no logic changes. It will be verified by the existing test suite and the emitter-tla tests.
  </action>
  <verify>node -c bin/adapters/registry-update.cjs</verify>
  <done>Shared registry-update module exports updateModelRegistry with same behavior as the inline version in generate-formal-specs.cjs.</done>
</task>

<task type="auto">
  <name>Task 6: Create unified CLI entry point bin/fsm-to-tla.cjs</name>
  <files>bin/fsm-to-tla.cjs, bin/fsm-to-tla.test.cjs</files>
  <action>
Create `bin/fsm-to-tla.cjs` as the unified CLI entry point. Shebang: `#!/usr/bin/env node`.

CLI flags (parsed from process.argv):
- `<source-file>` — positional, required
- `--framework=<id>` — optional, auto-detect if omitted
- `--module=<ModuleName>` — optional, derived from machineId if omitted
- `--config=<guards-and-vars.json>` — optional
- `--out-dir=<path>` — default `.planning/formal/tla`
- `--scaffold-config` — print starter config JSON and exit
- `--dry` — print output without writing files
- `--detect` — print detected framework + confidence and exit

Flow:
1. Parse CLI args
2. Read source file content
3. If `--framework` given, use `getAdapter(framework)`. Else call `detectFramework()`.
4. If `--detect`, print `{ framework: adapter.id, confidence: N }` and exit.
5. Load config JSON if `--config` provided (parse guards + vars).
6. Call `adapter.extract(filePath, { userVars, configPath })` to get MachineIR.
7. If `--scaffold-config`, call `scaffoldConfig(ir)`, print JSON, exit.
8. Derive moduleName from `--module` or machineId.
9. Call `emitTLA(ir, { moduleName, configPath, userGuards, userVars, outDir, dry, sourceFile })`.
10. Print summary (states, actions, unresolved guards).

Tests in `fsm-to-tla.test.cjs`:
- No args exits with status 1 and usage message
- Nonexistent file exits with status 1
- `--detect` on `src/machines/nf-workflow.machine.ts` prints xstate-v5
- `--dry` on `src/machines/nf-workflow.machine.ts --module=NFQuorum --config=.planning/formal/tla/guards/nf-workflow.json` produces output containing "MODULE NFQuorum_xstate"
- `--scaffold-config` on `src/machines/nf-workflow.machine.ts` produces JSON with guards and vars keys
  </action>
  <verify>node --test bin/fsm-to-tla.test.cjs</verify>
  <done>Unified CLI correctly delegates to adapters, produces identical TLA+ output for XState v5 machines, and supports all documented flags.</done>
</task>

<task type="auto">
  <name>Task 7: Convert xstate-to-tla.cjs to thin wrapper</name>
  <files>bin/xstate-to-tla.cjs</files>
  <action>
Replace the entire contents of `bin/xstate-to-tla.cjs` (currently 484 lines) with a thin wrapper (~30 lines) that delegates to `bin/fsm-to-tla.cjs`.

The wrapper must:
1. Keep the shebang `#!/usr/bin/env node`
2. Forward all CLI args to `bin/fsm-to-tla.cjs` with `--framework=xstate-v5` prepended
3. Use `spawnSync(process.execPath, [fsmToTla, '--framework=xstate-v5', ...process.argv.slice(2)], { stdio: 'inherit' })`
4. Exit with the child's exit code
5. Include a header comment: "Thin backward-compat wrapper. Delegates to bin/fsm-to-tla.cjs --framework=xstate-v5"

After this change, verify the existing test suite still passes:
- `node --test bin/xstate-to-tla.test.cjs` must pass (same error-path behavior)
- `node bin/xstate-to-tla.cjs src/machines/nf-workflow.machine.ts --module=NFQuorum --config=.planning/formal/tla/guards/nf-workflow.json --dry` must produce output containing "MODULE NFQuorum_xstate"
  </action>
  <verify>node --test bin/xstate-to-tla.test.cjs && node bin/xstate-to-tla.cjs src/machines/nf-workflow.machine.ts --module=NFQuorum --config=.planning/formal/tla/guards/nf-workflow.json --dry 2>&1 | grep -q "MODULE NFQuorum_xstate"</verify>
  <done>xstate-to-tla.cjs is a thin wrapper; existing tests pass; --dry output matches original format.</done>
</task>

<!-- ═══════════════════════════════════════════════════════════════════════════ -->
<!-- WAVE 2 — JS/JSON adapters (5 adapters, all independent)                   -->
<!-- ═══════════════════════════════════════════════════════════════════════════ -->

<task type="auto">
  <name>Task 8: Create XState v4 adapter</name>
  <files>bin/adapters/xstate-v4.cjs, bin/adapters/xstate-v4.test.cjs</files>
  <action>
Create `bin/adapters/xstate-v4.cjs` implementing the adapter contract.

- `id` = `"xstate-v4"`
- `name` = `"XState v4"`
- `extensions` = `[".ts", ".js", ".tsx", ".jsx"]`
- `detect(filePath, content)`:
  - 85 if content has `Machine({` or `createMachine({` AND has `states:` at top level (v4 shape: no `.config` wrapper, `Machine` import from `xstate`)
  - 60 if has `Machine(` import from `xstate`
  - 0 otherwise
- `extract(filePath, options)`:
  - Use esbuild compile + require (same as v5)
  - Duck-type: find export `v` where `v.states` exists directly (not `v.config.states`)
  - OR find export where `v` is result of `Machine()` — has `.initialState` property
  - Walk `v.states` for state definitions, `v.initial` for initial state
  - Parse transitions from `stateDef.on` entries (same structure as v5 but no `.config` wrapper)
  - Context from `v.context` (v4) instead of `v.config.context`
  - Return validated MachineIR with `framework: "xstate-v4"`

Tests using inline fixture STRING (no actual XState v4 runtime). Write a temp .js file with a mock object literal that matches v4's duck-type shape:
```javascript
const fixture = `module.exports = { initial: "idle", states: { idle: { on: { START: { target: "running" } } }, running: { on: { STOP: { target: "idle" } } } }, context: {} };`;
```
Write to tmp file, call extract(), verify IR has correct states and transitions.
  </action>
  <verify>node --test bin/adapters/xstate-v4.test.cjs</verify>
  <done>XState v4 adapter parses v4-shaped machine objects into valid MachineIR.</done>
</task>

<task type="auto">
  <name>Task 9: Create javascript-state-machine (JSM) adapter</name>
  <files>bin/adapters/jsm.cjs, bin/adapters/jsm.test.cjs</files>
  <action>
Create `bin/adapters/jsm.cjs` for the `javascript-state-machine` library.

- `id` = `"jsm"`
- `name` = `"javascript-state-machine"`
- `extensions` = `[".js", ".ts", ".mjs"]`
- `detect(filePath, content)`:
  - 85 if content has `transitions:` array with objects containing `{ name, from, to }`
  - 70 if content has `require('javascript-state-machine')` or `from 'javascript-state-machine'`
  - 0 otherwise
- `extract(filePath, options)`:
  - Use esbuild compile + require
  - Duck-type: find export with `.transitions` array where items have `{ name, from, to }` properties
  - `initial` from export's `init` property
  - States: union of all `from` and `to` values across transitions
  - Transitions: map each `{ name, from, to }` to IR transition `{ fromState: from, event: name, guard: null, target: to, assignedKeys: [] }`
  - Handle array `from` (JSM supports `from: ["s1", "s2"]`) — expand to multiple transitions
  - `ctxVars: []`, `ctxDefaults: {}` (JSM has no built-in context)
  - Return validated MachineIR with `framework: "jsm"`

Tests using inline fixture:
```javascript
const fixture = `module.exports = { init: "green", transitions: [ { name: "warn", from: "green", to: "yellow" }, { name: "stop", from: "yellow", to: "red" }, { name: "go", from: "red", to: "green" } ] };`;
```
Verify: 3 states, 3 transitions, correct initial state.
  </action>
  <verify>node --test bin/adapters/jsm.test.cjs</verify>
  <done>JSM adapter correctly parses javascript-state-machine config into valid MachineIR.</done>
</task>

<task type="auto">
  <name>Task 10: Create Robot adapter</name>
  <files>bin/adapters/robot.cjs, bin/adapters/robot.test.cjs</files>
  <action>
Create `bin/adapters/robot.cjs` for the Robot state machine library.

- `id` = `"robot"`
- `name` = `"Robot"`
- `extensions` = `[".js", ".ts", ".mjs"]`
- `detect(filePath, content)`:
  - 80 if content has `createMachine` AND `state(` AND `transition(` (Robot's functional API)
  - 70 if content has `from 'robot3'` or `require('robot3')`
  - 0 otherwise
- `extract(filePath, options)`:
  - **Regex-based extraction** (Robot's functional API is hard to duck-type at runtime):
  - Read file content as string
  - Extract state names: regex for `state\s*\(\s*['"](\w+)['"]` — captures state name
  - Extract transitions: regex for `transition\s*\(\s*['"](\w+)['"]\s*,\s*['"](\w+)['"]` — captures (event, targetState)
  - Associate transitions with their parent state by tracking which `state()` block they appear in
  - Initial state: first `state()` call, or look for `initial:` property
  - `ctxVars: []`, `ctxDefaults: {}` (Robot context is functional, not easily extractable)
  - Return validated MachineIR with `framework: "robot"`

Tests using inline fixture string:
```javascript
const fixture = `
import { createMachine, state, transition } from 'robot3';
const machine = createMachine({
  idle: state(transition('start', 'running')),
  running: state(transition('stop', 'idle'), transition('finish', 'done')),
  done: state()
});`;
```
Verify: 3 states, 3 transitions, initial = "idle".
  </action>
  <verify>node --test bin/adapters/robot.test.cjs</verify>
  <done>Robot adapter extracts states and transitions from Robot's functional API via regex.</done>
</task>

<task type="auto">
  <name>Task 11: Create AWS Step Functions (ASL) adapter</name>
  <files>bin/adapters/asl.cjs, bin/adapters/asl.test.cjs</files>
  <action>
Create `bin/adapters/asl.cjs` for AWS Step Functions (Amazon States Language).

- `id` = `"asl"`
- `name` = `"AWS Step Functions (ASL)"`
- `extensions` = `[".json", ".asl.json"]`
- `detect(filePath, content)`:
  - 90 if JSON-parseable AND has `States` key with object values containing `Type` property
  - 80 if filePath ends with `.asl.json`
  - 0 otherwise
- `extract(filePath, options)`:
  - JSON.parse the file content
  - `initial` from `StartAt` property
  - States from `Object.keys(parsed.States)`
  - Final states: states where `Type === "Succeed"` or `Type === "Fail"` or `End === true`
  - Transitions:
    - `Type: "Task"` or `Type: "Pass"` with `Next` — one transition `{ fromState, event: "Next", target: Next }`
    - `Type: "Choice"` — each `Choices[i]` produces a transition with guard from `Variable + Condition` (e.g., `$.status == "approved"` becomes guard name `statusApproved`)
    - `Default` on Choice → transition with guard null
    - `Type: "Wait"` with `Next` — transition event "WaitComplete"
    - `Type: "Parallel"` — treat as single state with `Next` transition
  - `ctxVars: []`, `ctxDefaults: {}` (ASL context is in JsonPath, not extractable as simple vars)
  - Return validated MachineIR with `framework: "asl"`

Tests using inline JSON fixture:
```json
{
  "StartAt": "ProcessOrder",
  "States": {
    "ProcessOrder": { "Type": "Task", "Next": "CheckStatus" },
    "CheckStatus": { "Type": "Choice", "Choices": [{ "Variable": "$.status", "StringEquals": "approved", "Next": "Complete" }], "Default": "Failed" },
    "Complete": { "Type": "Succeed" },
    "Failed": { "Type": "Fail" }
  }
}
```
Verify: 4 states, 3 transitions, 2 final states.
  </action>
  <verify>node --test bin/adapters/asl.test.cjs</verify>
  <done>ASL adapter parses Step Functions JSON into valid MachineIR with Choice branches as guarded transitions.</done>
</task>

<task type="auto">
  <name>Task 12: Create Stately SCXML-JSON adapter</name>
  <files>bin/adapters/stately.cjs, bin/adapters/stately.test.cjs</files>
  <action>
Create `bin/adapters/stately.cjs` for Stately's SCXML-inspired JSON format.

- `id` = `"stately"`
- `name` = `"Stately (SCXML-JSON)"`
- `extensions` = `[".json"]`
- `detect(filePath, content)`:
  - 85 if JSON-parseable AND has `id` + `initial` + `states` keys where states values have `on` property
  - 0 otherwise
  - Must NOT match ASL (no `States` with capital S, no `StartAt`)
- `extract(filePath, options)`:
  - JSON.parse the file content
  - `machineId` from `parsed.id`
  - `initial` from `parsed.initial`
  - States from `Object.keys(parsed.states)`
  - Final states: states where `type === "final"`
  - Transitions: walk `parsed.states[s].on[event]` — same structure as XState (Stately exports XState-compatible JSON)
  - Context from `parsed.context` if present
  - Apply userVars skip-filter
  - Return validated MachineIR with `framework: "stately"`

Tests using inline JSON fixture:
```json
{
  "id": "traffic-light",
  "initial": "green",
  "states": {
    "green": { "on": { "TIMER": { "target": "yellow" } } },
    "yellow": { "on": { "TIMER": { "target": "red" } } },
    "red": { "on": { "TIMER": { "target": "green" } } }
  }
}
```
Verify: 3 states, 3 transitions, machineId = "traffic-light".
  </action>
  <verify>node --test bin/adapters/stately.test.cjs</verify>
  <done>Stately adapter parses SCXML-JSON format into valid MachineIR.</done>
</task>

<!-- ═══════════════════════════════════════════════════════════════════════════ -->
<!-- WAVE 3 — Python/Go adapters (4 adapters, regex-based)                     -->
<!-- ═══════════════════════════════════════════════════════════════════════════ -->

<task type="auto">
  <name>Task 13: Create Python transitions adapter</name>
  <files>bin/adapters/python-transitions.cjs, bin/adapters/python-transitions.test.cjs</files>
  <action>
Create `bin/adapters/python-transitions.cjs` for the Python `transitions` library.

- `id` = `"py-transitions"`
- `name` = `"Python transitions"`
- `extensions` = `[".py"]`
- `detect(filePath, content)`:
  - 85 if content has `from transitions import Machine` or `import transitions`
  - 70 if content has `Machine(` AND `transitions=` AND `states=`
  - 0 otherwise
- `extract(filePath, options)`:
  - Read file as string (no Python runtime needed)
  - Regex extraction patterns:
    - States: `states\s*=\s*\[([^\]]+)\]` — parse comma-separated quoted strings
    - Transitions: `transitions\s*=\s*\[` then parse list of dicts `{ 'trigger': '...', 'source': '...', 'dest': '...' }` OR list of lists `['trigger', 'source', 'dest']`
    - Also handle `Machine(model, states=[...], transitions=[...], initial='...')` single-line pattern
    - Initial: `initial\s*=\s*['"](\w+)['"]`
  - Map to IR transitions: `{ fromState: source, event: trigger, guard: null, target: dest, assignedKeys: [] }`
  - Handle `conditions` kwarg on transitions as guard names
  - `ctxVars: []`, `ctxDefaults: {}` (Python context not extractable via regex)
  - Return validated MachineIR with `framework: "py-transitions"`

Tests using inline fixture string:
```python
from transitions import Machine
states = ['idle', 'processing', 'done']
transitions = [
    { 'trigger': 'start', 'source': 'idle', 'dest': 'processing' },
    { 'trigger': 'finish', 'source': 'processing', 'dest': 'done' },
    { 'trigger': 'reset', 'source': 'done', 'dest': 'idle' }
]
machine = Machine(model, states=states, transitions=transitions, initial='idle')
```
Write to tmp .py file, call extract(), verify 3 states, 3 transitions.
  </action>
  <verify>node --test bin/adapters/python-transitions.test.cjs</verify>
  <done>Python transitions adapter extracts states/transitions from Python source via regex.</done>
</task>

<task type="auto">
  <name>Task 14: Create sismic YAML adapter</name>
  <files>bin/adapters/sismic.cjs, bin/adapters/sismic.test.cjs, package.json</files>
  <action>
First, add `js-yaml` as a devDependency: run `npm install --save-dev js-yaml` from the project root.

Create `bin/adapters/sismic.cjs` for sismic YAML statecharts.

- `id` = `"sismic"`
- `name` = `"sismic (YAML statechart)"`
- `extensions` = `[".yaml", ".yml"]`
- `detect(filePath, content)`:
  - 85 if YAML-parseable AND has `statechart` key with `root` containing `initial` and `states`
  - 60 if filePath ends with `.statechart.yaml` or `.statechart.yml`
  - 0 otherwise
- `extract(filePath, options)`:
  - Parse YAML via `require('js-yaml').load(content)`
  - Navigate `parsed.statechart.root` for the root state
  - `initial` from `root.initial`
  - States: recursively collect state names from `root.states[]` (each has a `name` property)
  - Final states: states with `type: "final"`
  - Transitions: each state can have `transitions[]` with `{ event, target, guard }` properties
  - `ctxVars: []`, `ctxDefaults: {}` (sismic actions are Python code, not extractable)
  - Return validated MachineIR with `framework: "sismic"`

Tests using inline YAML fixture string:
```yaml
statechart:
  name: traffic
  root:
    name: root
    initial: green
    states:
      - name: green
        transitions:
          - event: timer
            target: yellow
      - name: yellow
        transitions:
          - event: timer
            target: red
      - name: red
        transitions:
          - event: timer
            target: green
```
Write to tmp .yaml file, call extract(), verify 3 states, 3 transitions.
  </action>
  <verify>node --test bin/adapters/sismic.test.cjs</verify>
  <done>sismic adapter parses YAML statecharts into valid MachineIR using js-yaml.</done>
</task>

<task type="auto">
  <name>Task 15: Create looplab/fsm Go adapter</name>
  <files>bin/adapters/looplab-fsm.cjs, bin/adapters/looplab-fsm.test.cjs</files>
  <action>
Create `bin/adapters/looplab-fsm.cjs` for the Go `looplab/fsm` library.

- `id` = `"looplab-fsm"`
- `name` = `"looplab/fsm (Go)"`
- `extensions` = `[".go"]`
- `detect(filePath, content)`:
  - 85 if content has `"github.com/looplab/fsm"` import AND `fsm.NewFSM(`
  - 60 if content has `fsm.NewFSM(` without the import (could be aliased)
  - 0 otherwise
- `extract(filePath, options)`:
  - Read file as string (no Go runtime needed)
  - Regex extraction:
    - Initial state: `fsm\.NewFSM\s*\(\s*"(\w+)"` — first arg to NewFSM
    - Events: `fsm\.EventDesc\s*\{\s*Name:\s*"(\w+)"\s*,\s*Src:\s*\[([^\]]+)\]\s*,\s*Dst:\s*"(\w+)"` — extracts event name, source states (comma-separated), destination
    - Also handle `{Name: "...", Src: []string{"..."}, Dst: "..."}` format
  - States: union of all Src values and Dst values
  - Transitions: for each EventDesc, expand Src array into individual transitions
  - `ctxVars: []`, `ctxDefaults: {}` (Go context not extractable)
  - Return validated MachineIR with `framework: "looplab-fsm"`

Tests using inline fixture string:
```go
package main
import "github.com/looplab/fsm"
func main() {
    f := fsm.NewFSM("idle",
        fsm.Events{
            {Name: "start", Src: []string{"idle"}, Dst: "running"},
            {Name: "stop", Src: []string{"running"}, Dst: "idle"},
            {Name: "finish", Src: []string{"running"}, Dst: "done"},
        },
        fsm.Callbacks{},
    )
}
```
Write to tmp .go file, call extract(), verify 3 states, 3 transitions.
  </action>
  <verify>node --test bin/adapters/looplab-fsm.test.cjs</verify>
  <done>looplab/fsm adapter extracts Go FSM definitions via regex into valid MachineIR.</done>
</task>

<task type="auto">
  <name>Task 16: Create qmuntal/stateless Go adapter</name>
  <files>bin/adapters/qmuntal-stateless.cjs, bin/adapters/qmuntal-stateless.test.cjs</files>
  <action>
Create `bin/adapters/qmuntal-stateless.cjs` for the Go `qmuntal/stateless` library.

- `id` = `"stateless"`
- `name` = `"qmuntal/stateless (Go)"`
- `extensions` = `[".go"]`
- `detect(filePath, content)`:
  - 85 if content has `"github.com/qmuntal/stateless"` import AND `.Configure(`
  - 60 if content has `.Configure(` AND `.Permit(` chain pattern
  - 0 otherwise
- `extract(filePath, options)`:
  - Read file as string (no Go runtime needed)
  - Regex extraction:
    - State constants: `(\w+)\s*=\s*(?:iota|"(\w+)"|\d+)` within a const block — collect state names
    - Trigger constants: same pattern in a separate const block
    - Initial state: `stateless\.NewStateMachine\s*\(\s*(\w+)` — first arg
    - Transitions: `.Configure\s*\(\s*(\w+)\s*\)` captures the state, then chained `.Permit\s*\(\s*(\w+)\s*,\s*(\w+)\s*\)` captures (trigger, target)
    - Also handle `.PermitIf(guard, trigger, target)` — captures guard name
  - States: union of all Configure() and Permit target values
  - Map const names to their string values if possible, otherwise use the const name as-is
  - `ctxVars: []`, `ctxDefaults: {}` (Go context not extractable)
  - Return validated MachineIR with `framework: "stateless"`

Tests using inline fixture string:
```go
package main
import "github.com/qmuntal/stateless"
const (
    stateIdle    = "idle"
    stateRunning = "running"
    stateDone    = "done"
    triggerStart = "start"
    triggerStop  = "stop"
    triggerDone  = "done"
)
func main() {
    sm := stateless.NewStateMachine(stateIdle)
    sm.Configure(stateIdle).Permit(triggerStart, stateRunning)
    sm.Configure(stateRunning).Permit(triggerStop, stateIdle).Permit(triggerDone, stateDone)
}
```
Write to tmp .go file, call extract(), verify 3 states, 3 transitions.
  </action>
  <verify>node --test bin/adapters/qmuntal-stateless.test.cjs</verify>
  <done>qmuntal/stateless adapter extracts Go stateless FSM definitions via regex into valid MachineIR.</done>
</task>

<!-- ═══════════════════════════════════════════════════════════════════════════ -->
<!-- WAVE 4 — Hook + pipeline integration                                      -->
<!-- ═══════════════════════════════════════════════════════════════════════════ -->

<task type="auto">
  <name>Task 17: Generalize nf-spec-regen hook with configurable patterns</name>
  <files>hooks/nf-spec-regen.js, hooks/dist/nf-spec-regen.js</files>
  <action>
Modify `hooks/nf-spec-regen.js` to support configurable file patterns instead of hardcoded `nf-workflow.machine.ts`.

Changes:
1. After loading config via `loadConfig()`, read `config.spec_regen_patterns` array. Default: `["*.machine.ts"]` (preserves current behavior).

2. Replace the hardcoded check on line 45:
   ```javascript
   // OLD: if (toolName !== 'Write' || !filePath.includes('nf-workflow.machine.ts'))
   // NEW:
   if (toolName !== 'Write') { process.exit(0); }
   const patterns = config.spec_regen_patterns || ['*.machine.ts'];
   const basename = path.basename(filePath);
   const matchesPattern = patterns.some(pat => {
     // Simple glob: *.ext matches any file ending with .ext
     if (pat.startsWith('*')) return basename.endsWith(pat.slice(1));
     // Exact filename match
     return basename === pat || filePath.includes(pat);
   });
   if (!matchesPattern) { process.exit(0); }
   ```

3. When a match is found, call `bin/fsm-to-tla.cjs` instead of `bin/xstate-to-tla.cjs`:
   - Replace the xstateScript spawn block (lines 69-88) with a call to `bin/fsm-to-tla.cjs`
   - Pass the matched file path and auto-detect the framework: `[fsmToTla, filePath]`
   - For the nf-workflow.machine.ts case specifically, also pass `--config=` and `--module=NFQuorum` to match current behavior
   - Keep the existing `generate-formal-specs.cjs` spawn (that script stays separate)

4. Copy to `hooks/dist/nf-spec-regen.js` and run `node bin/install.js --claude --global` to install.

IMPORTANT: The hook must still call `generate-formal-specs.cjs` for `nf-workflow.machine.ts` writes (that script generates TLA+/Alloy/PRISM, not just xstate TLA+). Only the xstate-to-tla.cjs call is replaced with fsm-to-tla.cjs.
  </action>
  <verify>node -c hooks/nf-spec-regen.js && diff hooks/nf-spec-regen.js hooks/dist/nf-spec-regen.js && grep -q "fsm-to-tla" hooks/nf-spec-regen.js && grep -q "spec_regen_patterns" hooks/nf-spec-regen.js</verify>
  <done>Hook now uses configurable patterns and delegates to fsm-to-tla.cjs. Default behavior unchanged for nf-workflow.machine.ts writes.</done>
</task>

<task type="auto">
  <name>Task 18: Wire generate-formal-specs.cjs to shared registry-update</name>
  <files>bin/generate-formal-specs.cjs</files>
  <action>
Update `bin/generate-formal-specs.cjs` to use the shared `registry-update.cjs` module instead of its inline `updateModelRegistry()` function.

Changes:
1. Replace the inline `updateModelRegistry()` function (lines 45-76) with:
   ```javascript
   const { updateModelRegistry } = require('./adapters/registry-update');
   ```

2. Update all calls to `updateModelRegistry(absPath)` to `updateModelRegistry(absPath, { dry: DRY, projectRoot: ROOT })`.

3. Remove the inline function definition entirely.

4. Verify the existing test suite passes — `generate-formal-specs.cjs` behavior must be identical.
  </action>
  <verify>node -c bin/generate-formal-specs.cjs && grep -q "require.*registry-update" bin/generate-formal-specs.cjs && grep -v "function updateModelRegistry" bin/generate-formal-specs.cjs | grep -qv "function updateModelRegistry"</verify>
  <done>generate-formal-specs.cjs uses shared registry-update module. No inline updateModelRegistry function remains.</done>
</task>

<task type="auto">
  <name>Task 19: Update package.json scripts and run full test suite</name>
  <files>package.json</files>
  <action>
Update `package.json`:

1. Add script: `"fsm-to-tla": "node bin/fsm-to-tla.cjs"`

2. Add ALL new test files to `test:formal` script (append to existing list):
   ```
   bin/adapters/ir.test.cjs
   bin/adapters/emitter-tla.test.cjs
   bin/adapters/detect.test.cjs
   bin/adapters/scaffold-config.test.cjs
   bin/adapters/xstate-v5.test.cjs
   bin/adapters/xstate-v4.test.cjs
   bin/adapters/jsm.test.cjs
   bin/adapters/robot.test.cjs
   bin/adapters/asl.test.cjs
   bin/adapters/stately.test.cjs
   bin/adapters/python-transitions.test.cjs
   bin/adapters/sismic.test.cjs
   bin/adapters/looplab-fsm.test.cjs
   bin/adapters/qmuntal-stateless.test.cjs
   bin/fsm-to-tla.test.cjs
   ```

3. Verify `js-yaml` is in devDependencies (added in Task 14).

4. Run the full test suite: `npm run test:formal` — ALL tests must pass, including the existing xstate-to-tla.test.cjs which now tests the thin wrapper.

5. Run backward compatibility check: `node bin/xstate-to-tla.cjs src/machines/nf-workflow.machine.ts --module=NFQuorum --config=.planning/formal/tla/guards/nf-workflow.json --dry` and verify output contains "MODULE NFQuorum_xstate".

6. Run new CLI check: `node bin/fsm-to-tla.cjs src/machines/nf-workflow.machine.ts --detect` and verify it prints xstate-v5.
  </action>
  <verify>npm run test:formal 2>&1 | tail -20</verify>
  <done>All tests pass. Package.json updated with fsm-to-tla script and all new test files in test:formal. js-yaml in devDependencies. Backward compat confirmed.</done>
</task>

</tasks>

<verification>
1. **Backward compat**: `node bin/xstate-to-tla.cjs src/machines/nf-workflow.machine.ts --module=NFQuorum --config=.planning/formal/tla/guards/nf-workflow.json --dry` produces output containing "MODULE NFQuorum_xstate" — identical to pre-refactor
2. **Existing tests**: `node --test bin/xstate-to-tla.test.cjs` passes (thin wrapper preserves error-path behavior)
3. **New CLI parity**: `node bin/fsm-to-tla.cjs src/machines/nf-workflow.machine.ts --module=NFQuorum --config=.planning/formal/tla/guards/nf-workflow.json --dry` matches above
4. **Auto-detect**: `node bin/fsm-to-tla.cjs src/machines/nf-workflow.machine.ts --detect` reports xstate-v5
5. **Scaffold**: `node bin/fsm-to-tla.cjs src/machines/nf-workflow.machine.ts --scaffold-config` produces valid JSON with guards/vars
6. **Per-adapter tests**: All 10 adapter test files pass with inline fixtures
7. **Full suite**: `npm run test:formal` passes
8. **Hook generalized**: `grep "spec_regen_patterns" hooks/nf-spec-regen.js` finds configurable patterns
9. **Registry shared**: `grep "registry-update" bin/generate-formal-specs.cjs` confirms shared module usage
</verification>

<success_criteria>
- 10 adapters in bin/adapters/, each with .test.cjs using inline fixtures
- bin/fsm-to-tla.cjs unified CLI with --framework, --detect, --scaffold-config, --dry flags
- bin/xstate-to-tla.cjs reduced to thin wrapper (~30 lines), all existing tests pass
- hooks/nf-spec-regen.js uses configurable patterns and calls fsm-to-tla.cjs
- bin/generate-formal-specs.cjs uses shared registry-update.cjs
- npm run test:formal passes with all new and existing tests
</success_criteria>

<output>
After completion, create `.planning/quick/292-multi-adapter-fsm-to-tla-transpiler-gene/292-SUMMARY.md`
</output>
