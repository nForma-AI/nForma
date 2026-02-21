---
id: "21"
slug: fix-qgsd-gaps-add-copilot-to-required-mo
description: "Fix QGSD gaps: add Copilot to required_models, add quick to quorum_commands, add orchestrator quorum step to quick.md workflow"
date: "2026-02-21"
mode: quick-full
must_haves:
  truths:
    - Copilot model (mcp__copilot-cli__) is present in required_models in config-loader.js DEFAULT_CONFIG
    - 'quick' is present in quorum_commands in config-loader.js DEFAULT_CONFIG
    - deriveMissingToolName() returns prefix+'ask' for modelKey 'copilot'
    - qgsd-prompt.js DEFAULT_QUORUM_INSTRUCTIONS_FALLBACK lists mcp__copilot-cli__ask as step 4
    - quick.md workflow includes Step 5.7 quorum review between planner return and executor spawn
    - hooks/dist/ files match source (config-loader.js, qgsd-stop.js)
    - tests in config-loader.test.js and qgsd-stop.test.js pass
  artifacts:
    - hooks/config-loader.js
    - hooks/qgsd-stop.js
    - hooks/qgsd-prompt.js
    - hooks/dist/config-loader.js
    - hooks/dist/qgsd-stop.js
    - get-shit-done/workflows/quick.md
    - hooks/config-loader.test.js
    - hooks/qgsd-stop.test.js
---

# Quick Task 21 — Fix QGSD Gaps (Revised)

## Context

Gaps identified in assessment vs CLAUDE.md policy:

1. **Gap 1 (Critical)**: `config-loader.js` `DEFAULT_CONFIG.required_models` missing Copilot. Stop hook never enforces it.
2. **Gap 1b**: `qgsd-prompt.js` fallback quorum instructions list only 3 models — Copilot absent. Creates asymmetry: prompt says call 3, stop hook enforces 4.
3. **Gap 2**: `DEFAULT_CONFIG.quorum_commands` missing `'quick'`. R3.1 requires quorum for quick's planner.
4. **Gap 2b**: `quick.md` has no quorum step between planner return and executor spawn.
5. **Gap dist**: `hooks/dist/` compiled copies not updated = live enforcement diverges from source.
6. **Gap tests**: Test assertions don't cover Copilot entry.

## Tasks

<task type="auto">
  <name>Add Copilot to required_models, quick to quorum_commands, fix deriveMissingToolName, update prompt fallback, update tests</name>
  <files>hooks/config-loader.js, hooks/qgsd-stop.js, hooks/qgsd-prompt.js, hooks/config-loader.test.js, hooks/qgsd-stop.test.js</files>
  <action>
### hooks/config-loader.js

In DEFAULT_CONFIG.required_models, add copilot after opencode:
```js
copilot:  { tool_prefix: 'mcp__copilot-cli__', required: true },
```

In DEFAULT_CONFIG.quorum_commands, add 'quick':
```js
quorum_commands: [
  'plan-phase', 'new-project', 'new-milestone',
  'discuss-phase', 'verify-work', 'research-phase', 'quick',
],
```

### hooks/qgsd-stop.js

In deriveMissingToolName(), add copilot case before the fallback return:
```js
if (modelKey === 'copilot') return prefix + 'ask';
```

### hooks/qgsd-prompt.js

In DEFAULT_QUORUM_INSTRUCTIONS_FALLBACK, add Copilot as step 4 and renumber:
```
  1. Call mcp__codex-cli__review with the full plan content
  2. Call mcp__gemini-cli__gemini with the full plan content
  3. Call mcp__opencode__opencode with the full plan content
  4. Call mcp__copilot-cli__ask with the full plan content
  5. Present all model responses, resolve any concerns, then deliver your final output
  6. Include the token <!-- GSD_DECISION --> ...
```

### hooks/config-loader.test.js

Find the test asserting required_models shape (TC9 or equivalent) and add:
```js
assert.ok(DEFAULT_CONFIG.required_models.copilot);
assert.strictEqual(DEFAULT_CONFIG.required_models.copilot.tool_prefix, 'mcp__copilot-cli__');
```

Find any test asserting quorum_commands array and add 'quick' to the expected list.

### hooks/qgsd-stop.test.js

