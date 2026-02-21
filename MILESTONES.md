# MILESTONES

Archive of completed milestones. Each entry records what shipped, the phases that delivered it, all requirements satisfied, and the key decisions that carry forward.

---

## v0.2 — Anti-Oscillation Pattern

**Released:** 2026-02-21
**npm:** `qgsd@0.2.0`
**Tag:** `v0.2.0`

### What Shipped

v0.2 moves R5 (Circuit Breaker) from CLAUDE.md behavioral policy into structural Claude Code hooks. A new PreToolUse hook (`qgsd-circuit-breaker.js`) detects oscillation in git history (strict set equality across a configurable commit window), persists breaker state to `.claude/circuit-breaker-state.json`, and blocks non-read-only Bash execution when the breaker is active. The block reason renders the oscillating file set and a commit graph table, then invokes Oscillation Resolution Mode per R5.

Alongside the circuit breaker, v0.2 ships the QGSD rebranding (all commands use `/qgsd:` prefix), quorum agent scoring (TP/TN/FP/FN schema with a live scoreboard), the `/qgsd:quorum-test` pre-flight validation command, the `/qgsd:debug` auto-proceed flow, and the `checkpoint:verify` pipeline in `/qgsd:execute-phase`. R3.6 (Iterative Improvement Protocol) was added to CLAUDE.md. The User Guide was updated with the checkpoint:verify pipeline diagram.

Three integration bugs discovered during v0.3 gap closure were fixed before publish: INST-08 (uninstall dead hook), RECV-01 (--reset-breaker path resolution), and INST-10 (installer sub-key backfill).

### Phases Delivered

| Phase | Name | Plans |
|-------|------|-------|
| 5 | Fix GUARD 5 Delivery Gaps | 1 |
| 6 | Circuit Breaker Detection & State | 1 |
| 7 | Enforcement & Config Integration | 2 |
| 8 | Installer Integration | 1 |
| 9 | Verify Phases 5–6 (gap closure) | 3 |
| 10 | Fix Bugs + Verify Phases 7–8 (gap closure) | 4 |
| Quick tasks 1–12 | QGSD rebranding, scoring, quorum-test, debug, checkpoint:verify, R3.6, User Guide, /qgsd: prefix | 12 |

### Requirements Satisfied (20 v0.2 requirements)

**Detection (DETECT)**
- DETECT-01: PreToolUse hook intercepts Bash tool calls and checks for active circuit breaker before running detection
- DETECT-02: Hook retrieves last N commits' changed files via `git log --name-only` (N = commit_window config)
- DETECT-03: Oscillation detected when exact same file set (strict set equality) appears in ≥ oscillation_depth of last commit_window commits
- DETECT-04: Read-only Bash commands (git log, git diff, grep, cat, ls, head, tail, find) pass through without detection or blocking
- DETECT-05: Detection skipped (returns pass) when no git repository exists in working directory

**State Management (STATE)**
- STATE-01: Circuit breaker state persisted in `.claude/circuit-breaker-state.json` (relative to project root)
- STATE-02: State schema: `{ active, file_set[], activated_at, commit_window_snapshot[] }`
- STATE-03: Hook reads existing state first — if active, applies enforcement immediately without re-running git log
- STATE-04: State file created silently if absent; write failure logs to stderr but never blocks execution

**Enforcement (ENFC)**
- ENFC-01: Active circuit breaker returns `hookSpecificOutput.permissionDecision:'deny'` blocking Bash execution
- ENFC-02: Block reason names the oscillating file set, confirms circuit breaker is active, lists allowed operations
- ENFC-03: Block reason renders commit graph table and invokes Oscillation Resolution Mode per R5 (CLAUDE.md)

**Config Extensions (CONF)**
- CONF-06: `circuit_breaker.oscillation_depth` added to qgsd.json schema (integer, default: 3)
- CONF-07: `circuit_breaker.commit_window` added to qgsd.json schema (integer, default: 6)
- CONF-08: Circuit breaker config values validated on load; invalid values fall back to defaults with stderr warning
- CONF-09: Two-layer config merge (global + project) applies to `circuit_breaker` settings

**Installer Extensions (INST)**
- INST-08: Installer registers PreToolUse circuit breaker hook in `~/.claude/settings.json`
- INST-09: Installer writes default `circuit_breaker` config block to qgsd.json on first install
- INST-10: Reinstall adds missing `circuit_breaker` config block without overwriting user-modified values

**Recovery (RECV)**
- RECV-01: `npx qgsd --reset-breaker` clears `.claude/circuit-breaker-state.json` (resolved via git rev-parse)

**Oscillation Resolution Mode (ORES) — Phase 13**
- ORES-01: When oscillation detected on internal code files, Claude enters oscillation resolution mode (not hard-stop)
- ORES-02: Resolution mode presents oscillation evidence to all quorum models with structural-coupling framing
- ORES-03: Quorum deliberates (R3.3, up to 4 rounds); only unified solutions approved
- ORES-04: On consensus, Claude presents the unified solution plan to the user for approval before execution
- ORES-05: If no consensus after 4 rounds, Claude hard-stops and escalates to the human

### Key Decisions Carried Forward

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| hookSpecificOutput deny format | `{ hookSpecificOutput: { hookEventName: 'PreToolUse', permissionDecision: 'deny', permissionDecisionReason } }` — `{ "decision": "block" }` silently allows the command | Phase 7 — enforced in circuit breaker |
| loadConfig(gitRoot) after active-state branch | Config only needed for detection; when already blocked, config cost is unnecessary | Phase 7 — implemented |
| Read-only commands pass during active block | Diagnostic ops (git log, grep, cat) must remain available for root cause analysis workflow | Phase 7 — enforced |
| --reset-breaker uses git rev-parse | git rev-parse --show-toplevel with process.cwd() fallback — consistent with how qgsd-circuit-breaker.js resolves gitRoot | Phase 10 — bug fix RECV-01 |
| INST-10 sub-key backfill uses === undefined | Not falsy — preserves user-set values including 0; validateConfig() handles runtime validation | Phase 10 — bug fix |
| Circuit breaker is Claude Code-only in v0.2 | PreToolUse registration inside !isOpencode guard; timeout:10 (lighter than Stop hook's 30) | Phase 8 |
| ORES replaces hard-stop | Environmental file oscillations still escalate to human directly; code-only oscillations enter quorum resolution | Phase 13 |
