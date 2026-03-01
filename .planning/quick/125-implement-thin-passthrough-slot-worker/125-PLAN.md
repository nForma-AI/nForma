---
phase: quick-125
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - ~/.claude/qgsd-bin/providers.json
  - ~/.claude/agents/qgsd-quorum-slot-worker.md
autonomous: true
requirements: [QUICK-125]

must_haves:
  truths:
    - "All 12 provider entries in providers.json have has_file_access: true"
    - "Slot worker Step 2 is conditionally skipped when has_file_access is true"
    - "Prompt templates pass artifact_path (not embedded content) for has_file_access: true slots"
    - "Worker tool list is reduced to Read, Bash (Glob and Grep removed)"
    - "Thick-worker fallback path remains for future has_file_access: false slots"
    - "skip_context_reads flag is preserved for backward compatibility"
  artifacts:
    - path: "~/.claude/qgsd-bin/providers.json"
      provides: "has_file_access field on every provider entry"
      contains: "has_file_access"
    - path: "~/.claude/agents/qgsd-quorum-slot-worker.md"
      provides: "Thin passthrough worker with conditional Step 2"
      contains: "has_file_access"
  key_links:
    - from: "~/.claude/agents/qgsd-quorum-slot-worker.md"
      to: "~/.claude/qgsd-bin/providers.json"
      via: "Worker reads has_file_access from slot config to decide thin vs thick path"
      pattern: "has_file_access"
    - from: "~/.claude/agents/qgsd-quorum-slot-worker.md"
      to: "call-quorum-slot.cjs"
      via: "Bash call unchanged — Step 4 dispatch is identical"
      pattern: "call-quorum-slot.cjs"
---

<objective>
Implement thin passthrough slot worker: eliminate redundant Haiku file exploration for
coding-agent slots that have their own file system access. This reduces Haiku round-trips
from 5-7 down to 1 per worker, saving ~90% of Haiku input tokens and 3-7 seconds of
wall-clock time per quorum slot.

Purpose: All 12 current quorum slots are full coding agents with file access (verified in
quick-123 research). The worker currently reads files (Step 2) then embeds their content
in the prompt (Step 3), only for the downstream agent to re-read those same files. This
is pure waste. The thin worker passes file paths instead of content, letting the downstream
agent read files itself.

Output: Updated providers.json with has_file_access field, updated slot worker agent
definition with conditional thin/thick path.
</objective>

<execution_context>
@/Users/jonathanborduas/.claude/qgsd/workflows/execute-plan.md
@/Users/jonathanborduas/.claude/qgsd/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@.planning/quick/123-research-slot-worker-architecture-map-mc/123-RESEARCH.md
@~/.claude/agents/qgsd-quorum-slot-worker.md
@~/.claude/qgsd-bin/providers.json
</context>

<tasks>

<task type="auto">
  <name>Task 1: Add has_file_access field to all providers in providers.json</name>
  <files>~/.claude/qgsd-bin/providers.json</files>
  <action>
Read `~/.claude/qgsd-bin/providers.json`. Add `"has_file_access": true` to every provider
entry in the `providers` array (all 12 entries). Place the field after the `type` field for
consistent positioning.

All 12 current slots are subprocess coding agents with verified file system access (per
123-RESEARCH.md section 1.1). Every entry gets `true`. Future HTTP text-only slots would
set this to `false`.

Do NOT change any other field in providers.json. The only diff should be the addition of
`"has_file_access": true` on 12 lines.
  </action>
  <verify>
Run: `node -e "const p = require('$HOME/.claude/qgsd-bin/providers.json'); const all = p.providers.every(s => s.has_file_access === true); const count = p.providers.filter(s => s.has_file_access === true).length; console.log('all_true:', all, 'count:', count, 'total:', p.providers.length)"`

Expected output: `all_true: true count: 12 total: 12`

Also verify JSON is valid: `node -e "JSON.parse(require('fs').readFileSync('$HOME/.claude/qgsd-bin/providers.json', 'utf8')); console.log('JSON valid')"`
  </verify>
  <done>All 12 provider entries have has_file_access: true. JSON is valid. No other fields changed.</done>
</task>

