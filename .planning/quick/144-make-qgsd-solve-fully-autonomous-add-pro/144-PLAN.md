---
phase: quick-144
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - bin/extract-annotations.cjs
  - bin/generate-traceability-matrix.cjs
  - bin/formal-test-sync.cjs
  - bin/run-formal-verify.cjs
  - bin/qgsd-solve.cjs
  - bin/qgsd-solve.test.cjs
  - commands/qgsd/solve.md
  - commands/qgsd/close-formal-gaps.md
  - qgsd-core/workflows/close-formal-gaps.md
autonomous: true
formal_artifacts: none

must_haves:
  truths:
    - "/qgsd:solve runs fully autonomously without asking user questions"
    - "Diagnostic scripts work cross-repo via --project-root flag"
    - "solve.md uses absolute paths (~/.claude/qgsd-bin/) with --project-root=$(pwd)"
    - "close-formal-gaps accepts --batch flag to skip AskUserQuestion"
    - "F->C remediation dispatches to /qgsd:quick instead of /qgsd:debug"
  artifacts:
    - path: "bin/qgsd-solve.cjs"
      provides: "--project-root flag + SCRIPT_DIR separation"
      contains: "--project-root"
    - path: "bin/extract-annotations.cjs"
      provides: "--project-root flag for cross-repo annotation extraction"
      contains: "--project-root"
    - path: "bin/generate-traceability-matrix.cjs"
      provides: "--project-root flag + forwarding to child scripts"
      contains: "--project-root"
    - path: "bin/formal-test-sync.cjs"
      provides: "--project-root flag + forwarding to child scripts"
      contains: "--project-root"
    - path: "bin/run-formal-verify.cjs"
      provides: "--project-root flag for formal verification paths"
      contains: "--project-root"
    - path: "commands/qgsd/solve.md"
      provides: "Fully autonomous orchestrator with absolute paths"
      contains: "AUTONOMY REQUIREMENT"
    - path: "qgsd-core/workflows/close-formal-gaps.md"
      provides: "--batch mode for unattended cluster approval"
      contains: "--batch"
  key_links:
    - from: "bin/qgsd-solve.cjs"
      to: "bin/extract-annotations.cjs"
      via: "--project-root forwarded to child scripts"
      pattern: "--project-root"
    - from: "commands/qgsd/solve.md"
      to: "~/.claude/qgsd-bin/qgsd-solve.cjs"
      via: "absolute path with --project-root=$(pwd)"
      pattern: "qgsd-bin/qgsd-solve.cjs"
    - from: "commands/qgsd/solve.md"
      to: "commands/qgsd/close-formal-gaps.md"
      via: "--batch flag for autonomous dispatch"
      pattern: "--batch"
---

<objective>
Make /qgsd:solve fully autonomous so it can run in any project without user interaction, find its scripts via absolute paths, and complete remediation loops unattended.

Purpose: Currently solve.md uses CWD-relative script paths (fail in external repos), includes AskUserQuestion in allowed tools (breaks autonomy), and dispatches to /qgsd:debug (user-driven). These three issues prevent autonomous solver operation.

Output: Updated diagnostic scripts with --project-root support, rewritten solve.md for full autonomy, --batch mode on close-formal-gaps.
</objective>

<execution_context>
@/Users/jonathanborduas/.claude/qgsd/workflows/execute-plan.md
@/Users/jonathanborduas/.claude/qgsd/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@bin/qgsd-solve.cjs
@bin/extract-annotations.cjs
@bin/generate-traceability-matrix.cjs
@bin/formal-test-sync.cjs
@bin/run-formal-verify.cjs
@commands/qgsd/solve.md
@commands/qgsd/close-formal-gaps.md
@qgsd-core/workflows/close-formal-gaps.md
</context>

<tasks>

<task type="auto">
  <name>Task 1: Add --project-root flag to all 5 diagnostic scripts</name>
  <files>
    bin/extract-annotations.cjs
    bin/generate-traceability-matrix.cjs
    bin/formal-test-sync.cjs
    bin/run-formal-verify.cjs
    bin/qgsd-solve.cjs
    bin/qgsd-solve.test.cjs
  </files>
  <action>
