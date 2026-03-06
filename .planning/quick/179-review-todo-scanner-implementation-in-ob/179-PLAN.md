---
phase: quick-179
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - bin/observe-handler-internal.cjs
  - bin/observe-handler-internal.test.cjs
autonomous: true
formal_artifacts: none
requirements: [QUICK-179]

must_haves:
  truths:
    - "TODO scanner correctly parses grep output including edge cases (colons in paths, long lines)"
    - "All four internal handler categories have passing unit tests"
    - "TODO items produce stable, distinguishable fingerprints when routed to debt writer"
    - ".planning/ exclusion filter applies BEFORE the limit cap, not after"
  artifacts:
    - path: "bin/observe-handler-internal.test.cjs"
      provides: "Comprehensive test suite for handleInternal"
      min_lines: 150
    - path: "bin/observe-handler-internal.cjs"
      provides: "Hardened TODO scanner with bug fixes"
      exports: ["handleInternal"]
  key_links:
    - from: "bin/observe-handler-internal.cjs"
      to: "bin/observe-handlers.cjs"
      via: "require('./observe-handler-internal.cjs')"
      pattern: "handleInternal"
    - from: "bin/observe-handler-internal.cjs"
      to: "bin/observe-debt-writer.cjs"
      via: "issue schema fields (exception_type, function_name) consumed by fingerprintIssue"
      pattern: "issue_type.*issue"
---

<objective>
Review, fix, and test the TODO scanner implementation in observe-handler-internal.cjs.

Purpose: The internal handler (quick-168) scans four categories of local project state but has zero test coverage and several correctness bugs in the TODO grep parser. Fixing these ensures reliable debt tracking from codebase TODOs.

Output: Hardened observe-handler-internal.cjs with bug fixes + comprehensive test file.
</objective>

<execution_context>
@/Users/jonathanborduas/.claude/qgsd/workflows/execute-plan.md
@/Users/jonathanborduas/.claude/qgsd/templates/summary.md
</execution_context>

<context>
@bin/observe-handler-internal.cjs
@bin/observe-handlers.cjs
@bin/observe-handlers.test.cjs (test pattern reference)
@bin/observe-debt-writer.cjs (debt integration — fingerprint fields)
@bin/fingerprint-issue.cjs (fingerprint input contract)
</context>

<tasks>

<task type="auto">
  <name>Task 1: Fix TODO scanner bugs and improve robustness</name>
  <files>bin/observe-handler-internal.cjs</files>
  <action>
Fix the following issues in the TODO scanner (Category 3) of handleInternal:

1. **Grep parsing fragility (CRITICAL)**: The current colon-split parsing at lines 172-178 uses `indexOf(':')` twice to extract file:line:content. This breaks on paths with colons. Switch to using grep's `--null` flag (outputs NUL byte between filename and rest) for unambiguous parsing. Parse as: split on first NUL to get filePath, then split remainder on first colon to get lineNum and content. Update grepArgs to include `'-Z'` (same as `--null`).

2. **Filter-before-limit bug**: The `.planning/` exclusion on line 191 happens INSIDE the `lines.slice(0, limit)` loop. This means if 30 of the first 50 grep hits are in .planning/, you only get 20 real results despite limit=50. Fix by: adding `--exclude-dir=.planning` to the grep excludeDirs array instead of post-filtering. This is both more correct and more efficient.

3. **Enrich TODO issues for debt fingerprinting**: The debt writer calls `fingerprintIssue({ exception_type, function_name, message })`. Currently TODO issues have none of these fields, so all get identical weak fingerprints. Add `exception_type` (set to the tag: 'TODO', 'FIXME', 'HACK', 'XXX'), `function_name` (set to the relative file path), and keep `title` as the message field. This gives each TODO a unique fingerprint in the debt ledger.

4. **Remove duplicate formatAge**: The internal handler has its own `formatAge(mtime: Date)` that duplicates logic from observe-handlers.cjs `formatAge(isoString)`. Keep the internal one since it takes a Date object directly (needed for fs.statSync results), but rename it to `formatAgeFromMtime` to avoid confusion. Export it for testing.

5. **Add projectRoot existence check**: Before running grep, verify `fs.existsSync(projectRoot)`. If not, skip Category 3 with a warning (fail-open pattern, consistent with other categories).

Do NOT change Category 1 (quick tasks), Category 2 (debug sessions), or Category 4 (milestone phases) logic — they are correct. Only fix Category 3 and the shared formatAge.
  </action>
  <verify>
