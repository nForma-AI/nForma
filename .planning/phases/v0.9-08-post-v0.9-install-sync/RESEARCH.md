# Phase v0.9-08: Post-v0.9 Install Sync — Research

**Researched:** 2026-02-26
**Domain:** Install sync / source-runtime drift
**Confidence:** HIGH — all findings are from direct file inspection

---

## Summary

Quick-110 added `model="haiku"` to all `qgsd-quorum-slot-worker` Task dispatch sites across four workflow files (`plan-phase.md`, `discuss-phase.md`, `execute-phase.md`, `quick.md`) and `commands/qgsd/quorum.md`. The research question was whether the installed runtime at `~/.claude/qgsd/workflows/` reflects these changes.

**Finding: NO DRIFT EXISTS.** The installed copies at `~/.claude/qgsd/workflows/` already contain the `model="haiku"` flag at every dispatch site. The install was already run post-quick-110 — installed file timestamps are `2026-02-26 19:47:58 UTC`, which is well after the quick-110 commits landed (`2026-02-26 11:39 UTC`). The only diff between source and installed copies is the expected path expansion (`~/.claude/` → `/Users/jonathanborduas/.claude/`) that the installer performs at install time.

**Primary recommendation:** This phase has no work to do regarding `model="haiku"` sync — the installed runtime is already up to date. The plan should focus on verifying this state cleanly and checking whether any other post-v0.9 changes remain unsynced.

---

## Research Question Answers

### Q1: Does `qgsd-core/workflows/plan-phase.md` contain `model="haiku"`? Where?

**YES.** Line 283:
```
- Dispatch all active slots as sibling `qgsd-quorum-slot-worker` Tasks with `model="haiku", max_turns=100` (one per slot)
```

This is in step 8.5 (Run QUORUM), the single quorum dispatch site in plan-phase.md. The `max_turns=100` was added by quick-111 (commit `cabec1a`, Feb 26 12:12 UTC).

### Q2: Does `qgsd-core/workflows/discuss-phase.md` contain `model="haiku"`? Where?

**YES.** Two sites:
- Line 208: R4 pre-filter quorum dispatch (step `r4_pre_filter`)
- Line 256: Second-pass quorum (step `present_gray_areas`)

Both read: `model="haiku", max_turns=100`

### Q3: Do the installed copies contain `model="haiku"`?

**YES — all installed copies already have the flag.**

Installed file check results:
```
/Users/jonathanborduas/.claude/qgsd/workflows/plan-phase.md:283:    model="haiku", max_turns=100
/Users/jonathanborduas/.claude/qgsd/workflows/discuss-phase.md:208:  model="haiku", max_turns=100
/Users/jonathanborduas/.claude/qgsd/workflows/discuss-phase.md:256:  model="haiku", max_turns=100
/Users/jonathanborduas/.claude/qgsd/workflows/execute-phase.md:405:  model="haiku", max_turns=100
/Users/jonathanborduas/.claude/qgsd/workflows/execute-phase.md:435:  model="haiku", max_turns=100
/Users/jonathanborduas/.claude/qgsd/workflows/quick.md:257:  model="haiku", max_turns=100
/Users/jonathanborduas/.claude/qgsd/workflows/quick.md:397:  model="haiku", max_turns=100
```

### Q4: What is the exact drift? Which files are in source but not in installed runtime?

**No functional drift exists.** The only differences between source and installed copies are the expected path substitutions performed by the installer's `copyWithPathReplacement()` function:

- `~/.claude/` → `/Users/jonathanborduas/.claude/` (for global install)
- `@~/.claude/qgsd/` → `@/Users/jonathanborduas/.claude/qgsd/` (in `@`-prefixed file references)

This is by design — the installer expands tilde paths to absolute paths at install time. The diff is cosmetic, not functional.

Cross-checked files (source vs installed — path expansion only):
- `plan-phase.md` — 15 path substitutions, content identical
- `discuss-phase.md` — 7 path substitutions, content identical
- `execute-phase.md` — content identical (path substitutions only)
- `quick.md` — content identical (path substitutions only)
- `fix-tests.md` — binary identical (no path differences detected)
- `map-codebase.md` — path substitutions only
- `audit-milestone.md` — path substitutions only

### Q5: What did quick-110 change exactly?

Commit `3d87c92` (Feb 26 11:39 UTC) — `feat(quick-110): add model="haiku" to all qgsd-quorum-slot-worker Task dispatches`:

| File | Dispatch Sites Updated |
|------|----------------------|
| `commands/qgsd/quorum.md` | 4 sites (Mode A R1, Mode A deliberation, Mode B R1, Mode B deliberation) |
| `qgsd-core/workflows/quick.md` | 2 sites (artifact review + human_needed resolution loop) |
| `qgsd-core/workflows/discuss-phase.md` | 2 sites (R4 pre-filter + second-pass) |
| `qgsd-core/workflows/execute-phase.md` | 2 sites (human_needed + gaps quorum) |
| `qgsd-core/workflows/plan-phase.md` | 1 site (plan review quorum at step 8.5) |

Commit `cabec1a` (Feb 26 12:12 UTC) — `feat(quick-111): add max_turns=100 to plan-phase.md quorum dispatch`:
- Updated step 8.5 in `plan-phase.md` to add `max_turns=100` to complete the canonical dispatch pattern.

Both quick-110 and quick-111 changes are present in both source and installed copies.

