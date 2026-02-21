# Phase 6: Circuit Breaker Detection & State - Research

**Researched:** 2026-02-21
**Domain:** Claude Code PreToolUse hook, git history parsing, oscillation detection, JSON state persistence
**Confidence:** HIGH

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| DETECT-01 | PreToolUse hook intercepts Bash tool calls and checks whether the current context has an active circuit breaker before running detection | PreToolUse input schema confirmed: `tool_name` + `tool_input.command`. Hook checks state file first per STATE-03 |
| DETECT-02 | Hook retrieves last N commits changed files via `git log --name-only` (N = commit_window config) when detection is needed | Confirmed: `git diff-tree --no-commit-id -r --name-only <hash>` per commit gives clean file lists. Phase 6 uses hardcoded defaults (3/6) since CONF-06/07 are Phase 7 |
| DETECT-03 | Hook identifies oscillation when the exact same file set (strict set equality) appears in >= oscillation_depth of the last commit_window commits | Algorithm verified: sort files, join as key, count occurrences. Strict equality prevents false positives |
| DETECT-04 | Read-only Bash commands (git log, git diff, grep, cat, ls, head, tail, find) pass through without detection or blocking | Regex verified: covers all listed commands including bare `ls` and `cat ` with space |
| DETECT-05 | Detection is skipped (returns pass) when no git repository exists in the current working directory | `git rev-parse --show-toplevel` exits non-zero in non-git dirs; execSync with stdio pipe throws on non-zero exit, catch block returns pass |
| STATE-01 | Circuit breaker state persisted in `.claude/circuit-breaker-state.json` relative to project root | Path: path.join(gitRoot, '.claude', 'circuit-breaker-state.json'). Git root resolved from `input.cwd` (PreToolUse provides `cwd` field) |
| STATE-02 | State schema: `{ active, file_set[], activated_at, commit_window_snapshot[] }` | Schema confirmed. `activated_at` is ISO 8601 string via new Date().toISOString(). `commit_window_snapshot` captures per-commit file arrays for auditability |
| STATE-03 | Hook reads existing state first, if active applies enforcement immediately without re-running git log detection | Read then parse then check `active` flag. If true, skip git log entirely and go to enforcement (Phase 7) or pass (Phase 6) |
| STATE-04 | State file created silently if absent; failure to write logs to stderr but never blocks execution | try/catch around fs.writeFileSync; on error, write to process.stderr and process.exit(0) |
</phase_requirements>

---

## Summary

Phase 6 delivers a new file `hooks/qgsd-circuit-breaker.js` — a `PreToolUse` hook that fires on every Bash tool call. It reads the current circuit breaker state from `.claude/circuit-breaker-state.json`, skips detection for read-only commands, runs oscillation detection via `git diff-tree` on the last N commits, and writes state when oscillation is found. Phase 6 never blocks (that is Phase 7) — it only detects and persists. The hook follows the identical file layout, stdin/stdout contract, TDD approach, and build wiring as `qgsd-stop.js` and `qgsd-prompt.js`.

The PreToolUse hook receives `tool_name`, `tool_input`, and `cwd` from Claude Code. For Bash, `tool_input.command` is the shell string to inspect. The hook communicates decisions via `hookSpecificOutput.permissionDecision` (not the top-level `decision` field used by Stop hooks). Phase 6 always exits 0 with no output (pass-through), writing state but never blocking — enforcement is Phase 7.

**Primary recommendation:** Implement `hooks/qgsd-circuit-breaker.js` using `git diff-tree --no-commit-id -r --name-only` per commit hash for clean per-commit file sets, strict set equality via sorted-join keying, and atomic state writes with fail-open error handling. Test with `spawnSync` as in `qgsd-stop.test.js`.

