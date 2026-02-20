# Codebase Structure

**Analysis Date:** 2026-02-20

## Directory Layout

```
/Users/jonathanborduas/code/QGSD/
├── bin/                        # Installation entry point
│   └── install.js              # Multi-runtime installer script
├── agents/                      # Specialized agent prompt files
│   ├── gsd-planner.md           # Creates executable phase plans
│   ├── gsd-executor.md          # Executes plans with atomic commits
│   ├── gsd-verifier.md          # Goal-backward phase verification
│   ├── gsd-codebase-mapper.md   # Analyzes codebase (tech, arch, quality, concerns)
│   ├── gsd-roadmapper.md        # Creates project roadmaps
│   ├── gsd-plan-checker.md      # Validates plan quality
│   ├── gsd-debugger.md          # Troubleshoots execution failures
│   ├── gsd-phase-researcher.md  # Researches phase implementation
│   ├── gsd-project-researcher.md # Researches project domain
│   ├── gsd-integration-checker.md # Validates external integrations
│   └── [5 other agents]         # Specialized roles
├── commands/                    # User command definitions
│   └── gsd/
│       ├── plan-phase.md        # /gsd:plan-phase command
│       ├── execute-phase.md     # /gsd:execute-phase command
│       ├── map-codebase.md      # /gsd:map-codebase command
│       ├── verify-work.md       # /gsd:verify-work command
│       ├── new-project.md       # /gsd:new-project command
│       ├── [25+ other commands] # Additional workflows
│       └── ...
├── get-shit-done/               # Core GSD system
│   ├── bin/
│   │   ├── gsd-tools.cjs        # CLI utilities (state, model resolution, git, verification)
│   │   └── gsd-tools.test.cjs   # Tests for gsd-tools
│   ├── workflows/               # Multi-step orchestration
│   │   ├── plan-phase.md        # Research → Plan → Verify → Iterate
│   │   ├── execute-phase.md     # Wave-based execution → Summaries → Commits
│   │   ├── map-codebase.md      # Analyze codebase for docs
│   │   ├── verify-phase.md      # Goal-backward verification workflow
│   │   └── [30+ other workflows]
│   ├── templates/               # Pre-filled document templates
│   │   ├── project.md           # PROJECT.md structure
│   │   ├── state.md             # STATE.md structure
│   │   ├── roadmap.md           # ROADMAP.md structure
│   │   ├── phase-prompt.md      # PLAN.md structure
│   │   ├── summary.md           # SUMMARY.md structure
│   │   ├── context.md           # CONTEXT.md (user decisions)
│   │   ├── research.md          # RESEARCH.md (domain research)
│   │   ├── requirements.md      # REQUIREMENTS.md (v1 requirements)
│   │   ├── config.json          # .planning/config.json structure
│   │   └── [10+ other templates]
│   └── references/              # Shared decision frameworks & patterns
│       ├── checkpoints.md       # Checkpoint task patterns
│       ├── tdd.md               # Test-driven execution patterns
│       ├── verification-patterns.md # Goal-backward verification
│       ├── model-profiles.md    # Model selection (quality/balanced/budget)
│       ├── git-integration.md   # Git workflow + atomic commits
│       └── [10+ other references]
├── hooks/                       # Runtime integration hooks
│   ├── gsd-check-update.js      # Check for GSD updates
│   └── gsd-statusline.js        # Status line integration
├── scripts/                     # Build & development
│   └── build-hooks.js           # Compile hooks with esbuild
├── docs/                        # User documentation
│   └── USER-GUIDE.md            # How to use GSD
├── package.json                 # Node.js package manifest
├── package-lock.json            # Dependency lock file
├── README.md                    # Project overview
├── CHANGELOG.md                 # Version history
├── LICENSE                      # MIT license
└── .planning/                   # Example planning directory (not part of package)
    └── codebase/                # Codebase analysis docs (generated)
```

## Directory Purposes

**`agents/`**
- Purpose: Define specialized Claude agent responsibilities
- Contains: 11 markdown agent specifications
- Key files:
  - `gsd-planner.md`: Creates PLAN.md files with task breakdown
  - `gsd-executor.md`: Executes tasks, creates SUMMARY.md, commits atomically
  - `gsd-verifier.md`: Goal-backward verification, creates VERIFICATION.md
  - `gsd-codebase-mapper.md`: Produces STACK.md, INTEGRATIONS.md, ARCHITECTURE.md, STRUCTURE.md, CONVENTIONS.md, TESTING.md, CONCERNS.md
  - `gsd-roadmapper.md`: Creates ROADMAP.md with phases and success criteria

