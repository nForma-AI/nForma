# Pitfalls Research

**Domain:** Adding behavioral enforcement hooks to an existing Claude Code plugin (nForma)
**Researched:** 2026-03-19
**Confidence:** HIGH — derived directly from source code inspection of hooks/nf-prompt.js, hooks/nf-session-start.js, hooks/config-loader.js, and bin/install.js

---

## Critical Pitfalls

### Pitfall 1: Session State Injection That Fires on Every Message, Not Just the First

**What goes wrong:**
A "session-start state injection" placed in a UserPromptSubmit hook fires on every prompt, not once per session. The result is that every message receives the state preamble — including mid-task follow-ups where the context is already established — creating noise on every turn.

**Why it happens:**
UserPromptSubmit has no concept of "first message." There is no built-in session-message-count field in the hook payload. Developers assume the hook name implies first-message-only behavior. It does not. SessionStart is the correct event for first-message work, but it cannot inject into specific prompts — it runs before any prompt arrives and injects via `additionalContext`. The distinction is: SessionStart fires once per session; UserPromptSubmit fires on every prompt.

The existing nf-session-start.js already demonstrates the correct pattern: it uses SessionStart to inject STATE.md reminders, memory entries, and telemetry. Adding a parallel first-message feature to nf-prompt.js (UserPromptSubmit) without a seen-flag guard causes double injection and every-message noise.

**How to avoid:**
- If the injection must happen in UserPromptSubmit, write a session-scoped seen-flag file (e.g., `.claude/session-injected-<sessionId>.flag`) and check it atomically before injecting. Use `fs.renameSync` for the claim — the same pattern as `consumePendingTask` in nf-prompt.js lines 82-110.
- Prefer using nf-session-start.js (SessionStart event) for state that should appear once per session — it already has the injection machinery. Extend it rather than adding a competing injection path.
- If both hooks inject additionalContext, the combined text may exceed Claude's attention budget. The existing comment in nf-prompt.js (line 864) already acknowledges a hook-level 800-char cap for context-stack injection because "additionalContext contends with other injections." A new first-message injector competes with circuit breaker recovery, pending task, quorum instructions, thinking budget, and context stack.

**Warning signs:**
- The same STATE.md snippet appears verbatim in responses to second and third follow-up messages.
- Claude acknowledges "session state reminder" in the middle of an in-progress task it already knows about.
- Unit test for the new injection path does not mock `sessionId` to test the idempotency branch.

**Phase to address:**
Session state injection feature — implement idempotency gate before shipping. The session-scoped flag file pattern from `consumePendingTask` (nf-prompt.js lines 82-110) is the implementation template.

---

### Pitfall 2: Pattern-Matched Prompt Injection Triggers on False Positives and Suppresses Quorum

**What goes wrong:**
A regex that detects "fix" or "debug" in the prompt text matches legitimate planning commands (`/nf:solve`, `/nf:new-milestone`) and applies the pattern-injection branch instead of the quorum-injection branch. The early-exit pattern in nf-prompt.js (multiple `process.exit(0)` after writing to stdout) means whichever branch matches first wins. If the pattern-injection branch fires before the quorum-injection check, the Stop hook sees no `<!-- GSD_DECISION -->` and blocks the response.

**Why it happens:**
nf-prompt.js uses priority-ordered branches: circuit breaker -> pending task -> quorum injection. Each branch writes to stdout and exits. A new pattern-matched branch inserted anywhere before the quorum block or without integrating into the quorum block becomes a bypass path. The words "fix" and "debug" appear in: `/nf:solve` prompts ("fix the bug"), follow-up clarifications ("can you debug this?"), and the quorum instructions themselves.

The existing cmdPattern gate at line 882 (`/^\s*\/(nf|q?gsd):[\w][\w-]*(\s|$)/`) is only checked at the bottom of the quorum block. Pattern matching added before that gate has no knowledge of whether quorum is required.

**How to avoid:**
- Pattern-matched injection must be layered inside the quorum build path, not as a separate early-exit branch. The correct implementation appends to `instructions` (the string already being assembled for quorum output) rather than replacing it.
- The command allowlist check (line 882) must remain the outer gate. Pattern detection should only affect what gets appended to instructions, not whether quorum fires.
- Use anchored regexes. `/\bfix\b/i` matches "prefix" and "suffix". Use word-boundary anchors and test against the actual prompt corpus. The circuit breaker's `READ_ONLY_REGEX` in nf-circuit-breaker.js demonstrates anchored matching against real tool command text.
- Add a unit test in nf-prompt.test.js that sends `/nf:solve fix the authentication bug` and asserts both pattern injection content AND `<!-- GSD_DECISION -->` are present in the output.

