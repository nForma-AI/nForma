# Architecture Research

**Domain:** nForma v0.40 — Hook and workflow pipeline extension (6 friction-reduction features)
**Researched:** 2026-03-19
**Confidence:** HIGH (all findings from direct codebase inspection)

## Standard Architecture

### System Overview

```
┌──────────────────────────────────────────────────────────────────┐
│                     Claude Code Session                           │
│                                                                   │
│  User Message                                                     │
│       │                                                           │
│       ▼                                                           │
│  [UserPromptSubmit hooks]                                         │
│  ┌─────────────────────────────────────────────────────────────┐  │
│  │  nf-prompt.js  (Priority 50 — injector)                     │  │
│  │  ── Priority 1: circuit breaker recovery                    │  │
│  │  ── Priority 2: pending task injection                      │  │
│  │  ── NEW P2.5: state injection (first-message guard)         │  │
│  │  ── NEW P2.7: root cause template (debug/fix detection)     │  │
│  │  ── NEW P2.8: constraint injection (edit/content prompts)   │  │
│  │  ── Priority 3: quorum instructions                         │  │
│  └─────────────────────────────────────────────────────────────┘  │
│       │                                                           │
│       ▼                                                           │
│  Claude executes (reads workflows, spawns subagents)              │
│  ┌─────────────────────────────────────────────────────────────┐  │
│  │  core/workflows/quick.md                                    │  │
│  │  ── NEW: approach gate Step 0 (APPROACH/NOT-DOING/SCOPE)    │  │
│  │  ── NEW: scope contract write (.claude/scope-contract.json) │  │
│  │                                                             │  │
│  │  commands/nf/solve-diagnose.md                              │  │
│  │  ── NEW: root cause quorum vote Step 0f                     │  │
│  └─────────────────────────────────────────────────────────────┘  │
│       │                                                           │
│       ▼                                                           │
│  [PreToolUse hooks] — fires before each tool call                 │
│  ┌─────────────────────────────────────────────────────────────┐  │
│  │  nf-circuit-breaker.js  (Priority 1000 — oscillation)       │  │
│  │  nf-destructive-git-guard.js  (warn on git --force etc.)    │  │
│  │  nf-mcp-dispatch-guard.js  (warn on direct MCP calls)       │  │
│  │  nf-node-eval-guard.js  (rewrite node -e to heredoc)        │  │
│  │  NEW: nf-scope-guard.js  (Edit/Write out-of-scope warning)  │  │
│  └─────────────────────────────────────────────────────────────┘  │
│       │                                                           │
│       ▼                                                           │
│  [Stop hooks] — fires before Claude delivers final response       │
│  ┌─────────────────────────────────────────────────────────────┐  │
│  │  nf-stop.js  (quorum gate — reads transcript)               │  │
│  │  nf-console-guard.js  (warn on leftover console.log)        │  │
│  └─────────────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────────┘
```

### Component Responsibilities

| Component | Responsibility | Hook Event | Status |
|-----------|----------------|------------|--------|
| `nf-prompt.js` | Inject context into Claude's additionalContext before it processes a user message | UserPromptSubmit | EXISTING — extend |
| `nf-circuit-breaker.js` | Detect oscillation in git history, deny write tool calls when active | PreToolUse + PostToolUse | EXISTING — pattern reference only |
| `nf-stop.js` | Verify quorum actually ran before delivering planning output | Stop | EXISTING — no changes |
| `core/workflows/quick.md` | Orchestrate quick task execution (planner → quorum → executor) | Workflow (not a hook) | EXISTING — insert Step 0 |
| `commands/nf/solve-diagnose.md` | Run diagnostic phase of nf:solve (Steps 0–1) | Sub-skill document | EXISTING — add quorum vote block |
| `nf-scope-guard.js` | Warn when Edit/Write targets files outside the current branch's expected scope | PreToolUse | NEW — create |

