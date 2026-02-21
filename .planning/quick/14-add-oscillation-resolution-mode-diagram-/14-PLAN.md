---
phase: quick-14
plan: 01
type: execute
wave: 1
depends_on: []
files_modified: [docs/USER-GUIDE.md]
autonomous: true
requirements: [DOCS-14]

must_haves:
  truths:
    - "USER-GUIDE.md contains a 'Circuit Breaker & Oscillation Resolution' diagram section between 'Execution Wave Coordination' and 'Brownfield Workflow'"
    - "The diagram shows the full 7-node flow: trigger -> extract -> env fast-path -> commit graph -> quorum diagnosis -> consensus path -> no-consensus hard-stop"
    - "ASCII art style matches the existing diagrams exactly (box-drawing chars: ┌─┐ │ └─┘ ├── ▼, indented tree)"
  artifacts:
    - path: "docs/USER-GUIDE.md"
      provides: "Circuit Breaker & Oscillation Resolution diagram"
      contains: "Circuit Breaker & Oscillation Resolution"
  key_links:
    - from: "docs/USER-GUIDE.md"
      to: "get-shit-done/workflows/oscillation-resolution-mode.md"
      via: "diagram faithfully represents the 6-step workflow"
      pattern: "Environmental oscillation|Quorum Diagnosis|STRUCTURAL COUPLING|reset-breaker"
---

<objective>
Add a "Circuit Breaker & Oscillation Resolution" ASCII diagram to docs/USER-GUIDE.md, inserted after the "Execution Wave Coordination" section and before "Brownfield Workflow".

Purpose: The USER-GUIDE.md documents the 4 major workflow diagrams visually. The oscillation resolution mode (implemented in Phase 13) has no diagram yet — users encountering a CIRCUIT BREAKER ACTIVE block have no visual reference for what happens next.

Output: A new ### section in the Workflow Diagrams block with an ASCII diagram showing all 7 flow nodes: circuit breaker trigger, deny message extraction, environmental fast-path, commit graph build, quorum diagnosis (with deliberation rounds), consensus path (unified solution + user approval + --reset-breaker), and no-consensus hard-stop.
</objective>

<execution_context>
@/Users/jonathanborduas/.claude/get-shit-done/workflows/execute-plan.md
@/Users/jonathanborduas/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@docs/USER-GUIDE.md
@get-shit-done/workflows/oscillation-resolution-mode.md
</context>

<tasks>

<task type="auto">
  <name>Task 1: Insert Circuit Breaker & Oscillation Resolution diagram into USER-GUIDE.md</name>
  <files>docs/USER-GUIDE.md</files>
  <action>
Insert the following new section into docs/USER-GUIDE.md immediately after the closing ``` of the "Execution Wave Coordination" block (after line 134 — the line that reads "```") and before the "### Brownfield Workflow" heading.

The new section to insert:

```
### Circuit Breaker & Oscillation Resolution

```
  CIRCUIT BREAKER ACTIVE (PreToolUse deny)
         │
         │  Step 1: Extract from deny message
         ├── Oscillating file set
         └── commit_window_snapshot
                  │
                  ▼
         ┌──────────────────────────────┐
         │  Step 2: Environmental       │
         │  Fast-Path Check             │
         │  (.env, *.config.*, lock     │
         │   files, schema files?)      │
         └──────────────┬───────────────┘
                        │
               Yes      │      No
         ┌──────────────┘      └──────────────────┐
         │                                         │
         ▼                                         ▼
  ┌─────────────────┐                  Step 3: Build Commit Graph
  │ Immediate human │                  git log --oneline --name-only -N
  │ escalation      │                  Display as table (A→B→A pattern)
  │ (no quorum)     │                           │
  └─────────────────┘                           ▼
                                   ┌──────────────────────────┐
                                   │  Step 4: Quorum Diagnosis │
                                   │  STRUCTURAL COUPLING      │
                                   │  framing (R3.3 rules)     │
                                   │  Sequential tool calls    │
                                   │  Up to 4 rounds           │
                                   └──────────┬───────────────┘
                                              │
                              Consensus?      │
                         ┌──────────────┬─────┘
                        Yes             No (after 4 rounds)
                         │              │
                         ▼              ▼
               ┌─────────────────┐  ┌──────────────────────┐
               │ Step 5: Present │  │ Step 6: Hard-Stop     │
               │ unified solution│  │ Each model's position │
               │ Wait for user   │  │ Core disagreement     │
               │ approval        │  │ Claude's recommend.   │
               └────────┬────────┘  │ User makes final call │
                        │           └──────────────────────┘
               User approves
                        │
                        ▼
              Run: npx qgsd --reset-breaker
                        │
                        ▼
              Single-model executes
              (unified solution only —
               no incremental fixes)
