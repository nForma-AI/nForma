---
phase: quick-27
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - /Users/jonathanborduas/.claude/commands/qgsd/quorum.md
  - /Users/jonathanborduas/.claude/gsd-local-patches/commands/qgsd/quorum.md
autonomous: true
requirements: [QUICK-27]
must_haves:
  truths:
    - "Claude's position in Step 2 is a single sentence"
    - "Round 1 table cells contain position summaries ≤ 60 chars"
    - "Consensus answer is 2-3 sentences with no Path 1/Path 2 headers and no sub-bullets"
    - "Supporting positions bullet list is absent from Step 6 output"
    - "No post-consensus editorial commentary block exists anywhere in the output spec"
    - "Banners have no blank lines inside them"
  artifacts:
    - path: "/Users/jonathanborduas/.claude/commands/qgsd/quorum.md"
      provides: "Primary quorum command"
    - path: "/Users/jonathanborduas/.claude/gsd-local-patches/commands/qgsd/quorum.md"
      provides: "Mirror copy in gsd-local-patches"
  key_links:
    - from: "Step 2 instruction"
      to: "Claude position output format"
      via: "1 sentence constraint"
    - from: "Step 6 consensus block"
      to: "output template"
      via: "removed Supporting positions section"
---

<objective>
Compact the quorum.md output format: 1-sentence model summaries, tight banners, 2-3 sentence consensus answers, remove redundant sections.

Purpose: The current format produces walls of text that make quorum output hard to scan. Every redundant or verbose element gets cut.
Output: Updated quorum.md in both ~/.claude/commands/qgsd/ and ~/.claude/gsd-local-patches/commands/qgsd/ — identical content in both.
</objective>

<execution_context>
@/Users/jonathanborduas/.claude/get-shit-done/workflows/execute-plan.md
@/Users/jonathanborduas/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@/Users/jonathanborduas/code/QGSD/.planning/STATE.md
</context>

<tasks>

<task type="auto">
  <name>Task 1: Compact quorum.md output format in both locations</name>
  <files>
    /Users/jonathanborduas/.claude/commands/qgsd/quorum.md
    /Users/jonathanborduas/.claude/gsd-local-patches/commands/qgsd/quorum.md
  </files>
  <action>
Apply ALL of the following format changes to both files simultaneously (they must remain identical):

**Change 1 — Step 2: Claude's position instruction**
OLD:
```
Claude (Round 1): [answer + reasoning — 2–4 sentences]
```
NEW:
```
Claude (Round 1): [verdict + core reason — 1 sentence]
```

**Change 2 — Step 4: Round 1 table column header and position cells**
The table currently has no length guidance. Add `≤ 60 chars` to the column header and position template values. Change the header cell from:
```
│ Round 1 Position                                         │
```
to:
```
│ Round 1 Position (≤ 60 chars)                           │
```
Leave the box-drawing characters intact — only the header text changes.

**Change 3 — Step 6: Remove blank lines inside banners**
Every banner block has this pattern (blank line after opening bar, blank line before closing bar):
```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 QGSD ► QUORUM CONSENSUS REACHED
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Question: [question]
```
Change to (no blank line between closing bar and content):
```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 QGSD ► QUORUM CONSENSUS REACHED
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Question: [question]
```
Apply to ALL banners in the file: Mode A Step 1, Step 6, Step 7; Mode B Step 1, Step 6.

**Change 4 — Step 6 Mode A: Tighten consensus answer and remove Supporting positions**

OLD Step 6 output template:
```
Question: [question]
Rounds to consensus: [N]

CONSENSUS ANSWER:
[Full consensus answer — detailed and actionable]

Supporting positions:
• Claude:    [brief]
• Codex:     [brief or UNAVAIL]
• Gemini:    [brief or UNAVAIL]
• OpenCode:  [brief or UNAVAIL]
• Copilot:   [brief or UNAVAIL]
```

NEW Step 6 output template:
```
Question: [question]
Rounds to consensus: [N]

CONSENSUS ANSWER:
[2–3 sentences. State verdict, core reason, and one actionable implication. No sub-bullets, no headers.]
```

Remove the "Supporting positions" block entirely — the Round 1 table already shows each model's position.

**Change 5 — Add no-editorial-commentary instruction after Step 6 scoreboard block (Mode A)**

After the scoreboard `--verdict` parameter line (just before `### Step 7:`), insert:

```
Do NOT add editorial commentary after the consensus answer (e.g., "The split in Round 1 was illuminating..."). The consensus answer block is the final output. Stop there.
```

**Change 6 — Step 5: Deliberation prompt model position length**

In the deliberation prompt template, change:
```
• Claude: [position]
```
to:
```
• Claude: [position — 1 sentence]
```
Apply the same `— 1 sentence` label to Codex, Gemini, OpenCode, Copilot bullet lines in the deliberation prompt template.

Do NOT change:
- Any quorum logic (deliberation rounds, consensus evaluation, scoreboard update calls)
- Mode B workflow (execution + trace review)
- The scoreboard update bash commands
- The escalation Step 7 structure (final positions there need more detail since consensus failed)
  </action>
  <verify>
Read both updated files and confirm:
1. Step 2 says "1 sentence" (not "2–4 sentences")
2. Round 1 table header contains "≤ 60 chars"
3. Step 6 template does NOT contain "Supporting positions:"
4. Step 6 template says "2–3 sentences" for consensus answer
5. No blank line between banner closing `━━━` bar and the `Question:` line
6. "Do NOT add editorial commentary" instruction exists after Step 6 scoreboard block
7. Both files are identical (diff returns nothing)
  </verify>
  <done>
Both quorum.md files produce compact output: 1-sentence model positions, tighter banners, 2-3 sentence consensus answers with no supporting positions repeat, and an explicit prohibition on post-consensus commentary. diff of the two files returns nothing.
  </done>
</task>

</tasks>

<verification>
Run: diff /Users/jonathanborduas/.claude/commands/qgsd/quorum.md /Users/jonathanborduas/.claude/gsd-local-patches/commands/qgsd/quorum.md
Expected: no output (files identical)

Read Step 6 output template and confirm "Supporting positions:" section is absent.
Read Step 2 and confirm "1 sentence" constraint.
</verification>

<success_criteria>
- quorum.md output format is visibly more compact
- All 6 specific changes applied correctly
- Both file locations updated identically
- Zero quorum logic changes (deliberation, scoreboard, consensus evaluation untouched)
</success_criteria>

<output>
After completion, create .planning/quick/27-compact-quorum-md-output-format-1-line-m/27-SUMMARY.md
</output>
