---
phase: quick-196
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - .planning/formal/spec/account-manager/scope.json
  - .planning/formal/spec/agent-loop/scope.json
  - .planning/formal/spec/breaker/scope.json
  - .planning/formal/spec/convergence/scope.json
  - .planning/formal/spec/deliberation/scope.json
  - .planning/formal/spec/deliberation-revision/scope.json
  - .planning/formal/spec/installer/scope.json
  - .planning/formal/spec/mcp-calls/scope.json
  - .planning/formal/spec/oscillation/scope.json
  - .planning/formal/spec/prefilter/scope.json
  - .planning/formal/spec/quorum/scope.json
  - .planning/formal/spec/recruiting/scope.json
  - .planning/formal/spec/safety/scope.json
  - .planning/formal/spec/stop-hook/scope.json
  - .planning/formal/spec/tui-nav/scope.json
  - bin/formal-scope-scan.cjs
  - core/workflows/quick.md
  - core/workflows/plan-phase.md
  - core/workflows/execute-phase.md
  - core/workflows/new-milestone.md
autonomous: true
formal_artifacts: none
requirements: [QUICK-196]

must_haves:
  truths:
    - "Running `node bin/formal-scope-scan.cjs --description 'fix quorum deliberation bug'` returns quorum and deliberation modules"
    - "Running `node bin/formal-scope-scan.cjs --description 'Safety Diagnostics Security Sweep Session State Harness'` does NOT match agent-loop or deliberation-revision (the false positive case)"
    - "All 4 workflow files call `node bin/formal-scope-scan.cjs` instead of inline keyword matching"
    - "Each of the 15 formal spec modules has a scope.json with source_files, concepts, and requirements arrays"
    - "The script returns valid JSON array of {module, path} objects"
  artifacts:
    - path: "bin/formal-scope-scan.cjs"
      provides: "Centralized formal scope scanner with semantic matching"
      exports: ["main"]
      min_lines: 60
    - path: ".planning/formal/spec/quorum/scope.json"
      provides: "Scope metadata for quorum module"
      contains: "source_files"
    - path: ".planning/formal/spec/breaker/scope.json"
      provides: "Scope metadata for breaker module"
      contains: "concepts"
  key_links:
    - from: "core/workflows/quick.md"
      to: "bin/formal-scope-scan.cjs"
      via: "node bin/formal-scope-scan.cjs --description"
      pattern: "formal-scope-scan.cjs"
    - from: "core/workflows/plan-phase.md"
      to: "bin/formal-scope-scan.cjs"
      via: "node bin/formal-scope-scan.cjs --description"
      pattern: "formal-scope-scan.cjs"
    - from: "bin/formal-scope-scan.cjs"
      to: ".planning/formal/spec/*/scope.json"
      via: "fs.readFileSync per module directory"
      pattern: "scope\\.json"
---

<objective>
Replace the naive keyword-substring formal scope scan (duplicated across 4 workflows) with a centralized script using structured scope metadata per module.

Purpose: The current scan splits descriptions into individual words and substring-matches against module names, producing false positives (e.g., "state" matching "state" in description but having nothing to do with any module, "safety" matching "agent-loop" because the word appears somewhere). A scope.json per module with explicit source_files globs, semantic concepts, and requirement IDs enables precise matching.

Output: 15 scope.json files, 1 centralized bin/formal-scope-scan.cjs script, 4 updated workflow files.
</objective>

<execution_context>
@/Users/jonathanborduas/.claude/nf/workflows/execute-plan.md
@/Users/jonathanborduas/.claude/nf/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@core/workflows/quick.md
@core/workflows/plan-phase.md
@core/workflows/execute-phase.md
@core/workflows/new-milestone.md
@.planning/formal/spec/breaker/invariants.md
@.planning/formal/spec/quorum/invariants.md
@.planning/formal/spec/mcp-calls/invariants.md
</context>

<tasks>

<task type="auto">
  <name>Task 1: Create scope.json for all 15 formal spec modules and build bin/formal-scope-scan.cjs</name>
  <files>
    .planning/formal/spec/account-manager/scope.json
    .planning/formal/spec/agent-loop/scope.json
    .planning/formal/spec/breaker/scope.json
    .planning/formal/spec/convergence/scope.json
    .planning/formal/spec/deliberation/scope.json
    .planning/formal/spec/deliberation-revision/scope.json
    .planning/formal/spec/installer/scope.json
    .planning/formal/spec/mcp-calls/scope.json
    .planning/formal/spec/oscillation/scope.json
    .planning/formal/spec/prefilter/scope.json
    .planning/formal/spec/quorum/scope.json
    .planning/formal/spec/recruiting/scope.json
    .planning/formal/spec/safety/scope.json
    .planning/formal/spec/stop-hook/scope.json
    .planning/formal/spec/tui-nav/scope.json
    bin/formal-scope-scan.cjs
  </files>
  <action>
