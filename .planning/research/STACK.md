# Stack Research

**Domain:** nForma behavioral enforcement hooks (session state, approach declaration, root cause detection, scope guard)
**Researched:** 2026-03-19
**Confidence:** HIGH — all findings derived directly from codebase; no third-party library additions required

---

## Feature 1: SESSION STATE INJECTION in nf-prompt.js

### How it works today

`nf-prompt.js` receives a JSON payload on stdin with these fields (confirmed from code):

```
input.cwd         — working directory (string)
input.session_id  — session identifier (string | null)
input.prompt      — raw user prompt (string)
input.context     — YAML context string (string, may be empty)
```

Output always via:
```js
process.stdout.write(JSON.stringify({
  hookSpecificOutput: {
    hookEventName: 'UserPromptSubmit',
    additionalContext: '...',
  }
}));
```

### Reading STATE.md from a hook

Pattern already established in `findResolutionWorkflow()` and circuit-breaker state reading:

```js
const statePath = path.join(cwd, '.planning', 'STATE.md');
if (fs.existsSync(statePath)) {
  const stateContent = fs.readFileSync(statePath, 'utf8');
  // extract relevant sections
}
```

No new dependencies. `fs` is already required at the top of `nf-prompt.js`. `cwd` is already in scope at the point where injection decisions are made.

### Detecting "first message of session"

There is no existing "first message of session" detector in the hook. The `input.session_id` is available but Claude Code does not distinguish message-index within a session at the hook API level.

**Recommended approach:** use a session-scoped sentinel file, the same way `consumePendingTask()` already uses `pending-task-<sessionId>.txt`. Pattern:

```js
function isFirstMessageOfSession(cwd, sessionId) {
  if (!sessionId) return false;
  const sentinelDir = path.join(cwd, '.claude');
  const sentinelPath = path.join(sentinelDir, `nf-session-seen-${sessionId}.flag`);
  if (fs.existsSync(sentinelPath)) return false;
  try {
    fs.mkdirSync(sentinelDir, { recursive: true });
    fs.writeFileSync(sentinelPath, new Date().toISOString(), 'utf8');
    return true;
  } catch {
    return false; // fail-open
  }
}
```

Sentinel files are in `.claude/` (already gitignored by the project). They self-expire when Claude Code garbage-collects session state.

### Placement in nf-prompt.js priority chain

Current priority chain:
1. Circuit breaker active -> inject resolution workflow (early exit)
2. Pending task -> inject queued command (early exit)
3. Planning command -> inject quorum instructions

Session state injection belongs at **priority 0** (before circuit breaker), because it enriches context for ALL messages, not just planning commands. Alternatively it can be appended to the quorum instructions block (priority 3) — lower implementation risk, no need to restructure early-exit logic.

**Recommended:** append to the `instructions` string at the end of priority-3 (after quorum dispatch is built), gated on `isFirstMessageOfSession()`. Keeps the early-exit structure intact and avoids injecting STATE.md content on circuit-breaker recovery messages where it would clutter the recovery prompt.

### STATE.md parsing

STATE.md is human-readable markdown. A lightweight extract is better than injecting the full file (which grows with the Quick Tasks Completed table). Extract only the sections relevant for session orientation:

```js
// Extract "Current Position" and "Accumulated Context > Decisions" sections
function extractStateContext(stateContent) {
  const lines = stateContent.split('\n');
  const sections = [];
  let inSection = false;
  for (const line of lines) {
    if (/^## Current Position/.test(line) || /^### Decisions/.test(line)) {
      inSection = true;
    }
    if (inSection) {
      sections.push(line);
      if (sections.length > 20) break; // cap at 20 lines
    }
    if (inSection && sections.length > 1 && /^## /.test(line) && !line.includes('Current Position')) break;
  }
  return sections.join('\n').trim();
}
```

Cap injection at ~500 chars to avoid crowding quorum instructions (existing hook-level cap is 800 chars for context-stack, noted in nf-prompt.js line 862).

---

## Feature 2: APPROACH DECLARATION GATE in quick.md

### How workflow gates work

`quick.md` is a markdown workflow file with `<process>` sections containing numbered steps. Gates are already implemented as inline conditional blocks, e.g.:

- Step 4.5 (formal scope scan): `Skip this step entirely if NOT $FULL_MODE.`
- Step 5.5 (plan-checker loop): `Skip this step entirely if NOT $FULL_MODE.`

