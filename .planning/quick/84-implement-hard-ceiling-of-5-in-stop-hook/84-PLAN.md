---
phase: quick-84
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - hooks/qgsd-stop.js
  - hooks/qgsd-prompt.js
  - hooks/dist/qgsd-stop.js
  - hooks/dist/qgsd-prompt.js
autonomous: true
requirements: [QUICK-84]

must_haves:
  truths:
    - "Stop hook passes when minSize agents were called (even if fewer than all activeSlots), provided the called agents are the top-priority ones (sub first when preferSub=true)"
    - "Stop hook blocks when fewer than minSize agents were called, regardless of which agents were called"
    - "Prompt injection includes explicit failover instruction: if a sub agent fails with quota/error, continue to the next agent in the ordered list until minSize successful responses are collected"
    - "Installed hooks in ~/.claude/hooks/ reflect the changes (dist sync + install run)"
  artifacts:
    - path: "hooks/qgsd-stop.js"
      provides: "Updated Stop hook with minSize ceiling enforcement"
      contains: "minSize"
    - path: "hooks/qgsd-prompt.js"
      provides: "Updated Prompt hook with failover retry instruction"
      contains: "failover"
    - path: "hooks/dist/qgsd-stop.js"
      provides: "Synced dist copy of Stop hook"
    - path: "hooks/dist/qgsd-prompt.js"
      provides: "Synced dist copy of Prompt hook"
  key_links:
    - from: "hooks/qgsd-stop.js buildAgentPool()"
      to: "quorum.minSize"
      via: "orderedPool slice — only top minSize agents are required to have been called"
      pattern: "minSize"
    - from: "hooks/qgsd-prompt.js instructions string"
      to: "failover text"
      via: "minNote or inline instruction block when minSize < activeSlots.length"
      pattern: "failover|quota.*error.*next|continue.*next agent"
---

<objective>
Implement two correctness fixes in the quorum enforcement hooks:

1. **Hard ceiling of minSize in Stop hook** — currently the Stop hook requires ALL agents in
   quorum_active to have been called. It must instead pass once the top-priority `minSize`
   agents have been called (sub agents first when `preferSub=true`). Agents beyond position
   `minSize` in the ordered pool are overflow-only and must not trigger a block.

2. **Quota/error failover instruction in qgsd-prompt.js** — the injected prompt already says
   "call minSize agents, prefer sub first" but gives no guidance on what to do when a sub agent
   fails. Add an explicit instruction: if a sub agent fails (quota/error), continue down the
   ordered list (sub first, then api overflow) until minSize successful responses are collected.

Purpose: When a project has 5 agents configured but minSize=4, one agent can be down without
permanently blocking quorum. Both fixes are needed together: the prompt tells Claude what to do
on failure, and the Stop hook enforces only that the right number of agents were actually called.

Output: Updated hook source files, synced to dist/, installed globally.
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
  <name>Task 1: Stop hook — enforce minSize ceiling with priority-ordered agent check</name>
  <files>hooks/qgsd-stop.js</files>
  <action>
In the `main()` function of `hooks/qgsd-stop.js`, after building `agentPool` (which is already
sorted sub-first when `preferSub=true`), apply a minSize ceiling before the missing-agents loop.

Current logic (lines ~370-394): iterates all agents in agentPool, adds any available-but-not-called
agent to `missingNames`. This requires ALL available agents to have been called.

New logic:

Step 1 — Compute `minSize` from config:
```js
const minSize = (config.quorum && Number.isInteger(config.quorum.minSize) && config.quorum.minSize >= 1)
  ? config.quorum.minSize
  : agentPool.length;
```

Step 2 — Build the "required pool" — only the first `minSize` agents from `agentPool` are required.
Agents beyond position `minSize-1` are overflow-only and must not block:
```js
const requiredPool = agentPool.slice(0, minSize);
```
Note: agentPool is already sorted (sub-first when preferSub=true) by `buildAgentPool()`.

Step 3 — Check only `requiredPool` in the missing-agents loop (replace `agentPool` with `requiredPool`
in the loop on ~line 371). The rest of the loop body is unchanged.

The block reason message remains unchanged — it lists the specific required tools that were not called.

Do NOT change the `buildAgentPool()` function. Only change the loop in `main()`.
  </action>
  <verify>
Run the existing test suite to confirm no regressions:
```
node --test hooks/qgsd-stop.test.js
```
Then manually verify the logic by inspection: confirm that `requiredPool = agentPool.slice(0, minSize)`
and that the for-loop iterates `requiredPool` (not `agentPool`).
  </verify>
  <done>
