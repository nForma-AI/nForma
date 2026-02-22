---
plan: 23-03
phase: 23-mcp-repo-surface-fixes
status: complete
completed: 2026-02-22
requirements_closed:
  - STD-07
  - STD-09
---

# Plan 23-03 Summary: Makefiles + CHANGELOG.md + CLAUDE.md

## What Was Built

Closed STD-07 (full Makefiles) and STD-09 (CHANGELOG.md + CLAUDE.md) across all affected repos.

## Key Changes

### STD-07: Full 6-target Makefile for 4 Gen1 repos
Replaced the stub `.PHONY: lint` (which combined lint+format into one target) with:
```
.PHONY: lint format test build clean dev
```
6 separate named targets, each delegating to the corresponding npm command.
Applied to: claude-mcp-server, codex-mcp-server, copilot-mcp-server, openhands-mcp-server.

### STD-09: CHANGELOG.md
Created in all 4 Gen1 repos with initial v1.4.0 entry (2026-02-22):
- claude-mcp-server/CHANGELOG.md (created)
- codex-mcp-server/CHANGELOG.md (created)
- copilot-mcp-server/CHANGELOG.md (created)
- openhands-mcp-server/CHANGELOG.md (created)
gemini-mcp-server and opencode-mcp-server already had CHANGELOG.md — not touched.

### STD-09: CLAUDE.md
Created in claude, codex, gemini repos (copied from copilot reference):
- claude-mcp-server/CLAUDE.md (created)
- codex-mcp-server/CLAUDE.md (created)
- gemini-mcp-server/CLAUDE.md (created)
copilot-mcp-server, opencode-mcp-server, openhands-mcp-server already had CLAUDE.md.

## Deviation
gemini-mcp-server had `CLAUDE.md` in `.gitignore`. The gitignore line was removed to allow tracking the operational policy file.

## Self-Check

### Verification Results
1. All 4 Gen1 Makefiles: `.PHONY: lint format test build clean dev` — confirmed
2. All 4 Gen1 Makefiles: tab-indented npm commands — confirmed via python3 repr()
3. `make lint` in claude-mcp-server: exits 0
4. All 12 CHANGELOG.md/CLAUDE.md files across 6 repos: all exist (ls check shows OK)
5. All 3 new CLAUDE.md: `grep "CLAUDE OPERATING POLICY"` found

### Status: PASSED

## Key Files Created/Modified
- `/Users/jonathanborduas/code/claude-mcp-server/Makefile`
- `/Users/jonathanborduas/code/codex-mcp-server/Makefile`
- `/Users/jonathanborduas/code/copilot-mcp-server/Makefile`
- `/Users/jonathanborduas/code/openhands-mcp-server/Makefile`
- `/Users/jonathanborduas/code/claude-mcp-server/CHANGELOG.md` (created)
- `/Users/jonathanborduas/code/codex-mcp-server/CHANGELOG.md` (created)
- `/Users/jonathanborduas/code/copilot-mcp-server/CHANGELOG.md` (created)
- `/Users/jonathanborduas/code/openhands-mcp-server/CHANGELOG.md` (created)
- `/Users/jonathanborduas/code/claude-mcp-server/CLAUDE.md` (created)
- `/Users/jonathanborduas/code/codex-mcp-server/CLAUDE.md` (created)
- `/Users/jonathanborduas/code/gemini-mcp-server/CLAUDE.md` (created)
- `/Users/jonathanborduas/code/gemini-mcp-server/.gitignore` (removed CLAUDE.md exclusion)
