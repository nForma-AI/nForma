---
phase: quick-22
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - /Users/jonathanborduas/.claude/agents/qgsd-quorum-orchestrator.md
  - /Users/jonathanborduas/.claude/commands/qgsd/quorum.md
autonomous: true
requirements: [QUICK-22]
must_haves:
  truths:
    - "The orchestrator agent writes scoreboard rows in the compact format: | Date | Task | R | Claude | Codex | Gemini | OpenCode | Copilot | Verdict |"
    - "Scoreboard cells use TP / TN / FP / FN / TP+ / — / blank — no verbose classification prose"
    - "The quorum.md skill shows a round-evolution table after deliberation ends, with arrows indicating position changes per model across rounds"
    - "Single-round consensus (no deliberation) does NOT show the evolution table — only multi-round quorums show it"
  artifacts:
    - path: "/Users/jonathanborduas/.claude/agents/qgsd-quorum-orchestrator.md"
      provides: "Compact scoreboard write instructions in <r8_scoreboard> section"
      contains: "TP+ | — | blank"
    - path: "/Users/jonathanborduas/.claude/commands/qgsd/quorum.md"
      provides: "Round-evolution display in Step 5 (Mode A) and Step 5 (Mode B deliberation)"
      contains: "Round 1 → Round 2"
  key_links:
    - from: "/Users/jonathanborduas/.claude/agents/qgsd-quorum-orchestrator.md r8_scoreboard"
      to: "/Users/jonathanborduas/code/QGSD/.planning/quorum-scoreboard.md"
      via: "Write tool — appends compact rows matching existing table header"
      pattern: "TP\\+|—|blank"
    - from: "/Users/jonathanborduas/.claude/commands/qgsd/quorum.md Step 5"
      to: "multi-round quorum output"
      via: "Round evolution table rendered only when rounds > 1"
      pattern: "→.*↑|→.*↓|stable"
---

<objective>
Update two governance files to improve scoreboard write fidelity and multi-round quorum readability.

Purpose: The orchestrator currently describes scoring in prose without specifying the compact row format it must write. The quorum skill shows per-round tables but no cross-round evolution, making it hard to see when models changed positions and why.

Output:
- `qgsd-quorum-orchestrator.md` — `<r8_scoreboard>` section rewrites to emit compact rows matching the live scoreboard format.
- `quorum.md` — Step 5 (Mode A deliberation) and Mode B Step 5 (verdict collection) gain a round-evolution display when rounds > 1.
</objective>

<execution_context>
@/Users/jonathanborduas/.claude/get-shit-done/workflows/execute-plan.md
@/Users/jonathanborduas/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@/Users/jonathanborduas/code/QGSD/.planning/STATE.md
@/Users/jonathanborduas/code/QGSD/.planning/quorum-scoreboard.md
</context>

<tasks>

<task type="auto">
  <name>Task 1: Update orchestrator r8_scoreboard section — compact write format</name>
  <files>/Users/jonathanborduas/.claude/agents/qgsd-quorum-orchestrator.md</files>
  <action>
Replace the `<r8_scoreboard>` section (lines 111–134) with an updated version that:

1. Keeps the classification table unchanged (TP/TN/FP/FN/Improvement Accepted/Improvement Rejected with points).

2. Keeps the edge cases unchanged.

3. REPLACES the vague "append rows" instruction with a concrete write spec:

After scoring, write rows to `.planning/quorum-scoreboard.md` (disk only — never git commit). Use the Write tool to append to the Round Log table. Each row uses this exact format:

```
| MM-DD | <task-label> | <round> | <claude> | <codex> | <gemini> | <opencode> | <copilot> | <verdict> |
```

Cell encoding rules:
- `TP` — model approved; consensus approved
- `TN` — model blocked; contrarian position prevailed
- `FP` — model approved; consensus adopted contrarian's block
- `FN` — model blocked; consensus rejected the block
- `TP+` — model approved AND had an improvement incorporated (combine into single cell)
- `—` — model was UNAVAILABLE this round
- blank — model not scored this round (e.g., Claude in improvement-only sub-rounds)

One row per round per quorum invocation. If R3.6 improvement iterations ran, append additional rows for each iteration round (reuse same task label, increment R column: `SH-1`, `SH-2`, etc. for sub-rounds).

After appending all rows, update the Cumulative Scores table: increment each model's TP/TN/FP/FN/Impr counters and recalculate Score column.

The scoreboard Write call MUST happen BEFORE delivering output to the user.

4. Keep the final line "Update the scoreboard BEFORE delivering output to the user." as the closing sentence.

The new section must remain within `<r8_scoreboard>` ... `</r8_scoreboard>` tags.
  </action>
  <verify>
