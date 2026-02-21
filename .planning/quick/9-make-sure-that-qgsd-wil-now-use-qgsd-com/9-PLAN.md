---
task: "make sure that qgsd wil now use qgsd commands, and not gsd"
date: 2026-02-21
mode: quick-full

must_haves:
  truths:
    - The 5 active policy docs (REQUIREMENTS.md, STATE.md, PROJECT.md, 01-05-PLAN.md, quorum todo) use /qgsd: prefix, not /gsd:
    - Historical records (CHANGELOG.md), backward-compat hook comments, research/ docs, codebase/ docs, and milestone audit are left unchanged (they describe the old GSD system or backward compat, not current user-facing commands)
    - Hook code intentionally supports both /gsd: and /qgsd: prefixes — those comments are correct as-is
  artifacts:
    - .planning/REQUIREMENTS.md (STOP-08 message template updated)
    - .planning/STATE.md (two decision lines updated)
    - .planning/PROJECT.md (key decisions table updated)
    - .planning/phases/01-hook-enforcement/01-05-PLAN.md (integration test descriptions updated)
    - .planning/todos/pending/2026-02-20-add-gsd-quorum-command-for-consensus-answers.md (title + solution updated)
  key_links:
    - .planning/REQUIREMENTS.md:19
    - .planning/STATE.md:71-72
    - .planning/PROJECT.md:85
    - .planning/phases/01-hook-enforcement/01-05-PLAN.md:14-17,120,124,135,144
    - .planning/todos/pending/2026-02-20-add-gsd-quorum-command-for-consensus-answers.md:3,16
---

## Task 1 — Update active planning docs: /gsd: → /qgsd:

**Goal:** Replace remaining `/gsd:` command references in active policy and planning documentation with `/qgsd:`.

**Scope:** 5 files. CHANGELOG.md and hook code comments are explicitly excluded.

files:
  - .planning/REQUIREMENTS.md
  - .planning/STATE.md
  - .planning/PROJECT.md
  - .planning/phases/01-hook-enforcement/01-05-PLAN.md
  - .planning/todos/pending/2026-02-20-add-gsd-quorum-command-for-consensus-answers.md

action: |
  1. .planning/REQUIREMENTS.md line 19:
     OLD: "QUORUM REQUIRED: Before completing this /gsd:[command] response..."
     NEW: "QUORUM REQUIRED: Before completing this /qgsd:[command] response..."

  2. .planning/STATE.md line 71:
     OLD: Anchored regex ^\\s*\\/gsd:(cmd)(\\s|$) with mandatory /gsd: prefix matches stop hook pattern exactly
     NEW: Anchored regex ^\\s*\\/qgsd:(cmd)(\\s|$) with mandatory /qgsd: prefix matches stop hook pattern exactly

  3. .planning/STATE.md line 72:
     OLD: discuss-phase question auto-resolution is satisfied structurally — /gsd:discuss-phase is in the QGSD hook allowlist
     NEW: discuss-phase question auto-resolution is satisfied structurally — /qgsd:discuss-phase is in the QGSD hook allowlist

  4. .planning/PROJECT.md line 85:
     OLD: All /gsd:* is too broad (execute-phase doesn't need quorum)
     NEW: All /qgsd:* is too broad (execute-phase doesn't need quorum)

  5. .planning/phases/01-hook-enforcement/01-05-PLAN.md lines 14-17, 120, 124, 135, 144:
     Replace all /gsd:plan-phase → /qgsd:plan-phase
     Replace all /gsd:execute-phase → /qgsd:execute-phase

  6. .planning/todos/pending/2026-02-20-add-gsd-quorum-command-for-consensus-answers.md:
     - Frontmatter title: "Add gsd:quorum command for consensus answers" → "Add qgsd:quorum command for consensus answers"
     - Line 16: "Create /gsd:quorum command" → "Create /qgsd:quorum command"

verify: |
  # Verify the 5 targeted files no longer contain /gsd: references
  # (research/, codebase/, quick/9-, v0.1-MILESTONE-AUDIT, and other todos are intentionally excluded)
  grep -r "/gsd:" .planning/ --include="*.md" \
    | grep -v "CHANGELOG" \
    | grep -v "quick/1-rebrand" \
    | grep -v "quick/9-" \
    | grep -v "research/" \
    | grep -v "codebase/" \
    | grep -v "v0.1-MILESTONE-AUDIT" \
    | grep -v "narrow-stop-hook" \
    | grep -v "quick/3-" \
    | grep -v "quick/8-" \
    | grep -v "qgsd:" \
    | grep "/gsd:"
  (should return empty — no remaining /gsd: references in the 5 targeted active policy docs)

done: All 5 files updated with /qgsd: prefix; scoped grep confirms no remaining /gsd: in the 5 targeted policy docs (research/ and codebase/ intentionally preserved)