---

## 6-Feature Integration Map

### Feature 1: Session State Injection

**Integration point:** `nf-prompt.js`, new block between Priority 2 (pending task) and Priority 3 (quorum)

**What to add:** When this is the first user message of the session (detect via a session-scoped flag file), read `.planning/STATE.md`, extract Phase/Status/Last activity, and prepend a compact summary to `additionalContext`.

**Data flow:**
```
UserPromptSubmit fired
    → nf-prompt.js reads .claude/session-<sessionId>-state-injected.flag
    → flag absent: read .planning/STATE.md, extract ~3 lines
    → write flag file (atomic, session-scoped)
    → prepend STATE summary to instructions/additionalContext
    → normal hook flow continues
```

**Implementation notes:**
- Session detection: use `.claude/session-<sessionId>-state-injected.flag`. Pattern matches `consumePendingTask` atomic claim approach already in this file.
- Cap summary at ~300 chars — same tightness as context stack injection (800-char cap on line 871).
- Fail-open: any read error skips injection silently.
- Existing `parseStateForReminder()` in `nf-session-start.js` already does similar parsing — duplicate as a local utility function (avoid cross-hook dependency).

**Files touched:** `hooks/nf-prompt.js` only.

---

### Feature 2: Approach Gate in quick.md

**Integration point:** `core/workflows/quick.md`, new Step 0 inserted before current "Step 1: Parse arguments"

**What to add:** Before parsing arguments, Claude must output a structured APPROACH block:
```
APPROACH: [one sentence — what will be done]
NOT-DOING: [what is explicitly excluded]
SCOPE: [files/components in scope]
```
The orchestrator reads this block, writes `.claude/scope-contract.json` (branch + scope_patterns), then proceeds to Step 1. If `APPROACH` is absent, re-prompt once. If still absent, warn and continue (fail-open).

**Data flow:**
```
/nf:quick $DESCRIPTION
    → Step 0: Claude declares APPROACH / NOT-DOING / SCOPE inline
    → Step 0 writes .claude/scope-contract.json
    → Step 1: Parse arguments (unchanged)
    → Step 5: Planner receives APPROACH block as additional context
```

**Implementation notes:**
- This is a workflow-level change, not a hook change.
- The APPROACH block should be passed to the planner Task's `<planning_context>` so the planner knows the declared scope.
- No new files created — modify `core/workflows/quick.md` only (then sync to `~/.claude/nf/workflows/quick.md` via install).
- The install sync requirement from MEMORY.md applies: repo is the durable copy, installer deploys to `~/.claude/nf/workflows/`.

**Files touched:** `core/workflows/quick.md` only (install syncs automatically).

---

### Feature 3: Root Cause Template Injection

**Integration point:** `nf-prompt.js`, new detection block after Priority 2 (pending task) and before Priority 3 (quorum)

**What to add:** Detect debug/fix prompt patterns via regex. When detected, inject a root-cause constraint template into `additionalContext`:

```
ROOT CAUSE MODE: This prompt describes a bug or broken behavior.
Before proposing any fix, you MUST:
1. State the root cause hypothesis (what mechanism is failing and why)
2. Identify what assumption the fix relies on
3. Confirm the fix addresses the root cause, not just the symptom
Do NOT propose a fix until you have a root cause hypothesis.
```

**Data flow:**
```
UserPromptSubmit fired
    → nf-prompt.js checks prompt against debug/fix regex
      (/\b(fix|debug|broken|failing|error|why.*not working)\b/i)
    → if match: prepend root cause template to additionalContext
    → quorum instructions follow as normal
```

**Implementation notes:**
- Pattern detection must be narrow enough to avoid false positives. Use a composite regex requiring 2+ bug-signal words or explicit terms.
- Fail-open: regex error → skip injection.
- Template is lightweight (~5 lines) and does not significantly contend with the quorum instructions context budget.
- This is a context-only injection — it does NOT affect the `cmdPattern.test(prompt)` guard that gates quorum dispatch.

