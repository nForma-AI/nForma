# Architecture Research: v0.26 Operational Completeness

**Project:** QGSD — Quorum Gets Shit Done
**Researched:** 2026-03-03
**Confidence:** HIGH (existing architecture documented in codebase, v0.26 features are architectural extensions, not fundamental shifts)

## Executive Summary

v0.26 adds 6 operational features to QGSD's existing hook-based quorum architecture. These are not breaking changes—they enhance existing subsystems:

1. **Policy Configuration (PLCY-01..03)** — Extends .formal/policy.yaml with per-slot settings
2. **Credential Management (CRED-01..02)** — Introduces keyring abstraction for API key storage
3. **Portable Installer (PORT-01..03)** — Enables export/import of roster config across machines
4. **Dashboard & Observability (DASH-01..03)** — Live blessed TUI for quorum status
5. **Architecture Enforcement (ARCH-10)** — CI linter prevents SDK bundling
6. **Cross-Model Decomposition (DECOMP-05)** — Parallelizes TLA+ model checking

All integrate with existing layers without breaking backward compatibility.

---

## Current Architecture Overview

QGSD is a hook-based enforcement layer (3 hooks + config loader) overlaid on GSD, orchestrating multi-model quorum dispatch:

```
┌─────────────────────────────────────────────────────────────────────────┐
│                            User Interface Layer                         │
│  ┌──────────────────┐  ┌─────────────────────┐  ┌──────────────────┐   │
│  │  GSD Workflows   │  │  CLI Tools          │  │  Interactive TUI  │   │
│  │  (/gsd:, /qgsd)  │  │  (gsd-tools, agents)   (mcp-setup, agents) │   │
│  └────────┬─────────┘  └─────────┬───────────┘  └────────┬──────────┘   │
├───────────┼──────────────────────┼───────────────────────┼──────────────┤
│                         Hook Layer (Structural Enforcement)             │
│  ┌──────────────────────┐  ┌────────────────────┐  ┌──────────────┐    │
│  │ UserPromptSubmit     │  │ Stop Hook          │  │ PreToolUse   │    │
│  │ (quorum inject)      │  │ (gate + evidence)  │  │ (oscillation) │    │
│  └──────────┬───────────┘  └─────────┬──────────┘  └──────┬───────┘    │
│             │                        │                    │             │
│  ┌──────────v────────────────────────v────────────────────v───────┐    │
│  │  Config Loader (two-layer: ~/.claude/qgsd.json + project)      │    │
│  │  - quorum_active (enabled slots)   - circuit_breaker settings   │    │
│  │  - agent_config metadata           - context_monitor thresholds │    │
│  └─────────────────────────────────────────────────────────────────┘    │
├─────────────────────────────────────────────────────────────────────────┤
│                        Quorum Dispatch Layer                            │
│  ┌──────────────────────────────────┐  ┌──────────────────────────┐    │
│  │   call-quorum-slot.cjs           │  │  Scoreboard (JSONL)      │    │
│  │  - retry-with-backoff           │  │  - Per-slot telemetry    │    │
│  │  - provider health probe        │  │  - Success rates, latency │    │
│  │  - availability windowing       │  │  - Flakiness scoring     │    │
│  │  - slot health pre-filtering    │  │  - PRISM calibration     │    │
│  └──────────┬───────────────────────┘  └──────────────────────────┘    │
│             │                                                            │
│  ┌──────────v──────────────────────────────────────────────────────┐    │
│  │  Provider Registry (providers.json)                             │    │
│  │  - 11 slots (codex-1/2, gemini-1/2, opencode-1, copilot-1,     │    │
│  │    claude-1..6)                                                 │    │
│  │  - Provider mapping (AkashML, Together.xyz, Fireworks)         │    │
│  │  - Timeout, model_detect, health_check_args per slot           │    │
│  └─────────────────────────────────────────────────────────────────┘    │
├─────────────────────────────────────────────────────────────────────────┤
│                    Formal Verification Layer                            │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐                   │
│  │  TLA+ (22)   │  │  Alloy (11)  │  │  PRISM (6)   │                   │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘                   │
│         │                 │                 │                           │
│  ┌──────v─────────────────v─────────────────v──────────────────────┐    │
│  │  Model Registry + Requirement Traceability (v0.25)              │    │
│  │  - @requirement annotations on all specs                        │    │
│  │  - Decomposition risk analysis                                  │    │
│  │  - Requirement ↔ Model cross-references                         │    │
│  └─────────────────────────────────────────────────────────────────┘    │
├─────────────────────────────────────────────────────────────────────────┤
│                     State & Configuration                               │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐                   │
│  │ .planning/   │  │ .formal/     │  │ Activity     │                   │
│  │ - ROADMAP    │  │ - requirements │  │ Sidecar      │                   │
│  │ - STATE      │  │ - check-results │  │ (current     │                   │
│  │ - plans/     │  │ - policy.yaml   │  │  -activity)  │                   │
│  └──────────────┘  └──────────────┘  └──────────────┘                   │
└─────────────────────────────────────────────────────────────────────────┘
```

