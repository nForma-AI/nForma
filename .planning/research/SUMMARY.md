# Project Research Summary

**Project:** nForma v0.40 — Session Intelligence & Friction Reduction
**Domain:** Behavioral enforcement hooks for Claude Code plugin (additive extension to existing hook/workflow pipeline)
**Researched:** 2026-03-19
**Confidence:** HIGH

## Executive Summary

nForma v0.40 extends an already-functioning Claude Code plugin by adding 6 friction-reduction features across two layers: context injection (UserPromptSubmit hook) and structural enforcement (new PreToolUse hook + workflow step insertions). All research was conducted by direct codebase inspection — there are no new npm dependencies, no architectural rewrites, and no net-new deployment infrastructure. Every feature is additive: three features extend `nf-prompt.js` with new injection blocks, one feature adds a step to `quick.md`, one adds a step to `solve-diagnose.md`, and one creates a new `nf-scope-guard.js` hook. The recommended build order groups the three `nf-prompt.js` changes into a single batch, then handles the workflow changes, then creates the new hook.

The central design constraint across all 6 features is fail-open behavior: no feature should block Claude from responding, and every detection path (regex match, file read, flag check) must silently skip injection on error. The secondary constraint is injection hygiene — each new context block must be additive to the existing `instructions` string, not a replacement, so the Stop hook's `<!-- GSD_DECISION -->` quorum gate remains intact. Three features are purely low-complexity additions (~10-30 lines each in `nf-prompt.js`); the two workflow modifications are medium complexity; the scope guard hook is highest complexity because it introduces a new hook file plus install.js registration, uninstall path, config-loader profile map update, and a data dependency on the approach gate's scope contract file.

The primary risks are not technical — the patterns are fully established in the existing codebase. The risks are procedural: forgetting the `hooks/dist/` sync before running install, allowing a pattern-match branch in `nf-prompt.js` to exit before quorum instructions fire, and omitting the idempotency guard for the session state injection. All four critical pitfalls identified in research have explicit prevention steps and can be caught by unit tests before shipping.

---

## Key Findings

### Recommended Stack

No new technologies are introduced. All 6 features use the existing Node.js CommonJS runtime, the `fs` and `path` stdlib modules already required in every hook, and the existing `config-loader.js` / `shouldRunHook()` pattern. This is a pure extension project — the stack is the current stack.

The one structural addition is `.claude/scope-contract.json`, a lightweight JSON file written by `quick.md` Step 0 and read by `nf-scope-guard.js`. This file lives in `.claude/` (already gitignored) and requires no persistence beyond the active task session.

**Core technologies:**
- `Node.js CJS (18+)`: hook runtime — all hooks are `.js` CJS modules; no transpilation needed
- `fs` / `path` (stdlib): STATE.md reads, sentinel flag files, scope contract I/O — already required in every hook
- `config-loader.js` (internal): `shouldRunHook()` profile guard + `DEFAULT_HOOK_PRIORITIES` — required for every new hook registration
- `bin/install.js` (internal): hook registration/uninstall pattern — must be modified for Feature 6 only

### Expected Features

All 6 features are required for v0.40. Research confirms the dependency-driven build order and identifies three P1 (low-cost, high-frequency-impact) and two P2 (medium complexity, structural enforcement) features.

**Must have (table stakes):**
- Session state injection — eliminates context amnesia on every new session; lowest complexity, highest frequency impact
- Root cause template injection — structural enforcement of causal reasoning on debug/fix prompts; feeds the quorum vote feature
- Constraint injection for edit prompts — eliminates file proliferation; prevents new-file-creation default on edit requests
- Approach declaration gate in `quick.md` — prevents scope-too-broad planning; medium complexity; required for scope guard to function

**Should have (competitive differentiators):**
- Root cause quorum vote in `solve-diagnose.md` — extends quorum enforcement identity to the diagnosis layer; no other AI coding plugin enforces multi-model consensus at the diagnosis stage
- Branch scope guard hook (`nf-scope-guard.js`) — structural (hook) vs behavioral (CLAUDE.md) enforcement of edit scope; warning-only for v0.40

