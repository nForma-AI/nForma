---
phase: quick-137
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - hooks/qgsd-prompt.js
  - bin/call-quorum-slot.cjs
  - bin/probe-quorum-slots.cjs
  - bin/unified-mcp-server.mjs
  - bin/qgsd.cjs
  - bin/qgsd.test.cjs
  - hooks/dist/qgsd-prompt.js
autonomous: true
formal_artifacts: none
requirements: [QUICK-137]

must_haves:
  truths:
    - "Quorum dispatch degrades gracefully when providers.json has an empty providers array"
    - "qgsd-prompt.js SC-4 fallback does not crash when orderedSlots is empty (no undefined access)"
    - "call-quorum-slot.cjs reports a clear error message when providers array is empty"
    - "unified-mcp-server.mjs logs a warning and starts with zero tools when providers array is empty instead of crashing"
    - "qgsd.cjs renderScoreboard handles empty providers without TypeError"
    - "All existing tests continue to pass"
  artifacts:
    - path: "hooks/qgsd-prompt.js"
      provides: "Empty roster guard in quorum dispatch path"
      contains: "orderedSlots.length === 0"
    - path: "bin/call-quorum-slot.cjs"
      provides: "Clear error for empty providers array"
      contains: "no providers configured"
    - path: "bin/probe-quorum-slots.cjs"
      provides: "Empty providers guard"
      contains: "no providers configured"
    - path: "bin/unified-mcp-server.mjs"
      provides: "Graceful empty providers handling"
      contains: "No providers configured"
    - path: "bin/qgsd.cjs"
      provides: "Defensive providers access in scoreboard and agent rows"
      contains: "providers || []"
    - path: "bin/qgsd.test.cjs"
      provides: "Tests for empty roster scenarios"
      contains: "empty providers"
  key_links:
    - from: "hooks/qgsd-prompt.js"
      to: "quorum dispatch instructions"
      via: "orderedSlots empty guard before SC-4"
      pattern: "orderedSlots\\.length === 0"
    - from: "bin/call-quorum-slot.cjs"
      to: "process.exit"
      via: "empty providers check after findProviders()"
      pattern: "providers\\.length.*===.*0"
    - from: "hooks/dist/qgsd-prompt.js"
      to: "hooks/qgsd-prompt.js"
      via: "install sync copy"
      pattern: "cp hooks/qgsd-prompt.js hooks/dist/"
---

<objective>
Add validation and graceful degradation for empty roster (providers.json with zero providers configured). Currently, several code paths assume providers.json contains at least one provider entry, leading to undefined property access, cryptic errors, or silent failures when the array is empty.

Purpose: Prevent crashes and provide clear diagnostic messages when no agents are configured, making onboarding and misconfiguration scenarios safe.
Output: Updated source files with empty-roster guards, new tests, synced hook dist.
</objective>

<execution_context>
@/Users/jonathanborduas/.claude/qgsd/workflows/execute-plan.md
@/Users/jonathanborduas/.claude/qgsd/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@bin/providers.json
@hooks/qgsd-prompt.js
@bin/call-quorum-slot.cjs
@bin/probe-quorum-slots.cjs
@bin/unified-mcp-server.mjs
@bin/qgsd.cjs
@bin/qgsd.test.cjs
</context>

<tasks>

<task type="auto">
  <name>Task 1: Add empty-roster guards to quorum dispatch pipeline</name>
  <files>hooks/qgsd-prompt.js, bin/call-quorum-slot.cjs, bin/probe-quorum-slots.cjs, bin/unified-mcp-server.mjs</files>
  <action>
**hooks/qgsd-prompt.js** — Fix three empty-roster issues in the quorum injection path (lines 370-570):

1. After `findProviders()` at line 149-162: the function already returns `null` when providers.json is not found, but does NOT distinguish "file found with empty array" from "file found with entries." No change needed to `findProviders()` itself.

