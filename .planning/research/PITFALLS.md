# Pitfalls Research

**Domain:** Claude Code hook-based quorum enforcement (Stop hook + UserPromptSubmit hook)
**Researched:** 2026-02-20
**Confidence:** HIGH (official docs verified + confirmed via GitHub issues + existing codebase analysis)

---

## Critical Pitfalls

### Pitfall 1: Stop Hook Infinite Loop from Missing stop_hook_active Guard

**What goes wrong:**

The Stop hook fires, detects missing quorum, returns `{"decision": "block", "reason": "Quorum required"}`, Claude continues and responds again without doing quorum, the Stop hook fires again, blocks again, and this repeats without end. The session never terminates and burns through API tokens indefinitely.

**Why it happens:**

`stop_hook_active` is a field Claude Code injects into the Stop hook input when the hook has already forced a continuation. Developers either don't know this field exists or forget to check it. Once blocked, Claude gets the reason injected as context, responds again (potentially without completing quorum), and the hook fires again for the same outcome.

**How to avoid:**

Every Stop hook MUST begin with this guard as the first logic executed:

```javascript
const input = JSON.parse(fs.readFileSync('/dev/stdin', 'utf8'));
if (input.stop_hook_active === true) {
  process.exit(0); // Let Claude stop — already continued once
}
```

The guard must be unconditional. Do not check quorum again when `stop_hook_active` is true. The purpose of the flag is to break the loop regardless of what the transcript says.

**Warning signs:**

- Session runs indefinitely without user action
- Claude keeps repeating "I need to run quorum" messages in a loop
- API usage spikes with no corresponding task completion
- Terminal shows repeated "Stop hook feedback" lines

**Phase to address:** Phase 1 (Stop hook foundation). This guard must be in the initial implementation, not added later.

---

### Pitfall 2: Plugin-Delivered UserPromptSubmit Hook Output Not Injected into Context

**What goes wrong:**

UserPromptSubmit hooks defined in a plugin's `hooks/hooks.json` register correctly and even execute, but their stdout output is silently discarded. Claude never sees the quorum injection instructions the hook is meant to provide. This creates a silent failure: the hook reports success, but quorum injection never happens.

**Why it happens:**