**Files touched:** `hooks/nf-prompt.js` only.

---

### Feature 4: Root Cause Quorum Vote in solve-diagnose.md

**Integration point:** `commands/nf/solve-diagnose.md`, new Step 0f inserted at the end of the Step 0 block (after Step 0e: Hypothesis Measurement), before Step 1: Initial Diagnostic Sweep

**What to add:**
```markdown
### Step 0f: Root Cause Quorum Vote

Form a root cause hypothesis from:
- Open debt entries (Step 0d)
- Hypothesis violations (Step 0e)
- Focus phrase (if --focus was passed)

State hypothesis as: "Root cause: [layer] because [mechanism]"

If debt is empty AND hypothesis violations are zero, skip this step.

Run quorum vote (Mode A — pure question):
- Question: "Is this root cause hypothesis correct? Vote APPROVE if evidence
  supports it, BLOCK if it is incomplete or points to a different layer."
- Include hypothesis + top-3 debt entries as context
- Dispatch $DISPATCH_LIST as sibling nf-quorum-slot-worker Tasks (same
  YAML format as quick.md Step 5.7)
- Synthesize votes → $ROOT_CAUSE_VERDICT

Store $ROOT_CAUSE_VERDICT (APPROVED / BLOCKED / INCONCLUSIVE).
If BLOCKED: prepend blocking rationale to remediation context.
Fail-open: if all slots UNAVAIL, proceed with hypothesis uncontested.
```

**Data flow:**
```
Step 0e completes → hypothesis_measurements.json written
    → Step 0f: Claude forms root cause hypothesis
    → quorum vote dispatched (nf-quorum-slot-worker Tasks)
    → $ROOT_CAUSE_VERDICT stored
    → output_contract JSON gains root_cause_verdict field
    → Step 1: diagnostic sweep runs with hypothesis in context
    → remediation sub-skills receive contested/uncontested flag
```

**Implementation notes:**
- Uses the same quorum dispatch pattern already in `quick.md` Step 5.7 — same YAML format, same `nf-quorum-slot-worker` Task dispatch.
- The `output_contract` JSON at the end of `solve-diagnose.md` gains a `root_cause_verdict` field. The orchestrator must handle it as optional (fail-open).
- Fail-open when nothing to vote on (empty debt and no violations).

**Files touched:** `commands/nf/solve-diagnose.md` only.

---

### Feature 5: Constraint Injection for Edit/Content Prompts

**Integration point:** `nf-prompt.js`, detection alongside Feature 3

**What to add:** Detect edit/content-request patterns via regex. When detected (and not already matching debug/fix), inject an edit-in-place default:

```
EDIT CONSTRAINT: When editing content, prefer in-place edits over rewrites.
Identify the minimal change that achieves the goal.
State what you are keeping unchanged before describing what changes.
```

**Data flow:**
```
UserPromptSubmit fired
    → nf-prompt.js checks prompt against edit/content regex
      (/\b(rewrite|update the|change the|modify|make it say|replace.*with)\b/i)
    → if match AND not already in debug/fix mode: prepend constraint
    → quorum instructions follow as normal
```

**Implementation notes:**
- Feature 3 and Feature 5 are mutually exclusive in injection: debug/fix takes priority. Implement as `if (debugMatch) ... else if (editMatch) ...`.
- Fail-open: regex error → skip.
- Lightweight injection (~3 lines), no context budget concern.

**Files touched:** `hooks/nf-prompt.js` only.

---

### Feature 6: Branch Scope Guard Hook

**Integration point:** New hook file `hooks/nf-scope-guard.js`, registered as PreToolUse in `bin/install.js`

**What to add:** A PreToolUse hook that fires when `tool_name` is `Edit`, `Write`, or `MultiEdit`. It reads the current git branch name and compares the target file path against a scope contract stored in `.claude/scope-contract.json`. If the file is outside the declared scope, emit a non-blocking advisory warning.

