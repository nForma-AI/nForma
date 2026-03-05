<purpose>
Guided project manager hub: displays project dashboard, provides categorized menu for all QGSD capabilities, and routes to appropriate actions. Backward compatible: --config flag skips hub and goes directly to workflow settings.
</purpose>

<required_reading>
Read all files referenced by the invoking prompt's execution_context before starting.
</required_reading>

<process>

<step name="flag_check">
Check if `--config` flag is present in the user's input.

If `--config` is present: skip directly to the `config_flow` step (the original 6-question settings). This preserves backward compatibility for users who want to jump straight to configuration.
</step>

<step name="init_hub">
Load project state using the same gsd-tools calls as `progress.md`:

```bash
INIT=$(node ~/.claude/qgsd/bin/gsd-tools.cjs init progress)
```

Extract from init JSON: `project_exists`, `roadmap_exists`, `state_exists`, `phases`, `current_phase`, `next_phase`, `milestone_version`, `completed_count`, `phase_count`, `paused_at`.

If `project_exists` is false: go to the `no_project` step.

Also load:

```bash
ROADMAP=$(node ~/.claude/qgsd/bin/gsd-tools.cjs roadmap analyze)
STATE=$(node ~/.claude/qgsd/bin/gsd-tools.cjs state-snapshot)
PROGRESS_BAR=$(node ~/.claude/qgsd/bin/gsd-tools.cjs progress bar --raw)
CONFIG=$(cat .planning/config.json)
```

Extract from CONFIG:
- `model_profile` (default: "balanced")
- `workflow.research` (default: true)
- `workflow.plan_check` (default: true)
- `workflow.verifier` (default: true)
- `workflow.auto_advance` (default: false)
- `git.branching_strategy` (default: "none")

Extract from STATE snapshot:
- Pending todo count
- Active debug session count (from `ls .planning/debug/*.md 2>/dev/null | grep -v resolved | wc -l`)
- Quick task count (from STATE.md quick tasks table row count)

Extract from ROADMAP analysis:
- Current phase number, name, and status
- Total phase count
- Milestone version and name
</step>

<step name="dashboard">
Display the project dashboard. Format EXACTLY as:

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 QGSD ► PROJECT HUB
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Project: {name from PROJECT.md or INIT}
Milestone: {version} — {name}
Progress: {PROGRESS_BAR}
Profile: {model_profile from config} | Mode: {yolo/interactive from config}