---

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `node:fs` | built-in | State file read/write | No external deps policy — hooks use Node stdlib only |
| `node:path` | built-in | Path construction for state file | Same as all existing hooks |
| `node:child_process` | built-in | `execSync` for git commands | Only way to shell out from a hook script synchronously |
| `./config-loader` | local | Load oscillation_depth + commit_window defaults | Already TDD-covered; Phase 6 reads defaults (3/6) until Phase 7 adds config keys |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `node:test` + `node:assert/strict` | built-in | TDD test suite | Same as `qgsd-stop.test.js` and `config-loader.test.js` |
| `child_process.spawnSync` | built-in | Hook invocation in tests | Same pattern as `qgsd-stop.test.js` |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `git diff-tree` per hash | `git log --name-only` single call | Single-call output requires delimiter-based parsing that breaks on empty commits; diff-tree is clean and deterministic |
| Sorted-join key for set equality | Custom pairwise setsEqual() function | Join approach works with Map counting; pairwise comparison is O(n) per pair which is fine but more code |
| `execSync` with `stdio:'pipe'` | `spawnSync` | `execSync` is simpler for synchronous output capture; `stdio:'pipe'` prevents stderr from leaking to hook stdout channel |

**Installation:** No new packages. Hook is pure Node.js stdlib + `./config-loader`.

---

## Architecture Patterns

### Recommended Project Structure

```
hooks/
  qgsd-circuit-breaker.js          -- New: PreToolUse hook (Phase 6)
  qgsd-circuit-breaker.test.js     -- New: TDD test suite (Phase 6)
  qgsd-stop.js                     -- Existing: Stop hook
  qgsd-prompt.js                   -- Existing: UserPromptSubmit hook
  config-loader.js                 -- Existing: shared config loader
  dist/
    qgsd-circuit-breaker.js        -- Built by build-hooks.js (Phase 6 adds to HOOKS_TO_COPY)
    ... (existing dist files)
```

### Pattern 1: PreToolUse Hook Skeleton

**What:** Read stdin JSON, extract `cwd` and `tool_input.command`, run logic, exit 0 with no output for Phase 6.
**When to use:** All PreToolUse command hooks.

Source: https://code.claude.com/docs/en/hooks (PreToolUse input schema)

The stdin payload has this shape:
```
{
  "session_id": "abc123",
  "transcript_path": "/path/to/transcript.jsonl",
  "cwd": "/home/user/my-project",
  "permission_mode": "default",
  "hook_event_name": "PreToolUse",
  "tool_name": "Bash",
  "tool_input": {
    "command": "npm test",
    "description": "Run test suite",
    "timeout": 120000,
    "run_in_background": false
  },
  "tool_use_id": "toolu_01ABC123..."
}
```

Hook skeleton (all hooks use this stdin reading pattern — matches qgsd-stop.js and qgsd-prompt.js):

```js
'use strict';
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const { loadConfig } = require('./config-loader');

function main() {
  let raw = '';
  process.stdin.setEncoding('utf8');
  process.stdin.on('data', chunk => { raw += chunk; });
  process.stdin.on('end', () => {
    try {
      const input = JSON.parse(raw);
      const command = (input.tool_input && input.tool_input.command) || '';
      const cwd = input.cwd || process.cwd();
      // ... detection logic ...
      process.exit(0); // Phase 6: always pass, output nothing to stdout
    } catch {
      process.exit(0); // Fail-open on any unexpected error
    }
  });
}

main();
```

### Pattern 2: PreToolUse Decision Output Format (Phase 7 reference)

**What:** Phase 6 never blocks. Phase 7 will use hookSpecificOutput.permissionDecision.
**CRITICAL:** PreToolUse uses `hookSpecificOutput.permissionDecision` NOT top-level `decision` (which is Stop/PostToolUse format). Using the wrong format silently fails.

Source: https://code.claude.com/docs/en/hooks (PreToolUse decision control section)

```
// Phase 7 blocking output (reference only — do NOT implement in Phase 6):
process.stdout.write(JSON.stringify({
  hookSpecificOutput: {
    hookEventName: 'PreToolUse',
    permissionDecision: 'deny',
    permissionDecisionReason: 'Circuit breaker active: ...'
  }
}));
process.exit(0);
```

Phase 6 constraint: Output nothing to stdout. Exit 0 always.

### Pattern 3: Git Root Resolution

**What:** Resolve git root from `input.cwd` to locate state file. Returns null if not a git repo (DETECT-05).

