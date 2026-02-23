---
phase: quick-65
plan: 01
subsystem: maintain-tests / pytest discovery
tags: [pytest, discovery, addopts, override-ini, maintain-tests]
dependency_graph:
  requires: []
  provides: [invokePytest-override-ini, invokePytest-module-fallback]
  affects: [maintain-tests discover, cmdMaintainTestsDiscover]
tech_stack:
  added: []
  patterns: [pytest --override-ini=addopts= to neutralize project-level verbose mode, Module fallback parser for verbose tree output]
key_files:
  modified:
    - get-shit-done/bin/gsd-tools.cjs
    - ~/.claude/qgsd/bin/gsd-tools.cjs
decisions:
  - "--override-ini=addopts= clears project addopts at CLI level, ensuring -q flat output even when pyproject.toml sets addopts = -v"
  - "Module fallback parser activates only when :: parser finds zero results — safe no-op for normal output"
metrics:
  duration: ~3 min
  completed: 2026-02-23T11:02:22Z
  tasks_completed: 2
  files_modified: 2
---

# Phase quick-65 Plan 01: Fix pytest discover in maintain-tests Summary

**One-liner:** Two-layer fix to invokePytest() — --override-ini=addopts= neutralizes project-level `-v` addopts, plus a `<Module>` tree fallback parser for conftest-injected verbose output.

## What Was Built

`invokePytest()` in `cmdMaintainTestsDiscover` failed silently on Python projects whose `pyproject.toml` sets `addopts = -v`. The `-v` flag overrides `-q`, producing verbose `<Module filename.py>` tree output instead of the flat `path::test_name` format the parser expects. Result: 0 test files discovered, making maintain-tests completely unusable on those projects.

Two changes fix this:

1. **`--override-ini=addopts=`** added to the pytest spawnSync args. This clears any project-level `addopts` value at CLI invocation time so `-q` takes effect and produces the expected flat output.

2. **`<Module>` fallback parser** added after the primary `::` parser block. If the primary parser finds zero files (e.g., conftest.py re-injects verbose mode), the fallback scans lines matching `/^<Module\s+(.+\.py)>/` and resolves them to absolute paths. It only activates when `files.size === 0`, so it cannot interfere with normal output.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Fix invokePytest — add --override-ini flag and Module fallback parser | e0a7461 | get-shit-done/bin/gsd-tools.cjs |
| 2 | Install sync — propagate fix to ~/.claude/qgsd/ | (install sync, no new commit) | ~/.claude/qgsd/bin/gsd-tools.cjs |

## Verification

- `grep "override-ini" get-shit-done/bin/gsd-tools.cjs` — match at line 5907 inside `invokePytest()`
- `grep "modulePattern" get-shit-done/bin/gsd-tools.cjs` — match at line 5933 inside `invokePytest()` fallback block
- `grep "override-ini" ~/.claude/qgsd/bin/gsd-tools.cjs` — match at line 5907 (install sync confirmed)

## Deviations from Plan

None — plan executed exactly as written.

## Self-Check: PASSED

- get-shit-done/bin/gsd-tools.cjs: FOUND (modified, contains override-ini and modulePattern)
- ~/.claude/qgsd/bin/gsd-tools.cjs: FOUND (installed copy synced, contains override-ini)
- Commit e0a7461: FOUND
