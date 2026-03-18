---
phase: quick-324
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - bin/consequence-model-generator.cjs
  - bin/consequence-model-generator.test.cjs
  - bin/solution-simulation-loop.cjs
  - bin/solution-simulation-loop.test.cjs
  - core/workflows/model-driven-fix.md
  - commands/nf/model-driven-fix.md
  - .gitignore
autonomous: true
requirements: [QUICK-324]
formal_artifacts: none

must_haves:
  truths:
    - "Session artifacts (consequence-model.tla, normalized-mutations.json, iteration-history.json) are written to os.tmpdir() not .planning/formal/cycle2-simulations/"
    - "Existing 121 session directories under .planning/formal/cycle2-simulations/ are selectively removed (only hex-named subdirs, parent dir preserved)"
    - "All tests pass with the new tmpdir-based session paths and include afterEach cleanup for tmpdir artifacts"
    - "model-driven-fix.md workflows updated to reference os.tmpdir() instead of .planning/formal/cycle2-simulations/"
  artifacts:
    - path: "bin/consequence-model-generator.cjs"
      provides: "Consequence model generation with tmpdir session output"
      contains: "os.tmpdir()"
    - path: "bin/solution-simulation-loop.cjs"
      provides: "Solution simulation loop with tmpdir session output"
      contains: "os.tmpdir()"
    - path: "core/workflows/model-driven-fix.md"
      provides: "Updated workflow with tmpdir session paths"
      contains: "os.tmpdir()"
  key_links:
    - from: "bin/solution-simulation-loop.cjs"
      to: "bin/consequence-model-generator.cjs"
      via: "generator.generateConsequenceModel() returns sessionDir"
      pattern: "generateConsequenceModel"
    - from: "bin/solution-simulation-loop.cjs"
      to: "os.tmpdir()"
      via: "iteration-history.json written to tmpdir session"
      pattern: "os\\.tmpdir"
    - from: "core/workflows/model-driven-fix.md"
      to: "os.tmpdir()"
      via: "bug-trace.itf path uses tmpdir"
      pattern: "os\\.tmpdir"
  consumers:
    - artifact: "Session tmpdir paths"
      consumed_by: "model-driven-fix.md workflow (Phase 4.5)"
      integration: "BUG_TRACE_PATH uses os.tmpdir()/nf-cycle2-simulations"
      verify_pattern: "BUG_TRACE_PATH"
---

<objective>
Route cycle2-simulations session artifacts to os.tmpdir() instead of .planning/formal/cycle2-simulations/ in the repo tree, clean up only stale hex-named session subdirectories (not parent dir), add test cleanup for consequence-model-generator tests, and update workflow references to use the new tmpdir paths.

Purpose: Session artifacts (consequence-model.tla, normalized-mutations.json, iteration-history.json) are ephemeral per-run outputs. Writing them into the repo tree pollutes the working directory with untracked files and risks accidental commits. Test cleanup prevents tmpdir leaks on repeated runs. Contract documentation updates ensure consumers find artifacts at the new location.

Output: Both modules write session dirs under os.tmpdir(), existing session dirs cleaned (selective), all tests include cleanup, workflows updated, .gitignore safety net added.
</objective>

<execution_context>
@/Users/jonathanborduas/.claude/nf/workflows/execute-plan.md
@/Users/jonathanborduas/.claude/nf/templates/summary.md
</execution_context>

<context>
@bin/consequence-model-generator.cjs
@bin/consequence-model-generator.test.cjs
@bin/solution-simulation-loop.cjs
@bin/solution-simulation-loop.test.cjs
@core/workflows/model-driven-fix.md
</context>

<tasks>

<task type="auto">
  <name>Task 1: Route session directories to os.tmpdir() in both modules</name>
  <files>
    bin/consequence-model-generator.cjs
    bin/solution-simulation-loop.cjs
  </files>
  <action>
In bin/consequence-model-generator.cjs:
- Add `const os = require('os');` at the top (after existing requires on line 9)
- Line 84: Change `const sessionDir = path.join(process.cwd(), '.planning/formal/cycle2-simulations', sessionId);` to `const sessionDir = path.join(os.tmpdir(), 'nf-cycle2-simulations', sessionId);`
- The prefix `nf-cycle2-simulations` keeps session dirs namespaced and identifiable in tmpdir

