# Research: v0.26-01 Policy Configuration

## Phase Goal
Users can control quorum behavior per slot through dedicated policy settings.

## Requirements
- **PLCY-01**: User can set quorum timeout (ms) per slot from a dedicated menu shortcut -- not buried inside editAgent
- **PLCY-02**: User can configure update policy per slot: auto / prompt / skip
- **PLCY-03**: Auto-update policy check runs on manage-agents startup for slots configured as `auto`

## Success Criteria
1. User can set a quorum timeout (ms) for any slot from a dedicated menu shortcut without navigating into editAgent
2. User can configure update policy (auto / prompt / skip) for any slot from the same menu
3. When manage-agents starts, slots configured as `auto` trigger an update policy check automatically
4. Invalid policy values (e.g., timeout < 0, unknown update policy) are rejected with a clear error message

---

## Codebase Analysis

### Current State — What Already Exists

**Significant finding**: Most of the infrastructure for PLCY-01, PLCY-02, and PLCY-03 already exists in the codebase. The functions, TUI flows, and menu entries are implemented but may lack proper input validation (SC-4) and the auto-update startup trigger (SC-3).

#### PLCY-01: Timeout Configuration (Tune Timeouts)

**Menu entry exists** in `bin/qgsd.cjs` line 115:
```js
{ label: '  Tune Timeouts', action: 'tune-timeouts' },
```

**TUI flow exists** — `tuneTimeoutsFlow()` at line 1807:
- Reads `~/.claude.json` mcpServers to get all slots
- Reads `bin/providers.json` for current timeout values
- Uses `buildTimeoutChoices()` to show current ms per slot
- Uses `promptInput()` per slot for new value
- Uses `applyTimeoutUpdate()` to write back to providers.json

**Pure functions exist** in `bin/manage-agents-core.cjs`:
- `buildTimeoutChoices(slots, mcpServers, providersData)` — lines 480-493
- `applyTimeoutUpdate(providersData, providerSlot, newTimeoutMs)` — lines 495-500

**Storage**: Timeout is stored in `bin/providers.json` under each provider entry as `quorum_timeout_ms` (preferred) or `timeout_ms` (fallback).

**Current values**: Range from 8000ms (claude-6/GLM-5) to 30000ms (most slots). All 12 providers have both `timeout_ms: 300000` (general) and `quorum_timeout_ms` (quorum-specific).

**Gaps for SC-1**:
- The flow iterates through ALL slots sequentially — no slot picker first. User walks through every slot. This is a UX gap but technically meets "dedicated menu shortcut without navigating into editAgent."
- No explicit validation: `parseInt(trimmed, 10)` accepts negative numbers or zero without rejection.

#### PLCY-02: Update Policy Configuration

**Menu entry exists** in `bin/qgsd.cjs` line 116:
```js
{ label: '  Set Update Policy', action: 'update-policy' },
```

**TUI flow exists** — `updatePolicyFlow()` at line 1845:
- Reads all slots from `~/.claude.json`
- Shows slot picker with current policy per slot
- Shows policy choices: auto / prompt / skip
- Writes to `~/.claude/qgsd.json` under `agent_config[slotName].update_policy`

**Pure functions exist** in `bin/manage-agents-core.cjs`:
- `buildPolicyChoices(currentPolicy)` — line 502-509
- `writeUpdatePolicy(slotName, policy, filePath)` — line 347-353
- `POLICY_MENU_CHOICES` constant — lines 46-50

**Storage**: Policy is stored in `~/.claude/qgsd.json` under `agent_config.<slotName>.update_policy`.

**Gaps for SC-2**:
- Currently a separate menu item ("Set Update Policy") from "Tune Timeouts". SC-2 says "from the same menu" — this needs a unified "Policy Config" sub-menu or combined flow.

#### PLCY-03: Auto-Update Check on Startup

**Core function exists** — `runAutoUpdateCheck()` in `manage-agents-core.cjs` line 604:
- Reads `qgsd.json` for slots with `update_policy === 'auto'`
- Calls `getUpdateStatuses()` for each
- Logs results to `~/.claude/qgsd-update.log`
- Has 20-second timeout safety

