# Roadmap: GSD Brownfield Support

## Overview

Add comprehensive brownfield support to GSD. Users adopting GSD for existing codebases will have a systematic way to capture architectural knowledge before planning begins. A new `/gsd:map-codebase` workflow will produce structured `.planning/codebase/` documents that stay current as plans execute.

## Domain Expertise

None - this is internal GSD development following existing command/workflow/template patterns.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

- [ ] **Phase 1: Templates & Structure** - Create codebase map templates and folder structure
- [ ] **Phase 2: Map Codebase Command** - Build /gsd:map-codebase with parallel Explore agents
- [ ] **Phase 3: Integration** - Wire brownfield support into existing GSD workflows
- [x] **Phase 10: Parallel Phase Execution** - Separate single-plan vs multi-plan execution with intelligent parallelization
- [x] **Phase 11: Parallel-Aware Planning** - Update plan-phase.md to create parallelizable plans when config enables it
- [ ] **Phase 12: Changelog & Update Awareness** - Add changelog generation and /gsd:whats-new for version discovery
- [x] **Phase 13: Dedicated Debug Agent** - Create gsd-debugger agent, refactor /gsd:debug to thin orchestrator
- [x] **Phase 14: Dedicated Researcher Agent** - Create gsd-researcher agent for structured research with baked-in methodology
- [x] **Phase 99: Test Parallel (THROWAWAY)** - Create 3 silly independent files to test parallel execution

## Phase Details

### Phase 1: Templates & Structure
**Goal**: Create templates for all codebase map document types and define the folder structure
**Depends on**: Nothing (first phase)
**Research**: Unlikely (established GSD template patterns)
**Plans**: TBD

Documents to template:
- stack.md (languages, frameworks, dependencies)
- architecture.md (patterns, layers, data flow)
- structure.md (directory layout, key files)
- conventions.md (coding standards, naming)
- testing.md (test setup, patterns)
- integrations.md (external services, APIs)
- concerns.md (tech debt, known issues)

### Phase 2: Map Codebase Command
**Goal**: Build the /gsd:map-codebase slash command with parallel Explore agent workflow
**Depends on**: Phase 1
**Research**: Unlikely (using existing Explore agent patterns, GSD workflow conventions)
**Plans**: TBD

Components:
- Slash command: `commands/gsd/map-codebase.md`
- Workflow: `get-shit-done/workflows/map-codebase.md`
- Parallel Explore agent orchestration
- Output to `.planning/codebase/`

### Phase 3: Integration
**Goal**: Wire brownfield support into existing GSD workflows
**Depends on**: Phase 2
**Research**: Unlikely (modifying existing GSD commands, established patterns)
**Plans**: TBD

Integration points:
- `/gsd:new-project` - detect existing code, offer to map first
- `/gsd:plan-phase` - load relevant codebase context automatically
- Post-execution - update codebase map after plan execution

### Phase 4: Plan-Phase Optimizations
**Goal**: Reduce context usage in /gsd:plan-phase by ~37% through file consolidation and verbosity reduction
**Depends on**: Phase 3
**Research**: Unlikely (internal optimization of existing files)
**Plans**: TBD

Optimization targets:
- Merge `cli-automation.md` into `checkpoints.md` (-15KB)
- Compress `plan-format.md` to reference card (-7KB)
- Trim `scope-estimation.md` verbosity (-6KB)
- Streamline `plan-phase.md` workflow (-9KB)

### Phase 5: TDD Instructions
**Goal**: Add TDD guidance to GSD so Claude uses test-driven development when appropriate and beneficial
**Depends on**: Phase 4
**Research**: Unlikely (established TDD patterns, GSD integration points clear)
**Plans**: 2 plans

Plans:
- [ ] 05-01: TDD Foundation - Create tdd.md reference, add TDD annotation to plan-format.md
- [ ] 05-02: TDD Integration - Update plan-phase.md detection, execute-phase.md execution flow

### Phase 6: Frontmatter System Upgrade

**Goal:** Add YAML frontmatter to SUMMARY.md enabling automatic context assembly via dependency graph
**Depends on:** Phase 5
**Plans:** 2 plans

Plans:
- [ ] 06-01: Frontmatter Schema - Add comprehensive YAML frontmatter to summary.md template with dependency metadata
- [ ] 06-02: Intelligent Selection - Implement frontmatter-based context assembly in plan-phase.md

**Details:**
Transform planning from "Claude guesses which summaries to read" to "System automatically assembles optimal context" by:
- Adding frontmatter with subsystem, requires/provides/affects, tech-stack, key-files, key-decisions
- Scanning all summary frontmatter (fast - first ~25 lines each)
- Building dependency graph to auto-select relevant prior phases
- Extracting context from frontmatter before reading full summaries
- Making context assembly deterministic and optimal

### Phase 7: Backfill Existing Summaries With Frontmatter

**Goal:** Backfill YAML frontmatter with dependency graph metadata to Phase 1-6 historical summaries
**Depends on:** Phase 6
**Plans:** 1 plan

