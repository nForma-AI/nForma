---
phase: quick-131
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - agents/qgsd-quorum-slot-worker.md
  - ~/.claude/agents/qgsd-quorum-slot-worker.md
autonomous: true
requirements: [QUICK-131]
must_haves:
  truths:
    - "tools: frontmatter lists Bash only (Read, Glob, Grep removed)"
    - "Step 2 is gone — no file reads by the worker itself"
    - "Step 3 prompt template passes artifact_path by reference, not embedded content"
    - "Step 3 prompt instructs downstream agent to read CLAUDE.md, STATE.md, and artifact_path"
    - "Both repo file and installed file are identical after the rewrite"
  artifacts:
    - path: "agents/qgsd-quorum-slot-worker.md"
      provides: "Thin passthrough worker (repo source)"
      contains: "tools: Bash"
    - path: "~/.claude/agents/qgsd-quorum-slot-worker.md"
      provides: "Thin passthrough worker (installed)"
      contains: "tools: Bash"
  key_links:
    - from: "agents/qgsd-quorum-slot-worker.md"
      to: "~/.claude/agents/qgsd-quorum-slot-worker.md"
      via: "cp command in task"
      pattern: "cp.*qgsd-quorum-slot-worker"
---

<objective>
Rewrite qgsd-quorum-slot-worker.md as a thin passthrough agent that delegates all file
reading to the downstream quorum slot agent, rather than doing file reads itself.

Purpose: The worker's Read/Glob/Grep tool calls are redundant — the downstream agent
already has has_file_access: true in providers.json and receives the repository path.
Removing them eliminates duplicate file I/O, reduces worker context usage, and simplifies
the worker's responsibilities.

Output: Both repo (agents/qgsd-quorum-slot-worker.md) and installed
(~/.claude/agents/qgsd-quorum-slot-worker.md) are rewritten identically as thin
passthrough workers. No other files are touched.
</objective>

<execution_context>
@/Users/jonathanborduas/.claude/qgsd/workflows/execute-plan.md
@/Users/jonathanborduas/.claude/qgsd/templates/summary.md
</execution_context>

<context>
@/Users/jonathanborduas/code/QGSD/.planning/STATE.md
</context>

<tasks>

<task type="auto">
  <name>Task 1: Rewrite both qgsd-quorum-slot-worker.md files as thin passthrough</name>
  <files>
    /Users/jonathanborduas/code/QGSD/agents/qgsd-quorum-slot-worker.md
    /Users/jonathanborduas/.claude/agents/qgsd-quorum-slot-worker.md
  </files>
  <action>
Rewrite /Users/jonathanborduas/code/QGSD/agents/qgsd-quorum-slot-worker.md with the
following changes applied to the current content:

1. FRONTMATTER — change description and tools:
   - description: Change "Reads repo context, calls the slot via call-quorum-slot.cjs (Bash), and returns a structured result block." to "Thin passthrough — builds and sends the question prompt via call-quorum-slot.cjs (Bash). Context reading is delegated to the downstream agent. Returns a structured result block."
   - tools: Change from `Read, Bash, Glob, Grep` to `Bash`

2. ROLE SECTION — remove bullet 2 "Read repository context." and renumber:
   Replace the 5-bullet list with a 4-bullet list:
   ```
   1. Parse `$ARGUMENTS` (YAML block, see <arguments>).
   2. Build the question prompt for this slot and round.
   3. Call the slot via Bash (call-quorum-slot.cjs) — no MCP tools.
   4. Return a structured result block. No scoreboard updates. No file writes.
   ```

3. REMOVE STEP 2 ENTIRELY — delete the entire "### Step 2 — Read repository context"
   section (lines beginning with "### Step 2" through the trailing "---" separator before
   "### Step 3"). This includes the skip guard paragraph, the Read tool instructions,
   the artifact_path read instruction, and the Glob/Grep instruction.

