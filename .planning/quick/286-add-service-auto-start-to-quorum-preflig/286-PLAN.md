---
phase: quick-286
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - bin/quorum-preflight.cjs
autonomous: true
formal_artifacts: none
requirements:
  - QUICK-286
must_haves:
  truths:
    - "When ccr service is stopped, quorum-preflight --all auto-starts it before health probing"
    - "Service auto-start only runs once per preflight invocation, not per-slot"
    - "Start attempts and outcomes are logged to stderr for observability"
    - "Non-service slots (codex, gemini, opencode, copilot) are unaffected"
    - "If service start fails after polling, slot proceeds to health probe as before (fail-open)"
  artifacts:
    - path: "bin/quorum-preflight.cjs"
      provides: "Service auto-start before health probe fan-out"
      contains: "ensureServices"
  key_links:
    - from: "bin/quorum-preflight.cjs"
      to: "bin/providers.json"
      via: "reads service.status and service.start from provider entries"
      pattern: "p\\.service"
---

<objective>
Add service auto-start to quorum-preflight.cjs so that ccr-based slots (claude-1..6) are automatically started before the health probe fan-out, eliminating the "all T2 CCR UNAVAIL" cascade when ccr is stopped.

Purpose: When ccr is stopped, all 6 claude-* slots fail health probes simultaneously, causing total T2 unavailability. By checking service status and auto-starting before probing, preflight ensures ccr slots are available for quorum dispatch.

Output: Modified bin/quorum-preflight.cjs with service auto-start logic.
</objective>

<execution_context>
@/Users/jonathanborduas/.claude/nf/workflows/execute-plan.md
@/Users/jonathanborduas/.claude/nf/templates/summary.md
</execution_context>

<context>
@bin/quorum-preflight.cjs
@bin/providers.json
@commands/nf/mcp-repair.md (reference for polling pattern)
</context>

<tasks>

<task type="auto">
  <name>Task 1: Add ensureServices() to quorum-preflight.cjs</name>
  <files>bin/quorum-preflight.cjs</files>
  <action>
Add a new function `ensureServices(providers)` that runs ONCE before the `probeHealth()` call in the `--all` branch. This function:

1. **Deduplicate by service command** — Multiple claude-* slots share the same `service` block (`["ccr", "start"]`). Group providers by the stringified `service.status` command so we only check/start each unique service once. Use a `Set` keyed on `JSON.stringify(p.service.status)` to track already-checked services.

2. **Check status** — For each unique service, run `service.status` via `execFileSync(cmd, args, { encoding: 'utf8', timeout: 5000 })` (note: execFileSync is the safe variant that does NOT use a shell — no injection risk). If the output includes "not running" or "stopped" (case-insensitive), mark as needing start.

3. **Auto-start with polling** — For each service needing start:
   - Log to stderr: `[preflight] Service <cmd> is down, starting...`
   - Run `service.start` via `execFileSync(cmd, args, { encoding: 'utf8', timeout: 10000 })`
   - Poll `service.status` every 1s for up to 10 iterations (matching mcp-repair pattern):
     - Use a synchronous loop with `execFileSync('sleep', ['1'])` between polls
     - Check status output no longer contains "not running" or "stopped"
     - Break on success
   - Log result to stderr: `[preflight] Service <cmd> started (<X>s)` or `[preflight] Service <cmd> failed to start after 10s`

4. **Fail-open** — Wrap all execFileSync calls in try/catch. If status check throws, skip that service. If start throws, log warning to stderr and continue. Never throw from ensureServices — the health probe will still run regardless.

5. **Integration point** — In the `--all` branch of `main()`, call `ensureServices(activeProviders)` AFTER filtering to active providers but BEFORE `probeHealth(activeProviders)`. The function uses only sync calls so it completes before probing begins.

6. **Only run when probing** — Guard the ensureServices call behind the existing `if (PROBE)` check, so `--no-probe` skips service checks too.

Import `execFileSync` from child_process at the top (add to the existing destructure: change `const { spawn } = require('child_process')` to `const { spawn, execFileSync } = require('child_process')`).
  </action>
  <verify>
Run `node bin/quorum-preflight.cjs --all --no-probe 2>/dev/null | node -e "const j=JSON.parse(require('fs').readFileSync('/dev/stdin','utf8')); console.log('team keys:', Object.keys(j.team).length); console.log('has health:', 'health' in j)"` — should show team keys and no health (confirming --no-probe still works).

Then run `node bin/quorum-preflight.cjs --all 2>&1 | head -20` — should show service check logs on stderr (if ccr is stopped) or proceed normally (if already running), and JSON output on stdout.

Verify the function exists: `grep 'ensureServices' bin/quorum-preflight.cjs` returns matches.

Verify deduplication: `grep 'JSON.stringify' bin/quorum-preflight.cjs` confirms service dedup logic.

Verify fail-open: `grep -A2 'catch' bin/quorum-preflight.cjs | grep -c 'stderr\|continue'` shows error handling logs to stderr.
  </verify>
  <done>
quorum-preflight.cjs auto-starts ccr service when stopped, using 1s poll / 10s max pattern. Service check runs once per unique service command (not per-slot). All start attempts logged to stderr. Fail-open: errors in service management never prevent health probing.
  </done>
</task>

</tasks>

<verification>
- `node bin/quorum-preflight.cjs --all --no-probe` still outputs valid JSON without service checks
- `node bin/quorum-preflight.cjs --all` runs service checks before health probes
- `grep 'ensureServices' bin/quorum-preflight.cjs` confirms function exists
- `grep 'execFileSync' bin/quorum-preflight.cjs` confirms safe child_process usage
- Service dedup prevents redundant ccr status checks (all claude-* slots share same service block)
</verification>

<success_criteria>
- ccr service auto-started before health probe fan-out when stopped
- Service check deduplicated by unique service command (runs once, not 6 times)
- Polling uses 1s interval, 10s max (matches mcp-repair pattern)
- Start attempts logged to stderr with timing
- Fail-open: service errors never block health probing
- --no-probe flag skips service checks
- All existing preflight modes (--quorum-active, --max-quorum-size, --team) unaffected
</success_criteria>

<output>
After completion, create `.planning/quick/286-add-service-auto-start-to-quorum-preflig/286-SUMMARY.md`
</output>