### Core Components (Pre-v0.26)

| Component | Role | Integration |
|-----------|------|-------------|
| **bin/install.js** | Cross-platform installer (npm, global, local) | Writes to ~/.claude/{hooks,settings.json} |
| **hooks/qgsd-prompt.js** | UserPromptSubmit: injects quorum instructions | Reads config-loader.js (quorum_active slots) |
| **hooks/qgsd-stop.js** | Stop gate: blocks if no quorum evidence | Parses transcript JSONL for tool evidence |
| **hooks/qgsd-circuit-breaker.js** | PreToolUse: detects oscillation patterns | Reads git history, calls Haiku review |
| **hooks/config-loader.js** | Two-layer config merge | Shared by all hooks |
| **bin/manage-agents-core.cjs** | File I/O for ~/.claude.json, providers.json | Pure functions (no interactivity) |
| **bin/call-quorum-slot.cjs** | Single-slot dispatch wrapper | Retry, health probes, availability filtering |
| **bin/run-prism.cjs** | PRISM execution + scoreboard calibration | Reads policy.yaml cold_start + steady_state |
| **.formal/policy.yaml** | PRISM cold-start config + governance | Existing (v0.20+); extended by v0.26 |
| **.planning/quorum-scoreboard.json** | Empirical quorum telemetry (JSONL) | Written by call-quorum-slot.cjs |

---

## v0.26 Features: Integration Architecture

### Feature 1: Policy Configuration (PLCY-01..03)

**What:** User-editable policy.yaml for PRISM parameters and per-slot behavior (quorum timeout, update policy, calibration mode).

**New Components:**

| File | Purpose | Depends On |
|------|---------|-----------|
| `bin/edit-policy.cjs` | Blessed TUI menu editor | Validates against policy.schema.json |
| `.formal/policy.schema.json` | Extended JSON Schema | N/A (extends existing schema) |

**Data Flow:**

```
User: mcp-setup menu → "Edit Policy"
            ↓
    edit-policy.cjs (blessed TUI)
            ↓
    Validates: policy.yaml against policy.schema.json
            ↓
    Updates .formal/policy.yaml with new sections:
    - quorum_slots: { <slot>: { timeout_ms, update_policy, enabled } }
    - calibration: { auto_adjust_enabled, max_deliberation_override }
            ↓
    Consumed by:
    ├─ run-prism.cjs (reads calibration override)
    └─ call-quorum-slot.cjs (reads per-slot timeout_ms)
```

**Backward Compat:** ✅ New policy.yaml sections are optional; existing cold_start/steady_state still work unchanged

**Risk Level:** LOW

---

### Feature 2: Credential Management (CRED-01..02)

**What:** Secure API key storage in system keyring (keytar), rotation tracking, expiry warnings.

**New Components:**

| File | Purpose | Depends On |
|------|---------|-----------|
| `bin/credential-manager.cjs` | Keyring abstraction (read/write/delete) | keytar npm module |
| `bin/credential-rotator.cjs` | Rotation history + expiry checking | credential-audit.jsonl |
| `hooks/credential-monitor.js` | PostToolUse hook: expiry warnings | Reads credential-audit.jsonl |

**Integration Points:**

- **manage-agents-core.cjs:** Refactored to call credential-manager instead of reading keys from plaintext ~/.claude.json
- **mcp-setup wizard:** Credential menu calls credential-manager to store/retrieve keys
- **install.js:** Offers keyring setup during first-run

**Data Flow:**

