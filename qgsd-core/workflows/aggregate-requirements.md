<purpose>
Run the requirements aggregation pipeline. Merges current `.planning/REQUIREMENTS.md` with all archived milestone requirements (`.planning/milestones/v*-REQUIREMENTS.md`) into `formal/requirements.json`. Writes by default — if the envelope is frozen, automatically unfreezes, aggregates, validates with Haiku subagent, and re-freezes.
</purpose>

<process>

<step name="parse_args">
**Parse arguments:**

```
SKIP_ARCHIVE=""
DRY_RUN=""
SKIP_VALIDATE=""
if arguments contain "--dry-run"; then
  DRY_RUN="--dry-run"
fi
if arguments contain "--skip-archive"; then
  SKIP_ARCHIVE="--skip-archive"
fi
if arguments contain "--skip-validate"; then
  SKIP_VALIDATE="true"
fi
```
</step>

<step name="check_freeze">
**Handle frozen envelope (write mode only):**

If NOT dry-run:
1. Read `formal/requirements.json` and check `frozen_at`
2. If frozen, temporarily set `frozen_at` to `null` and write back
3. Continue to aggregation step
</step>

<step name="run_aggregation">
**Run aggregation:**

```bash
node bin/aggregate-requirements.cjs $DRY_RUN $SKIP_ARCHIVE
```

Note: Run from the QGSD project root directory.
</step>

<step name="haiku_validate">
**Haiku semantic review (write mode only, unless --skip-validate):**

After aggregation writes the envelope, spawn a Haiku subagent to review for quality issues.

Use the **Agent tool** with these parameters:
- `subagent_type`: `"general-purpose"`
- `model`: `"haiku"`
- `description`: `"Validate requirements envelope"`
- `prompt`: The prompt below

```
You are reviewing a requirements envelope for quality issues. Your job is to find real problems, not surface-level wording differences.

## Step 1: Read the envelope

Read `formal/requirements.json`. Note each requirement's `id`, `text`, `category`, and `provenance.source_file`.

## Step 2: Identify candidates

Scan all requirements for potential issues in three categories:

1. DUPLICATES: Different IDs where the INTENT is identical (not just similar wording).
   NOT duplicates: requirements that evolved the same concept across milestones — evolution is expected.

2. CONTRADICTIONS: Two requirements that CANNOT BOTH be satisfied simultaneously.

3. AMBIGUITY: A single requirement with two or more INCOMPATIBLE interpretations.

## Step 3: Investigate context (CRITICAL)

For EVERY candidate issue you identify, you MUST:
1. Look at the `provenance.source_file` for each involved requirement
2. Read the original milestone file (e.g., `.planning/milestones/v0.2-REQUIREMENTS.md`)
3. Read the FULL section around the requirement — the category header, neighboring requirements, and any "Out of Scope" section
4. With this context, determine if the issue is REAL or if the broader context resolves the apparent conflict

Only report findings that survive this contextual investigation. If the original milestone context clarifies that two requirements are compatible, DROP the finding.

## Step 4: Report

For each CONFIRMED finding (that survived contextual investigation), report:
- Type (duplicate/contradiction/ambiguity)
- Requirement IDs involved
- Their source milestones
- Brief description of the issue
- What the original context says (quote the relevant surrounding text)
- Why the issue persists despite the context
- Severity (high/medium/low)
- Suggested resolution

End with a summary line: "N duplicates, N contradictions, N ambiguities found"
If no issues survive investigation: "No issues found — all candidates resolved by milestone context"
```

Display the Haiku agent's findings to the user. If high-severity findings exist, warn before re-freezing.
</step>

<step name="refreeze">
**Re-freeze the envelope (write mode only):**

After validation, re-freeze by reading `formal/requirements.json`, setting `frozen_at` to current ISO timestamp, and writing back.
</step>

<step name="summarize">
**Show summary:**

- Total requirement count
- Breakdown by source file (how many from each archive vs current)
- Haiku validation results (if run): duplicates, contradictions, ambiguities found
- If dry-run: note this was a preview
- If write: confirm the file was written, validated, and re-frozen
</step>

</process>
