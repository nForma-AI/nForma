# Architecture

**Analysis Date:** 2026-02-20

## Pattern Overview

**Overall:** Multi-agent orchestration system with specialized Claude agents executing context-aware workflows through prompt-based task decomposition.

**Key Characteristics:**
- Subagent model (11 specialized agents, each with focused responsibility)
- State-driven workflow orchestration via gsd-tools.cjs
- Context engineering through goal-backward methodology
- Atomic commit tracking per task with verification gates
- Two-level hierarchy: orchestrator commands spawning specialized agents

## Layers

**Presentation Layer (Commands):**
- Purpose: User entry points; orchestrate workflows
- Location: `commands/gsd/`
- Contains: ~30 markdown command definitions (plan-phase, execute-phase, map-codebase, etc.)
- Depends on: Workflows, agents, gsd-tools
- Used by: User invokes via `/gsd:command-name`

**Orchestration Layer (Workflows):**
- Purpose: Stateful command execution; spawn agents with proper context
- Location: `get-shit-done/workflows/`
- Contains: Workflow markdown files defining multi-step processes
- Depends on: Agents, gsd-tools, templates, references
- Used by: Commands and other workflows execute workflow steps

**Agent Layer (Specialists):**
- Purpose: Execute focused tasks; produce deliverables
- Location: `agents/`
- Contains: 11 agent markdown files (gsd-planner.md, gsd-executor.md, etc.)
- Depends on: Templates, references, codebase patterns
- Used by: Spawned by workflows with `Task()` calls

**Tools & References Layer:**
- Purpose: Shared patterns, decision logic, CLI utilities
- Location: `get-shit-done/bin/gsd-tools.cjs`, `get-shit-done/references/`, `get-shit-done/templates/`
- Contains: State management utilities, verification patterns, templates
- Depends on: Project structure (NODE.js, file I/O)
- Used by: All orchestration and workflow layers

**Installation & Integration Layer:**
- Purpose: Install GSD system into user's Claude/OpenCode/Gemini environment
- Location: `bin/install.js`
- Contains: Multi-runtime installer supporting Claude, OpenCode, Gemini
- Depends on: Package.json versioning
- Used by: `npx get-shit-done-cc@latest`

## Data Flow

**Command Invocation → Workflow Execution:**

1. User invokes `/gsd:plan-phase 1`
2. Command file (`commands/gsd/plan-phase.md`) parsed by orchestrator
3. Orchestrator loads context via `gsd-tools init plan-phase`
4. Workflow (`get-shit-done/workflows/plan-phase.md`) executes sequential steps
5. Steps spawn agents using `Task()` with proper model selection
6. Agent produces artifacts (PLAN.md, SUMMARY.md, etc.)
7. Workflow collects results, updates state, returns to user

**Project State Management:**

```
User starts session
    ↓
Read STATE.md (project position, decisions, blockers)
    ↓
Execute workflow (plan, execute, verify, etc.)
    ↓
Update STATE.md with new position, metrics, decisions
    ↓
Commit planning docs (if enabled)
    ↓
Session ends with clear resumption point
```

**Planning → Execution → Verification Flow:**

```
ROADMAP.md (goals + requirements)
    ↓
/gsd:plan-phase
    → gsd-phase-researcher (RESEARCH.md) [optional]
    → gsd-planner (PLAN.md files) [decompose into tasks]
    → gsd-plan-checker (verifies plan quality) [iteration loop]
    ↓
/gsd:execute-phase
    → gsd-executor (SUMMARY.md per plan)
    → Creates atomic commits per task
    ↓
/gsd:verify-work
    → gsd-verifier (VERIFICATION.md)
    → Goal-backward check: does codebase deliver phase goal?
    → If gaps: feed to /gsd:plan-phase --gaps
```

**State Management:**

Project state lives in `.planning/STATE.md` — read first in every workflow:
- Current phase and plan position
- Performance metrics (velocity, duration trends)
- Accumulated decisions and blockers
- Session continuity (where to resume)