◆ Status
  Phase {N}/{total}: {phase-name} [{status: planned/in-progress/complete}]
  Quick tasks: {count from STATE.md quick tasks table}
  Pending todos: {count from state-snapshot}
  Active debug: {count from ls .planning/debug/*.md minus resolved}

◆ Configuration
  Research: {On/Off} | Plan Check: {On/Off} | Verifier: {On/Off}
  Auto-advance: {On/Off} | Branching: {none/phase/milestone}
  Project profile: {web/mobile/api/...} | Baselines: {count} active
```

Then proceed to the `main_menu` step.
</step>

<step name="no_project">
If `project_exists` is false, display:

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 QGSD ► PROJECT HUB
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

No project found. Run /nf:new-project to get started.
```

Exit. Do not proceed to the main menu.
</step>

<step name="main_menu">
Present via AskUserQuestion (single-select):

```
AskUserQuestion([
  {
    question: "What would you like to do?",
    header: "Hub",
    multiSelect: false,
    options: [
      { label: "Continue Working", description: "Route to next action based on project state" },
      { label: "Project Management", description: "Milestones, phases, todos, debug sessions" },
      { label: "Configuration", description: "Workflow settings, project profile, baselines" },
      { label: "Quick Task", description: "Run a quick ad-hoc task (/nf:quick)" }
    ]
  }
])
```

Route based on selection:
- "Continue Working" -> go to step `continue_working`
- "Project Management" -> go to step `project_management`
- "Configuration" -> go to step `configuration`
- "Quick Task" -> go to step `quick_task`
</step>

<step name="continue_working">
Apply the SAME routing logic as `/nf:progress` step "route". This is a restatement of the routing algorithm (not a delegation to the progress command, since we are already in a workflow).

**Step 1: Count plans, summaries, and UAT files in the current phase directory:**

```bash
ls -1 .planning/phases/[current-phase-dir]/*-PLAN.md 2>/dev/null | wc -l
ls -1 .planning/phases/[current-phase-dir]/*-SUMMARY.md 2>/dev/null | wc -l
```

**Step 2: Check for diagnosed UAT gaps:**

```bash
grep -l "status: diagnosed" .planning/phases/[current-phase-dir]/*-UAT.md 2>/dev/null
```

**Step 3: Route based on counts:**

| Condition | Route |
|-----------|-------|
| uat_with_gaps > 0 | Show: UAT gaps found, recommend `/nf:plan-phase {phase} --gaps` |
| summaries < plans | Show: Unexecuted plan exists, recommend `/nf:execute-phase {phase}` |
| summaries = plans AND plans > 0 | Phase complete. Check if more phases remain -> recommend next phase. If all complete -> recommend `/nf:complete-milestone` |
| plans = 0 | Phase not planned. Check for CONTEXT.md -> recommend `/nf:plan-phase` or `/nf:discuss-phase` |
| No ROADMAP.md but PROJECT.md exists | Between milestones -> recommend `/nf:new-milestone` |

**Display format for recommendations:**

For unexecuted plans (summaries < plans):
```
---

## Next Up

**{phase}-{plan}: [Plan Name]** -- [objective summary from PLAN.md]

`/nf:execute-phase {phase}`

<sub>/clear first -- fresh context window</sub>

---
```

For UAT gaps:
```
---

## UAT Gaps Found

**{phase_num}-UAT.md** has {N} gaps requiring fixes.

`/nf:plan-phase {phase} --gaps`

<sub>/clear first -- fresh context window</sub>

---
```

For phase not planned (CONTEXT.md exists):
```
---

## Next Up

**Phase {N}: {Name}** -- {Goal from ROADMAP.md}
Context gathered, ready to plan

`/nf:plan-phase {phase-number}`

<sub>/clear first -- fresh context window</sub>

---
```

For phase not planned (no CONTEXT.md):
```
---

## Next Up

**Phase {N}: {Name}** -- {Goal from ROADMAP.md}

`/nf:discuss-phase {phase}` -- gather context and clarify approach

<sub>/clear first -- fresh context window</sub>

**Also available:**
- `/nf:plan-phase {phase}` -- skip discussion, plan directly
- `/nf:list-phase-assumptions {phase}` -- see Claude's assumptions

---
```

For phase complete, more phases remain:
```
---

## Phase {Z} Complete

## Next Up

**Phase {Z+1}: {Name}** -- {Goal from ROADMAP.md}

`/nf:discuss-phase {Z+1}` -- gather context and clarify approach

<sub>/clear first -- fresh context window</sub>

**Also available:**
- `/nf:plan-phase {Z+1}` -- skip discussion, plan directly
- `/nf:verify-work {Z}` -- user acceptance test before continuing

---
```

For milestone complete:
```
---

## Milestone Complete

All {N} phases finished!

## Next Up

**Complete Milestone** -- archive and prepare for next

`/nf:complete-milestone`

<sub>/clear first -- fresh context window</sub>

**Also available:**
- `/nf:verify-work` -- user acceptance test before completing milestone

---
```

For between milestones (no ROADMAP.md):
```
---

## Milestone Complete

Ready to plan the next milestone.

## Next Up

**Start Next Milestone** -- questioning, research, requirements, roadmap

`/nf:new-milestone`

<sub>/clear first -- fresh context window</sub>

---
```
</step>

<step name="project_management">
Second-level menu via AskUserQuestion:

```
AskUserQuestion([
  {
    question: "Project management:",
    header: "Manage",
    multiSelect: false,
    options: [
      { label: "Phase Planning", description: "Discuss, plan, or execute a phase" },
      { label: "Milestone", description: "New milestone, complete, audit" },
      { label: "Todos & Debug", description: "Check todos, active debug sessions" },
      { label: "Roadmap", description: "Add, insert, or remove phases" }
    ]
  }
])
```

For each sub-option, display the relevant commands with brief descriptions:

**Phase Planning:**

Show current phase info from dashboard data. List available commands:

```
Phase {N}/{total}: {phase-name} [{status}]

Available commands:
- `/nf:discuss-phase {N}` -- gather context and clarify approach
- `/nf:plan-phase {N}` -- create detailed execution plan
- `/nf:execute-phase {N}` -- execute all plans in phase
- `/nf:list-phase-assumptions {N}` -- see Claude's intended approach
```

**Milestone:**

List available commands:

```
Available commands:
- `/nf:new-milestone` -- start new milestone cycle
- `/nf:complete-milestone` -- archive and prepare for next
- `/nf:audit-milestone` -- audit completion against intent
```

**Todos & Debug:**

List available commands:

```
Pending todos: {count} | Active debug: {count}

Available commands:
- `/nf:check-todos` -- review and work on pending todos
- `/nf:add-todo` -- capture idea or task from conversation
- `/nf:debug` -- start or resume a debug session
```

**Roadmap:**

List available commands:

```
Available commands:
- `/nf:add-phase "description"` -- add phase to end
- `/nf:insert-phase N "description"` -- insert urgent work
- `/nf:remove-phase N` -- remove unstarted phase
```
</step>

<step name="configuration">
Second-level menu via AskUserQuestion:

```
AskUserQuestion([
  {
    question: "Configuration:",
    header: "Config",
    multiSelect: false,
    options: [
      { label: "Workflow Settings", description: "Model profile, research, plan check, verifier, auto-advance, branching" },
      { label: "Project Profile & Baselines", description: "Change project type, manage baseline requirements" },
      { label: "Quorum Agents", description: "MCP agent status and configuration" }
    ]
  }
])
```

Route based on selection:
- "Workflow Settings" -> go to step `config_flow`
- "Project Profile & Baselines" -> go to step `profile_baselines`
- "Quorum Agents" -> display:

```
Quorum agent management:
- `/nf:mcp-status` -- check agent health and availability
- `/nf:mcp-setup` -- configure MCP agent connections
```
</step>

<step name="profile_baselines">
This step manages the project profile and baseline requirements.

**1. Read current profile from `.planning/PROJECT.md`:**

```bash
grep -i 'Profile:' .planning/PROJECT.md 2>/dev/null || echo "Profile: unknown"
```

If not found, default to "unknown".

**2. Read baseline requirements status from `.planning/REQUIREMENTS.md`:**

```bash
grep -c '^\- \[x\]' .planning/REQUIREMENTS.md 2>/dev/null || echo "0"
grep -c '^\- \[ \] ~~' .planning/REQUIREMENTS.md 2>/dev/null || echo "0"
```

**3. Display current state:**

```
Current profile: {profile} ({N} baseline requirements active, {M} deselected)
```

**4. Present options via AskUserQuestion:**

```
AskUserQuestion([
  {
    question: "What would you like to change?",
    header: "Baselines",
    multiSelect: false,
    options: [
      { label: "Change project profile", description: "Switch between web/mobile/desktop/api/cli/library" },
      { label: "Manage baseline requirements", description: "Toggle individual baselines on/off" },
      { label: "Back to hub", description: "Return to main menu" }
    ]
  }
])
```

**5. If "Change project profile":**

Show profile picker via AskUserQuestion:

```
AskUserQuestion([
  {
    question: "Select project profile:",
    header: "Profile",
    multiSelect: false,
    options: [
      { label: "Web Application", description: "Browser-based app (React, Vue, Angular, etc.)" },
      { label: "Mobile Application", description: "iOS/Android app (React Native, Flutter, Swift, Kotlin)" },
      { label: "Desktop Application", description: "Native desktop app (Electron, Tauri, Qt)" },
      { label: "API Service", description: "Backend API (REST, GraphQL, gRPC)" },
      { label: "CLI Tool", description: "Command-line interface tool" },
      { label: "Library / Package", description: "Reusable library or npm/pip/crate package" }
    ]
  }
])
```

Map selection to key:
- "Web Application" -> "web"
- "Mobile Application" -> "mobile"
- "Desktop Application" -> "desktop"
- "API Service" -> "api"
- "CLI Tool" -> "cli"
- "Library / Package" -> "library"

Run: `node bin/load-baseline-requirements.cjs --profile <new-key>`

Display how many baselines the new profile includes vs current.

Update PROJECT.md with `Profile: <key>` line (replace existing line or add if missing).

Inform user: "Run `/nf:new-milestone` to regenerate REQUIREMENTS.md with new baselines."

**6. If "Manage baseline requirements":**

Load all baselines for current profile:
```bash
node bin/load-baseline-requirements.cjs --profile <current>
```

For each category, present a multiSelect AskUserQuestion with current selections pre-checked.

Update the `## Baseline Requirements` section in `.planning/REQUIREMENTS.md` based on selections:
- Checked = `- [x] requirement text`
- Unchecked = `- [ ] ~~requirement text~~`

Display summary of changes (how many toggled on/off).

**7. If "Back to hub":** go to step `main_menu`.
</step>

<step name="config_flow">
This is the PRESERVED original 6-question settings form. Reached via `--config` flag or "Configuration" -> "Workflow Settings" menu.

**ensure_and_load_config:**

Ensure config exists and load current state:

```bash
node ~/.claude/qgsd/bin/gsd-tools.cjs config-ensure-section
INIT=$(node ~/.claude/qgsd/bin/gsd-tools.cjs state load)
```

Creates `.planning/config.json` with defaults if missing and loads current config values.

**read_current:**

```bash
cat .planning/config.json
```

Parse current values (default to `true` if not present):
- `workflow.research` — spawn researcher during plan-phase
- `workflow.plan_check` — spawn plan checker during plan-phase
- `workflow.verifier` — spawn verifier during execute-phase
- `model_profile` — which model each agent uses (default: `balanced`)
- `git.branching_strategy` — branching approach (default: `"none"`)

**present_settings:**

Use AskUserQuestion with current values pre-selected:

```
AskUserQuestion([
  {
    question: "Which model profile for agents?",
    header: "Model",
    multiSelect: false,
    options: [
      { label: "Quality", description: "Opus everywhere except verification (highest cost)" },
      { label: "Balanced (Recommended)", description: "Opus for planning, Sonnet for execution/verification" },
      { label: "Budget", description: "Sonnet for writing, Haiku for research/verification (lowest cost)" }
    ]
  },
  {
    question: "Spawn Plan Researcher? (researches domain before planning)",
    header: "Research",
    multiSelect: false,
    options: [
      { label: "Yes", description: "Research phase goals before planning" },
      { label: "No", description: "Skip research, plan directly" }
    ]
  },
  {
    question: "Spawn Plan Checker? (verifies plans before execution)",
    header: "Plan Check",
    multiSelect: false,
    options: [
      { label: "Yes", description: "Verify plans meet phase goals" },
      { label: "No", description: "Skip plan verification" }
    ]
  },
  {
    question: "Spawn Execution Verifier? (verifies phase completion)",
    header: "Verifier",
    multiSelect: false,
    options: [
      { label: "Yes", description: "Verify must-haves after execution" },
      { label: "No", description: "Skip post-execution verification" }
    ]
  },
  {
    question: "Auto-advance pipeline? (discuss → plan → execute automatically)",
    header: "Auto",
    multiSelect: false,
    options: [
      { label: "No (Recommended)", description: "Manual /clear + paste between stages" },
      { label: "Yes", description: "Chain stages via Task() subagents (description= set per agent, same isolation)" }
    ]
  },
  {
    question: "Git branching strategy?",
    header: "Branching",
    multiSelect: false,
    options: [
      { label: "None (Recommended)", description: "Commit directly to current branch" },
      { label: "Per Phase", description: "Create branch for each phase (gsd/phase-{N}-{name})" },
      { label: "Per Milestone", description: "Create branch for entire milestone (gsd/{version}-{name})" }
    ]
  }
])
```

**update_config:**

Merge new settings into existing config.json:

```json
{
  ...existing_config,
  "model_profile": "quality" | "balanced" | "budget",
  "workflow": {
    "research": true/false,
    "plan_check": true/false,
    "verifier": true/false,
    "auto_advance": true/false
  },
  "git": {
    "branching_strategy": "none" | "phase" | "milestone"
  }
}
```

Write updated config to `.planning/config.json`.

**save_as_defaults:**

Ask whether to save these settings as global defaults for future projects:

```
AskUserQuestion([
  {
    question: "Save these as default settings for all new projects?",
    header: "Defaults",
    multiSelect: false,
    options: [
      { label: "Yes", description: "New projects start with these settings (saved to ~/.gsd/defaults.json)" },
      { label: "No", description: "Only apply to this project" }
    ]
  }
])
```

If "Yes": write the same config object (minus project-specific fields like `brave_search`) to `~/.gsd/defaults.json`:

```bash
mkdir -p ~/.gsd
```

Write `~/.gsd/defaults.json` with:
```json
{
  "mode": <current>,
  "depth": <current>,
  "model_profile": <current>,
  "commit_docs": <current>,
  "parallelization": <current>,
  "branching_strategy": <current>,
  "workflow": {
    "research": <current>,
    "plan_check": <current>,
    "verifier": <current>,
    "auto_advance": <current>
  }
}
```

**confirm:**

Display:

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 QGSD ► SETTINGS UPDATED
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

| Setting              | Value |
|----------------------|-------|
| Model Profile        | {quality/balanced/budget} |
| Plan Researcher      | {On/Off} |
| Plan Checker         | {On/Off} |
| Execution Verifier   | {On/Off} |
| Auto-Advance         | {On/Off} |
| Git Branching        | {None/Per Phase/Per Milestone} |
| Saved as Defaults    | {Yes/No} |

These settings apply to future /nf:plan-phase and /nf:execute-phase runs.

Quick commands:
- /nf:set-profile <profile> — switch model profile
- /nf:plan-phase --research — force research
- /nf:plan-phase --skip-research — skip research
- /nf:plan-phase --skip-verify — skip plan check
```
</step>

<step name="quick_task">
Display:

```
To run a quick task, use:

/nf:quick <task description>

Example: /nf:quick "Add rate limiting to the API endpoint"
```
</step>

</process>

<success_criteria>
- [ ] Dashboard displays project name, milestone, progress bar, phase status, config summary
- [ ] Main menu presents 4 categories (Continue Working, Project Management, Configuration, Quick Task)
- [ ] Continue Working applies same routing logic as /nf:progress
- [ ] Project Management sub-menu routes to phase, milestone, todo, debug, and roadmap commands
- [ ] Configuration sub-menu offers Workflow Settings, Project Profile & Baselines, Quorum Agents
- [ ] Workflow Settings runs original 6-question config flow
- [ ] Project Profile & Baselines shows current profile, offers change and baseline management
- [ ] --config flag skips hub and goes directly to 6-question config flow
- [ ] No-project state routes to /nf:new-project
</success_criteria>
