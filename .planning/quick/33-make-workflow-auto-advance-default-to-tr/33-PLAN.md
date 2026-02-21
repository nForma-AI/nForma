---
phase: quick-33
plan: 33
type: execute
wave: 1
depends_on: []
files_modified:
  - get-shit-done/bin/gsd-tools.cjs
  - get-shit-done/workflows/execute-phase.md
autonomous: true
requirements: [QUICK-33]
must_haves:
  truths:
    - "config-get workflow.auto_advance returns true when no config.json overrides it"
    - "execute-phase checkpoint_handling and offer_next steps treat absent config value as true"
  artifacts:
    - path: "get-shit-done/bin/gsd-tools.cjs"
      provides: "auto_advance default in loadConfig"
      contains: "auto_advance: true"
    - path: "get-shit-done/workflows/execute-phase.md"
      provides: "shell fallback for auto_advance"
      contains: "|| echo \"true\""
  key_links:
    - from: "get-shit-done/bin/gsd-tools.cjs loadConfig defaults"
      to: "config-get workflow.auto_advance"
      via: "auto_advance key in defaults object + returned config object"
      pattern: "auto_advance.*true"
    - from: "get-shit-done/workflows/execute-phase.md"
      to: "AUTO_CFG shell variable"
      via: "|| echo fallback"
      pattern: "echo \"true\""
---

<objective>
Make `workflow.auto_advance` default to `true` so YOLO mode (auto-advance through checkpoints and phase transitions) is on by default without requiring an explicit config entry.

Purpose: Currently `loadConfig` has no `auto_advance` entry in its `defaults` object, so `config-get workflow.auto_advance` returns nothing. The shell fallback `|| echo "false"` then forces YOLO off. The fix adds the default in the source and flips both shell fallbacks to `true`.

Output: Updated `gsd-tools.cjs` (source + installed), updated `execute-phase.md` (source + installed).
</objective>

<execution_context>
@/Users/jonathanborduas/.claude/get-shit-done/workflows/execute-plan.md
@/Users/jonathanborduas/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
</context>

<tasks>

<task type="auto">
  <name>Task 1: Add auto_advance default to loadConfig in gsd-tools.cjs (source + installed)</name>
  <files>
    get-shit-done/bin/gsd-tools.cjs
    ~/.claude/qgsd/bin/gsd-tools.cjs
  </files>
  <action>
In `get-shit-done/bin/gsd-tools.cjs`, make two edits inside `loadConfig()`:

1. In the `defaults` object (line ~176, after `brave_search: false,`), add:
   ```
   auto_advance: true,
   ```

2. In the returned config object (line ~208, after `brave_search: get('brave_search') ?? defaults.brave_search,`), add:
   ```
   auto_advance: get('auto_advance', { section: 'workflow', field: 'auto_advance' }) ?? defaults.auto_advance,
   ```

Then copy the identical changes to `~/.claude/qgsd/bin/gsd-tools.cjs` (disk-only, no git stage for the installed copy — consistent with project convention for installed files).
  </action>
  <verify>
    node /Users/jonathanborduas/code/QGSD/get-shit-done/bin/gsd-tools.cjs config-get workflow.auto_advance 2>/dev/null
    node ~/.claude/qgsd/bin/gsd-tools.cjs config-get workflow.auto_advance 2>/dev/null
    Both should output: true
  </verify>
  <done>Both the source and installed gsd-tools.cjs return `true` for `config-get workflow.auto_advance` when no config.json is present.</done>
</task>

<task type="auto">
  <name>Task 2: Flip shell fallbacks in execute-phase.md from false to true (source + installed)</name>
  <files>
    get-shit-done/workflows/execute-phase.md
    ~/.claude/qgsd/workflows/execute-phase.md
  </files>
  <action>
In `get-shit-done/workflows/execute-phase.md`, change both shell fallback lines for `AUTO_CFG`:

- Line ~227 (checkpoint_handling section):
  `|| echo "false"` → `|| echo "true"`

- Line ~462 (offer_next / auto-advance detection section):
  `|| echo "false"` → `|| echo "true"`

There are exactly two occurrences of `|| echo "false"` in this file associated with `auto_advance`. Change both. Do not touch any other `echo "false"` lines.

Then apply the identical changes to `~/.claude/qgsd/workflows/execute-phase.md` (disk-only, no git stage for the installed copy).
  </action>
  <verify>
    grep -n 'echo "false"' /Users/jonathanborduas/code/QGSD/get-shit-done/workflows/execute-phase.md
    grep -n 'echo "false"' ~/.claude/qgsd/workflows/execute-phase.md
    Both greps should return zero lines matching auto_advance context (the two changed lines now say "true").

    Also confirm:
    grep -n 'auto_advance.*echo' /Users/jonathanborduas/code/QGSD/get-shit-done/workflows/execute-phase.md
    Should show both lines now contain || echo "true".
  </verify>
  <done>Both occurrences of the shell fallback for auto_advance in execute-phase.md (source and installed) read `|| echo "true"`. Auto-advance is now on by default when no config override is present.</done>
</task>

</tasks>

<verification>
End-to-end check:

1. Run `node ~/.claude/qgsd/bin/gsd-tools.cjs config-get workflow.auto_advance` — must output `true`.
2. Run `grep -n 'auto_advance.*echo' ~/.claude/qgsd/workflows/execute-phase.md` — both lines must show `"true"`.
3. Run `grep -n 'auto_advance.*echo' /Users/jonathanborduas/code/QGSD/get-shit-done/workflows/execute-phase.md` — both lines must show `"true"`.
4. Run `grep 'auto_advance' /Users/jonathanborduas/code/QGSD/get-shit-done/bin/gsd-tools.cjs` — must show the default `true` entry and the returned config entry.
</verification>

<success_criteria>
- `config-get workflow.auto_advance` returns `true` from both source and installed gsd-tools.cjs
- Both `AUTO_CFG` shell lines in execute-phase.md (source + installed) fall back to `"true"`
- Source files committed to git; installed files updated on disk only (consistent with project convention)
- No other logic changed
</success_criteria>

<output>
After completion, create `.planning/quick/33-make-workflow-auto-advance-default-to-tr/33-SUMMARY.md`
</output>
