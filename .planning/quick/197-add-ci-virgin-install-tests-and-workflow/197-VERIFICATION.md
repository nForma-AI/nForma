---
phase: quick-197
verified: 2026-03-06T12:00:00Z
status: passed
score: 6/6 must-haves verified
formal_check:
  passed: 0
  failed: 0
  skipped: 0
  counterexamples: []
---

# Quick Task 197: CI Virgin Install Tests Verification Report

**Task Goal:** Add CI virgin install tests and workflow for all 3 runtimes (Claude, OpenCode, Gemini) with multi-OS multi-Node matrix
**Verified:** 2026-03-06
**Status:** passed

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Virgin install for Claude runtime produces correct file layout in temp dir | VERIFIED | 9 layout tests pass: nf/, VERSION, nf-bin/, hooks/, agents/, nf.json, settings.json, package.json, commands/nf/ |
| 2 | Virgin install for OpenCode runtime produces correct file layout with flat command/ structure | VERIFIED | 7 layout tests pass including command/ with nf-*.md flat structure check |
| 3 | Virgin install for Gemini runtime produces correct file layout | VERIFIED | 8 layout tests pass including commands/nf/ with .toml files |
| 4 | Content adaptation is verified per runtime (OpenCode frontmatter, Gemini agent conversion, hook config dir) | VERIFIED | Claude checks '.claude' in config-loader, OpenCode checks '.config','opencode' + /nf- prefix conversions + agent tool name conversions, Gemini checks '.gemini' in config-loader |
| 5 | CI workflow runs install tests on ubuntu + macOS with Node 18, 20, 22 | VERIFIED | ci-install.yml matrix: os=[ubuntu-latest,macos-latest] x node=[18,20,22] = 6 combos, fail-fast:false, path-filtered |
| 6 | Idempotent re-install produces identical layout (OverridesPreserved invariant) | VERIFIED | Each runtime has idempotency test: re-runs install, asserts file count and VERSION unchanged |

**Score:** 6/6 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `test/install-virgin.test.cjs` | Virgin install integration tests (min 150 lines) | VERIFIED | 401 lines, 32 tests across 3 suites, all passing |
| `.github/workflows/ci-install.yml` | GitHub Actions workflow with matrix | VERIFIED | 53 lines, contains matrix with 2 OS x 3 Node versions |
| `Dockerfile.test-install` | Rebranded (no QGSD refs) | VERIFIED | 0 QGSD references, uses nForma branding |
| `package.json` | test:install script | VERIFIED | `"test:install": "node --test test/install-virgin.test.cjs"` |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `test/install-virgin.test.cjs` | `bin/install.js` | execFileSync with --config-dir | WIRED | Line 64-68: `execFileSync(process.execPath, [INSTALL_SCRIPT, '--${runtime}', '--global', '--config-dir', tmpDir])` |
| `.github/workflows/ci-install.yml` | `test/install-virgin.test.cjs` | node --test | WIRED | Line 52: `run: node --test test/install-virgin.test.cjs` |

### Test Execution Results

```
tests 32
suites 3
pass 32
fail 0
cancelled 0
skipped 0
duration_ms 1656
```

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| None | - | - | - | - |

No anti-patterns detected. The `return null` in `readIfExists` helper (line 39) is legitimate error-handling logic.

### Formal Verification

**Status: TOOLING ABSENT (SKIP)**
Module not recognized -- no executable spec exists for installer module. The OverridesPreserved invariant from `formal/spec/installer/invariants.md` is tested behaviorally via the idempotency tests in all 3 runtime suites.

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-----------|-------------|--------|----------|
| CI-INSTALL-01 | 197-PLAN.md | CI virgin install test coverage | SATISFIED | Full test suite + CI workflow created |

### Human Verification Required

None. All checks are automated and pass programmatically.

---

_Verified: 2026-03-06_
_Verifier: Claude (nf-verifier)_
