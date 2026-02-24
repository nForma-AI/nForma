---
phase: quick-96
plan: 01
subsystem: bin/manage-agents
tags: [refactor, testing, pure-functions, node-test]
dependency_graph:
  requires: []
  provides: [manage-agents._pure, manage-agents.test]
  affects: [bin/manage-agents.cjs]
tech_stack:
  added: []
  patterns: [pure-function-export-via-_pure, node-test-with-plain-mocks]
key_files:
  created:
    - bin/manage-agents.test.cjs
  modified:
    - bin/manage-agents.cjs
decisions:
  - "_pure export block appended after existing module.exports to avoid any risk of breaking existing imports"
  - "buildKeyStatus uses Unicode checkmark (U+2713) to match the existing inline code in editAgent()"
  - "applyKeyUpdate is synchronous with fire-and-forget keytar calls, matching the editAgent() pattern exactly"
metrics:
  duration: "~1 min"
  completed: "2026-02-24"
  tasks_completed: 2
  files_modified: 2
---

# Phase quick-96 Plan 01: Refactor manage-agents.cjs to extract pure logic functions and add node:test suite — Summary

**One-liner:** Extracted six deterministic functions from manage-agents.cjs into a `module.exports._pure` block and added a 26-case node:test suite covering all of them.

## What Was Done

### Task 1: Extract pure functions and export via _pure

Added a clearly demarcated `// Pure functions` section at the bottom of `bin/manage-agents.cjs` with six standalone named functions, then appended `module.exports._pure = { ... }` after the existing `module.exports` line.

**Functions extracted:**

| Function | Description |
|---|---|
| `deriveKeytarAccount(slotName)` | Converts slot name to keytar account string (`ANTHROPIC_API_KEY_<UPPER_SLUG>`) |
| `maskKey(key)` | Already defined at line 158; included in _pure by reference |
| `buildKeyStatus(authType, slotName, secretsLib)` | Returns ANSI-tagged display string for sub/api/unknown auth |
| `buildAgentChoiceLabel(name, cfg, providerMap, agentCfg, secretsLib)` | Returns padded label string for inquirer agent selector |
| `applyKeyUpdate(updates, keytarAccount, newEnv, secretsLib)` | Mutates newEnv for set/remove/keep and fires keytar calls |
| `applyCcrProviderUpdate(subAction, selectedKey, keyValue, secretsLib)` | Async: calls secretsLib.set or secretsLib.delete for CCR keys |

The existing `module.exports = { readClaudeJson, writeClaudeJson, getGlobalMcpServers, mainMenu }` line and all inquirer-coupled function bodies remain completely unchanged.

### Task 2: Write node:test suite

Created `bin/manage-agents.test.cjs` using `node:test` and `node:assert/strict` with plain object mocks for secretsLib.

**Test results:** 26/26 pass, 0 fail, 0 skip, exit 0.

| Function | Cases |
|---|---|
| `deriveKeytarAccount` | 4 |
| `maskKey` | 5 |
| `buildKeyStatus` | 4 |
| `buildAgentChoiceLabel` | 4 |
| `applyKeyUpdate` | 5 |
| `applyCcrProviderUpdate` | 4 |
| **Total** | **26** |

## Deviations from Plan

None — plan executed exactly as written.

## Verification

1. `node -e "const {_pure:p} = require('./bin/manage-agents.cjs'); console.log(Object.keys(p))"` — lists all 6 function names.
2. `node --test bin/manage-agents.test.cjs` — exits 0, all 26 tests pass.
3. `grep -c 'module.exports._pure' bin/manage-agents.cjs` — returns 1.
4. `grep 'module.exports = ' bin/manage-agents.cjs` — original export line unchanged.

## Commits

| Task | Hash | Message |
|---|---|---|
| Task 1 | `608ef6b` | feat(quick-96): extract pure functions and export via _pure |
| Task 2 | `114de1f` | test(quick-96): add node:test suite for manage-agents pure functions |

## Self-Check: PASSED

- `/Users/jonathanborduas/code/QGSD/bin/manage-agents.cjs` — FOUND, _pure block present
- `/Users/jonathanborduas/code/QGSD/bin/manage-agents.test.cjs` — FOUND, 26 tests pass
- Commit `608ef6b` — FOUND
- Commit `114de1f` — FOUND
