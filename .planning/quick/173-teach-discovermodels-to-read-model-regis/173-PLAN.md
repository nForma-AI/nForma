---
phase: quick-173
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - bin/run-formal-verify.cjs
  - .formal/model-registry.json
  - bin/run-formal-verify.test.cjs
autonomous: true
formal_artifacts: none
requirements: [SOLVE-05]

must_haves:
  truths:
    - "discoverModels reads model-registry.json search_dirs and scans those directories for formal models"
    - "Registry entries with check.command produce type:shell steps that run the custom command"
    - "runGroup handles type:shell steps via spawnSync with the specified command"
    - "Existing hardcoded .formal/{tla,alloy,prism,petri,uppaal} scanning still works unchanged"
  artifacts:
    - path: "bin/run-formal-verify.cjs"
      provides: "Registry-driven discovery + shell step executor"
      contains: "search_dirs"
    - path: ".formal/model-registry.json"
      provides: "Schema with search_dirs array"
      contains: "search_dirs"
    - path: "bin/run-formal-verify.test.cjs"
      provides: "Tests for registry-driven discovery and shell steps"
      contains: "search_dirs"
  key_links:
    - from: "bin/run-formal-verify.cjs:discoverModels"
      to: ".formal/model-registry.json"
      via: "fs.readFileSync + JSON.parse"
      pattern: "model-registry\\.json"
    - from: "bin/run-formal-verify.cjs:runGroup"
      to: "shell step execution"
      via: "spawnSync with step.command"
      pattern: "type.*shell"
---

<objective>
Teach discoverModels() to read model-registry.json for additional search directories and custom check commands, making the formal verification pipeline project-agnostic.

Purpose: Projects with formal models outside .formal/{tla,alloy,prism,petri,uppaal}/ are invisible to the verify pipeline. The registry already catalogs all models but nobody reads it at runtime. This bridges that gap.
Output: Updated discoverModels() that reads search_dirs from registry, new type:shell step handler in runGroup, extended model-registry.json schema, and tests.
</objective>

<execution_context>
@/Users/jonathanborduas/.claude/qgsd/workflows/execute-plan.md
@/Users/jonathanborduas/.claude/qgsd/templates/summary.md
</execution_context>

<context>
@bin/run-formal-verify.cjs
@.formal/model-registry.json
@bin/run-formal-verify.test.cjs
</context>

<tasks>

<task type="auto">
  <name>Task 1: Extend model-registry.json schema and discoverModels() to read search_dirs</name>
  <files>
    .formal/model-registry.json
    bin/run-formal-verify.cjs
  </files>
  <action>
1. Add `"search_dirs": []` top-level field to `.formal/model-registry.json` (after `"last_sync"`). This is an array of relative directory paths (relative to project root) that contain formal model files.

2. In `bin/run-formal-verify.cjs`, modify `discoverModels(root)` (line 110-201) to:
   a. After the existing formalDir declaration (line 112), attempt to read `path.join(root, '.formal', 'model-registry.json')`. Wrap in try/catch — if missing or malformed, log a warning and continue with empty registry (fail-open).
   b. If registry exists and has a `search_dirs` array, iterate each entry. For each dir:
      - Resolve it relative to `root` via `path.resolve(root, dir)`
      - If it exists (fs.existsSync), scan it using the SAME file-type logic as the existing TLA+/Alloy/PRISM/Petri/UPPAAL blocks:
        - `*.cfg` files → TLA+ steps (use pickTLARunner)
        - `*.als` files → Alloy steps (use pickAlloyRunner/pickAlloyArgs)
        - `*.pm` files → PRISM steps (use pickPrismRunner/pickPrismArgs)
        - `*.dot` files → Petri wasm-dot steps
        - `*.xml` files → UPPAAL steps
      - Prefix the step id with the search_dir path to avoid collisions with .formal/ models (e.g., `tla:formal-spec/mcfoo` instead of `tla:mcfoo`)
   c. After scanning search_dirs, iterate `registry.models` entries. For any entry that has a `check` object with `check.command` (string), create a `type: 'shell'` step:
      ```
      {
        tool: 'registry',
        id: 'registry:' + modelPath,
        label: 'Registry check — ' + modelPath,
        type: 'shell',
        command: entry.check.command,
        config: entry.check.config || null,
        cwd: root,
        nonCritical: entry.check.nonCritical || false,
      }
      ```
      Where `modelPath` is the registry key (e.g., `.formal/alloy/foo.als`).

3. Add optional `check` field documentation in a comment near the top of model-registry.json schema description (inside the file header of run-formal-verify.cjs, around line 108).