Add `--project-root` CLI flag to each of the 5 scripts. The pattern is identical in each:

**For all 5 scripts**, add this arg-parsing block after the existing CLI flag parsing but BEFORE any constant that uses ROOT:

```javascript
// Parse --project-root (overrides CWD-based ROOT for cross-repo usage)
for (const arg of process.argv.slice(2)) {
  if (arg.startsWith('--project-root=')) {
    ROOT = path.resolve(arg.slice('--project-root='.length));
  }
}
```

Change `const ROOT = ...` to `let ROOT = ...` so it can be reassigned.

**Specific per-script changes:**

1. **bin/extract-annotations.cjs** (line 20):
   - Change `const REGISTRY_PATH = path.resolve(__dirname, '..', '.formal', 'model-registry.json');` to use ROOT instead of `__dirname, '..'`
   - Move REGISTRY_PATH below the --project-root parsing
   - Change all `path.resolve(__dirname, '..', X)` to `path.join(ROOT, X)` for DATA paths (registry, formal files, hooks dir, bin dir for test file scanning)
   - KEEP `__dirname` only for finding sibling scripts (none in this file)

2. **bin/generate-traceability-matrix.cjs** (line 26):
   - Change `const ROOT = path.resolve(__dirname, '..');` to `let ROOT = ...`
   - Move ROOT-dependent constants (REGISTRY_PATH, NDJSON_PATH, REQUIREMENTS_PATH, OUTPUT_PATH) below --project-root parsing
   - KEEP `const ANNOTATIONS_SCRIPT = path.join(__dirname, 'extract-annotations.cjs');` using `__dirname` (sibling script)
   - Forward `--project-root` when spawning extract-annotations.cjs: add `'--project-root=' + ROOT` to the spawn args in loadAnnotations()
   - KEEP `const analyzerPath = path.join(__dirname, 'analyze-state-space.cjs');` using `__dirname` (sibling script)
   - Forward `--project-root` when spawning analyze-state-space.cjs in loadStateSpaceAnalysis()

3. **bin/formal-test-sync.cjs** (lines 21-28):
   - Change `const ROOT = path.resolve(__dirname, '..');` to `let ROOT = ...`
   - Move ROOT-dependent constants (CONSTANTS_MAPPING_PATH, REQUIREMENTS_PATH, CONFIG_LOADER_PATH, REPORT_OUTPUT_PATH, SIDECAR_OUTPUT_PATH, stubsDir) below --project-root parsing
   - KEEP `const EXTRACT_ANNOTATIONS_SCRIPT = path.join(__dirname, 'extract-annotations.cjs');` using `__dirname`
   - Forward `--project-root` when spawning extract-annotations.cjs in loadFormalAnnotations()

4. **bin/run-formal-verify.cjs**:
   - Add `--project-root` parsing
   - Replace data-file references like `path.join(__dirname, '..', '.formal', ...)` with `path.join(ROOT, '.formal', ...)`
   - KEEP `__dirname` for finding sibling scripts in the STEPS array (e.g., `path.join(__dirname, 'xstate-to-tla.cjs')`)
   - Forward `--project-root` to child scripts that need it

5. **bin/qgsd-solve.cjs** (the orchestrator):
   - Change `const ROOT = path.resolve(__dirname, '..');` to `let ROOT = path.resolve(__dirname, '..');`
   - Add `--project-root` parsing (same pattern)
   - Add `const SCRIPT_DIR = __dirname;` (NEVER overridden -- always where scripts live)
   - Update `spawnTool()`:
     - Find scripts via `path.join(SCRIPT_DIR, path.basename(script))` instead of `path.join(ROOT, script)`
     - Auto-forward `--project-root=` + ROOT to child script args
     - Set `cwd: ROOT` for spawned processes (already does this)
   - Update sweepTtoC: set `cwd: ROOT` (already does this)
   - Update sweepFtoC: `const verifyScript = path.join(SCRIPT_DIR, 'run-formal-verify.cjs');` (use SCRIPT_DIR)

**Test addition in bin/qgsd-solve.test.cjs:**

Add one integration test verifying --project-root works cross-CWD:

