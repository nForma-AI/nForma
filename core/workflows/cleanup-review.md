<purpose>

Review phase code for redundancy, dead code, and over-defensive patterns after successful verification. Produces a structured CLEANUP-REPORT.md with file:line references. This workflow is spawned by execute-phase.md after successful verification.

Model tier: worker (claude-haiku-4-5-20251001) -- cheap and fast informational review.

</purpose>

<required_reading>

1. Phase directory path (passed as context)
2. List of files modified in the phase (passed as context)
3. Phase name (passed as context)

</required_reading>

<process>

<step name="gather_files">

Receive the list of modified files from the spawning agent. If more than 20 files are provided, prioritize newly created files over modified files. Cap at 20 files maximum.

Read each file in the list using the Read tool. Skip files that no longer exist on disk.

</step>

<step name="scan_for_findings">

Scan each file for three categories of issues:

**1. Redundancy**
- Duplicate logic across files (same function or pattern reimplemented)
- Copy-pasted blocks with minor variations
- Multiple files implementing the same validation or transformation

**2. Dead Code**
- Unused exports (exported functions/constants with no callers within the modified set)
- Unreachable branches (conditions that can never be true given the logic flow)
- Functions defined but never called within the modified file set

**3. Over-Defensive Patterns**
- Unnecessary try/catch wrapping around operations that cannot throw (e.g., wrapping `process.exit(0)`)
- Triple-nested error handling where a single outer catch suffices
- Redundant null checks after guaranteed initialization (e.g., checking `x != null` immediately after `const x = new Foo()`)
- Catch blocks that silently swallow errors without logging

For each finding, record:
- **File path** (relative to project root)
- **Line number** (the specific line where the issue starts)
- **Category** (Redundancy, Dead Code, or Over-Defensive)
- **Description** (concise explanation of the issue)

</step>

<step name="write_report">

Write a structured markdown report to `{phase_dir}/CLEANUP-REPORT.md` using this format:

```markdown
# Cleanup Report: Phase {phase_name}

**Generated:** {ISO date}
**Model:** {model_id}
**Files reviewed:** {count}

## Findings

### Redundancy

| File | Line | Description |
|------|------|-------------|
| path/to/file.js | 45 | Description of redundancy |

### Dead Code

| File | Line | Description |
|------|------|-------------|
| path/to/file.js | 120 | Description of dead code |

### Over-Defensive Patterns

| File | Line | Description |
|------|------|-------------|
| path/to/file.js | 78 | Description of over-defensive pattern |

## Summary

- Redundancy: N findings
- Dead code: N findings
- Over-defensive: N findings
- **Total: N findings**
```

If a category has no findings, include the table header with no rows and note "None found" below the table.

</step>

<step name="report_result">

After writing the report, output a summary line:

```
Cleanup review complete: {total} findings across {file_count} files. Report: {phase_dir}/CLEANUP-REPORT.md
```

</step>

</process>

<error_handling>

This workflow is informational only. If any step fails:
- Log the error as a warning
- Continue with remaining files if possible
- If the report cannot be written, log: "Cleanup review skipped: {reason}"
- Do NOT fail the parent phase execution under any circumstances

</error_handling>

<success_criteria>

- [ ] All provided files (up to 20) read and scanned
- [ ] Three finding categories evaluated: redundancy, dead code, over-defensive patterns
- [ ] CLEANUP-REPORT.md written to phase directory with file:line references in table format
- [ ] Report includes summary counts for each category

</success_criteria>
