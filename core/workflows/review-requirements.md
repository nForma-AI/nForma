<purpose>
Review ALL requirements in `.planning/formal/requirements.json` for quality issues.
Flags specificity problems, redundant overlaps, unmeasurable requirements, and merge
candidates. Proposes improvements interactively or applies fixes in batch mode.

Combines the "map" (ingestion) and "review" (quality gate) concerns into a single
post-ingestion quality sweep. Run standalone or as part of `/nf:solve`.
</purpose>

<process>

<step name="parse_args">
**Parse arguments:**

```
BATCH=""
DRY_RUN=""
CATEGORY=""
IDS=""
if arguments contain "--batch"; then BATCH="true"; fi
if arguments contain "--dry-run"; then DRY_RUN="true"; fi
if arguments contain "--category=..."; then CATEGORY="<value>"; fi
if arguments contain "--ids=..."; then IDS="<comma-separated IDs>"; fi
```

- `--batch`: Skip all AskUserQuestion calls, auto-apply safe fixes (merge, generalize). Used when called from `/nf:solve`.
- `--dry-run`: Show proposed changes without writing.
- `--category="Category Name"`: Limit review to one category.
- `--ids=REQ-01,REQ-02`: Limit review to specific IDs.
</step>

<step name="load_envelope">
**Load requirements envelope:**

1. Read `.planning/formal/requirements.json`
2. If file doesn't exist: error "No requirements envelope. Run /nf:map-requirements first."
3. Extract the `requirements` array
4. Apply filters: if `--category` provided, filter by category; if `--ids`, filter by ID list
5. Display: `Reviewing {N} requirements (of {total} total)`
</step>

<step name="specificity_scan">
**Pass 1 — Specificity scan:**

Flag requirements that target a single instance when a generalized requirement would cover the same constraint.

**What to flag:**
- References a specific file by name (e.g., `bin/account-manager.cjs`) when the constraint applies to all files in that directory or category
- References a specific page/route (e.g., `/dashboard`) when the constraint applies to all pages
- References a specific module/component by name when the constraint is universal
- References a specific test file when the pattern applies to all tests

**What NOT to flag:**
- Measurable/quantitative requirements with specific thresholds (e.g., "response time under 1s") — these are good
- Requirements that genuinely apply to only one entity (e.g., "the installer SHALL display the ASCII banner")
- Requirements referencing a specific API endpoint when the behavior is endpoint-specific

**Detection approach:**
1. For each requirement, check if the text contains a specific file path, module name, or page reference
2. Check if the constraint verb (SHALL, MUST, SHOULD) applies universally (annotations, response times, error handling patterns)
3. Use pattern matching first, then Haiku classification for borderline cases

Spawn a Haiku sub-agent for the full batch:

Use the **Agent tool** with:
- `subagent_type`: `"general-purpose"`
- `model`: `"haiku"`
- `description`: `"Scan specificity issues"`
- `prompt`:

```
You are reviewing requirements for SPECIFICITY issues. A requirement is TOO SPECIFIC
when it targets a single instance but the constraint should apply broadly.

## Requirements to review

{list each requirement as "ID: text"}

## Your task

For each requirement, classify as:
- SPECIFIC: <generalized form> — The requirement targets one instance but should be universal
- OK — The requirement is appropriately scoped

Rules:
- Measurable thresholds (times, counts, percentages) are OK even when mentioning specific entities
- Requirements about unique system components (e.g., "the installer", "the circuit breaker") are OK
- Requirements about categories of things (e.g., "all bin/ modules", "all pages") are already generalized — OK
- Only flag SPECIFIC when the constraint clearly applies to ALL instances of that type

## Response format

Return ONE line per requirement:
ID: SPECIFIC: <suggested generalized form>
ID: OK

Be conservative — only flag clear cases where generalization improves the requirement.
```

Collect all SPECIFIC findings into `specificity_issues[]`.
</step>

<step name="overlap_scan">
**Pass 2 — Redundancy and overlap scan:**

Detect requirements that overlap, duplicate, or could be merged.

Spawn a Haiku sub-agent:

Use the **Agent tool** with:
- `subagent_type`: `"general-purpose"`
- `model`: `"haiku"`
- `description`: `"Scan redundancy/overlap"`
- `prompt`:

```
You are reviewing requirements for REDUNDANCY and MERGE opportunities.

## Requirements

{list each requirement as "ID (category): text"}

## Find these issues ONLY:

1. DUPLICATE: Two requirements express the SAME intent with different wording.
   NOT duplicates: requirements that address different aspects of the same feature.

2. SUBSUMES: Requirement A fully contains requirement B — B adds nothing if A exists.

3. MERGE: Two or more requirements from the SAME category that could be combined
   into one stronger requirement without losing specificity.
   NOT merge candidates: requirements from different categories covering different concerns.

## Response format

For each finding:
- Type: DUPLICATE | SUBSUMES | MERGE
- IDs: comma-separated list of involved requirement IDs
- Reason: one-line explanation
- Suggested: the merged/surviving requirement text (if MERGE or SUBSUMES)

End with: "Found: N duplicates, N subsumes, N merge candidates"
If none: "No redundancy issues found"

Be conservative — only flag REAL overlaps. Similar-sounding requirements about different aspects are NOT overlaps.
```

Collect findings into `overlap_issues[]`.
</step>

