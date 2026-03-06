---
phase: quick-190
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - bin/nForma.cjs
  - bin/nForma.test.cjs
autonomous: true
requirements: [TUI-NAV]
formal_artifacts: none

must_haves:
  truths:
    - "Session persistence saves/loads/removes sessions correctly to sessions.json"
    - "Modal fix prevents unwanted New Session prompt when switching to Sessions module"
    - "Session ID counter restores from persisted data on startup to prevent collisions"
    - "Resume flow dispatches --resume flag with correct claudeSessionId"
    - "Kill flow handles both active and persisted (saved) sessions"
  artifacts:
    - path: "bin/nForma.cjs"
      provides: "Session persistence functions, modal fix, resume/kill logic"
      contains: "loadPersistedSessions"
    - path: "bin/nForma.test.cjs"
      provides: "Unit tests for session persistence pure functions"
      contains: "loadPersistedSessions"
  key_links:
    - from: "createSession"
      to: "savePersistedSessions"
      via: "called after sessions.push"
      pattern: "sessions\\.push.*savePersistedSessions"
    - from: "killSession"
      to: "removePersistedSession"
      via: "called before sessions.splice"
      pattern: "removePersistedSession.*sessions\\.splice"
    - from: "dispatch"
      to: "createSession"
      via: "session-resume- action prefix"
      pattern: "session-resume-.*createSession"
---

<objective>
Review and validate the uncommitted session persistence and modal fix changes in bin/nForma.cjs.

Purpose: The diff introduces session persistence (save/load/remove via sessions.json), a modal fix (preventing unwanted "New Session" prompt on module switch), session resume via --resume flag, and startup ID counter restoration. These changes need code review for correctness, edge cases, and test coverage.

Output: Reviewed code with any identified issues fixed, plus unit tests for the new persistence functions.
</objective>

<execution_context>
@/Users/jonathanborduas/.claude/nf/workflows/execute-plan.md
@/Users/jonathanborduas/.claude/nf/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@bin/nForma.cjs
@bin/nForma.test.cjs
@.planning/formal/spec/tui-nav/invariants.md
</context>

<tasks>

<task type="auto">
  <name>Task 1: Review session persistence and modal fix for correctness and edge cases</name>
  <files>bin/nForma.cjs</files>
  <action>
Review the uncommitted diff in bin/nForma.cjs (session persistence + modal fix). Validate these specific areas:

1. **Persistence correctness:**
   - `loadPersistedSessions()`: Check that JSON parse errors are caught (they are via try/catch). Verify the returned shape matches what callers expect (id, name, cwd, claudeSessionId).
   - `savePersistedSessions()`: Verify it only persists serializable fields (no `term` widget). Confirm mkdirSync is safe for existing dirs (recursive: true handles it).
   - `removePersistedSession()`: Verify it reads-then-filters-then-writes atomically enough for single-process use. Check that the filter uses correct field (`claudeSessionId`).

2. **Modal fix:** The line `if (idx === 3) return;` in switchModule() prevents auto-dispatch for Sessions module. Verify this does not break the menu population -- confirm that `refreshSessionMenu()` at startup and the module switch still correctly populate the menuList items before the early return.

3. **Session resume flow:** In dispatch(), `session-resume-` prefix extracts claudeSessionId and calls `createSession(name, cwd, resumeSessionId)`. Verify:
   - createSession uses `--resume` flag (not `--session-id`) when resumeSessionId is truthy
   - The persisted session lookup in dispatch handles missing entries (the `if (persisted)` guard)

4. **Startup counter restoration:** `Math.max(..._persisted.map(p => p.id))` -- verify this handles empty array safely (it won't be called due to `_persisted.length > 0` guard, but confirm).

5. **TUI-NAV invariant compliance:** The EscapeProgress invariant (depth' < depth on EscapeUp) is not violated -- these changes don't modify the navigation depth model, only session lifecycle. Confirm no depth-related code was changed.

6. **Edge cases to check and fix if needed:**
   - What happens if sessions.json contains malformed JSON? (loadPersistedSessions catches it)
   - What if a persisted session's cwd no longer exists? (createSession passes it to XTerm which may fail -- consider adding fs.existsSync check or at minimum a fallback to process.cwd())
   - Race condition: two nForma processes writing sessions.json simultaneously (acceptable for single-user TUI)
   - `killSessionFlow()` now uses `choice.value.type` -- verify promptList rejection (escape) is caught by the try/catch in dispatch

Fix any issues found. At minimum, add a guard in `createSession` for the `cwd` parameter: if the directory doesn't exist, fall back to `process.cwd()` and log a warning via `logEvent('warn', ...)`.
  </action>
  <verify>
Run `node -c bin/nForma.cjs` to confirm syntax is valid.
Run `grep -n 'fs.existsSync' bin/nForma.cjs | grep -i cwd` to confirm the cwd guard was added if needed.
  </verify>
  <done>All edge cases reviewed, cwd existence guard added to createSession for resume flow, no TUI-NAV invariant violations.</done>
</task>

<task type="auto">
  <name>Task 2: Add unit tests for session persistence pure functions</name>
  <files>bin/nForma.test.cjs</files>
  <action>
Add test coverage for the new session persistence functions. The test file already has mock infrastructure for blessed. Add tests that:

1. **loadPersistedSessions:**
   - Returns empty array when sessions.json doesn't exist
   - Returns parsed array when sessions.json has valid JSON
   - Returns empty array when sessions.json has malformed JSON (graceful degradation)

2. **savePersistedSessions:**
   - Writes correct JSON structure (only id, name, cwd, claudeSessionId -- no term widget)
   - Creates parent directory if it doesn't exist (mkdirSync recursive)

3. **removePersistedSession:**
   - Removes only the matching claudeSessionId entry
   - Handles case where sessions.json doesn't exist yet (no crash)

4. **Startup counter restoration:**
   - sessionIdCounter is set to max persisted id to prevent collisions
   - Empty persisted list doesn't change counter

5. **Modal fix verification:**
   - switchModule(3) with no active session returns early without dispatching (doesn't call dispatch for first item)

Since these functions use SESSIONS_FILE constant, the tests should:
- Use a temp directory approach (already in test file as makeTmp/rmTmp)
- Either mock SESSIONS_FILE path or test via the _pure exports if the functions are exposed

If the persistence functions are NOT exported via `_pure`, add them to the `module.exports._pure` object at the bottom of nForma.cjs: `loadPersistedSessions, savePersistedSessions, removePersistedSession`.

Run `node --test bin/nForma.test.cjs` and ensure all new tests pass alongside existing ones.
  </action>
  <verify>
Run `node --test bin/nForma.test.cjs` -- all tests pass (0 failures).
Run `grep -c 'test(' bin/nForma.test.cjs` to confirm at least 5 new test cases were added.
  </verify>
  <done>At least 5 new unit tests covering persistence load/save/remove, counter restoration, and modal fix behavior. All tests pass.</done>
</task>

</tasks>

<verification>
- `node -c bin/nForma.cjs` passes (valid syntax)
- `node --test bin/nForma.test.cjs` passes (all tests green)
- Session persistence functions have test coverage for happy path and error cases
- No TUI-NAV invariant violations (EscapeProgress, DepthBounded unaffected)
</verification>

<success_criteria>
- Code review complete with edge case fixes applied (cwd guard at minimum)
- Persistence functions exported for testing
- 5+ new unit tests covering persistence lifecycle
- All existing + new tests pass
</success_criteria>

<output>
After completion, create `.planning/quick/190-review-and-validate-session-persistence-/190-SUMMARY.md`
</output>
