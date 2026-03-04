---
phase: quick-167
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - bin/run-formal-verify.cjs
  - bin/run-tlc.cjs
  - bin/run-alloy.cjs
  - bin/run-audit-alloy.cjs
  - bin/run-account-pool-alloy.cjs
  - bin/run-transcript-alloy.cjs
  - bin/run-installer-alloy.cjs
  - bin/run-quorum-composition-alloy.cjs
  - bin/run-oscillation-tlc.cjs
  - bin/run-breaker-tlc.cjs
  - bin/run-protocol-tlc.cjs
  - bin/run-account-manager-tlc.cjs
  - bin/run-stop-hook-tlc.cjs
  - bin/run-prism.cjs
  - bin/run-oauth-rotation-prism.cjs
  - bin/run-uppaal.cjs
  - bin/write-check-result.cjs
  - bin/generate-formal-specs.cjs
autonomous: true
formal_artifacts: none
requirements: [SOLVE-05]

must_haves:
  truths:
    - "run-formal-verify.cjs discovers models dynamically from ROOT/.formal/{tla,alloy,prism}/ when --project-root points to another project"
    - "All child runners (TLA+, Alloy, PRISM, UPPAAL) resolve JAR, spec, and config paths from --project-root, not __dirname"
    - "NDJSON output (check-results.ndjson) is written to ROOT/.formal/ not QGSD/.formal/"
    - "generate-formal-specs.cjs exits 0 gracefully when XState machine does not exist in target project"
    - "QGSD-specific steps (XState extraction, scoreboard-dependent calibration) are skipped when prerequisites missing"
  artifacts:
    - path: "bin/run-formal-verify.cjs"
      provides: "Dynamic model discovery from ROOT/.formal/{tla,alloy,prism,petri}/"
      contains: "discoverModels"
    - path: "bin/run-tlc.cjs"
      provides: "ROOT-relative JAR and spec resolution via --project-root"
      contains: "project-root"
    - path: "bin/write-check-result.cjs"
      provides: "ROOT-relative NDJSON output path"
      contains: "project-root"
    - path: "bin/generate-formal-specs.cjs"
      provides: "Graceful skip when XState machine missing"
      contains: "process.exit(0)"
  key_links:
    - from: "bin/run-formal-verify.cjs"
      to: "all child runners"
      via: "--project-root= forwarding in runNodeStep()"
      pattern: "childArgs.push.*project-root"
    - from: "bin/run-formal-verify.cjs"
      to: "ROOT/.formal/{tla,alloy,prism}/"
      via: "filesystem scan for *.cfg, *.als, *.pm"
      pattern: "discoverModels|readdirSync"
    - from: "child runners"
      to: "bin/write-check-result.cjs"
      via: "writeCheckResult() with ROOT-aware NDJSON path"
      pattern: "CHECK_RESULTS_PATH|project-root"
---

<objective>
Make the formal verification harness project-agnostic so that `run-formal-verify.cjs` discovers and verifies any project's formal models from ROOT/.formal/{tla,alloy,prism,petri}/ rather than hardcoding QGSD-internal model names.

Purpose: When qgsd:solve runs in another project, the formal verification pipeline should work against that project's models without requiring QGSD-specific files.
Output: All 16+ runner scripts honor --project-root for path resolution; master orchestrator discovers models dynamically; QGSD-specific steps gracefully skip.
</objective>

<execution_context>
@/Users/jonathanborduas/.claude/qgsd/workflows/execute-plan.md
@/Users/jonathanborduas/.claude/qgsd/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@bin/run-formal-verify.cjs
@bin/run-tlc.cjs
@bin/run-alloy.cjs
@bin/run-prism.cjs
@bin/write-check-result.cjs
@bin/generate-formal-specs.cjs
</context>

<tasks>

<task type="auto">
  <name>Task 1: Add --project-root support to all child runners and write-check-result.cjs</name>
  <files>
    bin/run-tlc.cjs
    bin/run-alloy.cjs
    bin/run-audit-alloy.cjs
    bin/run-account-pool-alloy.cjs
    bin/run-transcript-alloy.cjs
    bin/run-installer-alloy.cjs
    bin/run-quorum-composition-alloy.cjs
    bin/run-oscillation-tlc.cjs
    bin/run-breaker-tlc.cjs
    bin/run-protocol-tlc.cjs
    bin/run-account-manager-tlc.cjs
    bin/run-stop-hook-tlc.cjs
    bin/run-uppaal.cjs
    bin/write-check-result.cjs
    bin/generate-formal-specs.cjs
  </files>
  <action>
