---
phase: quick-237
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - bin/quorum-slot-dispatch.cjs
  - bin/debate-formatter.cjs
  - .planning/quorum/debates/_TEMPLATE.md
autonomous: true
formal_artifacts: none
requirements: [DISP-06]

must_haves:
  truths:
    - "emitResultBlock YAML output includes matched_requirement_ids field when IDs are available"
    - "Each successful slot dispatch writes a per-slot debate trace file to .planning/quorum/debates/"
    - "Debate trace files contain frontmatter with date, question, slot, round, verdict, matched_requirement_ids, artifact_path"
    - "File write failures do not block dispatch (fail-open)"
  artifacts:
    - path: "bin/quorum-slot-dispatch.cjs"
      provides: "Enriched result block + auto-persist debate trace"
    - path: "bin/debate-formatter.cjs"
      provides: "Updated validation accepting new frontmatter fields"
    - path: ".planning/quorum/debates/_TEMPLATE.md"
      provides: "Updated template with requirement_ids and artifact_path fields"
  key_links:
    - from: "bin/quorum-slot-dispatch.cjs"
      to: "bin/planning-paths.cjs"
      via: "resolve('quorum-debate', { filename })"
      pattern: "resolve.*quorum-debate"
    - from: "bin/quorum-slot-dispatch.cjs"
      to: ".planning/quorum/debates/"
      via: "fs.writeFileSync debate trace"
      pattern: "writeFileSync.*debatePath"
---

<objective>
Persist quorum debate traces with matched requirement IDs in two layers: (1) enrich the YAML result block emitted by emitResultBlock with matched_requirement_ids, and (2) auto-write a per-slot debate trace file to .planning/quorum/debates/ after each successful dispatch.

Purpose: Creates a durable audit trail linking quorum slot verdicts to the formal requirements they evaluated, enabling post-hoc analysis of which requirements drive APPROVE/REJECT decisions.
Output: Modified quorum-slot-dispatch.cjs with enriched output and auto-persist, updated debate-formatter.cjs validation, updated _TEMPLATE.md.
</objective>

<execution_context>
@/Users/jonathanborduas/.claude/nf/workflows/execute-plan.md
@/Users/jonathanborduas/.claude/nf/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@bin/quorum-slot-dispatch.cjs
@bin/debate-formatter.cjs
@bin/planning-paths.cjs
@.planning/quorum/debates/_TEMPLATE.md
</context>

<tasks>

<task type="auto">
  <name>Task 1: Enrich emitResultBlock with matched_requirement_ids and auto-persist debate trace</name>
  <files>bin/quorum-slot-dispatch.cjs</files>
  <action>
Two changes in quorum-slot-dispatch.cjs:

**Layer 1 — Enrich emitResultBlock (line ~737):**
- Add `matched_requirement_ids` to the destructured params of `emitResultBlock()`
- After the existing `improvements` block (line ~764) and before the `isUnavail` block (line ~766), add:
  ```
  if (matched_requirement_ids && matched_requirement_ids.length > 0) {
    lines.push(`matched_requirement_ids: [${matched_requirement_ids.join(', ')}]`);
  }
  ```
- Update both `emitResultBlock()` call sites (lines ~1019 and ~1034) to pass `matched_requirement_ids`:
  - Extract IDs from matchedRequirements before the spawn: `const matchedReqIds = matchedRequirements.map(r => r.id).filter(Boolean);`
  - Add `matched_requirement_ids: matchedReqIds` to both the UNAVAIL and success result block calls

