---
phase: quick-68
plan: 01
subsystem: documentation
tags: [readme, documentation, mcp-setup, fix-tests, quorum-composition, agent-slots]
dependency_graph:
  requires: []
  provides: [updated-readme]
  affects: [README.md]
tech_stack:
  added: []
  patterns: []
key_files:
  created: []
  modified:
    - README.md
decisions:
  - "Quorum setup section leads with /qgsd:mcp-setup wizard; manual steps moved to details block — wizard is the canonical path"
  - "Manual setup steps updated to slot-based names (codex-cli-1, gemini-cli-1, etc.) to match v0.6 agent slot scheme"
  - "MCP Management grouped as its own Commands section (not folded into Utilities)"
  - "Test Maintenance grouped as its own Commands section"
  - "Test Suite Maintenance added as prose section before Why It Works — same depth as Quick Mode"
metrics:
  duration: "~8 min"
  completed: "2026-02-23"
  tasks_completed: 2
  files_modified: 1
---

# Quick Task 68: Audit and Update README and Documentation — Summary

**One-liner:** README updated to accurately reflect all v0.1–v0.7 features: 6 missing commands added, wizard-first quorum setup, MCP Management section, Test Suite Maintenance section, agent slot naming, and quorum composition documented.

## What Changed

### README.md

**Added: MCP Management command group**
- `/qgsd:mcp-setup` — Interactive wizard (first-run onboarding or reconfigure any agent)
- `/qgsd:mcp-status` — Poll all quorum agents for identity and availability
- `/qgsd:mcp-set-model` — Switch a quorum agent's model with live validation
- `/qgsd:mcp-update` — Update all quorum agent MCP servers
- `/qgsd:mcp-restart` — Restart all quorum agent processes

**Added: Test Maintenance command group**
- `/qgsd:fix-tests` — Discover all tests, AI-categorize failures into 5 types, dispatch fixes, loop until clean

**Added: Test Suite Maintenance prose section**
Full description of fix-tests with the 5-category system (valid-skip, adapt, isolate, real-bug, fixture), ddmin algorithm for pollution isolation, automatic dispatch of adapt/fixture/isolate failures, and resume support via /qgsd:resume-work.

**Modernized: Quorum setup section**
- Changed from step-by-step manual MCP registration to wizard-first approach
- `/qgsd:mcp-setup` is now the primary documented path
- Manual steps moved to a `<details>` block titled "Manual setup (advanced)"
- Manual steps updated to slot-based names matching v0.6:
  - `codex-cli` → `codex-cli-1`
  - `gemini-cli` → `gemini-cli-1` (package also updated from `@tuannvm/gemini-mcp-server`)
  - `opencode` → `opencode-1` (package also updated from `@tuannvm/opencode-mcp-server`)
  - `copilot-cli` → `copilot-1`
  - Added: `claude mcp add claude-1 -- npx -y claude-mcp-server`
- Added slot naming explanation: `<family>-<N>` scheme, enabling multiple instances per family

**Added: Quorum Composition subsection in Configuration**
- Documents `quorum_active` array in `qgsd.json`
- Explains auto-population at install time
- Documents wizard-based composition management
- Documents multi-slot support (claude-1/claude-2, copilot-1/copilot-2, etc.)

**Updated: debug command description**
- From: "Systematic debugging with persistent state"
- To: "Start a debugging session with persistent state: spawns quorum diagnosis on failure, tracks hypotheses across invocations, resumes where it left off"

## Gap Analysis Results

### Commands missing from README (pre-edit)

| Command | Shipped in | Status |
|---------|-----------|--------|
| `/qgsd:mcp-setup` | v0.5 | Added (MCP Management group + wizard-first setup section) |
| `/qgsd:mcp-status` | v0.4 | Added (MCP Management group) |
| `/qgsd:mcp-set-model` | v0.4 | Added (MCP Management group) |
| `/qgsd:mcp-update` | v0.4 | Added (MCP Management group) |
| `/qgsd:mcp-restart` | v0.4 | Added (MCP Management group) |
| `/qgsd:fix-tests` | v0.3 | Added (Test Maintenance group + prose section) |

### Feature sections missing from README (pre-edit)

| Feature | Shipped in | Status |
|---------|-----------|--------|
| MCP Management layer | v0.4 | Added new command group + prose via wizard-first setup |
| Test Suite Maintenance | v0.3 | Added prose section before Why It Works |
| Agent slot naming scheme | v0.6 | Added explanation in manual setup details block |
| quorum_active / multi-slot | v0.7 | Added Quorum Composition subsection in Configuration |

### Stale content fixed

| Item | Issue | Fix |
|------|-------|-----|
| Quorum setup section | Led with manual `claude mcp add` steps; old package names; old slot names | Wizard-first with manual as details block; updated package names; slot-based names |
| debug description | Generic placeholder text | Expanded with specific behavior |

## Verification Results

All checks passed after editing:

```
fix-tests count: 2      (requirement: >= 2)
mcp-setup count: 4      (requirement: >= 3)
quorum_active count: 2  (requirement: >= 1)
slot names count: 7     (requirement: >= 4)
```

All 38 commands in `commands/qgsd/` appear in README tables — zero missing.

## Deviations from Plan

None — plan executed exactly as written.

## Self-Check: PASSED

- README.md modified and committed (949de40)
- All verification grep checks passed
- All 38 commands verified present in README