**Step 1 -- Create scope.json for each module.**

Each scope.json has this schema:
```json
{
  "source_files": ["glob/pattern/**/*.js"],
  "concepts": ["keyword1", "keyword2"],
  "requirements": ["REQ-ID"]
}
```

Read each module's `invariants.md` to determine the correct source_files and concepts. Key mappings (derive from `Spec source` and `Realism rationale` fields in each invariants.md):

- **account-manager**: source_files: `["bin/account-manager.cjs"]`, concepts: `["account", "api-key", "provider", "credentials", "akash", "together", "fireworks"]`
- **agent-loop**: source_files: `["bin/nForma.cjs"]`, concepts: `["agent-loop", "session", "main-loop", "orchestration", "nforma"]`
- **breaker**: source_files: `["hooks/nf-circuit-breaker.js", "hooks/dist/nf-circuit-breaker.js"]`, concepts: `["circuit-breaker", "breaker", "oscillation-detection", "run-collapse", "false-positive"]`
- **convergence**: source_files: `["bin/run-quorum.cjs"]`, concepts: `["convergence", "quorum-rounds", "deliberation-rounds", "vote-agreement", "consensus"]`
- **deliberation**: source_files: `["bin/run-quorum.cjs", "hooks/nf-prompt.js"]`, concepts: `["deliberation", "quorum-decision", "vote", "slot-worker", "majority"]`
- **deliberation-revision**: source_files: `["bin/run-quorum.cjs"]`, concepts: `["deliberation-revision", "revision-round", "re-deliberation", "improvement-cycle"]`
- **installer**: source_files: `["bin/install.js"]`, concepts: `["installer", "install", "hook-migration", "global-config", "cleanup"]`
- **mcp-calls**: source_files: `["bin/unified-mcp-server.mjs", "bin/call-quorum-slot.cjs"]`, concepts: `["mcp", "mcp-server", "mcp-tool", "health-check", "ping", "timeout", "subprocess"]`
- **oscillation**: source_files: `["hooks/nf-circuit-breaker.js"]`, concepts: `["oscillation", "oscillation-resolution", "commit-pattern", "alternating-groups"]`
- **prefilter**: source_files: `["hooks/nf-prompt.js"]`, concepts: `["prefilter", "pre-filter", "command-routing", "prompt-classification"]`
- **quorum**: source_files: `["bin/run-quorum.cjs", "hooks/nf-prompt.js", "hooks/nf-stop.js"]`, concepts: `["quorum", "multi-model", "slot", "consensus", "voting", "threshold"]`
- **recruiting**: source_files: `["bin/run-quorum.cjs"]`, concepts: `["recruiting", "slot-recruitment", "provider-selection", "available-slots"]`
- **safety**: source_files: `["hooks/nf-stop.js", "hooks/nf-prompt.js"]`, concepts: `["safety", "stop-hook", "blocking", "guard", "validation"]`
- **stop-hook**: source_files: `["hooks/nf-stop.js", "hooks/dist/nf-stop.js"]`, concepts: `["stop-hook", "stop", "response-blocking", "plan-required", "quorum-enforcement"]`
- **tui-nav**: source_files: `["bin/nForma.cjs"]`, concepts: `["tui", "navigation", "terminal-ui", "menu", "interactive"]`

Set `requirements` to `[]` for all modules (no requirement IDs currently mapped).

**Step 2 -- Create bin/formal-scope-scan.cjs.**

Script accepts CLI args:
- `--description "text"` (required) -- the description to match against
- `--files file1,file2,...` (optional) -- source files to check for overlap

Matching algorithm (a module matches if ANY signal fires):

1. **Source file overlap** (highest priority): If `--files` provided, check if any provided file matches any of the module's `source_files` globs. Use simple glob matching (convert glob `*` to regex `[^/]*`, `**` to `.*`).

2. **Concept matching** (primary): Lowercase the description, split on spaces/hyphens/underscores. For each concept in module's scope.json, check if any description token contains the concept as a substring OR the concept contains any token as a substring. BUT apply a minimum token length of 4 characters to prevent short words like "and", "the", "for", "state", "safe" from matching. Exception: if a concept is shorter than 4 chars, it must match exactly (not as substring).

