---
phase: quick-335
plan: 01
subsystem: agents
tags: [FSM, state-machines, researcher, formal-verification]
completed: 2026-03-19
---

# Quick Task 335: Add FSM Candidate Detection to Phase Researcher

**One-liner:** Enabled phase researcher agent to proactively detect implicit state machines in code and output findings in structured RESEARCH.md table for planner consumption.

## Overview

Updated `agents/nf-phase-researcher.md` with FSM candidate detection capability. The researcher agent now scans code files touched by a phase for implicit state machine patterns and surfaces findings to enable the planner to create FSM conversion tasks that unlock formal verification via TLA+ transpilation.

## Tasks Completed

### Task 1: Add FSM candidate detection section to researcher agent

Modified `agents/nf-phase-researcher.md` with three additions:

**1. New Step 3.5: Scan for FSM Candidates** (execution_flow section)
- Inserted between Step 3 (Execute Research Protocol) and Step 4 (Quality Check)
- Provides detection heuristics based on `.claude/rules/state-machine-bias.md`:
  - Variables tracking 3+ distinct state values
  - Conditional transitions between states (switch/case or if/else chains)
  - Repeated "what state am I in?" checks across functions/locations
- Scanning strategy using Grep patterns for state tracking
- Framework recommendations linked to state-machine-bias.md tables
- Conditional output: omit FSM Candidates section if no candidates found

**2. FSM Candidates output template** (output_format section)
- Added section after "## State of the Art" and before "## Open Questions"
- Includes HTML comment flagging conditional inclusion
- Structured table template: File | Signal | Approx States | Recommended Framework
- Transpilation note referencing `bin/adapters/` for TLA+ formal verification

**3. downstream_consumer table entry** (downstream_consumer section)
- Added row documenting how planner consumes FSM Candidates
- Text: "Creates FSM conversion tasks pairing each candidate with its recommended framework; enables formal verification via TLA+ transpilation"

## Verification

All checks from plan passed:

| Check | Result | Status |
|-------|--------|--------|
| `grep -c 'FSM Candidates'` | 4 (3+ required) | ✓ Pass |
| `grep 'Step 3.5'` | Found in execution_flow | ✓ Pass |
| `grep -A2 'FSM Candidates.*Planner'` | Row in downstream_consumer | ✓ Pass |
| `grep '3+ distinct'` | Found in heuristics | ✓ Pass |
| `grep 'bin/adapters'` | Found in transpilation note | ✓ Pass |

## Files Modified

| File | Changes |
|------|---------|
| `agents/nf-phase-researcher.md` | +1 new step (3.5), +1 new template section, +1 new table row |

## Success Criteria Met

- [x] agents/nf-phase-researcher.md contains FSM detection step in execution_flow
- [x] Detection heuristics align with state-machine-bias.md (3+ states, conditional transitions, repeated checks)
- [x] Output template in RESEARCH.md structure section
- [x] Downstream consumer documentation complete
- [x] Framework recommendation guidance points to bias rule tables
- [x] Transpilation note references bin/adapters/

## Key Decisions

- FSM Candidates section is optional in RESEARCH.md (omit if no candidates found) per plan specification
- Heuristics sourced directly from existing state-machine-bias.md to maintain consistency
- Framework recommendations reference the bias rule's comprehensive framework tables rather than duplicating them

## Deviations from Plan

None - plan executed exactly as written.

## Next Steps

This task enables:
- Phase researcher agent to proactively surface state machine refactoring opportunities
- Planner to create FSM conversion tasks based on researcher findings
- Formal verification of state machines via TLA+ transpilation pipeline

The detection pattern is now integrated into the researcher workflow and ready for use in upcoming phase analyses.
