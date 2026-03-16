---
status: complete
completed: 2026-02-27
commits: [c9a6e84a, 90803a1a]
---

# Quick-315: Fix allDown Short-Circuit for T2 Promotion

Fixed via `fix(fallback)` commits that made T1/T2 classification dynamic (auth_type at runtime, not slot names) and excluded primary slots from T2 list. The allDown logic in `hooks/nf-prompt.js` now correctly falls through to T2 api-type slots when sub-type primaries fail preflight.