Run: `node -e "const { handleInternal } = require('./bin/observe-handler-internal.cjs'); const r = handleInternal({}, { projectRoot: '.' }); console.log('status:', r.status, 'issues:', r.issues.length); if (r.issues.some(i => i.exception_type)) console.log('fingerprint fields: OK'); else console.log('WARNING: no fingerprint fields');"` — should print status: ok with fingerprint fields present on TODO issues.
  </verify>
  <done>
grep parsing uses --null flag for unambiguous file:line:content separation; .planning/ excluded at grep level (not post-filter); TODO issues include exception_type and function_name for debt fingerprinting; formatAge renamed to formatAgeFromMtime; projectRoot validated before grep.
  </done>
</task>

<task type="auto">
  <name>Task 2: Add comprehensive test suite for handleInternal</name>
  <files>bin/observe-handler-internal.test.cjs</files>
  <action>
Create a test file following the project's node:test + node:assert/strict pattern (see observe-handlers.test.cjs for conventions). Use filesystem mocking via tmp directories — create real temp directory structures with fs.mkdtempSync, populate with test files, then call handleInternal with `{ projectRoot: tmpDir }`.

Test categories to cover:

**Category 1 — Unfinished quick tasks:**
- Setup: Create `.planning/quick/42-some-task/42-PLAN.md` (no SUMMARY) in tmpDir
- Assert: issues array contains entry with id `internal-quick-42`, severity `warning`
- Edge: Directory without numeric prefix is skipped
- Edge: Task WITH both PLAN and SUMMARY is NOT reported

**Category 2 — Stale debug sessions:**
- Setup: Create `.planning/quick/quorum-debug-latest.md` with content containing "status: open"
- Assert: issues array contains `internal-debug-latest` with severity `info`
- Edge: File older than 7 days is NOT reported
- Edge: File without "unresolved" or "status: open" is NOT reported

**Category 3 — TODO scanner:**
- Setup: Create a `src/example.js` file in tmpDir containing `// TODO: fix this` and `// FIXME: urgent`
- Assert: issues contain entries with correct tag, severity (TODO=info, FIXME=warning), and enriched fingerprint fields (exception_type=tag, function_name=relPath)
- Edge: Files in `.planning/` subdirectory are excluded (verify via grep --exclude-dir)
- Edge: `limitOverride` option caps results
- Edge: Non-existent projectRoot returns zero TODO issues (no crash)

**Category 4 — Active unverified phases:**
- Setup: Create `.planning/STATE.md` with `Phase: 01-test` and `.planning/phases/01-test/` dir (no VERIFICATION.md)
- Assert: issues contain `internal-milestone-01-test` with severity `warning`
- Edge: Phase value of `-` is skipped
- Edge: Phase with VERIFICATION.md present is NOT reported

**Cross-cutting:**
- handleInternal returns correct schema shape: `{ source_label, source_type: 'internal', status: 'ok', issues: [...] }`
- Fail-open: If quick dir doesn't exist, no crash, other categories still run
- formatAgeFromMtime returns correct format for known time differences

Clean up tmp directories in test teardown (use `after` or inline cleanup).
  </action>
  <verify>
Run: `node --test bin/observe-handler-internal.test.cjs` — all tests pass, zero failures.
  </verify>
  <done>
Test file exists with 15+ test cases covering all four categories, edge cases, schema shape, and fail-open behavior. All tests pass on `node --test`.
  </done>
</task>

</tasks>

<verification>
1. `node --test bin/observe-handler-internal.test.cjs` — all tests pass
2. `node -e "const { handleInternal } = require('./bin/observe-handler-internal.cjs'); console.log(JSON.stringify(handleInternal({}, { projectRoot: '.' }), null, 2))"` — returns valid schema with enriched TODO issues
3. `node --test bin/observe-handlers.test.cjs` — existing tests still pass (no regressions from re-export changes)
</verification>

<success_criteria>
- All identified bugs fixed (grep parsing, filter-before-limit, fingerprint enrichment)
- 15+ passing tests covering all four scan categories and edge cases
- No regressions in existing observe-handlers.test.cjs
- TODO issues routed through debt writer produce distinguishable fingerprints
</success_criteria>

<output>
After completion, create `.planning/quick/179-review-todo-scanner-implementation-in-ob/179-SUMMARY.md`
</output>