3. **Module name match** (fallback, lowest priority): Same logic as current -- module name substring of token or token substring of module name. Apply same 4-char minimum.

Output: JSON array to stdout. Each element: `{ "module": "name", "path": ".planning/formal/spec/name/invariants.md", "matched_by": "concept|source_file|module_name" }`.

If no matches: output `[]`.

Include `#!/usr/bin/env node` shebang. Use only Node.js built-ins (fs, path). No npm dependencies.

Add a `--help` flag that prints usage.

Error handling: If `.planning/formal/spec/` does not exist, output `[]` and exit 0. If a module's scope.json is missing, skip that module (log warning to stderr). Always exit 0 (fail-open).
  </action>
  <verify>
1. `node bin/formal-scope-scan.cjs --description "fix quorum deliberation bug"` -- should return JSON with quorum, deliberation, and convergence modules
2. `node bin/formal-scope-scan.cjs --description "Safety Diagnostics Security Sweep Session State Harness"` -- should match safety only (NOT agent-loop, NOT deliberation-revision, NOT convergence)
3. `node bin/formal-scope-scan.cjs --description "update TUI navigation flow"` -- should match tui-nav
4. `node bin/formal-scope-scan.cjs --description "refactor breaker circuit logic"` -- should match breaker
5. `node bin/formal-scope-scan.cjs --description "completely unrelated topic about databases"` -- should return `[]`
6. `node bin/formal-scope-scan.cjs --files "hooks/nf-stop.js" --description "something"` -- should match stop-hook, safety, quorum via source_file overlap
7. All 15 scope.json files exist: `ls .planning/formal/spec/*/scope.json | wc -l` returns 15
  </verify>
  <done>
All 15 formal spec modules have scope.json with source_files, concepts, and requirements. The bin/formal-scope-scan.cjs script accepts --description and --files, matches using concept/source_file/module_name signals with 4-char minimum token filter, and returns JSON array to stdout. False positive case ("Safety Diagnostics Security Sweep Session State Harness") no longer matches agent-loop or deliberation-revision.
  </done>
</task>

<task type="auto">
  <name>Task 2: Replace inline keyword matching in all 4 workflow files with formal-scope-scan.cjs call</name>
  <files>
    core/workflows/quick.md
    core/workflows/plan-phase.md
    core/workflows/execute-phase.md
    core/workflows/new-milestone.md
  </files>
  <action>
In each of the 4 workflow files, replace the inline formal scope scan block with a call to `node bin/formal-scope-scan.cjs`.

**Pattern for all 4 files:**

Replace the entire inline keyword-matching block (the `for MODULE_DIR ... done` loop with the `MATCHED=0` / `for KEYWORD` inner loop) with:

```bash
FORMAL_SPEC_CONTEXT=()
if [ -d ".planning/formal/spec" ]; then
  SCAN_RESULT=$(node bin/formal-scope-scan.cjs --description "$DESCRIPTION_VAR")
  # Parse JSON array into FORMAL_SPEC_CONTEXT bash array
  while IFS= read -r line; do
    FORMAL_SPEC_CONTEXT+=("$line")
  done < <(echo "$SCAN_RESULT" | node -e "
    const arr = JSON.parse(require('fs').readFileSync('/dev/stdin','utf8'));
    arr.forEach(e => console.log(JSON.stringify({module: e.module, path: e.path})));
  ")
  MATCH_COUNT=${#FORMAL_SPEC_CONTEXT[@]}
  if [ "$MATCH_COUNT" -gt 0 ]; then
    MATCHED_MODULES=$(echo "$SCAN_RESULT" | node -e "
      const arr = JSON.parse(require('fs').readFileSync('/dev/stdin','utf8'));
      console.log(arr.map(e => e.module).join(', '));
    ")
    echo ":: Formal scope scan: found ${MATCH_COUNT} module(s): ${MATCHED_MODULES}"
  else
    echo ":: Formal scope scan: no modules matched (fail-open)"
  fi
fi
```

**Per-file specifics:**

1. **quick.md** (Step 4.5, around lines 84-119): The description variable is `$DESCRIPTION`. Replace the inline heuristic explanation and the keyword-match pseudocode. Keep the `FORMAL_SPEC_CONTEXT=[]` initialization at the top and the `$FULL_MODE` guard. Update the prose to say "semantic matching via scope.json metadata" instead of "keyword-match against module names". Keep the examples block but update it to note concept-based matching.