`node --test hooks/qgsd-stop.test.js` passes all existing tests. The loop in main() iterates
`requiredPool` (capped at minSize) instead of the full `agentPool`.
  </done>
</task>

<task type="auto">
  <name>Task 2: Prompt hook — add failover retry instruction when minSize &lt; activeSlots.length</name>
  <files>hooks/qgsd-prompt.js</files>
  <action>
In `hooks/qgsd-prompt.js`, inside the `activeSlots` branch (lines ~113-166), the `minNote` variable
is currently built as:
```js
const minNote = minSize < activeSlots.length
  ? ` (call ${minSize} agents — stop once you have ${minSize} responses, prefer subscription agents first)`
  : '';
```

Replace `minNote` with an extended version that also includes failover guidance. When
`minSize < activeSlots.length`, the injected text must explicitly say that if a sub agent fails
(quota/error), Claude should continue to the next agent in the ordered list until `minSize`
successful responses are collected. Use this replacement:

```js
const minNote = minSize < activeSlots.length
  ? ` (call ${minSize} agents — stop once you have ${minSize} successful responses, prefer subscription agents first; if a sub agent fails with quota/error, continue to the next agent in the ordered list until ${minSize} responses are collected)`
  : '';
```

This extends the existing `minNote` string — no structural changes to the instructions template
are needed. The failover guidance is part of the parenthetical note that already appears in the
`QUORUM REQUIRED` header line.

Also verify that `node --test hooks/qgsd-prompt.test.js` still passes after this change.
  </action>
  <verify>
```
node --test hooks/qgsd-prompt.test.js
```
Inspect the injected `additionalContext` for a `/qgsd:plan-phase` prompt when a project config
with `minSize=4` and 5 `quorum_active` slots is loaded: confirm the word "failover" or the phrase
"continue to the next agent" appears in the output.
  </verify>
  <done>
`node --test hooks/qgsd-prompt.test.js` passes. The minNote string includes failover instruction
text when minSize &lt; activeSlots.length.
  </done>
</task>

<task type="auto">
  <name>Task 3: Sync dist/ and install globally</name>
  <files>hooks/dist/qgsd-stop.js, hooks/dist/qgsd-prompt.js</files>
  <action>
Copy the updated hook sources to dist/ and run the installer to deploy to ~/.claude/hooks/:

```bash
cp /Users/jonathanborduas/code/QGSD/hooks/qgsd-stop.js /Users/jonathanborduas/code/QGSD/hooks/dist/qgsd-stop.js
cp /Users/jonathanborduas/code/QGSD/hooks/qgsd-prompt.js /Users/jonathanborduas/code/QGSD/hooks/dist/qgsd-prompt.js
node /Users/jonathanborduas/code/QGSD/bin/install.js --claude --global
```

Verify that `~/.claude/hooks/qgsd-stop.js` and `~/.claude/hooks/qgsd-prompt.js` are updated
(check mtime or grep for "requiredPool" / "continue to the next agent").
  </action>
  <verify>
```bash
grep -n "requiredPool" ~/.claude/hooks/qgsd-stop.js
grep -n "continue to the next agent" ~/.claude/hooks/qgsd-prompt.js
```
Both commands must return matching lines.
  </verify>
  <done>
`~/.claude/hooks/qgsd-stop.js` contains "requiredPool". `~/.claude/hooks/qgsd-prompt.js` contains
"continue to the next agent". Installer reported success.
  </done>
</task>

</tasks>

<verification>
1. `node --test hooks/qgsd-stop.test.js` — all tests pass
2. `node --test hooks/qgsd-prompt.test.js` — all tests pass
3. `grep -n "requiredPool" ~/.claude/hooks/qgsd-stop.js` — returns a line
4. `grep -n "continue to the next agent" ~/.claude/hooks/qgsd-prompt.js` — returns a line
</verification>

<success_criteria>
- Stop hook slices agentPool to minSize before checking for missing calls — agents in overflow
  positions (beyond minSize) no longer cause blocks
- Prompt hook includes explicit failover instruction when minSize &lt; activeSlots.length
- All existing tests pass (no regressions)
- Installed hooks in ~/.claude/hooks/ reflect both changes
</success_criteria>

<output>
After completion, create `.planning/quick/84-implement-hard-ceiling-of-5-in-stop-hook/84-SUMMARY.md`
</output>