### Q6: What does the install sync command do?

`node bin/install.js --claude --global` runs the `install()` function which:

1. Copies `qgsd-core/` → `~/.claude/qgsd/` via `copyWithPathReplacement()`
2. Copies `commands/qgsd/` → `~/.claude/commands/qgsd/` via `copyWithPathReplacement()`
3. Copies `agents/` → `~/.claude/agents/` (with path replacement in .md files)
4. Path replacement: all `~/.claude/` occurrences → `/Users/jonathanborduas/.claude/` (absolute path for global install)
5. Clean install: removes destination directory first to prevent orphaned files

The `copyWithPathReplacement()` function at line 832 of `bin/install.js` handles the tilde expansion. This is the expected behavior — installed copies always differ from source by this path substitution.

### Q7: Any other workflow files that should contain `model="haiku"` but don't in installed copy?

**No gaps found.** The `model="haiku"` flag is present in every `qgsd-quorum-slot-worker` Task dispatch across both source and installed copies. The `commands/qgsd/quorum.md` (source) contains the flag at 4+ sites — this file installs to `~/.claude/commands/qgsd/quorum.md` which was verified to contain the flag.

No workflow file has a quorum dispatch site missing `model="haiku"` in either source or installed runtime.

---

## Install State Summary

| File | Source has `model="haiku"` | Installed has `model="haiku"` | Drift |
|------|---------------------------|-------------------------------|-------|
| `plan-phase.md` | YES (line 283, 1 site) | YES (line 283, 1 site) | None |
| `discuss-phase.md` | YES (lines 208, 256, 2 sites) | YES (lines 208, 256, 2 sites) | None |
| `execute-phase.md` | YES (lines 405, 435, 2 sites) | YES (lines 405, 435, 2 sites) | None |
| `quick.md` | YES (lines 257, 397, 2 sites) | YES (lines 257, 397, 2 sites) | None |
| `quorum.md` (commands/) | YES (multiple sites) | Installed to commands/qgsd/ | None |

**Installed file timestamps:** All workflow files show `2026-02-26 19:47:58 UTC` — the install was run AFTER quick-110 (11:39 UTC) and quick-111 (12:12 UTC) landed.

---

## Architecture Patterns

### Install Sync Flow

```
Source (qgsd-core/workflows/*.md)
    ↓  node bin/install.js --claude --global
Installed (~/.claude/qgsd/workflows/*.md)
    - copyWithPathReplacement() expands ~/.claude/ → absolute path
    - Clean install: removes old dest, copies fresh
    - Result: functionally identical, paths expanded
```

### What "drift" looks like vs what we found

Expected drift (if install not run):
- Source has `model="haiku"` but installed does NOT
- Installed file timestamps predate the source commit

Actual finding:
- BOTH have `model="haiku"` at all dispatch sites
- Installed timestamps (19:47) postdate quick-110 commits (11:39)

---

## Phase Scope Assessment

This phase was created to close a potential drift gap. Research confirms the gap does not exist. The plan for this phase should:

1. **Verify** the current install state matches source (confirm via grep/diff)
2. **Run** `node bin/install.js --claude --global` to re-sync (idempotent — safe to run even if already synced)
3. **Re-verify** post-install to confirm clean state
4. **Write SUMMARY.md** documenting the verification result

The phase is a verification/sync closure, not a bug fix. Running the install command is safe and idempotent.

---

## Common Pitfalls

### Pitfall 1: Treating path-expansion diffs as real drift
**What goes wrong:** `diff source installed` shows many lines differing on `~/.claude/` vs `/Users/jonathanborduas/.claude/` — mistakenly treated as content drift.
**Reality:** This is expected installer behavior (the `copyWithPathReplacement()` function). Only functional content differences matter.
**Prevention:** When diffing, normalize paths: `sed 's|/Users/jonathanborduas/.claude/|~/.claude/|g'` on installed copy before diff.

### Pitfall 2: Verifying the wrong installed path
**What goes wrong:** Checking `~/.claude/qgsd/workflows/` but install puts files at the absolute path `/Users/jonathanborduas/.claude/qgsd/workflows/`.
**Reality:** Both paths resolve to the same location on this system.
**Prevention:** Use absolute paths for verification checks.

---

## Sources

### Primary (HIGH confidence — direct file inspection)
- `/Users/jonathanborduas/code/QGSD/qgsd-core/workflows/plan-phase.md` — source, line 283
- `/Users/jonathanborduas/code/QGSD/qgsd-core/workflows/discuss-phase.md` — source, lines 208, 256
- `/Users/jonathanborduas/.claude/qgsd/workflows/plan-phase.md` — installed, line 283
- `/Users/jonathanborduas/.claude/qgsd/workflows/discuss-phase.md` — installed, lines 208, 256
- `git show 3d87c92` — quick-110 commit that added `model="haiku"`
- `git show cabec1a` — quick-111 commit that added `max_turns=100` to plan-phase.md
- `/Users/jonathanborduas/code/QGSD/bin/install.js` lines 825-877 — `copyWithPathReplacement()` function

---

## Metadata

**Confidence breakdown:**
- Install state: HIGH — verified by direct file inspection and git log
- Drift analysis: HIGH — verified with `diff` on all workflow files
- Install command behavior: HIGH — read from `bin/install.js` source

**Research date:** 2026-02-26
**Valid until:** N/A — snapshot finding, install state can change
