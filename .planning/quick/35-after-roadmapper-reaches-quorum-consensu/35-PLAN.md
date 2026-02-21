---
phase: quick-35
plan: 35
type: execute
wave: 1
depends_on: []
files_modified:
  - get-shit-done/workflows/new-project.md
  - get-shit-done/workflows/new-milestone.md
autonomous: true
requirements: [QUICK-35]
must_haves:
  truths:
    - "After roadmapper completes and quorum approves, new-project auto-advances to plan-phase 1 as a spawned Task agent (separate context window)"
    - "After roadmapper completes and quorum approves, new-milestone auto-advances to plan-phase [FIRST_PHASE] as a spawned Task agent"
    - "Auto-advance in new-project reads AUTO_CFG from config (not just --auto flag) — YOLO users who did not pass --auto still get auto-advance"
    - "new-project's SlashCommand inline invocation is replaced by Task spawn to prevent orchestrator context bloat"
    - "Both workflows fall back to interactive 'Next Up' prompt when AUTO_CFG is false"
  artifacts:
    - path: "get-shit-done/workflows/new-project.md"
      provides: "auto-advance to plan-phase 1 via Task spawn in Step 9"
      contains: "AUTO_CFG"
    - path: "get-shit-done/workflows/new-milestone.md"
      provides: "auto-advance to plan-phase FIRST_PHASE via Task spawn in Step 11"
      contains: "AUTO_CFG"
  key_links:
    - from: "get-shit-done/workflows/new-project.md"
      to: "get-shit-done/workflows/plan-phase.md"
      via: "Task spawn after roadmap approval"
      pattern: "Task.*plan-phase.*1"
    - from: "get-shit-done/workflows/new-milestone.md"
      to: "get-shit-done/workflows/plan-phase.md"
      via: "Task spawn after milestone roadmap commit"
      pattern: "Task.*plan-phase.*FIRST_PHASE"
---

<objective>
After the roadmapper agent returns `## ROADMAP CREATED` and quorum consensus is reached, automatically proceed to `plan-phase` for the first phase by spawning it as an orchestrator Task agent (separate context window).

Purpose: Two workflows currently stall after roadmap approval and require the user to manually invoke `/qgsd:plan-phase`. With `auto_advance` defaulting to `true` (quick-33), this break in the pipeline is unnecessary friction. Spawning as a Task (not inline) avoids context bloat in the calling orchestrator.

Output:
- `new-project.md` Step 9: Replace `SlashCommand("/qgsd:discuss-phase 1 --auto")` with a `Task` spawn of `plan-phase 1`; also add AUTO_CFG check for non-`--auto` YOLO users
- `new-milestone.md` Step 11: Add AUTO_CFG check + `Task` spawn of `plan-phase [FIRST_PHASE]` after `activity-clear`
- Both source files committed to git; installed copies updated disk-only
</objective>

<execution_context>
@/Users/jonathanborduas/.claude/get-shit-done/workflows/execute-plan.md
@/Users/jonathanborduas/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@get-shit-done/workflows/new-project.md
@get-shit-done/workflows/new-milestone.md
@get-shit-done/workflows/plan-phase.md
</context>

<tasks>

<task type="auto">
  <name>Task 1: Replace SlashCommand with Task spawn and add AUTO_CFG check in new-project.md (source + installed)</name>
  <files>
    get-shit-done/workflows/new-project.md
    ~/.claude/qgsd/workflows/new-project.md
  </files>
  <action>
In `get-shit-done/workflows/new-project.md`, update **Step 9 (Done)** — the section after the completion banner and artifact table.

**Replace** the current auto-mode block:
```
**If auto mode:**

```
╔══════════════════════════════════════════╗
║  AUTO-ADVANCING → DISCUSS PHASE 1        ║
╚══════════════════════════════════════════╝
```

Exit skill and invoke SlashCommand("/qgsd:discuss-phase 1 --auto")

**If interactive mode:**
```

**With** this new auto-advance block that:
1. Reads AUTO_CFG from config (covers both `--auto` flag users AND regular YOLO users with auto_advance=true in config)
2. Spawns plan-phase as a Task (separate context window — avoids bloating the orchestrator)
3. Falls back to interactive "Next Up" prompt when auto-advance is off