For EVERY child runner script listed in files, apply this pattern:

1. **Parse --project-root from argv** near the top of the file (after requires, before path resolution):
```js
let ROOT = path.join(__dirname, '..');
for (const arg of process.argv) {
  if (arg.startsWith('--project-root=')) ROOT = path.resolve(arg.slice('--project-root='.length));
}
```
Note: `run-prism.cjs` and `run-oauth-rotation-prism.cjs` already have this -- leave them unchanged.

2. **Replace ALL `path.join(__dirname, '..', '.formal', ...)` with `path.join(ROOT, '.formal', ...)`** for:
   - JAR paths (tla2tools.jar, org.alloytools.alloy.dist.jar)
   - Spec paths (.tla, .als, .pm files)
   - Config paths (.cfg files)
   - UPPAAL model/query paths

3. **run-tlc.cjs specific**: Remove the `VALID_CONFIGS` whitelist check that rejects unknown config names. Replace with: accept any configName as long as the corresponding .cfg file exists at `ROOT/.formal/tla/<configName>.cfg`. If the .cfg file doesn't exist, emit a fail check result and exit 1 with a clear message. Keep the CHECK_ID_MAP and PROPERTY_MAP as fallbacks but don't block on unknown configs -- use `'tla:' + configName.toLowerCase()` for unknown check_ids and the configName itself for unknown properties.

4. **write-check-result.cjs**: Add --project-root support. Parse `process.env.CHECK_RESULTS_ROOT` (new env var) as an alternative to CHECK_RESULTS_PATH. When CHECK_RESULTS_ROOT is set, compute NDJSON_PATH as `path.join(CHECK_RESULTS_ROOT, '.formal', 'check-results.ndjson')`. Priority: CHECK_RESULTS_PATH (exact path) > CHECK_RESULTS_ROOT (root-relative) > __dirname fallback.

5. **run-formal-verify.cjs runNodeStep()**: When spawning child scripts, also set `CHECK_RESULTS_ROOT` env var to ROOT so that write-check-result.cjs writes NDJSON to the correct project's .formal/ directory:
```js
const result = spawnSync(process.execPath, [scriptPath, ...childArgs], {
  stdio: 'inherit',
  encoding: 'utf8',
  cwd: ROOT,
  env: { ...process.env, CHECK_RESULTS_ROOT: ROOT },
});
```
Also update the NDJSON truncation path at the top of runOnce() to use ROOT instead of __dirname:
```js
const ndjsonPath = path.join(ROOT, '.formal', 'check-results.ndjson');
```

6. **generate-formal-specs.cjs**: Change the XState machine existence check from `process.exit(1)` to `process.exit(0)` with a warning message: `[generate-formal-specs] XState machine not found at <path> — skipping (not required for external projects)`. Add --project-root parsing so ROOT is configurable. Change `const ROOT = path.join(__dirname, '..');` to use the parsed ROOT.

7. **Strip --project-root from forwarded args**: In runners that forward argv to external tools (PRISM, etc.), filter out `--project-root=` args before passing to the external binary (run-prism.cjs already does this -- apply same pattern to run-oauth-rotation-prism.cjs if not already done).
  </action>
  <verify>
    Run `grep -r "__dirname.*\.formal" bin/run-*.cjs bin/write-check-result.cjs | grep -v test | grep -v node_modules` and confirm zero matches (all paths now use ROOT).
    Run `grep -c "project-root" bin/run-tlc.cjs bin/run-alloy.cjs bin/run-breaker-tlc.cjs` and confirm each has at least 1 match.
  </verify>
  <done>
    All child runners resolve JAR/spec/config paths from ROOT (defaulting to __dirname/.. for backward compatibility). write-check-result.cjs respects CHECK_RESULTS_ROOT env var. generate-formal-specs.cjs exits 0 when XState machine is missing. No `__dirname` references to `.formal/` remain in runner source files (excluding tests).
  </done>
</task>

<task type="auto">
  <name>Task 2: Dynamic model discovery in run-formal-verify.cjs</name>
  <files>
    bin/run-formal-verify.cjs
  </files>
  <action>
Refactor the STEPS array in run-formal-verify.cjs to split into STATIC_STEPS and dynamically discovered steps.