**Warning signs:**
- Stop hook blocks `/nf:solve` responses that contain "fix" in the issue description.
- Pattern injection fires on non-planning freeform messages like "can you fix the typo in README?"
- No test exercises the interaction between pattern detection and the quorum injection path.

**Phase to address:**
Pattern injection feature — design phase must specify whether pattern injection is additive to quorum instructions or a replacement. The answer must be additive; any replacement breaks the Stop hook gate.

---

### Pitfall 3: Approach Declaration Gate in Workflow Files Conflicts with Existing Quorum Decision Token

**What goes wrong:**
An "approach declaration gate" added to a workflow file requires Claude to declare its approach before proceeding. If the gate is enforced by the Stop hook scanning for a new token (e.g., `<!-- APPROACH_DECLARED -->`), and this token is not present in the quorum output path, the Stop hook blocks every planning response — not just those missing an approach declaration.

Conversely, if the gate is enforced only by the workflow instruction text (no hook enforcement), it becomes advisory and Claude skips it under token pressure.

**Why it happens:**
Workflow files in `~/.claude/nf/workflows/` are injected as `additionalContext` from nf-session-start.js or nf-prompt.js. They are read by Claude but not structurally verified. The only verified tokens are `<!-- GSD_DECISION -->` (Stop hook) and `<!-- NF_SOLO_MODE -->` / `<!-- NF_CACHE_HIT -->` (nf-prompt.js output). Adding a new required token to a workflow file without updating the Stop hook is inert. Adding it to the Stop hook without also emitting it in the quorum instructions string (built in nf-prompt.js) breaks all planning responses.

There is also a workflow sync hazard: workflow files live in two places — `core/workflows/` in the repo (durable) and `~/.claude/nf/workflows/` (installed). An edit to the `core/` file without re-running `node bin/install.js --claude --global` has no effect — the installed copy is stale. Editing the installed copy directly is reverted on next install.

**How to avoid:**
- Approach declaration gates enforced by the Stop hook must emit the required token in the quorum instructions string built by nf-prompt.js — the same string that already contains `<!-- GSD_DECISION -->`.
- Workflow-file-only enforcement is acceptable only if the gate is purely advisory and failure tolerance is high. Document the decision explicitly.
- Always sync workflow edits: `cp core/workflows/<file> ~/.claude/nf/workflows/` followed by `node bin/install.js --claude --global`. Never edit `~/.claude/nf/workflows/` directly as the durable source.
- Treat workflow injection as prompt-engineering, not a structural gate. Structural gates belong in hooks.

**Warning signs:**
- "Works in dev" (editing core/) but the installed behavior is unchanged — stale installed workflow.
- Stop hook blocks responses that contain a correct quorum result but no approach declaration token.
- Approach declaration appears in some planning responses but not others depending on context window pressure.

**Phase to address:**
Approach declaration feature — the implementation plan must specify: (a) which layer enforces it (workflow instruction vs Stop hook token), and (b) whether the Stop hook is being modified. If (b), the dist/ sync and install step are mandatory tasks in the plan.

---

### Pitfall 4: New PreToolUse Edit/Write Guard Hook Fires on Every Tool Call Without Scope Filtering

**What goes wrong:**
A PreToolUse hook registered without a `matcher` field fires on every tool use — not just Edit/Write. This includes Bash, Read, Task, and all MCP tools. A scope guard intended for file writes becomes a 1-2ms tax on every tool call, including read-only operations. At 200+ tool calls per planning session this is measurable latency and introduces false-positive blocking risk if the guard logic has any path that exits non-zero.

The nForma codebase currently uses unscoped PreToolUse entries for nf-circuit-breaker and nf-mcp-dispatch-guard (install.js lines 2329, 2351). This is correct for those hooks because they legitimately need every-tool coverage. A scope guard does not.

**Why it happens:**
Claude Code PreToolUse entries in settings.json do not require a matcher. Developers add a new entry following the existing unscoped pattern without realizing existing hooks are intentionally unscoped. The `tool_name` field in the hook payload is the mechanism for inside-hook filtering, but registering without a matcher wastes cycles even before the inside-hook check runs.

There is also an install.js idempotency pattern to follow: every registered hook checks `hasXxxHook` before pushing (e.g., `hasCircuitBreakerHook`, `hasMcpDispatchGuardHook`). A new hook that omits the duplicate guard gets re-registered on every `node bin/install.js --claude --global` run, resulting in multiple identical entries in settings.json.