In bin/solution-simulation-loop.cjs:
- Add `const os = require('os');` at the top (after existing requires, it already imports crypto)
- Line 247: Change `const sessionDir = path.join(process.cwd(), '.planning', 'formal', 'cycle2-simulations', sessionId);` to `const sessionDir = path.join(os.tmpdir(), 'nf-cycle2-simulations', sessionId);`

Both modules must use the SAME path prefix (`nf-cycle2-simulations` under `os.tmpdir()`) so the simulation loop can find artifacts created by the consequence model generator within the same session.

Do NOT change any function signatures, return types, or the sessionDir field in return values -- consumers already receive the full path via the return object.
  </action>
  <verify>
Run: `grep -n 'os.tmpdir' bin/consequence-model-generator.cjs bin/solution-simulation-loop.cjs` -- should show 1 match each.
Run: `grep -n 'cycle2-simulations' bin/consequence-model-generator.cjs bin/solution-simulation-loop.cjs` -- should show `nf-cycle2-simulations` in tmpdir context only, NO references to `.planning/formal/cycle2-simulations`.
  </verify>
  <done>Both modules create session directories under os.tmpdir()/nf-cycle2-simulations/ instead of .planning/formal/cycle2-simulations/. No .planning path references remain in session dir construction.</done>
</task>

<task type="auto">
  <name>Task 2: Update tests with cleanup and fix assertions for consequence-model-generator and solution-simulation-loop</name>
  <files>
    bin/consequence-model-generator.test.cjs
    bin/solution-simulation-loop.test.cjs
  </files>
  <action>
In bin/consequence-model-generator.test.cjs:
- Line 164 assertion `assert(result.sessionDir.includes('cycle2-simulations'));` -- update to `assert(result.sessionDir.includes('nf-cycle2-simulations'));` so it matches the new tmpdir-based path.
- After line 167 in the cleanup block, add an additional cleanup statement for the tmpdir session artifact:
  ```javascript
  fs.rmSync(path.join(os.tmpdir(), 'nf-cycle2-simulations', result.sessionId), { recursive: true, force: true });
  ```
- This ensures tmpdir session dirs created during tests are cleaned up (not just the tempDir for the test model file).

In bin/solution-simulation-loop.test.cjs:
- The test at line 271-278 constructs `historyPath` using `path.join(tmpDir, '.planning', 'formal', 'cycle2-simulations', result.sessionId, 'iteration-history.json')`. This will NOT match anymore because the loop now writes to os.tmpdir().
- Change the historyPath construction to: `path.join(os.tmpdir(), 'nf-cycle2-simulations', result.sessionId, 'iteration-history.json')` (os is already imported in this test file).
- The setupTestEnv helper at line 34 creates `.planning/formal/cycle2-simulations` directory in tmpDir -- this is no longer needed for the simulation loop. Remove lines 34-36 (the `simDir` creation and mkdirSync call). Remove `simDir` from the return on line 56. The module now creates its own session dir under os.tmpdir().
- Add cleanup after the history assertion in Test 5 (line ~287), in the finally block add:
  ```javascript
  fs.rmSync(path.join(os.tmpdir(), 'nf-cycle2-simulations', result.sessionId), { recursive: true, force: true });
  ```
  This cleans up tmpdir session artifacts created during testing.

Run the full test suite for both files to confirm all tests pass:
```bash
node --test bin/consequence-model-generator.test.cjs
node --test bin/solution-simulation-loop.test.cjs
```
  </action>
  <verify>
Run: `node --test bin/consequence-model-generator.test.cjs` -- all tests pass.
Run: `node --test bin/solution-simulation-loop.test.cjs` -- all tests pass.
Run: `grep -n 'nf-cycle2-simulations' bin/consequence-model-generator.test.cjs bin/solution-simulation-loop.test.cjs` -- both should reference nf-cycle2-simulations, not .planning path.
  </verify>
  <done>All tests pass with tmpdir-based session paths. Both test files include afterEach/finally cleanup to prevent tmpdir leaks on repeated test runs.</done>
</task>

<task type="auto">
  <name>Task 3: Update model-driven-fix.md workflows and clean up repo artifacts selectively</name>
  <files>
    core/workflows/model-driven-fix.md
    commands/nf/model-driven-fix.md
    .gitignore
  </files>
  <action>