Gates in quick.md are **not enforced by hooks** — they are enforced by the Claude Code orchestrator reading the workflow instructions. The hook for enforcement of behavioral properties is `nf-stop.js` (Stop hook).

### Approach declaration gate options

**Option A: Workflow-only gate (instructions-level)**

Add a Step 3.5 after "Create task directory" that requires the executor to declare an approach before spawning the planner:

```markdown
**Step 3.5: Approach declaration (required)**

Before spawning the planner, declare your implementation approach:

APPROACH: [one sentence describing how you will solve the task]
RISKS: [any risks or ambiguities]

This declaration is injected into the planner prompt as <approach_declaration>.
```

This is zero-code — no hook changes needed. The Stop hook can optionally verify it.

**Option B: Hook-enforced gate via nf-stop.js**

`nf-stop.js` already reads the transcript for `<!-- GSD_DECISION -->`. The same pattern can check for an `APPROACH:` declaration token before allowing the response. This is HIGH friction and not recommended for quick tasks.

**Recommendation: Option A.** Add Step 3.5 to `quick.md` as a structured declaration block. The planner receives it as `<approach_declaration>` context. No hook changes needed for MVP. The gate prevents unconscious scope creep by forcing a one-sentence approach commitment before planning begins.

### Install sync requirement

`core/workflows/quick.md` is the durable source. The installer copies it to `~/.claude/nf/workflows/quick.md`. Any edit to `core/workflows/quick.md` must also update the installed copy or be synced on next `node bin/install.js --claude --global`.

---

## Feature 3: ROOT CAUSE PATTERN DETECTION in nf-prompt.js

### Detection mechanism

Root cause phrases are injected into prompts by users trying to fix bugs. Detection pattern (same style as the quorum command allowlist check at line 878):

```js
const ROOT_CAUSE_SIGNAL_REGEX = /\b(root cause|because of|caused by|the bug is|the issue is|fix the underlying)\b/i;
const isRootCauseTask = ROOT_CAUSE_SIGNAL_REGEX.test(prompt);
```

### What to inject when detected

When `isRootCauseTask` is true, append to `instructions` (same tail-append pattern used for THINKING BUDGET at line 851):

```js
if (isRootCauseTask) {
  instructions += '\n\nROOT CAUSE ENFORCEMENT: This task contains a root cause signal. ' +
    'Before implementing any fix, you MUST:\n' +
    '1. State the root cause in one sentence (not the symptom)\n' +
    '2. Show the minimal reproduction path\n' +
    '3. Confirm the fix addresses the root cause, not a workaround\n' +
    'Do NOT patch symptoms. The Stop hook will verify <!-- GSD_DECISION --> includes root cause reasoning.';
}
```

### Placement

Append after the THINKING BUDGET directive (line ~856) and before the context stack injection (line ~865). This ensures root cause enforcement appears in the instructions block delivered to Claude regardless of whether quorum is active.

**Critical constraint:** this runs after the `cmdPattern.test(prompt)` check at line 882 — meaning it only fires for `/nf:` commands. Root cause detection on arbitrary prompts would require moving the logic before the command pattern check. For v0.40, restricting to `/nf:` commands is safer and correct.

---

## Feature 4: NEW PreToolUse:Edit/Write SCOPE GUARD HOOK (nf-scope-guard.js)

### Hook registration pattern (from install.js lines 2323-2366)

Every PreToolUse hook follows this exact pattern in install.js:

```js
// Step 1: Add to DEFAULT_HOOK_PRIORITIES in hooks/config-loader.js
'nf-scope-guard': 50,

// Step 2: In the install block (~line 2323 in bin/install.js):
const hasScopeGuardHook = settings.hooks.PreToolUse.some(entry =>
  entry.hooks && entry.hooks.some(h => h.command && h.command.includes('nf-scope-guard'))
);
if (!hasScopeGuardHook) {
  settings.hooks.PreToolUse.push({
    hooks: [{ type: 'command', command: buildHookCommand(targetDir, 'nf-scope-guard.js'), timeout: 10 }]
  });
  console.log(`  ${green}+${reset} Configured nForma scope guard hook (PreToolUse)`);
}

// Step 3: In the uninstall block (~line 1396 in bin/install.js):
if (settings.hooks && settings.hooks.PreToolUse) {
  const before = settings.hooks.PreToolUse.length;
  settings.hooks.PreToolUse = settings.hooks.PreToolUse.filter(entry =>
    !(entry.hooks && entry.hooks.some(h => h.command && h.command.includes('nf-scope-guard')))
  );
  if (settings.hooks.PreToolUse.length < before) {
    settingsModified = true;
    console.log(`  ${green}+${reset} Removed nForma scope guard hook`);
  }
  if (settings.hooks.PreToolUse.length === 0) delete settings.hooks.PreToolUse;
}
```

