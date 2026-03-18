---
phase: quick-325
plan: "01"
subsystem: formal-scope-scan
tags: [semantic-search, sentence-transformers, agentic-search, formal-verification]
dependency_graph:
  requires: [bin/formal-scope-scan.cjs, package.json]
  provides: [runSemanticLayer, runAgenticLayer, cosineSim, resolveClaudeCLI]
  affects: [bin/formal-scope-scan.cjs, test/formal-scope-scan-semantic.test.cjs]
tech_stack:
  added: ["@huggingface/transformers@^3.0.0 (optional)"]
  patterns: ["dynamic ESM import in CJS async function", "claudeBin injection for test isolation", "graceful-degradation on missing optional dep"]
key_files:
  created: [test/formal-scope-scan-semantic.test.cjs]
  modified: [bin/formal-scope-scan.cjs, package.json, package-lock.json]
decisions:
  - "Used dynamic import('@huggingface/transformers') inside async try/catch — CJS file supports ESM dynamic import in async context"
  - "claudeBin injection parameter on runAgenticLayer avoids PATH tricks for test isolation"
  - "Layer 3 threshold default 0.35, tunable via --l3-threshold flag"
  - "Layer 4 disabled by default (--l4 opt-in) due to slow/expensive claude CLI spawning"
metrics:
  duration: "~8 minutes"
  completed: "2026-03-18T22:24:27Z"
  tasks: 3
  files: 4
---

# Phase quick-325 Plan 01: Add Layer 3+4 to formal-scope-scan Summary

**One-liner:** Sentence-transformer semantic fallback (Layer 3) and claude CLI agentic fallback (Layer 4) added to formal-scope-scan.cjs with graceful degradation when optional dependencies are absent.

## Tasks Completed

| # | Task | Commit | Status |
|---|------|--------|--------|
| 0 | Add @huggingface/transformers to optionalDependencies | c10aee30 | Complete |
| 1 | Add Layer 3 (semantic) and Layer 4 (agentic) to formal-scope-scan.cjs | b2889088 | Complete |
| 2 | Write tests for Layer 3 and Layer 4 behavior | 0a46f354 | Complete |

## What Was Built

### Layer 3: Semantic Similarity (`runSemanticLayer`)
- Uses `@huggingface/transformers` (Xenova/all-MiniLM-L6-v2) via dynamic ESM import in async function
- Computes cosine similarity between query embedding and module concept text embeddings
- Threshold: 0.35 default, tunable via `--l3-threshold`
- Disabled via `--no-l3`; triggers only when layers 1+2 return 0 matches
- Returns items with `matched_by: "semantic"` and `similarity_score`
- Graceful fallback: missing package writes stderr warning and returns []

### Layer 4: Agentic Search (`runAgenticLayer`)
- Spawns claude CLI via `execFileSync` with `-p` prompt and `--output-format json`
- Enumerates available modules from spec dir; passes list to claude as hallucination guard
- Opt-in via `--l4` flag; triggers only when layers 1+2+3 return 0 matches
- Returns items with `matched_by: "agentic"`
- Graceful fallback: missing binary (ENOENT) or timeout writes stderr warning and returns []
- `claudeBin` injection parameter enables test isolation without PATH tricks

### Helpers Added
- `cosineSim(a, b)` — dot product on L2-normalized vectors
- `resolveClaudeCLI()` — resolves versioned claude binary from ~/.local/share/claude/versions/

### Integration
- `main()` converted to `async function`; called with `.catch(e => { console.error(e); process.exit(1); })`
- Both layers integrated with correct fallback conditions in main()
- All 4 new symbols added to `module.exports`
- Help text updated with `--l3-threshold`, `--no-l3`, `--l4` flags and layer descriptions

## Tests

File: `test/formal-scope-scan-semantic.test.cjs` — 9 tests, all pass

| Test | Result |
|------|--------|
| cosineSim identical unit vectors = 1 | pass |
| cosineSim orthogonal = 0 | pass |
| cosineSim general [0.6,0.8]·[0.8,0.6] = 0.96 | pass |
| --no-l3 returns [] with no match | pass |
| runAgenticLayer returns [] when binary missing (injection) | pass |
| runAgenticLayer returns [] when specDir missing | pass |
| Layer 4 graceful fallback (injection) | pass |
| runSemanticLayer semantic match at threshold 0.1 (integration) | pass |
| Layers 1+2 regression after async main() | pass |

## Deviations from Plan

None — plan executed exactly as written.

## Self-Check

- [x] `bin/formal-scope-scan.cjs` modified with Layer 3+4 functions
- [x] `test/formal-scope-scan-semantic.test.cjs` created
- [x] `package.json` has `optionalDependencies["@huggingface/transformers"] = "^3.0.0"`
- [x] `package-lock.json` includes @huggingface/transformers entry
- [x] All exports present: cosineSim, resolveClaudeCLI, runSemanticLayer, runAgenticLayer
- [x] Commits: c10aee30, b2889088, 0a46f354
- [x] 9/9 tests pass