**How to avoid:**
- In settings.json, use the `matcher` field to restrict PreToolUse hooks to specific tool names. The SubagentStop and SubagentStart hooks in install.js lines 2434 and 2448 use `matcher` for agent-type filtering — that is the verified pattern in this codebase.
- Inside the hook script, still check `input.tool_name` as defense-in-depth: `if (!['Edit', 'Write', 'MultiEdit'].includes(input.tool_name)) process.exit(0);`
- Add the idempotency check in install.js using the same `settings.hooks.PreToolUse.some(entry => ...)` pattern.
- Also add an uninstall filter in the uninstall block (following the nf-mcp-dispatch-guard removal pattern at install.js line 1407-1418).
- Register the hook in config-loader.js `HOOK_PROFILE_MAP.standard` Set and `DEFAULT_HOOK_PRIORITIES` map (Low/10 for a guard hook). Omitting registration means `shouldRunHook()` returns false in minimal profile.

**Warning signs:**
- Every Bash tool call takes 10-20ms longer after the hook is added.
- Multiple identical entries for the new hook appear in `~/.claude/settings.json` after running install twice.
- Guard triggers during `Read` tool calls — no-matcher scope bleed.
- `shouldRunHook('nf-new-guard', 'minimal')` returns false because the hook name was not added to config-loader.js `HOOK_PROFILE_MAP`.
- Uninstall (`--uninstall`) does not remove the hook from settings.json because no removal filter exists.

**Phase to address:**
Edit/Write scope guard feature — install registration task must cover four items: (a) idempotency guard, (b) matcher field, (c) config-loader.js profile map update, (d) DEFAULT_HOOK_PRIORITIES entry. The uninstall removal filter is a fifth required item. Missing any one causes a regression.

---

## Technical Debt Patterns

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| Inject via workflow file instead of hook | No install step required | Advisory only — Claude can ignore under context pressure | Only for non-critical UX nudges |
| Skip dist/ sync, edit installed hook directly | Faster iteration | Reverted on next install; stale source diverges from installed behavior | Never |
| Omit `shouldRunHook()` profile guard in new hook | Less boilerplate | Hook runs in minimal profile where it should be silent; adds noise | Never — 3 lines, always include |
| Hard-code command patterns instead of reading from config | No config loading | Breaks if user renames commands or uses strict vs standard profile | Prototyping only, remove before ship |
| Use `process.stderr.write` for debug output | Fast debugging | Claude Code treats unexpected stderr as a hook error signal; noisy in production | Dev only, behind an env flag |

---

## Integration Gotchas

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| hooks/dist/ sync | Edit `hooks/nf-*.js` directly without copying to `hooks/dist/` | `cp hooks/nf-X.js hooks/dist/ && node bin/install.js --claude --global` — installer reads dist/ not hooks/ |
| config-loader profile registration | Add new hook name in hook file only | Also update `HOOK_PROFILE_MAP` and `DEFAULT_HOOK_PRIORITIES` in config-loader.js |
| Stop hook token verification | Add new required token to workflow file only | Also emit the token in the nf-prompt.js instructions string so it appears in Claude's output |
| UserPromptSubmit exit priority | Add new branch that writes stdout and exits | All stdout-writing branches are final exits; quorum injection must not be bypassable by any earlier branch |
| install.js idempotency guard | Omit `hasXxxHook` check for new hook | Every hook registration in install.js must have an idempotency guard matching the command path |
| `additionalContext` character budget | Inject large context blobs without size check | The 800-char hook-level cap applies; large injections crowd out quorum instructions |

---

## Performance Traps

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| Unscoped PreToolUse hook doing file I/O | Every tool call adds 10-50ms | Use matcher field + early `tool_name` exit check to skip non-target tools | Noticeable at 20+ tool calls per session |
| Pattern regex with backtracking on long prompts | Prompt injection hook slows on 2000-char prompts | Use anchored, non-greedy patterns; test against 2000-char prompts | Any prompt over 500 chars |
| Reading config or scoreboard on every UserPromptSubmit | Config parse on every keystroke | loadConfig() is already cached; use that cache; avoid new fs.readFileSync calls in the hot path | After 50+ planning sessions |
| Spawning a child process synchronously in a scope guard | 100-300ms per tool call | Use spawnSync only when result is required for the blocking decision; advisory data should not block | Every tool call where the hook is active |

---

## "Looks Done But Isn't" Checklist