```
User adds API key via mcp-setup
            ↓
    credential-manager.cjs
    ├─ keytar.setPassword(service, account, key)
    └─ Append audit entry to ~/.claude/credential-audit.jsonl
            ↓
    ~/.claude.json stores: { "credential_id": "slot-name" } (not the key itself)
            ↓
    On read: manage-agents-core.cjs → credential-manager.cjs getPassword()
            ↓
    [Success: retrieve from keyring]
    [Failure: env var fallback for CI/automation]
```

**Backward Compat:** ✅ Fallback to env vars; external API of manage-agents-core unchanged

**Risk Level:** MEDIUM (refactors key storage path, but with fallbacks)

---

### Feature 3: Portable Installer (PORT-01..03)

**What:** Export/import full roster config across machines with API key redaction and validation.

**New Components:**

| File | Purpose | Depends On |
|------|---------|-----------|
| `bin/export-roster.cjs` | Export ~/.claude.json + providers.json → portable-roster.json | manage-agents-core APIs |
| `bin/import-roster.cjs` | Import + validate + prompt key entry + apply | credential-manager.cjs |
| `bin/roster.schema.json` | JSON Schema for portable roster format | N/A |

**Integration Points:**

- **manage-agents-core.cjs:** Provides readClaudeJson, readProvidersJson, writeClaudeJson, writeProvidersJson
- **mcp-setup wizard:** "Export Roster" / "Import Roster" menu options
- **install.js:** Post-install suggest exporting current roster for backup

**Data Flow:**

```
User: mcp-setup → "Export Roster"
            ↓
    export-roster.cjs
    ├─ readClaudeJson() + readProvidersJson()
    ├─ For each MCP server + slot:
    │  ├─ Redact API keys → "__redacted__"
    │  └─ Keep: provider, model, auth_type, health_check_args
    ├─ Validate against roster.schema.json
    └─ Write: portable-roster.json
            ↓
    [User transfers portable-roster.json to new machine]
            ↓
    User: import-roster.cjs portable-roster.json
            ├─ Validate schema
            ├─ Prompt user: "Enter API key for slot X:"
            ├─ credential-manager.cjs stores in keyring
            ├─ writeClaudeJson() + writeProvidersJson()
            └─ Verify imports successful
```

**Backward Compat:** ✅ New tools; no changes to existing code paths

**Risk Level:** LOW

---

### Feature 4: Dashboard & Observability (DASH-01..03)

**What:** Interactive terminal dashboard showing live quorum status, slot health, provider availability, scoreboard metrics.

**New Components:**

| File | Purpose | Depends On |
|------|---------|-----------|
| `bin/dashboard.cjs` | Blessed TUI event loop | blessed npm module |
| `bin/dashboard-updater.cjs` | Interval-based probe + scoreboard fetch | probeAllSlots logic |
| `lib/dashboard-widgets.cjs` | Reusable blessed widgets | blessed npm module |

**Integration Points:**

- **manage-agents-core.cjs:** probeAllSlots + liveDashboard functions already exist; dashboard wraps them
- **quorum-scoreboard.json:** Dashboard reads in real-time (JSONL append-only, no locking needed)
- **mcp-setup wizard:** "Dashboard" top-level menu → launches dashboard.cjs
- **providers.json:** Dashboard reads provider metadata (name, model, health_check_args)

**Data Flow:**

```
dashboard.cjs (blessed TUI)
        ↓
    On startup:
    ├─ Read quorum-scoreboard.json (all lines)
    ├─ Parse providers.json for slot metadata
    └─ Build initial display
        ↓
    Render loop (every 500ms–1s):
    ├─ Tail quorum-scoreboard.json for new lines (concurrent with dispatch)
    ├─ Update metrics table (latency, success rate, failure rate)
    ├─ Show health status per slot (OK/WARN/FAIL)
    └─ Display "last updated" timestamp
        ↓
    Keypress handlers (space / r):
    └─ Non-blocking probeAllSlots() + update display
        ↓
    Concurrent with:
    └─ call-quorum-slot.cjs writing telemetry to scoreboard.json
```

**Backward Compat:** ✅ Read-only access to existing files; no changes to quorum dispatch

**Risk Level:** LOW

---

### Feature 5: Architecture Enforcement (ARCH-10)

**What:** CI linter prevents LLM SDK bundling (all dispatch via providers.json + MCP). Prevents vendor lock-in and version conflicts.

