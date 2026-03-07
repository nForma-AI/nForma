---
phase: quick-208
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - README.md
autonomous: true
formal_artifacts: none
requirements: [QUICK-208]

must_haves:
  truths:
    - "README Formal Verification section explains the capability from a user perspective"
    - "No internal model names (QGSDQuorum, QGSDCircuitBreaker, etc.) appear in the section"
    - "No .planning/formal/ directory tree listing appears in the section"
    - "Prerequisites and running instructions are preserved for users who want to run verification"
    - "Link to VERIFICATION_TOOLS.md is preserved for detailed documentation"
  artifacts:
    - path: "README.md"
      provides: "User-facing README with condensed formal verification section"
      contains: "Formal Verification"
  key_links:
    - from: "README.md"
      to: "VERIFICATION_TOOLS.md"
      via: "markdown link"
      pattern: "VERIFICATION_TOOLS\\.md"
---

<objective>
Rewrite the README.md "Formal Verification" section (lines 668-755) to focus on user-facing capabilities rather than internal model details.

Purpose: The current section lists 25+ internal formal models by name and shows the .planning/formal/ directory tree. This is developer-internal content that belongs in VERIFICATION_TOOLS.md, not the user-facing README. Users need to know nForma uses formal methods for correctness, not which specific TLA+ specs exist.

Output: A README.md where the Formal Verification section briefly explains the capability, what it guarantees, and links to VERIFICATION_TOOLS.md for details.
</objective>

<execution_context>
@/Users/jonathanborduas/.claude/nf/workflows/execute-plan.md
@/Users/jonathanborduas/.claude/nf/templates/summary.md
</execution_context>

<context>
@README.md
@VERIFICATION_TOOLS.md
</context>

<tasks>

<task type="auto">
  <name>Task 1: Rewrite Formal Verification section for user-facing clarity</name>
  <files>README.md</files>
  <action>
Replace README.md lines 668-755 (the entire "## Formal Verification" section up to the "---" separator before "## Commands") with a condensed user-facing version.

The new section MUST:

1. Keep the `## Formal Verification` heading (the ToC nav link at line 28 references `#formal-verification`)

2. Open with a brief paragraph (2-3 sentences) explaining that nForma uses formal methods (TLA+, Alloy, PRISM, Petri nets, UPPAAL) to machine-check its own protocol correctness -- safety invariants, liveness properties, and probabilistic convergence. Frame this as a trust signal: "the protocols governing your planning decisions are mathematically verified, not just tested."

3. Keep the note that formal verification is optional and not required to use nForma normally.

4. Keep the "Prerequisites" subsection but simplify it to just: Java 17+ required, one-step install command (`node bin/install-formal-tools.cjs` or `node bin/install.js --formal`), and a link to VERIFICATION_TOOLS.md for full per-tool docs.

5. Keep the "Running Verification" subsection with the `node bin/run-formal-verify.cjs` commands (full pipeline and --only subsets). These are genuinely useful for anyone who wants to run verification.

6. REMOVE the "What's Modeled" subsection (the table listing QGSDQuorum, etc.)
7. REMOVE the "Spec Sources" subsection (the directory tree listing)
8. REMOVE the "CI Pipeline Artifacts" subsection (internal CI detail)

9. End with a one-liner pointing to VERIFICATION_TOOLS.md for the full model inventory, spec sources, and CI artifact documentation.

Keep the `---` separator after the section (before ## Commands).
  </action>
  <verify>
Run these checks:
- `grep -c 'QGSDQuorum\|QGSDCircuitBreaker\|QGSDOscillation\|QGSDConvergence' README.md` returns 0
- `grep -c 'planning/formal/' README.md` returns 0 (no directory tree)
- `grep -c 'VERIFICATION_TOOLS.md' README.md` returns at least 1
- `grep -c '## Formal Verification' README.md` returns 1
- `grep -c 'run-formal-verify' README.md` returns at least 1
- `grep -c 'install-formal-tools' README.md` returns at least 1
- The section is noticeably shorter (was ~87 lines, target ~30-40 lines)
  </verify>
  <done>
The Formal Verification section answers "what does nForma do for me?" (mathematically verified protocols) rather than "how does nForma verify itself?" (list of 25 internal models). Internal model details remain accessible via VERIFICATION_TOOLS.md link. Prerequisites and running commands preserved for users who want to run the pipeline.
  </done>
</task>

</tasks>

<verification>
- README.md renders correctly in GitHub preview (no broken markdown)
- The `#formal-verification` anchor in the ToC nav link (line 28) still resolves
- No internal model names leak into the user-facing section
- VERIFICATION_TOOLS.md link is present and correct
</verification>

<success_criteria>
- Formal Verification section is 30-40 lines (down from 87)
- Zero references to specific internal model names
- Zero directory tree listings
- Prerequisites and running commands preserved
- VERIFICATION_TOOLS.md linked for full details
</success_criteria>

<output>
After completion, create `.planning/quick/208-rewrite-readme-md-to-focus-on-user-facin/208-SUMMARY.md`
</output>