2. **plan-phase.md** (Step 4.5, around lines 68-107): The description comes from `node ~/.claude/nf/bin/gsd-tools.cjs roadmap get-phase "${PHASE}" | jq -r '.goal // .phase_name'`. Replace with: `PHASE_DESC=$(node ~/.claude/nf/bin/gsd-tools.cjs roadmap get-phase "${PHASE}" | jq -r '.goal // .phase_name')` then pass `--description "$PHASE_DESC"` to formal-scope-scan.cjs. Update the prose description of step 4.5 to reference semantic matching.

3. **execute-phase.md** (around lines 370-422): Same as plan-phase.md -- extracts PHASE_DESC via gsd-tools then passes to formal-scope-scan.cjs. Remove the comment saying "identical algorithm to plan-phase Step 4.5" and replace with "uses centralized bin/formal-scope-scan.cjs".

4. **new-milestone.md** (Step 9.5, around lines 376-443): The description comes from MILESTONE_GOAL. Pass `--description "$MILESTONE_GOAL"` to formal-scope-scan.cjs. Keep the FORMAL_FILES_BLOCK and FORMAL_CONTEXT_BLOCK construction that follows (those consume FORMAL_SPEC_CONTEXT but don't do matching).

**Important:** Preserve ALL downstream usage of `$FORMAL_SPEC_CONTEXT` in each workflow (the variable is consumed by later steps for checker injection, formal check invocation, etc.). Only replace the MATCHING logic, not the consumption logic.

After updating all 4 files, install the updated workflows:
```bash
cp core/workflows/quick.md ~/.claude/nf/workflows/quick.md
cp core/workflows/plan-phase.md ~/.claude/nf/workflows/plan-phase.md
cp core/workflows/execute-phase.md ~/.claude/nf/workflows/execute-phase.md
cp core/workflows/new-milestone.md ~/.claude/nf/workflows/new-milestone.md
```
  </action>
  <verify>
1. `grep -c "formal-scope-scan.cjs" core/workflows/quick.md core/workflows/plan-phase.md core/workflows/execute-phase.md core/workflows/new-milestone.md` -- each file should show at least 1 occurrence
2. `grep -c "for KEYWORD" core/workflows/quick.md core/workflows/plan-phase.md core/workflows/execute-phase.md core/workflows/new-milestone.md` -- each file should show 0 (inline keyword loop removed)
3. `grep -c "MATCHED=0" core/workflows/quick.md core/workflows/plan-phase.md core/workflows/execute-phase.md core/workflows/new-milestone.md` -- each file should show 0 (inline matching removed)
4. `diff core/workflows/quick.md ~/.claude/nf/workflows/quick.md` -- no differences (install synced)
5. `diff core/workflows/plan-phase.md ~/.claude/nf/workflows/plan-phase.md` -- no differences
6. `diff core/workflows/execute-phase.md ~/.claude/nf/workflows/execute-phase.md` -- no differences
7. `diff core/workflows/new-milestone.md ~/.claude/nf/workflows/new-milestone.md` -- no differences
  </verify>
  <done>
All 4 workflow files call `node bin/formal-scope-scan.cjs --description "..."` instead of inline keyword-substring matching. The inline `for KEYWORD ... MATCHED=0 ... grep -qF` loops are completely removed. Downstream FORMAL_SPEC_CONTEXT consumption (checker injection, formal check invocation, display) is preserved unchanged. Installed copies at ~/.claude/nf/workflows/ are synced.
  </done>
</task>

</tasks>

<verification>
1. The centralized script produces correct results for known test cases (quorum, breaker, tui-nav, false positive case)
2. All 4 workflows delegate to the centralized script instead of inline matching
3. No inline keyword-match loops remain in any workflow file
4. Installed workflow copies match source files
5. Fail-open behavior preserved: missing spec dir or missing scope.json does not crash
</verification>

<success_criteria>
- bin/formal-scope-scan.cjs exists and returns correct JSON for all test cases
- 15 scope.json files exist under .planning/formal/spec/*/
- 4 workflow files updated to call centralized script
- False positive case (Safety Diagnostics description) no longer matches agent-loop or deliberation-revision
- Installed workflows synced to ~/.claude/nf/workflows/
</success_criteria>

<output>
After completion, create `.planning/quick/196-improve-formal-scope-scan-to-use-semanti/196-SUMMARY.md`
</output>
