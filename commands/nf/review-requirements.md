---
name: nf:review-requirements
description: Review all requirements for quality — flags specificity issues, redundant overlaps, unmeasurable requirements, and merge candidates
argument-hint: [--repair] [--dry-run] [--category="Category Name"] [--ids=REQ-01,REQ-02]
allowed-tools:
  - Read
  - Write
  - Edit
  - Bash
  - Agent
  - AskUserQuestion
---

<objective>
Scan all requirements in `.planning/formal/requirements.json` for quality issues:
specificity (too narrow), redundancy (overlaps/duplicates), and measurability (vague/untestable).
Proposes and optionally applies fixes.
</objective>

<execution_context>
@~/.claude/nf/workflows/review-requirements.md
</execution_context>

<process>
Execute the review-requirements workflow from @~/.claude/nf/workflows/review-requirements.md end-to-end.
Pass through all --flags from arguments:
  --repair        Fully autonomous mode — auto-apply safe fixes, skip prompts
  --dry-run       Show proposed changes without writing
  --category      Focus on a specific category
  --ids           Focus on specific requirement IDs
</process>
