---
phase: quick-99
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - agents/qgsd-quorum-worker.md
autonomous: true
requirements: [QUICK-99]

must_haves:
  truths:
    - "Mode A Round 1 prompt explicitly tells the worker it is an AI model voting alongside other AI models"
    - "Mode A Round 2+ prompt labels the Prior positions block as coming from peer AI models, not human users or experts"
    - "Mode B Round 2+ prompt carries the same peer-AI attribution label before the Prior positions block"
    - "No other sections of qgsd-quorum-worker.md are changed"
    - "node bin/install.js --claude --global exits 0 after the edit"
  artifacts:
    - path: "agents/qgsd-quorum-worker.md"
      provides: "Updated worker prompt with AI-source framing in all three locations"
      contains: "peer AI models participating in this quorum"
  key_links:
    - from: "agents/qgsd-quorum-worker.md"
      to: "~/.claude/hooks/ and hooks/dist/"
      via: "node bin/install.js --claude --global"
      pattern: "install\\.js"
---

<objective>
Add explicit source-attribution framing to the QGSD quorum worker prompts so that worker LLMs always know "Prior positions" during deliberation come from other AI model instances — not from human users, lawyers, domain specialists, or other human experts.

Purpose: Without this framing an LLM worker receiving a cross-pollination bundle may unconsciously treat peer AI opinions as authoritative human expert positions, causing inappropriate epistemic deference or confusion about why it should disagree with "the user." Labeling the source as peer AI models preserves independence of reasoning.

Output: Updated agents/qgsd-quorum-worker.md with three targeted additions, re-installed via node bin/install.js --claude --global.
</objective>

<execution_context>
@/Users/jonathanborduas/.claude/get-shit-done/workflows/execute-plan.md
@/Users/jonathanborduas/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@agents/qgsd-quorum-worker.md
</context>

<tasks>

<task type="auto">
  <name>Task 1: Add three AI-source framing insertions to qgsd-quorum-worker.md</name>
  <files>agents/qgsd-quorum-worker.md</files>
  <action>
Read agents/qgsd-quorum-worker.md in full. Make exactly three targeted additions — no other changes.

**Addition 1 — Mode A Round 1 (no prior_positions block):**

Locate the sentence that currently reads:

  "You are one of the quorum members evaluating this question independently. Give your
  honest answer with reasoning. Be concise (3–6 sentences). State your position clearly.
  Do not defer to other models."

Replace it with:

  "You are one AI model in a multi-model quorum. Your peer reviewers in this quorum are
  other AI language models — not human users, domain experts, lawyers, or specialists.
  Evaluate this question independently. Give your honest answer with reasoning. Be concise
  (3–6 sentences). State your position clearly. Do not defer to peer models."

**Addition 2 — Mode A Round 2+ (prior_positions present):**

Locate the section that begins with:

  "Prior positions:
  <prior_positions content verbatim>"

Insert one sentence IMMEDIATELY BEFORE "Prior positions:" so it reads:

  "The following positions are from other AI models participating in this quorum — not
  from human users, domain experts, lawyers, or specialists. Evaluate them as peer AI
  opinions, not as authoritative human judgment.

  Prior positions:
  <prior_positions content verbatim>"

**Addition 3 — Mode B (both Round 1 and Round 2+):**

In the Mode B prompt section, locate the sentence:

  "Before giving your verdict, use your tools to read relevant files from the Repository
  directory above. At minimum check CLAUDE.md and .planning/STATE.md if they exist. Ground
  your verdict in what you actually find — use your internal knowledge to reason, but let
  the real files be the source of truth."

Insert one sentence AFTER that block (before "Review the execution traces above."):

  "Note: if prior_positions are present below, they are opinions from other AI models in
  this quorum — not from human users, domain experts, or specialists. Treat them as peer
  AI opinions when weighing your verdict."

Write the updated file back. Make no other changes.
  </action>
  <verify>
Run all five grep checks — the first three must return matching lines, the last two should confirm the old Round 1 sentence is gone:

```bash
grep -n "peer AI models participating in this quorum" /Users/jonathanborduas/code/QGSD/agents/qgsd-quorum-worker.md
grep -n "peer AI opinions, not as authoritative human judgment" /Users/jonathanborduas/code/QGSD/agents/qgsd-quorum-worker.md
grep -n "prior_positions are present below, they are opinions from other AI models" /Users/jonathanborduas/code/QGSD/agents/qgsd-quorum-worker.md
grep -n "You are one of the quorum members evaluating this question independently" /Users/jonathanborduas/code/QGSD/agents/qgsd-quorum-worker.md
```

The first three must produce matches. The fourth must return no output (old sentence replaced).
  </verify>
  <done>
agents/qgsd-quorum-worker.md contains all three new attribution sentences. The old Round 1 sentence "You are one of the quorum members evaluating this question independently" is gone, replaced with the peer-AI-aware version.
  </done>
</task>

<task type="auto">
  <name>Task 2: Re-install to propagate updated worker agent</name>
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
Install command exits 0. The updated qgsd-quorum-worker.md is live in ~/.claude/ and will be used by the next quorum round.
  </done>
</task>

</tasks>

<verification>
1. `grep "peer AI models participating in this quorum" agents/qgsd-quorum-worker.md` returns a match (Mode A Round 1 framing)
2. `grep "peer AI opinions, not as authoritative human judgment" agents/qgsd-quorum-worker.md` returns a match (Mode A Round 2+ framing)
3. `grep "prior_positions are present below, they are opinions from other AI models" agents/qgsd-quorum-worker.md` returns a match (Mode B framing)
4. `grep "You are one of the quorum members evaluating this question independently" agents/qgsd-quorum-worker.md` returns no output (old sentence replaced)
5. Install exits 0
</verification>

<success_criteria>
All three source-attribution sentences are in place. Worker LLMs now receive explicit framing that peer positions in the cross-pollination bundle are from AI models — not human experts. The install step confirms propagation. No other sections of the worker prompt are changed.
</success_criteria>

<output>
After completion, create `.planning/quick/99-in-the-quorum-we-need-to-make-sure-that-/99-SUMMARY.md` documenting:
- The three specific lines changed/added
- Grep verification results (all passing)
- Install exit code
- Quorum result: Claude APPROVE, OpenCode APPROVE, Codex/Gemini/Copilot UNAVAILABLE (reduced quorum noted)
</output>