Plans:
- [x] 07-01: Backfill frontmatter to all Phase 1-5 summaries (10 files)

**Details:**
Enable intelligent context assembly for all historical phases by adding consistent frontmatter with subsystem categorization, dependency graph (requires/provides/affects), tech tracking, key decisions, and patterns established.

### Phase 8: Improve Roadmap System

**Goal:** [To be planned]
**Depends on:** Phase 7
**Research:** Unlikely (internal GSD workflow improvements)
**Plans:** TBD

Plans:
- [ ] TBD (run /gsd:plan-phase 8 to break down)

**Details:**
[To be added during planning]

### Phase 9: Integrate Verify-Work

**Goal:** Properly integrate /gsd:verify-work into GSD with workflow delegation, templates, and /gsd:plan-fix command
**Depends on:** Phase 8
**Research:** Unlikely (refactoring contributed command to match GSD patterns)
**Plans:** TBD

Components:
- Refactor `commands/gsd/verify-work.md` to GSD style (workflow delegation)
- Create `workflows/verify-work.md` for UAT logic
- Create `templates/uat-issues.md` for phase-scoped issues format
- Create `commands/gsd/plan-fix.md` for planning fixes from UAT issues
- Update `commands/gsd/progress.md` to offer plan-fix when issues exist
- Update README.md with new commands

**Details:**
Community contribution from OracleGreyBeard. Original command works but doesn't follow GSD patterns (no workflow delegation, inline templates, verbose steps). Refactor to match conventions, then add /gsd:plan-fix to complete the verify → fix loop.

### Phase 10: Parallel Phase Execution

