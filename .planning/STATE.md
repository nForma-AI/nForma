# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-03-03 after v0.25 roadmap creation)

**Core value:** Planning decisions are multi-model verified by structural enforcement, not instruction-following -- a Stop hook that reads the transcript makes it impossible for Claude to skip quorum.
**Current focus:** v0.25 Formal Traceability & Coverage -- Phase v0.25-02 complete (all 3 plans done), ready for v0.25-03
**Last shipped:** v0.24 -- Quorum Reliability Hardening (2026-03-03, 5 phases, 17 plans, 12/12 requirements)

## Current Position

Phase: v0.25-02 of 5 (Property Annotations) -- COMPLETE
Plan: 3 of 3 in current phase (3 plans in 2 waves) -- COMPLETE
Status: Phase v0.25-02 done -- all 3 plans complete, ready for v0.25-03 (Traceability Matrix)
Last activity: 2026-03-03 -- v0.25-02-03 complete: extract-annotations.cjs parser covering 23 files, 93 properties, 104 requirement links (ANNOT-04)

Progress: [########            ] 40% v0.25 (2/5 phases done)

## Performance Metrics

**Velocity:**
- Total plans completed: 46+ (across v0.2-v0.24)
- Average duration: 3.5 min
- Total execution time: ~2.7 hours

**By Phase (recent):**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| v0.24-05 | 4 | - | - |
| v0.24-04 | 3 | - | - |
| v0.24-03 | 3 | - | - |
| v0.25-01-02 | 2 tasks | 2 min | 3 files |

**Recent Trend:**
- Last 5 plans: stable
- Trend: stable

*Updated after each plan completion*
| Phase v0.25-01 P01 | 4 | 2 tasks | 3 files |

## Accumulated Context

### Decisions

Decisions are logged in PROJECT.md Key Decisions table.
Recent decisions affecting current work:

- [v0.25 roadmap]: 5 phases derived from 18 requirements. SCHEMA-01..04 in v0.25-01 (schema fields are foundational). ANNOT-01..04 in v0.25-02 (annotations needed before matrix). TRACE-01..03+ANNOT-05 in v0.25-03 (matrix generator reads annotations as primary source). TRACE-04+TRACE-05 in v0.25-04 (bidirectional validation needs matrix). DECOMP-01..04 in v0.25-05 (state-space analysis integrated into matrix).
- [v0.25 roadmap]: v0.25-01 and v0.25-02 can execute in parallel -- schema fields and annotations are independent. v0.25-03 depends on both. v0.25-04 and v0.25-05 both depend on v0.25-03 and can run in parallel.
- [v0.25 roadmap]: ANNOT-05 (annotations as primary data source for matrix) assigned to v0.25-03 (not v0.25-02) because it specifies how the matrix consumes annotations, not how annotations are created.
- [v0.25 research]: Property-to-requirement map in TRACEABILITY_RESEARCH.md Section 5 should seed SCHEMA-01 model-registry entries and inform ANNOT-01..03 annotation work (22 models, ~80 properties mapped).
- [Phase v0.25-01]: requirement_ids is optional in check-result schema for backward compat; writer validates at runtime; uppaal added to formalism enum to align schema with VALID_FORMALISMS
- [Phase v0.25-01-01]: 26 requirement IDs in seed map missing from requirements.json -- formal_models skipped for those, model-registry carries them as forward references
- [Phase v0.25-01-01]: Aggregator uses pre-aggregation capture + merge-back for formal_models (enrichment data not milestone-sourced)
- [Phase v0.25-01-03]: check_id name mismatches between plan and runners -- actual runner check_ids used (alloy:scoreboard not alloy:scoreboard-recompute, etc.); run-phase-tlc.cjs excluded (no writeCheckResult calls)
- [Phase v0.25-01-03]: getRequirementIds returns .slice() copy to prevent caller mutation of shared source-of-truth arrays
- [Phase v0.25-02]: Annotation format per formalism: TLA+ `\* @requirement REQ-ID`, Alloy `-- @requirement REQ-ID`, PRISM `// @requirement REQ-ID` -- one per line, stacked for multi-requirement properties
- [Phase v0.25-02]: Generated files (QGSDQuorum.tla, QGSDQuorum_xstate.tla, quorum-votes.als, quorum.props) annotated with preservation notes to survive regeneration
- [Phase v0.25-02]: Section-based TLA+ property detection: parser tracks section context (Safety/Liveness vs Actions/Init) to distinguish properties from action definitions that share `Name ==` syntax
- [Phase v0.25-02]: extract-annotations.cjs uses model-registry.json for file discovery (not globbing), filters paths starting with `..` or `/`, resolves .props siblings of .pm entries
- [Phase v0.25-02]: TUI-05 and TUI-06 assigned to EventuallyExits and MainMenuReachable (not in original research map)

### Pending Todos

- `2026-02-20-add-gsd-quorum-command-for-consensus-answers.md` -- Add qgsd:quorum command for consensus answers (area: planning)
- `2026-03-01-enforce-spec-requirements-never-reduce-objectives-to-match-reality.md` -- Enforce spec requirements (area: planning)
- `2026-03-01-slim-down-quorum-slot-worker-remove-redundant-haiku-file-exploration.md` -- Slim down quorum slot worker (area: tooling)

### Blockers/Concerns

- [v0.12 carry-forward]: npm publish qgsd@0.2.0 deferred; run `npm publish --access public` when user decides
- [v0.18-06/07 open]: v0.18-06 (FAN-04 Stop hook ceiling fix) and v0.18-07 (ENV-03 envelope path wiring) not yet started
- [v0.21-02 carry-forward]: 3983 unmappable_action divergences remain (correctly excluded from state_mismatch rate)

### Quick Tasks Completed

| # | Description | Date | Commit | Status | Directory |
|---|---|---|---|---|---|
| 134 | Integrate formal_models field and detect-coverage-gaps into requirements TUI | 2026-03-03 | c1d5bf18 | Verified | [134-integrate-formal-models-field-and-detect](./quick/134-integrate-formal-models-field-and-detect/) |

## Session Continuity

Last session: 2026-03-03
Last activity: 2026-03-03 -- Phase v0.25-02 complete: @requirement annotations on all 23 model files + extraction parser (ANNOT-01..04)
Stopped at: None
Resume file: None
