---
phase: quick-220
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - bin/nf-solve.cjs
  - bin/nf-solve.test.cjs
autonomous: true
formal_artifacts: none
requirements: [QUICK-220]

must_haves:
  truths:
    - "Every nf-solve run persists a timestamped session summary markdown file to .planning/formal/solve-sessions/"
    - "Session summary contains the full human-readable report (layer table, detail sections, actions taken)"
    - "Session summaries survive context clears and compaction — they are on disk, not in conversation"
    - "Old session files are pruned to keep only the last N runs (default 20)"
  artifacts:
    - path: "bin/nf-solve.cjs"
      provides: "persistSessionSummary() function + call site in main()"
      contains: "persistSessionSummary"
    - path: ".planning/formal/solve-sessions/"
      provides: "Directory for timestamped session summaries"
    - path: "bin/nf-solve.test.cjs"
      provides: "Tests for session persistence"
      contains: "persistSessionSummary"
  key_links:
    - from: "bin/nf-solve.cjs main()"
      to: ".planning/formal/solve-sessions/"
      via: "persistSessionSummary() called after formatReport/formatJSON"
      pattern: "persistSessionSummary"
---

<objective>
Add automatic session summary persistence to nf-solve.cjs so that each solve run writes a timestamped markdown file to `.planning/formal/solve-sessions/`. Currently, the solve cycle produces actionable items (config changes, unmapped events, fairness gaps) that only live in conversation context and vanish on `/clear` or compaction. The existing `solve-state.json` captures machine state but not the human-readable report with detail sections and action items.

Purpose: Ensure solve session outputs survive across sessions, enabling continuity for multi-session gap closure.
Output: Modified nf-solve.cjs with persistSessionSummary() function, tests, and automatic pruning.
</objective>

<execution_context>
@/Users/jonathanborduas/.claude/nf/workflows/execute-plan.md
@/Users/jonathanborduas/.claude/nf/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@bin/nf-solve.cjs
@bin/nf-solve.test.cjs
</context>

<tasks>

<task type="auto">
  <name>Task 1: Add persistSessionSummary() to nf-solve.cjs with pruning</name>
  <files>bin/nf-solve.cjs</files>
  <action>
Add a new function `persistSessionSummary(report, jsonData, converged, iterations)` that:

1. Creates directory `.planning/formal/solve-sessions/` (recursive mkdir, fail-open).
2. Generates a filename using ISO timestamp: `solve-session-YYYY-MM-DDTHH-MM-SS.md` (replace colons with dashes for filesystem safety).
3. Writes a markdown file with this structure:
   - Header: `# nf-solve Session Summary` with timestamp and convergence status
   - Section `## Residual Vector` with the formatted report text (the full output of formatReport)
   - Section `## Machine State` with a fenced JSON block containing the formatJSON output
   - Section `## Actions Taken` listing iterations and their auto-close actions
4. After writing, prune old sessions: read the directory, sort by name (timestamps sort lexicographically), delete all but the newest 20 files. Use a constant `MAX_SESSION_FILES = 20`.
5. Wrap the entire function in try/catch with stderr warning on failure (fail-open pattern, matching solve-state.json pattern on line 3147-3148).

Call `persistSessionSummary()` in `main()` right after the solve-state.json write block (after line 3149), before BOTH the jsonMode/report stdout output AND any `process.exit()` call (line 3163). This ordering is critical — if the call is placed after stdout but before exit, a premature exit could skip persistence; if placed after exit, it never runs. Pass:
- The already-computed report string from `formatReport()` (which main() computes at ~line 3153; cache it in a local variable to avoid a redundant second call that re-iterates all layers)
- The already-computed JSON string from `formatJSON()` (which main() computes at ~line 3157; same caching rationale)
- `converged` boolean
- `iterations` array

The function signature should accept pre-computed strings: `persistSessionSummary(reportText, jsonText, converged, iterations)`. Do NOT call formatReport/formatJSON inside persistSessionSummary — accept them as arguments.

Export `persistSessionSummary` in the module.exports block for testing.