**Goal:** Implement proper parallel phase execution with clean separation between single-plan and multi-plan execution
**Depends on:** Phase 9
**Research:** Unlikely (adapting PR #43 patterns, existing GSD conventions)
**Plans:** 4 plans

Plans:
- [x] 10-01: Rename execute-phase → execute-plan - Rename workflow file, update all 9 references across commands/workflows/templates
- [x] 10-02: Create parallel execution workflow - New `workflows/execute-phase.md` with dependency analysis, parallel spawning, orchestrator commits
- [x] 10-03: Create execute-phase command - New `commands/gsd/execute-phase.md` + parallelization config schema in templates/config.json
- [x] 10-04: Update agent-history schema - Extend to v1.2 with parallel_group, granularity, task_results fields

**Details:**
Structural refactoring to separate concerns:
- `/gsd:execute-plan` executes a single PLAN.md (current behavior, ~1,700 lines)
- `/gsd:execute-phase` executes all plans in a phase with intelligent parallelization (~1,300 lines)

Parallelization features (adapted from PR #43):
- Dependency analysis via `requires`/`provides` frontmatter + `<files>` overlap detection
- Parallel agent spawning for independent plans (respects max_concurrent_agents)
- Orchestrator holds commits until all agents complete
- Merge conflict detection as failsafe
- Configurable via `.planning/config.json` parallelization section

### Phase 11: Parallel-Aware Planning

**Goal:** Update plan-phase.md to create plans optimized for parallel execution when parallelization is enabled
**Depends on:** Phase 10
**Research:** Unlikely (extending existing plan-phase workflow)
**Plans:** 4 plans

Plans:
- [x] 11-01: Update phase-prompt template - Add parallelization frontmatter fields (parallelizable, depends_on, files_exclusive)
- [x] 11-02: Add parallel-aware step to plan-phase workflow - Read config, restructure for vertical slices, document independence
- [x] 11-03: Update execute-phase to use plan frontmatter - Use explicit markers instead of inference, backward compat
- [x] 11-04: Documentation and examples - Update references, add parallel vs sequential planning examples

**Details:**
Current plan-phase.md has sequential execution bias - later plans reference earlier SUMMARY.md, file overlap is acceptable, no independence markers. When parallelization enabled in config.json, planning should:
- Group by vertical slice (feature A, feature B) not workflow stage (setup → implement → test)
- Avoid unnecessary inter-plan dependencies (only reference SUMMARY if genuinely needed)
- Mark explicit file ownership per plan
- Add frontmatter: `parallelizable: true/false`, `depends_on: []`, `files_exclusive: []`

This enables execute-phase to produce more Wave 1 plans (true independence) instead of sequential chains.

### Phase 12: Changelog & Update Awareness

**Goal:** Add changelog generation to publish workflow and `/gsd:whats-new` command for users to discover changes
**Depends on:** Phase 11
**Research:** Unlikely (straightforward command + workflow additions)
**Plans:** 3 plans

Plans:
- [x] 12-01: CHANGELOG.md foundation - Create changelog file, update installer to copy it
- [ ] 12-02: Publish command update - Add changelog generation to gsd-publish-version.md
- [x] 12-03: whats-new command - Create /gsd:whats-new with remote fetch and version comparison

**Wave structure:**
- Wave 1: 12-01 (foundation)
- Wave 2: 12-02, 12-03 (parallel - both depend only on 12-01)

**Details:**
Users adopting GSD need visibility into what changed between versions. The publish workflow generates curated changelog entries (Claude-drafted, Lex-approved). `/gsd:whats-new` fetches from GitHub raw, compares to installed version, and prompts to update if behind.

### Phase 13: Dedicated Debug Agent

**Goal:** Create `gsd-debugger` agent with all debugging expertise baked in, refactor `/gsd:debug` to thin orchestrator
**Depends on:** Phase 12
**Research:** Unlikely (consolidating existing debugging content into agent pattern)
**Plans:** 3 plans

Plans:
- [x] 13-01: Create gsd-debugger agent - Consolidate debugging expertise (990 lines)
- [x] 13-02: Refactor /gsd:debug - Thin orchestrator (149 lines), deprecate workflow
- [x] 13-03: Deprecate reference files - Replace with agent pointers

**Details:**
Created gsd-debugger agent with scientific method, hypothesis testing, 7+ investigation techniques, verification patterns, and debug file protocol. Command reduced from ~2,400 loaded lines to 149-line thin orchestrator.

### Phase 14: Dedicated Researcher Agent

**Goal:** Create `gsd-researcher` agent with research methodology baked in, refactor research commands to spawn specialized agents
**Depends on:** Phase 13
**Research:** Unlikely (applying same agent pattern to research workflows)
**Plans:** 3 plans

Plans:
- [x] 14-01: Create gsd-researcher agent - Consolidate research expertise (902 lines)
- [x] 14-02: Refactor /gsd:research-phase - Thin orchestrator (130 lines), deprecate workflow
- [x] 14-03: Refactor /gsd:research-project - Parallel agent spawning (137 lines), deprecate workflow

**Wave structure:**
- Wave 1: 14-01 (foundation)
- Wave 2: 14-02, 14-03 (parallel - both depend only on 14-01)

Components:
- Create `agents/gsd-researcher.md` with research expertise
- Refactor `commands/gsd/research-phase.md` to spawn gsd-researcher
- Refactor `commands/gsd/research-project.md` to use researcher agents
- Define research modes: ecosystem, feasibility, implementation, comparison

**Details:**
Currently `/gsd:research-phase` does ad-hoc web searches without structure. The gsd-researcher agent brings:
- **Research methodology**: Scoping questions, evaluating sources, synthesizing findings
- **Tool strategy**: When to WebSearch vs WebFetch vs Grep vs Context7
- **Output formats**: Structured findings (feasibility, comparison matrices, API investigations)
- **Evidence quality**: Distinguishing authoritative sources from noise
- **Research modes**:
  - `ecosystem` — Survey landscape (tools, approaches, prior art)
  - `feasibility` — Can we do X? What are blockers?
  - `implementation` — How specifically to implement X?
  - `comparison` — Compare options A vs B vs C

Pattern: Same as gsd-executor/gsd-verifier/gsd-debugger. Agent has expertise, command provides research context and mode.

### Phase 99: Test Parallel (THROWAWAY)

**Goal:** Create 3 independent silly files to test parallel execution - DELETE AFTER TESTING
**Depends on:** Nothing (independent test)
**Research:** No
**Plans:** 3 plans (all parallelizable)

Plans:
- [x] 99-01: Create animal-facts.md - A file with 5 animal facts
- [x] 99-02: Create dad-jokes.md - A file with 5 dad jokes
- [x] 99-03: Create random-numbers.md - A file with 5 random numbers

**Details:**
Each plan touches completely different files, no dependencies, perfect for testing Wave 1 parallel execution.
Files go in: `test-output/` (gitignored throwaway directory)

## Progress

**Execution Order:**
Phases execute in numeric order: 1 → 2 → 3 → 4 → 5 → 6

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Templates & Structure | 3/3 | Complete | 2025-12-17 |
| 2. Map Codebase Command | 2/2 | Complete | 2025-12-17 |
| 3. Integration | 1/1 | Complete | 2025-12-17 |
| 4. Plan-Phase Optimizations | 2/2 | Complete | 2025-12-29 |
| 5. TDD Instructions | 2/2 | Complete | 2025-12-31 |
| 6. Frontmatter System Upgrade | 2/2 | Complete | 2026-01-05 |
| 7. Backfill Existing Summaries | 1/1 | Complete | 2026-01-05 |
| 8. Improve Roadmap System | 1/1 | Complete | 2026-01-05 |
| 9. Integrate Verify-Work | 1/1 | Complete | 2026-01-08 |
| 10. Parallel Phase Execution | 4/4 | Complete | 2026-01-12 |
| 11. Parallel-Aware Planning | 4/4 | Complete | 2026-01-12 |
| 99. Test Parallel (THROWAWAY) | 3/3 | Complete | 2026-01-12 |
| 13. Dedicated Debug Agent | 3/3 | Complete | 2026-01-15 |
| 14. Dedicated Researcher Agent | 3/3 | Complete | 2026-01-15 |
