---
phase: quick-152
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - qgsd-core/workflows/settings.md
  - commands/qgsd/settings.md
  - qgsd-core/workflows/help.md
autonomous: true
requirements: [QUICK-152]
formal_artifacts: none

must_haves:
  truths:
    - "Running /qgsd:settings shows a dashboard with project name, milestone, progress bar, current phase status, config summary, and quick task count -- derived from gsd-tools init progress, state-snapshot, and roadmap analyze"
    - "After the dashboard, a 4-option main menu appears: Continue Working, Project Management, Configuration, Quick Task"
    - "Selecting 'Continue Working' applies the same routing logic as /qgsd:progress (Route A/B/C/D/E/F) to recommend the next action"
    - "Selecting 'Project Management' shows a second-level menu with Phase Planning, Milestone, Todos & Debug, and Roadmap sub-options that route to the appropriate /qgsd:* commands"
    - "Selecting 'Configuration' shows a second-level menu with Workflow Settings, Project Profile & Baselines, and Quorum Agents sub-options"
    - "Selecting 'Configuration' -> 'Workflow Settings' runs the original 6-question config flow (model profile, research, plan_check, verifier, auto_advance, git branching)"
    - "Selecting 'Configuration' -> 'Project Profile & Baselines' reads the current profile from PROJECT.md, shows current profile and baseline count, and offers to change profile or manage individual baselines"
    - "Running /qgsd:settings --config skips the hub and jumps directly to the 6-question config flow (backward compatibility)"
    - "When no project exists (no .planning/ directory), the hub shows a minimal dashboard and routes to /qgsd:new-project"
    - "The help.md entry for /qgsd:settings describes the hub functionality with dashboard, menu categories, and --config flag"
  artifacts:
    - path: "qgsd-core/workflows/settings.md"
      provides: "Project hub workflow with dashboard, 4-category main menu, sub-menus, routing logic, and preserved config flow"
      contains: "PROJECT HUB"
      min_lines: 200
    - path: "commands/qgsd/settings.md"
      provides: "Updated command definition with hub description and allowed tools"
      contains: "project manager hub"
    - path: "qgsd-core/workflows/help.md"
      provides: "Updated /qgsd:settings entry describing hub with dashboard and --config flag"
      contains: "--config"
  key_links:
    - from: "qgsd-core/workflows/settings.md"
      to: "gsd-tools.cjs init progress"
      via: "Dashboard loads project state via gsd-tools CLI"
      pattern: "gsd-tools.*init progress"
    - from: "qgsd-core/workflows/settings.md"
      to: "gsd-tools.cjs roadmap analyze"
      via: "Dashboard loads roadmap analysis for phase status"
      pattern: "roadmap analyze"
    - from: "qgsd-core/workflows/settings.md"
      to: "gsd-tools.cjs state-snapshot"
      via: "Dashboard loads state for decisions, blockers, todos"
      pattern: "state-snapshot"
    - from: "qgsd-core/workflows/settings.md"
      to: "bin/load-baseline-requirements.cjs"
      via: "Project Profile & Baselines sub-menu loads baselines for management"
      pattern: "load-baseline-requirements"
    - from: "commands/qgsd/settings.md"
      to: "qgsd-core/workflows/settings.md"
      via: "Command definition routes to settings workflow via execution_context"
      pattern: "settings\\.md"
---

<objective>
Expand `/qgsd:settings` from a flat 6-question config form into a guided project manager hub. The hub displays a state-aware dashboard (project name, milestone, progress, phase status, config summary), then presents a categorized 4-option main menu (Continue Working, Project Management, Configuration, Quick Task) with smart routing based on project state.

