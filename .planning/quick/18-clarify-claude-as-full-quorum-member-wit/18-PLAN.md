---
phase: quick-18
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - CLAUDE.md
  - .planning/quorum-scoreboard.md
autonomous: true
requirements: [QUICK-18]

must_haves:
  truths:
    - "CLAUDE.md Appendix quorum table unambiguously names Claude as a voting participant, not merely primary reasoner"
    - "R3.2 step 1 explicitly frames Claude's position-forming as casting a vote, not pre-query coordination prep"
    - "Scoreboard Notes section clarifies Claude rows record Claude's own votes as a quorum participant"
  artifacts:
    - path: "CLAUDE.md"
      provides: "Policy clarification for Claude's quorum role"
      contains: "Voting quorum member"
    - path: ".planning/quorum-scoreboard.md"
      provides: "Scoreboard note distinguishing participant vs orchestrator rows"
      contains: "quorum participant"
  key_links:
    - from: "CLAUDE.md R3.2 step 1"
      to: "CLAUDE.md Appendix quorum table"
      via: "Consistent framing of Claude as voter"
      pattern: "vote|voting quorum member"
---

<objective>
Clarify in CLAUDE.md and the quorum scoreboard that Claude is a full voting quorum member — not merely the orchestrator who polls other models. Three targeted, documentation-only edits; no logic or behavior changes.

Purpose: Remove ambiguity that causes readers (and future Claude instances) to treat Claude's position-forming step as coordination overhead rather than an active vote contributing to consensus.
Output: Updated CLAUDE.md (disk-only, not committed) and updated .planning/quorum-scoreboard.md (committed).
</objective>

<execution_context>
@/Users/jonathanborduas/.claude/get-shit-done/workflows/execute-plan.md
@/Users/jonathanborduas/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
</context>

<tasks>

<task type="auto">
  <name>Task 1: Update CLAUDE.md — Appendix quorum table and R3.2 step 1</name>
  <files>CLAUDE.md</files>
  <action>
    Make two targeted edits to CLAUDE.md:

    **Edit 1 — Appendix quorum member table (line ~240):**
    Change the Claude row's Role column from:
      `Primary reasoner; sole executor`
    to:
      `Voting quorum member; primary reasoner; sole executor`

    The full row after edit:
    `| **Claude** (Sonnet 4.6) | self | Voting quorum member; primary reasoner; sole executor |`

    **Edit 2 — R3.2 step 1 (line ~62):**
    Change:
      `1. Claude MUST form its own position **before** querying other models.`
    to:
      `1. Claude MUST form its own position (its vote) **before** querying other models. This is Claude's active quorum contribution — not pre-query preparation.`

    IMPORTANT: CLAUDE.md is gitignored by project design. Write to disk only. Do NOT stage or commit CLAUDE.md.
  </action>
  <verify>
    Read /Users/jonathanborduas/code/QGSD/CLAUDE.md and confirm:
    - Appendix table Claude row contains "Voting quorum member"
    - R3.2 step 1 contains "its vote" and "active quorum contribution"
  </verify>
  <done>Both phrases appear in CLAUDE.md on disk. File not staged in git.</done>
</task>

<task type="auto">
  <name>Task 2: Update scoreboard Notes — clarify Claude rows as participant votes</name>
  <files>.planning/quorum-scoreboard.md</files>
  <action>
    In the `## Notes` section of /Users/jonathanborduas/code/QGSD/.planning/quorum-scoreboard.md, append one new bullet after the existing notes:

    Add this line at the end of the Notes section (after the last existing bullet):
    `- Claude rows record Claude's own votes as a full quorum participant — not orchestration overhead. Claude forms an independent position, contributes it to deliberation, and is scored identically to Codex/Gemini/OpenCode/Copilot.`

    Do NOT alter any existing notes or round log rows.
  </action>
  <verify>
    Read /Users/jonathanborduas/code/QGSD/.planning/quorum-scoreboard.md and confirm the new bullet appears in the Notes section containing "quorum participant".
  </verify>
  <done>New note present in scoreboard Notes section. Commit the scoreboard file.</done>
</task>

</tasks>

<verification>
After both tasks:
- CLAUDE.md on disk contains "Voting quorum member" in Appendix table and "its vote" + "active quorum contribution" in R3.2 step 1
- .planning/quorum-scoreboard.md Notes section contains the new clarifying bullet
- `git status` shows CLAUDE.md NOT staged (disk-only), scoreboard staged/committed
</verification>

<success_criteria>
All three targeted phrases present in their respective files. CLAUDE.md not committed. Scoreboard committed with updated Notes section.
</success_criteria>

<output>
After completion, create `.planning/quick/18-clarify-claude-as-full-quorum-member-wit/18-SUMMARY.md` with:
- What was changed (two files, three edits)
- Why CLAUDE.md was not committed (gitignored by design)
- Confirmation both files updated correctly
</output>