**New Components:**

| File | Purpose | Depends On |
|------|---------|-----------|
| `bin/check-bundled-sdks.cjs` | ESLint-style import scanner | N/A (pure static analysis) |

**Integration Points:**

- **CI/cd:** Add check-bundled-sdks.cjs to linter suite (alongside eslint, jest)
- **bin/install.js:** Already avoids SDK bundling (uses subprocess dispatch)
- **bin/providers.json:** Single source of truth for provider SDK versioning

**Data Flow:**

```
CI pipeline
    ├─ npm test (existing)
    ├─ eslint (existing)
    ├─ check-bundled-sdks.cjs [NEW]
    │  ├─ Scan all .js/.cjs files for SDK imports
    │  │  (anthropic-sdk, openai, google-generativeai, etc.)
    │  ├─ Fail if found outside whitelisted provider integrations
    │  └─ Exit with code 1 if violations detected
    └─ Merge allowed only if all pass
```

**Backward Compat:** ✅ CI-only; no runtime code changes

**Risk Level:** NONE

---

### Feature 6: Cross-Model Decomposition Analysis (DECOMP-05)

**What:** State-space merge/split analysis with 5-minute TLC budget. Enables parallel TLA+ model checking when specs are independent.

**New Components:**

| File | Purpose | Depends On |
|------|---------|-----------|
| `bin/analyze-state-space.cjs` | Enhanced to output decomposition-graph.json | TLA+ parser (existing v0.25) |
| `bin/run-decomposed-tlc.cjs` | Parallel TLC orchestration | TLC executable, decomposition-graph.json |
| `.formal/decomposition-graph.json` | Dependency graph (specs → variables) | Generated by analyze-state-space.cjs |

**Integration Points:**

- **bin/run-formal-verify.cjs:** Uses decomposition graph to parallelize TLC when safe
- **plan-phase.md Step 8.2:** FV gate can choose decomposed path when budget allows
- **model-registry.json:** decomposition_risk field gates auto-apply of parallelization
- **.formal/tla/:** No changes to specs; only metadata about relationships

**Data Flow:**

```
All 22 TLA+ specs in .formal/tla/
        ↓
    analyze-state-space.cjs
    ├─ Parse each spec (INIT, Next, Inv, variables)
    ├─ Extract variable references
    ├─ Build dependency graph (spec A uses var X, spec B uses var X → coupled)
    ├─ Compute strongly-connected components (SCC)
    └─ Write decomposition-graph.json
        {
          "clusters": [
            { "specs": ["spec1.tla", "spec2.tla"], "coupled": true, "scc": 1 },
            { "specs": ["spec3.tla"], "coupled": false, "scc": 2 }
          ]
        }
        ↓
    plan-phase.md Step 8.2 (FV gate)
    └─ IF decomposable AND time_budget > 5min:
       └─ run-decomposed-tlc.cjs (parallel TLC)
          ├─ For each independent cluster:
          │  └─ spawn tlc spec.tla (up to 2–3 in parallel)
          ├─ Collect results
          ├─ Aggregate + hard-block on any counterexample
          └─ Report elapsed time vs 5min budget
       ELSE:
       └─ run-formal-verify.cjs (sequential TLC)
```

**Backward Compat:** ✅ decomposed TLC is optional; sequential TLC still works as fallback

**Risk Level:** MEDIUM (TLC orchestration complexity; timeout handling critical)

---

## Suggested Build Order & Dependencies

### Phase 1: Policy Configuration (PLCY-01..03) — 2–3 days
**Why first:** No dependencies; lowest risk; unblocks per-slot customization for downstream phases.

**Components:**
- Extend `.formal/policy.schema.json` with quorum_slots, calibration sections
- Implement `bin/edit-policy.cjs` (blessed TUI)
- Update run-prism.cjs + call-quorum-slot.cjs to read new policy sections
- Add "Edit Policy" menu to mcp-setup wizard
- Tests: schema validation, per-slot timeout override behavior

**Critical Integration:**
- run-prism.cjs reads [calibration.max_deliberation_override]
- call-quorum-slot.cjs reads [quorum_slots.<slot>.timeout_ms]

---

### Phase 2: Credential Management (CRED-01..02) — 3–4 days
**Why second:** Depends on Phase 1 (shared policy infrastructure); unblocks secure key export in Phase 3.