**Defer (v2+):**
- Per-turn STATE.md injection — context budget erosion; first-message injection satisfies the use case
- Hard-blocking scope guard — false positive risk; warning-first, promote to block with data post-v0.40
- Quorum vote on every debug session — complexity filter needed first; gate on COMPLEX classification only

### Architecture Approach

The 6 features map cleanly onto three existing architectural patterns already in the codebase: (1) `additionalContext` injection via `nf-prompt.js` priority chain for Features 1, 3, and 5; (2) workflow step insertion in `.md` workflow documents for Features 2 and 4; (3) PreToolUse guard hook creation following `nf-destructive-git-guard.js` for Feature 6. There are no circular dependencies. Features 2 and 6 are linked (approach gate writes the scope contract that the scope guard reads), but the link is explicitly fail-open — the scope guard is a no-op when no contract exists.

**Major components:**
1. `hooks/nf-prompt.js` (UserPromptSubmit) — inject state, root-cause template, and edit constraint into `additionalContext` before Claude processes any user message; priority chain extended with P2.5, P2.7, P2.8 blocks
2. `core/workflows/quick.md` — approach declaration Step 0 added before existing Step 1; writes `.claude/scope-contract.json`; planner receives APPROACH block as context
3. `commands/nf/solve-diagnose.md` — Step 0f root cause quorum vote inserted after Step 0e; uses existing `nf-quorum-slot-worker` Task dispatch pattern; adds `root_cause_verdict` to `output_contract`
4. `hooks/nf-scope-guard.js` (new PreToolUse) — fires on Edit/Write/MultiEdit only; reads `.claude/scope-contract.json` for current branch; emits advisory warning (non-blocking) when file is outside declared scope; always exits 0

### Critical Pitfalls

1. **Session injection fires on every message, not just the first** — use a session-scoped sentinel file (`.claude/session-<sessionId>-state-injected.flag`) checked atomically before injecting, following the `consumePendingTask` idempotency model already in `nf-prompt.js` lines 82-110. Without this, every follow-up message receives the STATE.md preamble.

2. **Pattern-match injection branch bypasses quorum dispatch, breaking the Stop hook** — new detection blocks must mutate the `instructions` string that the quorum block is already assembling, not issue a separate `process.stdout.write` + exit. Any branch that writes stdout and exits before line 882 (`cmdPattern.test(prompt)`) will suppress `<!-- GSD_DECISION -->` from the output, causing the Stop hook to block all responses containing "fix" or "debug".

3. **PreToolUse scope guard fires on every tool call without a matcher** — register the hook with a `matcher` field scoping it to Edit/Write/MultiEdit; also add the inside-hook `tool_name` early-exit check as defense-in-depth. Omitting the matcher taxes every Bash, Read, and Task call at 1-10ms each.

4. **install.js idempotency guard missing for new hook** — every hook registration must include a `hasScopeGuardHook` check before pushing to the PreToolUse array, and a corresponding removal filter in the uninstall block. Without both, duplicate entries accumulate on repeated installs and `--uninstall` leaves orphan entries.

5. **hooks/dist/ sync forgotten after hook edits** — the installer reads from `hooks/dist/`, not `hooks/`. Any plan that modifies a hook file must include an explicit `cp hooks/<name>.js hooks/dist/<name>.js && node bin/install.js --claude --global` task. Skipping this causes the repo and the running system to diverge silently.

---

## Implications for Roadmap

Based on research, the dependency graph and complexity profile suggest a 3-phase structure with a clear batching rationale:

### Phase 1: nf-prompt.js Batch (Features 1, 3, 5)