Find any test for deriveMissingToolName or the block reason for copilot and add a case:
- modelKey 'copilot' with prefix 'mcp__copilot-cli__' → returns 'mcp__copilot-cli__ask'
  </action>
  <verify>
node -e "const {DEFAULT_CONFIG}=require('./hooks/config-loader.js'); console.log(!!DEFAULT_CONFIG.required_models.copilot, DEFAULT_CONFIG.quorum_commands.includes('quick'))"
grep -n "copilot" hooks/qgsd-stop.js
grep -n "copilot-cli__ask" hooks/qgsd-prompt.js
  </verify>
  <done>Copilot in required_models, 'quick' in quorum_commands, deriveMissingToolName returns 'ask' for copilot, prompt fallback lists copilot as step 4, tests assert copilot entry</done>
</task>

<task type="auto">
  <name>Add Step 5.7 quorum review to quick.md workflow</name>
  <files>get-shit-done/workflows/quick.md</files>
  <action>
After the Step 5.5 plan-checker block (which ends with "If iteration_count >= 2: ... Offer: 1) Force proceed, 2) Abort") and before the "---" separator that introduces Step 6, insert:

```markdown
---

**Step 5.7: Quorum review of plan (required by R3.1)**

This step is MANDATORY regardless of `--full` mode. R3.1 requires quorum for any planning output from `/qgsd:quick`.

Form your own position on the plan first: does it correctly address the task description? Are tasks atomic and safe?

Then query each available quorum model **sequentially** (separate tool calls per R3.2 — never sibling calls):

```
Plan for quick task ${next_num}: ${DESCRIPTION}

[Paste full plan content from ${QUICK_DIR}/${next_num}-PLAN.md]

Review this plan. Is it correct, safe to execute, and well-scoped?
Vote APPROVE or BLOCK with 1-2 sentence rationale.
```

Fail-open: if a model is UNAVAILABLE (quota/error), note it and proceed with available models.

**On APPROVE consensus:** Include `<!-- GSD_DECISION -->` in your response summarizing quorum results, then proceed to Step 6.
**On BLOCK:** Report the blocker to the user. Do not execute.
```
  </action>
  <verify>grep -n "5.7\|Quorum review\|GSD_DECISION" get-shit-done/workflows/quick.md</verify>
  <done>Step 5.7 present between plan-checker section and Step 6, with sequential tool call requirement, fail-open instruction, GSD_DECISION marker, and BLOCK handling</done>
</task>

<task type="auto">
  <name>Rebuild dist/ and sync all changed files to installed location</name>
  <files>hooks/dist/config-loader.js, hooks/dist/qgsd-stop.js</files>
  <action>
Check if there is a build script for dist/:
```bash
ls hooks/dist/
cat package.json | grep -A5 '"scripts"'
```

If a build script exists (e.g. npm run build), run it to regenerate dist/.

If no build script exists, manually copy source to dist/:
```bash
cp hooks/config-loader.js hooks/dist/config-loader.js
cp hooks/qgsd-stop.js hooks/dist/qgsd-stop.js
```

Then sync all changed source files to installed location:
```bash
cp hooks/config-loader.js ~/.claude/qgsd/hooks/config-loader.js
cp hooks/qgsd-stop.js ~/.claude/qgsd/hooks/qgsd-stop.js
cp hooks/qgsd-prompt.js ~/.claude/qgsd/hooks/qgsd-prompt.js
cp get-shit-done/workflows/quick.md ~/.claude/qgsd/workflows/quick.md
# Also sync dist if installed from dist
cp hooks/dist/config-loader.js ~/.claude/qgsd/hooks/dist/config-loader.js 2>/dev/null || true
cp hooks/dist/qgsd-stop.js ~/.claude/qgsd/hooks/dist/qgsd-stop.js 2>/dev/null || true
```

Run tests to confirm nothing broken:
```bash
node --test hooks/config-loader.test.js hooks/qgsd-stop.test.js 2>&1 | tail -20
```
  </action>
  <verify>
grep "copilot" hooks/dist/config-loader.js && grep "copilot" ~/.claude/qgsd/hooks/config-loader.js
  </verify>
  <done>dist/ files updated; installed files match source; tests pass</done>
</task>
