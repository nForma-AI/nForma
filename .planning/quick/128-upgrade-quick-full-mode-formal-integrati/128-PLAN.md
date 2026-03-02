---
phase: quick-128
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - qgsd-core/workflows/quick.md
  - commands/qgsd/quick.md
autonomous: true
requirements: [QUICK-FULL-FORMAL]

must_haves:
  truths:
    - "quick --full mode scans formal/spec/ and stores $FORMAL_SPEC_CONTEXT before spawning the planner"
    - "Planner receives relevant invariants.md paths in <files_to_read> when formal modules match task keywords"
    - "Plan frontmatter can declare formal_artifacts: (none | update: [...] | create: [...])"
    - "Plan checker step 5.5 validates formal_artifacts targets and invariant compliance"
    - "Executor step 6 includes formal/ files in atomic commits when plan declares formal_artifacts"
    - "Verifier step 6.5 checks invariant compliance and formal artifact syntax"
    - "After verifier returns passed, quorum reviews VERIFICATION.md and can downgrade to Needs Review"
    - "commands/qgsd/quick.md <objective> describes the formal integration capabilities of --full"
    - "Installer syncs both source files to ~/.claude/ after edits"
  artifacts:
    - path: "qgsd-core/workflows/quick.md"
      provides: "Updated quick workflow with formal integration steps"
      contains: "FORMAL_SPEC_CONTEXT"
    - path: "commands/qgsd/quick.md"
      provides: "Updated command description reflecting --full formal capabilities"
      contains: "formal/ integration"
  key_links:
    - from: "Step 4.5 (formal scope scan)"
      to: "Step 5 planner injection"
      via: "$FORMAL_SPEC_CONTEXT variable passed forward"
      pattern: "FORMAL_SPEC_CONTEXT"
    - from: "Step 6.5 verifier"
      to: "quorum on VERIFICATION.md"
      via: "quorum dispatch after passed status"
      pattern: "APPROVED.*keep.*passed|BLOCKED.*Needs Review"
---

<objective>
Upgrade --full mode in the quick workflow to integrate with formal/ specs:
- Formal scope scan (step 4.5) discovers relevant invariants.md files
- Planner receives invariant context and must declare formal_artifacts in plan frontmatter
- Plan checker validates formal artifact targets and invariant compliance
- Executor commits formal/ files when plan declares formal_artifacts
- Verifier checks invariant compliance and formal artifact syntax
- Quorum reviews VERIFICATION.md after verifier passes (can downgrade to Needs Review)
- commands/qgsd/quick.md objective updated to reflect new --full capabilities
- Installer syncs both files to ~/.claude/

Purpose: --full mode becomes a single-phase rigor tier with formal verification integration, making quick tasks provably safe with respect to declared system invariants.

Output: Updated qgsd-core/workflows/quick.md, commands/qgsd/quick.md, and installed copies at ~/.claude/qgsd/workflows/quick.md and ~/.claude/commands/qgsd/quick.md
</objective>

<execution_context>
@/Users/jonathanborduas/.claude/qgsd/workflows/execute-plan.md
@/Users/jonathanborduas/.claude/qgsd/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@qgsd-core/workflows/quick.md
@commands/qgsd/quick.md
</context>

<tasks>

<task type="auto">
  <name>Task 1: Add formal integration steps to qgsd-core/workflows/quick.md</name>
  <files>qgsd-core/workflows/quick.md</files>
  <action>
Read the current file first, then make the following surgical additions/modifications:

**1. After Step 4 ("Create quick task directory") — insert new Step 4.5 (--full only):**

```markdown
---

**Step 4.5: Formal scope scan (only when `$FULL_MODE`)**

Skip this step entirely if NOT `$FULL_MODE`.

```bash
FORMAL_SPEC_CONTEXT=[]
```

List subdirectories under `formal/spec/` (if the directory exists):
```bash
ls formal/spec/ 2>/dev/null
```

For each subdirectory found, check if `formal/spec/{module}/invariants.md` exists:
```bash
ls formal/spec/{module}/invariants.md 2>/dev/null
```

If it exists, record the module name and path: `formal/spec/{module}/invariants.md`.

**Relevance heuristic:** Match $DESCRIPTION keywords (lowercased, split on spaces/hyphens) against module names. A module is relevant if any keyword appears as a substring of the module name, or the module name appears as a substring of any keyword.

Examples:
- Description "fix quorum deliberation bug" → modules matching: `quorum`, `deliberation`
- Description "update TUI navigation flow" → modules matching: `tui-nav`
- Description "refactor breaker circuit logic" → modules matching: `breaker`

If no modules match: `$FORMAL_SPEC_CONTEXT = []`
If modules match: `$FORMAL_SPEC_CONTEXT` = array of `{ module, path }` objects for each matching module.

Display:
```
◆ Formal scope scan: found {N} relevant module(s): {module names or "none"}
```

Store `$FORMAL_SPEC_CONTEXT` for use in steps 5, 5.5, 6.5.
```

