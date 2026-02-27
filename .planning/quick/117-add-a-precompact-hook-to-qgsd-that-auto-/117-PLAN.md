---
phase: quick-117
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - hooks/qgsd-precompact.js
  - hooks/dist/qgsd-precompact.js
  - bin/install.js
autonomous: true
requirements:
  - PRECOMPACT-01
must_haves:
  truths:
    - "When Claude Code compacts the context, the next session receives STATE.md current position and pending task in additionalContext"
    - "The hook reads .planning/STATE.md and extracts the Current Position section"
    - "If a .claude/pending-task.txt file exists, its content is included in additionalContext"
    - "The hook is registered in ~/.claude/settings.json as a PreCompact hook after install"
    - "The hook fails open on all errors — never crashes or blocks compaction"
  artifacts:
    - path: "hooks/qgsd-precompact.js"
      provides: "PreCompact hook source — reads STATE.md + pending task, injects continuation context"
    - path: "hooks/dist/qgsd-precompact.js"
      provides: "Installed copy for global hook path"
    - path: "bin/install.js"
      provides: "Updated installer that registers and unregisters the PreCompact hook"
  key_links:
    - from: "hooks/qgsd-precompact.js"
      to: ".planning/STATE.md"
      via: "fs.readFileSync on input.cwd path"
      pattern: "STATE\\.md"
    - from: "bin/install.js"
      to: "hooks/dist/qgsd-precompact.js"
      via: "buildHookCommand(targetDir, 'qgsd-precompact.js')"
      pattern: "qgsd-precompact"
---

<objective>
Add a PreCompact hook to QGSD that auto-saves phase state at compaction time and injects a continuation prompt as additionalContext so the compacted session resumes with full awareness of what was in progress.

Purpose: Context compaction is currently a "cold restart" — Claude loses awareness of current phase/plan and pending tasks. This hook makes compaction a seamless continuation event by injecting STATE.md current position + pending task directly into the compacted context window.

Output: hooks/qgsd-precompact.js (hook source), hooks/dist/qgsd-precompact.js (dist copy), updated bin/install.js (registration + unregistration).
</objective>

<execution_context>
@/Users/jonathanborduas/.claude/qgsd/workflows/execute-plan.md
@/Users/jonathanborduas/.claude/qgsd/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@hooks/gsd-context-monitor.js
@hooks/qgsd-prompt.js
@hooks/config-loader.js
</context>

<tasks>

<task type="auto">
  <name>Task 1: Create hooks/qgsd-precompact.js</name>
  <files>hooks/qgsd-precompact.js</files>
  <action>
Create hooks/qgsd-precompact.js following the exact same stdin→stdout pattern as hooks/gsd-context-monitor.js.

