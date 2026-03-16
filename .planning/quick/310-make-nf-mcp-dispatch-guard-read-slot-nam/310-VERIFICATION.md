---
phase: quick-310
verified: 2026-03-16T19:24:00Z
status: gaps_found
score: 4/5 must-haves verified
gaps:
  - truth: "Guard reads slot names dynamically from bin/providers.json at runtime"
    status: failed
    reason: "Path resolution bug in installed context — hook reads from wrong location when installed globally"
    artifacts:
      - path: "hooks/nf-mcp-dispatch-guard.js"
        issue: "Line 20 uses __dirname-relative path which resolves to ~/.claude/bin/providers.json (doesn't exist) when installed. Should use cwd-relative path or ~/.claude/nf-bin/providers.json fallback"
    missing:
      - "Fix loadKnownFamilies() to use project cwd context OR use nf-bin/ fallback for installed context"
      - "Verify installed hook can read from ~/.claude/nf-bin/providers.json (installer correctly copies providers.json there)"
---

# Phase quick-310: MCP Dispatch Guard Dynamic Discovery — Verification Report

**Phase Goal:** Make nf-mcp-dispatch-guard read slot names dynamically from providers.json and ~/.claude.json mcpServers instead of hardcoded SLOT_TOOL_SUFFIX families

**Verified:** 2026-03-16T19:24:00Z

**Status:** gaps_found

