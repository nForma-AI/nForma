---
plan: 27-01
phase: 27-model-switching
status: complete
completed: 2026-02-22
requirements:
  - MGR-02
---

# Summary: Add model_preferences config key and quorum override injection

## What Was Built

Added `model_preferences` persistence and injection layer to the QGSD hook system:

1. **config-loader.js** — Added `model_preferences: {}` to `DEFAULT_CONFIG`. Added validation in `validateConfig()`: rejects non-objects with a stderr warning, removes non-string or empty-string entries with per-entry warnings.

2. **qgsd-prompt.js** — Changed `const instructions` to `let instructions`. Added AGENT_TOOL_MAP covering all 10 quorum agents. When `config.model_preferences` has entries, appends a "Model overrides" block to the additionalContext injected on every quorum command invocation.

3. **Sync** — `hooks/dist/config-loader.js`, `hooks/dist/qgsd-prompt.js`, and `~/.claude/hooks/` updated to match source.

## Key Files

- `hooks/config-loader.js` — DEFAULT_CONFIG + validateConfig coverage for model_preferences
- `hooks/qgsd-prompt.js` — AGENT_TOOL_MAP + override injection block
- `hooks/dist/config-loader.js` — dist copy (synced)
- `hooks/dist/qgsd-prompt.js` — dist copy (synced)

## Verification

- `grep -c "model_preferences" hooks/config-loader.js` → 8 (DEFAULT_CONFIG + 7 validation lines)
- `node -e "require('./hooks/config-loader.js')"` → OK
- `node -e "require('./hooks/qgsd-prompt.js')"` → OK
- All 4 file diffs clean (source == dist == installed)
- Functional test: override entries detected and formatted correctly → PASSED
- npm test: 201 passing, 0 failing

## Self-Check: PASSED