**2. Modify Step 5 ("Spawn planner (quick mode)") — update the `<files_to_read>` block in the `$FULL_MODE` planner prompt to inject formal context:**

In the existing planner Task prompt (the `quick-full` mode version), add to the `<files_to_read>` block AFTER the existing `.planning/STATE.md` and `./CLAUDE.md` lines:

```
${FORMAL_SPEC_CONTEXT.length > 0 ? FORMAL_SPEC_CONTEXT.map(f => `- ${f.path} (Formal invariants for module: ${f.module})`).join('\n') : ''}
```

Also add a new `<formal_context>` section to the planner prompt, after the `</files_to_read>` block and before `</planning_context>`:

```markdown
<formal_context>
${FORMAL_SPEC_CONTEXT.length > 0 ?
`Relevant formal modules identified: ${FORMAL_SPEC_CONTEXT.map(f => f.module).join(', ')}

Constraints:
- Read the injected invariants.md files and identify which invariants apply to this task
- Declare \`formal_artifacts:\` in plan frontmatter (required field when FORMAL_SPEC_CONTEXT is non-empty):
  - \`none\` — task does not create or modify formal/ files
  - \`update: [list of formal/ file paths]\` — task modifies existing formal/ files
  - \`create: [list of {path, type (tla|alloy|prism), description}]\` — task creates new formal/ files
- Plan tasks MUST NOT violate the identified invariants` :
`No formal modules matched this task. Declare \`formal_artifacts: none\` in plan frontmatter.`}
</formal_context>
```

**3. Modify Step 5.5 ("Plan-checker loop") — add formal dimension to checker prompt:**

In the existing `<check_dimensions>` block of the checker prompt, add after "must_haves derivation":

```markdown
- Formal artifacts (--full only): If `formal_artifacts` is `update` or `create`, are the target file paths well-specified (not vague)?
- Invariant compliance (--full only): Do plan tasks avoid operations that would violate the invariants identified in the formal context? (If `$FORMAL_SPEC_CONTEXT` is empty, skip this check.)
```

Also add to the checker prompt's `<files_to_read>` block (when FORMAL_SPEC_CONTEXT is non-empty):
```
${FORMAL_SPEC_CONTEXT.map(f => `- ${f.path} (Formal invariants for module: ${f.module})`).join('\n')}
```

And add a `<formal_context>` note after `</check_dimensions>`:
```markdown
<formal_context>
${FORMAL_SPEC_CONTEXT.length > 0 ? `Relevant formal modules: ${FORMAL_SPEC_CONTEXT.map(f => f.module).join(', ')}. Check plan formal_artifacts declaration and invariant compliance.` : 'No formal modules matched. Verify plan declares formal_artifacts: none.'}
</formal_context>
```

**4. Modify Step 6 ("Spawn executor") — add formal file handling:**

In the executor Task prompt `<constraints>` block, add after the "Commit each task atomically" line:

```markdown
- If the plan declares `formal_artifacts: update` or `formal_artifacts: create`, execute those formal file changes and include the formal/ files in the atomic commit for that task (alongside the implementation files)
- Formal/ files must never be committed separately — always include in the task's atomic commit
```

**5. Modify Step 6.5 ("Verification") — add formal checks and quorum on VERIFICATION.md:**

**5a.** In the verifier Task prompt, add to `<files_to_read>`:
```
${FORMAL_SPEC_CONTEXT.map(f => `- ${f.path} (Formal invariants for module: ${f.module})`).join('\n')}
```

And add a `<formal_context>` block to the verifier prompt:
```markdown
<formal_context>
${FORMAL_SPEC_CONTEXT.length > 0 ?
`Relevant formal modules: ${FORMAL_SPEC_CONTEXT.map(f => f.module).join(', ')}

Additional verification checks:
- Did executor respect the identified invariants? Check implementation files against invariant conditions.
- If plan declared formal_artifacts update or create: are the modified/created formal/ files syntactically reasonable for their type (TLA+/Alloy/PRISM)? (Basic structure check, not model checking.)` :
'No formal modules matched. Skip formal invariant checks.'}
</formal_context>
```

**5b.** After the `$VERIFICATION_STATUS` routing table (the table with `passed`, `human_needed`, `gaps_found` rows), insert a new sub-step for the `passed` branch only:

```markdown
**Step 6.5.1: Quorum review of VERIFICATION.md (only when `$FULL_MODE` and `$VERIFICATION_STATUS = "Verified"`)**

