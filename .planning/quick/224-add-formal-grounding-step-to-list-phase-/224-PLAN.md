---
phase: quick-224
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - ~/.claude/nf/workflows/list-phase-assumptions.md
autonomous: true
formal_artifacts: none
requirements: []

must_haves:
  truths:
    - "Workflow reads formal artifacts (REQUIREMENTS.md, spec/, traceability-matrix.json, unit-test-coverage.json, requirements.json, model-registry.json) before analyzing assumptions"
    - "A Formal Grounding section appears before the 5 assumption areas in the output template"
    - "Each assumption in the 5 areas is tagged as grounded or inferred"
    - "All phase requirement IDs are resolved to full text from REQUIREMENTS.md"
  artifacts:
    - path: "~/.claude/nf/workflows/list-phase-assumptions.md"
      provides: "Enhanced list-phase-assumptions workflow with formal grounding step"
      contains: "ground_in_artifacts"
  key_links:
    - from: "ground_in_artifacts step"
      to: "analyze_phase step"
      via: "grounding data flows into assumption analysis"
      pattern: "grounding data|grounded|inferred"
    - from: "ground_in_artifacts step"
      to: "present_assumptions step"
      via: "Formal Grounding section in output template"
      pattern: "Formal Grounding"
---

<objective>
Add a formal grounding step to the list-phase-assumptions workflow that cross-references requirements, specs, traceability, test coverage, and formal models before surfacing assumptions.

Purpose: Ground assumption analysis in evidence from formal artifacts instead of pure inference, making assumptions more accurate and transparent about what is backed by evidence vs. Claude's judgment.
Output: Updated workflow file at ~/.claude/nf/workflows/list-phase-assumptions.md
</objective>

<execution_context>
@/Users/jonathanborduas/.claude/nf/workflows/execute-plan.md
@/Users/jonathanborduas/.claude/nf/templates/summary.md
</execution_context>

<context>
@~/.claude/nf/workflows/list-phase-assumptions.md
@.planning/REQUIREMENTS.md
</context>

<tasks>

<task type="auto">
  <name>Task 1: Add ground_in_artifacts step and update analyze_phase + present_assumptions</name>
  <files>~/.claude/nf/workflows/list-phase-assumptions.md</files>
  <action>
Insert a new step `ground_in_artifacts` between `validate_phase` and `analyze_phase`. This step reads formal artifacts in three tiers to ground the assumption analysis in evidence.

The new step must:

1. **Extract phase requirement IDs** from the roadmap's `Requirements:` line for the validated phase (e.g., `[HOOK-01, HOOK-02]` becomes a list of IDs).

2. **Tier 1 reads:**
   - Read `.planning/REQUIREMENTS.md` and extract the exact requirement text for each phase requirement ID.
   - List `.planning/formal/spec/` directory to identify which spec directories exist; flag any that overlap with the phase's domain (match by keyword from phase name/description).

3. **Tier 2 reads:**
   - Read `.planning/formal/traceability-matrix.json` and check which of the phase's requirement IDs already have traces (code refs, test refs). Note gaps.
   - Read `.planning/formal/unit-test-coverage.json` and extract test coverage for files/modules in the phase's domain.

4. **Tier 3 reads:**
   - Grep `.planning/formal/requirements.json` for the phase's requirement IDs only — extract category, status, any linked invariants.
   - Read `.planning/formal/model-registry.json` and check if any Alloy/TLA+/PRISM models reference the phase's requirements.

5. **Collect all results** into a grounding data structure that flows into analyze_phase.

All reads use fail-open pattern: if an artifact is missing or unreadable, note "not found" and continue — never block the workflow.

**Modify `analyze_phase` step:**
- Add instruction that each of the 5 assumption areas must reference grounding data where applicable.
- Each assumption must be tagged as **grounded** (backed by artifact evidence — cite the artifact) or **inferred** (Claude's judgment — explain reasoning).

**Modify `present_assumptions` step:**
- Add a `### Formal Grounding` section BEFORE the existing 5 areas (Technical Approach, Implementation Order, etc.).
- The Formal Grounding section shows:
  - **Requirements:** verbatim text for each phase requirement ID
  - **Existing Specs:** which spec/ directories overlap with this phase's domain
  - **Traceability:** which requirements have traces vs. gaps
  - **Test Coverage:** coverage data for relevant modules
  - **Formal Models:** any Alloy/TLA+/PRISM models touching this domain

**Add to `success_criteria`:**
- All phase requirement IDs resolved to their full text
- Existing specs in the domain identified
- Traceability gaps surfaced
- Each assumption tagged as grounded or inferred

**Do NOT change:** `validate_phase`, `gather_feedback`, `offer_next` steps. Still no file output — purely conversational.
  </action>
  <verify>
Read the updated workflow file and confirm:
1. `ground_in_artifacts` step exists between `validate_phase` and `analyze_phase`
2. All 6 artifact reads (3 tiers) are specified in the step
3. `analyze_phase` references grounding data and mentions grounded/inferred tagging
4. `present_assumptions` template includes `### Formal Grounding` section before the 5 areas
5. `success_criteria` includes the 4 new criteria
6. `validate_phase`, `gather_feedback`, `offer_next` are unchanged
  </verify>
  <done>
The list-phase-assumptions workflow has a ground_in_artifacts step that reads 6 formal artifacts across 3 tiers, the analyze_phase step tags assumptions as grounded vs inferred, the present_assumptions template shows a Formal Grounding section before the 5 assumption areas, and success_criteria includes requirement resolution, spec identification, traceability gaps, and grounded/inferred tagging.
  </done>
</task>

</tasks>

<verification>
- Read the updated workflow file end-to-end
- Confirm the step ordering is: validate_phase -> ground_in_artifacts -> analyze_phase -> present_assumptions -> gather_feedback -> offer_next
- Confirm no file output is produced (purely conversational)
- Confirm fail-open pattern for missing artifacts
</verification>

<success_criteria>
- ground_in_artifacts step reads all 6 artifacts across 3 tiers with fail-open handling
- Formal Grounding section appears in output template before the 5 assumption areas
- Each assumption tagged as grounded or inferred
- All phase requirement IDs resolved to full text
- Existing workflow steps (validate_phase, gather_feedback, offer_next) unchanged
</success_criteria>

<output>
After completion, create `.planning/quick/224-add-formal-grounding-step-to-list-phase-/224-SUMMARY.md`
</output>