```
```

Rules for the insertion:
- The new section goes after the closing triple-backtick of the Execution Wave Coordination code block (the ``` on line 134 of the current file) and before the blank line + `### Brownfield Workflow` heading.
- Preserve all surrounding content exactly — do not modify any other section.
- Match the surrounding heading level exactly: the new section uses `###` like "Execution Wave Coordination" and "Brownfield Workflow".
- The diagram uses only box-drawing characters already present in the existing diagrams: ┌ ─ ┐ │ └ ┘ ├ ▼ and standard ASCII. No emoji.
- Ensure a blank line separates the new section from both the preceding ``` and the following `### Brownfield Workflow`.
  </action>
  <verify>
Run: grep -n "Circuit Breaker" /Users/jonathanborduas/code/QGSD/docs/USER-GUIDE.md
Expected: One match showing the new ### heading at the correct line.

Run: grep -n "Brownfield Workflow" /Users/jonathanborduas/code/QGSD/docs/USER-GUIDE.md
Expected: The Brownfield section still exists after the new circuit breaker section.

Run: grep -c "STRUCTURAL COUPLING\|reset-breaker\|Environmental Fast-Path\|Hard-Stop" /Users/jonathanborduas/code/QGSD/docs/USER-GUIDE.md
Expected: 4 (one match per key term from the flow).

Visual check: Open docs/USER-GUIDE.md around the new section and confirm: (a) section heading is `### Circuit Breaker & Oscillation Resolution`, (b) the ASCII box-drawing characters render without corruption, (c) both branches (consensus and no-consensus) are present.
  </verify>
  <done>
docs/USER-GUIDE.md contains a new "### Circuit Breaker & Oscillation Resolution" section between "Execution Wave Coordination" and "Brownfield Workflow", with an ASCII diagram covering all 7 flow nodes from oscillation-resolution-mode.md. All 4 key terms (STRUCTURAL COUPLING, reset-breaker, Environmental Fast-Path, Hard-Stop) are present. Surrounding content is unchanged.
  </done>
</task>

</tasks>

<verification>
grep -n "Circuit Breaker & Oscillation Resolution" /Users/jonathanborduas/code/QGSD/docs/USER-GUIDE.md
grep -n "### Brownfield Workflow" /Users/jonathanborduas/code/QGSD/docs/USER-GUIDE.md
grep -n "### Execution Wave Coordination" /Users/jonathanborduas/code/QGSD/docs/USER-GUIDE.md

The Circuit Breaker section line number must be between the Execution Wave Coordination line and the Brownfield Workflow line.
</verification>

<success_criteria>
- docs/USER-GUIDE.md has the new diagram section inserted at the correct location
- Diagram covers all 7 nodes of the oscillation-resolution-mode.md flow
- ASCII art style is consistent with the 4 existing diagrams (box-drawing chars, indented tree)
- Both branches represented: environmental fast-path escalation and quorum diagnosis path
- Consensus path shows user approval gate and --reset-breaker requirement before execution
- No-consensus path shows hard-stop with each model's position escalation
- No surrounding content was modified
</success_criteria>

<output>
After completion, create `.planning/quick/14-add-oscillation-resolution-mode-diagram-/14-SUMMARY.md` with:
- What was inserted (section name, line numbers before/after)
- Verification output from the grep commands
- Status: COMPLETE
</output>
