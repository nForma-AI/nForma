---
phase: quick-100
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - /Users/jonathanborduas/.claude/agents/qgsd-quorum-orchestrator.md
  - /Users/jonathanborduas/.claude/qgsd.json
autonomous: true
requirements: [QUICK-100]

must_haves:
  truths:
    - "Orchestrator reads a global_timeout_ms value from qgsd.json at startup (default 600000 = 10 minutes)"
    - "Orchestrator records wall-clock start time before Step 1 pre-flight"
    - "Before each worker wave dispatch (Round 1 and Round 2, Modes A and B), orchestrator checks elapsed time against global_timeout_ms"
    - "If elapsed >= global_timeout_ms, orchestrator emits REDUCED-QUORUM TIMEOUT output and returns immediately without spawning more workers"
    - "The timeout output clearly cites R6 fail-open policy and lists which slots were UNAVAIL/timed-out"
    - "global_timeout_ms is documented in qgsd.json with a comment and set to 600000 by default"
  artifacts:
    - path: "/Users/jonathanborduas/.claude/agents/qgsd-quorum-orchestrator.md"
      provides: "Wall-clock timeout logic in Pre-step and wave dispatch checkpoints"
      contains: "global_timeout_ms"
    - path: "/Users/jonathanborduas/.claude/qgsd.json"
      provides: "Configurable global_timeout_ms setting"
      contains: "global_timeout_ms"
  key_links:
    - from: "qgsd-quorum-orchestrator.md Pre-step"
      to: "qgsd.json global_timeout_ms"
      via: "node -e inline script reading global + project configs"
      pattern: "global_timeout_ms"
    - from: "Round 1 wave dispatch"
      to: "elapsed check"
      via: "Date.now() - $WALL_CLOCK_START"
      pattern: "WALL_CLOCK_START"
---

<objective>
Add a configurable global wall-clock timeout to the qgsd-quorum-orchestrator agent. When all external quorum models are unavailable or timing out, the orchestrator currently hangs indefinitely (observed 3+ hours). This fix caps total orchestrator runtime at a configurable ceiling (default 10 minutes), after which it fails-open per R6 policy and returns a REDUCED-QUORUM TIMEOUT result.

Purpose: Prevent indefinite orchestrator hangs that block Claude and consume the user's session.
Output: Updated orchestrator agent file with wall-clock timeout logic, updated qgsd.json with global_timeout_ms setting.
</objective>

<execution_context>
@/Users/jonathanborduas/.claude/get-shit-done/workflows/execute-plan.md
@/Users/jonathanborduas/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@/Users/jonathanborduas/code/QGSD/.planning/STATE.md
@/Users/jonathanborduas/.claude/agents/qgsd-quorum-orchestrator.md
@/Users/jonathanborduas/.claude/qgsd.json
</context>

<tasks>

<task type="auto">
  <name>Task 1: Add global_timeout_ms to qgsd.json</name>
  <files>/Users/jonathanborduas/.claude/qgsd.json</files>
  <action>
Read /Users/jonathanborduas/.claude/qgsd.json. Add a top-level "global_timeout_ms" field with value 600000 (10 minutes in milliseconds). Place it after "circuit_breaker" and before "quorum_active" for readability. The field controls the maximum wall-clock time the orchestrator will wait for all workers to respond before failing-open per R6.

Write the updated JSON back. Preserve all existing fields and formatting (2-space indent).
  </action>
  <verify>node -e "const f=require('/Users/jonathanborduas/.claude/qgsd.json'); console.log(f.global_timeout_ms)" should print 600000</verify>
  <done>qgsd.json contains "global_timeout_ms": 600000 and all existing fields are intact</done>
</task>

<task type="auto">
  <name>Task 2: Add wall-clock timeout logic to orchestrator Pre-step and wave dispatch points</name>
  <files>/Users/jonathanborduas/.claude/agents/qgsd-quorum-orchestrator.md</files>
  <action>
Read /Users/jonathanborduas/.claude/agents/qgsd-quorum-orchestrator.md in full.

Make the following additions — do NOT change any existing logic, only insert new blocks at the four marked locations:

**Location A — end of "Pre-step — Parse $ARGUMENTS extras" section** (after the $REPO_DIR capture line, before the horizontal rule that ends the pre-step):

Insert a new subsection:

```
**Global timeout — record start time:**

```bash
node -e "
const fs = require('fs'), os = require('os'), path = require('path');
const globalCfg = path.join(os.homedir(), '.claude', 'qgsd.json');
const projCfg   = path.join(process.cwd(), '.claude', 'qgsd.json');
let cfg = {};
for (const f of [globalCfg, projCfg]) {
  try { Object.assign(cfg, JSON.parse(fs.readFileSync(f, 'utf8'))); } catch(_){}
}
const ms = cfg.global_timeout_ms ?? 600000;
console.log(JSON.stringify({ start: Date.now(), timeout_ms: ms }));
"
```

Store the parsed JSON as `$GLOBAL_TIMEOUT` (`{ start: <epoch_ms>, timeout_ms: <ms> }`).

Log: `Global timeout: ${$GLOBAL_TIMEOUT.timeout_ms / 60000} min (${$GLOBAL_TIMEOUT.timeout_ms} ms)`
```

