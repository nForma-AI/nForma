# Project Research Summary

**Project:** QGSD — Quorum enforcement layer for GSD planning commands
**Domain:** Claude Code hook-based plugin extension
**Researched:** 2026-02-20
**Confidence:** HIGH

## Executive Summary

QGSD is a Claude Code hook-based plugin that enforces structural multi-model quorum for GSD planning commands. Rather than relying on behavioral compliance with CLAUDE.md policy (R3), the plugin uses two hooks — UserPromptSubmit and Stop — to inject quorum instructions at invocation time and verify quorum evidence in the transcript before allowing Claude to deliver planning output. This is a novel problem with no direct competitors: the closest analogues (claude-flow, manual CLAUDE.md governance) either operate at compile time or rely on Claude's willingness to follow policy.

The recommended architecture is zero-coupling to GSD: two standalone hook scripts (`qgsd-prompt.js`, `qgsd-stop.js`) plus a shared config reader and installer, distributed as an npm package in the same pattern as GSD itself. The UserPromptSubmit hook injects quorum instructions via `additionalContext` (discrete, invisible to user) when a guarded planning command is detected. The Stop hook reads the session transcript JSONL and scans for `tool_use` content blocks matching Codex, Gemini, and OpenCode MCP tool prefixes. If quorum evidence is absent, the hook returns `{"decision":"block","reason":"..."}` which re-feeds instructions to Claude. This is a hard gate — Claude cannot deliver output without passing it.

The primary risk is the Stop hook infinite loop when the `stop_hook_active` guard is omitted. A secondary structural risk is installing the UserPromptSubmit hook via the plugin's `hooks/hooks.json` — a confirmed Claude Code bug (#10225, #12151) causes plugin UserPromptSubmit hook output to be silently discarded, making quorum injection invisible to Claude. Both risks are fully preventable with known workarounds and must be addressed in Phase 1 before any integration testing. All other pitfalls (subagent scope bleed, compaction false blocks, broad command patterns) are similarly addressable at the design level if caught early.

## Key Findings

### Recommended Stack

The entire implementation requires only Node.js (>=16.7.0) stdlib — `fs`, `path`, `os`, `readline` — with no external npm dependencies. Python 3.9+ is a valid alternative for hooks needing subprocess calls to external CLIs, but Node.js matches GSD's existing hook runtime and is preferred for consistency. All Claude Code hook I/O is plain JSON over stdin/stdout; transcript files are newline-delimited JSONL parsed line by line with `JSON.parse`. Hooks must be bundled with esbuild into self-contained files (same pattern as GSD's `build-hooks.js`) because there is no `node_modules` at the `~/.claude/hooks/` install target. Distribution follows GSD's npm installer pattern rather than the Claude Code plugin marketplace, avoiding per-project install fragmentation.

**Core technologies:**
- Node.js (>=16.7.0): Hook runtime — already installed for any GSD user; zero additional dependency
- JSON/JSONL (no library): Transcript and hook I/O format — Claude Code's native format; stdlib `JSON.parse` is sufficient
- esbuild (build only): Bundler — required to make `qgsd-config.js` importable by both hooks after install without a `node_modules` directory

### Expected Features

Research confirms a tight MVP scope. The six table-stakes features form a dependency chain; none can be deferred without breaking the enforcement guarantee.

**Must have (table stakes):**
- UserPromptSubmit hook: detect GSD planning commands, inject quorum instructions via `additionalContext` — the trigger without which Claude never knows to run quorum
- Stop hook: parse transcript JSONL, verify tool_use evidence for 3 external MCP models, return `decision: "block"` with specific missing model names — the hard gate
- Infinite-loop prevention via `stop_hook_active` guard — without this the system deadlocks unconditionally
- Fail-open behavior: require at least 1 of 3 external models; note absent models in block reason — required by CLAUDE.md R6
- Config file at `~/.claude/qgsd-config.json` with `commands` array and configurable MCP tool name prefixes — prevents silent failure when users rename MCP servers
- Clear, specific block message naming the exact missing models and exact tool calls to run — the block message is the primary UX surface due to Claude Code's "Stop hook error:" label limitation

**Should have (v1.x after validation):**
- Per-project config override at `.planning/qgsd-config.json`
- `last_assistant_message` fast path to skip JSONL scan when Claude confirmed quorum in its response
- Session-scoped quorum cache via `/tmp/qgsd-{session_id}-quorum.json`
- Install-time MCP registration validation to warn users with missing MCPs before activation
- Dry-run mode for initial rollout without enforcement

**Defer (v2+):**
- Direct CLI invocation from hooks (auth complexity, external dependencies)
- Quorum enforcement for execute-phase (contradicts CLAUDE.md R2.2)
- Named quorum profiles / multiple config sets

### Architecture Approach