Read the updated file and confirm:
- `<r8_scoreboard>` section contains the cell encoding table with `TP+`, `—`, blank entries
- The row format `| MM-DD | <task-label> | <round> | ...` appears explicitly
- No reference to "append rows" without the format spec
- File is syntactically valid YAML frontmatter + markdown (no truncation)
  </verify>
  <done>
The orchestrator's `<r8_scoreboard>` section contains explicit compact row format, cell encoding rules for all 7 cases (TP/TN/FP/FN/TP+/—/blank), and cumulative score update instructions. The format matches the live scoreboard's existing header.
  </done>
</task>

<task type="auto">
  <name>Task 2: Update quorum.md — round-evolution display after deliberation</name>
  <files>/Users/jonathanborduas/.claude/commands/qgsd/quorum.md</files>
  <action>
Two locations need the round-evolution block.

**Location 1 — Mode A, Step 5 (Deliberation rounds, R3.3):**

After the existing deliberation loop description ("Stop deliberation IMMEDIATELY upon CONSENSUS"), add a new sub-section:

```
#### Round Evolution Display

When deliberation ends (consensus reached OR 4-round limit), render a round-evolution table showing each model's position trajectory across all rounds. ONLY render this when total rounds > 1 (skip for single-round consensus).

Format:
```
Round Evolution:
┌──────────────┬─────────────────────────────────────────────────────────────┐
│ Model        │ Round 1 → Round 2 [→ Round 3 → Round 4 if applicable]       │
├──────────────┼─────────────────────────────────────────────────────────────┤
│ Claude       │ APPROVE → APPROVE  (stable)                                  │
│ Codex        │ —                                                            │
│ Gemini       │ BLOCK   → APPROVE  ↑ [accepted coupling argument]            │
│ OpenCode     │ APPROVE → APPROVE  (stable)                                  │
│ Copilot      │ APPROVE → APPROVE  (stable)                                  │
└──────────────┴─────────────────────────────────────────────────────────────┘
```

Arrow indicators:
- `↑` — model changed from BLOCK/contrarian to APPROVE (moved toward consensus)
- `↓` — model changed from APPROVE to BLOCK (regression — requires deliberation continuation or escalation)
- `(stable)` — no position change
- `—` — model was UNAVAILABLE (entire row shows just `—`)
- In brackets after arrow: 1 short phrase naming the argument that caused the shift (e.g., "accepted coupling argument", "new evidence changed position")

This table gives the user an at-a-glance audit trail of who changed their mind and why.
```
```

**Location 2 — Mode B, Step 5 (Collect verdicts), after the consensus determination rules:**

If Mode B needed deliberation rounds (split verdicts triggered deliberation), add the same round-evolution table at the end of Step 5 with the same format, but using `APPROVE`/`REJECT`/`FLAG` instead of `APPROVE`/`BLOCK`.

Add this paragraph after "If split: run deliberation (up to 3 rounds) with traces always included in context.":

```
When deliberation ends, render the Round Evolution table (same format as Mode A Step 5) using verdict labels (APPROVE / REJECT / FLAG). Only render when rounds > 1.
```

Do not change any other section of quorum.md (Mode B Step 6 output table, Step 7 escalation format, Mode A Steps 1–4 and 6–7 are untouched).
  </action>
  <verify>
Read the updated file and confirm:
- Mode A Step 5 contains a `#### Round Evolution Display` sub-section with the table template
- The table shows `→` separators between rounds and `↑`/`↓`/`(stable)` indicators
- Mode B Step 5 contains the one-line reference to render the same table for deliberation rounds
- "ONLY render this when total rounds > 1" condition is present
- No other sections were modified (grep for Step 6, Step 7 content still matches original)
  </verify>
  <done>
quorum.md Mode A Step 5 has a round-evolution display section with full table template and arrow indicators. Mode B Step 5 references the same table for deliberation cases. Single-round consensus skips the table. The format is scannable and self-explanatory.
  </done>
</task>

</tasks>

<verification>
After both tasks:
1. Read both files end-to-end — confirm no truncation, no broken markdown, no duplicate sections.
2. Verify scoreboard format in orchestrator matches the live header in `.planning/quorum-scoreboard.md` column for column.
3. Verify round-evolution table in quorum.md uses the correct arrow symbols and condition guard (rounds > 1).
</verification>

<success_criteria>
- The orchestrator writes compact scoreboard rows matching `| Date | Task | R | Claude | Codex | Gemini | OpenCode | Copilot | Verdict |` with cells TP/TN/FP/FN/TP+/—/blank.
- The quorum skill renders a round-evolution table after any multi-round deliberation, showing position trajectory per model with ↑/↓/(stable) indicators.
- Both files are syntactically valid (no broken YAML frontmatter or markdown structure).
- No regressions to other sections of either file.
</success_criteria>

<output>
After completion, create `.planning/quick/22-update-both-files-scoreboard-write-logic/22-SUMMARY.md`
</output>
