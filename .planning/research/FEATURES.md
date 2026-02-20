# Feature Research

**Domain:** Claude Code plugin — hook-based multi-model quorum enforcement
**Researched:** 2026-02-20
**Confidence:** HIGH (Claude Code hooks system verified against official docs; plugin system verified against official docs; GSD codebase read directly)

---

## Feature Landscape

### Table Stakes (Users Expect These)

Features users assume exist. Missing these = plugin doesn't fulfill its stated purpose.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| UserPromptSubmit hook detects GSD planning commands | Without detection there is nothing to enforce — the plugin does nothing | LOW | Must match `/gsd:plan-phase`, `/gsd:new-project`, `/gsd:new-milestone`, `/gsd:discuss-phase`, `/gsd:verify-work`, `/gsd:research-phase` in the `prompt` field via regex. UserPromptSubmit always fires; no matcher support, so command detection must be inside the script. |
| UserPromptSubmit injects quorum instructions into Claude's context | Without injection Claude has no instruction to run quorum; enforcement collapses to behavioral compliance (the problem being solved) | LOW | Use `additionalContext` via JSON output, not raw stdout. The instructions tell Claude *which models to call* and *what to do*. Must fire only when a GSD planning command is detected, not on every prompt. |
| Stop hook reads transcript and detects evidence of quorum tool calls | This is the hard gate. Without it Claude can ignore quorum instructions. The hook must verify quorum happened before allowing Claude to stop. | MEDIUM | Reads `transcript_path` (JSONL). Parses each line looking for `tool_use` content blocks with `name` matching `mcp__codex-cli__review`, `mcp__gemini-cli__gemini`, `mcp__opencode__opencode`. Returns `{"decision":"block","reason":"..."}` if quorum evidence is absent. Must check `stop_hook_active` to prevent infinite loops. |
| Fail-open: proceed with available models when one is unavailable | Matches CLAUDE.md R6. Blocking work because one model has quota issues is worse than reduced quorum. | LOW | Stop hook logic: require evidence of at least 2 of 3 external models (not zero). Note which model is absent in the block reason. If all 3 are unavailable, still allow stop (don't deadlock). |
| Configurable command scope: which `/gsd:*` commands trigger quorum | Users need to customize — not every project needs quorum on every command | LOW | Config file at `~/.claude/qgsd-config.json` or `.planning/qgsd-config.json`. Default set is the 6 high-stakes commands. Format: JSON array of command strings. Read by both hooks at runtime. |
| Clear, actionable block message when Stop hook fires | User must understand *why* Claude was blocked and *what to do*. An opaque error wastes time and erodes trust. | LOW | `reason` field in `{"decision":"block","reason":"..."}`. Must name the specific missing models, not just "quorum incomplete". Must tell Claude explicitly to run the missing tools before continuing. Note: Claude Code currently labels this "Stop hook error:" even on intentional blocks — known UX issue (GitHub issue #12667). |
| Global install to `~/.claude/` | Quorum should apply everywhere, not require per-project opt-in. Matches GSD's install behavior. | LOW | Hooks registered in `~/.claude/settings.json`. Config at `~/.claude/qgsd-config.json`. Plugin dir at `~/.claude/plugins/qgsd/` if distributed as plugin, or hooks dir directly if installed as standalone. |
| Works alongside GSD without modification | Plugin extension, not fork. GSD updates must not break QGSD. | LOW | QGSD uses only additive hooks. No GSD source files are touched. Hook scripts are self-contained. The only coupling is the command name strings in config, which are stable across GSD versions. |
| Infinite-loop prevention in Stop hook | Without `stop_hook_active` check, the hook re-fires after blocking, causing Claude to run indefinitely | LOW | First line of Stop hook script: parse stdin, check `stop_hook_active === true`, exit 0 immediately if so. This is documented as required pattern in official docs. |

**Dependency chain for table stakes:**

```
Config file (which commands trigger quorum)
    └──read by──> UserPromptSubmit hook (detects command, injects instructions)
                      └──injects into context──> Claude runs quorum (calls Codex, Gemini, OpenCode)
                                                     └──evidence in transcript──> Stop hook checks transcript
                                                                                      └──blocks or allows stop
```

---

### Differentiators (Competitive Advantage)

Features that set QGSD apart. Not required for the plugin to work, but make it excellent.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Specific model attribution in block message | "Codex evidence found. Gemini missing. OpenCode missing. Run both before stopping." tells Claude exactly what to do, reducing unnecessary back-and-forth. | LOW | The Stop hook already parsed which models were found; adding attribution to the reason costs nothing. Makes quorum debugging fast. |
| Per-project config override | Global config sets defaults; project-level `.planning/qgsd-config.json` overrides for specific projects. | LOW | Standard config layering: load global, load project if exists, project wins on overlap. Matches `.planning/config.json` pattern already used by GSD. |
| Hook status message during transcript scan | Showing "Verifying quorum..." while the Stop hook reads the transcript reduces user anxiety during the 1-3 second wait. | LOW | `"statusMessage": "Verifying quorum..."` field in hook config in `hooks.json`. Supported by Claude Code hook system natively. |
| Session-scoped quorum cache | Once quorum is verified in a session, don't re-check the full transcript on every subsequent Stop event for the same command. | MEDIUM | Cache in memory via a temp file keyed to `session_id + command`. Reduces transcript-parse overhead for long sessions. Risk: cache invalidation if Claude re-invokes a planning command. Keep simple: only cache within a single Stop hook execution context. Actually: Stop hook spawns a new process each time, so true in-memory cache is not possible without a file. Write to `/tmp/qgsd-{session_id}-quorum.json`. |
| Dry-run mode | `"dryRun": true` in config causes hooks to inject quorum instructions but never block — just log what would have been blocked. | LOW | Useful during initial rollout or debugging. UserPromptSubmit injects normally; Stop hook exits 0 but writes to `/tmp/qgsd-dry-run.log`. |
| Plugin distribution via Claude Code plugin system | Installable via `claude plugin install` — zero-friction adoption for GSD users. | MEDIUM | Requires `.claude-plugin/plugin.json` manifest, `hooks/hooks.json`, and hook scripts that use `${CLAUDE_PLUGIN_ROOT}`. User scope by default. This is the right distribution model for v1 given it should apply globally. Dependency: Claude Code plugin system must be available (it is, per official docs). |
| Explicit quorum-passed annotation in last_assistant_message | Stop hook checks `last_assistant_message` field (available in Stop hook input without parsing transcript) for a quorum summary before doing the heavier JSONL scan. Fast path: if the message contains a quorum confirmation, skip transcript scan entirely. | LOW | `last_assistant_message` is provided directly in Stop hook stdin JSON. Check it first. Only fall back to transcript scan if the message doesn't clearly confirm quorum. Reduces I/O on the common case where quorum ran successfully and Claude summarized it. |
| Structured install script with validation | Install script verifies that Codex, Gemini, and OpenCode MCPs are registered before activating enforcement. If a required MCP is absent, warns user rather than silently enforcing a system that will always block. | MEDIUM | Read `~/.claude/settings.json` during install, check for `mcp__codex-cli__*`, `mcp__gemini-cli__*`, `mcp__opencode__*` in mcpServers. Warn and offer to continue or abort. This prevents a common first-run failure mode. |

---

### Anti-Features (Commonly Requested, Often Problematic)

Features that seem good but create problems. Explicitly NOT building these in v1.

| Anti-Feature | Why Requested | Why Problematic | Alternative |
|--------------|---------------|-----------------|-------------|
| Calling Codex/Gemini/OpenCode CLIs directly from hooks | "Let the hook run quorum itself — no trust required" | Hooks run as shell scripts with 600s timeout. Direct CLI calls require auth tokens, external process management, output parsing, and introduce network dependency. Fragile, slow, auth-complex. This was explicitly rejected in PROJECT.md Key Decisions. | Rely on Claude to invoke MCP tools as instructed by UserPromptSubmit injection. The Stop hook only verifies evidence — it doesn't run the models. |
| Per-project hook installation | "I want quorum on this project but not that one" | Per-project install fragments enforcement. Users forget to install it. The plugin is installed once at `user` scope and applies everywhere. Selective enforcement is handled by the command scope config, not by installation location. | Use `qgsd-config.json` with an `enabled: false` field at the project level to opt specific projects out. |
| Fail-closed: block if any model is unavailable | "Strict enforcement — if you can't prove quorum, don't proceed" | Blocks legitimate work when models have quota issues. CLAUDE.md R6 explicitly specifies fail-open behavior. A stop hook that always blocks when one model is absent will frequently deadlock Claude during high-usage periods. | Fail-open with clear attribution: note which model was absent, proceed with the available models. |
| Modifying GSD internals or commands | "Add quorum to the plan-phase workflow directly" | Couples QGSD to GSD version. Every GSD update risks breaking QGSD. GSD users who don't want QGSD would need to opt out of core functionality. | QGSD is additive only. Hooks run independently of GSD command execution. |
| Quorum enforcement on execute-phase | "All commands should require quorum" | execute-phase is EXECUTION, not NON_EXECUTION. CLAUDE.md R2.2 explicitly prohibits running quorum during execution. Enforcing quorum on execute-phase would contradict the policy being enforced. | Configurable scope defaults to planning commands only. Users can add execute-phase if they want, but it shouldn't be the default. |
| Complex UI or TUI for quorum status | "Show me a quorum dashboard with model status" | Hooks run as shell processes with no UI surface. Claude Code already shows hook status via statusMessage and the transcript. Custom UI requires a separate process, a local HTTP server, or a TUI library — all out of scope for a hook-based plugin. | Use `statusMessage` in hook config for spinner text during execution. Use clear `reason` text in block messages. These are the available UX surfaces. |
| Storing quorum history across sessions | "I want to audit all quorum decisions over time" | Requires persistent storage, log rotation, and a query interface. Out of scope for v1. The transcript JSONL already contains all evidence of quorum runs — it's the ground truth. | If audit trail is needed, point users to the transcript path in their Claude session logs. |
| Webhook or notification on quorum failure | "Notify Slack when quorum is skipped" | External integrations add dependencies. Not needed for core enforcement. Claude already knows quorum was blocked because the Stop hook told it via the block reason. | User can add a PostToolUse or async hook on top of QGSD for notifications. Keep QGSD focused on enforcement, not observability. |

---

## Feature Dependencies

```
Infinite-loop prevention (stop_hook_active check)
    └──required by──> Stop hook (transcript evidence check)
                          └──required by──> UserPromptSubmit hook (command detection + injection)
                                                └──required by──> Config file (which commands trigger quorum)

Config file (project-level override)
    └──enhances──> Config file (global defaults)

Session-scoped quorum cache
    └──requires──> Stop hook (needs session_id)
    └──requires──> Temp file (needs write access to /tmp)

last_assistant_message fast path
    └──enhances──> Stop hook (skips JSONL scan when message confirms quorum)

Install validation
    └──enhances──> UserPromptSubmit hook (prevents silent always-block failure mode)

Plugin distribution (hooks.json + .claude-plugin/plugin.json)
    └──requires──> All hook scripts (must use ${CLAUDE_PLUGIN_ROOT} paths)
    └──conflicts──> Manual ~/.claude/settings.json install (choose one distribution method per release)
```

### Dependency Notes

- **Stop hook requires infinite-loop prevention:** Without the `stop_hook_active` check, a blocking Stop hook re-fires after blocking, indefinitely. This is not optional.
- **Stop hook requires command tracking from UserPromptSubmit:** The Stop hook needs to know whether the current response is for a planning command (to decide whether to check quorum). Options: (a) look at the first user message in the transcript to detect the command, (b) have UserPromptSubmit write a session-scoped flag file. Option (b) is simpler and more reliable.
- **last_assistant_message fast path enhances Stop hook:** If Claude's final message contains "quorum complete" or similar, skip the JSONL parse entirely. This is an optimization, not a dependency.
- **Plugin distribution conflicts with direct settings.json install:** Both approaches work, but can't coexist cleanly. Choose plugin distribution for v1 (cleaner, supports `claude plugin install`, allows user-scope hooks).

---

## MVP Definition

### Launch With (v1)

Minimum viable product — what's needed to validate that structural enforcement actually works better than CLAUDE.md behavioral compliance.

- [ ] UserPromptSubmit hook: detect GSD planning commands, inject quorum instructions via `additionalContext` — *the prompt* that tells Claude to run quorum
- [ ] Stop hook: parse `transcript_path` JSONL, detect tool_use evidence for 3 external models, return `{"decision":"block","reason":"[specific missing models] — run them before stopping"}` — *the enforcement gate*
- [ ] Infinite-loop prevention in Stop hook via `stop_hook_active` check — *required or the system deadlocks*
- [ ] Fail-open: require at least 1 of 3 external models, note which are absent — *prevents quota issues from blocking work*
- [ ] Config file at `~/.claude/qgsd-config.json` with `commands` array — *configurable scope*
- [ ] Plugin manifest + `hooks/hooks.json` for distribution via `claude plugin install` — *zero-friction install*

### Add After Validation (v1.x)

Features to add once core enforcement is working and users trust it.

- [ ] Per-project config override at `.planning/qgsd-config.json` — *trigger: users want project-specific behavior*
- [ ] last_assistant_message fast path — *trigger: transcript scanning noticeably slow on long sessions*
- [ ] Session-scoped quorum cache via temp file — *trigger: users report slowdown from repeated transcript scans*
- [ ] Install validation (check MCP registration before activating) — *trigger: first-run failure reports from users with missing MCPs*
- [ ] Dry-run mode — *trigger: users hesitant to activate enforcement without testing first*

### Future Consideration (v2+)

Features to defer until product-market fit is established.

- [ ] Direct CLI invocation from hooks (strict mode) — *defer: auth complexity, external dependencies; only if fail-open is insufficient for some users*
- [ ] Quorum enforcement for execute-phase (opt-in) — *defer: contradicts CLAUDE.md R2.2; only if users explicitly request it for their workflows*
- [ ] Multiple quorum configs (named profiles) — *defer: over-engineering for v1*

---

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority |
|---------|------------|---------------------|----------|
| UserPromptSubmit command detection + injection | HIGH | LOW | P1 |
| Stop hook transcript scan + block decision | HIGH | MEDIUM | P1 |
| Infinite-loop prevention (stop_hook_active) | HIGH | LOW | P1 — required, not optional |
| Fail-open behavior | HIGH | LOW | P1 |
| Config file (command scope) | HIGH | LOW | P1 |
| Clear, specific block message with model attribution | HIGH | LOW | P1 |
| Plugin distribution (hooks.json manifest) | HIGH | MEDIUM | P1 — distribution enables adoption |
| statusMessage during transcript scan | MEDIUM | LOW | P2 |
| Per-project config override | MEDIUM | LOW | P2 |
| last_assistant_message fast path | MEDIUM | LOW | P2 |
| Session-scoped quorum cache | LOW | MEDIUM | P3 |
| Install MCP validation | MEDIUM | MEDIUM | P2 |
| Dry-run mode | MEDIUM | LOW | P2 |

**Priority key:**
- P1: Must have for launch — plugin doesn't enforce quorum without it
- P2: Should have, add when possible — improves reliability and UX
- P3: Nice to have, future consideration

---

## UX Design: What Good Looks Like When Stop Hook Blocks Claude

The block experience is the most user-visible moment. Getting it wrong creates frustration; getting it right makes quorum feel natural.

### Current Claude Code UX constraint (MEDIUM confidence)

Claude Code displays intentional `decision: "block"` Stop hook responses as "Stop hook error:" — even when the hook exits 0 and returns valid JSON. This is a known UX regression tracked in GitHub issue #12667 (confirmed by search results, multiple follow-up issues #17139, #18424, #21504, #22761). The label is misleading. QGSD cannot fix this at the hook level; it's a Claude Code rendering issue.

**Implication:** Until Anthropic fixes the "Stop hook error:" label, the `reason` field text is the primary UX surface. It must be clear enough to compensate for the misleading prefix.

### Block message design principles

1. **Name the specific gap.** Not "quorum incomplete." Say "Codex evidence found. Gemini missing. OpenCode missing."
2. **Tell Claude exactly what to do.** "Call mcp__gemini-cli__gemini and mcp__opencode__opencode with the current planning question before stopping."
3. **Acknowledge partial success.** If 2 of 3 ran, say so. Don't imply total failure.
4. **Be brief.** Claude reads the reason as its next instruction. Verbosity increases token cost.

### Example block reason text

```
Quorum incomplete before stopping. Found: Codex. Missing: Gemini, OpenCode.
Call mcp__gemini-cli__gemini and mcp__opencode__opencode with the planning question, then stop.
```

### Example pass (no block)

When all 3 models are found in the transcript, the Stop hook exits 0 with no JSON output. Claude stops normally. The `statusMessage` "Verifying quorum..." disappears. No visible interruption to the user.

### Example reduced quorum (fail-open)

```
Reduced quorum: Gemini unavailable (no tool call found). Codex and OpenCode confirmed.
Proceeding with 2-of-3 models. Note reduced quorum in planning output.
```

---

## Config Format: Controlling Which Commands Trigger Quorum

Config file: `~/.claude/qgsd-config.json` (global) or `.planning/qgsd-config.json` (project override).

```json
{
  "commands": [
    "/gsd:plan-phase",
    "/gsd:new-project",
    "/gsd:new-milestone",
    "/gsd:discuss-phase",
    "/gsd:verify-work",
    "/gsd:research-phase"
  ],
  "quorum": {
    "required": 1,
    "models": [
      "mcp__codex-cli__review",
      "mcp__gemini-cli__gemini",
      "mcp__opencode__opencode"
    ]
  }
}
```

**Field explanations:**

| Field | Type | Description |
|-------|------|-------------|
| `commands` | string[] | Slash command prefixes that trigger quorum injection and enforcement. Matched as prefix: `/gsd:plan-phase` matches `/gsd:plan-phase 1`, `/gsd:plan-phase --gaps`, etc. |
| `quorum.required` | number | Minimum number of external model tool calls needed to pass. Default: 1 (fail-open). Set to 2 or 3 for stricter enforcement. |
| `quorum.models` | string[] | MCP tool names to look for in transcript as quorum evidence. Default is the 3 QGSD models. Users who add a 4th model can add it here. |

**Design rationale:**

- `"required": 1` is the fail-open default — even if 2 of 3 models are unavailable, quorum passes with 1
- `"required": 2` matches CLAUDE.md R6 "severely reduced quorum" threshold — allows one model to be absent
- `"required": 3` is strict mode — blocks if any model is absent (not recommended for v1)
- The `models` array makes the system extensible: if Anthropic adds a 4th model or users add Claude variants, they can register them here
- Project override at `.planning/qgsd-config.json` uses the same schema; fields present in project config override global; missing fields fall back to global

**Detection in UserPromptSubmit hook:**

The hook reads the `prompt` field from stdin JSON. It checks whether any entry in `commands` is a prefix of the prompt (after trimming whitespace). If matched, inject quorum instructions. If not matched, exit 0 immediately without injecting anything.

```javascript
// Pseudocode
const input = JSON.parse(stdin);
const prompt = input.prompt.trim();
const config = loadConfig(); // reads ~/.claude/qgsd-config.json, merges project override
const triggered = config.commands.some(cmd => prompt.startsWith(cmd));
if (!triggered) process.exit(0);
// ... inject quorum instructions
```

**Detection in Stop hook:**

The Stop hook must also check whether the current conversation involved a planning command. Without this check, it would scan the transcript after every Claude response — expensive and incorrect.

Recommended approach: UserPromptSubmit hook writes a flag file at `/tmp/qgsd-{session_id}-active.json` when it detects a planning command. Stop hook reads this flag. If absent, exit 0 (no enforcement needed).

---

## Competitor Feature Analysis

No direct competitors (novel problem — structural quorum enforcement via hooks). Closest analogues:

| Feature | claude-flow (CLAUDE.md governance) | Manual CLAUDE.md policy (GSD today) | QGSD approach |
|---------|-------------------------------------|--------------------------------------|----------------|
| Quorum triggering | Compile-time CLAUDE.md enforcement | Behavioral: Claude reads and follows | Structural: UserPromptSubmit hook injects at invocation time |
| Quorum verification | 7-phase pipeline with cryptographic proofs | Behavioral: Claude self-reports | Structural: Stop hook reads transcript, verifies tool_use evidence |
| Fail-open | Unknown | R6 policy, behavioral | Explicit fail-open: requires 1 of N models |
| Command scope control | Not documented | R3.1 enumerated list | Config file with prefix matching |
| Install model | Unknown | CLAUDE.md checked in to repo | Global plugin, user scope |
| UX when blocked | Unknown | Claude narrates it | Stop hook `reason` field (constrained by "Stop hook error:" label) |

---

## Sources

- [Claude Code Hooks Reference (official)](https://code.claude.com/docs/en/hooks) — HIGH confidence. Verified: Stop hook input schema, `decision: "block"` format, `stop_hook_active` field, `transcript_path` field, UserPromptSubmit `additionalContext`, `last_assistant_message` field added to Stop inputs.
- [Claude Code Hooks Guide (official)](https://code.claude.com/docs/en/hooks-guide) — HIGH confidence. Verified: `UserPromptSubmit` prompt field, `additionalContext` JSON output format, `stop_hook_active` infinite-loop prevention pattern, hook location scopes.
- [Claude Code Plugins Reference (official)](https://code.claude.com/docs/en/plugins-reference) — HIGH confidence. Verified: plugin manifest schema, `hooks/hooks.json` location, `${CLAUDE_PLUGIN_ROOT}` env var, `user` scope install.
- [GitHub issue #12667 — Stop hook "error" UX label](https://github.com/anthropics/claude-code/issues/12667) — MEDIUM confidence. Confirmed via search results and multiple related issues (#17139, #18424, #21504, #22761). Ongoing UX problem as of 2026-02-20.
- `/Users/jonathanborduas/code/QGSD/.planning/PROJECT.md` — PRIMARY SOURCE. Defines requirements, out-of-scope items, key decisions, and constraints.
- `/Users/jonathanborduas/code/QGSD/.planning/codebase/ARCHITECTURE.md` — PRIMARY SOURCE. GSD architecture and data flow.
- `/Users/jonathanborduas/code/QGSD/.planning/codebase/STACK.md` — PRIMARY SOURCE. Node.js stack, hook patterns.
- `/Users/jonathanborduas/code/QGSD/.planning/codebase/CONCERNS.md` — PRIMARY SOURCE. Hook system risks, silent failure modes.
- [Hooks mastery repo (disler)](https://github.com/disler/claude-code-hooks-mastery) — LOW confidence (WebFetch returned partial content). Used for patterns only, not schema facts.

---

*Feature research for: Claude Code plugin — hook-based multi-model quorum enforcement*
*Researched: 2026-02-20*