<task type="auto">
  <name>Task 2: Rewrite slot worker to thin passthrough with conditional thick fallback</name>
  <files>~/.claude/agents/qgsd-quorum-slot-worker.md</files>
  <action>
Read `~/.claude/agents/qgsd-quorum-slot-worker.md`. Rewrite it with these specific changes:

**A. Frontmatter tool list** (line 7):
Change `tools: Read, Bash, Glob, Grep` to `tools: Read, Bash`.
Glob and Grep are removed — they were only used in Step 2 exploratory reads.
Read is kept for future `has_file_access: false` slots that need content embedding.

**B. Role description** (lines 1-26):
Update the role description to reflect the thin/thick dual-path architecture. Specifically:
- Change step 2 description from "Read repository context" to "Conditionally read repository context (thick path only)"
- Add note: "For has_file_access: true slots (all current slots), skip Step 2 entirely — the downstream agent reads files itself."

**C. Step 1 -- Parse arguments** (lines 30-65):
Add a new step after parsing `$ARGUMENTS`: read `has_file_access` for this slot from providers.json.

After the existing argument parsing, add:
```
**Resolve slot capability:**
Read `~/.claude/qgsd-bin/providers.json` (use Read tool). Find the provider entry
where `name` matches `<slot>`. Extract `has_file_access` (boolean). Store as
`$HAS_FILE_ACCESS`. If the field is missing, default to `false` (thick path -- safe fallback).
```

This is the ONE Read tool call the thin worker needs (the providers.json config lookup).

**D. Step 2 -- Conditional context reads** (lines 69-84):
Replace the current unconditional Step 2 with a conditional:

```
### Step 2 -- Read repository context (THICK PATH ONLY)

**Skip this entire step if `$HAS_FILE_ACCESS` is `true`.**

When `has_file_access` is true, the downstream coding agent will read files itself.
The worker does not need to pre-read or embed any file content. Proceed directly to Step 3.

**Skip guard (Round 2+):** If `skip_context_reads: true` AND `round > 1`, also skip
this entire step regardless of `$HAS_FILE_ACCESS`.

**Thick path (has_file_access: false):**
Use the Read tool to load context files from `repo_dir`:
- `<repo_dir>/CLAUDE.md` -- if it exists, read it fully
- `<repo_dir>/.planning/STATE.md` -- if it exists, read it fully
- `<repo_dir>/.planning/ROADMAP.md` -- skip unless question references it directly

If `artifact_path` is present, read that file fully and store as `$ARTIFACT_CONTENT`.
```

Note: The Glob/Grep exploratory reads ("max 2-3 additional reads") are REMOVED entirely.
They added 2-3 Haiku round-trips for marginal context that the downstream agent can
gather itself. Even the thick path no longer does exploratory searches.

**E. Step 3 -- Prompt template changes** (lines 87-211):
The prompt templates need TWO variants based on `$HAS_FILE_ACCESS`:

**For Mode A prompt (Round 1, has_file_access: true -- THIN PATH):**
Replace the artifact block:
```
[If artifact_path present:]
=== Artifact ===
Path: <artifact_path>
(Read this file yourself using your file system tools before evaluating.)
================
```

And replace the Round 1 "IMPORTANT: Before answering..." instruction with:
```
IMPORTANT: Before answering, use your available tools to read the following files
from the repository:
- <repo_dir>/CLAUDE.md (if it exists -- project policy)
- <repo_dir>/.planning/STATE.md (if it exists -- project state)
- <artifact_path> (the artifact to evaluate)
Plus any files directly relevant to the question. Your answer must be grounded
in what you actually find in the repo.

You are one AI model in a multi-model quorum. Your peer reviewers are other AI language
models -- not human experts. Give your honest answer with reasoning. Be concise (3-6
sentences). Do not defer to peer models.
```

**For Mode A prompt (has_file_access: false -- THICK PATH):**
Keep the current behavior with `$ARTIFACT_CONTENT` embedded.

**For Mode A prompt (Round 2+, has_file_access: true -- THIN PATH):**
Replace the artifact block the same way (path-only, no content).
The "Before revising your position" instruction should say:
```
Before revising your position, use your tools to re-read any codebase files relevant
to the disagreement. At minimum read <repo_dir>/CLAUDE.md and <repo_dir>/.planning/STATE.md
if they exist, plus <artifact_path>.
```

