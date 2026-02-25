---
phase: quick-107
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - bin/telemetry-collector.cjs
  - bin/issue-classifier.cjs
  - bin/setup-telemetry-cron.sh
  - hooks/qgsd-session-start.js
  - hooks/dist/qgsd-session-start.js
  - .gitignore
autonomous: true
requirements:
  - TELEMETRY-01
  - TELEMETRY-02
  - TELEMETRY-03
  - SESSION-01

must_haves:
  truths:
    - "Running telemetry-collector.cjs produces .planning/telemetry/report.json with MCP stats, quorum stats, and circuit breaker state"
    - "Running issue-classifier.cjs produces .planning/telemetry/pending-fixes.json with up to 3 prioritized issues"
    - "setup-telemetry-cron.sh installs a cron entry that runs both scripts hourly"
    - "At session start, if pending-fixes.json has an unsurfaced issue above threshold, Claude sees a 2-3 line additionalContext hint"
    - "Each issue is marked surfaced=true after injection so it does not repeat the next session"
    - ".planning/telemetry/ directory is gitignored"
  artifacts:
    - path: "bin/telemetry-collector.cjs"
      provides: "Reads ~/.claude/debug/, .planning/quorum-scoreboard.json, .claude/circuit-breaker-state.json. Writes .planning/telemetry/report.json."
    - path: "bin/issue-classifier.cjs"
      provides: "Reads report.json. Writes .planning/telemetry/pending-fixes.json with ranked issues."
    - path: "bin/setup-telemetry-cron.sh"
      provides: "Installs cron job: hourly telemetry-collector + issue-classifier run"
    - path: "hooks/qgsd-session-start.js"
      provides: "SessionStart hook with telemetry injection: reads pending-fixes.json, injects top unsurfaced issue as additionalContext, marks surfaced"
  key_links:
    - from: "bin/telemetry-collector.cjs"
      to: ".planning/telemetry/report.json"
      via: "fs.writeFileSync"
      pattern: "telemetry/report\\.json"
    - from: "bin/issue-classifier.cjs"
      to: ".planning/telemetry/pending-fixes.json"
      via: "fs.writeFileSync"
      pattern: "telemetry/pending-fixes\\.json"
    - from: "hooks/qgsd-session-start.js"
      to: ".planning/telemetry/pending-fixes.json"
      via: "fs.readFileSync + mark surfaced"
      pattern: "pending-fixes\\.json"
    - from: "hooks/qgsd-session-start.js"
      to: "process.stdout"
      via: "JSON.stringify hookSpecificOutput additionalContext"
      pattern: "additionalContext"
---

<objective>
Add passive telemetry infrastructure to QGSD: two CLI scripts that collect and classify operational issues from existing log sources, a cron installer, and a SessionStart hook extension that surfaces the top unsurfaced issue as a brief 2-3 line additionalContext hint at session start.

Purpose: Close the feedback loop between QGSD's operational data (MCP failures, quorum stats, oscillation events) and actionable self-improvement. Issues surface automatically without requiring manual log review.
Output: bin/telemetry-collector.cjs, bin/issue-classifier.cjs, bin/setup-telemetry-cron.sh, updated hooks/qgsd-session-start.js and hooks/dist/qgsd-session-start.js, .gitignore update.
</objective>

<execution_context>
@/Users/jonathanborduas/.claude/get-shit-done/workflows/execute-plan.md
@/Users/jonathanborduas/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md