### Tool name filtering for Edit/Write

The hook input payload for PreToolUse includes:
- `input.tool_name` or `input.toolName` — the tool being called (string)
- `input.tool_input` — the arguments to the tool (object)

For Edit: `input.tool_input.path` — the file path being edited
For Write: `input.tool_input.file_path` — the file path being written

Tool name values (from circuit-breaker line 633 and destructive-git-guard line 89 patterns):
- `'Bash'` for Bash tool
- `'Edit'` for Edit tool
- `'Write'` for Write tool
- `'MultiEdit'` for MultiEdit tool (check both casings)

Filter pattern (from destructive-git-guard lines 88-92):

```js
const toolName = input.tool_name || input.toolName || '';
const EDIT_WRITE_TOOLS = new Set(['edit', 'write', 'multiedit']);
if (!EDIT_WRITE_TOOLS.has(toolName.toLowerCase())) {
  process.exit(0);
}

// Extract target file path
const filePath = (input.tool_input && (input.tool_input.path || input.tool_input.file_path)) || '';
```

### Hook output: warn vs. block

**Warn (recommended for v0.40 — same as destructive-git-guard):**
```js
process.stdout.write(JSON.stringify({
  hookSpecificOutput: {
    hookEventName: 'PreToolUse',
    additionalContext: `[nf-scope-guard] WARNING: ${filePath} may be outside declared task scope.`,
  },
}));
```

**Block (confirmed working from nf-circuit-breaker.js line 766-773):**
```js
process.stdout.write(JSON.stringify({
  hookSpecificOutput: {
    hookEventName: 'PreToolUse',
    permissionDecision: 'deny',
    permissionDecisionReason: `Scope guard: ${filePath} is outside the declared task scope.`,
  },
}));
```

### Scope source: current-activity.json + task plan

`current-activity.json` is written by `gsd-tools.cjs activity-set` and exists at `.planning/current-activity.json` during active task execution. Format:

```json
{ "activity": "quick", "sub_activity": "executing" }
```

The task plan path can be derived from the plan naming convention: `.planning/quick/<num>-<slug>/<num>-PLAN.md`. Plans use YAML frontmatter with a `files:` field listing declared files. The scope guard reads that field and warns when the target file is not in the list.

Fail-open: if `current-activity.json` is absent or the plan cannot be parsed, allow the tool call (no false positives when hook runs outside nForma context).

### Hook file lifecycle

```
hooks/nf-scope-guard.js         ← development source (write here)
hooks/dist/nf-scope-guard.js    ← compiled copy (sync manually: cp hooks/nf-scope-guard.js hooks/dist/)
~/.claude/hooks/nf-scope-guard.js  ← installed copy (synced by: node bin/install.js --claude --global)
```

The installer reads from `hooks/dist/` only. Development source in `hooks/` is the durable repo copy.

---

## Core Technologies (no new additions)

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| Node.js (CommonJS) | existing (18+) | Hook runtime | All hooks are `.js` CJS modules; no transpilation needed |
| `fs` (stdlib) | built-in | STATE.md reads, sentinel files, activity JSON | Already required in every hook |
| `path` (stdlib) | built-in | Path construction for `.claude/`, `.planning/` | Already required in every hook |

No npm packages are needed for any of the four features. All patterns use stdlib only.

---

## Supporting Libraries (existing, no changes needed)

| Library | Location | Purpose | When to Use |
|---------|----------|---------|-------------|
| `config-loader` | `./config-loader` | `loadConfig`, `shouldRunHook`, `validateHookInput` | Every hook; provides profile guard + input validation |
| `nf-resolve-bin` | `./nf-resolve-bin` | Resolve bin/ paths across dev vs. installed | Only if reading planning-paths.cjs or other bin scripts |
| `conformance-schema.cjs` | `./conformance-schema.cjs` | `schema_version` constant | Only if hook writes conformance events |

---

## Installation (no new packages)

```bash
# After writing hooks/nf-scope-guard.js:
cp hooks/nf-scope-guard.js hooks/dist/nf-scope-guard.js

# Sync quick.md workflow to installed location:
cp core/workflows/quick.md ~/.claude/nf/workflows/quick.md

# Register new hook in settings.json:
node bin/install.js --claude --global
```

