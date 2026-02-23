<purpose>
Step-by-step procedure Claude follows when the circuit breaker hook detects oscillation and emits a PRIORITY NOTICE. Tool calls are not blocked — but commits to the oscillating file set must stop until the root cause is resolved.
</purpose>

<trigger>
Triggered when: The PreToolUse circuit breaker hook emits an OSCILLATION DETECTED — PRIORITY NOTICE message (permissionDecision: 'allow' with warning reason), or when qgsd-prompt.js injects CIRCUIT BREAKER ACTIVE context at the start of a user message.
</trigger>

<process>

<step name="read_warning_notice">
## Step 1 — Read the Warning Notice

Extract from the hook's warning notice:
- The oscillating file set (listed under "Oscillating file set:")
- The commit_window_snapshot data (if present in the notice)

Note: tool calls are still allowed. The priority is to diagnose and resolve the oscillation before committing more changes to the affected files.
</step>

<step name="fast_path_environmental_check">
## Step 2 — Fast-Path: Environmental File Check

Check if the oscillating file set contains environmental/external files:
- Config files: `.env`, `*.env`, `*.config.js`, `*.config.ts`, `*.config.mjs`
- Lock files: `package-lock.json`, `yarn.lock`, `Pipfile.lock`, `poetry.lock`, `Cargo.lock`, `go.sum`
- External API schema files: `openapi.json`, `swagger.json`, `schema.graphql`, `*.schema.json`

**IF YES:** Immediately escalate to user. Message:

```
Environmental oscillation detected in: [file list]
This is likely an external dependency conflict, not a structural coupling issue.
Human intervention required — quorum diagnosis is not appropriate here.
```

STOP — do not proceed to Step 3.

**IF NO:** Continue to Step 3.
</step>

<step name="build_commit_graph">
## Step 3 — Build Commit Graph

Run:

```bash
git log --oneline --name-only -N
```

(N = commit_window, default 6)

Display as a table to make the A→B→A→B ping-pong pattern visually obvious:

| Commit | Message | Files Changed |
|--------|---------|---------------|
| abc1234 | fix: ... | file-a.js, file-b.js |
| def5678 | fix: ... | file-c.js |
| ghi9012 | fix: ... | file-a.js, file-b.js |
</step>

<step name="quorum_diagnosis">
## Step 4 — Quorum Diagnosis

```bash
node ~/.claude/qgsd/bin/gsd-tools.cjs activity-set \
  "{\"activity\":\"circuit_breaker\",\"sub_activity\":\"oscillation_diagnosis\",\"phase\":\"${PHASE_NUMBER}\"}"
```

Form your own structural coupling diagnosis first (before querying models).

Then query each available quorum model with:

```
Context: [paste commit graph table]
Oscillating file set: [file list]

Prompt: "Diagnose the STRUCTURAL COUPLING causing this oscillation — not surface symptoms.
Propose a UNIFIED solution that resolves both sides simultaneously.
Partial or incremental fixes are NOT acceptable."
```

Each model MUST be called in a **separate, sequential tool call** (per R3.2 — never sibling calls).

Apply R3.3 deliberation rules (up to 4 rounds, stop immediately on consensus).

**Deliberation framing for rounds 2–4:** Share all prior-round positions. Ask each model to reconsider or defend given the others' arguments. Stop on consensus.
</step>

<step name="on_consensus">
## Step 5 — On Consensus

```bash
node ~/.claude/qgsd/bin/gsd-tools.cjs activity-set \
  "{\"activity\":\"circuit_breaker\",\"sub_activity\":\"awaiting_approval\",\"phase\":\"${PHASE_NUMBER}\"}"
```

Present the unified solution plan to the user with:
- Summary of structural coupling diagnosed
- The unified solution (files to change, what to change, why this breaks the oscillation)
- Instructions: "To implement: [steps]. After committing the fix, run `node ~/.claude/qgsd-bin/qgsd.cjs --reset-breaker` to clear the circuit breaker."

Wait for explicit user approval before any implementation.

Do NOT commit anything until the user confirms the plan.
</step>

<step name="no_consensus_hard_stop">
## Step 6 — No Consensus After 4 Rounds

Hard-stop. Present to user:
- Each model's final position (1–2 sentences each)
- Core point of disagreement
- Claude's recommendation with rationale

User must make the final call.
</step>

</process>

<constraints>
- EXECUTION is single-model only (R2.2) — quorum diagnoses and plans, never executes
- No commits to the oscillating file set until user approves the plan AND runs `node ~/.claude/qgsd-bin/qgsd.cjs --reset-breaker`
- Environmental file fast-path skips quorum entirely — human escalation only
- See CLAUDE.md R5 for the full policy definition
</constraints>

<success_criteria>
- [ ] Warning notice parsed (oscillating file set extracted)
- [ ] Environmental fast-path check applied
- [ ] Commit graph built and displayed
- [ ] Quorum diagnosis run with STRUCTURAL COUPLING framing
- [ ] Unified solution (not partial fix) presented for user approval
- [ ] No commits to oscillating files until user approves AND --reset-breaker is run
</success_criteria>