**Components:**
- Implement `bin/credential-manager.cjs` (keytar wrapper + audit logging)
- Refactor manage-agents-core.cjs: readClaudeJson → credential-manager for key retrieval
- Add credential-monitor.js PostToolUse hook (expiry warnings)
- Update mcp-setup wizard credential flow
- Update install.js to offer keyring setup
- Tests: keytar mocks, audit log format, fallback logic

**Critical Integration:**
- manage-agents-core.cjs exported APIs must remain unchanged (only internals refactored)
- Keytar availability varies by platform; env var fallback required for CI

---

### Phase 3: Portable Installer (PORT-01..03) — 2–3 days
**Why third:** Depends on Phase 2 (credential-manager); lowest user-facing risk.

**Components:**
- Implement `bin/export-roster.cjs` (read ~/.claude.json + providers.json, redact keys)
- Implement `bin/import-roster.cjs` (validate, prompt keys, atomic write)
- Create `bin/roster.schema.json`
- Add "Export/Import Roster" to mcp-setup menu
- Update install.js: post-install offer export for backup
- Tests: schema validation, redaction correctness, round-trip integrity

**Critical Integration:**
- export-roster.cjs uses manage-agents-core.cjs readClaudeJson + readProvidersJson
- import-roster.cjs uses credential-manager.cjs + writeClaudeJson + writeProvidersJson

---

### Phase 4: Dashboard & Observability (DASH-01..03) — 4–5 days
**Why fourth:** No dependencies on other v0.26 features; can run parallel with Phase 3.

**Components:**
- Implement `bin/dashboard.cjs` (blessed TUI main event loop)
- Implement `bin/dashboard-updater.cjs` (interval probes + scoreboard fetch)
- Implement `lib/dashboard-widgets.cjs` (health table, metrics, status)
- Add "Dashboard" menu option to mcp-setup
- Tests: widget rendering, JSONL parsing, keypress handling, concurrent writes

**Critical Integration:**
- probeAllSlots + liveDashboard functions already exist in manage-agents-core.cjs
- Dashboard reads quorum-scoreboard.json (JSONL append-only; no locking needed)

---

### Phase 5: Architecture Enforcement (ARCH-10) — 1 day
**Why fifth:** Pure CI/linting; zero runtime dependencies.

**Components:**
- Implement `bin/check-bundled-sdks.cjs`
- Update CI/cd: add to linter suite
- Update .eslintignore for whitelisted provider integrations
- Tests: SDK import detection, whitelist validation

**Critical Integration:**
- Zero runtime impact; purely a pre-merge gate

---

### Phase 6: Cross-Model Decomposition (DECOMP-05) — 3–5 days (optional)
**Why sixth / deferrable:** Lowest priority optimization; highest complexity; 5-min TLC budget is constraining.

**Components:**
- Enhance `bin/analyze-state-space.cjs`: output decomposition-graph.json
- Implement `bin/run-decomposed-tlc.cjs` (parallel TLC orchestration)
- Update plan-phase.md Step 8.2: choose decomposed path when safe
- Tests: SCC analysis correctness, parallel TLC aggregation, timeout handling

**Critical Integration:**
- decomposition-graph.json must be generated atomically
- Parallel TLC orchestration must hard-block on any counterexample
- 5-min budget must include SCC analysis + parallel spawning overhead

---

## Modified Files & Backward Compatibility

### Files Requiring Changes

| File | Changes | Risk | Backward Compat |
|------|---------|------|-----------------|
| `.formal/policy.yaml` | Add quorum_slots, calibration sections | LOW | ✅ New sections optional; defaults apply |
| `.formal/policy.schema.json` | Extend schema (additionalProperties: true) | LOW | ✅ Old policy still valid |
| `bin/manage-agents-core.cjs` | Refactor key reads to credential-manager | MEDIUM | ✅ API unchanged; internals refactored |
| `bin/call-quorum-slot.cjs` | Read per-slot timeout from policy.yaml | LOW | ✅ Defaults to existing timeout if not specified |
| `bin/run-prism.cjs` | Read calibration override from policy.yaml | LOW | ✅ Defaults to existing behavior |
| `bin/install.js` | Add --export-roster, --import-roster flags; offer keyring setup | LOW | ✅ New flags; no breaking changes |

### New Files (No Breaking Changes)