**Layer 2 — Auto-persist debate trace file (after line ~1042, after the success emitResultBlock):**
- Add a require for planning-paths at the top of the file (near other requires): `const planningPaths = require('./planning-paths.cjs');`
- After the success `emitResultBlock` call (line ~1042), add a try/catch block that:
  1. Builds a filename slug: `const dateStr = new Date().toISOString().slice(0, 10); const slug = question.replace(/[^a-z0-9]+/gi, '-').slice(0, 50).toLowerCase().replace(/-+$/, ''); const traceFilename = \`${dateStr}-${slot}-${slug}.md\`;`
  2. Resolves path via planning-paths: `const debatePath = planningPaths.resolve(cwd, 'quorum-debate', { filename: traceFilename });`
  3. Builds frontmatter + body content:
     ```
     const traceContent = [
       '---',
       `date: ${dateStr}`,
       `question: "${question.replace(/"/g, '\\"')}"`,
       `slot: ${slot}`,
       `round: ${round}`,
       `verdict: ${verdict}`,
       `matched_requirement_ids: [${matchedReqIds.join(', ')}]`,
       `artifact_path: "${artifactPath || ''}"`,
       '---',
       '',
       `# Debate Trace: ${slot} on round ${round}`,
       '',
       '## Reasoning',
       reasoning || '(none)',
       '',
       '## Citations',
       citations || '(none)',
       ''
     ].join('\n');
     ```
  4. Writes atomically: `fs.writeFileSync(debatePath, traceContent, 'utf8');`
  5. The catch block logs to stderr and continues (fail-open): `process.stderr.write(\`[quorum-slot-dispatch] debate trace write failed: ${e.message}\n\`);`

- Do NOT write trace files for UNAVAIL results (only for successful slot responses).

**Important:** The `matchedReqIds` extraction and the `verdict`, `reasoning`, `citations` variables are already in scope from the existing code at lines 1029-1031. Ensure the trace-writing block uses those same variables.
  </action>
  <verify>
Run: `node -e "const d = require('./bin/quorum-slot-dispatch.cjs'); const r = d.emitResultBlock({ slot: 'test-1', round: 1, verdict: 'APPROVE', reasoning: 'good', matched_requirement_ids: ['REQ-01', 'REQ-02'] }); console.log(r);"` — output MUST include `matched_requirement_ids: [REQ-01, REQ-02]`.

Run: `grep 'planning-paths' bin/quorum-slot-dispatch.cjs` — confirms require is present.
Run: `grep 'quorum-debate' bin/quorum-slot-dispatch.cjs` — confirms planning-paths resolve call.
Run: `grep 'debate trace write failed' bin/quorum-slot-dispatch.cjs` — confirms fail-open error handling.
  </verify>
  <done>
emitResultBlock emits matched_requirement_ids in YAML output. Successful slot dispatches auto-write a debate trace markdown file to .planning/quorum/debates/ with frontmatter containing date, question, slot, round, verdict, matched_requirement_ids, artifact_path. Write failures are caught and logged to stderr without blocking dispatch.
  </done>
</task>

<task type="auto">
  <name>Task 2: Update debate-formatter validation and template</name>
  <files>bin/debate-formatter.cjs, .planning/quorum/debates/_TEMPLATE.md</files>
  <action>
**debate-formatter.cjs:**
- The `validateDebate()` function currently requires only `date` and `question`. The new per-slot trace files will also have `slot`, `round`, `verdict`, `matched_requirement_ids`, `artifact_path` in frontmatter.
- These new fields should be OPTIONAL (not required) to avoid breaking existing debate files.
- After the existing validation (line ~83), add a `warnings` array to the return object that flags when expected-but-optional fields are missing from per-slot traces:
  ```
  const warnings = [];
  const optionalFields = ['slot', 'round', 'verdict', 'matched_requirement_ids', 'artifact_path'];
  for (const field of optionalFields) {
    if (frontmatter[field] === undefined) {
      warnings.push(`Optional field missing: ${field}`);
    }
  }
  return { valid: true, frontmatter, warnings };
  ```
- Update the `extractFrontmatter()` function: no changes needed — it already handles arrays (`[a, b]` syntax) and strings, which covers `matched_requirement_ids` and `artifact_path`.

**_TEMPLATE.md:**
- Update the frontmatter block to include the new fields:
  ```yaml
  ---
  date: YYYY-MM-DD
  question: "The specific question being debated"
  consensus: PENDING
  rounds: 0
  participants: []
  tags: []
  requirement_ids: []
  artifact_path: ""
  ---
  ```
- Keep the body sections unchanged.
  </action>
  <verify>
Run: `node -e "const d = require('./bin/debate-formatter.cjs'); const r = d.validateDebate('---\ndate: 2026-03-09\nquestion: test\nslot: gemini-1\nverdict: APPROVE\nmatched_requirement_ids: [REQ-01]\n---\n'); console.log(JSON.stringify(r));"` — must return `{ valid: true, frontmatter: {...}, warnings: [...] }` with no errors and warnings only for missing optional fields (round, artifact_path).

Run: `node -e "const d = require('./bin/debate-formatter.cjs'); const r = d.validateDebate('---\ndate: 2026-03-09\nquestion: test\n---\n'); console.log(JSON.stringify(r));"` — must still return `{ valid: true }` (backward compat with old debates).

Run: `grep 'requirement_ids' .planning/quorum/debates/_TEMPLATE.md` — confirms template updated.
  </verify>
  <done>
debate-formatter validates new optional fields (slot, round, verdict, matched_requirement_ids, artifact_path) with warnings for missing ones. Existing debate files without new fields still validate as valid (backward compatible). Template includes requirement_ids and artifact_path fields.
  </done>
</task>

</tasks>

<verification>
1. `node -e "const d = require('./bin/quorum-slot-dispatch.cjs'); const r = d.emitResultBlock({ slot: 's', round: 1, verdict: 'APPROVE', reasoning: 'ok', matched_requirement_ids: ['A-01'] }); if (!r.includes('matched_requirement_ids')) { process.exit(1); }"` — exits 0
2. `grep -c 'writeFileSync.*debatePath\|writeFileSync.*tracePath\|writeFileSync.*traceContent' bin/quorum-slot-dispatch.cjs` — at least 1 match
3. `node bin/debate-formatter.cjs .planning/quorum/debates/_TEMPLATE.md 2>&1; echo $?` — exits 1 (template has placeholder values) but no crash
4. Existing debate files in .planning/quorum/debates/ still pass validation: `node bin/debate-formatter.cjs .planning/quorum/debates/2026-02-26-should-qgsd-implement-pending-task.md`
</verification>

<success_criteria>
- emitResultBlock YAML output includes matched_requirement_ids when requirement IDs exist
- Successful dispatches auto-persist debate trace files to .planning/quorum/debates/
- Trace files have complete frontmatter (date, question, slot, round, verdict, matched_requirement_ids, artifact_path)
- File write failures are fail-open (stderr log, no dispatch blocking)
- debate-formatter accepts new fields without breaking old debate files
- Template reflects new schema
</success_criteria>

<output>
After completion, create `.planning/quick/237-persist-quorum-debate-traces-with-matche/237-SUMMARY.md`
</output>