Source: verified via live testing in this repo

```
git rev-parse --show-toplevel
```

Run via execSync with cwd set to input.cwd and stdio:'pipe'. On non-zero exit (not a git repo), execSync throws — catch block returns null. Caller pattern: if getGitRoot returns null, exit 0 immediately.

### Pattern 4: Per-Commit File Set Extraction

**What:** Get changed files for each of the last N commits using two-step approach.

Source: verified via live testing — git diff-tree gives clean output per hash

Step 1: Get hashes with `git log --format="%H" -N`
Step 2: For each hash, run `git diff-tree --no-commit-id -r --name-only <hash>`

The diff-tree call returns empty string for empty commits (merge commits with no direct changes), which becomes [] after split — correct behavior. No delimiter ambiguity.

**Why NOT single-call `git log --name-only`:** Single-call output uses blank lines to separate commits. Empty commits produce consecutive blank lines, breaking split-on-blank-line parsing.

### Pattern 5: Strict Set Equality Oscillation Check

**What:** Count how many commits touch the exact same file set; trigger if count >= depth.

Source: verified via live testing with Node.js test scripts

Algorithm:
1. For each commit's file list: sort the files, join with null-byte separator to form a string key
2. Increment a Map counter for that key
3. If any key reaches count >= depth, oscillation detected; return that file set

Null-byte separator avoids path collisions (a path cannot contain \0). Sorted order means ['a.js','b.js'] and ['b.js','a.js'] produce the same key — correct.

**Strict equality guarantee:** A superset ['a.js','b.js','c.js'] produces a longer key and never matches ['a.js','b.js']. No false positives from TDD cycles where different files are touched per commit.

### Pattern 6: Read-Only Command Detection

**What:** Return true if the Bash command should not trigger detection.

Source: verified via live testing against edge cases

Regex: `/^\s*(git\s+(log|diff|diff-tree|status|show|blame)|grep|cat\s|ls(\s|$)|head|tail|find)\s*/`

Verified edge cases:
- `ls` alone — matched by `ls(\s|$)` where `$` covers end-of-string
- `cat README` — matched by `cat\s` (requires space)
- `catfish` — NOT matched (cat must be followed by space)
- `git log -n 6 --name-only` — matched
- `git commit` — NOT matched
- `git push` — NOT matched

### Pattern 7: State File Read/Write

**What:** Read state before detection; write state when oscillation found.

State file location: `path.join(gitRoot, '.claude', 'circuit-breaker-state.json')`

Read pattern: fs.existsSync check then JSON.parse. If file absent or malformed, return null (treat as no state — fail-open).

Write pattern: mkdirSync with recursive:true for `.claude/` dir, then writeFileSync. Wrap in try/catch; on error, write warning to stderr only — never block execution (STATE-04).

### Pattern 8: State Schema

Source: REQUIREMENTS.md STATE-02

```
{
  "active": true,
  "file_set": ["hooks/qgsd-stop.js", "hooks/qgsd-prompt.js"],
  "activated_at": "2026-02-21T01:00:00.000Z",
  "commit_window_snapshot": [
    ["hooks/qgsd-stop.js", "hooks/qgsd-prompt.js"],
    ["hooks/qgsd-stop.js", "hooks/qgsd-prompt.js"],
    ["hooks/qgsd-stop.js", "hooks/qgsd-prompt.js"]
  ]
}
```

`commit_window_snapshot` is the full per-commit arrays from the detection window (not just the matching ones), for auditability.

### Pattern 9: Overall Hook Control Flow

```
stdin -> parse JSON
  -> extract cwd, command
  -> getGitRoot(cwd)
      -> null? -> exit 0 (DETECT-05: no git repo)
  -> readState(gitRoot)
      -> state.active? -> exit 0 (Phase 6: pass; Phase 7: will block)
  -> isReadOnly(command)?
      -> yes -> exit 0 (DETECT-04)
  -> getCommitFileSets(gitRoot, commit_window=6)
  -> detectOscillation(sets, oscillation_depth=3)
      -> oscillating? -> writeState(gitRoot, { active:true, ... })
                      -> exit 0 (Phase 6: pass even after writing state)
      -> not oscillating? -> exit 0
```

