<purpose>
Run the requirements aggregation pipeline. Merges current `.planning/REQUIREMENTS.md` with all archived milestone requirements (`.planning/milestones/v*-REQUIREMENTS.md`) into `.planning/formal/requirements.json`. Writes by default — if the envelope is frozen, automatically unfreezes, aggregates, validates with Haiku subagent, and re-freezes.
</purpose>

<process>

<step name="parse_args">
**Parse arguments:**

```
SKIP_ARCHIVE=""
DRY_RUN=""
SKIP_VALIDATE=""
STRICT=""
if arguments contain "--dry-run"; then
  DRY_RUN="--dry-run"
fi
if arguments contain "--skip-archive"; then
  SKIP_ARCHIVE="--skip-archive"
fi
if arguments contain "--skip-validate"; then
  SKIP_VALIDATE="true"
fi
if arguments contain "--strict"; then
  STRICT="--strict"
fi
```
</step>

<step name="check_freeze">
**Handle frozen envelope (write mode only):**

If NOT dry-run:
1. Read `.planning/formal/requirements.json` and check `frozen_at`
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

<step name="invariant_gate">
**Invariant gate (write mode only):**

After aggregation, run the invariant gate on the full envelope:

```bash
node bin/validate-invariant.cjs --batch --envelope=.planning/formal/requirements.json
```

If `--strict` flag was passed to this workflow, also pass `--strict` to the invariant gate — this will automatically move regex-caught non-invariant entries to `.planning/formal/archived-non-invariants.json`.

The script outputs three verdicts per requirement:
- `NON_INVARIANT` — caught by regex, removed in strict mode
- `BORDERLINE` — needs Haiku sub-agent classification
- `INVARIANT` — passed

**For BORDERLINE entries:** Spawn a Haiku sub-agent to classify each one:

Use the **Agent tool** with these parameters:
- `subagent_type`: `"general-purpose"`
- `model`: `"haiku"`
- `description`: `"Classify borderline requirements"`
- `prompt`:
```
You are a requirements invariant classifier. For each requirement below, classify as exactly one of:
- INVARIANT: <one-line reason>
- NON_INVARIANT: <one-line reason>

A VALID requirement is an INVARIANT — a property that must hold at any point in time.
Test: "At any point, if you inspect the system, this property holds."
A NON-INVARIANT is a task, migration, past achievement, or process step.

Requirements to classify:
{list each borderline requirement as "ID: text"}
```

For any classified as NON_INVARIANT by Haiku: treat as non-invariant (archive in strict mode, warn otherwise).

Display the results:
- If non-invariants found: warn with count and list
- If `--strict`: report how many were archived
- If all pass: `◆ Invariant gate: all {N} requirements are invariants`
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

Read `.planning/formal/requirements.json`. Note each requirement's `id`, `text`, `category`, and `provenance.source_file`.

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

After validation, re-freeze by reading `.planning/formal/requirements.json`, setting `frozen_at` to current ISO timestamp, and writing back.
</step>

<step name="check_memory">
**Memory staleness check (write mode only):**

After the envelope has been rewritten, check whether MEMORY.md references are now stale:

```bash
node bin/validate-memory.cjs --quiet
```

Or call inline: `require('../bin/validate-memory.cjs').validateMemory({ cwd, quiet: true })`.

If findings exist:
1. Display each finding with its suggested fix
2. Ask: "MEMORY.md has stale entries after re-aggregation. Should I update them now?"
3. If yes: apply the suggested fixes to MEMORY.md using Edit tool
4. If no: note the staleness for the user to fix later

Common case: the requirement count in MEMORY.md (e.g., "199 reqs") no longer matches the new envelope count after aggregation. The validator detects this automatically.
</step>

<step name="summarize">
**Show summary:**

- Total requirement count
- Breakdown by source file (how many from each archive vs current)
- Haiku validation results (if run): duplicates, contradictions, ambiguities found
- If dry-run: note this was a preview
- If write: confirm the file was written, validated, and re-frozen
- If memory was updated: note which entries were fixed
</step>

</process>