Updated after every significant action (plan completion, execution, verification).

## Key Abstractions

**Agents as Specializations:**

Each agent is a specialized Claude instance with:
- Specific responsibility (planner, executor, verifier, etc.)
- Appropriate model profile (opus for complex, sonnet for balanced, haiku for focused)
- Tool access scoped to necessity
- Documentation of role, process, and output format

Examples: `gsd-planner.md`, `gsd-executor.md`, `gsd-codebase-mapper.md`

**Goal-Backward Methodology:**

Core abstraction used throughout:
- Forward: "What should we build?" → task lists
- Backward: "What must be TRUE for goal achievement?" → success criteria

Applied at phase level (ROADMAP.md success criteria), task level (must_haves in PLAN.md), and verification level (VERIFICATION.md goal-backward checks in `gsd-verifier.md`).

**Wave-Based Parallel Execution:**

Plans grouped into execution waves based on dependencies:
- Wave 1: Plans with no dependencies
- Wave 2: Plans depending on Wave 1 completion
- Each wave executes in parallel; orchestrator collects results

Defined in PLAN.md frontmatter: `wave: N`, `depends_on: ["01-01", "01-02"]`

**Must-Haves Verification:**

Three-level verification structure in `gsd-verifier.md`:
- Truths: Observable behaviors that must be true
- Artifacts: Files that must exist with real implementation
- Key links: Critical connections between artifacts

Enables goal-backward verification: start from what the phase SHOULD deliver, verify it exists.

## Entry Points

**Installation Entry:**
- Location: `bin/install.js`
- Triggers: `npx get-shit-done-cc@latest`
- Responsibilities: Detect runtime (Claude/OpenCode/Gemini), detect scope (global/local), install hooks and commands

**CLI Entry Points (in `.claude/`, `.opencode/`, `.gemini/`):**
- `/gsd:help` - Show available commands
- `/gsd:new-project` - Initialize project (roadmap, state, structure)
- `/gsd:plan-phase` - Create executable plans for a phase
- `/gsd:execute-phase` - Execute phase plans with wave-based parallelization
- `/gsd:map-codebase` - Analyze codebase (tech stack, architecture, conventions, concerns)
- `/gsd:verify-work` - Goal-backward verification of phase completion

**Workflow Entry Points:**
- Invoked by commands, sometimes by agents
- Examples: `plan-phase.md`, `execute-phase.md`, `map-codebase.md`
- Each workflow orchestrates agents and state updates

## Error Handling

**Strategy:** Fail-fast with clear guidance; enable recovery and continuation.

**Patterns:**

1. **Validation Gates:**
   - Commands validate input early (phase exists, directory structure intact)
   - If invalid: clear error message with next steps
   - Example: "Phase 5 not found. Available phases: 1-4. Run `/gsd:new-project` to create."

2. **Graceful Degradation:**
   - Missing CONTEXT.md → Continue without user decisions (gsd-plan-checker will flag)
   - Missing RESEARCH.md → Ask user: skip research, replan, or abort
   - Verification failures → /gsd:plan-phase --gaps for closure plans

3. **State Recovery:**
   - STATE.md preserves exact position (phase, plan, status)
   - Commits tagged with plan name enable resume from exact point
   - `.continue-here.md` files capture incomplete work

4. **Atomic Commits:**
   - Each plan task → single commit (author: gsd-executor)
   - Enables rollback per task
   - SUMMARY.md tracks commit hashes for verification

## Cross-Cutting Concerns

**Logging:** Structured output via gsd-statusline.js hook + task descriptions in SUMMARY.md

**Validation:**
- Plan structure validation in `gsd-plan-checker.md`
- Codebase delivery validation in `gsd-verifier.md`
- Consistency checking via `gsd-tools validate`

**Authentication:** None — GSD is local-only, no external auth required

**Context Management:**
- Goal-backward thinking applied at phase → plan → task levels
- @-references in plans enable precise file linking
- Context engineering via must_haves captures what phase MUST deliver

---

*Architecture analysis: 2026-02-20*