**For Mode B prompt (has_file_access: true -- THIN PATH):**
Same pattern -- artifact block uses path-only reference, and the instruction says to read
files before giving verdict.

**For Mode B prompt (has_file_access: false -- THICK PATH):**
Keep the current behavior with `$ARTIFACT_CONTENT` embedded.

**Implementation approach:** Structure the prompt section with a clear conditional:
```
**If `$HAS_FILE_ACCESS` is `true` (thin path):** use path-only artifact block and
file-read instructions for the downstream agent.

**If `$HAS_FILE_ACCESS` is `false` (thick path):** use embedded `$ARTIFACT_CONTENT`
artifact block (current behavior).
```

Do NOT duplicate the entire prompt template. Use the conditional only around the
differing sections (artifact block and file-read instructions). The rest of the
prompt structure (question, review_context, prior_positions, response format,
request_improvements) stays identical between thin and thick paths.

**F. Steps 4 and 5 -- No changes:**
Step 4 (Bash call to cqs.cjs) and Step 5 (parse output) remain exactly as they are.
The dispatch mechanism and output parsing are unaffected by the thin/thick change.

**G. Arguments block** (lines 280-297):
No changes needed. The `artifact_path` and `skip_context_reads` fields remain.
  </action>
  <verify>
1. Verify the file exists and is well-formed:
   `cat ~/.claude/agents/qgsd-quorum-slot-worker.md | head -10` -- should show updated
   frontmatter with `tools: Read, Bash`

2. Verify thin path conditional is present:
   `grep -c "has_file_access" ~/.claude/agents/qgsd-quorum-slot-worker.md` -- should be >= 5
   (appears in role, Step 1 resolve, Step 2 skip guard, Step 3 thin/thick conditionals)

3. Verify Glob/Grep are NOT in tool list:
   `head -10 ~/.claude/agents/qgsd-quorum-slot-worker.md | grep -c "Glob\|Grep"` -- should be 0

4. Verify thick path is preserved:
   `grep -c "ARTIFACT_CONTENT" ~/.claude/agents/qgsd-quorum-slot-worker.md` -- should be >= 1
   (thick path still embeds content for has_file_access: false slots)

5. Verify providers.json read instruction exists:
   `grep -c "providers.json" ~/.claude/agents/qgsd-quorum-slot-worker.md` -- should be >= 1

6. Verify Step 4 and Step 5 are intact:
   `grep -c "call-quorum-slot.cjs" ~/.claude/agents/qgsd-quorum-slot-worker.md` -- should be >= 1
   `grep -c "Step 5" ~/.claude/agents/qgsd-quorum-slot-worker.md` -- should be >= 1
  </verify>
  <done>
Slot worker agent definition has been rewritten with:
- Tool list reduced to Read, Bash (no Glob, Grep)
- Step 1 includes providers.json lookup for has_file_access
- Step 2 is skipped entirely for has_file_access: true slots
- Prompt templates pass artifact_path (not content) for thin path
- Thick path preserved for future has_file_access: false slots
- Steps 4 and 5 unchanged
  </done>
</task>

</tasks>

<verification>
1. providers.json has has_file_access: true on all 12 entries, JSON is valid
2. Slot worker frontmatter tools are Read, Bash only
3. Slot worker conditionally skips Step 2 based on has_file_access
4. Thin path prompt references artifact_path without embedding content
5. Thick path prompt still embeds $ARTIFACT_CONTENT for has_file_access: false
6. Steps 4 (Bash dispatch) and 5 (output parsing) are unchanged
7. skip_context_reads flag is preserved for backward compatibility
</verification>

<success_criteria>
- A quorum invocation with any of the 12 current slots will take the thin path:
  worker does 2 tool calls (Read providers.json + Bash to cqs.cjs) instead of 5-7
- The prompt sent to downstream agents instructs them to read files themselves
- If a future has_file_access: false slot is added to providers.json, the worker
  will automatically take the thick path and embed file content
- No functional regression: quorum verdicts still return the same structured format
</success_criteria>

<output>
After completion, create `.planning/quick/125-implement-thin-passthrough-slot-worker/125-SUMMARY.md`
</output>