1. **Define STATIC_STEPS**: Move the following categories into a STATIC_STEPS array (these work on any project or gracefully degrade):
   - `generate:tla-from-xstate` and `generate:alloy-prism-specs` (generate steps -- will gracefully exit 0 when XState missing per Task 1)
   - `ci:trace-redaction`, `ci:trace-schema-drift`, `ci:liveness-fairness-lint`, `ci:conformance-traces` (CI enforcement -- scan .formal/ generically)
   - `ci:triage-bundle` (informational)
   - `traceability:matrix`, `traceability:coverage-guard`, `traceability:state-space` (post-processing)

2. **Create `discoverModels(root)` function** that scans ROOT/.formal/ and builds dynamic STEPS:

```js
function discoverModels(root) {
  const discovered = [];
  const formalDir = path.join(root, '.formal');

  // TLA+: scan for *.cfg files in .formal/tla/
  const tlaDir = path.join(formalDir, 'tla');
  if (fs.existsSync(tlaDir)) {
    const cfgFiles = fs.readdirSync(tlaDir).filter(f => f.endsWith('.cfg'));
    for (const cfg of cfgFiles) {
      const configName = cfg.replace('.cfg', '');
      // Determine which runner script to use based on config name patterns
      // or fall back to generic run-tlc.cjs
      const runner = pickTLARunner(configName);
      discovered.push({
        tool: 'tla',
        id: 'tla:' + configName.toLowerCase(),
        label: 'TLA+ — ' + configName,
        type: 'node',
        script: runner.script,
        args: runner.args(configName),
      });
    }
  }

  // Alloy: scan for *.als files in .formal/alloy/ (exclude subdirectories, JARs)
  const alloyDir = path.join(formalDir, 'alloy');
  if (fs.existsSync(alloyDir)) {
    const alsFiles = fs.readdirSync(alloyDir).filter(f => f.endsWith('.als'));
    for (const als of alsFiles) {
      const specName = als.replace('.als', '');
      discovered.push({
        tool: 'alloy',
        id: 'alloy:' + specName,
        label: 'Alloy ' + specName,
        type: 'node',
        script: pickAlloyRunner(specName),
        args: pickAlloyArgs(specName),
      });
    }
  }

  // PRISM: scan for *.pm files in .formal/prism/
  const prismDir = path.join(formalDir, 'prism');
  if (fs.existsSync(prismDir)) {
    const pmFiles = fs.readdirSync(prismDir).filter(f => f.endsWith('.pm'));
    for (const pm of pmFiles) {
      const modelName = pm.replace('.pm', '');
      discovered.push({
        tool: 'prism',
        id: 'prism:' + modelName,
        label: 'PRISM ' + modelName,
        type: 'node',
        script: pickPrismRunner(modelName),
        args: pickPrismArgs(modelName),
      });
    }
  }

  // Petri: scan for *.dot files in .formal/petri/
  const petriDir = path.join(formalDir, 'petri');
  if (fs.existsSync(petriDir)) {
    const dotFiles = fs.readdirSync(petriDir).filter(f => f.endsWith('.dot'));
    for (const dot of dotFiles) {
      const name = dot.replace('.dot', '');
      discovered.push({
        tool: 'petri',
        id: 'petri:' + name,
        label: 'Petri ' + name + ' — render DOT -> SVG',
        type: 'wasm-dot',
        dot: dot,
        svg: dot.replace('.dot', '.svg'),
      });
    }
  }

  // UPPAAL: scan for *.xml files in .formal/uppaal/
  const uppaalDir = path.join(formalDir, 'uppaal');
  if (fs.existsSync(uppaalDir)) {
    const xmlFiles = fs.readdirSync(uppaalDir).filter(f => f.endsWith('.xml'));
    for (const xml of xmlFiles) {
      const name = xml.replace('.xml', '');
      discovered.push({
        tool: 'uppaal',
        id: 'uppaal:' + name,
        label: 'UPPAAL ' + name,
        type: 'node',
        script: 'run-uppaal.cjs',
        args: [],
        nonCritical: true,
      });
    }
  }

  return discovered;
}
```

3. **Create picker functions** that map discovered model names to the correct runner script. Use a RUNNER_MAP registry that maps known model names to their specialized runners, falling back to generic runners for unknown models:

