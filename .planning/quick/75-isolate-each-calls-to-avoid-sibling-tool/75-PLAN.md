---
phase: quick-75
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - commands/qgsd/mcp-status.md
autonomous: true
requirements: []

must_haves:
  truths:
    - "Each Bash call in Steps 1, 2, and 3 of mcp-status runs sequentially so a failure in one cannot cascade to siblings"
    - "The mcp-status skill document explicitly instructs Claude to run the three data-gathering bash calls one at a time, never in parallel"
    - "Installed copy at ~/.claude/qgsd/commands/qgsd/mcp-status.md reflects the same change"
  artifacts:
    - path: "commands/qgsd/mcp-status.md"
      provides: "Updated mcp-status skill with sequential bash call instructions"
      contains: "sequential"
    - path: "~/.claude/qgsd/commands/qgsd/mcp-status.md"
      provides: "Installed copy in sync with source"
  key_links:
    - from: "commands/qgsd/mcp-status.md Step 1/2/3 bash blocks"
      to: "Claude Code tool call scheduling"
      via: "explicit sequential instruction above each step"
      pattern: "sequential"
---

<objective>
Fix the sibling-tool-call cascade failure in /qgsd:mcp-status.

When Claude Code sees multiple independent Bash calls it runs them as parallel (sibling) tool calls. If the first call fails (e.g., due to the `!` zsh-history-expansion escape issue in node -e inline scripts), Claude Code marks all siblings as errored even though they would have succeeded independently.

The mcp-status skill already has this protection for Step 5 (CLI identity calls): "sequential — one at a time, never parallel". The same explicit guard must be added to Steps 1, 2, and 3 (the three bash data-gathering calls).

Purpose: Prevent a single bash failure from silently wiping out the output of all three setup steps.
Output: Updated mcp-status.md with sequential-call instruction, installed copy in sync.
</objective>

<execution_context>
@/Users/jonathanborduas/.claude/get-shit-done/workflows/execute-plan.md
@/Users/jonathanborduas/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@commands/qgsd/mcp-status.md
</context>

<tasks>

<task type="auto">
  <name>Task 1: Add sequential-call guard to Steps 1, 2, and 3 in mcp-status.md</name>
  <files>commands/qgsd/mcp-status.md</files>
  <action>
In `commands/qgsd/mcp-status.md`, update the section headers for Steps 1, 2, and 3 to add an explicit sequential instruction, matching the pattern already used in Step 5.

Current Step 5 header:
  `## Step 5: Call identity on CLI agents only (sequential — one at a time, never parallel)`

Apply the same pattern to the three bash data-gathering steps:

1. Change:
   `## Step 1: Read UNAVAIL counts from scoreboard`
   to:
   `## Step 1: Read UNAVAIL counts from scoreboard (sequential — run this bash call first, alone, before Steps 2 and 3)`

2. Change:
   `## Step 2: Load HTTP provider info from providers.json`
   to:
   `## Step 2: Load HTTP provider info from providers.json (sequential — run this bash call second, after Step 1 completes)`

3. Change:
   `## Step 3: Probe HTTP endpoints`
   to:
   `## Step 3: Probe HTTP endpoints (sequential — run this bash call third, after Step 2 completes)`

Also add a brief note at the very top of the `<process>` section (before Step 1) to make the intent unmistakable:

```
> **IMPORTANT: Run every Bash call in this workflow sequentially (one at a time). Never issue two Bash calls in parallel. A failure in one parallel sibling cancels all other parallel siblings — sequential execution isolates failures.**
```

Do NOT change any bash script content, logic, or any other part of the file.
  </action>
  <verify>
    Run: `grep -n "sequential" /Users/jonathanborduas/code/QGSD/commands/qgsd/mcp-status.md`
    Expected: at least 5 matches — the new Step 1/2/3 headers, the existing Step 5 header, and the new top-of-process note.
  </verify>
  <done>Steps 1, 2, and 3 headers all contain "sequential" and the process section opens with the IMPORTANT note about sequential execution.</done>
</task>

<task type="auto">
  <name>Task 2: Sync installed copy via install script</name>
  <files>~/.claude/qgsd/commands/qgsd/mcp-status.md</files>
  <action>
Run the install script to push the updated source file to the installed location:

```bash
node /Users/jonathanborduas/code/QGSD/bin/install.js --claude --global
```

This copies `commands/qgsd/mcp-status.md` to `~/.claude/qgsd/commands/qgsd/mcp-status.md` (and all other files). The `--claude` flag targets the Claude Code installation, `--global` installs system-wide.

After the install completes, verify the installed copy contains the sequential instruction:

```bash
grep -c "sequential" ~/.claude/qgsd/commands/qgsd/mcp-status.md
```

Expected: 5 or more matches.
  </action>
  <verify>
    `grep -c "sequential" ~/.claude/qgsd/commands/qgsd/mcp-status.md` returns 5 or more.
  </verify>
  <done>Installed copy at ~/.claude/qgsd/commands/qgsd/mcp-status.md contains all sequential guards, confirming source and install are in sync.</done>
</task>

</tasks>

<verification>
1. `grep -n "sequential" /Users/jonathanborduas/code/QGSD/commands/qgsd/mcp-status.md` — shows matches in Steps 1, 2, 3, 5 and the process-level note.
2. `grep -c "sequential" ~/.claude/qgsd/commands/qgsd/mcp-status.md` — returns >= 5.
3. Read the top of `<process>` section — the IMPORTANT sequential note is the first thing in the section.
4. Bash script content for each step is unchanged (no logic regressions).
</verification>

<success_criteria>
- Steps 1, 2, and 3 headers contain "(sequential — ...)" labels
- A top-of-process IMPORTANT note explicitly prohibits parallel Bash calls
- Installed copy matches source (install script ran successfully)
- No bash script logic was modified (pure instruction text change)
</success_criteria>

<output>
After completion, create `.planning/quick/75-isolate-each-calls-to-avoid-sibling-tool/75-SUMMARY.md`
</output>
