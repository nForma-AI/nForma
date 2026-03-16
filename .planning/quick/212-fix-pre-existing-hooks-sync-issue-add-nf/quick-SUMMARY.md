---
status: complete
completed: 2026-03-07
commit: 02ed5266
---

# Quick-212: Fix Pre-Existing Hooks Sync Issue

Added `nf-post-edit-format.js` and `nf-console-guard.js` to HOOKS_TO_COPY in installer, fixing hooks that were missing from dist sync.
