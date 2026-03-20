# Roadmap: nForma v0.40 — Session Intelligence & Friction Reduction

**Created:** 2026-03-19
**Milestone:** v0.40
**Profile:** cli

## Overview

3 phases, 14 requirements. All features are additive extensions to the existing hook/workflow pipeline — no new npm dependencies, no architectural rewrites.

**Phase structure follows the dependency graph from research:**
1. nf-prompt.js batch (cheapest, highest-frequency impact, validates injection mechanism)
2. Workflow modifications (approach gate must precede scope guard; quorum vote grouped here)
3. Scope guard hook (depends on Phase 2's scope contract; highest complexity)

---

## Phase v0.40-01: Context Injection Batch

**Goal:** nForma injects three targeted context blocks into Claude's context window on the first message of each session — eliminating context amnesia (STATE.md summary), enforcing causal reasoning on debug prompts (root cause template), and defaulting Claude to edit-in-place on edit prompts (constraint injection). All three changes land in a single `nf-prompt.js` edit with one install sync operation.

**Requirements covered:** SESSION-01, SESSION-02, SESSION-03, ROOT-01, ROOT-03, CONST-01, CONST-02

**Plans:** 1/1 plans complete

Plans:
- [x] v0.40-01-01-PLAN.md — Add three context injection blocks to nf-prompt.js (session state, root cause template, edit constraint) with unit tests (Complete: 2026-03-19, 15 min, 2 tasks)

**Files to modify:**
- `hooks/nf-prompt.js` — three new injection blocks before `cmdPattern.test(prompt)` gate at line 882
- `hooks/dist/nf-prompt.js` — sync (cp)
- Install: `node bin/install.js --claude --global`

**Success criteria:**
- On session start (first message), Claude's context includes current STATE.md phase/focus/last-activity
- STATE.md is injected exactly once per session (sentinel flag prevents repeat injection)
- On prompts matching debug/fix/investigate, root cause reasoning template is present in additionalContext
- On prompts matching edit/update/change/fix, edit-in-place constraint is present in additionalContext
- Non-matching prompts receive neither template nor constraint
- All injection paths are fail-open: missing STATE.md / read errors → silent skip, no error surfaced
- Stop hook's `<!-- GSD_DECISION -->` quorum gate is still reached on all code-action prompts (no early exits)
- Unit tests: session injection idempotency, pattern match coverage (true positives + false positive rate), fail-open behavior on missing STATE.md

**Research flags:** None — established injection pattern, full implementation template in SUMMARY.md. Skip research-phase.

**Estimated complexity:** LOW (3 × ~15 line additions to a known file)

---

## Phase v0.40-02: Workflow Modifications

**Goal:** nForma adds structural enforcement at the workflow level: (1) quick tasks declare their approach and out-of-scope items before spawning the planner, writing a scope contract that the Phase 3 guard will consume; (2) solve-diagnose adds a quorum vote on root cause diagnosis after hypothesis synthesis, requiring multi-model consensus before proceeding to remediation.

**Requirements covered:** INTENT-01, INTENT-02, INTENT-03, ROOT-02

**Plans:** 2/2 plans complete

Plans:
- [x] v0.40-02-01-PLAN.md — Add approach declaration + scope contract to quick.md (INTENT-01/02/03) (Complete: 2026-03-19, ~4 min, 2 tasks)
- [x] v0.40-02-02-PLAN.md — Add root cause quorum vote to solve-diagnose.md (ROOT-02) (Complete: 2026-03-19, ~5 min, 1 task)

**Files to modify:**
- `core/workflows/quick.md` — new Step 0 (approach declaration + scope contract write) before existing Step 1
- `~/.claude/nf/workflows/quick.md` — sync from core (or via install)
- `commands/nf/solve-diagnose.md` — new Step 0f (root cause quorum vote) after existing Step 0e
- Verify: `diff core/workflows/ ~/.claude/nf/workflows/` post-edit

**Success criteria:**
- `/nf:quick` derives APPROACH block automatically from task description text (non-modal)
- `.claude/scope-contract.json` is written with branch name as key and scope patterns as value
- Planner receives APPROACH block in its task context
- `solve-diagnose` Step 0f dispatches parallel `nf-quorum-slot-worker` Tasks on root cause
- `output_contract` includes `root_cause_verdict` field after quorum completes
- Quorum vote uses existing dispatch pattern from quick.md Step 5.7 (no new infrastructure)
- Workflow sync verified: `core/workflows/quick.md` matches `~/.claude/nf/workflows/quick.md`
- Unit tests: scope contract schema validation, quorum dispatch format, approach derivation coverage

**Research flags:** None — workflow step insertion follows documented pattern. Quorum dispatch reuses nf-quorum-slot-worker YAML. Skip research-phase.

**Estimated complexity:** MEDIUM (two workflow document edits; scope contract JSON schema; quorum step wiring)

**Dependency:** Produces `.claude/scope-contract.json` consumed by Phase v0.40-03

---

## Phase v0.40-03: Scope Guard Hook

**Goal:** A new `nf-scope-guard.js` PreToolUse hook fires on Edit, Write, and MultiEdit calls and emits a warning advisory when the target file is outside the declared scope from `.claude/scope-contract.json`. Warning-only (exits 0) for v0.40 — never blocks. No-op when no scope contract exists.

**Requirements covered:** SCOPE-01, SCOPE-02, SCOPE-03

**Plans:** 1/1 plans complete

Plans:
- [x] v0.40-03-01-PLAN.md — Create nf-scope-guard PreToolUse hook, wire into install.js and config-loader, sync dist, install globally (Complete: 2026-03-19, ~7 min, 2 tasks)

**Files to create/modify:**
- `hooks/nf-scope-guard.js` — new PreToolUse hook, follows `nf-destructive-git-guard.js` pattern
- `hooks/dist/nf-scope-guard.js` — sync (cp)
- `bin/install.js` — add to PreToolUse registration array (with idempotency guard) + uninstall removal filter
- `hooks/config-loader.js` — add to `HOOK_PROFILE_MAP` + `DEFAULT_HOOK_PRIORITIES`
- Install: `node bin/install.js --claude --global`

**Success criteria:**
- Hook fires only on Edit/Write/MultiEdit tool calls (matcher scoped, not every tool)
- When `.claude/scope-contract.json` absent: hook exits immediately, no output, no overhead
- When target file path matches declared scope: hook exits 0, no output
- When target file path is outside declared scope: hook exits 0, emits warning via `additionalContext`
- Warning message names the declared scope and the out-of-scope file clearly
- Repeated installs do not create duplicate hook entries (idempotency guard)
- `--uninstall` removes hook entry cleanly (uninstall removal filter)
- Unit tests: no-contract no-op, in-scope pass, out-of-scope warning content, matcher scope (no Bash/Read/Task firing)

**Research flags:** None — hook registration pattern fully documented. Use PITFALLS.md "Looks Done But Isn't" checklist as mandatory verification gate before closing phase.

**Estimated complexity:** HIGH (new hook file + install.js + config-loader + 4 distinct verification points)

**Dependency:** Requires Phase v0.40-02 to have shipped scope contract writer

---

## Requirement Coverage

| Requirement | Phase | Status |
|-------------|-------|--------|
| SESSION-01 | v0.40-01 | Complete |
| SESSION-03 | v0.40-01 | Complete |
| ROOT-01 | v0.40-01 | Complete |
| ROOT-03 | v0.40-01 | Complete |
| CONST-01 | v0.40-01 | Complete |
| CONST-02 | v0.40-01 | Complete |
| INTENT-01 | v0.40-02 | Complete |
| INTENT-03 | v0.40-02 | Complete |
| ROOT-02 | v0.40-02 | Complete |
| SCOPE-01 | v0.40-03 | Complete | Complete    | 2026-03-19 | v0.40-03 | Complete |
| SCOPE-03 | v0.40-03 | Complete |

**v1 requirements total:** 14
**Covered by phases:** 14
**Gap:** 0 ✓

---

## Key Decisions

| Decision | Rationale |
|----------|-----------|
| 3 nf-prompt.js features batched into Phase 1 | Single file → single install sync → lowest overhead, validates injection mechanism first |
| Phase 2 before Phase 3 | Scope contract (written by quick.md Step 0) must exist before scope guard can be tested meaningfully |
| Scope guard warn-only at v0.40 | False positive risk at v1; promote to block with post-v0.40 data |
| No research-phase for any phase | All patterns established in existing codebase; SUMMARY.md provides full implementation templates |
| Approach declaration is non-modal | Derive from task description text; user dialog is an anti-feature (interrupts flow) |

---
*Roadmap created: 2026-03-19*
*Phase v0.40-01 completed: 2026-03-19*
*Requirements: 14 v1, 4 v2, 4 out of scope*