QGSD follows a two-hook, zero-coupling architecture. The UserPromptSubmit hook fires before Claude processes the prompt; it pattern-matches the `prompt` field against an explicit allowlist of planning command slugs and injects quorum instructions as `additionalContext`. The Stop hook fires after Claude finishes responding; it checks `stop_hook_active`, scans user messages in the transcript to confirm a planning command was invoked, then scans assistant messages for tool_use blocks with MCP tool name prefixes matching Codex/Gemini/OpenCode. Scope filtering (only enforce when a planning command was detected in this session, only enforce on the main session not subagents) is critical to prevent the hook from interfering with all Claude Code usage and GSD subagent workflows.

**Major components:**
1. `hooks/qgsd-prompt.js` (UserPromptSubmit hook) — command detection and quorum instruction injection; reads config; writes `additionalContext` to stdout
2. `hooks/qgsd-stop.js` (Stop hook) — stop_hook_active guard; subagent scope guard; transcript JSONL scan; quorum evidence verification; block or pass decision
3. `hooks/qgsd-config.js` (shared module, bundled into each hook) — config loading with fail-open defaults; MCP tool name prefix definitions; quorum command allowlist
4. `templates/qgsd-config.json` — default config written on install; user-editable without code changes
5. `bin/install.js` (installer) — copies bundled hooks to `~/.claude/hooks/`; writes hook entries into `~/.claude/settings.json`; writes default config; validates MCP registrations

### Critical Pitfalls

1. **Stop hook infinite loop (missing `stop_hook_active` guard)** — The very first line of the Stop hook must unconditionally check `stop_hook_active === true` and exit 0 if so. This guard must be present in v1; it cannot be added later as a patch without risk of burning API tokens in production.

