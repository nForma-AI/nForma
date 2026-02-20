---
phase: 02-config-mcp-detection
plan: 03
subsystem: installer
tags: [nodejs, installer, mcp-detection, auto-config]

requires:
  - phase: 01-hook-enforcement
    provides: qgsd.json template write path in bin/install.js

provides:
  - bin/install.js — MCP auto-detection on first install (buildRequiredModelsFromMcp, buildQuorumInstructions)
  - qgsd.json written with detected server prefixes rather than verbatim template copy
  - quorum_instructions generated from detected models (behavioral + structural enforcement aligned)

affects: [02-04]

tech-stack:
  added: []
  patterns:
    - Keyword-based MCP server name detection (case-insensitive .toLowerCase().includes())
    - Idempotent config write: skip-if-exists guard preserved (MCP-05)
    - quorum_instructions generation from detected models (behavioral/structural alignment)

key-files:
  created: []
  modified:
    - bin/install.js

key-decisions:
  - "QGSD_KEYWORD_MAP named with QGSD_ prefix to avoid collision with any existing constants in 1874-line file"
  - "quorum_instructions generated from detectedModels (not template copy) so behavioral instructions name the same tools as structural enforcement — prevents mismatch when server names are renamed"
  - "The if (!fs.existsSync(qgsdConfigPath)) guard preserved — never overwrites existing user config"
  - "console.warn() acceptable in install.js (installer, not hook — stdout is not the decision channel)"
  - "Template templates/qgsd.json retains hardcoded quorum_instructions as reference for manual installs"

patterns-established:
  - "Pattern: MCP detection runs once at install time — hooks never run detection at runtime"
  - "Pattern: keyword-match → derive tool_prefix as 'mcp__' + serverName + '__'"
  - "Pattern: fall back to hardcoded default prefix per model when no server detected; warn user"

requirements-completed: [MCP-01, MCP-02, MCP-03, MCP-04, MCP-05]

duration: 8min
completed: 2026-02-20
---

# Phase 02 Plan 03: MCP Auto-Detection Summary

**Added `buildRequiredModelsFromMcp()` and `buildQuorumInstructions()` to `bin/install.js` — installer now detects Codex/Gemini/OpenCode MCP server names from `~/.claude.json` and writes detected prefixes into `qgsd.json`, with `quorum_instructions` generated from the same detected names.**

## Performance

- **Duration:** 8 min
- **Completed:** 2026-02-20
- **Tasks:** 1
- **Files modified:** 1

## Accomplishments

### Task 1: Add buildRequiredModelsFromMcp() to installer

Added three new constructs to `bin/install.js` (inserted after banner constant, before parseConfigDirArg):

**QGSD_KEYWORD_MAP** — constant mapping model keys to detection keywords and default prefixes:
- `codex` → keywords: ['codex'], default: 'mcp__codex-cli__'
- `gemini` → keywords: ['gemini'], default: 'mcp__gemini-cli__'
- `opencode` → keywords: ['opencode'], default: 'mcp__opencode__'

**buildRequiredModelsFromMcp()** — reads `~/.claude.json`, extracts `mcpServers`, keyword-matches each server name (case-insensitive) to identify quorum candidates, derives `tool_prefix = "mcp__" + serverName + "__"`. Falls back to hardcoded default prefix per model if no match found. Warns on `~/.claude.json` read failure.

**buildQuorumInstructions(requiredModels)** — generates the `quorum_instructions` string from the detected `required_models` entries. Uses detected `tool_prefix` values so the injected behavioral instructions in UserPromptSubmit name the exact same tools as the Stop hook's structural enforcement.

**Updated qgsd.json write block** (line ~1680):
- Replaced template `fs.copyFileSync()` with detection-aware path
- Calls `buildRequiredModelsFromMcp()` → `buildQuorumInstructions(detectedModels)` → writes full JSON config
- Existing `qgsd.json` guard (`if (!fs.existsSync(...))`) preserved — MCP-05 compliant
- New else branch logs "user config preserved" when file already exists

## Self-Check: PASSED

All verification checks pass:
- `grep -n "buildRequiredModelsFromMcp" bin/install.js` → 2 matches (definition line 152, call line 1682)
- `grep -n "buildQuorumInstructions" bin/install.js` → 2 matches (definition line 193, call line 1691)
- `grep -n "QGSD_KEYWORD_MAP" bin/install.js` → 2 matches (definition line 143, use line 168)
- `grep -n "fs.existsSync(qgsdConfigPath)" bin/install.js` → match at line 1680 (guard still present)
- `node bin/install.js --help` → exits cleanly, no syntax error
- `grep "quorum_instructions.*buildQuorumInstructions" bin/install.js` → match at line 1691
