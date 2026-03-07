---
phase: quick-213
plan: 01
subsystem: tui-assets
tags: [tui, svg, documentation, automation]
dependency_graph:
  requires: [bin/nForma.cjs]
  provides: [bin/generate-tui-assets.cjs, docs/assets/tui-*.svg, npm-script-assets-tui]
  affects: [package.json]
tech_stack:
  added: []
  patterns: [synthetic-ansi-screenshot, ansi-to-svg-conversion]
key_files:
  created:
    - bin/generate-tui-assets.cjs
    - bin/generate-tui-assets.test.cjs
    - docs/assets/tui-agents.svg
    - docs/assets/tui-reqs.svg
    - docs/assets/tui-config.svg
    - docs/assets/tui-sessions.svg
  modified:
    - bin/nForma.cjs
    - package.json
decisions:
  - Synthetic ANSI fallback instead of blessed headless (TTY-independent, deterministic output)
  - Duplicated MODULES data in SCREENSHOT_MODULES to avoid coupling screenshot mode to interactive TUI widget setup
metrics:
  duration: 3min
  completed: 2026-03-07
---

# Quick 213: Automate TUI Asset Generation Summary

Synthetic ANSI screenshot mode for nForma TUI with ANSI-to-SVG converter producing Tokyo Night themed documentation assets.

## What Was Done

### Task 1: Add --screenshot CLI mode to nForma.cjs (76667a29)
- Added `--screenshot <module>` CLI handler in the non-interactive CLI section (before TUI loads)
- Builds synthetic ANSI representation from SCREENSHOT_MODULES data (menu items, activity bar icons, header, status bar)
- Supports all four modules: agents, reqs, config, sessions (case-insensitive)
- Invalid module names print usage to stderr and exit 1
- Uses box-drawing characters for terminal frame layout

### Task 2: Create generate-tui-assets.cjs and npm script (db0d0b4b)
- Created `bin/generate-tui-assets.cjs` with `ansiToSvg()` converter
- Parses ANSI escape codes (standard 30-37/90-97 and 24-bit RGB) to Tokyo Night hex colors
- Generates SVG with terminal window chrome (dark background, traffic lights, title bar, rounded corners)
- Font family and sizing matches existing generate-terminal-svg.js
- Created 20 tests covering ANSI stripping, color parsing, SVG structure, XML escaping, and fail-open behavior
- Added `assets:tui` npm script and integrated into `generate-assets`
- Added test file to `test:ci` script list
- Generated 4 SVG files in docs/assets/

## Deviations from Plan

None - plan executed exactly as written. The fallback approach (synthetic ANSI instead of blessed headless) was anticipated in the plan's NOTE section.

## Verification Results

- `node bin/nForma.cjs --screenshot agents` exits 0 with ANSI output
- `node bin/nForma.cjs --screenshot invalid` exits 1 with usage message
- `node bin/generate-tui-assets.cjs` produces 4 SVG files in docs/assets/
- Each SVG starts with `<svg` and ends with `</svg>`
- `npm run assets:tui` works (exit 0)
- `node --test bin/generate-tui-assets.test.cjs` passes (20/20)
- Zero new npm dependencies added
