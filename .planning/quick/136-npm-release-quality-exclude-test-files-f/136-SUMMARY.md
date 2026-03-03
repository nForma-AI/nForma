---
phase: quick-136
plan: 01
status: verified
commit: aabcab2a
date: 2026-03-03
verification: passed (7/7)
---

# Quick Task 136: npm Release Quality

## What Changed

1. **.npmignore** — Expanded from 1 pattern (`**/*.bak`) to comprehensive exclusions: test files (`**/*.test.*`), dev-only scripts, `.formal/`, `.planning/`, `.agents/`
2. **package.json** — Added `!**/*.test.*` negation in `files` array (defense-in-depth), author → "nForma AI", removed stale `get-shit-done-cc` peerDependency
3. **README.md** — Fixed npm badge URLs from unscoped `qgsd` to `@nforma.ai/qgsd`
4. **package-lock.json** — Regenerated to clear `@langblaze.ai` scope references

## Results

| Metric | Before | After |
|--------|--------|-------|
| Test files in tarball | 87 | 0 |
| Total files | 258 | 169 |
| Package size | 606.7 kB | 453.1 kB |
| Scope in lockfile | @langblaze.ai | @nforma.ai |

## Quorum Review

3/3 APPROVE (gemini-1, codex-1, opencode-1). Advisory notes: redundant .npmignore patterns are harmless defense-in-depth; `.formal/` exclusion is technically redundant given `files` allowlist.

## Verification

7/7 must-haves verified. See 136-VERIFICATION.md.
