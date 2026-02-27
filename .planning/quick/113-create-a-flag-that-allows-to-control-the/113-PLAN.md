---
phase: quick-113
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - hooks/qgsd-prompt.js
  - hooks/qgsd-stop.js
  - hooks/dist/qgsd-prompt.js
  - hooks/dist/qgsd-stop.js
autonomous: true
requirements: []

must_haves:
  truths:
    - "Running /qgsd:plan-phase --n 3 caps quorum at 3 external slot-workers"
    - "Running /qgsd:quick --n 1 runs self-quorum only (Claude alone), skipping all external slot dispatches"
    - "The stop hook does not block when --n 1 is detected in the command"
    - "The stop hook enforces a ceiling of N-1 external models when --n N (N>1) is detected"
    - "Commands without --n N behave identically to today (maxSize from qgsd.json)"
  artifacts:
    - path: "hooks/qgsd-prompt.js"
      provides: "--n N parsing and maxSize override injection into quorum instructions"
      contains: "parseQuorumSizeFlag"
    - path: "hooks/qgsd-stop.js"
      provides: "Solo mode bypass and N-1 ceiling enforcement from --n N flag"
      contains: "parseQuorumSizeFlag"
    - path: "hooks/dist/qgsd-prompt.js"
      provides: "Synced dist copy for installer"
    - path: "hooks/dist/qgsd-stop.js"
      provides: "Synced dist copy for installer"
  key_links:
    - from: "hooks/qgsd-prompt.js"
      to: "quorum instructions injected into Claude context"
      via: "additionalContext field"
      pattern: "SOLO MODE|maxSize override"
    - from: "hooks/qgsd-stop.js"
      to: "quorum enforcement ceiling"
      via: "parseQuorumSizeFlag on transcript prompt"
      pattern: "soloMode|effectiveMaxSize"
---

<objective>
Add a `--n N` flag to all QGSD slash commands that overrides the quorum size for a single invocation.

- `--n 1` = Claude-only, no external slot-workers dispatched (self-quorum mode)
- `--n 3` = cap at Claude + 2 external models (3 total)
- `--n N` = cap at Claude + N-1 external models

Purpose: Allow the user to control quorum cost/speed on a per-invocation basis without editing qgsd.json.

Output: Modified prompt hook (injects override instructions), modified stop hook (enforces override ceiling or bypasses check for --n 1), synced dist copies.
</objective>

<execution_context>
@/Users/jonathanborduas/.claude/qgsd/workflows/execute-plan.md
@/Users/jonathanborduas/.claude/qgsd/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@hooks/qgsd-prompt.js
@hooks/qgsd-stop.js
@hooks/config-loader.js
</context>

<tasks>

<task type="auto">
  <name>Task 1: Parse --n N flag in qgsd-prompt.js and inject maxSize override into quorum instructions</name>
  <files>hooks/qgsd-prompt.js</files>
  <action>
Add a `parseQuorumSizeFlag(prompt)` helper function that extracts `--n N` from the user prompt string. Returns `N` (integer) or `null` if absent.

```js
function parseQuorumSizeFlag(prompt) {
  const m = prompt.match(/--n\s+(\d+)/);
  if (!m) return null;
  const n = parseInt(m[1], 10);
  return (Number.isInteger(n) && n >= 1) ? n : null;
}
```

In the main handler, call `parseQuorumSizeFlag(prompt)` after reading `prompt`. Store result as `quorumSizeOverride`.

When `quorumSizeOverride !== null`, override `maxSize` in the injected quorum instructions:

**Case `quorumSizeOverride === 1` (solo mode):**
- Prepend to `instructions`:
  ```
  <!-- QGSD_SOLO_MODE -->\nSOLO MODE ACTIVE (--n 1): Self-quorum only. Skip ALL external slot-worker Task dispatches. Claude's vote is the quorum. Write <!-- GSD_DECISION --> in your final output. The Stop hook is informed.\n\n
  ```
- Do NOT include the slot-worker dispatch steps. The solo mode marker `<!-- QGSD_SOLO_MODE -->` signals the stop hook to bypass the external model ceiling check.