**Pattern derived from `nf-destructive-git-guard.js`:**
```javascript
// hooks/nf-scope-guard.js
// PreToolUse hook — fires on Edit/Write/MultiEdit
// Reads .claude/scope-contract.json for current branch
// Emits advisory warning (non-blocking) when file is outside scope
// Always allows the tool call — fail-open on any error
'use strict';
const GUARDED_TOOLS = new Set(['Edit', 'Write', 'MultiEdit']);
// main(): read stdin JSON, check tool_name, read contract, compare path
// emit { hookSpecificOutput: { permissionDecision: 'allow', ... } } on warning
// process.exit(0) always
```

**Scope contract format** (`.claude/scope-contract.json`, written by quick.md Step 0):
```json
{
  "branch": "nf/quick-NNN-description",
  "scope_patterns": ["hooks/", "core/workflows/quick.md"],
  "set_at": "2026-03-19T..."
}
```

**Data flow:**
```
Edit/Write/MultiEdit tool called
    → nf-scope-guard.js fires
    → reads current git branch (spawnSync git rev-parse --abbrev-ref HEAD)
    → reads .claude/scope-contract.json
    → checks if target file path starts with any scope_pattern
    → if out of scope: emit advisory warning in permissionDecisionReason
    → always allows the tool call
```

**Registration in bin/install.js** (after existing nf-node-eval-guard block):
```javascript
const hasScopeGuardHook = settings.hooks.PreToolUse.some(entry =>
  entry.hooks && entry.hooks.some(h => h.command && h.command.includes('nf-scope-guard'))
);
if (!hasScopeGuardHook) {
  settings.hooks.PreToolUse.push({
    hooks: [{ type: 'command', command: buildHookCommand(targetDir, 'nf-scope-guard.js'), timeout: 10 }]
  });
}
```

**Implementation notes:**
- If no contract exists for the current branch, the hook is a no-op.
- This creates a data dependency on Feature 2: the approach gate writes the contract, the scope guard reads it. Build Feature 2 first, or verify the guard is a genuine no-op when contract is absent (it is, by design).
- Keep guard logic O(1) — no network calls, no git log parsing. Use `spawnSync` for branch name only.

**Files touched:**
- `hooks/nf-scope-guard.js` — create new
- `hooks/dist/nf-scope-guard.js` — copy to dist
- `bin/install.js` — add PreToolUse registration block (uninstall block also needed)

---

## Recommended Project Structure (delta)

```
hooks/
├── nf-prompt.js              # MODIFY: add Features 1, 3, 5 (new blocks in priority chain)
├── nf-scope-guard.js         # CREATE: Feature 6 (new PreToolUse hook)
hooks/dist/
├── nf-prompt.js              # COPY from hooks/ after modification
├── nf-scope-guard.js         # COPY from hooks/ after creation
bin/
├── install.js                # MODIFY: register nf-scope-guard.js (install + uninstall paths)
core/workflows/
├── quick.md                  # MODIFY: add approach gate Step 0 + scope contract write
commands/nf/
├── solve-diagnose.md         # MODIFY: add root cause quorum vote Step 0f
```

**Install sync (required after any hook or workflow modification):**
```bash
cp hooks/nf-prompt.js hooks/dist/nf-prompt.js
cp hooks/nf-scope-guard.js hooks/dist/nf-scope-guard.js
node bin/install.js --claude --global
```

---

## Architectural Patterns

### Pattern 1: additionalContext Injection (nf-prompt.js)

**What:** The UserPromptSubmit hook appends instructions to `hookSpecificOutput.additionalContext`, which Claude receives as prepended context before processing the user message. Multiple features share this single injection point by appending sections to the `instructions` string.

**When to use:** Any feature that needs to inform Claude's thinking before it acts on a user prompt.

