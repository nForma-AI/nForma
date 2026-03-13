---
phase: quick-275
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - commands/nf/proximity.md
autonomous: true
formal_artifacts: none
must_haves:
  truths:
    - "Running /nf:proximity without ANTHROPIC_API_KEY still completes Step 4 evaluation via sub-agent fallback"
    - "Sub-agent evaluation produces the same output schema as haiku-semantic-eval.cjs: verdict (yes/no/maybe), confidence (0.0-1.0 decimal), reasoning (string)"
    - "Step 4 output indicates which evaluation path ran (script vs sub-agent fallback) for debugging visibility"
    - "The script haiku-semantic-eval.cjs is attempted first; sub-agent fallback only triggers on script failure (exit non-zero)"
    - "Steps 5-6 consume candidates.json identically regardless of which evaluation path ran"
  artifacts:
    - path: "commands/nf/proximity.md"
      provides: "Fallback sub-agent evaluation logic in Step 4"
      contains: "sub-agent"
  key_links:
    - from: "commands/nf/proximity.md Step 4"
      to: "bin/haiku-semantic-eval.cjs"
      via: "Bash invocation with exit code check"
      pattern: "haiku-semantic-eval"
    - from: "commands/nf/proximity.md Step 4 fallback"
      to: ".planning/formal/candidates.json"
      via: "Read candidates, dispatch Haiku sub-agents, write back verdicts"
      pattern: "candidates.json"
---

<objective>
Rewrite Step 4 of the /nf:proximity skill to fall back to inline Haiku sub-agent evaluation when the haiku-semantic-eval.cjs script fails (e.g., missing ANTHROPIC_API_KEY inside Claude Code).

Purpose: Inside Claude Code, subprocess environment lacks ANTHROPIC_API_KEY, so the script always exits 1. The sub-agent fallback uses Task(model="haiku") which works via the user's Claude subscription.
Output: Updated proximity.md with try-script-then-sub-agent logic in Step 4.
</objective>

<execution_context>
@/Users/jonathanborduas/.claude/nf/workflows/execute-plan.md
@/Users/jonathanborduas/.claude/nf/templates/summary.md
</execution_context>

<context>
@commands/nf/proximity.md
@bin/haiku-semantic-eval.cjs
</context>

<tasks>

<task type="auto">
  <name>Task 1: Rewrite Step 4 in proximity.md with script-first, sub-agent fallback</name>
  <files>commands/nf/proximity.md</files>
  <action>
Replace the entire Step 4 section in commands/nf/proximity.md with the following logic:

**Step 4: Haiku semantic evaluation**

If `--skip-eval` is set:
- Report: "Skipped (--skip-eval)"
- Continue to step 5

Otherwise, attempt the script first:

**4a. Try script:**
- Run: `node bin/haiku-semantic-eval.cjs` via Bash
- If exit code is 0: display verdict distribution from stderr output ("Evaluation complete (via: script). yes: X, no: Y, maybe: Z") and continue to Step 5. Done.
- If exit code is non-zero: log the error, then proceed to 4b (sub-agent fallback).