4. STEP 3 PROMPT TEMPLATE — Mode A:
   a. Replace the artifact embedding block:
      OLD:
      ```
      [If artifact_path present:]
      === Artifact ===
      Path: <artifact_path>
      <$ARTIFACT_CONTENT — full content>
      ================
      ```
      NEW:
      ```
      [If artifact_path present:]
      === Artifact ===
      Path: <artifact_path>
      (Read this file to obtain its full content before evaluating.)
      ================
      ```
   b. In the Round 1 instruction block (starting "IMPORTANT: Before answering..."),
      update the instruction to also reference artifact_path:
      OLD:
      "IMPORTANT: Before answering, use your available tools to read relevant files from the
      Repository directory above. At minimum check CLAUDE.md and .planning/STATE.md if they
      exist, plus any files directly relevant to the question."
      NEW:
      "IMPORTANT: Before answering, use your available tools to read files from the
      Repository directory above. At minimum read: CLAUDE.md (if it exists),
      .planning/STATE.md (if it exists), and the artifact file at the path shown in the
      Artifact section above (if present). Then read any other files directly relevant to
      the question."
   c. In the Round 2+ cross-pollination block, update the re-read instruction:
      OLD: "Before revising your position, use your tools to re-check any codebase files relevant
      to the disagreement. At minimum re-read CLAUDE.md and .planning/STATE.md if they exist."
      NEW: "Before revising your position, use your tools to re-check relevant files. At minimum
      re-read CLAUDE.md and .planning/STATE.md if they exist, and re-read the artifact file if
      one was provided."

5. STEP 3 PROMPT TEMPLATE — Mode B:
   a. Same artifact embedding replacement as Mode A (replace `$ARTIFACT_CONTENT` with read instruction).
   b. Update the verdict instruction:
      OLD: "Before giving your verdict, use your tools to read relevant files from the Repository
      directory above. At minimum check CLAUDE.md and .planning/STATE.md if they exist."
      NEW: "Before giving your verdict, use your tools to read files from the Repository directory
      above. At minimum read: CLAUDE.md (if it exists), .planning/STATE.md (if it exists), and
      the artifact file at the path shown above (if present)."

6. Remove the `skip_context_reads` optional field from both the arguments description in
   Step 1 AND the <arguments> block at the bottom of the file. This field only made sense
   when Step 2 existed — with Step 2 gone, it is obsolete.

After writing the repo file, copy it verbatim to the installed location:
`cp /Users/jonathanborduas/code/QGSD/agents/qgsd-quorum-slot-worker.md /Users/jonathanborduas/.claude/agents/qgsd-quorum-slot-worker.md`

Do NOT use any heredoc or cat-based Bash to write files — use the Write tool.
Do NOT touch providers.json.
Do NOT touch any other file.
  </action>
  <verify>
Run these checks to confirm both files are correct:

```bash
# 1. tools line shows Bash only
grep "^tools:" /Users/jonathanborduas/code/QGSD/agents/qgsd-quorum-slot-worker.md
# Expected: tools: Bash

# 2. Step 2 heading is gone
grep "Step 2" /Users/jonathanborduas/code/QGSD/agents/qgsd-quorum-slot-worker.md
# Expected: no output

# 3. ARTIFACT_CONTENT variable is gone
grep "ARTIFACT_CONTENT" /Users/jonathanborduas/code/QGSD/agents/qgsd-quorum-slot-worker.md
# Expected: no output

# 4. skip_context_reads is gone
grep "skip_context_reads" /Users/jonathanborduas/code/QGSD/agents/qgsd-quorum-slot-worker.md
# Expected: no output

# 5. artifact read instruction present
grep "Read this file to obtain" /Users/jonathanborduas/code/QGSD/agents/qgsd-quorum-slot-worker.md
# Expected: one match

# 6. Both files are identical
diff /Users/jonathanborduas/code/QGSD/agents/qgsd-quorum-slot-worker.md \
     /Users/jonathanborduas/.claude/agents/qgsd-quorum-slot-worker.md
# Expected: no output (identical)
```
  </verify>
  <done>
Both files exist, are identical, have `tools: Bash` in frontmatter, contain no Step 2
section, contain no `$ARTIFACT_CONTENT` embedding, contain no `skip_context_reads`
references, and include the downstream read instruction in the artifact section and
Round 1 / Round 2+ instruction blocks.
  </done>
</task>

</tasks>

<verification>
After task completes:
- grep "^tools:" agents/qgsd-quorum-slot-worker.md → "tools: Bash"
- grep "Step 2" agents/qgsd-quorum-slot-worker.md → no output
- grep "ARTIFACT_CONTENT" agents/qgsd-quorum-slot-worker.md → no output
- diff both files → no differences
</verification>

<success_criteria>
Both qgsd-quorum-slot-worker.md files (repo + installed) are thin passthrough agents:
Bash-only tools, no Step 2 file reads, artifact passed by path reference with downstream
read instruction, skip_context_reads field removed. The downstream quorum slot agents
are fully responsible for reading CLAUDE.md, STATE.md, and the artifact file.
</success_criteria>

<output>
After completion, create /Users/jonathanborduas/code/QGSD/.planning/quick/131-rewrite-qgsd-quorum-slot-worker-thin-pas/131-SUMMARY.md
</output>