**Priority ordering in nf-prompt.js (updated):**
```
Priority 1: Circuit breaker recovery       → process.exit(0) immediately if active
Priority 2: Pending task injection         → process.exit(0) immediately if task queued
NEW P2.5:   State injection                → first-message of session only, prepend to instructions
NEW P2.7:   Root cause template injection  → debug/fix regex match, prepend to instructions
NEW P2.8:   Constraint injection           → edit/content regex match (elif), prepend to instructions
Priority 3: Quorum instructions            → planning command check + dispatch build
[exit 0 with final instructions string]
```

**Trade-offs:** Each additional injection adds file read latency. State injection is the heaviest (STATE.md read + flag write). All must be fail-open. The 800-char hook-level context cap applies to context stack injection but not to the free-form `instructions` string used by quorum and the new injections.

**Critical constraint:** New blocks must go BEFORE the `cmdPattern.test(prompt)` check at line 882. That check gates quorum dispatch but should not suppress the new context injections. The new injections run unconditionally (subject to regex match); quorum instructions run only on planning commands.

### Pattern 2: Workflow Step Insertion

**What:** Add a numbered step to an existing workflow document (`quick.md`, `solve-diagnose.md`). Steps are numbered and sequential; insertion requires renumbering downstream steps and updating `<success_criteria>` checklists.

**When to use:** Features that belong to a specific workflow phase, not global.

**Trade-offs:** Workflow documents are read by Claude as free-form markdown — there is no schema enforcement. The fail-open guarantee must be stated explicitly in the step prose. Downstream step numbers must be updated consistently.

### Pattern 3: PreToolUse Guard Hook

**What:** Create a new hook file following the pattern of `nf-destructive-git-guard.js`:
1. Read and validate JSON from stdin
2. Check `tool_name` against a whitelist
3. Read a lightweight state file to determine guard condition
4. Emit advisory warning or allow unconditionally
5. Always `process.exit(0)` — fail-open
6. Register in `bin/install.js` (install + uninstall paths)

**When to use:** Enforcement that must fire at tool-call time, independent of prompt content.

**Trade-offs:** Every PreToolUse hook adds overhead to every matching tool call. Keep guard logic O(1) — no git log, no network. Read from a pre-written contract file (written once at task-init time).

---

## Data Flow

### Feature 1: State Injection Flow

```
Session starts → user sends first message
    → UserPromptSubmit fires
    → nf-prompt.js: check .claude/session-<sessionId>-state-injected.flag
    → flag absent: read .planning/STATE.md, extract Phase/Status/Last activity
    → write flag (atomic rename, session-scoped)
    → prepend STATE summary (~3 lines) to instructions string
    → normal hook flow continues (quorum etc.)
```

### Feature 2 + 6: Approach Gate + Scope Contract Flow

```
/nf:quick $DESCRIPTION
    → quick.md Step 0: Claude declares APPROACH/NOT-DOING/SCOPE inline
    → Step 0 writes .claude/scope-contract.json (branch + scope_patterns)
    → Step 1: init, branch creation (unchanged)
    → Step 5: planner receives APPROACH block as context
    ↓
    [during execution — any Edit/Write/MultiEdit call]
    → nf-scope-guard.js fires (PreToolUse)
    → reads .claude/scope-contract.json
    → checks file path against scope_patterns
    → if mismatch: emit advisory warning (non-blocking)
```

### Features 3 + 5: Prompt Pattern Detection Flow

```
UserPromptSubmit fired
    → nf-prompt.js evaluates prompt against two regex sets:
      debugFixRegex  = /\b(fix|debug|broken|failing|why.*not working)\b/i
      editContentRegex = /\b(rewrite|update the|change the|modify)\b/i
    → if debugFixRegex matches: prepend ROOT CAUSE template to instructions
    → elif editContentRegex matches: prepend EDIT CONSTRAINT template
    → (mutually exclusive — debug/fix takes priority)
    → continue to quorum instructions check
```

