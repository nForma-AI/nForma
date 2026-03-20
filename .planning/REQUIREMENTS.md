# Requirements: nForma v0.40 — Session Intelligence & Friction Reduction

**Defined:** 2026-03-19
**Core Value:** nForma prevents friction at the hook/workflow level so Claude never needs to be corrected twice for the same pattern

## v1 Requirements

### Session State

- [x] **SESSION-01**: On the first user message of a new Claude Code session, nForma injects the current STATE.md summary (phase, focus, last activity) into Claude's context window via `additionalContext`
- [x] **SESSION-02**: Session state injection fires exactly once per session (idempotent) — subsequent messages in the same session do not re-inject STATE.md content
- [x] **SESSION-03**: Session state injection is fail-open — if STATE.md is missing or unreadable, injection is silently skipped and no error is surfaced to the user

### Intent Declaration

- [ ] **INTENT-01**: When a quick task is triggered (`/nf:quick`), the workflow derives an APPROACH block (what will be done, what is explicitly out of scope) from the task description before spawning the planner
- [ ] **INTENT-02**: The APPROACH block is written to `.claude/scope-contract.json` with the task branch name as the key, making it available to the scope guard
- [ ] **INTENT-03**: The APPROACH block is non-modal — it is derived automatically from the task description text, not via a user dialog or confirmation step

### Root Cause Enforcement

- [x] **ROOT-01**: When Claude receives a prompt containing a debug/fix/investigate pattern, nForma injects a root-cause reasoning template into `additionalContext` prompting structured causal analysis before proposing a fix
- [ ] **ROOT-02**: In `solve-diagnose`, after the existing Step 0e hypothesis synthesis, a quorum vote is dispatched on the root cause diagnosis before proceeding — requiring multi-model consensus on the causal chain
- [x] **ROOT-03**: Root cause template injection is fail-open and pattern-matched — non-debug/fix prompts do not receive the template injection

### Constraint Injection

- [x] **CONST-01**: When Claude receives a prompt that appears to involve editing existing code or files, nForma injects an edit-in-place constraint into `additionalContext` — defaulting Claude to editing existing files rather than creating new ones
- [x] **CONST-02**: Constraint injection is fail-open and pattern-matched — prompts that are clearly new-feature requests (not edits) do not receive the constraint injection

### Scope Guard

- [ ] **SCOPE-01**: A new `nf-scope-guard.js` PreToolUse hook fires on Edit, Write, and MultiEdit tool calls and checks whether the target file is within the declared scope from `.claude/scope-contract.json`
- [ ] **SCOPE-02**: When a file edit targets a path outside the declared scope, the scope guard emits a warning advisory via `additionalContext` (non-blocking, exits 0) — it does not deny the tool call
- [ ] **SCOPE-03**: The scope guard is a no-op when no scope contract exists for the current session — the hook exits immediately without any output or overhead

## v2 Requirements

### Escalation

- **ESC-01**: Scope guard warning escalates to a blocking deny when the same out-of-scope file is targeted 3+ times in the same session (data-driven threshold, post-v0.40)
- **ESC-02**: Per-turn STATE.md re-injection on context compaction events (requires Claude Code compaction hook API, not yet available)

### Quorum Coverage

- **QRUM-01**: Root cause quorum vote gates on complexity classification (COMPLEX only) — simple prompts skip the quorum dispatch
- **QRUM-02**: Quorum vote on every new debug session (not just solve-diagnose) — requires quorum scoring infrastructure first

## Out of Scope

| Feature | Reason |
|---------|--------|
| Hard-blocking scope guard | False positive risk at v1; warn-only first, promote with data post-v0.40 |
| User dialog for approach declaration | Anti-feature; INTENT-03 explicitly requires non-modal derivation |
| Per-turn STATE.md injection | Context budget erosion; first-message injection satisfies the use case |
| New npm dependencies | No new packages — pure extension of existing Node.js/CJS hook runtime |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| SESSION-01 | Phase v0.40-01 | Complete |
| SESSION-02 | Phase v0.40-01 | Complete |
| SESSION-03 | Phase v0.40-01 | Complete |
| ROOT-01 | Phase v0.40-01 | Complete |
| ROOT-03 | Phase v0.40-01 | Complete |
| CONST-01 | Phase v0.40-01 | Complete |
| CONST-02 | Phase v0.40-01 | Complete |
| INTENT-01 | Phase v0.40-02 | Pending |
| INTENT-02 | Phase v0.40-02 | Pending |
| INTENT-03 | Phase v0.40-02 | Pending |
| ROOT-02 | Phase v0.40-02 | Pending |
| SCOPE-01 | Phase v0.40-03 | Pending |
| SCOPE-02 | Phase v0.40-03 | Pending |
| SCOPE-03 | Phase v0.40-03 | Pending |

**Coverage:**
- v1 requirements: 14 total
- Mapped to phases: 14
- Unmapped: 0 ✓

---
*Requirements defined: 2026-03-19*
*Last updated: 2026-03-19 after v0.40-01 completion*
