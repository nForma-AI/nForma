---
name: close-formal-gaps
description: Analyze and close formal model coverage gaps — clusters uncovered requirements, selects formalism (TLA+/Alloy/PRISM/Petri), generates specs, runs checkers, and updates the model registry
allowed_tools:
  - Read
  - Write
  - Edit
  - Bash
  - Glob
  - Grep
  - Agent
  - AskUserQuestion
execution_context: workflow
---

<objective>
Close formal model coverage gaps by generating new formal specifications for uncovered requirements.
</objective>

<execution_context>
@/Users/jonathanborduas/.claude/qgsd/workflows/close-formal-gaps.md
</execution_context>

<process>
Execute the close-formal-gaps workflow from @/Users/jonathanborduas/.claude/qgsd/workflows/close-formal-gaps.md end-to-end.
Pass through all --flags from arguments:
  --category="Category Name"  Focus on a specific category
  --ids=REQ-01,REQ-02         Focus on specific requirement IDs
  --all                       Process all uncovered requirements
  --formalism=tla|alloy|prism|petri  Override formalism selection
  --dry-run                   Show what would be generated without writing
</process>