```js
// TLA+ runner picker: specialized runners for known QGSD models, generic run-tlc.cjs for everything else
const TLA_RUNNER_MAP = {
  'MCoscillation':    { script: 'run-oscillation-tlc.cjs', args: (c) => [c] },
  'MCconvergence':    { script: 'run-oscillation-tlc.cjs', args: (c) => [c] },
  'MCbreaker':        { script: 'run-breaker-tlc.cjs',     args: (c) => [c] },
  'MCdeliberation':   { script: 'run-protocol-tlc.cjs',    args: (c) => [c] },
  'MCprefilter':      { script: 'run-protocol-tlc.cjs',    args: (c) => [c] },
  'MCaccount-manager':{ script: 'run-account-manager-tlc.cjs', args: () => [] },
  'MCStopHook':       { script: 'run-stop-hook-tlc.cjs',   args: (c) => [c] },
};
function pickTLARunner(configName) {
  return TLA_RUNNER_MAP[configName] || { script: 'run-tlc.cjs', args: (c) => [c] };
}

// Alloy runner picker
const ALLOY_RUNNER_MAP = {
  'quorum-votes':          { script: 'run-alloy.cjs',                   args: [] },
  'scoreboard-recompute':  { script: 'run-audit-alloy.cjs',             args: ['--spec=scoreboard-recompute'] },
  'availability-parsing':  { script: 'run-audit-alloy.cjs',             args: ['--spec=availability-parsing'] },
  'transcript-scan':       { script: 'run-transcript-alloy.cjs',        args: ['--spec=transcript-scan'] },
  'install-scope':         { script: 'run-installer-alloy.cjs',         args: ['--spec=install-scope'] },
  'taxonomy-safety':       { script: 'run-installer-alloy.cjs',         args: ['--spec=taxonomy-safety'] },
  'account-pool-structure':{ script: 'run-account-pool-alloy.cjs',      args: [] },
  'quorum-composition':    { script: 'run-quorum-composition-alloy.cjs', args: [] },
};
function pickAlloyRunner(specName) {
  return (ALLOY_RUNNER_MAP[specName] || { script: 'run-alloy.cjs', args: ['--spec=' + specName] }).script;
}
function pickAlloyArgs(specName) {
  return (ALLOY_RUNNER_MAP[specName] || { script: 'run-alloy.cjs', args: ['--spec=' + specName] }).args;
}

// PRISM runner picker
const PRISM_RUNNER_MAP = {
  'quorum':           { script: 'run-prism.cjs',               args: [] },
  'oauth-rotation':   { script: 'run-oauth-rotation-prism.cjs', args: [] },
  'mcp-availability': { script: 'run-prism.cjs',               args: ['--model=mcp-availability'] },
};
function pickPrismRunner(modelName) {
  return (PRISM_RUNNER_MAP[modelName] || { script: 'run-prism.cjs', args: ['--model=' + modelName] }).script;
}
function pickPrismArgs(modelName) {
  return (PRISM_RUNNER_MAP[modelName] || { script: 'run-prism.cjs', args: ['--model=' + modelName] }).args;
}
```

4. **Replace the hardcoded STEPS array** with:
```js
const STATIC_STEPS = [ /* generate + ci + traceability steps from original STEPS */ ];
const dynamicSteps = discoverModels(ROOT);
const STEPS = [...STATIC_STEPS, ...dynamicSteps];
```