Display:
```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 QGSD ► QUORUM REVIEW OF VERIFICATION
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

◆ Running quorum review of VERIFICATION.md...
```

Form your own position: does VERIFICATION.md confirm all must_haves are met and no invariants violated? State your vote as APPROVE or BLOCK with 1-2 sentences.

Run quorum inline (R3 dispatch_pattern from `commands/qgsd/quorum.md`):
- Mode A — artifact review
- artifact_path: `${QUICK_DIR}/${next_num}-VERIFICATION.md`
- review_context: "Review this VERIFICATION.md and answer: (1) Are all must_haves confirmed met? (2) Are any invariants from the formal context violated? Vote APPROVE if verification is sound and complete. Vote BLOCK if must_haves are not confirmed or invariants are violated."
- request_improvements: false
- Build `$DISPATCH_LIST` (quorum.md Adaptive Fan-Out: read risk_level → compute FAN_OUT_COUNT → take first FAN_OUT_COUNT-1 slots from active working list)
- Dispatch `$DISPATCH_LIST` as sibling `qgsd-quorum-slot-worker` Tasks with `model="haiku", max_turns=100`

Fail-open: if all slots are UNAVAIL, keep `$VERIFICATION_STATUS = "Verified"` and note: "Quorum unavailable — verification result uncontested."

Route on quorum result:
| Verdict | Action |
|---------|--------|
| **APPROVED** | Keep `$VERIFICATION_STATUS = "Verified"`. Proceed to status update. |
| **BLOCKED** | Set `$VERIFICATION_STATUS = "Needs Review"`. Display block reason. Proceed to status update. |
| **ESCALATED** | Present escalation to user. Set `$VERIFICATION_STATUS = "Needs Review"`. Proceed to status update. |
```

**6. Update `success_criteria` section** — add the following items:
```
- [ ] (--full) Formal scope scan runs before planner (step 4.5), $FORMAL_SPEC_CONTEXT populated
- [ ] (--full) Planner receives relevant invariants.md in files_to_read
- [ ] (--full) Plan declares formal_artifacts field in frontmatter
- [ ] (--full) Executor includes formal/ files in atomic commits when formal_artifacts non-empty
- [ ] (--full) Verifier checks invariant compliance and formal artifact syntax
- [ ] (--full) Quorum reviews VERIFICATION.md after passed status (step 6.5.1)
```
  </action>
  <verify>
    Read qgsd-core/workflows/quick.md and confirm:
    - "Step 4.5" heading exists in the file
    - "FORMAL_SPEC_CONTEXT" appears at least 5 times
    - "formal_artifacts" appears at least 3 times
    - "Step 6.5.1" heading exists
    - "Quorum review of VERIFICATION.md" text appears
    - "Needs Review" appears in the quorum routing table for BLOCKED verdict
    Use: grep -n "FORMAL_SPEC_CONTEXT\|formal_artifacts\|Step 4.5\|Step 6.5.1\|Needs Review" qgsd-core/workflows/quick.md | head -20
  </verify>
  <done>
    qgsd-core/workflows/quick.md contains:
    - Step 4.5 formal scope scan block (--full only)
    - Planner prompt updated with $FORMAL_SPEC_CONTEXT injection
    - Checker step 5.5 has formal dimension checks
    - Executor step 6 has formal file commit instructions
    - Verifier step 6.5 has formal context injection
    - Step 6.5.1 quorum review of VERIFICATION.md with APPROVED/BLOCKED/ESCALATED/fail-open routing
    - Success criteria updated with formal integration items
  </done>
</task>

<task type="auto">
  <name>Task 2: Update commands/qgsd/quick.md objective for --full formal capabilities</name>
  <files>commands/qgsd/quick.md</files>
  <action>
Read commands/qgsd/quick.md first (already read in context). Edit the `<objective>` section to replace the current `--full` description:

Current text:
```
**`--full` flag:** Enables plan-checking (max 2 iterations) and post-execution verification. Use when you want quality guarantees without full milestone ceremony.
```

Replace with:
```
**`--full` flag:** Single-phase rigor tier. Enables:
- Plan-checking (max 2 iterations) and post-execution verification
- Formal scope scan: discovers relevant `formal/spec/*/invariants.md` and injects invariant context into the planner
- Plan frontmatter must declare `formal_artifacts:` (none | update | create) with formal/ file targets
- Executor commits formal/ files atomically when `formal_artifacts` is non-empty
- Verifier checks invariant compliance and formal artifact syntax
- Quorum reviews VERIFICATION.md after passing (can downgrade to "Needs Review")