```
**Auto-advance check:**

```bash
AUTO_CFG=$(node ~/.claude/qgsd/bin/gsd-tools.cjs config-get workflow.auto_advance 2>/dev/null || echo "true")
FIRST_PHASE=$(node ~/.claude/qgsd/bin/gsd-tools.cjs roadmap get-phase 1 2>/dev/null | jq -r '.phase_number // "1"')
```

**If `--auto` flag present OR `AUTO_CFG` is true:**

Display banner:
```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 GSD ► AUTO-ADVANCING TO PLAN PHASE 1
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Roadmap complete. Spawning plan-phase...
```

```bash
node ~/.claude/qgsd/bin/gsd-tools.cjs activity-set \
  "{\"activity\":\"new_project\",\"sub_activity\":\"plan_phase_1\"}"
```

```
Task(
  prompt="Run /qgsd:plan-phase 1",
  subagent_type="general-purpose",
  description="Plan Phase 1"
)
```

**Handle plan-phase return:**
- **PLANNING COMPLETE** → Display:
  ```
  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   GSD ► PHASE 1 PLANNED ✓
  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  Auto-advance pipeline finished.

  Next: /qgsd:execute-phase 1
  ```
- **Other / error** → Display result, stop chain:
  ```
  Auto-advance stopped: Planning needs review.

  Continue manually:
  /qgsd:plan-phase 1
  ```

```bash
node ~/.claude/qgsd/bin/gsd-tools.cjs activity-clear
```

**If neither `--auto` nor `AUTO_CFG` enabled:**
```
───────────────────────────────────────────────────────────────

## ▶ Next Up

**Phase 1: [Phase Name]** — [Goal from ROADMAP.md]

/qgsd:discuss-phase 1 — gather context and clarify approach

<sub>/clear first → fresh context window</sub>

---

**Also available:**
- /qgsd:plan-phase 1 — skip discussion, plan directly

───────────────────────────────────────────────────────────────
```
```

Then copy the identical changes to `~/.claude/qgsd/workflows/new-project.md` (disk-only, no git stage).

**Important notes:**
- Remove the old `SlashCommand` line entirely — it is replaced by the Task spawn
- The `--auto` flag check is in addition to AUTO_CFG (covers users who passed `--auto` on the command line but have auto_advance=false in config)
- `FIRST_PHASE` lookup uses roadmap tool with fallback to "1" for new projects
  </action>
  <verify>
    grep -n "AUTO_CFG\|Task.*plan-phase\|SlashCommand" get-shit-done/workflows/new-project.md
    Must show: AUTO_CFG present, Task.*plan-phase present, NO SlashCommand lines remaining
  </verify>
  <done>new-project.md Step 9 uses Task spawn for plan-phase auto-advance; SlashCommand removed; AUTO_CFG config check present; source committed to git; installed copy updated disk-only.</done>
</task>

<task type="auto">
  <name>Task 2: Add AUTO_CFG auto-advance block to new-milestone.md Step 11 (source + installed)</name>
  <files>
    get-shit-done/workflows/new-milestone.md
    ~/.claude/qgsd/workflows/new-milestone.md
  </files>
  <action>
In `get-shit-done/workflows/new-milestone.md`, update **Step 11 (Done)** — specifically the section AFTER the `activity-clear` bash block.

The current Step 11 ends with:

```
```bash
node ~/.claude/qgsd/bin/gsd-tools.cjs activity-clear
```
```

**After** the `activity-clear` line, add the following auto-advance block:

```
**Auto-advance check:**

```bash
AUTO_CFG=$(node ~/.claude/qgsd/bin/gsd-tools.cjs config-get workflow.auto_advance 2>/dev/null || echo "true")
FIRST_PHASE=$(node ~/.claude/qgsd/bin/gsd-tools.cjs roadmap list-phases 2>/dev/null | jq -r '.[0].phase_number // empty')
# Fallback: extract first phase number from ROADMAP.md if tool unavailable
if [ -z "$FIRST_PHASE" ]; then
  FIRST_PHASE=$(grep -m1 "^### Phase [0-9]" .planning/ROADMAP.md | grep -o '[0-9]*' | head -1)