Key patterns from existing codebase:
- bin/review-mcp-logs.cjs: parses ~/.claude/debug/*.txt using regex RE_COMPLETE/RE_FAILED/RE_RUNNING. Reuse these regex patterns in telemetry-collector.cjs (do NOT duplicate the parsing logic from scratch).
- hooks/qgsd-session-start.js: currently exits via process.exit(0) after secrets sync and CCR config. The telemetry injection runs AFTER the existing logic and writes additionalContext to stdout BEFORE process.exit(0). The hook must remain fail-open — any error in telemetry path must be caught and must not block session start.
- hooks/config-loader.js: shows the two-layer config pattern. The SessionStart hook resolves project cwd from the hook input JSON (input.cwd) to find .planning/telemetry/pending-fixes.json. NOT a hardcoded path. Fallback: process.cwd() if stdin parse fails.
- Install sync rule: edits to hooks/qgsd-session-start.js MUST be synced to hooks/dist/qgsd-session-start.js. Run cp hooks/qgsd-session-start.js hooks/dist/qgsd-session-start.js then node bin/install.js --claude --global.
- .gitignore already ignores .planning/quorum-scoreboard.json and .planning/conformance-events.jsonl. Add .planning/telemetry/ to the same "Internal planning documents" section.
</context>

<tasks>

<task type="auto">
  <name>Task 1: telemetry-collector.cjs and issue-classifier.cjs</name>
  <files>
    bin/telemetry-collector.cjs
    bin/issue-classifier.cjs
    .gitignore
  </files>
  <action>
Create bin/telemetry-collector.cjs.

Purpose: pure disk I/O. Reads existing log sources, aggregates stats, writes .planning/telemetry/report.json.
NEVER spawns Claude or calls any MCP tool. Must handle all missing files gracefully (first run).

Sources to read:

1. ~/.claude/debug/*.txt — reuse the same regex patterns from bin/review-mcp-logs.cjs:
   const RE_COMPLETE = /MCP server "([^"]+)": Tool '([^']+)' completed successfully in (\d+)ms/;
   const RE_FAILED   = /MCP server "([^"]+)": Tool '([^']+)' failed after (\d+)s: (.+)/;
   Collect per-server: totalCalls, failureCount, hangCount (duration > 60000ms), top 3 error reasons.
   Limit to last 7 days, last 100 files. If DEBUG_DIR does not exist, set mcp to empty defaults.

2. .planning/quorum-scoreboard.json (relative to process.cwd()) — if it exists:
   Parse. If it has a rounds array, count: total rounds, rounds where no model was available
   (rounds with empty or all-UNAVAILABLE votes). Derive quorum_failure_rate.
   If file absent or malformed: use zero defaults.

3. .claude/circuit-breaker-state.json (relative to process.cwd()) — if it exists:
   Read: active (bool), triggerCount (int if present), lastTriggeredAt (string if present).
   If absent: { active: false, triggerCount: 0, lastTriggeredAt: null }.

Output schema written to .planning/telemetry/report.json:
{
  "generatedAt": "<ISO timestamp>",
  "mcp": {
    "servers": { "<name>": { "totalCalls": N, "failureCount": N, "hangCount": N, "topErrors": ["..."] } },
    "alwaysFailing": ["<server-name>"],
    "slowServers": [{ "name": "...", "p95Ms": N }]
  },
  "quorum": {
    "totalRounds": N,
    "allUnavailableRounds": N,
    "quorumFailureRate": 0.0
  },
  "circuitBreaker": {
    "active": false,
    "triggerCount": 0,
    "lastTriggeredAt": null
  }
}

Create .planning/telemetry/ with fs.mkdirSync({ recursive: true }).
Write report.json with JSON.stringify(report, null, 2).
Include a percentile helper function (same logic as review-mcp-logs.cjs: sort, index by ceil(p/100 * len)-1).

---

Create bin/issue-classifier.cjs.

Purpose: reads .planning/telemetry/report.json, ranks issues, writes .planning/telemetry/pending-fixes.json.
NEVER invokes Claude or MCP.

Priority scoring rules (higher score = worse, higher surfacing priority):
- alwaysFailing server: 100 points each (token waste on every quorum round)
- circuitBreaker.active = true: 90 points
- hangCount > 5 for a server: 80 points
- quorumFailureRate > 0.5: 70 points
- slowServer with p95 > 30s: 60 points
- circuitBreaker.triggerCount > 3: 50 points

For each detected issue, generate an object:
{
  "id": "<slug>",          // e.g. "mcp-always-failing-deepseek"
  "priority": N,
  "description": "...",    // one sentence
  "action": "...",         // one sentence recommended action
  "surfaced": false,
  "detectedAt": "<ISO>"
}

Sort by priority descending, take top 3.

Output schema for .planning/telemetry/pending-fixes.json:
{
  "generatedAt": "<ISO>",
  "issues": [ ... ]
}

If report.json is absent or malformed: write pending-fixes.json with empty issues array and exit 0.
Create .planning/telemetry/ with recursive mkdir.

---

Update .gitignore:
Add ".planning/telemetry/" to the "Internal planning documents" section, after the ".planning/quorum-scoreboard.json" line.
  </action>
  <verify>
    <automated>cd /Users/jonathanborduas/code/QGSD &amp;&amp; node bin/telemetry-collector.cjs &amp;&amp; node bin/issue-classifier.cjs &amp;&amp; node -e "const r=require('./.planning/telemetry/report.json'); const keys=Object.keys(r); if(!keys.includes('mcp')||!keys.includes('quorum')||!keys.includes('circuitBreaker')){console.error('FAIL report keys:',keys);process.exit(1);} const f=require('./.planning/telemetry/pending-fixes.json'); if(!Array.isArray(f.issues)){console.error('FAIL issues not array');process.exit(1);} console.log('PASS: report.json keys='+keys.join(',')+', issues='+f.issues.length);"</automated>
    <manual>Verify .planning/telemetry/report.json and pending-fixes.json exist with valid JSON matching the output schemas above</manual>
  </verify>
  <done>Both scripts run without error on first run (no existing telemetry data). report.json has top-level keys: generatedAt, mcp, quorum, circuitBreaker. pending-fixes.json has keys: generatedAt, issues (array, 0-3 items). .gitignore contains ".planning/telemetry/".</done>
</task>

<task type="auto">
  <name>Task 2: cron installer and SessionStart telemetry injection</name>
  <files>
    bin/setup-telemetry-cron.sh
    hooks/qgsd-session-start.js
    hooks/dist/qgsd-session-start.js
  </files>
  <action>
Create bin/setup-telemetry-cron.sh:

Shell script that installs an hourly cron entry for telemetry. Requirements:
- Detect script directory: SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" &amp;&amp; pwd)"
- NODE_BIN: use "$(command -v node)"
- CRON_CMD: "$NODE_BIN $SCRIPT_DIR/telemetry-collector.cjs &amp;&amp; $NODE_BIN $SCRIPT_DIR/issue-classifier.cjs"
- Cron schedule: "0 * * * *" (top of every hour)
- Idempotency check: if crontab -l 2>/dev/null | grep -q "telemetry-collector"; then print "Telemetry cron already installed." and exit 0.
- Install: (crontab -l 2>/dev/null; echo "0 * * * * $CRON_CMD >> /tmp/qgsd-telemetry.log 2>&amp;1") | crontab -
- Print "Telemetry cron installed." on success.
- End with comment block:
  # Windows: use Task Scheduler. Create a Basic Task that runs:
  #   node C:\path\to\qgsd\bin\telemetry-collector.cjs
  # followed by: node C:\path\to\qgsd\bin\issue-classifier.cjs
  # Trigger: Daily, repeat every 1 hour indefinitely.
Run: chmod 755 bin/setup-telemetry-cron.sh after creating the file.

---

Modify hooks/qgsd-session-start.js to add telemetry injection.

The existing hook is an async IIFE that does secrets sync then CCR config, then process.exit(0).
It does NOT currently read from stdin.

Required change: add stdin reading to get input.cwd, then add a telemetry surfacing block inside the async IIFE, just before the final process.exit(0).

Implementation pattern (model after qgsd-prompt.js stdin reading, but adapted for async IIFE):

At the top of the file, BEFORE the async IIFE, add stdin accumulation:
  let _stdinRaw = '';
  process.stdin.setEncoding('utf8');
  process.stdin.on('data', c => _stdinRaw += c);

  let _stdinReady;
  const _stdinPromise = new Promise(resolve => { _stdinReady = resolve; });
  process.stdin.on('end', () => _stdinReady());

Inside the async IIFE, at the very beginning (before the secrets call), add:
  await _stdinPromise;
  let _hookCwd = process.cwd();
  try { _hookCwd = JSON.parse(_stdinRaw).cwd || process.cwd(); } catch (_) {}

Then add the telemetry block JUST BEFORE the final process.exit(0):

  // Telemetry surfacing — inject top unsurfaced issue as additionalContext
  try {
    const fixesPath = path.join(_hookCwd, '.planning', 'telemetry', 'pending-fixes.json');
    if (fs.existsSync(fixesPath)) {
      const fixes = JSON.parse(fs.readFileSync(fixesPath, 'utf8'));
      const issue = (fixes.issues || []).find(i => !i.surfaced &amp;&amp; i.priority >= 50);
      if (issue) {
        issue.surfaced = true;
        issue.surfacedAt = new Date().toISOString();
        fs.writeFileSync(fixesPath, JSON.stringify(fixes, null, 2), 'utf8');
        const ctx = 'Telemetry alert [priority=' + issue.priority + ']: ' + issue.description + '\nSuggested fix: ' + issue.action;
        process.stdout.write(JSON.stringify({
          hookSpecificOutput: { hookEventName: 'SessionStart', additionalContext: ctx }
        }));
      }
    }
  } catch (_) {}

CRITICAL: The entire telemetry block is wrapped in try/catch and is fail-open. Any error silently skips.
CRITICAL: process.stdout.write is called ONLY if an unsurfaced issue is found. Otherwise no stdout output (existing behavior preserved).
CRITICAL: The existing secrets sync and CCR config logic must remain completely unchanged.

After editing hooks/qgsd-session-start.js, run:
  cp /Users/jonathanborduas/code/QGSD/hooks/qgsd-session-start.js /Users/jonathanborduas/code/QGSD/hooks/dist/qgsd-session-start.js
  node /Users/jonathanborduas/code/QGSD/bin/install.js --claude --global
  </action>
  <verify>
    <automated>cd /Users/jonathanborduas/code/QGSD &amp;&amp; bash bin/setup-telemetry-cron.sh &amp;&amp; crontab -l 2>/dev/null | grep -q "telemetry-collector" &amp;&amp; echo "PASS: cron installed" || (echo "FAIL: cron not found"; exit 1)</automated>
    <manual>
Simulate the SessionStart hook with a test issue to verify injection and surfacing:

  cd /Users/jonathanborduas/code/QGSD
  node -e "
    const fs = require('fs'), path = require('path');
    const planningDir = path.join(process.cwd(), '.planning', 'telemetry');
    fs.mkdirSync(planningDir, { recursive: true });
    fs.writeFileSync(path.join(planningDir, 'pending-fixes.json'), JSON.stringify({
      generatedAt: new Date().toISOString(),
      issues: [{ id: 'test-issue', priority: 80, description: 'Test MCP server always fails.', action: 'Run /qgsd:quick to fix.', surfaced: false, detectedAt: new Date().toISOString() }]
    }));
    const { spawnSync } = require('child_process');
    const input = JSON.stringify({ cwd: process.cwd() });
    const result = spawnSync(process.execPath, ['hooks/dist/qgsd-session-start.js'], { input, encoding: 'utf8', timeout: 10000 });
    if (!result.stdout) { console.error('FAIL: no stdout'); process.exit(1); }
    const out = JSON.parse(result.stdout);
    if (!out.hookSpecificOutput.additionalContext.includes('Test MCP server')) { console.error('FAIL: wrong context'); process.exit(1); }
    const updated = JSON.parse(fs.readFileSync(path.join(planningDir, 'pending-fixes.json'), 'utf8'));
    if (!updated.issues[0].surfaced) { console.error('FAIL: not marked surfaced'); process.exit(1); }
    console.log('PASS: hook injects issue and marks surfaced');
  "
    </manual>
  </verify>
  <done>
    setup-telemetry-cron.sh creates a cron entry; running twice is idempotent.
    Simulated SessionStart hook call with a pending issue writes hookSpecificOutput.additionalContext containing the issue description and marks issue.surfaced = true.
    Running the hook again with the now-surfaced issue produces no stdout (no repeat injection).
    hooks/dist/qgsd-session-start.js matches hooks/qgsd-session-start.js.
    node bin/install.js --claude --global completes without error.
  </done>
</task>

</tasks>

<verification>
End-to-end flow:
1. node bin/telemetry-collector.cjs produces .planning/telemetry/report.json — no crash, valid JSON with keys generatedAt/mcp/quorum/circuitBreaker
2. node bin/issue-classifier.cjs produces .planning/telemetry/pending-fixes.json — no crash, valid JSON, 0-3 issues
3. bash bin/setup-telemetry-cron.sh installs cron; running twice prints "already installed"
4. SessionStart hook with pending issue: additionalContext contains issue description, issue marked surfaced=true
5. SessionStart hook with no pending issue: no stdout output (existing exit(0) behavior preserved, secrets sync still runs)
6. grep ".planning/telemetry" .gitignore returns a match
</verification>

<success_criteria>
- All 3 Layer 1 scripts exist and run cleanly on first run
- SessionStart hook injects exactly 1 issue (2-3 lines max) when an unsurfaced issue with priority >= 50 exists
- Hook marks issue surfaced=true so it does not repeat next session
- .planning/telemetry/ is gitignored
- hooks/dist/qgsd-session-start.js is in sync with hooks/qgsd-session-start.js after cp
- node bin/install.js --claude --global deploys the updated hook successfully
</success_criteria>

<output>
After completion, create `.planning/quick/107-qgsd-self-improvement-passive-telemetry-/107-SUMMARY.md`
</output>
