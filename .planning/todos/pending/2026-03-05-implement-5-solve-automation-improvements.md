---
created: 2026-03-05T18:02:42.935Z
title: Implement 5 solve automation improvements
area: tooling
files:
  - bin/formal-test-sync.cjs
  - bin/qgsd-solve.cjs
  - .planning/formal/acknowledged-false-positives.json
---

## Problem

The `/qgsd:solve` convergence loop has 5 friction points that slow down or block full autonomy:

1. **Stub path resolution failures**: F->T executors generate wrong relative paths (`../../../../hooks/`) from `.planning/formal/generated-stubs/`. Recipe sidecars have `source_file_hint` but executors ignore it and guess.

2. **30+ minute re-diagnostic**: `qgsd-solve.cjs --report-only` runs full formal verification (TLC MCinstaller ~30 min) even when only file-parsing layers changed.

3. **Executor thinking overhead**: Most stubs follow 3 patterns (source-grep, import-and-call, config-validate) but executors independently rediscover this every batch.

4. **411 D->C false positives**: Doc scanner matches prose words like "claude-1", "date", "mode" as npm dependencies.

5. **60 reverse discovery candidates needing human review**: Category B (descriptive prose) candidates are clearly not requirements but still require manual acknowledgment.

## Solution

Run as `/qgsd:quick --full` with 5 tasks:

1. **Recipe absolute paths**: In `bin/formal-test-sync.cjs`, emit absolute resolved paths and a `require_snippet` field in `.stub.recipe.json` sidecars. Executors paste directly instead of computing relative paths.

2. **`--fast` mode for qgsd-solve.cjs**: Add flag that skips F->C (formal verification) and T->C (test execution) layers. Only computes file-parsing layers (R->F, F->T, C->F, R->D, D->C) for sub-second iteration. Slow layers run as final validation pass.

3. **Test template types in recipes**: Add `"template": "source-grep" | "import-and-call" | "config-validate"` to recipe JSON with pre-filled boilerplate. Cuts executor thinking from ~4 min to ~30 sec per batch.

4. **D->C false-positive suppression**: Create `.planning/formal/acknowledged-false-positives.json` with pattern-based suppression rules (e.g., `{"doc_file": "README.md", "type": "dependency", "pattern": "claude-*"}`). Apply in `qgsd-solve.cjs` D->C scanner.

5. **Auto-acknowledge Category B reverse candidates**: In the reverse discovery assembler, auto-write Category B candidates (suggestion: "acknowledge") to `acknowledged-not-required.json` without human prompt. Only surface A and C categories for review.