fi
```

**If `AUTO_CFG` is true AND `FIRST_PHASE` is set:**

Display banner:
```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 GSD ► AUTO-ADVANCING TO PLAN PHASE ${FIRST_PHASE}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Roadmap complete. Spawning plan-phase...
```

```bash
node ~/.claude/qgsd/bin/gsd-tools.cjs activity-set \
  "{\"activity\":\"new_milestone\",\"sub_activity\":\"plan_phase_${FIRST_PHASE}\"}"
```

```
Task(
  prompt="Run /qgsd:plan-phase ${FIRST_PHASE}",
  subagent_type="general-purpose",
  description="Plan Phase ${FIRST_PHASE}"
)
```

**Handle plan-phase return:**
- **PLANNING COMPLETE** → Display:
  ```
  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   GSD ► PHASE ${FIRST_PHASE} PLANNED ✓
  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  Auto-advance pipeline finished.

  Next: /qgsd:execute-phase ${FIRST_PHASE}
  ```
- **Other / error** → Display result, stop chain:
  ```
  Auto-advance stopped: Planning needs review.

  Continue manually:
  /qgsd:plan-phase ${FIRST_PHASE}
  ```

```bash
node ~/.claude/qgsd/bin/gsd-tools.cjs activity-clear
```

**If `AUTO_CFG` is false OR `FIRST_PHASE` is empty:**

Show existing "Next Up" prompt (already in the Done banner — no change needed to that section).
```

Also update the `<success_criteria>` section at the bottom of `new-milestone.md`: change the last bullet from:
```
- [ ] User knows next step: `/qgsd:discuss-phase [N]`
```
to:
```
- [ ] Auto-advance spawns plan-phase task when AUTO_CFG is true; otherwise user sees `/qgsd:discuss-phase [N]`
```

Then copy the identical changes to `~/.claude/qgsd/workflows/new-milestone.md` (disk-only, no git stage).
  </action>
  <verify>
    grep -n "AUTO_CFG\|Task.*plan-phase\|FIRST_PHASE" get-shit-done/workflows/new-milestone.md
    Must show: AUTO_CFG present, Task.*plan-phase present, FIRST_PHASE lookup present
  </verify>
  <done>new-milestone.md Step 11 has AUTO_CFG check and Task spawn for plan-phase after activity-clear; success_criteria updated; source committed to git; installed copy updated disk-only.</done>
</task>

</tasks>

<verification>
1. `grep -n "SlashCommand" get-shit-done/workflows/new-project.md` → must return nothing (SlashCommand removed)
2. `grep -n "AUTO_CFG" get-shit-done/workflows/new-project.md` → shows AUTO_CFG config read in Step 9
3. `grep -n "Task.*plan-phase" get-shit-done/workflows/new-project.md` → shows Task spawn
4. `grep -n "AUTO_CFG" get-shit-done/workflows/new-milestone.md` → shows AUTO_CFG config read in Step 11
5. `grep -n "Task.*plan-phase" get-shit-done/workflows/new-milestone.md` → shows Task spawn
6. `diff get-shit-done/workflows/new-project.md ~/.claude/qgsd/workflows/new-project.md | head -5` → differences only in whitespace or none (installed matches source)
7. `diff get-shit-done/workflows/new-milestone.md ~/.claude/qgsd/workflows/new-milestone.md | head -5` → installed matches source
</verification>

<success_criteria>
- new-project.md: SlashCommand("/qgsd:discuss-phase 1 --auto") removed; replaced by AUTO_CFG check + Task spawn of plan-phase 1
- new-project.md: AUTO_CFG is read from config so regular YOLO users (without --auto flag) also get auto-advance
- new-milestone.md: AUTO_CFG check + Task spawn of plan-phase added after activity-clear in Step 11
- Both workflows fall back to interactive "Next Up" prompt when AUTO_CFG is false
- Task spawn (not inline invocation) used in both workflows to prevent orchestrator context bloat
- Source files committed to git; installed files (~/.claude/qgsd/workflows/) updated disk-only
</success_criteria>

<output>
After completion, create `.planning/quick/35-after-roadmapper-reaches-quorum-consensu/35-SUMMARY.md`
</output>