**Test coverage**: `manage-agents.test.cjs` has regression tests for PLCY-03:
- Line 994: Map bracket notation regression guard
- Line 1012: `runAutoUpdateCheck` with injected statuses

**Gaps for SC-3**:
- `runAutoUpdateCheck()` is NOT called at startup in `qgsd.cjs`. The startup block (line 2310) calls `getUpdateStatuses()` directly for badge display but does NOT call `runAutoUpdateCheck()`.
- Need to wire `runAutoUpdateCheck()` into the startup sequence.

#### SC-4: Input Validation

**Current validation gaps**:
- `tuneTimeoutsFlow()`: `parseInt(trimmed, 10)` accepts negative numbers, NaN is not explicitly handled with error message
- `updatePolicyFlow()`: Policy comes from a fixed list (auto/prompt/skip) so invalid values are structurally impossible via TUI — but programmatic writes to qgsd.json have no validation
- `call-quorum-slot.cjs` line 195 silently coerces bad timeout to null: `if (timeoutMs !== null && (isNaN(timeoutMs) || timeoutMs <= 0)) timeoutMs = null;` — no error message
- No validation function exists for policy values at the storage layer

### Architecture Summary

```
User Interface (qgsd.cjs blessed TUI)
  ├── MENU_ITEMS → dispatch() → tuneTimeoutsFlow() → PLCY-01
  ├── MENU_ITEMS → dispatch() → updatePolicyFlow() → PLCY-02
  └── Startup block (line 2310) → getUpdateStatuses() → badge only (PLCY-03 gap)

Pure Logic (manage-agents-core.cjs)
  ├── buildTimeoutChoices()    → read from providers.json
  ├── applyTimeoutUpdate()     → write to providers.json
  ├── buildPolicyChoices()     → UI choices for auto/prompt/skip
  ├── writeUpdatePolicy()      → write to qgsd.json
  └── runAutoUpdateCheck()     → auto-policy check (not wired to startup)

Storage
  ├── bin/providers.json       → quorum_timeout_ms per provider entry
  ├── ~/.claude/qgsd.json      → agent_config[slot].update_policy
  └── ~/.claude/qgsd-update.log → auto-update check results
```

### Key Dependencies
- `blessed` — TUI framework (already in use)
- `manage-agents-core.cjs` — pure function layer (no side effects)
- `update-agents.cjs` — `getUpdateStatuses()` for checking CLI versions
- `providers.json` — 12 provider entries with timeout_ms and quorum_timeout_ms
- `qgsd.json` — agent_config section for per-slot policies

### Test Infrastructure
- `manage-agents.test.cjs` — comprehensive pure function tests (1000+ lines)
- Tests use `node:test` runner with `assert/strict`
- Tests for PLCY-03 exist but some are expected-RED (regression guards)

---

## Gap Analysis — Work Needed

| SC | Status | Gap Description |
|----|--------|-----------------|
| SC-1 | Mostly done | Timeout menu exists but needs input validation (reject < 0, clear error msg) |
| SC-2 | Partially done | Policy menu exists but separate from timeout; needs unified "Policy Config" entry or merging under same sub-menu |
| SC-3 | Core exists, not wired | `runAutoUpdateCheck()` exists but not called at startup; need to add to qgsd.cjs boot sequence |
| SC-4 | Missing | No validation at input or storage layer; need validation functions + clear error toast messages |

## Risk Assessment
- **Low risk**: All infrastructure exists. This is primarily a wiring + validation phase.
- **No new dependencies** needed.
- **Test coverage** is strong for pure functions; needs expansion for validation edge cases.

## Recommended Plan Decomposition
1. **Plan 01**: Add input validation — timeout validation (reject < 0, NaN) and policy validation (reject unknown values) with clear error messages in both TUI and pure functions
2. **Plan 02**: Unify policy menus — create combined "Policy Config" sub-menu accessible from main menu that exposes both timeout and update-policy in one flow (or ensure SC-2 is met by the current separate-menu approach if "same menu" means "same main menu level")
3. **Plan 03**: Wire PLCY-03 startup — call `runAutoUpdateCheck()` in qgsd.cjs startup block for slots with `auto` policy; add tests for startup wiring
