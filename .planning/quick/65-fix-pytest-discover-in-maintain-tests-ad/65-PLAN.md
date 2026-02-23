---
phase: quick-65
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - get-shit-done/bin/gsd-tools.cjs
  - ~/.claude/qgsd/bin/gsd-tools.cjs
autonomous: true
requirements: []

must_haves:
  truths:
    - "pytest discover returns test files even when pyproject.toml sets addopts = -v"
    - "pytest discover handles <Module test_file.py> verbose tree output as a fallback"
    - "installed copy at ~/.claude/qgsd/bin/gsd-tools.cjs reflects the fix"
  artifacts:
    - path: "get-shit-done/bin/gsd-tools.cjs"
      provides: "Fixed invokePytest() with --override-ini and Module fallback parser"
      contains: "--override-ini=addopts="
  key_links:
    - from: "get-shit-done/bin/gsd-tools.cjs invokePytest()"
      to: "pytest --collect-only -q --override-ini=addopts="
      via: "spawnSync args array"
      pattern: "override-ini"
    - from: "invokePytest() fallback parser"
      to: "<Module filename.py> lines"
      via: "regex match on verbose output"
      pattern: "<Module\\s"
---

<objective>
Fix `invokePytest()` in `cmdMaintainTestsDiscover` so pytest discovery works correctly on projects whose `pyproject.toml` sets `addopts = -v`, which overrides the `-q` flag and produces verbose `<Module>` tree output instead of the `path::test_name` flat format the parser expects.

Purpose: `maintain-tests discover` currently returns 0 test files for any Python project with `addopts = -v` in pyproject.toml, making the entire maintain-tests workflow unusable on those projects.
Output: Updated `gsd-tools.cjs` (source + installed) with two-layer fix.
</objective>

<execution_context>
@/Users/jonathanborduas/.claude/get-shit-done/workflows/execute-plan.md
@/Users/jonathanborduas/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
</context>

<tasks>

<task type="auto">
  <name>Task 1: Fix invokePytest — add --override-ini flag and Module fallback parser</name>
  <files>get-shit-done/bin/gsd-tools.cjs</files>
  <action>
    In `invokePytest()` (around line 5905), make two changes:

    **Change 1 — Add `--override-ini=addopts=` to the pytest command:**

    Replace the spawnSync call:
    ```js
    const result = spawnSync(pyExe, [...pyPre, '-m', 'pytest', '--collect-only', '-q'], {
    ```
    with:
    ```js
    const result = spawnSync(pyExe, [...pyPre, '-m', 'pytest', '--collect-only', '-q', '--override-ini=addopts='], {
    ```

    This clears any project-level `addopts` (including `-v`) so `-q` takes effect and produces the flat `path::test_name` format.

    **Change 2 — Add fallback parser for verbose `<Module>` tree output:**

    After the existing `::` parser block (the `if (line.includes('::'))` block), add a fallback that handles the verbose tree format produced when `--override-ini` is insufficient (e.g., conftest.py re-injects verbose mode):

    The current parser loop:
    ```js
    for (const line of lines) {
      if (line.startsWith('ERROR') || line.startsWith('=') || line.trim() === '') continue;
      if (line.includes('::')) {
        const filePart = line.split('::')[0].trim();
        if (filePart) {
          const abs = path.isAbsolute(filePart) ? filePart : path.resolve(searchDir, filePart);
          files.add(abs);
        }
      }
    }
    ```

    Replace with:
    ```js
    for (const line of lines) {
      if (line.startsWith('ERROR') || line.startsWith('=') || line.trim() === '') continue;
      if (line.includes('::')) {
        const filePart = line.split('::')[0].trim();
        if (filePart) {
          const abs = path.isAbsolute(filePart) ? filePart : path.resolve(searchDir, filePart);
          files.add(abs);
        }
      }
    }
    // Fallback: if no :: lines found, try parsing verbose <Module filename.py> tree format
    if (files.size === 0) {
      const modulePattern = /^<Module\s+(.+\.py)>/;
      for (const line of lines) {
        const m = line.trim().match(modulePattern);
        if (m) {
          const filePart = m[1].trim();
          const abs = path.isAbsolute(filePart) ? filePart : path.resolve(searchDir, filePart);
          files.add(abs);
        }
      }
    }
    ```

    The fallback only activates when the primary `::` parser found nothing, so it does not interfere with normal output.
  </action>
  <verify>
    Search the source file to confirm both changes landed:
    ```
    grep -n "override-ini" get-shit-done/bin/gsd-tools.cjs
    grep -n "modulePattern\|Module" get-shit-done/bin/gsd-tools.cjs
    ```
    Both should return matches within the `invokePytest` function body.
  </verify>
  <done>
    `get-shit-done/bin/gsd-tools.cjs` contains `--override-ini=addopts=` in the pytest spawnSync args and a `modulePattern` fallback block after the primary `::` parser.
  </done>
</task>

<task type="auto">
  <name>Task 2: Install sync — propagate fix to ~/.claude/qgsd/</name>
  <files>~/.claude/qgsd/bin/gsd-tools.cjs</files>
  <action>
    Run the installer to sync the updated source to the installed copy:
    ```
    node /Users/jonathanborduas/code/QGSD/bin/install.js --claude --global
    ```
    This is mandatory per project convention: `get-shit-done/` source edits must be followed by install sync because `~/.claude/qgsd/` is what actually runs during Claude Code sessions.
  </action>
  <verify>
    Confirm the installed copy has the fix:
    ```
    grep -n "override-ini" ~/.claude/qgsd/bin/gsd-tools.cjs
    ```
    Should return a match.
  </verify>
  <done>
    `~/.claude/qgsd/bin/gsd-tools.cjs` contains `--override-ini=addopts=` — installed copy is in sync with source.
  </done>
</task>

</tasks>

<verification>
1. Source file contains `--override-ini=addopts=` in `invokePytest()` spawnSync args.
2. Source file contains `modulePattern` fallback block for verbose `<Module>` output.
3. Installed copy `~/.claude/qgsd/bin/gsd-tools.cjs` also contains `--override-ini=addopts=`.
</verification>

<success_criteria>
- `grep "override-ini" get-shit-done/bin/gsd-tools.cjs` returns a match inside `invokePytest`
- `grep "modulePattern" get-shit-done/bin/gsd-tools.cjs` returns a match inside `invokePytest`
- `grep "override-ini" ~/.claude/qgsd/bin/gsd-tools.cjs` returns a match (install sync confirmed)
- Projects with `addopts = -v` in pyproject.toml will now have their test files discovered correctly
</success_criteria>

<output>
After completion, create `.planning/quick/65-fix-pytest-discover-in-maintain-tests-ad/65-SUMMARY.md`
</output>