- `bin/export-roster.cjs`, `bin/import-roster.cjs`, `bin/roster.schema.json`
- `bin/credential-manager.cjs`, `bin/credential-rotator.cjs`
- `bin/dashboard.cjs`, `bin/dashboard-updater.cjs`, `lib/dashboard-widgets.cjs`
- `bin/edit-policy.cjs`, `bin/check-bundled-sdks.cjs`
- `hooks/credential-monitor.js`, `.formal/decomposition-graph.json`

---

## Key Data Flows

### Flow 1: Policy Configuration

```
mcp-setup menu
    ↓
edit-policy.cjs (blessed TUI)
    ├─ Read current .formal/policy.yaml
    ├─ Show menu for quorum_slots customization
    ├─ Validate changes against policy.schema.json
    └─ Atomic write to .formal/policy.yaml
    ↓
Active consumers:
├─ run-prism.cjs reads [calibration] section
└─ call-quorum-slot.cjs reads [quorum_slots.<slot>.timeout_ms]
```

### Flow 2: Credential Rotation

```
credential-manager.cjs
    ├─ keytar.setPassword(service, account, key)
    ├─ Append to ~/.claude/credential-audit.jsonl
    └─ credential-monitor.js (PostToolUse hook)
        ├─ Reads credential-audit.jsonl
        ├─ Checks expiry windows
        └─ Injects EXPIRY_WARNING to user
```

### Flow 3: Quorum Dispatch with Per-Slot Timeout

```
plan-phase.md triggers quorum
    ↓
quorum.md orchestrator
    ├─ Read .formal/policy.yaml [quorum_slots]
    └─ For each slot:
       ├─ Determine timeout_ms from policy (or default)
       └─ call-quorum-slot.cjs --slot <name> --timeout <ms>
```

### Flow 4: Dashboard Real-Time Updates

```
[Concurrent processes]
├─ call-quorum-slot.cjs (active dispatch) — writes JSONL to quorum-scoreboard.json
└─ dashboard.cjs (blessed TUI) — reads JSONL every 500ms
    ├─ Display: health, provider, model, latency, success rate
    ├─ Keypress (r): non-blocking probeAllSlots()
    └─ Update display every 500ms–1s
```

### Flow 5: Formal Verification Decomposition

```
.formal/tla/ (all 22 specs)
    ↓
analyze-state-space.cjs
    ├─ Parse specs → extract variables, dependencies
    ├─ Build SCC graph
    └─ Write decomposition-graph.json
    ↓
plan-phase.md Step 8.2
    └─ IF safe to decompose AND 5min budget available:
       └─ run-decomposed-tlc.cjs (parallel TLC)
```

---

## Architectural Patterns Applied

### Pattern 1: Two-Layer Config with Shallow Merge
- **Used for:** ~/.claude/qgsd.json (global) + ./.claude/qgsd.json (project)
- **Applied in v0.26:** Policy config follows same pattern (global + optional project override deferred to v0.27+)
- **Trade-off:** Simple, but no deep merge (project entirely replaces global key)

### Pattern 2: Keyring Abstraction with Fallback
- **Used for:** API key storage in system keyring (macOS Keychain, Windows Credential Manager, Linux secret-tool)
- **Trade-off:** Secure (no plaintext), but backend varies by platform; env var fallback for CI/automation