The hook:
1. Reads stdin JSON with `input.cwd` to get the project directory.
2. Reads `.planning/STATE.md` from that directory. Extracts the "## Current Position" section (everything from `## Current Position` up to the next `## ` section header). Trim whitespace.
3. Checks for a pending task: reads `.claude/pending-task.txt` if it exists (same path resolution as qgsd-prompt.js's `consumePendingTask` — but does NOT consume/rename it; just reads it). Also checks for `.claude/pending-task-*.txt` files (use `fs.readdirSync` with a filter).
4. Builds the `additionalContext` string:

```
QGSD CONTINUATION CONTEXT (auto-injected at compaction)

## Current Position
{extracted current position section from STATE.md}

{if pending task file(s) found:}
## Pending Task
{contents of pending-task.txt}

## Resume Instructions
You are mid-session on a QGSD project. The context above shows where you were.
- If a PLAN.md is in progress, continue executing from the current plan.
- If a pending task is shown above, execute it next.
- Run `cat .planning/STATE.md` to get full project state if needed.
- All project rules in CLAUDE.md still apply (quorum required for planning commands).
```

5. If STATE.md does not exist or is unreadable, output a minimal message: "QGSD session resumed after compaction. Run `cat .planning/STATE.md` for project state."
6. Always output via `process.stdout.write(JSON.stringify({ hookSpecificOutput: { hookEventName: 'PreCompact', additionalContext: context } }))`.
7. Use try/catch around all operations. On any error, `process.exit(0)` — fail open, never crash.
8. Never write to stdout except the final JSON output (all debug to stderr with `[qgsd-precompact]` prefix).
9. Add module.exports guard at bottom (same pattern as qgsd-prompt.js) for future testability.

File header comment:
```
// hooks/qgsd-precompact.js
// PreCompact hook — injects QGSD session state as additionalContext before context compaction.
// Reads .planning/STATE.md "Current Position" section and any pending task files.
// Output survives compaction and appears in the first message of the compacted context.
// Fails open on all errors — never blocks compaction.
```
  </action>
  <verify>
    node hooks/qgsd-precompact.js <<< '{"cwd":"/Users/jonathanborduas/code/QGSD"}' | node -e "const d=JSON.parse(require('fs').readFileSync('/dev/stdin','utf8')); console.assert(d.hookSpecificOutput.hookEventName==='PreCompact','wrong event'); console.assert(d.hookSpecificOutput.additionalContext.includes('Current Position'),'missing position'); console.log('OK')"
  </verify>
  <done>Running the hook with a valid cwd returns JSON with hookEventName=PreCompact and additionalContext containing the Current Position section from STATE.md.</done>
</task>

<task type="auto">
  <name>Task 2: Copy to dist and register in installer</name>
  <files>hooks/dist/qgsd-precompact.js, bin/install.js</files>
  <action>
Step A — Copy hook to dist:
Copy hooks/qgsd-precompact.js to hooks/dist/qgsd-precompact.js (exact copy).

Step B — Update bin/install.js in three places:

1. REGISTRATION (in the Claude Code install block, after the PostToolUse context-monitor registration around line 1861):

```javascript
// Register QGSD PreCompact hook (phase state injection at compaction time)
if (!settings.hooks.PreCompact) settings.hooks.PreCompact = [];
const hasPreCompactHook = settings.hooks.PreCompact.some(entry =>
  entry.hooks && entry.hooks.some(h => h.command && h.command.includes('qgsd-precompact'))
);
if (!hasPreCompactHook) {
  settings.hooks.PreCompact.push({
    hooks: [{ type: 'command', command: buildHookCommand(targetDir, 'qgsd-precompact.js') }]
  });
  console.log(`  ${green}✓${reset} Configured QGSD PreCompact hook (phase state injection)`);
}
```

2. UNINSTALL (in the uninstall block around line 1171, after the PostToolUse removal):

```javascript
if (settings.hooks && settings.hooks.PreCompact) {
  const before = settings.hooks.PreCompact.length;
  settings.hooks.PreCompact = settings.hooks.PreCompact.filter(entry =>
    !(entry.hooks && entry.hooks.some(h => h.command && h.command.includes('qgsd-precompact')))
  );
  if (settings.hooks.PreCompact.length < before) {
    settingsModified = true;
    console.log(`  ${green}✓${reset} Removed QGSD PreCompact hook`);
  }
  if (settings.hooks.PreCompact.length === 0) delete settings.hooks.PreCompact;
}
```

3. CLEANUP (in cleanupOrphanedHooks function — the function already iterates all hook event types generically so no explicit addition needed, but verify the loop at line ~916 handles arbitrary event type keys. If yes, no change needed. If the function has a hardcoded event type list, add 'PreCompact' to it).

After modifying install.js, run the install to register the new hook:
```bash
cp hooks/qgsd-precompact.js hooks/dist/qgsd-precompact.js
node bin/install.js --claude --global
```
  </action>
  <verify>
    node -e "
      const fs = require('fs'), os = require('os'), path = require('path');
      const s = JSON.parse(fs.readFileSync(path.join(os.homedir(), '.claude', 'settings.json'), 'utf8'));
      const hooks = (s.hooks && s.hooks.PreCompact) || [];
      const found = hooks.some(e => e.hooks && e.hooks.some(h => h.command && h.command.includes('qgsd-precompact')));
      console.assert(found, 'PreCompact hook not found in settings.json');
      console.log('PreCompact hook registered: OK');
    "
  </verify>
  <done>~/.claude/settings.json contains a PreCompact entry pointing to the installed qgsd-precompact.js. Running node bin/install.js --claude --global completes without error and prints "Configured QGSD PreCompact hook".</done>
</task>

</tasks>

<verification>
1. Hook produces valid JSON output: `node hooks/qgsd-precompact.js <<< '{"cwd":"/Users/jonathanborduas/code/QGSD"}' | python3 -c "import sys,json; d=json.load(sys.stdin); print(d['hookSpecificOutput']['hookEventName'])"`
2. additionalContext contains "Current Position" text from STATE.md
3. Hook handles missing STATE.md gracefully: `node hooks/qgsd-precompact.js <<< '{"cwd":"/tmp"}' | python3 -c "import sys,json; d=json.load(sys.stdin); print('ok')"` — exits 0, outputs valid JSON
4. PreCompact hook present in ~/.claude/settings.json after install
5. hooks/dist/qgsd-precompact.js matches hooks/qgsd-precompact.js
6. npm test passes (no regressions)
</verification>

<success_criteria>
- hooks/qgsd-precompact.js and hooks/dist/qgsd-precompact.js exist with correct stdin→stdout architecture
- Running the hook against the QGSD project dir returns JSON with hookEventName=PreCompact and additionalContext containing STATE.md current position
- ~/.claude/settings.json PreCompact array contains the hook entry after `node bin/install.js --claude --global`
- Hook fails silently (exit 0, empty or minimal context) when .planning/STATE.md is absent
- Uninstall path removes the hook entry from settings.json
- npm test suite green (no regressions from install.js edits)
</success_criteria>

<output>
After completion, create `.planning/quick/117-add-a-precompact-hook-to-qgsd-that-auto-/117-SUMMARY.md` with:
- What was built (hook file, dist copy, installer changes)
- Verification result (hook output sample)
- Commit hash
</output>
