---
plan: 30-01
phase: 30-fix-gemini-cli-package-reference
status: complete
completed: 2026-02-22
requirements: [STD-10]
---

# Summary: Fix Gemini CLI Package Reference

## What Was Built

Corrected the stale `@tuannvm/gemini-mcp-server` package reference in `~/.claude.json` to `gemini-mcp-server` (unscoped), and registered STD-10 as complete in REQUIREMENTS.md.

## Tasks Completed

| # | Task | Status |
|---|------|--------|
| 1 | Update ~/.claude.json gemini-cli args to unscoped package name | ✓ Complete |
| 2 | Add STD-10 to REQUIREMENTS.md v0.4 Complete section | ✓ Complete |

## Key Files

### Modified
- `~/.claude.json` — mcpServers["gemini-cli"].args changed from `["-y", "@tuannvm/gemini-mcp-server"]` to `["-y", "gemini-mcp-server"]`
- `.planning/REQUIREMENTS.md` — Added STD-10 subsection, traceability row, updated coverage count to 5

## Verification

- `~/.claude.json` gemini-cli args: `["-y", "gemini-mcp-server"]` — PASS
- REQUIREMENTS.md STD-10 entries: 4 lines (checkbox, traceability, coverage, last-updated) — PASS
- No other mcpServers entries modified — PASS

## Self-Check: PASSED

All must-haves from plan frontmatter verified:
- `~/.claude.json` mcpServers["gemini-cli"].args contains `gemini-mcp-server` (not `@tuannvm/gemini-mcp-server`) ✓
- Running `/qgsd:mcp-update gemini-cli` would resolve to `npm install -g gemini-mcp-server` ✓
- REQUIREMENTS.md has STD-10 listed as `[x]` complete in the v0.4 Requirements (Complete) section ✓