### Pattern 3: Non-Blocking Telemetry Writes
- **Used for:** quorum-scoreboard.json appends during active dispatch
- **Trade-off:** Fast quorum (telemetry doesn't block), but eventual consistency in dashboard reads

### Pattern 4: Isolated TUI Modules (blessed)
- **Used for:** mcp-setup, agents.cjs, dashboard.cjs, edit-policy.cjs all use blessed menus
- **Trade-off:** Consistent UX, but terminal-only (no GUI equivalent)

### Pattern 5: Linted Runtime (ESLint + Node.js)
- **Used for:** CI gate preventing SDK bundling
- **Trade-off:** Zero runtime cost, fail-fast, but requires manual whitelist maintenance

---

## Scaling Considerations

### Current Scale (v0.25)
- **6–7 agents in quorum** (Codex, Gemini, OpenCode, Copilot, Claude)
- **22 TLA+, 11 Alloy, 6 PRISM models**
- **205 requirements** (frozen in .formal/requirements.json)
- **Quorum dispatch:** 3–4 calls/minute during planning

### First Bottleneck: TLA+ Model Checking Speed
- **Current:** 22 models sequentially → 3–5 min /plan-phase
- **v0.26 Mitigation:** Decomposition analysis + parallelized TLC (DECOMP-05)
- **Next bottleneck (v0.27):** PRISM quantitative model size explosion

### At 10+ Agents
| Bottleneck | Mitigation |
|-----------|-----------|
| **Quorum latency** | Parallelization already in place; dashboard shows stalls |
| **Credential storage** | Keyring scales fine (10s of keys); audit log ~1KB/week |
| **TLC state space** | Decomposition + parallelized TLC becomes critical |

---

## Anti-Patterns to Avoid

### Anti-Pattern 1: Credentials in Config Files
**Why wrong:** Keys exposed in git, process env, bug reports.
**Do instead:** Store in system keyring via credential-manager.cjs; config references credential IDs.

### Anti-Pattern 2: Hardcoded Provider URLs
**Why wrong:** Provider migrations break all scripts; customization impossible.
**Do instead:** Always read from providers.json; scripts are data-driven.

### Anti-Pattern 3: Synchronous Disk Writes in Hooks
**Why wrong:** Concurrent hook executions race on shared files.
**Do instead:** Hooks remain read-only; CLI tools do atomic writes (tmpfile + rename).

### Anti-Pattern 4: Blessed TUI Logic Mixed with Business Logic
**Why wrong:** Hard to test; can't reuse logic in CLI context.
**Do instead:** Separate: updater (pure functions) + widgets (rendering) + composition.

### Anti-Pattern 5: Deep Config Merges with Shadowing
**Why wrong:** Nested fields disappear on merge conflicts.
**Do instead:** Shallow merge only; all fields have defaults in DEFAULT_CONFIG.

---

## Verification & Testing Strategy

### Unit Tests (per component)

| Component | Test Scope |
|-----------|-----------|
| credential-manager.cjs | keytar mocks, key storage/retrieval, fallback logic |
| export-roster.cjs | redaction correctness, schema validation |
| import-roster.cjs | schema validation, key prompts, atomic write |
| dashboard-updater.cjs | JSONL parsing, probe logic, aggregation |
| edit-policy.cjs | YAML parsing, schema validation |
| run-decomposed-tlc.cjs | SCC analysis, parallel TLC, result aggregation |

### Integration Tests

| Scenario | Coverage |
|----------|----------|
| Full credential flow (add → store → read → use) | credential-manager + manage-agents-core |
| Export + import roster (round-trip) | export-roster + import-roster + schema |
| Policy edit → quorum dispatch (read latency) | edit-policy + call-quorum-slot |
| Dashboard real-time (concurrent dispatch + display) | dashboard + call-quorum-slot |
| Plan-phase with decomposed TLC (timeout + parallel) | analyze-state-space + run-decomposed-tlc |

---

## Summary: Dependency Graph

```
Phase 1: Policy Configuration (PLCY-01..03)
    ↓
Phase 2: Credential Mgmt (CRED-01..02)
    ↓
Phase 3: Portable Installer (PORT-01..03)
    ↓ (can run parallel with)
Phase 4: Dashboard (DASH-01..03) + Phase 5: Architecture Enforcement (ARCH-10)
    ↓
Phase 6: Decomposition Analysis (DECOMP-05) [optional, lower priority]
```

---

## Sources

- **Existing QGSD Architecture:** `.planning/PROJECT.md` (comprehensive system overview)
- **Formal Verification Integration:** `.formal/model-registry.json` + v0.25 SHIPPED milestone
- **Current Config System:** `hooks/config-loader.js` (two-layer merge pattern)
- **Provider Registry:** `bin/providers.json` (slot-to-provider mapping)
- **Quorum Dispatch:** `bin/call-quorum-slot.cjs` (retry logic + telemetry)
- **Agent Management:** `bin/manage-agents-core.cjs` (core file I/O functions)
- **Policy Governance:** `.formal/policy.yaml` (existing PRISM calibration config)
- **v0.26 Requirements:** `.formal/requirements.json` (PORT-, CRED-, PLCY-, DASH-, ARCH-, DECOMP- IDs)

---

*Architecture research for: QGSD v0.26 Operational Completeness*
*Researched: 2026-03-03*
