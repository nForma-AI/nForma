---
phase: quick-52
plan: 01
type: execute
wave: 1
depends_on: []
files_modified: []
autonomous: true
requirements: [CLEAN-01]

must_haves:
  truths:
    - "All hook tests pass (qgsd-stop, config-loader, gsd-tools, qgsd-circuit-breaker)"
    - "Modified hooks (qgsd-stop.js, qgsd-prompt.js) are syntactically valid Node.js"
    - "New agent file (agents/qgsd-quorum-orchestrator.md) is well-formed markdown with required sections"
    - "Working tree has no broken or missing files among the modified set"
  artifacts:
    - path: "hooks/qgsd-stop.js"
      provides: "Stop hook — modified, must parse cleanly"
    - path: "hooks/qgsd-prompt.js"
      provides: "UserPromptSubmit hook — modified, must parse cleanly"
    - path: "agents/qgsd-quorum-orchestrator.md"
      provides: "New agent definition — must have required sections"
  key_links:
    - from: "hooks/qgsd-stop.js"
      to: "hooks/qgsd-stop.test.js"
      via: "node --test"
      pattern: "node --test hooks/qgsd-stop.test.js"
    - from: "scripts/lint-isolation.js"
      to: "hooks/"
      via: "npm test"
      pattern: "npm test"
---

<objective>
Verify the current working tree is clean: tests pass, modified hooks are syntactically valid, and the new agent file is well-formed.

Purpose: Establish confidence that uncommitted changes are correct before proceeding to Phase 31 planning.
Output: Audit report — pass/fail on each check with specific findings.
</objective>

<execution_context>
@/Users/jonathanborduas/.claude/get-shit-done/workflows/execute-plan.md
@/Users/jonathanborduas/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@.planning/ROADMAP.md
</context>

<tasks>

<task type="auto">
  <name>Task 1: Syntax-check modified hooks</name>
  <files>hooks/qgsd-stop.js, hooks/qgsd-prompt.js</files>
  <action>
    Run `node --check` on each modified hook to verify they are syntactically valid Node.js with no parse errors:

    ```
    node --check hooks/qgsd-stop.js
    node --check hooks/qgsd-prompt.js
    ```

    If either fails, report the exact error message and line number. Do NOT fix — this is an audit task.

    Also verify the new untracked hook-adjacent files parse cleanly:
    ```
    node --check bin/check-mcp-health.cjs
    node --check bin/check-provider-health.cjs
    node --check bin/qgsd.cjs
    node --check bin/review-mcp-logs.cjs
    node --check scripts/lint-isolation.js
    ```
  </action>
  <verify>Exit code 0 from every `node --check` call = PASS. Non-zero = FAIL with details.</verify>
  <done>All checked files report no syntax errors, or failing files are identified with exact errors.</done>
</task>

<task type="auto">
  <name>Task 2: Run full test suite</name>
  <files>hooks/qgsd-stop.test.js, hooks/config-loader.test.js, get-shit-done/bin/gsd-tools.test.cjs, hooks/qgsd-circuit-breaker.test.js</files>
  <action>
    Run the full test suite as defined in package.json:

    ```
    cd /Users/jonathanborduas/code/QGSD && npm test
    ```

    This runs `node scripts/lint-isolation.js` first (import boundary checks), then:
    - `hooks/qgsd-stop.test.js`
    - `hooks/config-loader.test.js`
    - `get-shit-done/bin/gsd-tools.test.cjs`
    - `hooks/qgsd-circuit-breaker.test.js`

    Capture: total tests, passed, failed, skipped. If any test fails, record the test name and failure message.
  </action>
  <verify>`npm test` exits with code 0 and all subtests pass.</verify>
  <done>All tests pass, or failing tests are named with their exact assertion error.</done>
</task>

<task type="auto">
  <name>Task 3: Audit new agent file and working tree summary</name>
  <files>agents/qgsd-quorum-orchestrator.md</files>
  <action>
    Read `agents/qgsd-quorum-orchestrator.md` and verify:
    1. File is valid markdown (no broken fences, unclosed tags)
    2. Has a `<role>` section or equivalent purpose header
    3. Has task/workflow guidance sections
    4. Compare its structure to an existing agent (e.g., `agents/qgsd-planner.md`) to confirm structural parity

    Then produce a working tree summary:
    - List all modified tracked files (`M` prefix) grouped by area (hooks/, commands/, planning/, etc.)
    - List all untracked new files (`??` prefix)
    - Flag any that look anomalous (e.g., large diffs, files in unexpected locations)
    - State whether the tree looks ready to stage or has concerns

    Use `git diff --stat` to see change sizes.
  </action>
  <verify>Agent file has required structural sections; git diff --stat shows reasonable change sizes with no surprises.</verify>
  <done>Agent file is well-formed and structurally consistent with peer agents; working tree summary produced with clear pass/concern flags.</done>
</task>

</tasks>

<verification>
After all three tasks:
- Syntax check: PASS if all `node --check` calls exit 0
- Test suite: PASS if `npm test` exits 0 with 0 failures
- Agent file: PASS if structure matches peer agents
- Working tree: summarized with any anomalies flagged
</verification>

<success_criteria>
All checks PASS = working tree is clean and safe to proceed to Phase 31 planning.
Any FAIL = specific issue identified, no speculation, no fixes attempted.
</success_criteria>

<output>
After completion, create `.planning/quick/52-is-it-clean/52-SUMMARY.md` with:
- Result for each check (PASS/FAIL)
- Any failures with exact details
- Overall verdict: CLEAN or ISSUES FOUND
</output>