- [ ] **Session state injection:** Idempotency flag checked — verify the hook does NOT inject on the second prompt in the same session
- [ ] **Pattern-matched injection:** Quorum path integration tested — verify `/nf:solve fix X` still produces `<!-- GSD_DECISION -->` in the Stop hook scan
- [ ] **Approach declaration gate:** Workflow sync verified — `diff core/workflows/ ~/.claude/nf/workflows/` returns no differences after install
- [ ] **Edit/Write scope guard:** Uninstall path in install.js exists — the removal filter matches the new hook command path
- [ ] **All new hooks:** `shouldRunHook()` call present — verify hook exits cleanly in minimal profile
- [ ] **All new hooks:** Fail-open catch block present — outer try/catch with `process.exit(0)` in the catch
- [ ] **All new hooks:** No `process.stderr.write` outside of genuine error paths — leftover debug writes cause false hook-error signals
- [ ] **All new hooks:** Uninstall removal filter added to install.js — verify `--uninstall` removes the hook from settings.json

---

## Recovery Strategies

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| Every-message session injection noise | LOW | Add seen-flag check, re-sync dist/, re-install |
| Pattern injection bypassing quorum (Stop blocks all responses) | MEDIUM | Revert nf-prompt.js to last known-good, re-sync dist/, re-install, verify with `/nf:plan test` |
| Stale workflow file (approach gate not firing) | LOW | `cp core/workflows/<file> ~/.claude/nf/workflows/` + `node bin/install.js --claude --global` |
| Unscoped PreToolUse causing latency | LOW | Add matcher field or inside-hook early exit, re-sync, re-install |
| Multiple duplicate hook entries in settings.json | LOW | Manually deduplicate `~/.claude/settings.json` PreToolUse array; add idempotency guard to install.js |
| New hook not running in standard profile | LOW | Add hook name to `HOOK_PROFILE_MAP.standard` in config-loader.js, re-sync dist/, re-install |

---

## Pitfall-to-Phase Mapping

| Pitfall | Prevention Phase | Verification |
|---------|------------------|--------------|
| Session injection every-message noise | Session state injection implementation phase | Unit test: send two prompts with same sessionId, assert second gets no injection |
| Pattern injection bypasses quorum gate | Pattern injection design phase — before writing code | Integration test: `/nf:solve fix X` must pass Stop hook scan |
| Approach gate workflow sync | Approach declaration delivery phase | `diff core/workflows/ ~/.claude/nf/workflows/` in verification step |
| PreToolUse scope bleed | Edit/Write guard implementation phase | Bash tool_name test: assert guard exits 0 without triggering on Bash calls |
| Missing profile registration | Any new hook — implementation phase | `shouldRunHook('new-hook', 'minimal')` returns false; `shouldRunHook('new-hook', 'standard')` returns true |
| dist/ sync forgotten | Any hook edit — delivery phase | Verify `diff hooks/nf-X.js hooks/dist/nf-X.js` returns no differences before running install |
| Missing uninstall path | Edit/Write guard implementation phase | Run `node bin/install.js --uninstall`; verify hook entry is gone from settings.json |

---

## Sources

- Direct inspection: `/Users/jonathanborduas/code/QGSD/hooks/nf-prompt.js` (priority chain, stdout exit pattern, additionalContext budget comment at line 864, consumePendingTask idempotency model)
- Direct inspection: `/Users/jonathanborduas/code/QGSD/hooks/nf-session-start.js` (SessionStart injection pattern, single-write at end, _contextPieces accumulator)
- Direct inspection: `/Users/jonathanborduas/code/QGSD/hooks/config-loader.js` (HOOK_PROFILE_MAP, DEFAULT_HOOK_PRIORITIES, shouldRunHook, matcher usage)
- Direct inspection: `/Users/jonathanborduas/code/QGSD/bin/install.js` (PreToolUse registration pattern, idempotency guards, dist/ rebuild logic, matcher in SubagentStop/SubagentStart at lines 2434 and 2448)
- Direct inspection: `/Users/jonathanborduas/code/QGSD/hooks/nf-mcp-dispatch-guard.js` (unscoped PreToolUse pattern, fail-open exit, providers.json-driven scope)
- Direct inspection: `/Users/jonathanborduas/code/QGSD/hooks/nf-circuit-breaker.js` (READ_ONLY_REGEX anchored pattern example)
- Project memory: MEMORY.md — install sync requirement, workflow sync requirement, dist/ as installer source

---

*Pitfalls research for: adding behavioral enforcement hooks to an existing Claude Code plugin (nForma)*
*Researched: 2026-03-19*