Important: Do NOT refactor the existing scanning blocks into a shared function. Keep the existing code unchanged and add the search_dirs scanning as new code after the UPPAAL block (before the `return discovered;` at line 200). This minimizes risk to existing behavior.
  </action>
  <verify>
    node --check bin/run-formal-verify.cjs && echo "Syntax OK"
    node -e "const r = require('fs').readFileSync('.formal/model-registry.json','utf8'); const j = JSON.parse(r); console.log('search_dirs:', j.search_dirs); process.exit(Array.isArray(j.search_dirs) ? 0 : 1)"
  </verify>
  <done>
    - model-registry.json has top-level `search_dirs: []` array
    - discoverModels reads the registry and scans search_dirs directories
    - discoverModels creates type:shell steps for entries with check.command
    - Existing .formal/ scanning is untouched
    - Script passes syntax check
  </done>
</task>

<task type="auto">
  <name>Task 2: Add type:shell handler to runGroup and write tests</name>
  <files>
    bin/run-formal-verify.cjs
    bin/run-formal-verify.test.cjs
  </files>
  <action>
1. In `bin/run-formal-verify.cjs`, add a `runShellStep(step)` function near `runNodeStep` (after line 342):
   ```javascript
   function runShellStep(step) {
     const parts = step.command.split(/\s+/);
     const cmd = parts[0];
     const args = parts.slice(1);
     // Substitute {{config}} placeholder if config is set
     const resolvedArgs = step.config
       ? args.map(a => a.replace('{{config}}', step.config))
       : args;
     const result = spawnSync(cmd, resolvedArgs, {
       stdio: 'inherit',
       encoding: 'utf8',
       cwd: step.cwd || ROOT,
       env: { ...process.env, CHECK_RESULTS_ROOT: ROOT },
     });
     if (result.error) {
       process.stderr.write(TAG + ' Shell launch error: ' + result.error.message + '\n');
       return false;
     }
     return result.status === 0;
   }
   ```

2. In `runGroup` (line 380-397), add a branch in the if/else chain for `step.type === 'shell'`:
   ```javascript
   } else if (step.type === 'shell') {
     passed = runShellStep(step);
   }
   ```
   Place it after the `wasm-dot` branch and before the closing of the if/else.

3. Update the comment block at top of file: change `Total: 34 steps` to note that the count is now dynamic (registry can add more). Add a line: `//   Registry  (N)  — custom check commands from model-registry.json`

4. In `bin/run-formal-verify.test.cjs`, add these tests:

   a. **Registry search_dirs discovery test**: Create a tmpDir with a `model-registry.json` containing `search_dirs: ["specs/"]` and a `specs/` directory with a `test-model.cfg` file. Spawn `run-formal-verify.cjs --project-root=<tmpDir> --only=tla` and verify the output contains a step ID referencing `specs/test-model`. Must also create a minimal `.formal/` dir in tmpDir so the script does not error.

   b. **Registry check.command discovery test**: Create a tmpDir with a `model-registry.json` containing a model entry with `check: { command: "echo hello" }`. Spawn `run-formal-verify.cjs --project-root=<tmpDir> --only=registry` and verify the output contains `registry:` step ID and "echo hello" executes (exit 0).

   c. **Shell step type handled test**: Verify that the source code of `run-formal-verify.cjs` contains the string `type === 'shell'` (structural guard against accidental removal).

   d. **Fail-open: missing registry test**: Spawn `run-formal-verify.cjs --project-root=<tmpDir>` where tmpDir has `.formal/tla/` but NO `model-registry.json`. Verify it does NOT crash (exit should be non-1 for unknown-only or should produce output without registry errors).

For all tmpDir tests: create `.formal/` subdirectory structure as needed, and clean up in `finally` blocks using `fs.rmSync(tmpDir, { recursive: true, force: true })`.
  </action>
  <verify>
    node --test bin/run-formal-verify.test.cjs 2>&1 | tail -20
  </verify>
  <done>
    - runShellStep function exists and handles type:shell steps
    - runGroup dispatches to runShellStep for shell-type steps
    - 4 new tests pass: search_dirs discovery, check.command discovery, shell type guard, fail-open missing registry
    - All existing tests still pass
  </done>
</task>

</tasks>

<verification>
- `node --check bin/run-formal-verify.cjs` passes (no syntax errors)
- `node --test bin/run-formal-verify.test.cjs` — all tests pass (existing + new)
- `node -e "JSON.parse(require('fs').readFileSync('.formal/model-registry.json','utf8'))"` — valid JSON
- Running `node bin/run-formal-verify.cjs --only=generate` still works as before (no regression)
</verification>

<success_criteria>
- discoverModels reads model-registry.json search_dirs and scans additional directories
- Registry entries with check.command create type:shell steps
- runGroup handles type:shell via spawnSync
- Existing scanning behavior is unchanged (fail-open if no registry)
- All tests pass (existing + 4 new)
</success_criteria>

<output>
After completion, create `.planning/quick/173-teach-discovermodels-to-read-model-regis/173-SUMMARY.md`
</output>