This is a confirmed Claude Code bug (GitHub issue #10225, duplicated as #9708, also confirmed in #12151). The plugin hook execution pipeline is missing the stdout capture and context injection step that exists for settings-based hooks. The bug affects UserPromptSubmit and SessionStart specifically — Stop hooks installed via plugins work correctly for exit-code-based blocking, but their output is also affected by a related issue (#10875).

**How to avoid:**

Install the UserPromptSubmit hook in `~/.claude/settings.json` (user settings) rather than in the plugin's `hooks/hooks.json`. This is the confirmed workaround. The installer should write directly to user settings, not rely on plugin hook infrastructure for the injection path. For the Stop hook, use exit-code-based blocking (exit 2 + stderr) rather than JSON stdout output to avoid the plugin output capture bug.

**Warning signs:**

- Hook shows as registered in `/hooks` menu
- Debug log shows "Matched N hooks" but no "Hook output" line follows
- Claude proceeds without quorum context after a GSD planning command
- Adding the same hook to `~/.claude/settings.json` makes it work immediately

**Phase to address:** Phase 1 (installation architecture). Decide install target before writing any hook code — this affects where scripts are registered.

---

### Pitfall 3: Transcript Quorum Detection Fails on Compact or Session Resume

**What goes wrong:**

The Stop hook reads `transcript_path` to check for Codex/Gemini/OpenCode tool call evidence. After context compaction, the transcript is summarized and tool_use entries may be omitted or collapsed. The hook reads the compacted transcript, finds no MCP tool calls, and incorrectly blocks Claude even though quorum was performed before compaction. Every response from that point on gets blocked until the session is restarted.

**Why it happens:**

Claude Code's compaction mechanism rewrites the transcript to free context window space. The JSONL at `transcript_path` after compaction contains a summary message rather than the original turn-by-turn tool_use entries. The hook's string search or JSON parse finds no `mcp__codex-cli__*` or `mcp__gemini-cli__*` entries, concludes quorum was skipped, and blocks.

**How to avoid:**

Scope transcript search to the current turn only — specifically, to lines added since the last assistant message before the current Stop event. Use the `last_assistant_message` field provided directly in the Stop hook input (no transcript parsing required) as the primary evidence anchor. If searching the transcript file, only scan backward from the end of the file until the previous user message boundary, not the entire JSONL. Add an explicit check: if the transcript was compacted (look for a summary entry type), skip quorum enforcement for that turn and re-request quorum via `reason`.

**Warning signs:**

- Quorum blocking starts mid-session after a long planning conversation
- User reports hook never fires at session start but starts blocking later
- `/compact` command triggers a wave of block decisions
- Hook works for fresh sessions but not resumed ones

**Phase to address:** Phase 1 (Stop hook implementation). Transcript parsing scope must be defined during initial design, not discovered in testing.

---

### Pitfall 4: Overly Broad GSD Command Pattern Matching Blocks Non-Planning Prompts

**What goes wrong:**

The UserPromptSubmit hook uses a regex or string match to detect GSD planning commands like `/gsd:plan-phase`. The pattern is too broad: it matches `/gsd:execute-phase` (which explicitly does NOT need quorum per PROJECT.md), or it matches any prompt that contains the word "plan" or "/gsd:", blocking non-planning workflows. Users trying to execute work get quorum injection in contexts where it is actively harmful (execution is single-model only per CLAUDE.md R2.2).

**Why it happens:**

The intersection of "what needs quorum" and "what contains certain keywords" is not perfectly aligned. Developers write patterns that are easy to construct but imprecise. The full list of quorum-required commands from PROJECT.md is: `new-project`, `plan-phase`, `new-milestone`, `discuss-phase`, `verify-work`, `research-phase`. Execution commands must be excluded: `execute-phase`, `quick`, `debug`, `update`, `map-codebase`, `complete-milestone`.

**How to avoid:**

Use an explicit allowlist, not a blocklist or broad regex. Match the exact command names:

```javascript
const QUORUM_REQUIRED = [
  '/gsd:plan-phase',
  '/gsd:new-project',
  '/gsd:new-milestone',
  '/gsd:discuss-phase',
  '/gsd:verify-work',
  '/gsd:research-phase',
];
const prompt = input.prompt.trim();
const requiresQuorum = QUORUM_REQUIRED.some(cmd => prompt.startsWith(cmd));
```

`startsWith` prevents partial matches within longer strings. Do not use `includes` — it would match "I want to /gsd:execute-phase my plan".

**Warning signs:**

- Users report quorum injection on `/gsd:execute-phase` commands
- Quorum injection fires when users type natural language containing "plan" near a GSD command
- CLAUDE.md R2.2 violations (quorum injection during execution)
- Config file `quorum_commands` list diverges from default without user review

**Phase to address:** Phase 1 (UserPromptSubmit hook). The allowlist definition is a first-class design artifact, not an implementation detail.

---

### Pitfall 5: False Negative Quorum Detection — MCP Tool Name Unstable Across Versions

**What goes wrong:**

The Stop hook parses the transcript searching for evidence of `mcp__codex-cli__*`, `mcp__gemini-cli__*`, and `mcp__opencode__*` tool calls. If the MCP server name changes (e.g., `codex-cli` renamed to `codex`, or OpenCode registers as `opencode-mcp`), the string search finds nothing and blocks every response, even when quorum was completed correctly.

**Why it happens:**

MCP server names are configured in Claude Code's MCP settings and can vary between users. The QGSD codebase in PROJECT.md names `mcp__codex-cli__review`, `mcp__gemini-cli__gemini`, and `mcp__opencode__opencode` — but these match the current GSD CLAUDE.md R1 quorum members, which a user could theoretically rename. The hooks directory in GSD shows tool patterns like `mcp__*` used in matching, but quorum tool names are not centrally documented as a stable contract.

**How to avoid:**

Make the MCP server name patterns configurable in the QGSD config file (`.planning/config.json` or a dedicated `qgsd.json`). Do not hardcode names deep in hook logic. On first install, read the actual MCP server registrations from `~/.claude/settings.json` to auto-detect what names are in use. Document in the config file: "These must match the MCP server names in your Claude Code settings." Provide a verification command (`/qgsd:verify`) that tests detection end-to-end.

**Warning signs:**

- Hook blocks after confirmed quorum runs
- User has renamed or reinstalled MCP servers
- Tool names in transcript don't match configured pattern list
- Hook never passes on any transcript inspection

**Phase to address:** Phase 1 (Stop hook) and Phase 2 (config system). Detection patterns are config, not constants.

---

### Pitfall 6: Stop Hook Fires for Every Subagent, Not Just the Main Session

**What goes wrong:**

GSD workflows spawn multiple subagents (gsd-planner, gsd-executor, gsd-verifier, etc.) using the Task tool. Stop hooks in settings files are inherited by subagents. The quorum Stop hook fires when each subagent finishes, not just when the main orchestrator finishes. Each subagent's transcript only contains its own narrow work — no MCP quorum tool calls — so the hook blocks every subagent from completing, making all GSD workflows non-functional.

**Why it happens:**

Claude Code documentation explicitly states: "any settings defined for your main agent—including powerful hooks—are inherited by any sub-agents it creates." The Stop hook at the settings level fires for both the main session Stop event AND every subagent's stop. Subagents have their own transcript at `agent_transcript_path`, not the main `transcript_path`. The quorum hook checks the wrong transcript or fires at the wrong scope entirely.

**How to avoid:**

Use `SubagentStop` awareness: in the Stop hook input, check if `agent_id` is present (non-null), which indicates the hook is firing for a subagent context. If the hook is installed as a settings-level Stop hook, it will also receive SubagentStop events. The correct pattern: only enforce quorum enforcement when `stop_hook_active` is false AND the input does not indicate a subagent context. Alternatively, scope the hook to fire only from a skill or agent frontmatter (which confines it to that component's lifecycle), but this approach may not work for the main session gate. The safest approach: check `hook_event_name` in the input — it will be `"Stop"` for the main session and `"SubagentStop"` for subagents.

**Warning signs:**

- GSD execution commands (execute-phase, plan-phase) hang indefinitely
- Every Task() spawned agent gets blocked
- Logs show Stop hook blocking on subagent transcripts with no MCP tool calls
- Sessions time out during normal GSD workflows

**Phase to address:** Phase 1 (Stop hook). Subagent scope exclusion must be tested before any GSD command is exercised against the hook.

---

## Technical Debt Patterns

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| Hardcode MCP tool names in hook script | Faster first implementation | Breaks silently when users rename MCP servers; config drift undetectable | Never — always use config |
| Scan entire transcript for quorum evidence | Simpler parsing logic | False positives after compaction; false negatives from stale quorum in earlier turns | Never — always scope to current turn |
| Single static regex for GSD command detection | One-liner match | Matches execution commands; blocks non-planning workflows; breaks when GSD adds commands | Never — use explicit allowlist |
| Omit stop_hook_active guard in early version | Skip edge case handling | First session that triggers the loop burns tokens and confuses user | Never — must be in v1 |
| Install UserPromptSubmit hook via plugin hooks.json | Matches plugin architecture | Silent failure due to confirmed Claude Code bug (#10225, #12151) | Never — install to user settings |

---

## Integration Gotchas

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| Claude Code plugin hooks.json | Putting UserPromptSubmit hook in plugin for clean packaging | Install to ~/.claude/settings.json via installer; plugin bugs prevent output injection |
| Claude Code plugin hooks.json | Putting Stop hook JSON output in plugin and relying on stdout capture | Use exit 2 + stderr for Stop hook blocking; JSON output from plugin Stop hooks is unreliable (#10875) |
| Claude Code subagent spawning | Assuming Stop hook only fires for main session | Explicitly check hook_event_name to exclude SubagentStop scope |
| Transcript JSONL parsing | Reading entire transcript for quorum evidence | Scope search to current turn only; respect compaction boundaries |
| MCP tool call detection | Searching for tool name substring in raw JSONL text | Parse JSONL lines properly; MCP tool names appear in tool_use content blocks as `"name": "mcp__server__tool"` |
| GSD execute-phase workflows | Quorum injection during execution (CLAUDE.md R2.2 violation) | Only inject on planning commands; execute-phase must be excluded by name |

---

## Performance Traps

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| Reading entire transcript JSONL for each Stop event | Hook takes 2-5s on long sessions; user sees spinner on every response | Only read last N lines (configurable, default 200) or use `last_assistant_message` field directly | Transcripts >10MB (sessions running for hours with many tool calls) |
| Spawning a full node.js process for every Stop event | 100-200ms startup overhead per response turn | Use a compiled or startup-fast hook; keep dependencies minimal (no npm imports beyond stdlib) | Noticeable on rapid multi-turn sessions |
| Blocking Stop hook with timeout not set | Default 10-minute timeout; hung hook blocks session for 10 minutes | Set explicit `timeout: 30` on the Stop hook | Any hook that hangs (file read fails, JSON parse error) |

---

## Security Mistakes

| Mistake | Risk | Prevention |
|---------|------|------------|
| Reading transcript file without path validation | transcript_path from hook input could theoretically point to sensitive files if tampered with | Use only the transcript_path field as-is (not user-constructed); validate it points to expected ~/.claude/projects/ prefix before reading |
| Emitting quorum block reason that reveals internal policy text | Could expose CLAUDE.md R-rule details users should not see | Keep block messages user-facing and action-oriented ("Quorum required — run Codex, Gemini, and OpenCode checks first") |
| Hook script executable by all users | In multi-user environments, hook script is world-writable | Install with chmod 755 (owner write, group/world execute only) |

---

## UX Pitfalls

| Pitfall | User Impact | Better Approach |
|---------|-------------|-----------------|
| Cryptic block message: "Quorum failed" | User doesn't know what quorum is or what to do | Message must name the missing models and provide the exact tool call names to run: "Quorum incomplete. Missing: Codex (mcp__codex-cli__review), Gemini (mcp__gemini-cli__gemini). Run these before continuing." |
| Silent injection of quorum instructions | User sees no acknowledgment that a GSD planning command triggered extra requirements | UserPromptSubmit can echo a brief "QGSD: Quorum enforcement active for /gsd:plan-phase" line to stderr (visible in verbose mode) |
| Hook blocks with no path to resolution | User is stuck in a blocked session with no clear next step | Block reason MUST include the exact next action: "Run mcp__codex-cli__review, mcp__gemini-cli__gemini, mcp__opencode__opencode, then retry your response." |
| Hook blocks `/gsd:execute-phase` by mistake | Execution is halted; CLAUDE.md R2.2 violated (quorum during execution is prohibited) | Test allowlist against all GSD commands; execute-phase must never trigger quorum injection |
| Hook blocks non-GSD conversations | User loses ability to use Claude Code for normal work | UserPromptSubmit must only activate on GSD planning commands; all other prompts pass through with exit 0 |
| Fail-closed on model unavailability | If Gemini is quota-limited, all GSD planning is blocked indefinitely | Implement fail-open per CLAUDE.md R6: note reduced quorum but proceed |

---

## "Looks Done But Isn't" Checklist

- [ ] **stop_hook_active guard:** Verify the guard is the very first logic in the Stop hook, before any transcript read. Test by running the hook twice in sequence without quorum and confirming the second run exits 0.
- [ ] **Subagent exclusion:** Run `/gsd:plan-phase` with the hook active and confirm that subagents spawned during the workflow complete normally. A false positive here blocks all GSD execution.
- [ ] **Plugin output delivery:** If using plugin hooks.json for UserPromptSubmit, verify the hook output actually appears in Claude's context by asking Claude to repeat back the injected text. Confirm the workaround (settings.json install) is in use.
- [ ] **Compaction robustness:** Start a long planning session, trigger compaction (`/compact`), and then verify the Stop hook does not false-block on the next response.
- [ ] **Execute-phase exclusion:** Run `/gsd:execute-phase 1` and verify no quorum injection occurs (check that Claude does not see quorum instructions in context).
- [ ] **Fail-open on quota:** Simulate Gemini unavailability (comment out detection) and confirm the hook proceeds with reduced quorum rather than blocking indefinitely.
- [ ] **MCP name configurability:** Change the Codex MCP server name in config and verify the hook uses the new name without a code change.

---

## Recovery Strategies

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| Infinite Stop hook loop | LOW | Restart the Claude Code session; add stop_hook_active guard before re-enabling hook |
| Plugin hook silent failure | LOW | Move hook definition to ~/.claude/settings.json; re-run installer to register there |
| Transcript compaction false block | MEDIUM | Restart session; narrow transcript search window in hook code; redeploy |
| Wrong MCP names blocking everything | LOW | Update qgsd config with correct MCP server names; hook picks up on next session |
| Subagent scope fires on all tasks | HIGH | Disable hook immediately; add hook_event_name guard; full regression test of GSD workflows before re-enabling |
| Overly broad command pattern | MEDIUM | Update allowlist in hook; restart session; verify execute-phase is unaffected |

---

## Pitfall-to-Phase Mapping

| Pitfall | Prevention Phase | Verification |
|---------|------------------|--------------|
| Infinite Stop loop (missing stop_hook_active) | Phase 1: Stop hook foundation | Test: run hook twice in sequence, confirm second run exits 0 |
| Plugin hook output not delivered | Phase 1: Installation architecture | Test: add hook to settings.json; verify injected text appears in Claude context |
| Transcript compaction false block | Phase 1: Stop hook transcript parsing | Test: compact a session, confirm hook does not block on next turn |
| Broad command pattern (false positives/negatives) | Phase 1: UserPromptSubmit allowlist | Test: exercise every GSD command; verify only planning set triggers injection |
| MCP name instability | Phase 1 + Phase 2 (config system) | Test: change config MCP names; verify hook uses new names immediately |
| Subagent scope fires for all Task() agents | Phase 1: Stop hook scope guard | Test: run execute-phase, verify all subagents complete without hook blocking |
| Cryptic block messages | Phase 1: UX messaging | Test: intentionally fail quorum; verify block message names missing models and exact next steps |
| Fail-closed on model unavailability | Phase 1: Fail-open logic | Test: disable one model; verify reduced quorum proceeds rather than blocking |

---

## Sources

- [Claude Code Hooks Reference — official docs](https://code.claude.com/docs/en/hooks) — HIGH confidence (official, current)
- [Claude Code Hooks Guide — official docs](https://code.claude.com/docs/en/hooks-guide) — HIGH confidence (official, troubleshooting section)
- [GitHub Issue #10225: UserPromptSubmit hooks from plugins match but never execute](https://github.com/anthropics/claude-code/issues/10225) — HIGH confidence (confirmed bug, closed as duplicate)
- [GitHub Issue #12151: Plugin hook output not captured for UserPromptSubmit/SessionStart](https://github.com/anthropics/claude-code/issues/12151) — HIGH confidence (open bug with reproduction, 22 confirmations)
- [GitHub Issue #10412: Stop hooks with exit code 2 fail via plugins](https://github.com/anthropics/claude-code/issues/10412) — HIGH confidence (confirmed bug with workaround)
- [GitHub Issue #10205: Claude Code enters infinite loop when hooks enabled](https://github.com/anthropics/claude-code/issues/10205) — HIGH confidence (confirmed systemic issue)
- [GitHub Issue #3573: Stop hook infinite loop in GitHub Actions](https://github.com/anthropics/claude-code/issues/3573) — HIGH confidence (confirmed environment incompatibility)
- [GitHub Issue #10610: Feature request for model response in Stop event](https://github.com/anthropics/claude-code/issues/10610) — MEDIUM confidence (closed as not planned, confirms last_assistant_message is not yet exposed via Stop)
- [Egghead: Settings Pollution in Subagents, Hooks, and Scripts](https://egghead.io/avoid-the-dangers-of-settings-pollution-in-subagents-hooks-and-scripts~xrecv) — MEDIUM confidence (community tutorial, confirms inheritance behavior)
- [Taskmaster Stop Hook](https://github.com/blader/taskmaster) — MEDIUM confidence (real-world Stop hook implementation, confirms stop_hook_active pattern)
- QGSD codebase analysis: `.planning/codebase/CONCERNS.md`, `.planning/codebase/ARCHITECTURE.md`, `.planning/codebase/INTEGRATIONS.md` — HIGH confidence (direct codebase audit)
- QGSD project definition: `.planning/PROJECT.md` — HIGH confidence (authoritative project scope)

---

*Pitfalls research for: Claude Code hook-based multi-model quorum enforcement (QGSD)*
*Researched: 2026-02-20*