**Location B — immediately before "### Round 1 — Parallel worker wave" in Mode A** (the line "Dispatch all active slots as parallel Task spawns..."):

Insert a wall-clock check block:

```
**Global timeout check — before Round 1 dispatch:**

```bash
node -e "
const elapsed = Date.now() - <$GLOBAL_TIMEOUT.start>;
const remaining = <$GLOBAL_TIMEOUT.timeout_ms> - elapsed;
if (remaining <= 0) {
  console.log('TIMEOUT');
} else {
  console.log('OK:' + remaining);
}
"
```

If output is `TIMEOUT`: stop immediately. Do not dispatch workers. Emit the reduced-quorum timeout block below and return.

If output is `OK:<N>`: log `Timeout remaining: ${N}ms` and proceed with Round 1 dispatch.
```

Insert the reduced-quorum timeout output template (referenced above):

```
**Reduced-quorum timeout output format (emit when wall-clock limit reached):**

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 QGSD ► QUORUM TIMEOUT — FAILING OPEN (R6)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Global timeout reached: [elapsed]ms / [global_timeout_ms]ms

All external quorum models were UNAVAILABLE or did not respond within
the global wall-clock limit. Failing open per R6 policy.

RESULT: REDUCED-QUORUM SELF-APPROVAL (Claude only)
UNAVAIL: [list all slots that were skipped or timed out]

Note: Re-run quorum when external models are available, or pass
--force-quorum to bypass min_quorum_size and proceed with available slots.
```
```

**Location C — immediately before "### Round 2 — Parallel deliberation wave" in Mode A**:

Insert the same wall-clock check block as Location B, adjusted for Round 2:

```
**Global timeout check — before Round 2 dispatch:**

Run the same node -e elapsed check as above. If `TIMEOUT`: emit the reduced-quorum timeout output and return. If `OK:<N>`: proceed with Round 2 dispatch.
```

**Location D — immediately before "### Round 1 — Parallel worker wave (Mode B)"** and **immediately before "### Round 2 — Parallel deliberation wave (Mode B)"**:

Insert the same wall-clock check pattern as Locations B and C, labeled "(Mode B)".

All four insertion points use the same pattern:
- Compute `elapsed = Date.now() - $GLOBAL_TIMEOUT.start`
- If `elapsed >= $GLOBAL_TIMEOUT.timeout_ms`: emit timeout output, return
- Otherwise: log remaining time and proceed

Write the updated file back. Preserve all existing content exactly — only insertions, no deletions or rewrites of existing text.
  </action>
  <verify>grep -c "global_timeout_ms\|WALL_CLOCK\|GLOBAL_TIMEOUT\|Global timeout" /Users/jonathanborduas/.claude/agents/qgsd-quorum-orchestrator.md should return >= 6 (one per insertion location plus config read)</verify>
  <done>The orchestrator file contains wall-clock timeout logic at: Pre-step (start time capture), before Mode A Round 1 dispatch, before Mode A Round 2 dispatch, before Mode B Round 1 dispatch, before Mode B Round 2 dispatch. The reduced-quorum timeout output block is defined once and referenced at all check points.</done>
</task>

</tasks>

<verification>
1. Read /Users/jonathanborduas/.claude/agents/qgsd-quorum-orchestrator.md and confirm all five timeout-related blocks are present (1 start capture + 4 check points)
2. Run: node -e "const f=require('/Users/jonathanborduas/.claude/qgsd.json'); console.log(f.global_timeout_ms)" — should print 600000
3. Confirm the orchestrator file still contains all original content (check for "Step 1 — Provider pre-flight", "Step 2 — Team identity", "Mode A", "Mode B", "Consensus output", "Escalate")
4. Confirm the reduced-quorum timeout output block references R6 explicitly
</verification>

<success_criteria>
- qgsd.json has global_timeout_ms: 600000
- Orchestrator records $GLOBAL_TIMEOUT at start of Pre-step
- Orchestrator checks elapsed time before each of the four worker wave dispatches (Mode A R1, Mode A R2, Mode B R1, Mode B R2)
- If elapsed >= timeout: emits REDUCED-QUORUM TIMEOUT output citing R6 and returns without spawning more workers
- No existing orchestrator logic was removed or rewritten
</success_criteria>

<output>
After completion, create /Users/jonathanborduas/code/QGSD/.planning/quick/100-add-global-wall-clock-timeout-to-quorum-/100-SUMMARY.md following the summary template.
</output>
