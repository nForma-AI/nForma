---
phase: quick-335
verified: 2026-03-19T19:45:00Z
status: passed
score: 3/3 must-haves verified
re_verification: false
---

# Quick Task 335: Add FSM Candidate Detection to nf-phase-researcher.md

**Task Goal:** Add FSM candidate detection section to nf-phase-researcher.md so the researcher proactively scans code touched by a phase and identifies state-machine candidates in RESEARCH.md output.

**Verified:** 2026-03-19T19:45:00Z
**Status:** ✓ PASSED
**Score:** 3/3 must-haves verified

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Researcher agent scans phase files for FSM candidate patterns during research | ✓ VERIFIED | Step 3.5 in execution_flow (agents/nf-phase-researcher.md:382-402) provides detection instructions with three heuristics from state-machine-bias.md |
| 2 | RESEARCH.md output includes an ## FSM Candidates section with structured table | ✓ VERIFIED | Output template in output_format section (agents/nf-phase-researcher.md:293-302) defines FSM Candidates header, table structure, and transpilation note; includes conditional HTML comment for optional inclusion |
| 3 | downstream_consumer table documents the new FSM Candidates section | ✓ VERIFIED | Table row at agents/nf-phase-researcher.md:62 states: "Creates FSM conversion tasks pairing each candidate with its recommended framework; enables formal verification via TLA+ transpilation" |

**Score:** 3/3 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `agents/nf-phase-researcher.md` | Contains FSM candidate detection instructions and output template | ✓ VERIFIED | File exists and contains all three required components: Step 3.5, output template, downstream_consumer entry |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|----|--------|---------|
| agents/nf-phase-researcher.md (Step 3.5) | .claude/rules/state-machine-bias.md | Detection heuristics reference | ✓ WIRED | Three references to state-machine-bias.md in Step 3.5 (lines 296, 386, 396) align the detection heuristics with the bias rule |
| agents/nf-phase-researcher.md (output template) | .claude/rules/state-machine-bias.md | Framework recommendation table | ✓ WIRED | Output template at line 296 references heuristics from state-machine-bias.md; Step 3.5 at line 396 directs users to consult framework tables in the bias rule |
| agents/nf-phase-researcher.md (FSM Candidates section) | nf-planner consumption | downstream_consumer table entry | ✓ WIRED | downstream_consumer table at line 62 explicitly documents how planner consumes FSM Candidates section for task creation |

### Implementation Details

#### 1. Step 3.5: Scan for FSM Candidates

**Location:** agents/nf-phase-researcher.md:382-402

Step 3.5 is properly positioned in execution_flow (between Step 3 "Execute Research Protocol" and Step 4 "Quality Check") and provides:

- **Detection heuristics** (matching state-machine-bias.md):
  1. Variables tracking 3+ distinct state values
  2. Conditional transitions between states (switch/case or if/else chains)
  3. Repeated "what state am I in?" checks in multiple locations

- **Scanning strategy:** Grep patterns for state variable detection:
  - `status\s*=\s*['"]`
  - `state\s*===?\s*['"]`
  - `switch\s*\(\s*state`
  - `case\s+['"]`

- **Framework recommendations:** Direct users to state-machine-bias.md framework tables for language/complexity matching:
  - JS/TS flat FSM (3-6 states) → javascript-state-machine
  - JS/TS statecharts (nested, guards, actions) → XState v5
  - Python flat FSM → transitions
  - Other languages → consult bias rule

- **Conditional output:** Explicitly instructs omitting FSM Candidates section if no candidates found

#### 2. Output Format: FSM Candidates Section

**Location:** agents/nf-phase-researcher.md:293-302

Positioned correctly after "State of the Art" and before "Open Questions" in the RESEARCH.md template:

- HTML comment flags conditional inclusion: `<!-- Include this section only if FSM candidates were detected in Step 3.5 -->`
- Structured table template with columns: File | Signal | Approx States | Recommended Framework
- Example row demonstrates expected format
- Transpilation note: "All recommended frameworks have adapters in `bin/adapters/` for TLA+ formal verification"

#### 3. Downstream Consumer Table Entry

**Location:** agents/nf-phase-researcher.md:62

Table row documents planner consumption:

```
| `## FSM Candidates` | Creates FSM conversion tasks pairing each candidate with its recommended framework; enables formal verification via TLA+ transpilation |
```

All existing table rows preserved; new entry added at end.

### Anti-Patterns Found

None. No TODO/FIXME comments, placeholder text, or stub implementations detected.

### Markdown Validation

- ✓ All section headers properly formatted (`## Step 3.5`, `## FSM Candidates`)
- ✓ Table headers correctly formatted with pipe delimiters
- ✓ HTML comment syntax valid for conditional inclusion
- ✓ Code fence formatting correct (triple backticks)
- ✓ Link references to state-machine-bias.md valid (relative paths)

### Plan Verification Checks

All verification checks from PLAN.md passed:

| Check | Expected | Actual | Status |
|-------|----------|--------|--------|
| `grep -c 'FSM Candidates'` | 3+ | 4 | ✓ PASS |
| `grep 'Step 3.5'` | Found | 2 references | ✓ PASS |
| `grep -A2 'FSM Candidates.*Planner'` | Row in downstream_consumer | Found at line 62 | ✓ PASS |
| `grep '3+ distinct'` | In heuristics | Line 387 | ✓ PASS |
| `grep 'bin/adapters'` | In transpilation note | Line 302 | ✓ PASS |

## Artifact Verification

### File: agents/nf-phase-researcher.md

**Level 1 - Existence:** ✓ VERIFIED
- File exists at agents/nf-phase-researcher.md
- File is readable and properly formatted

**Level 2 - Substantive Content:** ✓ VERIFIED
- Step 3.5 contains complete detection instructions (not a stub)
- Heuristics list all three signal patterns
- Output template includes table structure and example
- Framework recommendations include specific library names and use cases
- Transpilation note references bin/adapters/ directory

**Level 3 - Wiring:** ✓ VERIFIED
- Step 3.5 is called out in execution_flow between Step 3 and Step 4
- Output template is part of RESEARCH.md structure consumers see
- downstream_consumer table entry enables planner integration
- All references to state-machine-bias.md are correct and accessible

## System Integration

The researcher agent is the upstream producer of RESEARCH.md files. The FSM Candidates section, when populated, is consumed by:
1. **nf-planner** - documented in downstream_consumer table (line 62)
2. **Phase analysis workflow** - as part of RESEARCH.md output

This wiring is complete and explicit.

## Summary

All must-haves verified:

1. **Truth 1 - Researcher scans for FSM candidates:** ✓ Verified through Step 3.5 implementation
2. **Truth 2 - RESEARCH.md includes FSM Candidates section:** ✓ Verified through output template
3. **Truth 3 - downstream_consumer documents the new section:** ✓ Verified through table entry

The task goal is fully achieved. The phase researcher agent now has complete instructions to proactively detect implicit state machines in code touched by a phase and output findings in a structured, planner-consumable table within RESEARCH.md.

---

_Verified: 2026-03-19T19:45:00Z_
_Verifier: Claude (nf-verifier)_
