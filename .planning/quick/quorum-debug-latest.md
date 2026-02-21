# quorum-debug artifact
date: 2026-02-21T00:00:00Z
failure_context: i think qgsd is still interfering with the vanilla version (gsd) as it shows that there is an update for gsd, but there is none...
exit_code: 0 (symptom only — all 149 tests pass)

## consensus
root_cause: qgsd-check-update.js compares QGSD's version (0.1.0) against GSD's npm package (1.20.5) and writes update_available:true to the same shared cache file that gsd-statusline.js reads, causing vanilla GSD to falsely report an update.
next_step: inspect qgsd-check-update.js:13 — the hardcoded cache path gsd-update-check.json is the collision point; it should use qgsd-update-check.json

## worker responses
| Model    | Confidence   | Root Cause                                                            | Next Step                                                          |
|----------|-------------|------------------------------------------------------------------------|--------------------------------------------------------------------|
| Gemini   | HIGH        | Shared cache file + QGSD version (0.1.0) vs GSD npm (1.20.5)        | Inspect qgsd-check-update.js:13 cache path constant               |
| OpenCode | HIGH        | Same cache file collision — QGSD version mismatch causes false positive | Run qgsd-check-update.js and observe cache flip                   |
| Copilot  | HIGH        | Same cache file; QGSD version written instead of GSD version         | Inspect qgsd-check-update.js cache path + add logging             |
| Codex    | HIGH(proxy) | Shared cache path string — qgsd uses gsd-update-check.json           | Cross-reference path strings in both hook files                   |

## bundle
FAILURE CONTEXT: i think qgsd is still interfering with the vanilla version (gsd) as it shows that there is an update for gsd, but there is none...

EXIT CODE: 0 — symptom only (all 149 tests pass)

KEY FILES:
- ~/.claude/hooks/gsd-check-update.js   — reads ~/.claude/get-shit-done/VERSION → "1.20.5"
- ~/.claude/hooks/qgsd-check-update.js  — reads ~/.claude/qgsd/VERSION → "0.1.0"
- BOTH write to: ~/.claude/cache/gsd-update-check.json
- ~/.claude/hooks/gsd-statusline.js:71  — reads gsd-update-check.json and shows update banner

CONFIRMED DIAGNOSIS:
qgsd-check-update.js:13  const cacheFile = path.join(cacheDir, 'gsd-update-check.json')  ← shared path
qgsd-check-update.js:16  const projectVersionFile = path.join(cwd, '.claude', 'qgsd', 'VERSION')  ← reads 0.1.0
npm get-shit-done-cc latest = 1.20.5
0.1.0 !== 1.20.5 → update_available: true written to gsd-update-check.json → gsd-statusline shows notification