Use when you want quality guarantees with formal correctness properties, without full milestone ceremony.
```
  </action>
  <verify>
    Read commands/qgsd/quick.md and confirm the <objective> section contains "formal/spec/*/invariants.md" and "formal_artifacts" and "Single-phase rigor tier".
    Use: grep -n "formal\|Single-phase\|formal_artifacts" commands/qgsd/quick.md
  </verify>
  <done>
    commands/qgsd/quick.md <objective> section describes --full mode as single-phase rigor tier with formal integration capabilities listed.
  </done>
</task>

<task type="auto">
  <name>Task 3: Install sync — deploy updated files to ~/.claude/</name>
  <files>~/.claude/qgsd/workflows/quick.md, ~/.claude/commands/qgsd/quick.md</files>
  <action>
The installer reads directly from qgsd-core/ and commands/qgsd/ source directories (no separate dist/ step needed for these files — only hooks use hooks/dist/).

Run the installer:
```bash
node /Users/jonathanborduas/code/QGSD/bin/install.js --claude --global
```

This copies:
- qgsd-core/workflows/quick.md → ~/.claude/qgsd/workflows/quick.md
- commands/qgsd/quick.md → ~/.claude/commands/qgsd/quick.md
(among all other files)
  </action>
  <verify>
    Confirm installed files contain the new content:
    grep -n "FORMAL_SPEC_CONTEXT\|Step 4.5\|Step 6.5.1" ~/.claude/qgsd/workflows/quick.md | head -5
    grep -n "formal_artifacts\|Single-phase" ~/.claude/commands/qgsd/quick.md | head -5
  </verify>
  <done>
    ~/.claude/qgsd/workflows/quick.md contains "FORMAL_SPEC_CONTEXT" and "Step 4.5".
    ~/.claude/commands/qgsd/quick.md contains "formal_artifacts" and "Single-phase rigor tier".
    Installer reports success without failures.
  </done>
</task>

</tasks>

<verification>
1. grep -n "Step 4.5\|FORMAL_SPEC_CONTEXT\|formal_artifacts\|Step 6.5.1" /Users/jonathanborduas/code/QGSD/qgsd-core/workflows/quick.md | wc -l → expect 10+ matches
2. grep -n "Single-phase rigor tier\|formal_artifacts\|formal/spec" /Users/jonathanborduas/code/QGSD/commands/qgsd/quick.md → expect 3+ matches
3. grep "FORMAL_SPEC_CONTEXT" ~/.claude/qgsd/workflows/quick.md → exists (install succeeded)
4. grep "Single-phase" ~/.claude/commands/qgsd/quick.md → exists (install succeeded)
</verification>

<success_criteria>
- qgsd-core/workflows/quick.md has all 6 formal integration additions (step 4.5, planner injection, checker dimension, executor commit rule, verifier context, step 6.5.1 quorum)
- commands/qgsd/quick.md objective describes formal integration as part of --full
- ~/.claude/ copies match source files after install
- All changes committed atomically
</success_criteria>

<output>
After completion, create `.planning/quick/128-upgrade-quick-full-mode-formal-integrati/128-SUMMARY.md`
</output>
