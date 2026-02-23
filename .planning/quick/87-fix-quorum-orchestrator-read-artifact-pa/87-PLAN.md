---
phase: quick-87
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - /Users/jonathanborduas/.claude/agents/qgsd-quorum-orchestrator.md
autonomous: true
requirements:
  - QUICK-87-GAP1
  - QUICK-87-GAP2

must_haves:
  truths:
    - "When quick.md passes artifact_path in $ARGUMENTS, the orchestrator reads that file before dispatching workers"
    - "Every worker prompt (Mode A and Mode B) includes the artifact content so workers can evaluate the actual plan"
    - "Every worker prompt includes a Repository header showing the working directory so workers know where code lives"
    - "Artifact reading is skipped gracefully when artifact_path is absent (backward compatible)"
  artifacts:
    - path: "/Users/jonathanborduas/.claude/agents/qgsd-quorum-orchestrator.md"
      provides: "Updated orchestrator spec with artifact_path parsing and cwd injection"
      contains: "artifact_path"
  key_links:
    - from: "quick.md Step 5.7 prompt"
      to: "orchestrator $ARGUMENTS parsing block"
      via: "artifact_path: <path> field in prompt text"
      pattern: "artifact_path"
    - from: "orchestrator $ARTIFACT_CONTENT"
      to: "Mode A and Mode B call-quorum-slot heredoc prompts"
      via: "injected Plan Content section"
      pattern: "ARTIFACT_CONTENT"
---

<objective>
Fix the quorum orchestrator to (1) parse and read the artifact_path file from $ARGUMENTS and inject its content into every worker prompt, and (2) inject the working directory into all worker prompts so models have repo context.

Purpose: Workers currently receive no context about what plan they are reviewing and no knowledge of where the code lives. Both gaps cause shallow or off-target quorum feedback.
Output: Updated /Users/jonathanborduas/.claude/agents/qgsd-quorum-orchestrator.md with artifact_path parsing block and cwd/artifact injection in Mode A and Mode B prompt templates.
</objective>

<execution_context>
@/Users/jonathanborduas/.claude/get-shit-done/workflows/execute-plan.md
</execution_context>

<context>
@/Users/jonathanborduas/.claude/agents/qgsd-quorum-orchestrator.md
@/Users/jonathanborduas/.claude/qgsd/workflows/quick.md
</context>

<tasks>

<task type="auto">
  <name>Task 1: Add artifact_path parsing block after the role section</name>
  <files>/Users/jonathanborduas/.claude/agents/qgsd-quorum-orchestrator.md</files>
  <action>
Insert a new "### Pre-step — Parse $ARGUMENTS extras" section immediately after the closing `</role>` tag (after line 34, before the `---` separator and Step 1 heading).

The new section must:

1. Parse artifact_path from $ARGUMENTS:
```
### Pre-step — Parse $ARGUMENTS extras

Before Step 1, extract optional fields from `$ARGUMENTS`:

**artifact_path** — if present, read the file and store as `$ARTIFACT_CONTENT`:

```bash
node -e "
const args = process.env.QGSD_ARGS || '';
const m = args.match(/artifact_path:\s*(\S+)/);
if (m) {
  const fs = require('fs');
  try {
    process.stdout.write(fs.readFileSync(m[1].trim(), 'utf8'));
  } catch(e) {
    process.stdout.write('[artifact_path read error: ' + e.message + ']');
  }
} else {
  process.stdout.write('');
}
"
```

Set `$ARTIFACT_CONTENT` to the output (empty string if artifact_path absent).

**cwd** — capture working directory:

```bash
node -e "console.log(process.cwd())"
```

Set `$REPO_DIR` to the output.
```

Note: `$ARGUMENTS` is the full prompt text passed to the orchestrator. The artifact_path line appears literally in that text (e.g. `artifact_path: /path/to/PLAN.md`). Use a simple string scan/regex on the `$ARGUMENTS` value — the orchestrator reads this as plain text, so the bash node -e script above should read `$ARGUMENTS` directly (pass it via heredoc or environment variable to avoid shell escaping issues).

Revised approach (shell-safe): use a Bash heredoc to pipe $ARGUMENTS into node, avoiding env var quoting issues:

```bash
node -e "
let args = '';
process.stdin.on('data', d => args += d);
process.stdin.on('end', () => {
  const m = args.match(/artifact_path:\s*(\S+)/);
  if (m) {
    const fs = require('fs');
    try { process.stdout.write(fs.readFileSync(m[1].trim(), 'utf8')); }
    catch(e) { process.stdout.write('[artifact_path read error: ' + e.message + ']'); }
  }
});
" <<'ARGS_EOF'
[paste full $ARGUMENTS content here at runtime]
ARGS_EOF
```

Since the orchestrator is a markdown instruction spec (not executable code), write the instructions in plain English with the pattern:

> Scan `$ARGUMENTS` text for a line matching `artifact_path: <value>`. If found, use the Read tool to read that file path. Store the file contents as `$ARTIFACT_CONTENT`. If not found or read fails, set `$ARTIFACT_CONTENT` to empty string.
>
> Capture cwd: run `Bash(pwd)` and store result as `$REPO_DIR`.

This is simpler and correct: the orchestrator is Claude, it has a Read tool. Write it as natural language instructions.
  </action>
  <verify>
Read /Users/jonathanborduas/.claude/agents/qgsd-quorum-orchestrator.md and confirm:
- A "Pre-step — Parse $ARGUMENTS extras" section exists after the role block
- It instructs the orchestrator to scan $ARGUMENTS for artifact_path
- It instructs use of the Read tool to load the file into $ARTIFACT_CONTENT
- It instructs capturing cwd via Bash(pwd) into $REPO_DIR
  </verify>
  <done>Pre-step section present, references Read tool for artifact_path, captures $REPO_DIR via pwd.</done>
</task>

<task type="auto">
  <name>Task 2: Inject $ARTIFACT_CONTENT and $REPO_DIR into Mode A and Mode B worker prompts</name>
  <files>/Users/jonathanborduas/.claude/agents/qgsd-quorum-orchestrator.md</files>
  <action>
In Mode A, the worker prompt template (the heredoc passed to call-quorum-slot.cjs) currently reads:

```
QGSD Quorum — Round 1

Question: [question]

You are one of the quorum members evaluating this question independently. Give your
honest answer with reasoning. Be concise (3–6 sentences). State your position clearly.
Do not defer to other models.
```

Replace it with:

```
QGSD Quorum — Round 1

Repository: [value of $REPO_DIR]

Question: [question]

[If $ARTIFACT_CONTENT is non-empty:]
=== Plan / Artifact ===
[full $ARTIFACT_CONTENT — not summarized]
=== End Artifact ===

[End conditional]

You are one of the quorum members evaluating this question independently. Give your
honest answer with reasoning. Be concise (3–6 sentences). State your position clearly.
Do not defer to other models.
```

In Mode A deliberation prompt, also inject:
- `Repository: [value of $REPO_DIR]` header after "QGSD Quorum — Round [N] Deliberation"
- If $ARTIFACT_CONTENT non-empty, include the artifact block before the "Given the above..." line

In Mode B, the worker prompt template currently reads:

```
QGSD Quorum — Execution Review

QUESTION: [original question]

=== EXECUTION TRACES ===
[full $TRACES — not summarized or truncated]

Review the execution traces above. Give: ...
```

Replace with:

```
QGSD Quorum — Execution Review

Repository: [value of $REPO_DIR]

QUESTION: [original question]

[If $ARTIFACT_CONTENT is non-empty:]
=== Plan / Artifact ===
[full $ARTIFACT_CONTENT — not summarized]
=== End Artifact ===

[End conditional]

=== EXECUTION TRACES ===
[full $TRACES — not summarized or truncated]

Review the execution traces above. Give: ...
```

Write all these as markdown instruction text (not code), since the orchestrator is a Claude agent spec. The instructions should say: "If $ARTIFACT_CONTENT is non-empty, include the artifact block. Always include the Repository header."
  </action>
  <verify>
Read /Users/jonathanborduas/.claude/agents/qgsd-quorum-orchestrator.md and confirm:
- Mode A Round 1 prompt template includes "Repository: [value of $REPO_DIR]"
- Mode A Round 1 prompt template references $ARTIFACT_CONTENT injection with conditional block
- Mode B execution review prompt template includes "Repository: [value of $REPO_DIR]"
- Mode B execution review prompt template references $ARTIFACT_CONTENT injection
- Mode A deliberation prompt template includes Repository header
  </verify>
  <done>
All worker-facing prompt templates in Mode A (rounds + deliberation) and Mode B include Repository header and conditional artifact block. Workers will receive plan content and repo location for every quorum call that includes an artifact_path.
  </done>
</task>

</tasks>

<verification>
After both tasks complete, manually inspect the orchestrator file:
1. grep "Pre-step" confirms the parsing section exists
2. grep "REPO_DIR" confirms cwd capture and injection in prompt templates
3. grep "ARTIFACT_CONTENT" confirms artifact injection in Mode A and Mode B templates
4. grep "artifact_path" confirms parsing instruction is present

No runtime test needed — this is a markdown agent spec; correctness is structural (instructions present and coherent).
</verification>

<success_criteria>
- Pre-step section instructs the orchestrator to extract artifact_path from $ARGUMENTS using the Read tool
- $ARTIFACT_CONTENT and $REPO_DIR are defined before Step 1 runs
- Mode A Round 1 prompt, deliberation prompt, and Mode B execution review prompt all include Repository header
- Mode A and Mode B prompts conditionally include full artifact content when $ARTIFACT_CONTENT is non-empty
- Backward compatible: artifact_path absent = no artifact block injected, no error
</success_criteria>

<output>
After completion, create .planning/quick/87-fix-quorum-orchestrator-read-artifact-pa/87-SUMMARY.md
</output>