**`commands/gsd/`**
- Purpose: User-facing command definitions
- Contains: Markdown files defining `/gsd:command-name` entries
- Each file includes: name, description, agent assignment, tool access, orchestration logic
- Examples: plan-phase, execute-phase, map-codebase, verify-work, new-project, new-milestone, quick, debug, research-phase
- Patterns: Most commands orchestrate workflows in `get-shit-done/workflows/`

**`get-shit-done/workflows/`**
- Purpose: Stateful, multi-step orchestration processes
- Contains: Workflow markdown files for complex operations
- Execute: Sequential steps, conditional branches, agent spawning
- Examples:
  - `plan-phase.md`: Initialize → Research (optional) → Plan → Verify → Iterate
  - `execute-phase.md`: Load plans → Group into waves → Execute per wave → Collect summaries
  - `verify-phase.md`: Load goal → Verify must-haves exist → Check wiring → Report gaps
- Key pattern: Load context via `gsd-tools init`, execute steps, collect results from spawned agents

**`get-shit-done/templates/`**
- Purpose: Pre-structured document templates
- Contains: Markdown and JSON templates for project artifacts
- Key templates:
  - `project.md`: Project metadata (description, core value, requirements, constraints, decisions)
  - `state.md`: Project state digest (position, metrics, decisions, blockers)
  - `roadmap.md`: Phase structure (goals, requirements mapping, success criteria)
  - `phase-prompt.md`: Executable PLAN.md structure
  - `summary.md`: Execution summary (completed tasks, metrics, artifacts)
  - `context.md`: User decisions from /gsd:discuss-phase
  - `config.json`: GSD configuration (model profiles, feature flags, git settings)

**`get-shit-done/bin/`**
- Purpose: Shared CLI utilities for state and workflow operations
- Contains: gsd-tools.cjs (189KB compiled utility)
- Key commands:
  - `state load` - Load PROJECT.md + STATE.md
  - `resolve-model <agent>` - Get model for agent (quality/balanced/budget)
  - `roadmap get-phase <N>` - Extract phase definition
  - `commit <message> [--files]` - Commit planning docs atomically
  - `verify-summary <path>` - Check SUMMARY.md validity
  - `validate consistency` - Check phase numbering and disk/roadmap sync

**`get-shit-done/references/`**
- Purpose: Shared patterns and decision frameworks
- Contains: Markdown references for consistent implementation
- Key references:
  - `checkpoints.md`: Checkpoint task patterns (human-verify, browser-test)
  - `tdd.md`: Test-driven execution flow
  - `verification-patterns.md`: Three-level verification (truths, artifacts, key_links)
  - `model-profiles.md`: Model selection rationale
  - `ui-brand.md`: UI/UX brand guidelines

**`bin/`**
- Purpose: Installation entry point
- Contains: install.js (63KB)
- Supports: Claude, OpenCode, Gemini runtimes
- Modes: Global (all projects) or local (current project)
- Workflow: Detect runtime → Choose install scope → Install commands and workflows → Write config

## Key File Locations

**Entry Points:**
- `bin/install.js`: Package entry point (`npx get-shit-done-cc`)
- `commands/gsd/help.md`: `/gsd:help` lists all commands
- `commands/gsd/new-project.md`: `/gsd:new-project` initializes project

**Configuration:**
- `package.json`: Version, dependencies, installation script
- `.planning/config.json` (template: `get-shit-done/templates/config.json`): GSD settings (model profiles, commit behavior, features)

**Core Logic:**
- `get-shit-done/bin/gsd-tools.cjs`: State management, model resolution, git operations, verification
- `agents/gsd-planner.md`: Phase decomposition logic
- `agents/gsd-executor.md`: Task execution and atomic commit strategy
- `agents/gsd-verifier.md`: Goal-backward verification algorithm