### Feature 4: Root Cause Quorum Vote Flow

```
solve-diagnose.md Step 0d: debt loaded
solve-diagnose.md Step 0e: hypothesis violations measured
    → Step 0f: Claude forms root cause hypothesis
    → if no debt and no violations: skip
    → quorum preflight: node nf-bin/quorum-preflight.cjs --all
    → dispatch $DISPATCH_LIST as nf-quorum-slot-worker Tasks
    → synthesize votes → $ROOT_CAUSE_VERDICT
    → output_contract JSON includes root_cause_verdict field
    → Step 1: diagnostic sweep runs with hypothesis validated/contested
```

---

## Integration Dependencies

```
Feature 2 (approach gate) → Feature 6 (scope guard)
    quick.md writes .claude/scope-contract.json
    nf-scope-guard.js reads it — is a strict no-op if contract absent

Feature 3 (root cause template) — standalone, nf-prompt.js only
Feature 5 (constraint injection) — standalone, nf-prompt.js only
Feature 1 (state injection)     — standalone, nf-prompt.js only
Feature 4 (root cause vote)     — standalone, solve-diagnose.md only
```

No circular dependencies. Features 1, 3, and 5 are co-located additions to `nf-prompt.js`. Features 2 and 6 are linked but the link is fail-open (guard is no-op without contract).

---

## Suggested Build Order

| Order | Feature | Files Changed | Dependency | Rationale |
|-------|---------|---------------|------------|-----------|
| 1 | Feature 3: Root cause template injection | `nf-prompt.js` | None | Standalone, simplest nf-prompt.js addition; validates injection pattern before batching more |
| 2 | Feature 5: Constraint injection | `nf-prompt.js` | None | Same file as Feature 3; add in same change to minimize install sync ops |
| 3 | Feature 1: Session state injection | `nf-prompt.js` | None | Slightly heavier (file read + flag write); same file — batch all 3 nf-prompt.js changes into one PR |
| 4 | Feature 4: Root cause quorum vote | `solve-diagnose.md` | None | Isolated workflow document; no hook involvement; validate quorum vote pattern in simpler context first |
| 5 | Feature 2: Approach gate | `core/workflows/quick.md` | None (Feature 6 needs this first) | Adds Step 0 + scope contract write; must ship before Feature 6 is testable |
| 6 | Feature 6: Branch scope guard | `nf-scope-guard.js` + `bin/install.js` | Feature 2 | New hook creation; requires Feature 2 to write contract for non-trivial test coverage |

**Batching recommendation:** Features 1, 3, and 5 all modify only `nf-prompt.js`. Implement them in a single change. One `cp hooks/nf-prompt.js hooks/dist/ && node bin/install.js --claude --global` covers all three. Similarly, Features 2 and 6 are the natural second batch (workflow + new hook).

---

## Anti-Patterns

### Anti-Pattern 1: Early-Exit Priority Collision

**What people do:** Add new injections AFTER the quorum instructions block, thinking they will append cleanly.

**Why it's wrong:** `nf-prompt.js` exits via `process.exit(0)` after writing quorum instructions (line ~933). Any code after that does not run in normal flow. The existing priority chain (circuit breaker, pending task) each call `process.exit(0)` on their own path.

**Do this instead:** Insert new detection blocks BEFORE the `cmdPattern.test(prompt)` check at line 882. Add context by mutating the `instructions` string or prepending to it, not by issuing a separate `process.stdout.write` call.

### Anti-Pattern 2: Blocking Scope Guard

**What people do:** Implement the scope guard as a hard deny (`permissionDecision: "deny"`) to force compliance.

**Why it's wrong:** Out-of-scope writes are sometimes intentional (updating README alongside a hook change). A hard block creates friction that users route around. Advisory warnings preserve intent without breaking valid workflows.