### Anti-Patterns to Avoid

- **stdout contamination:** Any non-JSON text written to stdout causes Claude Code JSON parse failure. All debug/warning output goes to process.stderr. In Phase 6 (pass-through), write nothing to stdout.
- **Single-call git log --name-only parsing:** Ambiguous on empty commits. Use diff-tree per hash instead.
- **Top-level `decision: 'block'` for PreToolUse:** Wrong format. PreToolUse uses `hookSpecificOutput.permissionDecision: 'deny'`. This is a Phase 7 concern but must not be confused.
- **Using process.cwd() instead of input.cwd:** Hook process cwd is unreliable. Always use `input.cwd` from the PreToolUse JSON.
- **Re-running git log when state is active:** STATE-03 requires short-circuit. Read state first, if active skip detection entirely.
- **Writing state on every Bash call:** Only write state when oscillation is newly detected.
- **No timeout on execSync:** Git commands on slow repos can hang. Pass `timeout: 5000` option; on timeout, execSync throws and catch block returns pass-through.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Config loading | Custom JSON reader | `require('./config-loader').loadConfig()` | Already TDD-covered with two-layer merge, validation, stderr warnings |
| Set equality for arbitrary arrays | Custom recursive comparison | Sorted-join key + Map counting | O(n log n) vs O(n^2), naturally handles ordering differences |
| Git root detection | Walk up directory tree looking for `.git` | `git rev-parse --show-toplevel` | Handles worktrees, submodules, and non-standard layouts |

**Key insight:** The project's zero-external-dependencies policy is strict. Every problem must be solved with Node.js stdlib or existing project modules. No npm installs.

---

## Common Pitfalls

### Pitfall 1: stdout Contamination Blocks Everything

**What goes wrong:** Any non-JSON text written to stdout causes Claude Code to fail JSON parse on hook output, treating the hook as errored.
**Why it happens:** Claude Code reads stdout as structured JSON. stdout is the decision channel for command hooks.
**How to avoid:** All debug/warning output goes to `process.stderr`. Never write to stdout unless writing a complete JSON decision object. Phase 6 (pass-through): write nothing to stdout.
**Warning signs:** Hook shows "JSON validation failed" in `claude --debug` mode.

### Pitfall 2: git log --name-only Single Call Parsing Breaks on Empty Commits

**What goes wrong:** Using `git log --name-only --format="%H" -6` in one call and splitting on blank lines produces wrong results when some commits are empty.
**Why it happens:** Empty commits (merge commits with no direct file changes) produce consecutive blank lines, breaking split-on-blank-line parsing.
**How to avoid:** Two-step approach: `git log --format="%H" -N` to get hashes, then `git diff-tree --no-commit-id -r --name-only <hash>` per commit.
**Warning signs:** `commit_window_snapshot` in state shows wrong per-commit groupings.

### Pitfall 3: CWD Mismatch Between Hook Process and Project

**What goes wrong:** Using `process.cwd()` inside the hook returns wrong directory.
**Why it happens:** Claude Code invokes the hook as a subprocess; its cwd depends on how the hook is registered.
**How to avoid:** Always use `input.cwd` (from the PreToolUse JSON input). Run git commands with `{ cwd: input.cwd }`. Then resolve git root and use that for state file path.
**Warning signs:** `getGitRoot()` returns null even in a git project; state file written to wrong location.

### Pitfall 4: State File in Wrong Location

**What goes wrong:** State written relative to `process.cwd()` instead of git root. Multiple sessions on different working directories create inconsistent state.
**How to avoid:** Resolve git root, then `path.join(gitRoot, '.claude', 'circuit-breaker-state.json')`. This is consistent regardless of which subdirectory the user is in when Bash runs.
**Warning signs:** State file appears in a subdirectory, not at repo root `.claude/`.

### Pitfall 5: False Positives from TDD Cycles

