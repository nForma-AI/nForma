---
name: nf:map-requirements
description: Map current and archived milestone requirements into .planning/formal/requirements.json
argument-hint: [--dry-run] [--skip-archive] [--skip-validate]
allowed-tools:
  - Read
  - Bash
---
<objective>
Run the requirements mapping pipeline — merges current `.planning/REQUIREMENTS.md` with archived milestone requirements into `.planning/formal/requirements.json`. Shows a summary of requirement counts by source.
</objective>

<execution_context>
@~/.claude/nf/workflows/map-requirements.md
</execution_context>

<process>
Execute the map-requirements workflow from @~/.claude/nf/workflows/map-requirements.md end-to-end.
Pass through --dry-run and --skip-archive flags from arguments.
</process>

<validation>
## Post-Mapping Semantic Validation

After the mapping pipeline completes (unless `--skip-validate` is passed), run semantic validation on the resulting requirements.json:

```bash
node bin/validate-requirements-haiku.cjs --json 2>/dev/null || true
```

This uses Claude Haiku to semantically validate requirement entries — checking for duplicates, ambiguous language, missing acceptance criteria, and inconsistent categorization. The validator reads from `.planning/formal/requirements.json` (the output of the mapping pipeline).

If findings are returned, display a summary:
```
Semantic validation: {total} requirements checked, {issues} issues found
  - {duplicates} potential duplicates
  - {ambiguous} ambiguous requirements
  - {missing_ac} missing acceptance criteria
```

If the script is not found or fails, skip silently (fail-open). The `--skip-validate` flag in the command arguments should bypass this step entirely.
</validation>