**Do this instead:** Always emit `permissionDecision: "allow"` with a visible advisory in `permissionDecisionReason`. Let Claude decide whether the write is justified.

### Anti-Pattern 3: Skipping Install Sync

**What people do:** Edit `hooks/nf-prompt.js` directly, test locally, and commit without copying to `hooks/dist/`.

**Why it's wrong:** The installer reads from `hooks/dist/`, not `hooks/`. The installed copy at `~/.claude/hooks/` is what actually runs. Without sync, the repo and the running system diverge silently.

**Do this instead:** Every plan that modifies a hook file must include an explicit task: `cp hooks/<name>.js hooks/dist/<name>.js && node bin/install.js --claude --global`.

### Anti-Pattern 4: Approach Gate as Hard Block

**What people do:** Implement the approach gate so `/nf:quick` refuses to proceed until APPROACH/NOT-DOING/SCOPE is present.

**Why it's wrong:** Claude generates the approach declaration inline. If generation fails or the model is context-starved, the entire quick task is blocked. This violates the fail-open principle present throughout all other nForma hooks.

**Do this instead:** The gate re-prompts once if the block is absent; if still absent after re-prompt, log a warning and proceed to Step 1. The approach declaration is informational, not a blocking gate.

---

## Integration Points

### External Boundaries

| Dependency | Used By | Notes |
|------------|---------|-------|
| `.planning/STATE.md` | Feature 1 (state injection) | Parsed for Phase/Status/Last activity; fail-open if missing |
| `.claude/scope-contract.json` | Feature 2 (write) + Feature 6 (read) | Per-branch; written by quick.md Step 0, read by nf-scope-guard.js; no-op if absent |
| `nf-bin/quorum-preflight.cjs` | Feature 4 (root cause vote) | Same preflight already used by quick.md Step 5.7 — no new binary dependency |
| `nf-quorum-slot-worker` subagent | Feature 4 (root cause vote) | Same dispatch pattern as all other quorum votes in the system |

### Internal Boundaries

| Boundary | Communication | Notes |
|----------|---------------|-------|
| `quick.md` → `nf-scope-guard.js` | File write → file read (`.claude/scope-contract.json`) | Async-safe: contract written at task-init (Step 0), guard reads per-tool-call during execution |
| `nf-prompt.js` → `nf-stop.js` | Shared transcript (planning command marker) | Features 1/3/5 must NOT emit `<!-- GSD_DECISION -->` — that marker is exclusively for quorum completion |
| `solve-diagnose.md` → solve orchestrator | `output_contract` JSON | Feature 4 adds `root_cause_verdict` field — orchestrator must treat it as optional (backward-compatible) |

---

## Sources

- Direct inspection of `hooks/nf-prompt.js` (lines 1–955): injection priority chain, additionalContext mechanism, priority exit points, cmdPattern guard at line 882
- Direct inspection of `hooks/nf-circuit-breaker.js` (lines 1–865): PreToolUse hook pattern, fail-open structure, state file conventions
- Direct inspection of `bin/install.js` (lines 2298–2439): hook registration pattern, uninstall pattern, hook event types (UserPromptSubmit, PreToolUse, PostToolUse, Stop, SubagentStop)
- Direct inspection of `core/workflows/quick.md` (lines 1–927): workflow step structure, Step 5.7 quorum dispatch pattern, planner context format
- Direct inspection of `commands/nf/solve-diagnose.md` (lines 1–276): Step 0 block structure, output_contract format, quorum vote opportunity point
- Direct inspection of `hooks/nf-session-start.js` (lines 1–60): `parseStateForReminder()` function for Feature 1 reference
- Direct inspection of `.planning/PROJECT.md` (lines 1–23): v0.40 milestone goals confirming 6 features

---
*Architecture research for: nForma v0.40 hook and workflow pipeline extension*
*Researched: 2026-03-19*
