<purpose>
Add a single requirement to the `.planning/formal/requirements.json` envelope. Validates the new requirement against the existing envelope for duplicate IDs and semantic conflicts. If a conflict is detected, elevates to the user before proceeding.
</purpose>

<process>

<step name="parse_args">
**Parse arguments:**

The user provides requirement details interactively or via arguments:
- `--id=PREFIX-NN` — Requirement ID (must match `^[A-Z]+-\d+$`)
- `--text="..."` — Requirement text
- `--category="..."` — Category name
- `--phase=vX.XX-NN` — Phase reference (must match `^v[\d.]+-\d+$`)
- `--status=Pending|Complete` — Status (defaults to Pending)
- `--background="..."` — Optional background/rationale
- `--source-file="..."` — Provenance source file (defaults to "manual")
- `--milestone="..."` — Provenance milestone (defaults to current milestone from `.planning/ROADMAP.md`)
- `--dry-run` — Preview without writing

If required fields (id, text, category, phase) are missing, prompt the user interactively using AskUserQuestion.
</step>

<step name="validate_id_format">
**Validate ID format:**

1. Check that `id` matches pattern `^[A-Z]+-\d+$`
2. If invalid, show the error and ask user to correct it
3. Parse the prefix (e.g., `ACT` from `ACT-01`) for later conflict detection
</step>

<step name="read_envelope">
**Read existing envelope:**

1. Read `.planning/formal/requirements.json`
2. If file doesn't exist, error: "No requirements envelope found. Run /nf:map-requirements first."
3. Parse the envelope and extract the requirements array
4. Note the `frozen_at` state for later re-freeze
</step>

<step name="check_duplicate_id">
**Check for duplicate ID (hard block):**

1. Search existing requirements for an exact ID match
2. If found, show the existing requirement to the user:
   ```
   DUPLICATE: Requirement {id} already exists:
     Text: {existing.text}
     Category: {existing.category}
     Phase: {existing.phase}
     Status: {existing.status}
   ```
3. Ask the user: "This ID already exists. Would you like to use a different ID, or update the existing requirement?"
4. Do NOT proceed until resolved
</step>

<step name="check_semantic_conflicts">
**Check for semantic conflicts (Haiku review) — ALWAYS runs:**

This step is MANDATORY for every new requirement, regardless of whether same-prefix requirements exist. A new `QUICK-01` could contradict an `ENFC-*` or `VERIFY-*` requirement under a completely different prefix.

Spawn a Haiku subagent to check for semantic conflicts against the **entire** requirements envelope.

Use the **Agent tool** with these parameters:
- `subagent_type`: `"general-purpose"`
- `model`: `"haiku"`
- `description`: `"Check requirement conflicts"`
- `prompt`: The prompt below (with actual values substituted)

```
You are checking whether a NEW requirement conflicts with ANY existing requirements in the envelope.

## New requirement
- ID: {id}
- Text: {text}
- Category: {category}
- Background: {background}

## Existing requirements

Read `.planning/formal/requirements.json` and scan ALL requirements (not just same-prefix).

## Your task

Check for these issues ONLY:

1. DUPLICATE INTENT: Does the new requirement express the SAME intent as an existing one, just with different wording? If so, adding it would create redundancy.

2. CONTRADICTION: Does the new requirement CONTRADICT an existing one? Two requirements that cannot both be satisfied simultaneously. Pay special attention to cross-prefix contradictions (e.g., a new workflow requirement contradicting an enforcement or verification requirement).

3. SUBSUMPTION: Is the new requirement already FULLY COVERED by an existing one? Adding it would be redundant.

## Response format

Respond with EXACTLY one of:
- `CLEAR` — No conflicts found. The new requirement is distinct and compatible.
- `CONFLICT: <type> with <existing-id>: <brief explanation>` — A real issue was found.

Be conservative: only flag REAL conflicts. Similar-sounding requirements that address different aspects are NOT conflicts. Requirements from different domains that happen to share keywords are NOT conflicts.
```

If Haiku returns `CONFLICT`:
1. Display the conflict to the user with full context (both requirements)
2. Ask: "A potential conflict was detected. Do you want to proceed anyway, modify the requirement, or cancel?"
3. Wait for user decision before continuing

If Haiku returns `CLEAR`:
Display: `◆ Semantic conflict check: CLEAR (scanned {N} existing requirements)`
</step>

<step name="check_specificity">
**Specificity gate:**

Check if the new requirement is overly specific — targeting a single instance when a generalized requirement would cover the same constraint more broadly.

**Quick pattern check first:**
1. Does the requirement text reference a specific file path (e.g., `bin/account-manager.cjs`)?
2. Does the constraint verb (SHALL, MUST, SHOULD) apply universally (annotations, response times, error handling)?
3. If both: flag as potentially too specific

**Skip this check if:**
- The requirement contains measurable thresholds (numbers, percentages, time units)
- The requirement references a unique system component ("the installer", "the circuit breaker")
- The requirement already uses generalizing language ("all", "every", "each")

If the pattern check flags the requirement, spawn a Haiku sub-agent to confirm:

Use the **Agent tool** with:
- `subagent_type`: `"general-purpose"`
- `model`: `"haiku"`
- `description`: `"Check specificity"`
- `prompt`:

```
Is this requirement TOO SPECIFIC? A requirement is too specific when it targets
one instance but the constraint should apply to all instances of that type.

Requirement: {id}: {text}

Respond with EXACTLY one of:
- SPECIFIC: <suggested generalized form>
- OK: <one-line reason why this scope is appropriate>

Examples of TOO SPECIFIC:
- "bin/account-manager.cjs SHALL have @requirement annotations" → SPECIFIC: "All bin/ utility modules SHALL include @requirement annotations"
- "The /dashboard page MUST respond under 1s" → SPECIFIC: "All pages MUST respond under 1s"

Examples of OK:
- "The installer SHALL display the ASCII banner" → OK: unique component
- "Response time SHALL be under 500ms at p95" → OK: measurable threshold
- "All bin/ modules SHALL include @requirement annotations" → OK: already generalized
```

If Haiku returns `SPECIFIC`:
1. Display: `⚠ This requirement may be too specific.`
2. Show the suggested generalized form
3. Ask the user via AskUserQuestion:
   - header: "Specificity"
   - question: "This requirement targets a single instance. Would you like to generalize it?"
   - options:
     - "Generalize" — Use the suggested generalized form
     - "Keep specific" — Proceed with the original text
     - "Edit" — Provide a custom generalized form
4. If "Generalize": update the requirement text to the generalized form
5. If "Edit": prompt for custom text and update

If Haiku returns `OK`:
Display: `◆ Specificity check: OK`
</step>

<step name="check_invariant">
**Invariant gate:**

Run the invariant classifier against the new requirement:

```bash
node bin/validate-invariant.cjs --id={id} --text="{text}"
```

Three possible verdicts:

**If `NON_INVARIANT`:**
1. Display: `⚠ This requirement does not appear to be an invariant: {reason}`
2. Ask the user:
   ```
   Requirements should define boundaries the system must always respect.
   Do you want to: (a) Proceed anyway, (b) Rephrase as invariant, (c) Cancel?
   ```
3. If (a): proceed with a warning note
4. If (b): return to parse_args step with user's revised text
5. If (c): abort the workflow

**If `BORDERLINE`:**
Spawn a Haiku sub-agent to classify:

Use the **Agent tool** with these parameters:
- `subagent_type`: `"general-purpose"`
- `model`: `"haiku"`
- `description`: `"Classify invariant"`
- `prompt`:
```
You are a requirements invariant classifier.

A VALID requirement is an INVARIANT — a property that must hold at any point in time.
Test: "At any point, if you inspect the system, this property holds."

A NON-INVARIANT is a task, migration, past achievement, or process step.

Requirement: {id}: {text}

Classify as exactly one of:
- INVARIANT: <one-line reason>
- NON_INVARIANT: <one-line reason>
```

Parse the sub-agent response:
- If `NON_INVARIANT`: treat as NON_INVARIANT above (display warning, ask user)
- If `INVARIANT`: display `◆ Invariant check: PASS (confirmed by Haiku)`

**If `INVARIANT`:**
Display: `◆ Invariant check: PASS`
</step>

<step name="unfreeze">
**Unfreeze envelope if frozen:**

If `frozen_at` is not null:
1. Read `.planning/formal/requirements.json`
2. Set `frozen_at` to `null`
3. Write back atomically
</step>

<step name="append_requirement">
**Append the new requirement:**

1. Read `.planning/formal/requirements.json` (fresh read after unfreeze)
2. Build the new requirement object:
   ```json
   {
     "id": "<id>",
     "text": "<text>",
     "category": "<category>",
     "phase": "<phase>",
     "status": "<status>",
     "provenance": {
       "source_file": "<source_file>",
       "milestone": "<milestone>"
     }
   }
   ```
3. If `background` was provided, add it to the object
4. Append to the `requirements` array
5. Sort the array by `id` (lexicographic) for determinism
6. Recompute `content_hash`: SHA-256 of `JSON.stringify(requirements, null, 2)`
7. Update `aggregated_at` to current ISO timestamp
8. If dry-run: display the new requirement object and stop
9. Write atomically (temp file + rename)
</step>

<step name="refreeze">
**Re-freeze the envelope:**

1. Read `.planning/formal/requirements.json`
2. Set `frozen_at` to current ISO timestamp
3. Write back atomically
</step>

<step name="check_memory">
**Memory staleness check:**

Run the memory validator to detect stale references caused by this envelope change:

```bash
node bin/validate-memory.cjs --quiet
```

Or call inline: `require('../bin/validate-memory.cjs').validateMemory({ cwd, quiet: true })`.

If findings exist (especially `stale_count` type — the requirement count in MEMORY.md no longer matches the envelope):
1. Display each finding and its suggested fix
2. Ask: "MEMORY.md has stale entries after this change. Should I update them now?"
3. If yes: apply the suggested fixes to MEMORY.md using Edit tool
4. If no: note the staleness for the user to fix later

If no findings: skip silently.
</step>

<step name="summarize">
**Show summary:**

- The new requirement that was added (id, text, category, phase)
- Total requirement count (before → after)
- Whether conflicts were checked and cleared
- If dry-run: note this was a preview only
</step>

</process>