**What goes wrong:** A TDD cycle touches `hooks/foo.test.js` in one commit and `hooks/foo.js` + `hooks/foo.test.js` in the next — these are different file sets but subset/intersection matching would trigger oscillation.
**Why it happens:** Using intersection or subset matching instead of strict equality.
**How to avoid:** Strict set equality only: sorted-join key means different file counts produce different key lengths and never match.
**Warning signs:** Oscillation triggered during normal TDD where different files are modified per commit.

### Pitfall 6: execSync Timeout on Slow Repos

**What goes wrong:** `git log` or `git diff-tree` hangs on a large repo, blocking the hook indefinitely.
**How to avoid:** Pass `timeout` option to execSync (5000ms is sufficient). On timeout, execSync throws — catch block returns pass-through.
**Warning signs:** Hook appears to block Bash tool calls with no output.

---

## TDD Test Cases to Implement

The planner should map these directly to test cases in `hooks/qgsd-circuit-breaker.test.js`:

| TC# | Description | Expected Outcome |
|-----|-------------|-----------------|
| CB-TC1 | No git repo in cwd | exit 0, stdout empty (DETECT-05) |
| CB-TC2 | Read-only command `git log -n 10` | exit 0, stdout empty, no detection (DETECT-04) |
| CB-TC3 | Read-only command `grep -r "foo" .` | exit 0, stdout empty (DETECT-04) |
| CB-TC4 | Read-only command bare `ls` | exit 0, stdout empty (DETECT-04) |
| CB-TC5 | Write command, no state, fewer than depth commits with same file set | exit 0, stdout empty, no state file written |
| CB-TC6 | Write command, no state, exactly oscillation_depth commits touch same file set | exit 0, stdout empty, state file written with active:true, correct schema |
| CB-TC7 | Write command, existing state with active:true | exit 0, stdout empty (Phase 6 passes; Phase 7 will block) |
| CB-TC8 | Write command, existing state with active:false | detection runs normally |
| CB-TC9 | TDD cycle: commits touch different files per commit, no strict match | exit 0, stdout empty, no state written |
| CB-TC10 | State file exists but is malformed JSON | treat as no state, fail-open, exit 0 |
| CB-TC11 | .claude/ dir does not exist when writing state | directory created, state file written, no error |
| CB-TC12 | commit_window_snapshot in state correctly reflects per-commit arrays | verify state schema after write |
| CB-TC13 | Write command with run_in_background:true in tool_input | same detection logic as non-background write commands |
| CB-TC14 | Malformed stdin JSON | exit 0 (fail-open) |

### Test Infrastructure Pattern

Tests use `spawnSync` to invoke the hook as a child process (same as `qgsd-stop.test.js`). For git-dependent tests, create a real git repo in `os.tmpdir()` with controlled commits:

1. `fs.mkdtempSync` for temp dir
2. `git init` + `git config user.email/name` (required for commits)
3. For each commit: write files, `git add`, `git commit -m "..."` via execSync with cwd
4. Run hook with `spawnSync`, passing `{ cwd: tempRepoDir }` in the stdinPayload's `cwd` field
5. Cleanup in `finally` block with `fs.rmSync(dir, { recursive: true, force: true })`

The `cwd` field in the stdinPayload controls where the hook looks for the git repo.

---

## Build Wiring

Phase 6 adds `qgsd-circuit-breaker.js` to `scripts/build-hooks.js`:

In `HOOKS_TO_COPY` array, add `'qgsd-circuit-breaker.js'`.

Phase 6 does NOT add installer wiring (that is Phase 8). The hook file exists in `hooks/` and `hooks/dist/` after build, but is not yet registered in `~/.claude/settings.json`.

## Test Script Update

Phase 6 adds the new test file to the `test` script in `package.json`:

Current: `node --test hooks/qgsd-stop.test.js hooks/config-loader.test.js get-shit-done/bin/gsd-tools.test.cjs`

