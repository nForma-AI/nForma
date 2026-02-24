---
phase: quick-98
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - agents/qgsd-quorum-orchestrator.md
autonomous: true
requirements: [QUICK-98]

must_haves:
  truths:
    - "Mode A Round 1 narrative block is replaced with a single prose note pointing to the heredoc as canonical form"
    - "Deliberation prompt uses a proactive imperative to re-check codebase files, not a weak conditional"
    - "Mode B worker prompt uses a proactive norm to read files before verdict, not a reactive fallback"
    - "node bin/install.js --claude --global completes without error after the edits"
  artifacts:
    - path: "agents/qgsd-quorum-orchestrator.md"
      provides: "Updated quorum orchestrator with three prompt improvements"
      contains: "Before revising your position, use your tools to re-check"
  key_links:
    - from: "agents/qgsd-quorum-orchestrator.md"
      to: "hooks/dist/ and ~/.claude/hooks/"
      via: "node bin/install.js --claude --global"
      pattern: "install\\.js"
---

<objective>
Apply three targeted prompt-wording improvements to agents/qgsd-quorum-orchestrator.md that were identified by a prior quorum run, then re-install to propagate the changes.

Purpose: Eliminate a duplicated prompt block, strengthen the deliberation round instruction from a weak conditional to a proactive imperative, and elevate the Mode B worker instruction from a reactive fallback to a proactive norm. These changes improve grounding fidelity across all quorum workers.

Output: Updated agents/qgsd-quorum-orchestrator.md, re-installed via node bin/install.js --claude --global.
</objective>

<execution_context>
@/Users/jonathanborduas/.claude/get-shit-done/workflows/execute-plan.md
@/Users/jonathanborduas/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@.planning/ROADMAP.md
</context>

<tasks>

<task type="auto">
  <name>Task 1: Apply three prompt-wording fixes to qgsd-quorum-orchestrator.md</name>
  <files>agents/qgsd-quorum-orchestrator.md</files>
  <action>
Read agents/qgsd-quorum-orchestrator.md in full, then make exactly three targeted edits:

**Fix 1 — DUPLICATION (Mode A Round 1 narrative block):**
Locate the narrative prose prompt block that appears between the heading "### Query models (sequential)" and the "Bash call pattern" sub-heading. This block (approximately lines 248–272 in the current file) reads:

```
Call each model with this prompt — **each call is a separate sequential Bash tool call**:

```
QGSD Quorum — Round 1
...
Do not defer to other models.
```
```

Replace the fenced code block within that explanation with a single prose sentence:

  "Use the grounding instruction shown in the heredoc below — the heredoc is the canonical form sent to workers."

Do NOT touch the heredoc block that follows under "Bash call pattern" — that is the binding form and must remain unchanged.

**Fix 2 — DELIBERATION STRENGTHENING (deliberation prompt inside the heredoc equivalent in the Deliberation rounds section):**
Locate the deliberation prompt block under "### Deliberation rounds (R3.3)". Find the line:

  "If any prior position references codebase details you haven't verified, use your tools
  to read the relevant files in the Repository directory before revising."

Replace those two lines with:

  "Before revising your position, use your tools to re-check any codebase files relevant
  to the disagreement. At minimum re-read CLAUDE.md and .planning/STATE.md if they exist,
  plus any files directly referenced in the question or prior positions."

**Fix 3 — MODE B ELEVATION (Mode B worker prompt):**
Locate the Mode B heredoc under "### Query models with trace bundle (sequential)". Find the line:

  "If the traces reference files or behaviour that require codebase context to interpret,
  use your tools to read relevant files from the Repository directory before giving your verdict."

Replace those two lines with:

  "Before giving your verdict, use your tools to read relevant files from the Repository
  directory above. At minimum check CLAUDE.md and .planning/STATE.md if they exist. Ground
  your verdict in what you actually find — use your internal knowledge to reason, but let
  the real files be the source of truth."

Write the updated file back. Make no other changes.
  </action>
  <verify>
Run each of the following grep checks — all must return matching lines:

```bash
grep -n "the heredoc is the canonical form" /Users/jonathanborduas/code/QGSD/agents/qgsd-quorum-orchestrator.md
grep -n "Before revising your position" /Users/jonathanborduas/code/QGSD/agents/qgsd-quorum-orchestrator.md
grep -n "Before giving your verdict" /Users/jonathanborduas/code/QGSD/agents/qgsd-quorum-orchestrator.md
```

Also confirm the old weak conditional is gone:
```bash
grep -n "If any prior position references codebase details" /Users/jonathanborduas/code/QGSD/agents/qgsd-quorum-orchestrator.md
grep -n "If the traces reference files or behaviour" /Users/jonathanborduas/code/QGSD/agents/qgsd-quorum-orchestrator.md
```
Both of these should return no output.
  </verify>
  <done>
agents/qgsd-quorum-orchestrator.md contains all three replacement strings and neither of the two removed strings. The Round 1 heredoc under "Bash call pattern" is unchanged.
  </done>
</task>

<task type="auto">
  <name>Task 2: Re-install to propagate updated orchestrator</name>
  <files>hooks/dist/</files>
  <action>
Run the install command to sync the updated agent file into the global Claude installation:

```bash
node /Users/jonathanborduas/code/QGSD/bin/install.js --claude --global
```

Wait for exit code 0. If the command fails, capture stderr and report the error.
  </action>
  <verify>
```bash
node /Users/jonathanborduas/code/QGSD/bin/install.js --claude --global
echo "Exit code: $?"
```
Exit code must be 0.
  </verify>
  <done>
Install command exits 0, confirming the updated orchestrator is live in ~/.claude/.
  </done>
</task>

</tasks>

<verification>
1. `grep "the heredoc is the canonical form" agents/qgsd-quorum-orchestrator.md` returns a match
2. `grep "Before revising your position" agents/qgsd-quorum-orchestrator.md` returns a match
3. `grep "Before giving your verdict" agents/qgsd-quorum-orchestrator.md` returns a match
4. `grep "If any prior position references codebase details" agents/qgsd-quorum-orchestrator.md` returns nothing
5. `grep "If the traces reference files or behaviour" agents/qgsd-quorum-orchestrator.md` returns nothing
6. Install exits 0
</verification>

<success_criteria>
All three wording improvements are applied with no unintended side effects, and the install step confirms the updated file is propagated. The Round 1 grounding instruction in the heredoc (lines ~280–295 in the original file) is untouched.
</success_criteria>

<output>
After completion, create `.planning/quick/98-apply-three-quorum-identified-improvemen/98-SUMMARY.md` with what was changed, the grep verification results, and the install exit code.
</output>