**4b. Sub-agent fallback:**
- Log: "Script failed (likely missing ANTHROPIC_API_KEY). Falling back to sub-agent evaluation."
- Read `.planning/formal/candidates.json` and parse the candidates array.
- Filter to candidates that do NOT already have a `verdict` field (respect cache, same as the script does).
- If no candidates need evaluation, report "All candidates already evaluated (cached)" and continue.
- For each unevaluated candidate, dispatch a Haiku sub-agent with this prompt (matching the script's prompt format):

```
You are evaluating whether a formal model semantically satisfies a requirement.
Model path: {candidate.model}
Requirement ID: {candidate.requirement}
Does this model address the intent of this requirement? Consider both direct coverage and transitive coverage through related models.
Respond ONLY with valid JSON: {"verdict":"yes"|"no"|"maybe","confidence":<decimal 0.0-1.0>,"reasoning":"..."}
Note: confidence MUST be a decimal between 0.0 and 1.0 (NOT 0-100).
```

- Parse each sub-agent response as JSON. On any parse failure OR missing/invalid fields, fill defaults: `verdict="maybe"`, `confidence=0.0`, `reasoning=""`. Concretely: if JSON.parse throws, use all defaults; if JSON is valid but `verdict` is missing/invalid, default that field; if `confidence` is missing/non-numeric, default to `0.0`; if `reasoning` is missing, default to `""`.
- Normalize verdict: only "yes", "no", or "maybe" are valid; anything else becomes "maybe".
- Set on each candidate: `verdict`, `confidence`, `reasoning`, and `evaluation_timestamp` (ISO 8601).
- If candidate count exceeds 10, batch into groups of 10 and process each batch sequentially. Pseudo-code for the skill text:
  ```
  batches = chunk(unevaluatedCandidates, 10)
  for each batch in batches:
    for each candidate in batch:
      dispatch Haiku sub-agent with prompt (as above)
      parse response, apply defaults on failure
      set verdict/confidence/reasoning/evaluation_timestamp on candidate
    log "Batch {i}/{len(batches)} complete"
  ```
- After all candidates are evaluated, write the full candidates.json back to `.planning/formal/candidates.json` (preserving metadata, updating only the candidates array entries).
- Display verdict distribution AND which eval path ran: "Evaluation complete (via: script|sub-agent fallback). yes: X, no: Y, maybe: Z"

**Important details to include in the skill text:**
- The `allowed-tools` frontmatter already includes Read and Bash, which is sufficient. The sub-agent dispatch uses Task() which does not need to be in allowed-tools (it is always available).
- The write-back must use the Write tool (or Bash with node -e) to update candidates.json. Add Write to the allowed-tools frontmatter list since the sub-agent fallback needs to write candidates.json.
- The progress line stays: `[3/6] Running semantic evaluation (Haiku)...`
- Do NOT modify the script haiku-semantic-eval.cjs itself.

**Frontmatter update:**
- Add `Write` to the `allowed-tools` list (needed for sub-agent fallback to write candidates.json back).

**Notes section update:**
- Add a note: "Step 4 tries the haiku-semantic-eval.cjs script first (works with ANTHROPIC_API_KEY). If the script fails, it falls back to inline Haiku sub-agent evaluation via Task(model='haiku'). Both paths produce identical output in candidates.json."
  </action>
  <verify>
1. Read the updated commands/nf/proximity.md and confirm:
   - Step 4 has two sub-sections: 4a (script attempt) and 4b (sub-agent fallback)
   - The prompt text in 4b matches the script's prompt format (model path, requirement ID, JSON response format)
   - allowed-tools includes Write
   - Notes section mentions the fallback behavior
2. `grep -c 'sub-agent' commands/nf/proximity.md` returns 3 or more matches
3. `grep 'Write' commands/nf/proximity.md` confirms Write is in allowed-tools
4. `grep 'verdict.*yes.*no.*maybe' commands/nf/proximity.md` confirms output schema is documented
  </verify>
  <done>Step 4 attempts haiku-semantic-eval.cjs first, falls back to inline Haiku sub-agent evaluation on failure. Output schema (verdict/confidence/reasoning) matches the script. candidates.json is written back correctly for Steps 5-6. Write tool added to allowed-tools. Notes document the fallback.</done>
</task>

</tasks>

<verification>
1. `grep 'haiku-semantic-eval' commands/nf/proximity.md` confirms script is still referenced (try-first path)
2. `grep -c 'sub-agent\|Task(' commands/nf/proximity.md` returns multiple matches (fallback path documented)
3. `grep 'Write' commands/nf/proximity.md` confirms Write in allowed-tools
4. The candidates.json output schema fields (verdict, confidence, reasoning, evaluation_timestamp) appear in the skill text
5. Step 5 and Step 6 are unchanged — they consume candidates.json the same way regardless of evaluation path
</verification>

<success_criteria>
- proximity.md Step 4 tries the script first, falls back to sub-agent on failure
- Sub-agent prompt matches haiku-semantic-eval.cjs prompt format exactly
- Output schema is identical: verdict (yes/no/maybe), confidence (0.0-1.0 decimal), reasoning (string), evaluation_timestamp
- Step 4 output line includes which eval path ran (script vs sub-agent fallback)
- Write tool added to allowed-tools frontmatter
- Steps 5-6 remain unchanged
- haiku-semantic-eval.cjs is NOT modified
</success_criteria>

<output>
After completion, create `.planning/quick/275-replace-haiku-api-eval-with-sub-agent-in/275-SUMMARY.md`
</output>