Updated: add `hooks/qgsd-circuit-breaker.test.js` to the list.

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Top-level `decision: 'block'` / `decision: 'approve'` for PreToolUse | `hookSpecificOutput.permissionDecision: 'deny'` / `'allow'` | Deprecated in Claude Code (docs say "previously used") | Phase 7 MUST use `hookSpecificOutput` format — do not use top-level `decision` for this hook event |
| `exit 2` for blocking | JSON `permissionDecision: 'deny'` preferred | Current | JSON gives richer control: reason shown to Claude, not just stderr |
| `git log --name-only` with format delimiter | `git diff-tree --no-commit-id -r --name-only` per hash | Design decision this phase | Eliminates empty-commit parsing ambiguity |

**Deprecated / outdated:**
- Top-level `decision` and `reason` fields for PreToolUse: deprecated per official docs. Use `hookSpecificOutput.permissionDecision` and `hookSpecificOutput.permissionDecisionReason` instead. Other hooks (Stop, PostToolUse) continue to use top-level `decision`.

---

## Open Questions

1. **Empty commits in git history**
   - What we know: `git diff-tree` returns empty output for merge commits with no direct file changes; split + filter produces []
   - What's unclear: Whether merge commits should be excluded from the window count
   - Recommendation: Include as [] entries (they consume a slot in the window but never match any file set). Conservative approach — spec says "last N commits" without excluding merges.

2. **Single-file oscillation sensitivity**
   - What we know: Default depth is 3, window is 6. A file changed 3 times in 6 commits triggers the breaker.
   - What's unclear: Common files like `STATE.md` or `CHANGELOG.md` may legitimately change frequently.
   - Recommendation: Proceed with spec. Users can tune via config (Phase 7 CONF-06/07). Phase 6 uses hardcoded defaults.

3. **Exact `cwd` value when hook fires**
   - What we know: Official docs confirm `cwd` is "Current working directory when the hook is invoked."
   - What's unclear: Whether `cwd` changes within a session if Claude changes directories via Bash.
   - Recommendation: Always resolve git root from `input.cwd` dynamically on each invocation. Do not cache.

---

## Sources

### Primary (HIGH confidence)

- https://code.claude.com/docs/en/hooks — PreToolUse input schema (tool_name, tool_input.command, cwd, session_id, hook_event_name, tool_use_id), decision output format (hookSpecificOutput.permissionDecision), exit code behavior
- `hooks/qgsd-stop.js` (project file) — stdin reading pattern, fail-open structure, config-loader integration
- `hooks/config-loader.js` (project file) — loadConfig() API, DEFAULT_CONFIG shape, path resolution patterns
- `hooks/qgsd-stop.test.js` (project file) — TDD pattern: spawnSync, writeTempTranscript, runHookWithEnv, cleanup in finally blocks
- `hooks/config-loader.test.js` (project file) — module-import test pattern, temp dir approach, stderr capture
- `scripts/build-hooks.js` (project file) — HOOKS_TO_COPY array, how to add new hooks to dist build
- `package.json` (project file) — test script format, engines config (Node >= 16.7.0)
- Live testing: `git diff-tree --no-commit-id -r --name-only <hash>` output format confirmed in this repo
- Live testing: `git rev-parse --show-toplevel` exit behavior in git vs non-git dirs confirmed
- Live testing: read-only detection regex verified against edge cases

### Secondary (MEDIUM confidence)

- WebSearch: "Claude Code PreToolUse hook input JSON schema" — confirmed tool_input.command field for Bash, hookSpecificOutput.permissionDecision for decisions

### Tertiary (LOW confidence)

- None. All findings verified against official docs or live testing.

---

## Metadata

**Confidence breakdown:**
- PreToolUse input schema: HIGH — confirmed from official docs + live testing
- Oscillation algorithm: HIGH — verified with Node.js test scripts in this session
- git diff-tree approach: HIGH — verified against live repo
- Read-only regex: HIGH — verified against edge cases (bare ls, cat prefix, git commit)
- State file path resolution: HIGH — input.cwd confirmed in official docs
- Test patterns: HIGH — copied directly from existing test files in project
- Phase boundary (no enforcement in Phase 6): HIGH — from REQUIREMENTS.md, ROADMAP.md, additional_context in prompt

**Research date:** 2026-02-21
**Valid until:** 2026-03-21 (Claude Code hook API is stable; git CLI behavior is stable)
