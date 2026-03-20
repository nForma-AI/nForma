---
phase: quick-335
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - agents/nf-phase-researcher.md
autonomous: true
formal_artifacts: none
requirements: [QUICK-335]

must_haves:
  truths:
    - "Researcher agent scans phase files for FSM candidate patterns during research"
    - "RESEARCH.md output includes an ## FSM Candidates section with structured table"
    - "downstream_consumer table documents the new FSM Candidates section"
  artifacts:
    - path: "agents/nf-phase-researcher.md"
      provides: "FSM candidate detection instructions and output template"
      contains: "FSM Candidates"
  key_links:
    - from: "agents/nf-phase-researcher.md"
      to: ".claude/rules/state-machine-bias.md"
      via: "detection heuristics reuse"
      pattern: "3\\+ distinct"
    - from: "agents/nf-phase-researcher.md (FSM Candidates section)"
      to: "nf-planner consumption"
      via: "downstream_consumer table entry"
      pattern: "FSM Candidates"
---

<objective>
Add FSM candidate detection to the phase researcher agent so it proactively identifies implicit state machines in code touched by a phase and outputs findings in a structured table within RESEARCH.md.

Purpose: Surfaces state machine refactoring opportunities early in the planning pipeline, enabling the planner to create FSM conversion tasks that unlock formal verification via TLA+ transpilation.
Output: Updated agents/nf-phase-researcher.md with detection instructions and output template.
</objective>

<execution_context>
@/Users/jonathanborduas/.claude/nf/workflows/execute-plan.md
@/Users/jonathanborduas/.claude/nf/templates/summary.md
</execution_context>

<context>
@agents/nf-phase-researcher.md
@.claude/rules/state-machine-bias.md
</context>

<tasks>

<task type="auto">
  <name>Task 1: Add FSM candidate detection section to researcher agent</name>
  <files>agents/nf-phase-researcher.md</files>
  <action>
Add two modifications to agents/nf-phase-researcher.md:

**1. Add FSM candidate detection step in `<execution_flow>`**

Insert a new Step 3.5 (between current Step 3 "Execute Research Protocol" and Step 4 "Quality Check") titled "Scan for FSM Candidates":

```markdown
## Step 3.5: Scan for FSM Candidates

When the phase touches code files (not pure docs/config phases), scan each file listed in the phase description or CONTEXT.md for implicit state machine patterns:

**Detection heuristics** (from `.claude/rules/state-machine-bias.md`):
1. Variables tracking 3+ distinct state values (e.g., `status`, `state`, `phase`, `step` with string/enum assignments)
2. Conditional transitions between states (switch/case or if/else chains on a state variable that reassign it)
3. Repeated "what state am I in?" checks — the same state variable inspected in multiple functions/locations

**How to scan:**
- Use Grep to search modified files for patterns: `status\s*=\s*['"]`, `state\s*===?\s*['"]`, `switch\s*\(\s*state`, `case\s+['"]`
- For each hit, read surrounding context to confirm it represents multi-valued state tracking, not a simple boolean
- Skip files that only have simple boolean toggles, linear pipelines with no branching, or one-off conditional logic

**Framework recommendation:** Match detected language and complexity to the framework table in `.claude/rules/state-machine-bias.md`:
- JS/TS flat FSM (3-6 states, no nesting) -> `javascript-state-machine`
- JS/TS statecharts (nested, guards, actions) -> XState v5
- Python flat FSM -> `transitions`
- Other languages -> consult the bias rule's framework tables

If NO candidates found, omit the `## FSM Candidates` section from RESEARCH.md entirely (do not include an empty section).
```

**2. Add `## FSM Candidates` output template in `<output_format>`**

Insert the following template section in the RESEARCH.md Structure block, after the `## State of the Art` section and before `## Open Questions`:

```markdown
## FSM Candidates

Code scanned for implicit state machines per `.claude/rules/state-machine-bias.md` heuristics.

| File | Signal | Approx States | Recommended Framework |
|------|--------|---------------|----------------------|
| `path/to/file.ts` | [e.g., `status` var with 5 string assignments + switch/case transitions] | 5 | XState v5 |

**Transpilation note:** All recommended frameworks have adapters in `bin/adapters/` for TLA+ formal verification.
```

Add a note above the template: `<!-- Include this section only if FSM candidates were detected in Step 3.5 -->`

**3. Update the `<downstream_consumer>` table**

Add a new row to the existing table in the `<downstream_consumer>` section:

| Section | How Planner Uses It |
|---------|---------------------|
| `## FSM Candidates` | Creates FSM conversion tasks pairing each candidate with its recommended framework; enables formal verification via TLA+ transpilation |

Preserve all existing rows in the table. Add the new row at the end, before the closing remarks.
  </action>
  <verify>
Run these checks:
1. `grep -c 'FSM Candidates' agents/nf-phase-researcher.md` returns 3+ (output template, downstream_consumer entry, step 3.5 reference)
2. `grep 'Step 3.5' agents/nf-phase-researcher.md` confirms the new step exists
3. `grep -A2 'FSM Candidates.*Planner' agents/nf-phase-researcher.md` shows the downstream_consumer row
4. `grep '3+ distinct' agents/nf-phase-researcher.md` confirms heuristics are referenced
5. `grep 'bin/adapters' agents/nf-phase-researcher.md` confirms transpilation note
  </verify>
  <done>
agents/nf-phase-researcher.md contains:
- A Step 3.5 in execution_flow that instructs scanning for FSM candidates using the three heuristics from state-machine-bias.md
- An FSM Candidates table template in the RESEARCH.md output format section
- A downstream_consumer table entry documenting how the planner uses FSM Candidates
- Framework recommendation guidance pointing to the bias rule's framework tables
- Transpilation note referencing bin/adapters/ for TLA+ verification
  </done>
</task>

</tasks>

<verification>
- The researcher agent file parses correctly (no broken markdown structure)
- All three additions are present: detection step, output template, downstream_consumer row
- Heuristics match the three signals from state-machine-bias.md (3+ states, conditional transitions, repeated checks)
- Framework recommendation references the bias rule rather than duplicating its tables
</verification>

<success_criteria>
- agents/nf-phase-researcher.md updated with FSM candidate detection capability
- Detection heuristics align with .claude/rules/state-machine-bias.md
- Output template produces a structured table consumable by the planner
- Downstream consumer documentation is complete
</success_criteria>

<output>
After completion, create `.planning/quick/335-add-fsm-candidate-detection-section-to-n/335-SUMMARY.md`
</output>