**Rationale:** All three features modify only `nf-prompt.js` and are mutually independent. Batching them minimizes install sync operations (one `cp` + one `node bin/install.js` covers all three). They are also the lowest-complexity features and establish the injection pattern that Phase 2 builds on.
**Delivers:** Session state injection (no more context amnesia), root cause template injection (structured causal reasoning on debug/fix prompts), edit constraint injection (edit-in-place default)
**Addresses:** P1 table-stakes features from FEATURES.md (3 of 4 P1 features)
**Avoids:** Pitfall 2 (pattern injection bypassing quorum) — design constraint is clear; must be verified by unit test before phase closes. Pitfall 1 (session injection every-message noise) — sentinel file guard is the implementation template.

### Phase 2: Workflow Modifications (Features 2, 4)

**Rationale:** Both features modify workflow `.md` files only (no hook changes). Feature 2 (`quick.md` approach gate) must precede Phase 3 because the scope guard depends on the scope contract file written by the approach gate. Feature 4 (`solve-diagnose.md` quorum vote) is independent but logically grouped here as the second workflow change.
**Delivers:** Approach declaration gate (scope commitment before planner spawns), root cause quorum vote (diagnosis-layer quorum enforcement)
**Uses:** Existing `nf-quorum-slot-worker` Task dispatch pattern from `quick.md` Step 5.7 — no new dispatch infrastructure
**Implements:** Workflow Step Insertion pattern (Architecture Pattern 2)
**Avoids:** Pitfall 3 (workflow sync hazard) — plan must include `diff core/workflows/ ~/.claude/nf/workflows/` verification step and explicit install sync task

### Phase 3: Scope Guard Hook (Feature 6)

**Rationale:** Highest complexity feature; requires Phase 2 to have shipped (scope contract written by approach gate). New hook file creation touches the most files: `hooks/nf-scope-guard.js`, `hooks/dist/nf-scope-guard.js`, `bin/install.js` (install + uninstall paths), and `hooks/config-loader.js` (profile map + priorities).
**Delivers:** Branch scope guard (warning-only advisory when edits target files outside declared scope)
**Implements:** PreToolUse Guard Hook pattern (Architecture Pattern 3)
**Avoids:** Pitfalls 3, 4, and 5 (all three apply to new hook creation — matcher field, idempotency guard, dist/ sync). The "Looks Done But Isn't" checklist from PITFALLS.md is the verification gate for this phase.

### Phase Ordering Rationale

- Features 1, 3, 5 are grouped because they share a single file, have no inter-dependencies, and are the cheapest. Shipping them first validates the `additionalContext` injection mechanism before more complex features build on it.
- Feature 2 must precede Feature 6 because Feature 6 reads the scope contract that Feature 2 writes. The guard is designed as a no-op without the contract, but meaningful test coverage requires the contract to exist.
- Feature 4 is grouped with Feature 2 because both are workflow document edits with no hook involvement. They can be delivered in a single change.
- Feature 6 is isolated as Phase 3 because it is the only feature that introduces a new hook file and requires install.js modifications with both install and uninstall paths.

### Research Flags

Phases with standard patterns (skip research-phase):
- **Phase 1 (nf-prompt.js batch):** Established injection pattern fully documented in STACK.md and ARCHITECTURE.md. Implementation is additive string manipulation in a known file. No research needed.
- **Phase 2 (workflow modifications):** Step insertion into existing workflow documents follows documented pattern. Quorum dispatch reuses existing `nf-quorum-slot-worker` YAML format. No research needed.
- **Phase 3 (scope guard hook):** Hook registration pattern is fully documented. No research needed, but the implementation checklist is long — use PITFALLS.md "Looks Done But Isn't" as the mandatory verification gate before marking the phase complete.

---

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | All findings from direct codebase inspection; zero new dependencies; no version ambiguity |
| Features | HIGH | 6 features confirmed from `.planning/PROJECT.md` v0.40 goals; priority and dependency analysis corroborated by Martin Fowler context engineering + official Claude Code hook docs |
| Architecture | HIGH | Direct inspection of all hook files, install.js, workflow files; all patterns confirmed from existing working code |
| Pitfalls | HIGH | Derived entirely from source code inspection; each pitfall traces to specific line numbers in existing files |

