---
phase: quick-33
plan: 33
type: execute
wave: 1
depends_on: []
files_modified:
  - get-shit-done/bin/gsd-tools.cjs
  - get-shit-done/workflows/execute-phase.md
  - get-shit-done/workflows/plan-phase.md
  - get-shit-done/workflows/discuss-phase.md
  - get-shit-done/workflows/transition.md
  - get-shit-done/templates/config.json
autonomous: true
requirements: [QUICK-33]
must_haves:
  truths:
    - "config-get workflow.auto_advance returns true when no config.json overrides it"
    - "ALL workflow echo fallbacks for auto_advance return true"
    - "transition.md no longer resets auto_advance to false at milestone boundary"
    - "templates/config.json initializes auto_advance as true"
  artifacts:
    - path: "get-shit-done/bin/gsd-tools.cjs"
      provides: "auto_advance default in loadConfig"
      contains: "auto_advance: true"
    - path: "get-shit-done/workflows/execute-phase.md"
      provides: "shell fallback for auto_advance (2 occurrences)"
      contains: "|| echo \"true\""
    - path: "get-shit-done/workflows/plan-phase.md"
      provides: "shell fallback for auto_advance (1 occurrence)"
      contains: "|| echo \"true\""
    - path: "get-shit-done/workflows/discuss-phase.md"
      provides: "shell fallback for auto_advance (1 occurrence)"
      contains: "|| echo \"true\""
    - path: "get-shit-done/templates/config.json"
      provides: "config template default"
      contains: "\"auto_advance\": true"
---

<objective>
Make `workflow.auto_advance` default to `true` so YOLO mode (auto-advance through checkpoints and phase transitions) is on by default without requiring an explicit config entry.

Full scope (Gemini audit revealed 4 workflow files + config template, not just 2):
1. `gsd-tools.cjs` — add `auto_advance: true` to loadConfig defaults + returned config object
2. `execute-phase.md` — 2× `|| echo "false"` → `|| echo "true"`
3. `plan-phase.md` — 1× `|| echo "false"` → `|| echo "true"`
4. `discuss-phase.md` — 1× `|| echo "false"` → `|| echo "true"`
5. `transition.md` — remove `config-set workflow.auto_advance false` reset line (milestone boundary should not force YOLO off)
6. `templates/config.json` — `"auto_advance": false` → `"auto_advance": true`

All source files committed to git. Installed copies at `~/.claude/qgsd/` updated disk-only (no git stage).
</objective>

<tasks>

<task type="auto">
  <name>Task 1: Add auto_advance default to loadConfig in gsd-tools.cjs (source + installed)</name>
  <files>
    get-shit-done/bin/gsd-tools.cjs
    ~/.claude/qgsd/bin/gsd-tools.cjs
  </files>
  <action>
In `get-shit-done/bin/gsd-tools.cjs`, make two edits inside `loadConfig()`:

1. In the `defaults` object (after `brave_search: false,`), add:
   `auto_advance: true,`

2. In the returned config object (after `brave_search: get('brave_search') ?? defaults.brave_search,`), add:
   `auto_advance: get('auto_advance', { section: 'workflow', field: 'auto_advance' }) ?? defaults.auto_advance,`

Then copy identical changes to `~/.claude/qgsd/bin/gsd-tools.cjs` (disk-only, no git stage).
  </action>
  <verify>
    node ~/.claude/qgsd/bin/gsd-tools.cjs config-get workflow.auto_advance
    Must output: true
  </verify>
  <done>Both source and installed gsd-tools.cjs return `true` for config-get workflow.auto_advance with no config.json present.</done>
</task>

<task type="auto">
  <name>Task 2: Flip all echo "false" fallbacks in workflow files (source + installed)</name>
  <files>
    get-shit-done/workflows/execute-phase.md
    get-shit-done/workflows/plan-phase.md
    get-shit-done/workflows/discuss-phase.md
    ~/.claude/qgsd/workflows/execute-phase.md
    ~/.claude/qgsd/workflows/plan-phase.md
    ~/.claude/qgsd/workflows/discuss-phase.md
  </files>
  <action>
For each of the three source workflow files, change every `|| echo "false"` line associated with `auto_advance` / `AUTO_CFG` to `|| echo "true"`:

- `execute-phase.md`: 2 occurrences (checkpoint_handling section + offer_next section)
- `plan-phase.md`: 1 occurrence (offer_next section)
- `discuss-phase.md`: 1 occurrence (auto_advance step)

Then apply identical changes to each installed copy at `~/.claude/qgsd/workflows/` (disk-only, no git stage).
  </action>
  <verify>
    grep -n 'AUTO_CFG.*echo' get-shit-done/workflows/execute-phase.md
    grep -n 'AUTO_CFG.*echo' get-shit-done/workflows/plan-phase.md
    grep -n 'AUTO_CFG.*echo' get-shit-done/workflows/discuss-phase.md
    All lines must show `|| echo "true"` — zero remaining `|| echo "false"` on AUTO_CFG lines.
  </verify>
  <done>All 4 shell fallback lines across 3 workflow files (source + installed) read `|| echo "true"`.</done>
</task>

<task type="auto">
  <name>Task 3: Remove auto_advance=false reset from transition.md + fix config.json template (source + installed)</name>
  <files>
    get-shit-done/workflows/transition.md
    get-shit-done/templates/config.json
    ~/.claude/qgsd/workflows/transition.md
  </files>
  <action>
1. In `get-shit-done/workflows/transition.md`: find the line:
   `node ~/.claude/qgsd/bin/gsd-tools.cjs config-set workflow.auto_advance false`
   Remove it (along with the "Clear auto-advance" comment above it). Milestone boundary should not disable YOLO.

2. In `get-shit-done/templates/config.json`: change `"auto_advance": false` → `"auto_advance": true`.

3. Copy transition.md change to `~/.claude/qgsd/workflows/transition.md` (disk-only, no git stage).
   templates/config.json has no installed copy — source only.
  </action>
  <verify>
    grep "auto_advance false" get-shit-done/workflows/transition.md → must return nothing
    grep "auto_advance" get-shit-done/templates/config.json → must show true
  </verify>
  <done>transition.md no longer resets auto_advance at milestone boundary. config.json template initializes to true.</done>
</task>

</tasks>

<verification>
1. `node ~/.claude/qgsd/bin/gsd-tools.cjs config-get workflow.auto_advance` → outputs `true`
2. `grep -c 'echo "false"' get-shit-done/workflows/execute-phase.md` → 0 (on AUTO_CFG lines)
3. `grep "auto_advance false" get-shit-done/workflows/transition.md` → no output
4. `grep "auto_advance" get-shit-done/templates/config.json` → shows `true`
</verification>

<success_criteria>
- config-get workflow.auto_advance returns true from installed gsd-tools.cjs with no config.json
- All 4 AUTO_CFG shell fallbacks across 3 workflows → "true"
- transition.md no longer resets at milestone boundary
- config.json template defaults to true
- Source files committed to git; installed files updated disk-only
</success_criteria>

<output>
After completion, create `.planning/quick/33-make-workflow-auto-advance-default-to-tr/33-SUMMARY.md`
</output>