Update core/workflows/model-driven-fix.md:
- Find line 242 (Phase 4 — Solution Simulation section): `BUG_TRACE_PATH=".planning/formal/cycle2-simulations/$(date +%s)/bug-trace.itf"`
- Change to: `BUG_TRACE_PATH="$(mktemp -d -t nf-cycle2-simulations.XXXXXX)/bug-trace.itf"`
- This routes bug-trace output to a tmpdir directory with a proper temp directory name, consistent with other session artifacts.

Update commands/nf/model-driven-fix.md (sync to installed version):
- Apply the same change to line 242 in commands/nf/model-driven-fix.md.

Clean up existing repo artifacts selectively:
- Do NOT delete the entire `.planning/formal/cycle2-simulations/` parent directory.
- Instead, selectively remove only hex-named (16-character hexadecimal) session subdirectories which are the stale artifacts.
- Run: `find .planning/formal/cycle2-simulations -maxdepth 1 -type d -name '[0-9a-f]*' -exec rm -rf {} \; 2>/dev/null || true`
- This preserves the parent directory and removes only the session directories (hex-named), not any other content that might exist.

Add .gitignore safety net:
- Append `# Session artifacts from cycle2 simulations (route to os.tmpdir() instead)
.planning/formal/cycle2-simulations/` to .gitignore so if any old code path still writes there, it won't pollute git status.

Verify workflow files are in sync:
```bash
diff core/workflows/model-driven-fix.md commands/nf/model-driven-fix.md | grep -c "242"
```
Should be 0 (no diff on line 242).
  </action>
  <verify>
Run: `grep -n 'mktemp.*nf-cycle2-simulations' core/workflows/model-driven-fix.md commands/nf/model-driven-fix.md` -- both should show the mktemp line.
Run: `test -d .planning/formal/cycle2-simulations && echo "PASS: dir still exists" || echo "FAIL: dir removed"` -- should print PASS (parent dir preserved).
Run: `find .planning/formal/cycle2-simulations -maxdepth 1 -type d -name '[0-9a-f]*' | wc -l` -- should be 0 (no hex session dirs remain).
Run: `grep 'cycle2-simulations' .gitignore` -- should show the safety-net entry.
Run: `diff core/workflows/model-driven-fix.md commands/nf/model-driven-fix.md` -- should be empty (files in sync).
  </verify>
  <done>Workflows updated to use tmpdir for bug-trace output. Parent directory .planning/formal/cycle2-simulations/ preserved, 121 stale hex-named session subdirectories removed. Workflow files in sync. Gitignore updated as safety net.</done>
</task>

</tasks>

<verification>
1. `grep -rn 'process.cwd.*\.planning.*cycle2' bin/consequence-model-generator.cjs bin/solution-simulation-loop.cjs` returns empty (no repo-relative session paths remain in code)
2. `grep -rn 'os\.tmpdir.*nf-cycle2' bin/consequence-model-generator.cjs bin/solution-simulation-loop.cjs` returns 2 matches (one per module)
3. `grep -rn 'mktemp.*nf-cycle2-simulations' core/workflows/model-driven-fix.md commands/nf/model-driven-fix.md` returns 2 matches (workflow files synced)
4. `node --test bin/consequence-model-generator.test.cjs` passes
5. `node --test bin/solution-simulation-loop.test.cjs` passes
6. `.planning/formal/cycle2-simulations/` parent directory still exists
7. `find .planning/formal/cycle2-simulations -maxdepth 1 -type d -name '[0-9a-f]*'` returns empty (no hex session dirs)
8. `.gitignore` contains cycle2-simulations safety net entry
</verification>

<success_criteria>
- Session artifacts route to os.tmpdir()/nf-cycle2-simulations/{sessionId}/ in both modules
- Test files include afterEach/finally cleanup for tmpdir session artifacts
- All existing tests pass (no regressions)
- 121 stale session directories removed from repo tree (only hex-named subdirs, parent dir preserved)
- .planning/formal/cycle2-simulations/ parent directory remains in tree
- model-driven-fix.md workflows updated to use mktemp for bug-trace routing
- core and commands versions of model-driven-fix.md are in sync
- .gitignore contains cycle2-simulations safety net entry
</success_criteria>

<output>
After completion, create `.planning/quick/324-route-cycle2-simulations-session-artifac/324-SUMMARY.md`
</output>