Purpose: Create a single entry point for all QGSD capabilities -- combining awareness (what's happening), configuration (how it works), and action routing (what to do next) into one unified hub. Currently `/qgsd:progress` does status + routing and `/qgsd:settings` does config; the hub merges both into a richer experience.

Output: Rewritten `settings.md` workflow, updated `settings.md` command definition, updated `help.md` entry.
</objective>

<execution_context>
@/Users/jonathanborduas/.claude/qgsd/workflows/execute-plan.md
@/Users/jonathanborduas/.claude/qgsd/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@qgsd-core/workflows/settings.md
@qgsd-core/workflows/progress.md
@commands/qgsd/settings.md
@qgsd-core/workflows/help.md
@/Users/jonathanborduas/.claude/plans/unified-stargazing-clarke.md
</context>

<tasks>

<task type="auto">
  <name>Task 1: Rewrite settings.md into project manager hub workflow</name>
  <files>qgsd-core/workflows/settings.md</files>
  <action>
Rewrite `qgsd-core/workflows/settings.md` from a flat config form into a multi-section project manager hub. The workflow is a markdown prompt (not code), using the same XML step structure as the current file and as `progress.md`.

**Structure of the rewritten workflow:**

```
<purpose>
Guided project manager hub: displays project dashboard, provides categorized menu for all QGSD capabilities, and routes to appropriate actions. Backward compatible: --config flag skips hub and goes directly to workflow settings.
</purpose>

<required_reading>
Read all files referenced by the invoking prompt's execution_context before starting.
</required_reading>

<process>
```

**Step 1: flag_check**

Check if `--config` flag is present in the user's input. If yes, skip directly to the `config_flow` step (the original 6-question settings). This preserves backward compatibility.

**Step 2: init_hub**

Load project state. Reuse the same gsd-tools calls as `progress.md`:

```bash
INIT=$(node ~/.claude/qgsd/bin/gsd-tools.cjs init progress)
```

Extract: `project_exists`, `roadmap_exists`, `state_exists`, `phases`, `current_phase`, `next_phase`, `milestone_version`, `completed_count`, `phase_count`, `paused_at`.

If `project_exists` is false: show minimal dashboard (see Step 3 no-project variant) and route to `/qgsd:new-project`. Exit.

Also load:
```bash
ROADMAP=$(node ~/.claude/qgsd/bin/gsd-tools.cjs roadmap analyze)
STATE=$(node ~/.claude/qgsd/bin/gsd-tools.cjs state-snapshot)
PROGRESS_BAR=$(node ~/.claude/qgsd/bin/gsd-tools.cjs progress bar --raw)
CONFIG=$(cat .planning/config.json)
```

**Step 3: dashboard**

Display the dashboard. Format it EXACTLY as:

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

**No-project variant:** If `project_exists` is false, show:

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 QGSD ► PROJECT HUB
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

No project found. Run /qgsd:new-project to get started.
```
Then exit.

**Step 4: main_menu**

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
      { label: "Quick Task", description: "Run a quick ad-hoc task (/qgsd:quick)" }
    ]
  }
])
```

Route based on selection:
- "Continue Working" -> go to step `continue_working`
- "Project Management" -> go to step `project_management`
- "Configuration" -> go to step `configuration`
- "Quick Task" -> go to step `quick_task`

**Step 5: continue_working**

Apply the SAME routing logic as `/qgsd:progress` step "route". This is a restatement of the routing algorithm (not a delegation to the progress command, since we are already in a workflow).

**Step 5.1:** Count plans, summaries, and UAT files in the current phase directory:

```bash
ls -1 .planning/phases/[current-phase-dir]/*-PLAN.md 2>/dev/null | wc -l
ls -1 .planning/phases/[current-phase-dir]/*-SUMMARY.md 2>/dev/null | wc -l
```

**Step 5.2:** Check for diagnosed UAT gaps:

```bash
grep -l "status: diagnosed" .planning/phases/[current-phase-dir]/*-UAT.md 2>/dev/null
```

**Step 5.3:** Route based on counts:

| Condition | Route |
|-----------|-------|
| uat_with_gaps > 0 | Show: UAT gaps found, recommend `/qgsd:plan-phase {phase} --gaps` |
| summaries < plans | Show: Unexecuted plan exists, recommend `/qgsd:execute-phase {phase}` |
| summaries = plans AND plans > 0 | Phase complete. Check if more phases remain -> recommend next phase. If all complete -> recommend `/qgsd:complete-milestone` |
| plans = 0 | Phase not planned. Check for CONTEXT.md -> recommend `/qgsd:plan-phase` or `/qgsd:discuss-phase` |
| No ROADMAP.md but PROJECT.md exists | Between milestones -> recommend `/qgsd:new-milestone` |

Display the recommendation with the command to run. Add `<sub>/clear first -- fresh context window</sub>` after each recommendation.

**Step 6: project_management**

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

- **Phase Planning:** Show current phase info from dashboard data. List available commands:
  - `/qgsd:discuss-phase {N}` -- gather context and clarify approach
  - `/qgsd:plan-phase {N}` -- create detailed execution plan
  - `/qgsd:execute-phase {N}` -- execute all plans in phase
  - `/qgsd:list-phase-assumptions {N}` -- see Claude's intended approach

- **Milestone:** List available commands:
  - `/qgsd:new-milestone` -- start new milestone cycle
  - `/qgsd:complete-milestone` -- archive and prepare for next
  - `/qgsd:audit-milestone` -- audit completion against intent

- **Todos & Debug:** List available commands:
  - `/qgsd:check-todos` -- review and work on pending todos
  - `/qgsd:add-todo` -- capture idea or task from conversation
  - `/qgsd:debug` -- start or resume a debug session

- **Roadmap:** List available commands:
  - `/qgsd:add-phase "description"` -- add phase to end
  - `/qgsd:insert-phase N "description"` -- insert urgent work
  - `/qgsd:remove-phase N` -- remove unstarted phase

**Step 7: configuration**

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
- "Workflow Settings" -> go to step `config_flow` (the original 6-question config)
- "Project Profile & Baselines" -> go to step `profile_baselines`
- "Quorum Agents" -> display: Run `/qgsd:mcp-status` for agent health, or `/qgsd:mcp-setup` to configure

**Step 8: profile_baselines**

This is NEW logic for managing the project profile and baseline requirements.

1. Read current profile from `.planning/PROJECT.md` (grep for `Profile:` or `project_type:` line). If not found, default to "unknown".

2. Read baseline requirements section from `.planning/REQUIREMENTS.md`:
   ```bash
   grep -c '^\- \[x\]' .planning/REQUIREMENTS.md 2>/dev/null || echo "0"
   grep -c '^\- \[ \] ~~' .planning/REQUIREMENTS.md 2>/dev/null || echo "0"
   ```

3. Display current state:
   ```
   Current profile: {profile} ({N} baseline requirements active, {M} deselected)
   ```

4. AskUserQuestion:
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

5. If "Change project profile":
   - Show profile picker (same AskUserQuestion as new-project Step 6.5 -- 6 options: Web Application, Mobile Application, Desktop Application, API Service, CLI Tool, Library / Package)
   - Map selection to key (web/mobile/desktop/api/cli/library)
   - Run: `node bin/load-baseline-requirements.cjs --profile <new-key>`
   - Display how many baselines the new profile includes vs current
   - Update PROJECT.md with `Profile: <key>` line
   - Inform user to run `/qgsd:new-milestone` to regenerate REQUIREMENTS.md with new baselines

6. If "Manage baseline requirements":
   - Load all baselines for current profile: `node bin/load-baseline-requirements.cjs --profile <current>`
   - For each category, present a multiSelect AskUserQuestion with current selections pre-checked
   - Update the `## Baseline Requirements` section in `.planning/REQUIREMENTS.md` based on selections (checked = `- [x]`, unchecked = `- [ ] ~~...~~`)
   - Display summary of changes

7. If "Back to hub": go to step `main_menu`

**Step 9: config_flow** (PRESERVED -- the original 6-question settings form)

This is the EXISTING logic from the current `settings.md`, preserved verbatim. It includes:
1. `ensure_and_load_config` -- ensure config exists, load state
2. `read_current` -- parse current config values
3. `present_settings` -- AskUserQuestion with 6 questions (model profile, research, plan_check, verifier, auto_advance, branching)
4. `update_config` -- merge and write to config.json
5. `save_as_defaults` -- offer to save as global defaults to `~/.gsd/defaults.json`
6. `confirm` -- display settings summary table

Copy the ENTIRE content of steps ensure_and_load_config through confirm from the current settings.md into this step. Do NOT modify or simplify -- preserve the exact AskUserQuestion format, the exact config merge logic, the exact save_as_defaults flow, and the exact confirm display.

**Step 10: quick_task**

Display:
```
To run a quick task, use:

/qgsd:quick <task description>

Example: /qgsd:quick "Add rate limiting to the API endpoint"
```

**success_criteria section:**

```xml
<success_criteria>
- [ ] Dashboard displays project name, milestone, progress bar, phase status, config summary
- [ ] Main menu presents 4 categories (Continue Working, Project Management, Configuration, Quick Task)
- [ ] Continue Working applies same routing logic as /qgsd:progress
- [ ] Project Management sub-menu routes to phase, milestone, todo, debug, and roadmap commands
- [ ] Configuration sub-menu offers Workflow Settings, Project Profile & Baselines, Quorum Agents
- [ ] Workflow Settings runs original 6-question config flow
- [ ] Project Profile & Baselines shows current profile, offers change and baseline management
- [ ] --config flag skips hub and goes directly to 6-question config flow
- [ ] No-project state routes to /qgsd:new-project
</success_criteria>
```

**IMPORTANT formatting notes:**
- Use the same XML structure as the current file (`<purpose>`, `<required_reading>`, `<process>`, `<step name="...">`, `</process>`, `<success_criteria>`)
- Each step should have a descriptive `name` attribute
- AskUserQuestion blocks should use the exact format from the current settings.md (JSON-like pseudo-code in code blocks)
- The dashboard uses box-drawing characters (━) for the header, same as the current settings.md confirm step
  </action>
  <verify>
    1. `grep 'PROJECT HUB' qgsd-core/workflows/settings.md` -- confirms hub branding present.
    2. `grep -c 'AskUserQuestion' qgsd-core/workflows/settings.md` -- at least 5 (main menu, project management, configuration, profile/baselines picker, plus original 6-question set).
    3. `grep -- '--config' qgsd-core/workflows/settings.md` -- confirms backward compat flag check.
    4. `grep 'Continue Working' qgsd-core/workflows/settings.md` -- confirms first main menu option.
    5. `grep 'config_flow' qgsd-core/workflows/settings.md` -- confirms preserved config step reference.
    6. `grep 'gsd-tools.*init progress' qgsd-core/workflows/settings.md` -- confirms dashboard state loading.
    7. `grep 'roadmap analyze' qgsd-core/workflows/settings.md` -- confirms roadmap analysis for routing.
    8. `grep 'state-snapshot' qgsd-core/workflows/settings.md` -- confirms state snapshot loading.
    9. `grep 'load-baseline-requirements' qgsd-core/workflows/settings.md` -- confirms baselines integration.
    10. `grep 'model_profile' qgsd-core/workflows/settings.md` -- confirms original config flow preserved.
    11. `wc -l < qgsd-core/workflows/settings.md` -- at least 200 lines (hub is substantial).
  </verify>
  <done>
    qgsd-core/workflows/settings.md is a project manager hub with: (1) --config flag check for backward compat, (2) dashboard showing project status via gsd-tools, (3) 4-option main menu, (4) Continue Working with progress-style routing logic, (5) Project Management sub-menu routing to phase/milestone/todo/debug/roadmap commands, (6) Configuration sub-menu with Workflow Settings (original 6-question flow preserved verbatim), Project Profile & Baselines (profile change + baseline management), and Quorum Agents routing, (7) Quick Task routing to /qgsd:quick, (8) No-project fallback to /qgsd:new-project.
  </done>
</task>

<task type="auto">
  <name>Task 2: Update command definition and help reference</name>
  <files>commands/qgsd/settings.md, qgsd-core/workflows/help.md</files>
  <action>
**Update `commands/qgsd/settings.md`:**

Replace the current content with an updated command definition reflecting the hub:

```yaml
---
name: qgsd:settings
description: Project manager hub — dashboard, smart routing, and configuration
allowed-tools:
  - Read
  - Write
  - Bash
  - AskUserQuestion
  - Glob
  - Grep
---
```

Update the `<objective>` section:

```xml
<objective>
Guided project manager hub with state-aware dashboard and categorized action menu.

Shows project status (milestone, phase, progress, config) then routes to:
- Continue Working — smart routing based on project state (same as /qgsd:progress)
- Project Management — phases, milestones, todos, debug, roadmap
- Configuration — workflow settings, project profile, baselines, quorum agents
- Quick Task — ad-hoc tasks via /qgsd:quick

Backward compatible: /qgsd:settings --config goes directly to workflow settings (original 6-question config form).
</objective>
```

Update the `<process>` section to reference the hub workflow:

```xml
<process>
**Follow the settings workflow** from `@~/.claude/qgsd/workflows/settings.md`.

The workflow handles all logic including:
1. Flag check (--config for backward compat)
2. Dashboard state loading via gsd-tools
3. Status dashboard display
4. Main menu presentation (4 categories)
5. Sub-menu routing and action execution
6. Original config flow (via --config or Configuration menu)
</process>
```

Add `Glob` and `Grep` to allowed-tools (needed for profile/baseline management in the new hub -- reading PROJECT.md profile, scanning REQUIREMENTS.md baseline sections).

**Update `qgsd-core/workflows/help.md`:**

Find the `/qgsd:settings` entry in the "### Configuration" section (around line 314). Replace the existing entry:

FROM:
```
**`/qgsd:settings`**
Configure workflow toggles and model profile interactively.

- Toggle researcher, plan checker, verifier agents
- Select model profile (quality/balanced/budget)
- Updates `.planning/config.json`

Usage: `/qgsd:settings`
```

TO:
```
**`/qgsd:settings`**
Project manager hub — dashboard, smart routing, and configuration.

- Shows project status dashboard (milestone, phase, progress, config)
- 4-category menu: Continue Working, Project Management, Configuration, Quick Task
- Smart routing recommends next action based on project state
- Manage project profile and baseline requirements
- Configure workflow agents and model profiles

Usage: `/qgsd:settings`
Usage: `/qgsd:settings --config` (skip hub, jump to workflow settings)
```

Do NOT modify any other entries in help.md. Only change the `/qgsd:settings` entry.
  </action>
  <verify>
    1. `grep 'project manager hub' commands/qgsd/settings.md` -- confirms updated description (case-insensitive check with -i).
    2. `grep -- '--config' commands/qgsd/settings.md` -- confirms backward compat mentioned in objective.
    3. `grep 'Glob' commands/qgsd/settings.md` -- confirms Glob added to allowed-tools.
    4. `grep 'Grep' commands/qgsd/settings.md` -- confirms Grep added to allowed-tools.
    5. `grep -- '--config.*workflow settings' qgsd-core/workflows/help.md` -- confirms help entry mentions --config flag.
    6. `grep 'dashboard.*smart routing' qgsd-core/workflows/help.md` -- confirms help entry describes hub (case-insensitive with -i).
    7. `grep -c '/qgsd:settings' qgsd-core/workflows/help.md` -- should be at least 2 (heading + usage lines).
  </verify>
  <done>
    commands/qgsd/settings.md has updated description ("Project manager hub"), updated objective mentioning dashboard + 4-category menu + --config backward compat, updated process referencing hub workflow, and Glob + Grep added to allowed-tools. qgsd-core/workflows/help.md /qgsd:settings entry updated to describe hub functionality with dashboard, menu categories, smart routing, and --config usage.
  </done>
</task>

</tasks>

<verification>
1. `grep 'PROJECT HUB' qgsd-core/workflows/settings.md` -- hub branding in workflow.
2. `grep -c 'AskUserQuestion' qgsd-core/workflows/settings.md` -- at least 5 AskUserQuestion blocks.
3. `grep -- '--config' qgsd-core/workflows/settings.md commands/qgsd/settings.md qgsd-core/workflows/help.md` -- backward compat flag present in all 3 files.
4. `grep 'Continue Working' qgsd-core/workflows/settings.md` -- main menu option 1.
5. `grep 'Project Management' qgsd-core/workflows/settings.md` -- main menu option 2.
6. `grep 'Configuration' qgsd-core/workflows/settings.md` -- main menu option 3.
7. `grep 'Quick Task' qgsd-core/workflows/settings.md` -- main menu option 4.
8. `grep 'model_profile' qgsd-core/workflows/settings.md` -- original config flow preserved.
9. `grep 'save_as_defaults\|global defaults' qgsd-core/workflows/settings.md` -- save-as-defaults flow preserved.
10. `wc -l < qgsd-core/workflows/settings.md` -- at least 200 lines.
</verification>

<success_criteria>
- settings.md is a complete project hub workflow: flag check, dashboard, 4-option main menu, sub-menus, routing logic, preserved 6-question config flow, profile/baselines management, no-project fallback
- --config flag backward compatibility works (skips hub, runs config directly)
- Dashboard uses gsd-tools init progress, roadmap analyze, state-snapshot, progress bar
- Continue Working route uses same logic as /qgsd:progress routing (plan/summary counts, UAT gaps, milestone status)
- Original 6-question config flow preserved verbatim in config_flow step
- Profile & Baselines sub-menu integrates with bin/load-baseline-requirements.cjs
- Command definition updated with hub description, Glob + Grep in allowed-tools
- Help entry updated with hub description and --config usage
</success_criteria>

<output>
After completion, create `.planning/quick/152-expand-qgsd-settings-into-guided-project/152-SUMMARY.md`
</output>