**Overall confidence:** HIGH

### Gaps to Address

- **Root cause quorum vote gate condition:** Research recommends gating the Step 0f quorum vote on complexity signals (empty debt + no hypothesis violations = skip). The exact threshold for what constitutes "enough evidence to require a vote" is not formally defined. During implementation, establish a concrete binary skip condition and document it in the step prose.
- **Scope contract pattern matching precision:** The scope guard compares file paths against `scope_patterns` using prefix matching (does the target path start with any pattern?). During implementation, confirm whether prefix matching is sufficient or whether the approach gate step needs to produce more precise patterns for tasks that touch files in multiple directories.
- **Session injection + nf-session-start.js coordination:** `nf-session-start.js` already injects STATE.md reminders via SessionStart. Feature 1 adds a competing first-message injection via UserPromptSubmit. During Phase 1 implementation, audit `nf-session-start.js` STATE.md injection behavior and determine whether Feature 1 should cover a different subset of STATE.md content to avoid redundancy.

---

## Sources

### Primary (HIGH confidence)
- `/Users/jonathanborduas/code/QGSD/hooks/nf-prompt.js` — injection priority chain, additionalContext mechanism, cmdPattern guard, session_id usage, consumePendingTask idempotency model
- `/Users/jonathanborduas/code/QGSD/hooks/nf-circuit-breaker.js` — PreToolUse input schema, permissionDecision deny pattern, READ_ONLY_REGEX anchored pattern
- `/Users/jonathanborduas/code/QGSD/hooks/nf-destructive-git-guard.js` — Edit/Write tool_name filtering, warn-only output pattern, additionalContext in PreToolUse
- `/Users/jonathanborduas/code/QGSD/hooks/nf-session-start.js` — SessionStart injection pattern, parseStateForReminder() function
- `/Users/jonathanborduas/code/QGSD/hooks/config-loader.js` — HOOK_PROFILE_MAP, DEFAULT_HOOK_PRIORITIES, shouldRunHook, matcher usage
- `/Users/jonathanborduas/code/QGSD/bin/install.js` (lines 2298-2448) — hook registration/uninstall pattern, idempotency guards, matcher in SubagentStop/SubagentStart
- `/Users/jonathanborduas/code/QGSD/core/workflows/quick.md` — workflow step structure, Step 5.7 quorum dispatch pattern
- `/Users/jonathanborduas/code/QGSD/commands/nf/solve-diagnose.md` — Step 0 block structure, output_contract format
- [Claude Code Hooks Reference](https://code.claude.com/docs/en/hooks) — official hook API (hookSpecificOutput, additionalContext, permissionDecision)

### Secondary (MEDIUM confidence)
- [Context Engineering for Coding Agents — Martin Fowler](https://martinfowler.com/articles/exploring-gen-ai/context-engineering-coding-agents.html) — session injection principles, approach declaration rationale
- [My LLM coding workflow going into 2026 — Addy Osmani](https://addyosmani.com/blog/ai-coding-workflow/) — context amnesia as #1 friction; inject gradually not every turn
- [Building Guardrails for AI Coding Assistants: Claude Code PreToolUse](https://dev.to/mikelane/building-guardrails-for-ai-coding-assistants-a-pretooluse-hook-system-for-claude-code-ilj) — community PreToolUse patterns
- [Guardrails and Best Practices for Agentic Orchestration — Camunda](https://camunda.com/blog/2026/01/guardrails-and-best-practices-for-agentic-orchestration/) — fail-open enforcement design

### Tertiary (LOW confidence)
- [Claude-mem: AI Plugin for Claude Code Session Memory](https://aitoolly.com/ai-news/article/2026-03-17-claude-mem-a-new-plugin-for-automated-coding-session-memory-and-context-injection-via-claude-code) — corroborates session injection pattern; single source, unverified

---
*Research completed: 2026-03-19*
*Ready for roadmap: yes*