Keep `petri:quorum` in STATIC_STEPS since it uses generate-petri-net.cjs (a generator, not a model file scanner). The wasm-dot steps discovered from .formal/petri/*.dot are for rendering existing DOT files.

5. **Deduplication**: Since generate steps might produce models that are then discovered, and the petri generate step produces DOT files, add dedup logic: if a dynamicStep has the same `id` as a STATIC_STEP, skip the dynamicStep.

6. **Log discovered models** after building STEPS:
```js
process.stdout.write(TAG + ' Static steps: ' + STATIC_STEPS.length + '\n');
process.stdout.write(TAG + ' Discovered models: ' + dynamicSteps.length + '\n');
```

7. **Ensure the NDJSON summary reader** at the end of runOnce() uses `path.join(ROOT, '.formal', 'check-results.ndjson')` instead of `path.join(__dirname, '..', '.formal', 'check-results.ndjson')`.
  </action>
  <verify>
    Run `node bin/run-formal-verify.cjs --only=generate --project-root=/tmp/empty-project 2>&1 | head -20` and confirm it discovers 0 dynamic models and the generate steps exit 0 gracefully (no crash).
    Create a minimal test: `mkdir -p /tmp/test-formal/.formal/tla && echo 'SPECIFICATION Spec' > /tmp/test-formal/.formal/tla/MCtest.cfg && node bin/run-formal-verify.cjs --only=tla --project-root=/tmp/test-formal 2>&1 | head -20` — confirm it discovers and attempts MCtest.
    Run `node bin/run-formal-verify.cjs 2>&1 | grep "Discovered models"` on QGSD itself — confirm it discovers the same ~23 model steps as before.
  </verify>
  <done>
    run-formal-verify.cjs dynamically discovers models from ROOT/.formal/{tla,alloy,prism,petri,uppaal}/ directories. QGSD's own models are still discovered and run identically. External projects with their own .formal/ directory get their models discovered automatically. Projects with no .formal/ directory get only static (CI/traceability) steps.
  </done>
</task>

<task type="auto">
  <name>Task 3: Integration test and backward compatibility verification</name>
  <files>
    bin/run-formal-verify.cjs
  </files>
  <action>
Verify backward compatibility by running the full harness on QGSD itself and confirming the same checks execute:

1. Run `node bin/run-formal-verify.cjs --only=generate 2>&1` and verify both generate steps execute (exit 0 since XState machine exists in QGSD).

2. Run `node bin/run-formal-verify.cjs 2>&1 | tail -40` and capture the summary. Verify:
   - All 34 original step IDs appear in the summary (or their dynamic equivalents)
   - The `--project-root` defaults to CWD (QGSD root) when not specified
   - NDJSON output goes to `.formal/check-results.ndjson` in QGSD root

3. Test external project behavior:
   ```bash
   # Create minimal external project with one TLA+ model
   TESTDIR=$(mktemp -d)
   mkdir -p "$TESTDIR/.formal/tla"
   cp .formal/tla/tla2tools.jar "$TESTDIR/.formal/tla/" 2>/dev/null
   echo 'SPECIFICATION Spec' > "$TESTDIR/.formal/tla/MCexternal.cfg"
   # Run and verify discovery
   node bin/run-formal-verify.cjs --only=tla --project-root="$TESTDIR" 2>&1 | grep -E "Discovered|MCexternal"
   rm -rf "$TESTDIR"
   ```

4. Test graceful skip of generate-formal-specs.cjs:
   ```bash
   TESTDIR=$(mktemp -d)
   mkdir -p "$TESTDIR/.formal"
   node bin/generate-formal-specs.cjs --project-root="$TESTDIR" 2>&1
   echo "Exit code: $?"  # Should be 0
   rm -rf "$TESTDIR"
   ```

5. If any issues are found during verification, fix them in the affected files.
  </action>
  <verify>
    All verification commands in the action section pass. Exit codes are 0 for graceful skips. QGSD's own formal checks still pass (or fail for the same reasons as before, e.g., missing PRISM binary).
  </verify>
  <done>
    The formal verification harness is fully project-agnostic: it discovers models from any ROOT/.formal/ directory, gracefully skips QGSD-specific prerequisites, and maintains full backward compatibility when run on QGSD itself.
  </done>
</task>

</tasks>

<verification>
1. `grep -r "__dirname.*\.formal" bin/run-*.cjs bin/write-check-result.cjs | grep -v test | grep -v node_modules` returns zero matches
2. `node bin/run-formal-verify.cjs --project-root=/tmp/empty-project 2>&1` exits without crash (static steps may fail but no unhandled exceptions)
3. `node bin/run-formal-verify.cjs 2>&1 | grep "Discovered models"` shows the correct count of QGSD models
4. `node bin/generate-formal-specs.cjs --project-root=/tmp/nonexistent 2>&1; echo $?` prints 0 (graceful skip)
</verification>

<success_criteria>
- All runner scripts resolve paths from ROOT (via --project-root flag), not __dirname
- run-formal-verify.cjs discovers models dynamically from ROOT/.formal/{tla,alloy,prism,petri,uppaal}/
- NDJSON output writes to ROOT/.formal/check-results.ndjson
- generate-formal-specs.cjs exits 0 when XState machine is missing
- run-tlc.cjs accepts any config name as long as the .cfg file exists (no whitelist rejection)
- Full backward compatibility: running without --project-root on QGSD produces identical behavior
</success_criteria>

<output>
After completion, create `.planning/quick/167-implement-solve-05-make-the-formal-verif/167-SUMMARY.md`
</output>