2. The critical bug is in the `activeSlots` dispatch path (line 384 onwards). When `config.quorum_active` is set but ALL those slots are filtered out (by timeout/provider-down/availability), `cappedSlots` can be empty. The SC-4 fallback at line 454 handles this for the FILTERED case, but there is a missing guard for when `orderedSlots` itself is empty (zero providers configured, or `quorum_active` lists slots that don't exist in providers.json). Add a guard BEFORE the SC-4 block:

```javascript
// Guard: empty roster — no external agents configured at all
if (orderedSlots.length === 0) {
  // Fail-open to solo mode: Claude is the only quorum participant
  console.error('[qgsd-dispatch] WARNING: no external agents in roster — falling back to solo quorum');
  instructions = `<!-- QGSD_SOLO_MODE -->\nSOLO MODE ACTIVE (empty roster): No external agents configured in providers.json or quorum_active. Claude's vote is the quorum. Write <!-- GSD_DECISION --> in your final output. The Stop hook is informed.\n\nTo add agents, run /qgsd:mcp-setup or edit ~/.claude/qgsd.json quorum_active.\n`;
}
```

This guard should be inserted at approximately line 419, right after `orderedSlots` is built but BEFORE the `preferSub` sort, `externalSlotCap`, and SC-4 logic. Wrap the rest of the activeSlots dispatch logic in an `else` block so it only runs when `orderedSlots.length > 0`. The existing `instructions` variable assignment must still reach the final `cmdPattern.test(prompt)` check.

3. Also guard the case where `findProviders()` returns an array but with zero entries. In the `activeSlots` path at line 419 where `orderedSlots` is built from `activeSlots.map()`: `activeSlots` comes from `config.quorum_active` which is already validated as an array. The empty case is when `activeSlots` is non-empty but maps to zero valid slots — covered by the guard above.

**bin/call-quorum-slot.cjs** — Add empty providers array guard after line 441-444:

After the existing `if (!providers)` null check, add a check for empty array:
```javascript
if (providers.length === 0) {
  process.stderr.write('[call-quorum-slot] No providers configured in providers.json — cannot dispatch slot\n');
  process.exit(1);
}
```

**bin/probe-quorum-slots.cjs** — Add empty providers array guard after line 127-133:

After the existing `if (!providers)` null check, add:
```javascript
if (providers.length === 0) {
  process.stderr.write('[probe-quorum-slots] No providers configured in providers.json — skipping probe\n');
  process.stdout.write('[]\n');
  process.exit(0);
}
```

**bin/unified-mcp-server.mjs** — Change the crash to a warning when providers array is empty (line 26-30):

After loading providers, if the array is empty, log a warning to stderr but continue running (the server will register zero tools, which is valid MCP behavior):
```javascript
if (!Array.isArray(providers) || providers.length === 0) {
  process.stderr.write('[unified-mcp-server] WARNING: No providers configured in providers.json — server will start with zero tools\n');
  providers = providers || [];
}
```

Also guard the existing `providers = JSON.parse(...)` to normalize: if the parsed object has `providers: null` or `providers: undefined`, normalize to `[]`.

IMPORTANT: Do NOT change any behavior when providers IS populated. All guards must be additive — existing paths with a populated roster must remain untouched. All guards follow the fail-open pattern used throughout the codebase.
  </action>
  <verify>
1. `node -e "const fs=require('fs'),p=require('path'); const orig=fs.readFileSync(p.join(__dirname,'hooks/qgsd-prompt.js'),'utf8'); console.log(orig.includes('orderedSlots.length === 0') ? 'PASS: empty roster guard present' : 'FAIL: guard missing')"` — must print PASS
2. `node -e "const fs=require('fs'),p=require('path'); const orig=fs.readFileSync(p.join(__dirname,'bin/call-quorum-slot.cjs'),'utf8'); console.log(orig.includes('providers.length === 0') ? 'PASS' : 'FAIL')"` — must print PASS
3. `node -e "const fs=require('fs'),p=require('path'); const orig=fs.readFileSync(p.join(__dirname,'bin/probe-quorum-slots.cjs'),'utf8'); console.log(orig.includes('providers.length === 0') ? 'PASS' : 'FAIL')"` — must print PASS
4. `node -e "const fs=require('fs'),p=require('path'); const orig=fs.readFileSync(p.join(__dirname,'bin/unified-mcp-server.mjs'),'utf8'); console.log(orig.includes('No providers configured') ? 'PASS' : 'FAIL')"` — must print PASS
5. `npm test 2>&1 | tail -5` — all existing tests still pass
  </verify>
  <done>All four files have empty-roster guards. qgsd-prompt.js falls back to solo mode when orderedSlots is empty. call-quorum-slot.cjs and probe-quorum-slots.cjs print clear error/skip messages. unified-mcp-server.mjs warns but continues. All existing tests pass.</done>
</task>

<task type="auto">
  <name>Task 2: Add defensive guards to TUI scoreboard and add empty-roster tests</name>
  <files>bin/qgsd.cjs, bin/qgsd.test.cjs, hooks/dist/qgsd-prompt.js</files>
  <action>
**bin/qgsd.cjs** — Add defensive access in `renderScoreboard()` (line 1491-1493):

The current code does `pdata.providers.map(p => p.name)` without guarding for undefined/null providers field. Change to:
```javascript
const providersList = pdata.providers || [];
const roster = new Set(providersList.map(p => p.name));
const lines = buildScoreboardLines(data, { roster, providers: providersList });
```

Also in `buildScoreboardLines` (line 1382-1416), the `opts.providers` loop is already safe (iterates over whatever array is passed), but add a guard at the top of the function for when `opts.providers` is passed but empty:
```javascript
if (opts && opts.providers && opts.providers.length === 0) {
  lines.push('  {gray-fg}No agents configured in providers.json.{/}');
  lines.push('  {gray-fg}Run /qgsd:mcp-setup to add agents.{/}');
  lines.push('');
}
```
This shows a helpful message instead of an empty scoreboard when there are no providers.

**bin/qgsd.test.cjs** — Add tests for empty roster handling. Find the existing `readProvidersJson` test section (around line 137-181) and add these tests:

1. Test that `readProvidersJson` returns an object with empty providers array when file has `{ "providers": [] }`:
```javascript
test('readProvidersJson: handles empty providers array gracefully', () => {
  fs.writeFileSync(PROVIDERS_JSON, JSON.stringify({ providers: [] }), 'utf8');
  const result = _pure.readProvidersJson();
  assert.deepStrictEqual(result.providers, []);
});
```

2. Test that `buildScoreboardLines` (if exported or accessible) handles empty providers without crashing. If `buildScoreboardLines` is not exported from `_pure`, add it to the test block by testing through the existing module exports. Otherwise, verify indirectly by ensuring `readProvidersJson` with empty array doesn't throw when used in the scoreboard path.

3. Test that `buildTimeoutChoices` handles empty providers:
```javascript
test('buildTimeoutChoices: returns empty array for empty providers', () => {
  const result = _pure.buildTimeoutChoices([], {}, { providers: [] });
  assert.deepStrictEqual(result, []);
});
```

**hooks/dist/qgsd-prompt.js** — Sync the updated hook:
```bash
cp hooks/qgsd-prompt.js hooks/dist/qgsd-prompt.js
```

Then run the installer to propagate to the global hooks location:
```bash
node bin/install.js --claude --global
```

This ensures the live hook at `~/.claude/hooks/` picks up the empty-roster guard.

IMPORTANT: Follow the install sync pattern from MEMORY.md: `cp hooks/qgsd-prompt.js hooks/dist/ && node bin/install.js --claude --global`. The installer reads from `hooks/dist/` (NOT `hooks/`).
  </action>
  <verify>
1. `npm test 2>&1 | tail -10` — all tests pass including new empty-roster tests
2. `diff hooks/qgsd-prompt.js hooks/dist/qgsd-prompt.js` — must show no differences (sync confirmed)
3. `node -e "const f=require('fs'); const h=f.readFileSync(require('os').homedir()+'/.claude/hooks/qgsd-prompt.js','utf8'); console.log(h.includes('orderedSlots.length === 0') ? 'INSTALLED' : 'NOT INSTALLED')"` — must print INSTALLED
4. `node -e "const f=require('fs'); const q=f.readFileSync('bin/qgsd.cjs','utf8'); console.log(q.includes('providersList') ? 'PASS: defensive access' : 'FAIL')"` — must print PASS
  </verify>
  <done>qgsd.cjs scoreboard defensively handles empty/null providers. New tests cover empty roster scenarios. Hook dist is synced and installed globally. All tests pass.</done>
</task>

</tasks>

<verification>
Final comprehensive check after both tasks:
1. `npm test` — all tests pass (existing + new empty-roster tests)
2. Simulate empty roster: `node -e "const fs=require('fs'); const orig=fs.readFileSync('bin/providers.json','utf8'); fs.writeFileSync('/tmp/providers-empty.json', '{\"providers\":[]}'); console.log('wrote empty providers')"` — file created without error
3. `node bin/call-quorum-slot.cjs --slot test-slot < /dev/null 2>&1` — should print clear error (no providers or unknown slot), not a stack trace
4. `diff hooks/qgsd-prompt.js hooks/dist/qgsd-prompt.js` — zero diff
5. `grep 'orderedSlots.length === 0' hooks/qgsd-prompt.js` — guard present
6. `grep 'providers.length === 0' bin/call-quorum-slot.cjs` — guard present
7. `grep 'providers.length === 0' bin/probe-quorum-slots.cjs` — guard present
8. `grep 'No providers configured' bin/unified-mcp-server.mjs` — guard present
9. `grep 'providersList' bin/qgsd.cjs` — defensive access present
</verification>

<success_criteria>
- Empty providers.json (with `{ "providers": [] }`) does not crash any quorum component
- qgsd-prompt.js falls back to solo quorum mode with a clear warning message
- call-quorum-slot.cjs and probe-quorum-slots.cjs print diagnostic messages instead of stack traces
- unified-mcp-server.mjs starts successfully with zero tools when providers is empty
- qgsd.cjs TUI scoreboard shows "No agents configured" instead of crashing
- All existing tests continue to pass
- New tests cover the empty roster edge case
- Hook dist synced and installed
</success_criteria>

<output>
After completion, create `.planning/quick/137-fix-empty-roster-handling-add-validation/137-SUMMARY.md`
</output>
