<purpose>
Validate `.planning/` directory integrity and report actionable issues. Checks for missing files, invalid configurations, inconsistent state, and orphaned plans. Optionally repairs auto-fixable issues.
</purpose>

<required_reading>
Read all files referenced by the invoking prompt's execution_context before starting.
</required_reading>

<process>

<step name="parse_args">
**Parse arguments:**

Check if `--repair` and `--force` flags are present in the command arguments.

```
REPAIR_FLAG=""
if arguments contain "--repair"; then
  REPAIR_FLAG="--repair"
fi

FORCE_FLAG=""
if arguments contain "--force"; then
  FORCE_FLAG="--force"
fi
```
</step>

<step name="run_health_check">
**Run health validation:**

```bash
node ~/.claude/qgsd/bin/gsd-tools.cjs validate health $REPAIR_FLAG $FORCE_FLAG
```

Parse JSON output:
- `status`: "healthy" | "degraded" | "broken"
- `errors[]`: Critical issues (code, message, fix, repairable)
- `warnings[]`: Non-critical issues
- `info[]`: Informational notes
- `repairable_count`: Number of auto-fixable issues
- `repairs_performed[]`: Actions taken if --repair was used
</step>

<step name="format_output">
**Format and display results:**

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 GSD Health Check
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Status: HEALTHY | DEGRADED | BROKEN
Errors: N | Warnings: N | Info: N
```

**If repairs were performed:**
```
## Repairs Performed

- ✓ config.json: Created with defaults
- ✓ STATE.md: Regenerated from roadmap
```

**If errors exist:**
```
## Errors

- [E001] config.json: JSON parse error at line 5
  Fix: Run /qgsd:health --repair to reset to defaults

- [E002] PROJECT.md not found
  Fix: Run /qgsd:new-project to create
```

**If warnings exist:**
```
## Warnings

- [W001] STATE.md references phase 5, but only phases 1-3 exist
  Fix: Run /qgsd:health --repair to regenerate

- [W005] Phase directory "1-setup" doesn't follow NN-name format
  Fix: Rename to match pattern (e.g., 01-setup)
```

**If info exists:**
```
## Info

- [I001] 02-implementation/02-01-PLAN.md has no SUMMARY.md
  Note: May be in progress
```

**Footer (if repairable issues exist and --repair was NOT used):**
```
---
N issues can be auto-repaired. Run: /qgsd:health --repair
```
</step>

<step name="display_token_usage">
**Display per-slot token consumption:**

Run the following to read and display token usage data:

```bash
node -e "
const fs = require('fs');
const path = require('path');
const logPath = path.join(process.cwd(), '.planning', 'token-usage.jsonl');
if (!fs.existsSync(logPath)) {
  console.log('  No token data yet. Run a quorum round to populate.');
  process.exit(0);
}
const lines = fs.readFileSync(logPath, 'utf8').split('\n').filter(l => l.trim());
// Last 100 records only (file size guard — prevents slow display after extended use)
const recent = lines.slice(-100);
const slots = {};
for (const line of recent) {
  try {
    const r = JSON.parse(line);
    const key = r.slot || 'unknown';
    if (!slots[key]) slots[key] = { input: 0, output: 0, rounds: 0, hasNull: false };
    if (r.input_tokens === null) {
      slots[key].hasNull = true;
    } else {
      slots[key].input  += (r.input_tokens || 0);
      slots[key].output += (r.output_tokens || 0);
    }
    slots[key].rounds++;
  } catch (_) {}
}
const sorted = Object.entries(slots).sort((a, b) => (b[1].input + b[1].output) - (a[1].input + a[1].output));
if (sorted.length === 0) { console.log('  No token data yet.'); process.exit(0); }
console.log('');
console.log('  TOKEN CONSUMPTION (per slot, last 100 records)');
console.log('  slot             input        output       rounds');
console.log('  ─────────────────────────────────────────────────');
for (const [slot, data] of sorted) {
  const inp = data.hasNull && data.input === 0 ? 'null (CLI)' : data.input.toLocaleString();
  const out = data.hasNull && data.output === 0 ? 'null (CLI)' : data.output.toLocaleString();
  console.log('  ' + slot.padEnd(16) + inp.padStart(12) + out.padStart(13) + String(data.rounds).padStart(9));
}
console.log('');
"
```

Display the output inline in the health report, between the main status section and the Errors/Warnings section.
</step>

<step name="offer_repair">
**If repairable issues exist and --repair was NOT used:**

Ask user if they want to run repairs:

```
Would you like to run /qgsd:health --repair to fix N issues automatically?
```

If yes, re-run with --repair flag and display results.
</step>

<step name="verify_repairs">
**If repairs were performed:**

Re-run health check without --repair to confirm issues are resolved:

```bash
node ~/.claude/qgsd/bin/gsd-tools.cjs validate health
```

Report final status.
</step>

</process>

<error_codes>

| Code | Severity | Description | Repairable |
|------|----------|-------------|------------|
| E001 | error | .planning/ directory not found | No |
| E002 | error | PROJECT.md not found | No |
| E003 | error | ROADMAP.md not found | No |
| E004 | error | STATE.md not found | Yes |
| E005 | error | config.json parse error | Yes |
| W001 | warning | PROJECT.md missing required section | No |
| W002 | warning | STATE.md references invalid phase | Yes |
| W003 | warning | config.json not found | Yes |
| W004 | warning | config.json invalid field value | No |
| W005 | warning | Phase directory naming mismatch | No |
| W006 | warning | Phase in ROADMAP but no directory | No |
| W007 | warning | Phase on disk but not in ROADMAP | No |
| W008 | warning | Quorum slot has 3+ recurring failures | No |
| I001 | info | Plan without SUMMARY (may be in progress) | No |

</error_codes>

<repair_actions>

| Action | Effect | Risk |
|--------|--------|------|
| createConfig | Create config.json with defaults | None |
| resetConfig | Delete + recreate config.json | Loses custom settings |
| regenerateState | Create STATE.md from ROADMAP structure | Loses session history |

**Not repairable (too risky):**
- PROJECT.md, ROADMAP.md content
- Phase directory renaming
- Orphaned plan cleanup

</repair_actions>