```javascript
test('TC-INT: --project-root overrides CWD for diagnostic sweep', () => {
  const result = spawnSync(process.execPath, [
    path.join(ROOT, 'bin', 'qgsd-solve.cjs'),
    '--json',
    '--report-only',
    '--project-root=' + ROOT,
  ], {
    encoding: 'utf8',
    cwd: '/tmp',
    timeout: 120000,
  });
  const parsed = JSON.parse(result.stdout);
  assert.ok(parsed.residual_vector, 'Should have residual_vector');
  assert.equal(typeof parsed.residual_vector.total, 'number');
});
```

CRITICAL RULES:
- `__dirname` = where the SCRIPT lives (for finding sibling scripts) -- NEVER changes
- `ROOT` = the PROJECT being analyzed (default: parent of __dirname, overridden by --project-root)
- Data files (.formal/*, .planning/*, hooks/*, package.json) use ROOT
- Sibling scripts (extract-annotations.cjs, etc.) use __dirname or SCRIPT_DIR
  </action>
  <verify>
Run `node --test bin/qgsd-solve.test.cjs` -- all existing tests plus new TC-INT test pass.
Run `node bin/qgsd-solve.cjs --json --report-only` from QGSD repo -- works as before.
Run `cd /tmp && node /Users/jonathanborduas/code/QGSD/bin/qgsd-solve.cjs --json --report-only --project-root=/Users/jonathanborduas/code/QGSD` -- produces valid JSON with residual_vector.
  </verify>
  <done>
All 5 diagnostic scripts accept --project-root flag. ROOT defaults to parent-of-__dirname but can be overridden. Scripts find sibling scripts via __dirname, data files via ROOT. Child scripts receive --project-root forwarding. All existing tests pass plus new cross-CWD test.
  </done>
</task>

<task type="auto">
  <name>Task 2: Rewrite solve.md for autonomy + add --batch to close-formal-gaps</name>
  <files>
    commands/qgsd/solve.md
    commands/qgsd/close-formal-gaps.md
    qgsd-core/workflows/close-formal-gaps.md
  </files>
  <action>
**2a. Rewrite commands/qgsd/solve.md:**

- Remove `AskUserQuestion` from the `allowed-tools` list in the YAML frontmatter

- Add autonomy directive as the FIRST thing inside the `<execution_context>` section:
```
AUTONOMY REQUIREMENT: This skill runs FULLY AUTONOMOUSLY. Do NOT ask the user
any questions. Do NOT stop for human input. If a sub-skill fails, log the
failure and continue to the next gap. The only valid reason to stop is:
all iterations exhausted, or total residual is zero.
```

- Replace ALL CWD-relative script paths with absolute paths using `~/.claude/qgsd-bin/` and `--project-root=$(pwd)`:
  - `node bin/qgsd-solve.cjs` becomes `node ~/.claude/qgsd-bin/qgsd-solve.cjs --project-root=$(pwd)`
  - `node bin/formal-test-sync.cjs` becomes `node ~/.claude/qgsd-bin/formal-test-sync.cjs --project-root=$(pwd)`
  - `node bin/run-formal-verify.cjs` becomes `node ~/.claude/qgsd-bin/run-formal-verify.cjs --project-root=$(pwd)`

- Add fallback note after the first script reference in Step 1:
```
If ~/.claude/qgsd-bin/qgsd-solve.cjs does not exist, fall back to bin/qgsd-solve.cjs (CWD-relative).
If neither exists, error with: "QGSD solve scripts not installed. Run `node bin/install.js --claude --global` from the QGSD repo."
```

- Update Step 3a (R->F remediation): change dispatch to `/qgsd:close-formal-gaps --batch --ids=REQ-01,REQ-02,...` (10 or fewer) or `/qgsd:close-formal-gaps --batch --all` (more than 10). The `--batch` flag is critical for autonomy.

- Update Step 3e (F->C remediation): Replace ALL `/qgsd:debug` dispatches with `/qgsd:quick`. The debug skill is user-driven and breaks autonomy. Change the dispatch table:
  - "Conformance divergence" dispatch: `/qgsd:quick Fix conformance trace divergences in {model_file}: {error_detail}`
  - "Verification failure" dispatch: `/qgsd:quick Fix formal verification counterexample in {check_id}: {summary}`

- Strengthen the iteration loop text in Step 5 to be explicit:
  - Default `--max-iterations=5` (already present, keep it)
  - After each remediation round, always re-run diagnostic via `--json --report-only`
  - Continue if residual decreased AND > 0
  - Stop if residual unchanged, residual increased, or residual is zero
  - Log iteration number and residual delta each round

**2b. Update qgsd-core/workflows/close-formal-gaps.md:**

In Step 1 (detect_gaps), after the line about `--all`, add handling for `--batch`:

```
If `--batch` is provided:
- Treat as `--all` if no `--ids`/`--category` is specified
- Skip ALL AskUserQuestion calls throughout the workflow
- Auto-approve proposed clusters in Step 2 without user confirmation
- Log decisions instead of asking for input

When `--batch` is active, do NOT use AskUserQuestion at any point in this workflow.
```

In Step 2 (cluster_requirements), after "Wait for user approval":
```
If `--batch` is active, auto-approve the proposed clusters as-is. Log:
"[batch] Auto-approving {N} clusters with {M} total requirements"
```

**2c. Update commands/qgsd/close-formal-gaps.md:**

Add `--batch` to the argument-hint in the YAML frontmatter:
```
argument-hint: [--batch] [--category="Category Name"] [--ids=REQ-01,REQ-02] [--all] [--formalism=tla|alloy|prism|petri] [--dry-run]
```

Add `--batch` documentation in the process section flag list:
```
  --batch                       Fully autonomous mode — skip all user prompts, auto-approve clusters
```
  </action>
  <verify>
1. Read commands/qgsd/solve.md and confirm:
   - AskUserQuestion is NOT in allowed-tools
   - "AUTONOMY REQUIREMENT" text is present in execution_context
   - All script references use `~/.claude/qgsd-bin/` with `--project-root=$(pwd)`
   - No `/qgsd:debug` dispatches remain (replaced with `/qgsd:quick`)
   - close-formal-gaps dispatches include `--batch`
2. Read qgsd-core/workflows/close-formal-gaps.md and confirm `--batch` handling in Steps 1 and 2
3. Read commands/qgsd/close-formal-gaps.md and confirm `--batch` in argument-hint
  </verify>
  <done>
solve.md is fully autonomous: no AskUserQuestion, absolute script paths with --project-root, --batch on close-formal-gaps dispatches, /qgsd:quick replaces /qgsd:debug for F->C gaps. close-formal-gaps.md supports --batch mode that auto-approves clusters and skips all user prompts.
  </done>
</task>

</tasks>

<verification>
1. `node --test bin/qgsd-solve.test.cjs` -- all tests pass including new --project-root test
2. `node bin/qgsd-solve.cjs --json --report-only` from QGSD repo -- works as before (backward compatible)
3. `cd /tmp && node ~/.claude/qgsd-bin/qgsd-solve.cjs --json --report-only --project-root=/Users/jonathanborduas/code/QGSD` -- works cross-repo (after install sync)
4. `grep -c 'AskUserQuestion' commands/qgsd/solve.md` returns 0
5. `grep -c 'AUTONOMY REQUIREMENT' commands/qgsd/solve.md` returns 1
6. `grep -c 'qgsd-bin' commands/qgsd/solve.md` returns 3+ (all script refs use absolute paths)
7. `grep -c '\-\-batch' qgsd-core/workflows/close-formal-gaps.md` returns 3+ (batch handling added)
8. `grep -c 'qgsd:debug' commands/qgsd/solve.md` returns 0 (no debug dispatches remain)
</verification>

<success_criteria>
- All 5 diagnostic scripts support --project-root flag with backward-compatible defaults
- qgsd-solve.cjs separates SCRIPT_DIR (sibling script location) from ROOT (project data location)
- solve.md runs fully autonomously: no user questions, absolute script paths, batch sub-skill dispatch
- close-formal-gaps supports --batch mode for unattended operation
- All existing tests continue to pass
- New cross-CWD integration test validates --project-root
</success_criteria>

<output>
After completion, create `.planning/quick/144-make-qgsd-solve-fully-autonomous-add-pro/144-SUMMARY.md`
</output>