**Project Structure (in user's working directory):**
- `.planning/PROJECT.md`: Living project context (description, requirements, constraints, decisions)
- `.planning/STATE.md`: Session state digest (position, metrics, blockers)
- `.planning/ROADMAP.md`: Phases with goals, requirements, success criteria
- `.planning/REQUIREMENTS.md`: v1 requirement list (REQ-01, REQ-02, etc.)
- `.planning/phases/01-name/`: Phase 1 directory
  - `01-01-PLAN.md`: Plan 1 (tasks, execution context, must-haves)
  - `01-01-SUMMARY.md`: Execution results (tasks completed, metrics, commit hashes)
  - `01-RESEARCH.md`: Domain research (if applicable)
  - `01-VERIFICATION.md`: Goal-backward verification results
  - `01-CONTEXT.md`: User design decisions
  - `01-UAT.md`: User acceptance tests

## Naming Conventions

**Files:**
- Command definitions: `/gsd:command-name.md` (kebab-case)
- Agent definitions: `gsd-agent-name.md` (kebab-case)
- Workflow files: `workflow-name.md` (kebab-case)
- Project artifacts: `UPPERCASE.md` (ROADMAP.md, PROJECT.md, STATE.md, etc.)
- Plan files: `{phase}-{plan}-PLAN.md` (e.g., `01-01-PLAN.md`, `02-03-PLAN.md`)
- Summary files: `{phase}-{plan}-SUMMARY.md` (e.g., `01-01-SUMMARY.md`)
- Verification files: `{phase}-VERIFICATION.md` (e.g., `01-VERIFICATION.md`)

**Directories:**
- Agent folders: `agents/`
- Command folders: `commands/gsd/`
- Workflow folders: `get-shit-done/workflows/`
- Phase folders: `.planning/phases/{padded_phase}-{slug}/` (e.g., `.planning/phases/01-auth/`, `.planning/phases/02-api-endpoints/`)
- Todo folders: `.planning/todos/{area}/` (pending, completed)

## Where to Add New Code

**New Agent (Specialized Task):**
- Location: `agents/gsd-new-agent-name.md`
- Structure: Copy `agents/gsd-codebase-mapper.md` as template
- Key sections: `<role>`, `<process>`, `<output>`, templates and references
- Register in: `get-shit-done/bin/gsd-tools.cjs` MODEL_PROFILES table (add agent name + model profiles)

**New Command:**
- Location: `commands/gsd/new-command-name.md`
- Structure: See `commands/gsd/plan-phase.md` as template
- Frontmatter: name, description, argument-hint, agent, allowed-tools
- Workflow: Reference orchestration workflow from `get-shit-done/workflows/`
- Context: Typically loads via `gsd-tools init new-command`

**New Workflow:**
- Location: `get-shit-done/workflows/new-workflow-name.md`
- Structure: Multi-step orchestration (initialize, validate, spawn agents, collect results)
- Standard step: Load context via `gsd-tools init <workflow-name>`
- Agent spawning: Use `Task()` with model from gsd-tools resolution

**Shared Templates:**
- Location: `get-shit-done/templates/{artifact-name}.md`
- Use: Referenced by agents/workflows to scaffold user project artifacts
- Format: Include template structure, guidelines, evolution patterns

**New Reference Guide:**
- Location: `get-shit-done/references/new-pattern.md`
- Purpose: Shared decision frameworks, verification patterns, UI/brand guidelines
- Consumed by: Agents and workflows via @-references

**Utilities:**
- Location: `get-shit-done/bin/gsd-tools.cjs`
- Add: New command handling, state operations, or validation logic
- Pattern: Atomic functions, JSON output for orchestration consumption

## Special Directories

**`.planning/` (User Project Directory):**
- Purpose: Project planning state, persisted across sessions
- Generated: Created by `/gsd:new-project`
- Committed: Optional (config.json setting `planning.commit_docs`)
- Key artifacts:
  - PROJECT.md, STATE.md, ROADMAP.md: Core project context
  - phases/ subdirectories: PLAN.md, SUMMARY.md, VERIFICATION.md per phase
  - todos/ subdirectories: Pending and completed todo items
  - research/ subdirectory: Research documents
  - config.json: GSD configuration

**`node_modules/` (After Install):**
- Purpose: Runtime dependencies (if any added)
- Generated: Yes, by npm
- Committed: No
- Current: No dependencies declared in package.json (zero dependencies)

**`.git/` (Version Control):**
- Purpose: GSD system versioning
- Committed: Yes
- User's working directory would have separate .git for project code

## Installation & Distribution

**As NPM Package:**
- Entry: `bin/install.js` (referenced in package.json `bin.get-shit-done-cc`)
- Install destination: `~/.claude/get-shit-done/` (global) or `./.claude/get-shit-done/` (local)
- Includes: `agents/`, `commands/`, `get-shit-done/`, `hooks/`, `scripts/`
- Runtime: Node.js 16.7.0+

**Files Included in Package:**
- `package.json`: files array specifies what's distributed
- Included: bin, commands, get-shit-done, agents, hooks/dist, scripts
- Excluded: docs, .git, node_modules

---

*Structure analysis: 2026-02-20*
