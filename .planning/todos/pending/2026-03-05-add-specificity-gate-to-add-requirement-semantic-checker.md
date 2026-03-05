---
created: 2026-03-05T21:23:20.233Z
title: Add specificity gate to add-requirement semantic checker
area: tooling
files:
  - commands/qgsd/add-requirement.md
  - .planning/formal/requirements.json
---

## Problem

The `/qgsd:add-requirement` semantic conflict checker currently detects duplicate IDs and semantic conflicts between requirements, but it does not flag requirements that are **too specific** — targeting a single instance (page A, file X, module Y) when a generalized requirement would cover the same constraint more broadly.

Example of overly specific:
- "bin/account-manager.cjs SHALL have @requirement annotations"

Should be generalized to:
- "All bin/ utility modules SHALL include @requirement annotations"

This was identified during `/qgsd:solve` reverse discovery (iteration 1), where 77 individual candidates were manually generalized into 5 broad requirements. Without the specificity gate, the add-requirement workflow would have created 77 narrow requirements instead.

Measurable/quantitative requirements (e.g., "page response time under 1s") are fine — the gate should only flag when the constraint applies universally but the requirement narrows it to one instance.

## Solution

Add a "specificity gate" step to the add-requirement workflow (between duplicate check and semantic conflict check):

1. **Pattern detection**: Check if the requirement text references a specific file, module, page, or component by name when the constraint is universal (e.g., "SHALL have annotations", "MUST respond under Xs")
2. **Generalization suggestion**: If flagged, propose a generalized form (replace specific name with "all X modules", "all pages", etc.)
3. **User choice**: Present original vs generalized via AskUserQuestion — user can keep specific, accept generalized, or edit
4. **Haiku classifier**: Use Haiku to classify whether a requirement is instance-specific vs. already generalized, since pattern matching alone won't catch all cases
