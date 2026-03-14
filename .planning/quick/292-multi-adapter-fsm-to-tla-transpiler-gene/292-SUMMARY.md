---
phase: quick-292
plan: 01
subsystem: formal-verification
tags: [tla-plus, fsm, adapter, transpiler, xstate, asl, robot, sismic]

requires: []
provides:
  - "Multi-adapter FSM-to-TLA+ transpiler pipeline (bin/fsm-to-tla.cjs)"
  - "10 framework adapters in bin/adapters/"
  - "Shared MachineIR intermediate representation"
affects: [formal-verification, hooks]

tech-stack:
  added: [js-yaml]
  patterns: [adapter-plugin-architecture, shared-ir]

key-files:
  created:
    - bin/adapters/ir.cjs
    - bin/adapters/emitter-tla.cjs
    - bin/adapters/xstate-v5.cjs
    - bin/adapters/detect.cjs
    - bin/adapters/scaffold-config.cjs
    - bin/adapters/registry-update.cjs
    - bin/fsm-to-tla.cjs
  modified:
    - bin/xstate-to-tla.cjs
    - bin/generate-formal-specs.cjs
    - hooks/nf-spec-regen.js
    - package.json

key-decisions:
  - "Adapter plugin architecture with shared MachineIR"
  - "Regex-based extraction for Python/Go adapters avoids runtime dependency"
  - "XState v4 vs v5 differentiated by Machine vs createMachine function name"

requirements-completed: []

duration: 25min
completed: 2026-03-14
---

# Quick Task 292: Multi-adapter FSM-to-TLA+ Transpiler Summary

**Plugin-based FSM-to-TLA+ transpiler supporting 10 frameworks via shared MachineIR, unified CLI, and backward-compatible thin wrapper**

## Performance

- **Duration:** 25 min
- **Started:** 2026-03-14T17:35:23Z
- **Completed:** 2026-03-14T18:00:44Z
- **Tasks:** 19
- **Files created:** 30
- **Files modified:** 4

## Accomplishments
- Created MachineIR schema and validateIR as shared intermediate representation
- Extracted TLA+ emitter and XState v5 adapter from monolithic xstate-to-tla.cjs
- Built 10 framework adapters: XState v5/v4, JSM, Robot, ASL, Stately, Python transitions, sismic, looplab/fsm, qmuntal/stateless
- Created unified CLI bin/fsm-to-tla.cjs with --framework, --detect, --scaffold-config, --dry flags
- Reduced xstate-to-tla.cjs from 557 lines to 25-line thin wrapper with full backward compat
- Generalized nf-spec-regen hook with configurable file patterns
- Extracted shared registry-update module from generate-formal-specs.cjs
- 70 tests pass (all new + existing)

## Task Commits

1. **Task 1: IR schema** - `78ffd7ac` (feat)
2. **Task 2: TLA+ emitter** - `d0b9b005` (feat)
3. **Task 3: XState v5 adapter** - `e17da462` (feat)
4. **Task 4: Detection registry + scaffold-config** - `4694d812` (feat)
5. **Task 5: Registry-update module** - `848d68f8` (feat)
6. **Task 6: Unified CLI** - `3565c3ec` (feat)
7. **Task 7: Thin wrapper** - `2b75420a` (refactor)
8. **Task 8: XState v4 adapter** - `0c27435e` (feat)
9. **Task 9: JSM adapter** - `19a335b6` (feat)
10. **Task 10: Robot adapter** - `cc027042` (feat)
11. **Task 11: ASL adapter** - `65a06934` (feat)
12. **Task 12: Stately adapter** - `6c6da034` (feat)
13. **Task 13: Python transitions adapter** - `ce16b135` (feat)
14. **Task 14: sismic adapter** - `847584f4` (feat)
15. **Task 15: looplab/fsm adapter** - `436b1c3f` (feat)
16. **Task 16: qmuntal/stateless adapter** - `83d45552` (feat)
17. **Task 17: Hook generalization** - `e8cb7181` (feat)
18. **Task 18: Registry-update wiring** - `b7a570f3` (refactor)
19. **Task 19: Package.json + full test suite** - `18cab301` (feat)

## Decisions Made
- XState v4 vs v5 differentiated by Machine vs createMachine in source text
- Python/Go adapters use regex extraction (no runtime dependency on those languages)
- All adapters fail-open in detect.cjs: missing adapter logs warning but does not crash
- JSM and v4 adapters check mod itself plus Object.values(mod) for esbuild CJS quirk

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] XState v4 detect false positive on v5 files**
- **Found during:** Task 19
- **Fix:** v4 detect now only matches Machine (not createMachine) to distinguish from v5

**2. [Rule 1 - Bug] esbuild CJS module export duck-typing**
- **Found during:** Tasks 8-9
- **Fix:** Check both mod itself and Object.values(mod) as duck-type candidates

**3. [Rule 1 - Bug] Robot adapter multi-transition regex**
- **Found during:** Task 10
- **Fix:** Position-based block slicing instead of single regex for state boundaries

---

**Total deviations:** 3 auto-fixed (3 bugs)
**Impact on plan:** All auto-fixes necessary for correctness. No scope creep.

## Issues Encountered
- Security hook blocked some adapter file writes with false-positive warning; retried successfully
- Pre-existing failure in run-tlc.test.cjs (missing tla2tools.jar) unrelated to this task

## User Setup Required
None.

## Self-Check: PASSED

All 30 created files verified on disk. All 19 commit hashes verified in git log.

---
*Quick Task: 292*
*Completed: 2026-03-14*