Do NOT use `--report-only` to skip session persistence — always persist regardless of mode, since report-only runs are still valuable diagnostics.

**Git tracking decision:** Add `.planning/formal/solve-sessions/` to `.gitignore`. These files are local diagnostic artifacts (pruned to 20, containing machine-specific state). They should NOT be committed — they would create noise in diffs and are only useful to the local developer. Add the gitignore entry as part of this task.
  </action>
  <verify>
Run `node bin/nf-solve.cjs --report-only --max-iterations=1 2>/dev/null; ls .planning/formal/solve-sessions/` and confirm a session file was created. Inspect the file to verify it contains the expected markdown structure with header, residual vector, machine state, and actions sections.
  </verify>
  <done>
persistSessionSummary() exists and is called in main(). Each solve run creates a timestamped .md file in .planning/formal/solve-sessions/ with full report content. Files older than the 20th newest are pruned automatically.
  </done>
</task>

<task type="auto">
  <name>Task 2: Add tests for persistSessionSummary</name>
  <files>bin/nf-solve.test.cjs</files>
  <action>
Add a new test category `TC-SESSION` to bin/nf-solve.test.cjs with these tests:

1. **persistSessionSummary writes file to target directory**: Create a temp directory, monkey-patch or call persistSessionSummary with mock report text and JSON data, verify a .md file is created with expected filename pattern `solve-session-*.md`.

2. **Session file contains expected sections**: Read the created file, assert it contains `# nf-solve Session Summary`, `## Residual Vector`, `## Machine State`, `## Actions Taken`.

3. **Pruning keeps only MAX_SESSION_FILES**: Create 25 dummy session files in a temp dir, call the pruning logic, verify only 20 remain and the 5 oldest (by filename sort) were deleted.

4. **Fail-open on write error**: Call persistSessionSummary with an invalid directory path (e.g., `/nonexistent/path`), verify it does not throw (returns gracefully).

Import `persistSessionSummary` from the module exports. For tests that need filesystem isolation, use `os.tmpdir()` + a unique subdirectory, and clean up after. Since persistSessionSummary uses ROOT internally, the tests should either:
- Call the function directly and pass a custom sessions dir (if refactored to accept it), OR
- Temporarily set ROOT and restore after test

The cleanest approach: have persistSessionSummary accept an optional `sessionsDir` parameter override (defaulting to `path.join(ROOT, '.planning', 'formal', 'solve-sessions')`). This makes testing trivial without monkey-patching globals.
  </action>
  <verify>
Run `npx vitest run bin/nf-solve.test.cjs 2>&1 | tail -30` and confirm all TC-SESSION tests pass. Verify no pre-existing tests were broken. NOTE: The project uses vitest (per testing rules), NOT node:test. Ensure test syntax uses vitest-compatible `describe`/`it`/`expect` — do NOT use node:test's `test()` or `node --test` runner.
  </verify>
  <done>
4 new tests in TC-SESSION category all pass. persistSessionSummary is tested for file creation, content structure, pruning behavior, and fail-open error handling. All pre-existing tests continue to pass.
  </done>
</task>

</tasks>

<verification>
- `node bin/nf-solve.cjs --report-only --max-iterations=1 2>/dev/null; ls .planning/formal/solve-sessions/` shows a session file
- `cat .planning/formal/solve-sessions/solve-session-*.md | head -5` shows the expected header
- `npx vitest run bin/nf-solve.test.cjs` passes with 0 failures
- `grep persistSessionSummary bin/nf-solve.cjs` shows function definition, call in main(), and export
</verification>

<success_criteria>
- Every nf-solve invocation (normal, --report-only, --fast) persists a session summary .md file
- Session files contain the full human-readable report plus machine-readable JSON
- Pruning prevents unbounded growth (max 20 files)
- Fail-open: persistence failure never blocks solve output or exit code
- All tests pass including new TC-SESSION tests
</success_criteria>

<output>
After completion, create `.planning/quick/220-nf-solve-should-auto-persist-its-session/220-SUMMARY.md`
</output>
