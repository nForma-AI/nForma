---
phase: 28-update-and-restart-commands
status: passed
verified: 2026-02-22
verifier: claude-sonnet-4-6
tests: 201
---

# Phase 28 Verification: Update & Restart Commands

## Summary

Phase 28 complete. Both slash commands created, installed, and verified. 201/201 tests passing. All 4 MGR requirements (MGR-03, MGR-04, MGR-05, MGR-06) satisfied.

## Must-Haves Verification

### Plan 28-01 (mcp-update)

| Must-Have | Verdict | Evidence |
|-----------|---------|----------|
| `/qgsd:mcp-update codex-cli` detects 'npx' and runs `npm install -g codex-mcp-server` | PASS | Step 3 node script: `command === 'npx'` → `{ type: 'npm', package: args[args.length-1] }`; Step 4 type=npm → `npm install -g "$PACKAGE"` |
| `/qgsd:mcp-update opencode` detects 'node' and runs `git pull + npm run build` | PASS | Step 3: `command === 'node'` → `{ type: 'local', repoDir: path.dirname(path.dirname(args[0])) }`; Step 4 type=local → `cd "$REPO_DIR" && git pull && npm run build` |
| `all` mode iterates 10 agents sequentially with deduplication | PASS | Step 6a builds `tasks[]` with `seenKeys` Set; Step 6b iterates sequentially, skips `deduplicated: true` entries with SKIPPED label |
| Unrecognized agent name prints clear error listing 10 valid agents | PASS | Step 2 validates against hardcoded list; prints error with all 10 agents in grid format |
| Agent not in `~/.claude.json` prints 'Agent X is not configured' | PASS | Step 3 node script: `process.exit(2)` with error message when `!serverConfig` |
| Successful npm update suggests `/qgsd:mcp-restart <agent>` | PASS | Step 5 confirmation always includes `Run: /qgsd:mcp-restart $TARGET   to load the new binary.` |
| Successful local repo update suggests `/qgsd:mcp-restart <agent>` | PASS | Same Step 5 confirmation block |
| Build failure prints error without killing running process | PASS | Step 4 type=local: `If exit code ≠ 0: print error output and stop.` + "Do NOT kill the running process if build fails." note |
| Installed to `~/.claude/commands/qgsd/mcp-update.md` | PASS | `diff commands/qgsd/mcp-update.md ~/.claude/commands/qgsd/mcp-update.md` → clean |

### Plan 28-02 (mcp-restart)

| Must-Have | Verdict | Evidence |
|-----------|---------|----------|
| `/qgsd:mcp-restart opencode` kills node processes matching argv[1] | PASS | Step 3: `command === 'node'` → `{ type: 'local', processPath: args[0] }`; Step 4 local: `pkill -f "$PROCESS_PATH"` |
| `/qgsd:mcp-restart codex-cli` kills npm exec + node child | PASS | Step 4 npx: `pkill -f "npm exec $PACKAGE_NAME"` then `pkill -f "$PACKAGE_NAME"` after 0.5s sleep |
| Unrecognized agent name prints clear error listing all 10 valid agents | PASS | Step 2 validates against hardcoded list; prints error with all 10 agents |
| Valid agent not in `~/.claude.json` prints 'Agent X is not configured' | PASS | Step 3 node script: `process.exit(2)` with clear message |
| After killing, waits 2 seconds then calls identity tool | PASS | Step 5: `sleep 2`; Step 6: calls `mcp__<$AGENT>__identity` |
| Identity success: prints 'Agent X restarted and responding' | PASS | Step 6 success branch prints name/version/model from identity response |
| Identity timeout/error: prints graceful fallback with mcp-status hint | PASS | Step 6 error branch prints 'Processes killed. Claude Code is reconnecting...' + 'Check status in a few seconds: /qgsd:mcp-status' |
| Installed to `~/.claude/commands/qgsd/mcp-restart.md` | PASS | `diff commands/qgsd/mcp-restart.md ~/.claude/commands/qgsd/mcp-restart.md` → clean |

## Constraint Verification

| Constraint | Verdict | Evidence |
|-----------|---------|----------|
| R2.1: mcp-update NOT in quorum_commands | PASS | `grep "mcp-update" hooks/config-loader.js` → empty |
| R2.1: mcp-restart NOT in quorum_commands | PASS | `grep "mcp-restart" hooks/config-loader.js` → empty |
| R3.2: identity verification sequential (not sibling) | PASS | Step 6 of mcp-restart: "one sequential call" — single identity tool call per restart |
| MGR-06: process kill + Claude Code auto-restart | PASS | No `claude mcp restart` exists; pkill approach matches confirmed mechanism from research |

## Test Results

```
201 tests, 201 passed, 0 failed
```

No regressions from Phase 28 additions (slash command MD files only — no hook or JS changes).

## Requirements Coverage

| Requirement | Status |
|-------------|--------|
| MGR-03: `/qgsd:mcp-update <agent>` auto-detects install method | Complete |
| MGR-04: detects npm/local and runs correct update command | Complete |
| MGR-05: `/qgsd:mcp-update all` with sequential + deduplication | Complete |
| MGR-06: `/qgsd:mcp-restart <agent>` terminates and reconnects | Complete |