<step name="measurability_scan">
**Pass 3 — Measurability scan:**

Flag requirements that lack testable/verifiable criteria.

Spawn a Haiku sub-agent:

Use the **Agent tool** with:
- `subagent_type`: `"general-purpose"`
- `model`: `"haiku"`
- `description`: `"Scan measurability"`
- `prompt`:

```
You are reviewing requirements for MEASURABILITY. A good requirement can be verified
by inspection, test, or formal proof.

## Requirements

{list each requirement as "ID: text"}

## Flag requirements that are:

1. VAGUE: Uses subjective terms without criteria ("should be fast", "must be reliable",
   "good user experience") with no measurable threshold or testable condition

2. UNTESTABLE: Cannot be verified by any automated or manual process ("the system shall
   be intuitive", "code shall be clean")

## Do NOT flag:

- Structural requirements ("SHALL include @requirement annotations") — testable by grep
- Behavioral requirements with clear conditions ("SHALL return 404 when not found") — testable
- Constraint requirements with thresholds ("response time under 1s") — measurable
- Existence requirements ("SHALL have a circuit breaker") — verifiable by inspection

## Response format

For each issue:
ID: VAGUE | UNTESTABLE: <reason> -> <suggested measurable form>

End with: "Found: N vague, N untestable"
If none: "All requirements are measurable"
```

Collect findings into `measurability_issues[]`.
</step>

<step name="present_findings">
**Present findings:**

Display a summary table:

```
Requirements Quality Review ({N} reviewed):
──────────────────────────────────────────────────
Issue Type         Count   Action
──────────────────────────────────────────────────
Specificity        {N}     Generalize
Redundancy         {N}     Merge/Remove
Measurability      {N}     Rewrite
──────────────────────────────────────────────────
Total issues       {N}
```

If total issues == 0:
Display `All {N} requirements pass quality review.` and STOP.

For each category with issues > 0, display the details:

**Specificity issues:**
```
  ID          Current                                    Suggested
  ──────────────────────────────────────────────────────────────────
  FVTOOL-03   bin/check-spec.cjs SHALL have annotations  All bin/ utility modules SHALL include...
```

**Redundancy issues:**
```
  Type       IDs              Reason                         Suggested
  ──────────────────────────────────────────────────────────────────────
  MERGE      ACT-01, ACT-02   Both require action logging    All user actions SHALL be logged with...
```

**Measurability issues:**
```
  ID          Current                    Suggested
  ──────────────────────────────────────────────────
  PERF-03     System shall be fast       Response time SHALL be under 500ms at p95
```
</step>

<step name="apply_fixes">
**Apply fixes:**

**If `--batch` mode:**
- Auto-apply all SPECIFICITY fixes (replace requirement text with generalized form)
- Auto-apply all SUBSUMES fixes (remove subsumed requirement, keep the broader one)
- Auto-apply all MERGE fixes (replace N requirements with 1 merged requirement, remove extras)
- Log MEASURABILITY issues as warnings only (rewrites need human judgment)
- Skip AskUserQuestion entirely

**If interactive mode:**
For each issue, use AskUserQuestion:

- header: "Fix?"
- question: "Apply this fix? {issue_summary}"
- options:
  - "Apply" — Apply the suggested fix
  - "Skip" — Keep as-is
  - "Edit" — Let me provide a custom fix (then prompt for text)

Track applied fixes in `applied_fixes[]`.
</step>

<step name="write_changes">
**Write changes to envelope:**

If `--dry-run`: Display all proposed changes and STOP.

For each applied fix:

1. **SPECIFICITY fix**: Update the requirement's `text` field to the generalized form
2. **SUBSUMES fix**: Remove the subsumed requirement from the array
3. **MERGE fix**: Update the surviving requirement's text, remove the merged-away requirements
4. **MEASURABILITY fix**: Update the requirement's `text` field to the measurable form

After all fixes:
1. Read `.planning/formal/requirements.json` (fresh read)
2. If `frozen_at` is not null, set to `null` (unfreeze)
3. Apply all text updates and removals to the requirements array
4. Sort by ID for determinism
5. Recompute `content_hash`: SHA-256 of `JSON.stringify(requirements, null, 2)`
6. Update `aggregated_at` to current ISO timestamp
7. Write atomically
8. Re-freeze: set `frozen_at` to current ISO timestamp, write

Display summary:
```
Applied {N} fixes to requirements envelope:
  - {X} requirements generalized (specificity)
  - {Y} requirements removed (subsumed/merged)
  - {Z} requirements rewritten (measurability)
  Total: {before} → {after} requirements
```
</step>

<step name="check_memory">
**Memory staleness check:**

```bash
node bin/validate-memory.cjs --quiet
```

If findings exist (requirement count changed):
- In batch mode: auto-apply suggested fixes to MEMORY.md
- In interactive mode: ask user whether to update MEMORY.md
</step>

</process>

<success_criteria>
- [ ] All requirements scanned for specificity, overlap, and measurability
- [ ] Haiku sub-agents used for classification (not pattern matching alone)
- [ ] Interactive mode presents each issue with apply/skip/edit options
- [ ] Batch mode auto-applies safe fixes without prompting
- [ ] Envelope written atomically with hash recomputation
- [ ] Memory staleness checked after changes
- [ ] Removed requirements tracked (for formal model cleanup in next solve iteration)
</success_criteria>