---

## Alternatives Considered

| Recommended | Alternative | Why Not |
|-------------|-------------|---------|
| Sentinel file for first-message detection | Track in `.planning/session-registry.json` | Overkill; sentinel file is atomic, zero-parse, and self-cleaning |
| Append STATE.md summary to quorum instructions block | Inject before priority-1 (circuit breaker) | Restructures the early-exit chain; higher risk of injecting stale context on circuit-breaker recovery |
| Workflow-only approach declaration gate | Stop hook `APPROACH:` token check | Stop hook adds friction for ALL quick tasks; opt-in declaration is sufficient for v0.40 |
| Warn-only scope guard | Hard-block scope guard | Hard block on Edit/Write would halt legitimate lateral edits (e.g., updating CLAUDE.md, STATE.md alongside implementation); warn-only is safer for initial rollout |
| Append root cause enforcement inside quorum instructions | Separate early-exit path | Early exit would skip quorum injection; appending is consistent with THINKING BUDGET pattern |

## What NOT to Use

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| `process.env.SESSION_ID` for session detection | Only set when `SESSION_ID` env var is explicitly passed; not reliable in all Claude Code contexts | `input.session_id` from the hook payload |
| `systemMessage` output field | Only shows as UI warning, does not go into Claude's context (nf-prompt.js line 17 comment) | `additionalContext` in `hookSpecificOutput` |
| Writing hook state to `.planning/` | `.planning/` is a planning artifact store; transient hook state belongs in `.claude/` | `.claude/` sentinel files |
| Direct injection of full STATE.md | The Quick Tasks Completed table grows unboundedly; full injection wastes context budget | Extract only "Current Position" and "Decisions" sections, capped at ~500 chars |

---

## Version Compatibility

| API Field | Hook Event | Notes |
|-----------|-----------|-------|
| `input.session_id` | UserPromptSubmit | Present in payload; confirmed used in `consumePendingTask()` at line 84 of nf-prompt.js |
| `hookSpecificOutput.additionalContext` | UserPromptSubmit, PreToolUse | Both events support this field; confirmed in both nf-prompt.js and nf-destructive-git-guard.js |
| `hookSpecificOutput.permissionDecision: 'deny'` | PreToolUse only | Confirmed in nf-circuit-breaker.js line 769 |
| `input.tool_name` / `input.toolName` | PreToolUse | Both variants checked for backward compat; confirmed in nf-circuit-breaker.js line 633 |
| `input.tool_input.path` | PreToolUse (Edit tool) | Edit tool uses `path` field |
| `input.tool_input.file_path` | PreToolUse (Write tool) | Write tool uses `file_path` field |

---

## Sources

- `/Users/jonathanborduas/code/QGSD/hooks/nf-prompt.js` — direct read (HIGH confidence): hook input schema, output mechanism, priority chain, `additionalContext`, `session_id` usage, `instructions` append pattern
- `/Users/jonathanborduas/code/QGSD/hooks/nf-circuit-breaker.js` — direct read (HIGH confidence): PreToolUse input schema, `tool_name`/`toolName` fields, `permissionDecision: 'deny'` output pattern
- `/Users/jonathanborduas/code/QGSD/hooks/nf-destructive-git-guard.js` — direct read (HIGH confidence): Edit/Write tool_name filtering, warn-only output pattern, `additionalContext` in PreToolUse
- `/Users/jonathanborduas/code/QGSD/hooks/nf-mcp-dispatch-guard.js` — direct read (HIGH confidence): PreToolUse tool name filtering, fail-open pattern
- `/Users/jonathanborduas/code/QGSD/bin/install.js` (lines 2298-2410) — direct read (HIGH confidence): hook registration/uninstall pattern, `DEFAULT_HOOK_PRIORITIES`, `buildHookCommand`
- `/Users/jonathanborduas/code/QGSD/core/workflows/quick.md` — direct read (HIGH confidence): workflow gate pattern, approach declaration insertion point, install sync requirement
- `/Users/jonathanborduas/code/QGSD/.planning/STATE.md` — direct read (HIGH confidence): STATE.md format, section structure for extraction

---
*Stack research for: nForma behavioral enforcement hooks (session state injection, approach declaration gate, root cause enforcement, scope guard)*
*Researched: 2026-03-19*