2. **Plugin hook output silently discarded (confirmed Claude Code bug #10225, #12151)** — Never install the UserPromptSubmit hook via the plugin's `hooks/hooks.json`. Always install to `~/.claude/settings.json` via the installer. This is the only confirmed workaround.

3. **Stop hook fires for every subagent (GSD Task() spawning)** — Check `hook_event_name` in Stop hook input; only enforce when value is `"Stop"` (main session), never `"SubagentStop"`. Without this guard, every GSD subagent gets blocked.

4. **Transcript compaction causes false blocks** — Scope quorum evidence search to the current turn only (scan backward from end of JSONL to previous user message boundary), not the entire session. After compaction, prior tool_use entries are replaced with a summary and would not be found.

5. **Overly broad command pattern allows execution-phase quorum injection** — Use `startsWith` matching against an explicit allowlist (not a regex with `includes`), and explicitly exclude all execution commands. CLAUDE.md R2.2 prohibits quorum during EXECUTION.

## Implications for Roadmap

Based on combined research, a 3-phase structure is recommended. All pitfalls are addressable in Phase 1, which is the right time to establish the invariants that the rest of the system depends on.

### Phase 1: Hook Foundation and Core Enforcement

**Rationale:** All six table-stakes features form a single dependency chain. None can be deferred. The critical pitfalls (infinite loop, plugin bug, subagent scope, compaction) must all be resolved here before any integration testing — each one can render the system non-functional or actively harmful. Phase 1 is the whole core; there is no useful partial state.

**Delivers:** A working quorum enforcement system. UserPromptSubmit injects instructions. Stop hook verifies evidence. Config is user-editable. Fail-open behavior matches CLAUDE.md R6. Block messages are specific and actionable.

**Addresses features:** UserPromptSubmit detection + injection, Stop hook transcript scan + block decision, `stop_hook_active` infinite-loop guard, fail-open logic, `qgsd-config.json` with configurable MCP prefixes, specific block message with model attribution.

**Avoids pitfalls:** Stop hook infinite loop (guard is P1 requirement), plugin hook output bug (installer writes to settings.json), subagent scope bleed (hook_event_name check), compaction false blocks (scoped transcript search), broad command pattern (explicit allowlist).

**Research flag:** STANDARD — all patterns are well-documented in official Claude Code hooks docs, confirmed against live GSD codebase and live transcripts. No research-phase needed.

### Phase 2: Distribution and Install Hardening

**Rationale:** Once the hook logic is correct, distribution packaging and install-time validation make the system adoptable and prevent first-run failure modes. Phase 2 cannot come before Phase 1 because distribution requires the hooks to exist.

**Delivers:** npm installer that writes to `~/.claude/settings.json`, copies bundled hooks, writes default config, and validates MCP registration. esbuild bundling of hooks with config reader. Distribution-ready package following GSD's install model.

**Uses stack:** esbuild (bundling), Node.js `os`/`path`/`fs` (installer I/O), npm package structure matching GSD pattern.

**Implements architecture:** `bin/install.js`, `scripts/build-hooks.js`, `hooks/dist/` output, `templates/qgsd-config.json`, `package.json`.

**Research flag:** STANDARD — GSD's existing installer (`bin/install.js`) is a direct template. No novel patterns.

### Phase 3: UX and Reliability Enhancements

**Rationale:** After core enforcement is validated in production, the v1.x enhancements reduce friction and address performance on long sessions. Per-project config, fast path, session cache, dry-run mode, and install MCP validation all improve reliability without affecting the enforcement guarantee established in Phase 1.

**Delivers:** Per-project config override, `last_assistant_message` fast path, session-scoped quorum cache, dry-run mode, install-time MCP validation with warning output.

**Research flag:** MINIMAL — per-project config layering and temp file session cache are straightforward patterns. The `last_assistant_message` fast path requires verifying the exact field name in the Stop hook payload (confirmed present per official docs).

### Phase Ordering Rationale

- Phase 1 before Phase 2: hooks must be correct before packaging; install a broken hook breaks the user's Claude Code session globally.
- Phase 1 handles all 8 pitfalls: every pitfall in PITFALLS.md maps to Phase 1 in the Pitfall-to-Phase Mapping. Deferring any pitfall mitigation risks a broken v1 in production.
- Phase 3 after Phase 1 validation: reliability enhancements are responsive to real usage patterns (transcript scan latency, session length); building them speculatively before validating the core would be over-engineering.
- No Phase 2 research needed: the GSD codebase is a direct reference implementation for all installer patterns.

### Research Flags

Phases needing deeper research during planning: None. All three phases operate on well-documented Claude Code APIs verified against official docs, and have reference implementations in the existing GSD codebase.

One area requiring ongoing attention during Phase 1 implementation (not a research gap, but an integration test requirement): the `stop_hook_active` behavior on second Stop invocations must be empirically confirmed against the live Claude Code runtime, not just against documentation. The behavior is documented but the interaction with GSD subagent spawning has not been tested end-to-end.

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | All technologies verified against official Claude Code hooks docs and cross-validated against live GSD codebase (hooks, installer, settings.json) |
| Features | HIGH | MVP feature set derived from official docs, confirmed Claude Code bugs documented with issue numbers and reproduction reports |
| Architecture | HIGH | Architecture verified against live QGSD session transcript showing actual tool_use entries; GSD installer is a direct reference for all installer patterns |
| Pitfalls | HIGH | All 6 critical pitfalls confirmed via official docs, GitHub issues with reproduction cases (8+ separate issues cited), and real GSD codebase analysis |

**Overall confidence:** HIGH

### Gaps to Address

- **`stop_hook_active` second-invocation behavior with subagents:** Documentation says it is `true` when Claude continues due to a prior Stop hook block. The interaction between this flag and GSD's Task()-spawned subagents should be empirically tested in Phase 1 integration testing before marking the Stop hook as complete.

- **Claude Code "Stop hook error:" label (GitHub issue #12667):** The misleading UX label on intentional blocks is a known open Claude Code bug. The block message design must compensate for this. If Anthropic ships a fix during development, the messaging strategy may be adjustable. Monitor the issue.

- **Plugin distribution as future option:** The plugin distribution path (`hooks/hooks.json` + `.claude-plugin/plugin.json`) is documented but cannot be used for UserPromptSubmit due to confirmed bugs. If Anthropic fixes the plugin hook output capture bug, plugin distribution becomes viable and cleaner. This is a future option, not a v1 path.

## Sources

### Primary (HIGH confidence)

- `https://code.claude.com/docs/en/hooks` — Official hooks reference. All input/output schemas, `stop_hook_active`, `decision: "block"`, `additionalContext`, `last_assistant_message`, exit code behavior.
- `https://code.claude.com/docs/en/plugins-reference` — Official plugin manifest schema, `hooks/hooks.json` format, `${CLAUDE_PLUGIN_ROOT}`, component directory layout.
- `/Users/jonathanborduas/.claude/hooks/gsd-guardian.py` — Live UserPromptSubmit hook. Stdin parsing, prompt regex, subprocess pattern.
- `/Users/jonathanborduas/.claude/hooks/gsd-statusline.js` — Live StatusLine hook. Stdin schema fields.
- `/Users/jonathanborduas/.claude/settings.json` — Live settings. Three-level hook nesting structure confirmed.
- `/Users/jonathanborduas/code/QGSD/bin/install.js` — GSD installer. Direct reference for settings.json merge, hook path construction, package structure.
- Live QGSD session transcript (`~/.claude/projects/.../8053c02f...jsonl`) — Verified actual tool_use entry structure in production transcripts.
- `/Users/jonathanborduas/code/QGSD/.planning/PROJECT.md` — Authoritative project scope, key decisions, out-of-scope items.

### Secondary (MEDIUM confidence)

- GitHub issue #12667 and duplicates (#17139, #18424, #21504, #22761) — "Stop hook error:" UX label; confirmed ongoing as of 2026-02-20
- GitHub issue #10225 / #12151 — Plugin UserPromptSubmit hook output not captured; 22 confirmed reproductions
- Egghead community tutorial on subagent hook inheritance — confirms Stop hook fires for SubagentStop events

### Tertiary (LOW confidence)

- Hooks mastery repo (disler/claude-code-hooks-mastery) — patterns only; WebFetch returned partial content; not used for schema facts

---
*Research completed: 2026-02-20*
*Ready for roadmap: yes*
