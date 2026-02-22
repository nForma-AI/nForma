---
phase: quick-46
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - commands/qgsd/quorum.md
  - commands/qgsd/quorum-test.md
autonomous: true
requirements: []
must_haves:
  truths:
    - "Running /qgsd:quorum produces a compact status header, not a stream of Step N: labels"
    - "Running /qgsd:quorum-test does not narrate internal step numbers as output"
    - "The quorum orchestrator agent output format is unchanged (it is output-only, not user-facing step narration)"
  artifacts:
    - path: "commands/qgsd/quorum.md"
      provides: "Main quorum command with reduced step label verbosity"
    - path: "commands/qgsd/quorum-test.md"
      provides: "Quorum-test command with reduced step label verbosity"
  key_links:
    - from: "commands/qgsd/quorum.md"
      to: "qgsd-quorum-orchestrator"
      via: "Task subagent_type spawn"
      pattern: "qgsd-quorum-orchestrator"
---

<objective>
Reduce quorum verbosity: remove numbered step labels and redundant inline narration from the quorum workflow files so execution produces a compact, scannable trace rather than a stream of "Step N:" announcements.

Purpose: The current quorum.md and quorum-test.md use numbered Markdown headers (## Step 0, ### Step 1, etc.) and inline `Display:` blocks that cause Claude to narrate each phase. This clutters the UI during every planning command. The fix converts step headers to unnumbered prose sections and collapses redundant display blocks into single-line or silent operations.

Output: Two updated workflow files with minimal step narration.
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
  <name>Task 1: Reduce verbosity in commands/qgsd/quorum.md</name>
  <files>commands/qgsd/quorum.md</files>
  <action>
Edit commands/qgsd/quorum.md to remove numbered step labels from the output narrative and collapse redundant display blocks:

1. **Step headers**: Convert all `## Step N:` and `### Step N:` headers to plain Markdown `###` or `####` sections WITHOUT the "Step N:" prefix. The heading text already describes the action — the number is noise. Example: `## Step 0: Team identity capture` → `### Team identity capture`. `### Step 2: Claude forms position (Round 1)` → `### Claude's position (Round 1)`.

2. **"Forming Claude's position..." display block**: Remove the trailing `Forming Claude's position...` line from the Mode A banner display block (lines ~88-89 in current file). The banner already says `Mode A — Pure Question` and shows the question — the "Forming..." line is narrated progress noise.

3. **`Claude (Round 1):` label**: Keep this — it is part of the structured output table that identifies Claude's position. Do NOT remove it.

4. **`### Step 3: Query each model sequentially` narration**: The step header and the bold "Call order (sequential):" sub-header are instructions, not output. These become visible because Claude narrates the section title. Change `### Step 3: Query each model sequentially` to `### Query models (sequential)` — drops the step number.

5. **Mode B step headers** (`### Step 1: Parse commands`, `### Step 2: Execute`, etc.): Same treatment — strip "Step N:" from all Mode B step headers. Keep the descriptive text.

6. **`### Step 4: Evaluate Round 1`** → `### Evaluate Round 1 — check for consensus`

7. **`### Step 5: Deliberation rounds`** → `### Deliberation rounds (R3.3)`

8. **`### Step 6: Consensus output`** → `### Consensus output`

9. **`### Step 7: Escalate`** → `### Escalate — no consensus after 4 rounds`

Do NOT change:
- The ━━━ banner blocks (those are intentional status output)
- The scoreboard `bash` code blocks
- The quorum prompt templates
- Any structured output tables
- The `## Mode A` and `## Mode B` top-level section headers (these are navigation, not step narration)
  </action>
  <verify>
Run: grep -n "Step [0-9]" /Users/jonathanborduas/code/QGSD/commands/qgsd/quorum.md
Expected: zero matches (all "Step N:" patterns removed from headers).
Also confirm the file still contains "Team identity capture", "Claude's position", "Query models", "Consensus output" as section headers.
  </verify>
  <done>
commands/qgsd/quorum.md contains no "Step N:" header labels. All step content is preserved under renamed headers. The ━━━ banners and output tables are unchanged.
  </done>
</task>

<task type="auto">
  <name>Task 2: Reduce verbosity in commands/qgsd/quorum-test.md</name>
  <files>commands/qgsd/quorum-test.md</files>
  <action>
Edit commands/qgsd/quorum-test.md to remove numbered step labels from all bold step headers:

1. **`**Step 0: Detect test runner**`** → `**Detect test runner**`
2. **`**Step 1: Parse and validate target**`** → `**Parse and validate target**`
3. **`**Step 2: Capture execution bundle**`** → `**Capture execution bundle**`
4. **`**Step 3: Immediate BLOCK if exit code ≠ 0**`** → `**Immediate BLOCK if exit code is non-zero**`
5. **`**Step 4: Assemble bundle**`** → `**Assemble bundle**`
6. **`**Step 5: Dispatch parallel quorum workers**`** → `**Dispatch parallel quorum workers**`
7. **`**Step 6: Collect verdicts and render table**`** → `**Collect verdicts and render table**`
8. **`**Step 7: Save artifact**`** → `**Save artifact**`

Also remove the sub-label `**1a. Parse `$ARGUMENTS`:**`, `**1b. Empty check:**`, `**1c. File existence check:**`, `**1d. Validation summary:**` — replace these with plain prose sentences introducing each sub-block (e.g., "Parse `$ARGUMENTS`:" without the bold `1a.` prefix). The letter-number prefixes (1a, 1b, 1c, 1d) add no value once the parent Step label is gone.

Do NOT change:
- The ━━━ banner display blocks (those are user-visible status output — keep them)
- The bash code blocks
- The worker prompt template
- The verdict table structure
  </action>
  <verify>
Run: grep -n "Step [0-9]\|**[0-9][a-z]\." /Users/jonathanborduas/code/QGSD/commands/qgsd/quorum-test.md
Expected: zero matches.
Also confirm "Detect test runner", "Capture execution bundle", "Dispatch parallel quorum workers" remain as section headers.
  </verify>
  <done>
commands/qgsd/quorum-test.md contains no "Step N:" or "Na." sub-label patterns. All logic and code blocks are intact.
  </done>
</task>

</tasks>

<verification>
After both tasks:
1. grep -rn "Step [0-9]" /Users/jonathanborduas/code/QGSD/commands/qgsd/quorum.md /Users/jonathanborduas/code/QGSD/commands/qgsd/quorum-test.md — should return nothing
2. Both files should be syntactically valid Markdown (no broken fences, no orphaned headers)
3. quick.md workflow is NOT modified — its step labels are internal orchestration prose and are not the source of the reported verbosity (they are instructions, not display blocks)
4. The quorum orchestrator at ~/.claude/gsd-local-patches/agents/qgsd-quorum-orchestrator.md is NOT modified — its round headers (ROUND 1, ROUNDS 2-4) are section names in the agent system prompt, not user-visible step narration
</verification>

<success_criteria>
- Both quorum command files have zero "Step N:" header labels
- All quorum logic, prompt templates, bash blocks, and ━━━ banners are preserved intact
- A quorum invocation no longer narrates "Step 0: Team identity capture", "Step 2: Claude's position (Round 1)", "Step 3: Query each model sequentially" as visible output lines
</success_criteria>

<output>
After completion, create `.planning/quick/46-review-all-quorum-invocation-sites-and-r/46-SUMMARY.md`
</output>