**Case `quorumSizeOverride > 1`:**
- In the injected `instructions` string, replace all occurrences of the existing `maxSize` note with:
  ```
  QUORUM SIZE OVERRIDE (--n N): Cap at N total participants (Claude + N-1 external slots).
  ```
- Set `maxSize` local variable to `quorumSizeOverride` before generating `instructions`. This ensures the `minNote` and `stepLines` cap to `quorumSizeOverride - 1` external slots.
- The existing `maxSize` derivation from config is already used as `const maxSize = ...`. Change that block to: `const maxSize = quorumSizeOverride !== null ? quorumSizeOverride : (config.quorum && Number.isInteger(config.quorum.maxSize) && config.quorum.maxSize >= 1 ? config.quorum.maxSize : activeSlots ? activeSlots.length : 4);`

The `<!-- QGSD_SOLO_MODE -->` token in the injected context is detectable by the stop hook via the transcript (it appears in the `additionalContext` field which Claude receives and may reproduce in its output).

Place `parseQuorumSizeFlag` near the top of the file, after the existing helper functions, before the stdin handler.
  </action>
  <verify>
    1. Run: `echo '{"prompt":"/qgsd:quick --n 1","cwd":"/tmp","session_id":"x"}' | node hooks/qgsd-prompt.js`
       Expected: JSON output with `additionalContext` containing `QGSD_SOLO_MODE` and `SOLO MODE ACTIVE`.
    2. Run: `echo '{"prompt":"/qgsd:plan-phase --n 3","cwd":"/tmp","session_id":"x"}' | node hooks/qgsd-prompt.js`
       Expected: JSON output with `additionalContext` containing `QUORUM SIZE OVERRIDE (--n 3)` or a maxSize of 3.
    3. Run: `echo '{"prompt":"/qgsd:quick","cwd":"/tmp","session_id":"x"}' | node hooks/qgsd-prompt.js`
       Expected: JSON output unchanged from current behavior (no override mention).
  </verify>
  <done>
    - `--n 1` injects solo mode marker and no slot-worker steps.
    - `--n N` (N>1) injects quorum instructions capped to N-1 external slots.
    - No `--n` flag = behavior unchanged.
    - `node --check hooks/qgsd-prompt.js` passes (no syntax errors).
  </done>
</task>

<task type="auto">
  <name>Task 2: Enforce --n N override in qgsd-stop.js and sync dist copies</name>
  <files>hooks/qgsd-stop.js, hooks/dist/qgsd-prompt.js, hooks/dist/qgsd-stop.js</files>
  <action>
**Part A — qgsd-stop.js:**

Add the same `parseQuorumSizeFlag(text)` helper to `qgsd-stop.js` (identical implementation). Place it near the other helpers, before `main()`.

In `main()`, after `getCurrentTurnLines` resolves but before `hasQuorumCommand` check, extract the quorum size override from the current turn:

```js
// Extract --n N flag from current-turn user prompt (if present)
function extractPromptText(currentTurnLines) {
  for (const line of currentTurnLines) {
    try {
      const entry = JSON.parse(line);
      if (entry.type !== 'user') continue;
      const tag = extractCommandTag(entry);
      if (tag !== null) return tag;
      const content = entry.message?.content;
      if (typeof content === 'string') return content.slice(0, 300);
      if (Array.isArray(content)) {
        const first = content.find(c => c?.type === 'text');
        return first ? (first.text || '').slice(0, 300) : '';
      }
    } catch { /* skip */ }
  }
  return '';
}
```

After extracting the prompt text, check for solo mode:

```js
const promptText = extractPromptText(currentTurnLines);
const quorumSizeOverride = parseQuorumSizeFlag(promptText);
const soloMode = quorumSizeOverride === 1;
```

**Solo mode bypass:** Insert after `isDecisionTurn` check (GUARD 5) and before the agent pool build:

```js
// GUARD 6: Solo mode (--n 1) — Claude-only quorum, no external models required
if (soloMode) {
  appendConformanceEvent({
    ts: new Date().toISOString(),
    phase: 'DECIDING',
    action: 'quorum_complete',
    slots_available: 0,
    vote_result: 1,
    outcome: 'APPROVE',
    schema_version,
  });
  process.exit(0); // Solo mode: Claude's vote is the quorum — no block
}
```

**maxSize override for N>1:** After the existing `maxSize` derivation line:
```js
const maxSize = (config.quorum && Number.isInteger(config.quorum.maxSize) && config.quorum.maxSize >= 1)
  ? config.quorum.maxSize
  : 5;
```
Replace with:
```js
const maxSize = quorumSizeOverride !== null && quorumSizeOverride > 1
  ? quorumSizeOverride - 1  // --n N means N-1 external models required
  : (config.quorum && Number.isInteger(config.quorum.maxSize) && config.quorum.maxSize >= 1)
    ? config.quorum.maxSize
    : 5;
```

Note: The stop hook's `maxSize` counts external model successes only (Claude's vote is implicit). So `--n 3` means 2 external models required → `maxSize = 2`.

**Part B — Sync dist copies:**

After modifying both hook source files:
```bash
cp hooks/qgsd-prompt.js hooks/dist/qgsd-prompt.js
cp hooks/qgsd-stop.js hooks/dist/qgsd-stop.js
```

Then install the updated hooks:
```bash
node bin/install.js --claude --global
```
  </action>
  <verify>
    1. `node --check hooks/qgsd-stop.js` — no syntax errors.
    2. `node --check hooks/dist/qgsd-stop.js` — no syntax errors.
    3. `node --check hooks/dist/qgsd-prompt.js` — no syntax errors.
    4. Verify dist files match source: `diff hooks/qgsd-stop.js hooks/dist/qgsd-stop.js` → no diff.
    5. Verify install succeeded: `ls -la ~/.claude/hooks/qgsd-stop.js ~/.claude/hooks/qgsd-prompt.js` — recent timestamps.
    6. Smoke test solo mode stop hook:
       Build a minimal fake transcript with `/qgsd:quick --n 1` as the user message and a `gsd-tools.cjs commit` Bash block (to pass isDecisionTurn), but NO slot-worker Task calls. Pipe it to qgsd-stop.js. Expected: exit 0, no `decision:block` output (solo mode bypass fires).
  </verify>
  <done>
    - `--n 1` in user prompt causes stop hook to exit 0 (no block) even with zero external slot-worker calls.
    - `--n N` (N>1) causes stop hook to require N-1 external slot successes instead of config maxSize.
    - No `--n` flag = behavior unchanged.
    - dist files match source files.
    - Installed hooks updated (recent mtime in ~/.claude/hooks/).
  </done>
</task>

</tasks>

<verification>
After both tasks:
1. `node --check hooks/qgsd-prompt.js` passes.
2. `node --check hooks/qgsd-stop.js` passes.
3. `diff hooks/qgsd-prompt.js hooks/dist/qgsd-prompt.js` = no diff.
4. `diff hooks/qgsd-stop.js hooks/dist/qgsd-stop.js` = no diff.
5. Prompt hook with `--n 1` returns solo mode marker in additionalContext.
6. Prompt hook with `--n 3` returns N-capped quorum instructions.
7. Prompt hook with no flag returns unchanged behavior.
8. Stop hook solo mode guard exits clean (no block) when `--n 1` detected.
</verification>

<success_criteria>
- Users can append `--n 1` to any `/qgsd:` planning command to get Claude-only evaluation (zero external models, immediate result, no quorum tax).
- Users can append `--n 3` to cap the quorum at Claude + 2 external models.
- Absence of `--n` flag = existing config-driven behavior, zero regression.
- All modified files pass `node --check` syntax validation.
- Installed hooks at `~/.claude/hooks/` reflect the updated code.
</success_criteria>

<output>
After completion, create `.planning/quick/113-create-a-flag-that-allows-to-control-the/113-SUMMARY.md`
</output>