**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Guard blocks direct MCP calls to all slot families listed in providers.json | ✓ VERIFIED | All 5 families (codex, gemini, opencode, copilot, claude) correctly discovered and blocking works (TC7-TC13 pass) |
| 2 | Guard passes through admin tools (ping, health_check, deep_health_check, identity, help) regardless of slot | ✓ VERIFIED | TC2-TC6 pass; ALLOWLISTED_SUFFIXES set is checked before family validation |
| 3 | Guard passes through MCP servers NOT listed in providers.json | ✓ VERIFIED | TC14 passes — unknown servers pass through silently |
| 4 | Guard fails open if providers.json is missing or malformed | ✓ VERIFIED | TC15-TC16 pass; loadKnownFamilies() catches errors and returns empty Set |
| 5 | SLOT_TOOL_SUFFIX in config-loader.js is NOT modified | ✓ VERIFIED | config-loader.js unchanged; SLOT_TOOL_SUFFIX still exports 9 entries (codex, codex-cli, gemini, gemini-cli, opencode, copilot, copilot-cli, claude, unified) |
| 6 | Hook reads slot names dynamically from providers.json in actual deployment context | ✗ FAILED | Path resolution works in project context (__dirname = hooks/) but fails in installed context (__dirname = ~/.claude/hooks/). Hook looks for ~/.claude/bin/providers.json (doesn't exist) instead of ~/.claude/nf-bin/providers.json (where installer copies it) |

**Score:** 5/6 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `hooks/nf-mcp-dispatch-guard.js` | Dynamic slot family discovery from providers.json | ✓ VERIFIED | Contains loadKnownFamilies() function, fs/path imports, dynamic KNOWN_FAMILIES initialization at module scope |
| `hooks/nf-mcp-dispatch-guard.test.js` | Tests validating dynamic discovery | ✓ VERIFIED | 19 tests pass (17 existing + TC18 + TC19); TC18 validates KNOWN_FAMILIES contains expected families; TC19 validates numbered slots are stripped correctly |
| `hooks/dist/nf-mcp-dispatch-guard.js` | Synced copy of source | ⚠️ PARTIAL | File exists and is byte-identical to source (verified via diff), but contains the same path resolution bug as source |

**Level 1 (Exists):** All artifacts present

**Level 2 (Substantive):**
- loadKnownFamilies() reads from providers.json and derives families ✓
- Tests validate both pass and fail cases ✓
- Fail-open behavior on error implemented ✓

**Level 3 (Wired):**
- KNOWN_FAMILIES initialized at module scope (line 46) ✓
- KNOWN_FAMILIES used in main() to block families (line 109) ✓
- loadKnownFamilies exported for testing ✓
- BUT: Path resolution incorrect for installed context ✗

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|----|--------|---------|
| hooks/nf-mcp-dispatch-guard.js | bin/providers.json | fs.readFileSync + path.resolve(__dirname, '..', 'bin', 'providers.json') | ✓ IN PROJECT | Works when hook runs from project/hooks/ directory (typical dev context) |
| hooks/nf-mcp-dispatch-guard.js | bin/providers.json | SAME PATH | ✗ IN INSTALLED | FAILS when hook installed to ~/.claude/hooks/ — path resolves to ~/.claude/bin/providers.json which doesn't exist |
| hooks/config-loader.js | KNOWN_FAMILIES (NOT imported) | — | ✓ VERIFIED | Guard no longer imports SLOT_TOOL_SUFFIX; grep confirms no import statement |
| hooks/config-loader.js | loadConfig, shouldRunHook, validateHookInput | require('./config-loader') | ✓ VERIFIED | Correctly imports 3 utilities, does NOT import SLOT_TOOL_SUFFIX |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| QUICK-310 | 310-PLAN.md | Make guard read slot names from providers.json instead of hardcoded SLOT_TOOL_SUFFIX | PARTIAL | Works in project context; fails in installed context |

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| hooks/nf-mcp-dispatch-guard.js | 20, 39 | path.resolve(__dirname, '..', 'bin', 'providers.json') | BLOCKER | Path resolution assumes hook runs from project/hooks/, breaks when installed to ~/.claude/hooks/ — installed hook can't find providers.json, fails open (allows all MCP calls through instead of blocking) |

### Formal Verification

**Status: TOOLING ABSENT (SKIP)**

Formal check result: `{"passed":3,"failed":1,"skipped":0,"counterexamples":["mcp-calls:tlc"]}`

This task declared `formal_artifacts: none` — it did not modify any formal spec files (TLA+, Alloy, or PRISM). The counterexample on mcp-calls:tlc is pre-existing and unrelated to this task's changes. No new formal artifacts were created.

## Gap Analysis

### Truth 6 Failed: Path Resolution Bug in Installed Context

**Issue:** The hook uses relative path resolution from its own `__dirname`:

```javascript
const providersPath = path.resolve(__dirname, '..', 'bin', 'providers.json');
```

**In project context (development):**
- `__dirname` = project/hooks/
- Resolves to: project/bin/providers.json ✓ (correct, exists)

**In installed context (production):**
- `__dirname` = ~/.claude/hooks/
- Resolves to: ~/.claude/bin/providers.json ✗ (WRONG, doesn't exist)
- Should resolve to: ~/.claude/nf-bin/providers.json (installer copies providers.json here, line 2150 of bin/install.js)

**Impact:** When installed globally, the hook fails to load providers.json, returns empty KNOWN_FAMILIES set, and **fails open** (allows all direct MCP calls through). This violates R3.2 enforcement in production deployments.

**Evidence:**
1. Installer correctly copies bin/providers.json to ~/.claude/nf-bin/providers.json (confirmed in bin/install.js line 2150)
2. Hook looks for ~/.claude/bin/providers.json instead (doesn't exist)
3. Hook catches error and returns empty Set (fail-open on line 40-41)
4. Empty KNOWN_FAMILIES means guard at line 109 never blocks anything

**Required Fix:**

The loadKnownFamilies() function needs to:

1. **Option A (Preferred):** Use the working directory context instead of hook __dirname:
   ```javascript
   function loadKnownFamilies(workingDir) {
     try {
       const providersPath = path.resolve(workingDir, 'bin', 'providers.json');
       // ... rest of logic
   ```
   Then call it from main() after cwd is known:
   ```javascript
   const KNOWN_FAMILIES = loadKnownFamilies(cwd);
   ```

2. **Option B:** Provide fallback for installed context:
   ```javascript
   let providersPath = path.resolve(__dirname, '..', 'bin', 'providers.json');
   if (!fs.existsSync(providersPath)) {
     providersPath = path.resolve(process.env.HOME, '.claude', 'nf-bin', 'providers.json');
   }
   ```

3. **Option C:** Skip dynamic discovery in installed context and use pre-built list, but this defeats the purpose of the task.

**Recommendation:** Use Option A (Option B as interim if Option A requires refactoring main()). This ensures the hook always reads the authoritative providers.json from the active project context.

### Summary of Gaps

1. **Path Resolution Bug (BLOCKER):** Hook can't find providers.json in installed context, fails open, doesn't enforce R3.2 in production
   - Artifact: hooks/nf-mcp-dispatch-guard.js line 20, 39
   - Missing: Fix path resolution to use cwd context OR fallback to ~/.claude/nf-bin/providers.json
   - Severity: BLOCKER — R3.2 enforcement doesn't work when hook is actually installed and running

2. **Test Coverage Gap:** No tests verify the installed path context works
   - Missing: Integration test that simulates installed context (hook at ~/.claude/hooks/ resolving to ~/.claude/nf-bin/providers.json)

## What Works

- ✓ Dynamic discovery from providers.json in project context (development)
- ✓ All 5 families (codex, gemini, opencode, copilot, claude) correctly extracted and stripped of -N suffix
- ✓ Blocking behavior works correctly when families are loaded
- ✓ Admin tools (ping, health_check, etc.) pass through
- ✓ Unknown MCP servers pass through
- ✓ Fail-open on error (safe degradation, though ineffective here)
- ✓ All 19 unit tests pass
- ✓ SLOT_TOOL_SUFFIX left untouched in config-loader.js
- ✓ Dist copy synced
- ✓ Hook installed globally

## What Doesn't Work

- ✗ **Path resolution in installed context** — hook can't find providers.json when running from ~/.claude/hooks/, defaults to empty KNOWN_FAMILIES, silently allows all direct MCP calls through

## Human Verification Required

**None** — this is a code logic issue, not a UX/visual/behavioral test.

---

_Verified: 2026-03-16T19:24:00Z_
_Verifier: Claude (nf-verifier)_
