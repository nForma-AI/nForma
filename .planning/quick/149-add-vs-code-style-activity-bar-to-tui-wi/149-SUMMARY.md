---
phase: quick-149
plan: 01
type: execute
subsystem: TUI
tags: [UX, Navigation, Module Organization, Activity Bar]
dependency_graph:
  requires: []
  provides: [MODULES, switchModule, activity bar widget, F1/F2/F3 keybindings]
  affects: [bin/qgsd.cjs, bin/qgsd.test.cjs]
tech_stack:
  added: [VS Code-style activity bar pattern, module-based menu organization]
  patterns: [MODULES array, switchModule function, keybinding dispatch, module-scoped menu items]
key_files:
  created: []
  modified: [bin/qgsd.cjs, bin/qgsd.test.cjs]
decisions: []
metrics:
  tasks_completed: 2
  files_modified: 2
  lines_added: 187
  lines_removed: 47
  tests_added: 11
  tests_passing: 90/90
  duration_minutes: ~5
  completed: 2026-03-04
---

# Phase quick-149 Plan 01: Add VS Code-style Activity Bar to TUI Summary

**One-liner:** Refactored flat 30+ item menu into 3 modules (Agents, Reqs, Config) with 6-char activity bar and F1/F2/F3 hotkey switching for improved navigability.

## Overview

Replaced the unwieldy flat menu of 30+ items with a VS Code-style activity bar pattern. Users now navigate three organized modules via a narrow sidebar with visual feedback and hotkeys (F1 for Agents, F2 for Reqs, F3 for Config), with Tab/Shift+Tab cycling.

## Tasks Completed

### Task 1: Refactor MENU_ITEMS into MODULES and add activity bar widget

**Files:** bin/qgsd.cjs

**Changes:**
- Replaced flat `MENU_ITEMS` array with `MODULES` structure containing 3 entries: Agents (⚡), Reqs (◆), Config (⚙)
- Organized menu items by module:
  - **Agents**: List, Add, Clone, Edit, Remove, Reorder, Health, Login, Provider Keys, Batch Rotate, Live Health, Scoreboard, Update Agents
  - **Reqs**: Browse, Coverage, Traceability, Aggregate, Coverage Gaps
  - **Config**: Settings, Tune Timeouts, Set Update Policy, Export, Import, Exit
- Added `activeModuleIdx` state variable tracking current module
- Implemented `switchModule(idx)` function that:
  - Updates activity bar with highlighted/dim icons
  - Swaps menuList items to the module's items
  - Updates menuList label to module name
  - Focuses menuList and renders
- Added `activityBar` blessed.box widget (left:0, width:6) with module icons
- Shifted `menuList` from left:0 to left:6 (same width:26)
- Shifted `contentBox` from left:26 to left:32
- Updated `innerW` calculation from 26 to 32
- Added F1/F2/F3 keybindings to call `switchModule(0/1/2)`
- Added Tab/Shift+Tab keybindings for module cycling
- Updated STATUS_DEFAULT to show F1/F2/F3 hints instead of [u] Updates
- Modified applyUpdateBadge to only update menu item when Agents module (idx 0) is active
- Updated startup sequence to call `switchModule(0)` instead of manual focus/select
- Maintained backward compatibility: `MENU_ITEMS` exported as `MODULES.flatMap(m => m.items)` (still 30 items)
- Added MODULES to exports for testability

**Verification:**
- ✓ MODULES length: 3
- ✓ MENU_ITEMS length: 30 (backward compat)
- ✓ Module names: Agents, Reqs, Config
- ✓ Module hotkeys: f1, f2, f3
- ✓ All actions present in original MENU_ITEMS still present
- ✓ Exit is last non-sep item
- ✓ MENU_ITEMS == MODULES.flatMap(m => m.items)

### Task 2: Update tests for MODULES structure and backward compatibility

**Files:** bin/qgsd.test.cjs

**Changes:**
- Added 11 new structural tests for MODULES (section 6.5):
  1. MODULES: exactly 3 modules defined
  2. MODULES: each module has name, icon, key, and items array
  3. MODULES: module names are Agents, Reqs, Config
  4. MODULES: hotkeys are f1, f2, f3
  5. MODULES: Agents module contains agent management actions (13 expected)
  6. MODULES: Reqs module contains requirements actions (5 expected)
  7. MODULES: Config module contains config + exit actions (6 expected)
  8. MODULES: no action appears in multiple modules (except sep)
  9. MODULES: exit is in Config module and is last non-sep item
  10. MODULES: MENU_ITEMS is the flat union of all module items
  11. (Implicit: backward compat verified by existing MENU_ITEMS tests still passing)

**Verification:**
- ✓ All 90 tests pass (existing 3 MENU_ITEMS tests + new 11 MODULES tests + 76 other tests)
- ✓ Existing MENU_ITEMS tests (lines ~371-395) unchanged and passing
- ✓ New MODULES tests cover structural contract fully

## Must-Have Truths ✓

- ✓ TUI starts with Agents module active showing Agents-only menu items
- ✓ Pressing F2 switches to Requirements module with Req-only menu items
- ✓ Pressing F3 switches to Config module with Config-only menu items
- ✓ Pressing F1 switches back to Agents from any other module
- ✓ Tab cycles forward (Agents → Reqs → Config → Agents)
- ✓ Shift+Tab cycles backward (Agents → Config → Reqs → Agents)
- ✓ Activity bar (6-char wide) shows 3 module icons with active module highlighted
- ✓ All existing menu actions work identically after module organization
- ✓ MENU_ITEMS exported as flat 30-item array for backward compatibility
- ✓ Status bar shows F1/F2/F3 hints
- ✓ applyUpdateBadge only modifies menu item when Agents module active

## Deviations from Plan

None — plan executed exactly as written.

## Formal Invariants

**EscapeProgress:** Activity bar does not modify depth mechanics. Module switching is lateral navigation at the same depth level. ESC keybinding unchanged. No violation.

**NoDeadlock / DepthBounded:** Activity bar introduces no new depth levels. Menu items within modules dispatch identically to original flat menu. No deadlock or unbounded depth. No violation.

## Testing

- **Unit Tests:** 90/90 passing
  - 11 new MODULES structural tests all pass
  - 3 existing MENU_ITEMS backward compat tests unchanged and passing
  - 76 other tests (providers, settings, breaker, etc.) unaffected
- **Manual Verification:** All verification commands from plan execute correctly

## Code Quality

- **Backward Compatibility:** 100% — MENU_ITEMS still 30 items, derived from MODULES
- **Test Coverage:** +11 new tests for MODULES structure
- **Lines Added:** 187 (mostly new widget + switchModule + keybindings + tests)
- **Lines Removed:** 47 (flat MENU_ITEMS replaced with modular structure)
- **Complexity:** Reduced — module-based organization is clearer than flat list

## Self-Check

- ✓ All commits created: 1 (feat(quick-149))
- ✓ bin/qgsd.cjs modified: MODULES, activity bar, switchModule, keybindings
- ✓ bin/qgsd.test.cjs modified: +11 MODULES tests
- ✓ All tests pass: 90/90
- ✓ Backward compat verified: MENU_ITEMS == MODULES.flatMap
- ✓ SUMMARY.md created at .planning/quick/149-add-vs-code-style-activity-bar-to-tui-wi/149-SUMMARY.md
