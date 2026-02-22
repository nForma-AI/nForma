---
plan: 23-02
phase: 23-mcp-repo-surface-fixes
status: complete
completed: 2026-02-22
requirements_closed:
  - STD-05
  - STD-06
  - STD-10
---

# Plan 23-02 Summary: package.json metadata + LICENSE files

## What Was Built

Closed STD-05 (OSI MIT licenses), STD-06 (Gen1 npm metadata), and STD-10 (unscoped npm names).

## Key Changes

### STD-06: Gen1 package.json metadata (claude, codex, copilot)
All 3 repos received:
- `engines: { node: ">=18.0.0" }`
- `publishConfig: { access: "public" }`
- `scripts.prepublishOnly: "npm run build"`
- `license: "MIT"` (was "ISC")
- `author: "tuannvm"` (was "")

### STD-10: gemini-mcp-server unscoping
- `package.json` name: `@tuannvm/gemini-mcp-server` → `gemini-mcp-server`
- `package-lock.json` regenerated via `npm install`

### STD-05: OSI MIT LICENSE files
All 6 repos now have standard OSI MIT license text (no non-commercial restriction):
- claude-mcp-server/LICENSE (created)
- codex-mcp-server/LICENSE (created)
- copilot-mcp-server/LICENSE (created)
- gemini-mcp-server/LICENSE (replaced non-commercial text)
- opencode-mcp-server/LICENSE (replaced non-commercial text)
- openhands-mcp-server/LICENSE (created)

## Self-Check

### Verification Results
1. All 6 `grep -c "Permission is hereby granted"` return 1
2. `grep -r "Non-Commercial"` across all 6 LICENSE files → ZERO results
3. `grep '@tuannvm' gemini/package.json` → ZERO results
4. `grep '"name"' gemini/package-lock.json | head -1` → `"gemini-mcp-server"`
5. claude/codex/copilot all have `engines`, `publishConfig`, `prepublishOnly`, `"MIT"`, `"tuannvm"`

### Status: PASSED

## Key Files Created/Modified
- `/Users/jonathanborduas/code/claude-mcp-server/package.json`
- `/Users/jonathanborduas/code/codex-mcp-server/package.json`
- `/Users/jonathanborduas/code/copilot-mcp-server/package.json`
- `/Users/jonathanborduas/code/gemini-mcp-server/package.json`
- `/Users/jonathanborduas/code/gemini-mcp-server/package-lock.json`
- `/Users/jonathanborduas/code/claude-mcp-server/LICENSE` (created)
- `/Users/jonathanborduas/code/codex-mcp-server/LICENSE` (created)
- `/Users/jonathanborduas/code/copilot-mcp-server/LICENSE` (created)
- `/Users/jonathanborduas/code/gemini-mcp-server/LICENSE` (replaced)
- `/Users/jonathanborduas/code/opencode-mcp-server/LICENSE` (replaced)
- `/Users/jonathanborduas/code/openhands-mcp-server/LICENSE` (created)

## Deviations
None.
