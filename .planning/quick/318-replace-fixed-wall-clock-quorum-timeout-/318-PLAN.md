---
phase: quick-318
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - bin/call-quorum-slot.cjs
  - bin/quorum-slot-dispatch.cjs
  - bin/providers.json
autonomous: true
formal_artifacts: none
requirements: [QUICK-318]

must_haves:
  truths:
    - "Idle timer resets on every stdout/stderr data event from subprocess"
    - "Hard wall-clock cap kills subprocess after absolute elapsed time regardless of activity"
    - "TIMEOUT error messages distinguish IDLE_TIMEOUT vs HARD_TIMEOUT with duration info"
    - "classifyErrorType and classifyDispatchError recognize both IDLE_TIMEOUT and HARD_TIMEOUT"
    - "latency_budget_ms still acts as ultimate ceiling (LTCY-01 preserved)"
    - "Existing --timeout CLI arg maps to idle timeout without breaking callers"
  artifacts:
    - path: "bin/call-quorum-slot.cjs"
      provides: "idle-based + hard-cap timeout in runSubprocess"
      contains: "IDLE_TIMEOUT"
    - path: "bin/call-quorum-slot.cjs"
      provides: "classifyErrorType recognizing both timeout types"
      contains: "HARD_TIMEOUT"
    - path: "bin/quorum-slot-dispatch.cjs"
      provides: "classifyDispatchError recognizing both timeout types"
      contains: "IDLE_TIMEOUT"
    - path: "bin/providers.json"
      provides: "idle_timeout_ms and hard_timeout_ms fields per provider"
      contains: "idle_timeout_ms"
  key_links:
    - from: "bin/call-quorum-slot.cjs"
      to: "bin/providers.json"
      via: "timeout resolution reads idle_timeout_ms and hard_timeout_ms"
      pattern: "idle_timeout_ms|hard_timeout_ms"
    - from: "bin/call-quorum-slot.cjs runSubprocess"
      to: "child.stdout/stderr on data"
      via: "clearTimeout + setTimeout reset on each chunk"
      pattern: "clearTimeout.*idleTimer"
    - from: "bin/quorum-slot-dispatch.cjs"
      to: "IDLE_TIMEOUT|HARD_TIMEOUT patterns"
      via: "classifyDispatchError regex"
      pattern: "IDLE_TIMEOUT|HARD_TIMEOUT"
---

<objective>
Replace the fixed wall-clock timeout in quorum subprocess dispatch with an idle-based timeout that resets on stdout/stderr activity, plus a hard wall-clock cap as a safety net.

Purpose: Prevent premature kills of slow-but-actively-working CLI agents (Codex, Gemini, OpenCode produce output in bursts). The idle timeout catches truly stuck processes, while the hard cap prevents runaway processes.

Output: Modified call-quorum-slot.cjs with dual-timer logic, updated providers.json with new timeout fields, updated error classification in both dispatch files.
</objective>

<execution_context>
@/Users/jonathanborduas/.claude/nf/workflows/execute-plan.md
@/Users/jonathanborduas/.claude/nf/templates/summary.md
</execution_context>

<context>
@bin/call-quorum-slot.cjs
@bin/quorum-slot-dispatch.cjs
@bin/providers.json
@.planning/formal/spec/mcp-calls/invariants.md
@.planning/formal/spec/quorum/invariants.md
</context>

<tasks>

<task type="auto">
  <name>Task 1: Implement dual-timer logic in runSubprocess and update timeout resolution</name>
  <files>bin/call-quorum-slot.cjs, bin/providers.json</files>
  <action>
**In bin/call-quorum-slot.cjs:**

1. Modify `runSubprocess(provider, prompt, idleTimeoutMs, hardTimeoutMs, allowedToolsFlag)` — add `hardTimeoutMs` parameter (fifth arg). Keep fourth arg as `idleTimeoutMs` (renamed from `timeoutMs` for clarity).

2. Replace the single `setTimeout` block (lines 349-352) with dual timers:

```js
let timedOut = false;
let timeoutType = ''; // 'IDLE' or 'HARD'

// Idle timer — resets on every stdout/stderr data event
let idleTimer = setTimeout(() => {
  timedOut = true;
  timeoutType = 'IDLE';
  killGroup();
}, idleTimeoutMs);

// Hard wall-clock cap — never resets, absolute safety net
const hardTimer = setTimeout(() => {
  if (!timedOut) {
    timedOut = true;
    timeoutType = 'HARD';
    killGroup();
  }
}, hardTimeoutMs);
```

3. In `child.stdout.on('data')` handler, add idle timer reset BEFORE the buffer append:
```js
child.stdout.on('data', d => {
  clearTimeout(idleTimer);
  idleTimer = setTimeout(() => { timedOut = true; timeoutType = 'IDLE'; killGroup(); }, idleTimeoutMs);
  if (stdout.length < MAX_BUF) stdout += d.toString().slice(0, MAX_BUF - stdout.length);
});
```

4. In `child.stderr.on('data')` handler, add the same idle timer reset:
```js
child.stderr.on('data', d => {
  clearTimeout(idleTimer);
  idleTimer = setTimeout(() => { timedOut = true; timeoutType = 'IDLE'; killGroup(); }, idleTimeoutMs);
  stderr += d.toString().slice(0, 4096);
});
```

5. In `child.on('close')`, clear BOTH timers: `clearTimeout(idleTimer); clearTimeout(hardTimer);`
   Update the error message to distinguish types:
   ```js
   if (timedOut) {
     const label = timeoutType === 'HARD'
       ? `HARD_TIMEOUT after ${hardTimeoutMs}ms total`
       : `IDLE_TIMEOUT after ${idleTimeoutMs}ms of inactivity`;
     reject(new Error(label));
     return;
   }
   ```

6. In `child.on('error')`, also clear both: `clearTimeout(idleTimer); clearTimeout(hardTimer);`

7. Update `classifyErrorType` function to recognize both patterns:
   Change the TIMEOUT line from:
   `if (/TIMEOUT/i.test(msg)) return 'TIMEOUT';`
   to:
   `if (/IDLE_TIMEOUT/i.test(msg)) return 'IDLE_TIMEOUT';`
   `if (/HARD_TIMEOUT/i.test(msg)) return 'HARD_TIMEOUT';`
   `if (/TIMEOUT/i.test(msg)) return 'TIMEOUT'; // backward compat for old log entries`

8. Update the timeout resolution block (lines 536-551) to compute TWO values — `effectiveIdleTimeout` and `effectiveHardTimeout`:
   - `idle_timeout_ms` from provider (default 20000) is the idle timeout base
   - `hard_timeout_ms` from provider (default 300000) is the hard cap base
   - `--timeout` CLI arg maps to idle timeout override (backward compat)
   - `latency_budget_ms` (LTCY-01) is the ultimate ceiling for BOTH — `Math.min(effectiveIdle, latencyBudget)` and `Math.min(effectiveHard, latencyBudget)`
   - `quorum_timeout_ms` caps the hard timeout: `Math.min(hardTimeout, quorum_timeout_ms)` when both present

   Concrete logic:
   ```js
   const latencyBudget = provider.latency_budget_ms ?? null;
   const providerIdle = provider.idle_timeout_ms ?? 20000;
   const providerHard = provider.hard_timeout_ms ?? 300000;
   const providerCap = provider.quorum_timeout_ms ?? null;

   let effectiveIdleTimeout = timeoutMs ?? providerIdle;
   let effectiveHardTimeout = providerHard;

   // quorum_timeout_ms caps the hard timeout
   if (providerCap !== null) {
     effectiveHardTimeout = Math.min(effectiveHardTimeout, providerCap);
   }

   // LTCY-01: latency_budget_ms is the ultimate ceiling for both
   if (latencyBudget !== null && latencyBudget > 0) {
     effectiveIdleTimeout = Math.min(effectiveIdleTimeout, latencyBudget);
     effectiveHardTimeout = Math.min(effectiveHardTimeout, latencyBudget);
     process.stderr.write(`[call-quorum-slot] Using latency_budget_ms=${latencyBudget} for slot ${slot}\n`);
   }

   // Hard cap must be >= idle timeout (otherwise idle never fires)
   effectiveHardTimeout = Math.max(effectiveHardTimeout, effectiveIdleTimeout);
   ```

9. Update ALL call sites of `runSubprocess` to pass both timeouts:
   - Line ~561 (oauth rotation path): `runSubprocessWithRotation(provider, prompt, effectiveIdleTimeout, effectiveHardTimeout, allowedTools)` — also update `runSubprocessWithRotation` to accept and forward `hardTimeoutMs`
   - Line ~565 (standard path): `runSubprocess(provider, prompt, effectiveIdleTimeout, effectiveHardTimeout, allowedTools)`

10. Log the dual timeouts: `process.stderr.write(`[call-quorum-slot] Timeouts: idle=${effectiveIdleTimeout}ms hard=${effectiveHardTimeout}ms for slot ${slot}\n`);`

**In bin/providers.json:**

Add `idle_timeout_ms` and `hard_timeout_ms` fields to EVERY provider entry:
- `"idle_timeout_ms": 20000` (20s default for all providers)
- `"hard_timeout_ms": 300000` (5min default — matches existing timeout_ms)

Place them right after the existing `quorum_timeout_ms` field in each provider block. Do NOT remove any existing fields (`timeout_ms`, `quorum_timeout_ms`, `latency_budget_ms` all stay).

**Invariant compliance:**
- EventualDecision (mcp-calls): Preserved. Both timers eventually fire (finite timeouts), so the subprocess MUST terminate. The idle timer is bounded by idleTimeoutMs; the hard timer is bounded by hardTimeoutMs. Either triggers killGroup(), ensuring the process terminates and the promise resolves/rejects.
- EventualConsensus (quorum): Preserved. The hard cap ensures no infinite waiting. The idle timeout is strictly shorter than or equal to the hard cap (enforced by Math.max).
  </action>
  <verify>
Run `node -e "const p = require('./bin/providers.json'); const c = p.providers[0]; console.log(c.idle_timeout_ms, c.hard_timeout_ms)"` from repo root — should print `20000 300000`.

Run `grep -c 'IDLE_TIMEOUT\|HARD_TIMEOUT' bin/call-quorum-slot.cjs` — should return 6+ matches (timer set, error message, classifyErrorType).

Run `grep 'idleTimer\|hardTimer' bin/call-quorum-slot.cjs | head -10` — should show both timer variables.

Run `grep 'effectiveIdleTimeout\|effectiveHardTimeout' bin/call-quorum-slot.cjs | head -5` — should show both computed values.

Run existing tests: `node --test test/resolve-cli-integration.test.cjs` — should pass (no regressions).

Run `npm test 2>&1 | tail -5` — full test suite should pass.
  </verify>
  <done>
runSubprocess uses dual timers (idle resets on data, hard never resets). Timeout resolution computes both values from provider config. LTCY-01 caps both. All existing tests pass. providers.json has idle_timeout_ms and hard_timeout_ms on every provider.
  </done>
</task>

<task type="auto">
  <name>Task 2: Update classifyDispatchError and UNAVAIL detection in quorum-slot-dispatch.cjs</name>
  <files>bin/quorum-slot-dispatch.cjs</files>
  <action>
1. Update `classifyDispatchError` function (line 60) to recognize both new timeout patterns:
   Change:
   `if (/TIMEOUT/i.test(s)) return 'TIMEOUT';`
   to:
   `if (/IDLE_TIMEOUT/i.test(s)) return 'IDLE_TIMEOUT';`
   `if (/HARD_TIMEOUT/i.test(s)) return 'HARD_TIMEOUT';`
   `if (/TIMEOUT/i.test(s)) return 'TIMEOUT'; // backward compat`

2. Update the JSDoc return type annotation (line 58) to include the new types:
   `@returns {'IDLE_TIMEOUT'|'HARD_TIMEOUT'|'TIMEOUT'|'AUTH'|'QUOTA'|'SPAWN_ERROR'|'CLI_SYNTAX'|'UNKNOWN'}`

3. Update the UNAVAIL detection line (~1066) that checks `output.includes('TIMEOUT')`:
   Change to: `output.includes('TIMEOUT')` — this still works because both IDLE_TIMEOUT and HARD_TIMEOUT contain the substring "TIMEOUT". No change needed here, just verify it works.

4. Verify the `error_type` field in the emitResultBlock JSDoc (~line 763) documents the new types:
   Update: `@param {string} [opts.error_type] — classified error type for UNAVAIL results (IDLE_TIMEOUT/HARD_TIMEOUT/TIMEOUT/AUTH/QUOTA/SPAWN_ERROR/CLI_SYNTAX/UNKNOWN)`
  </action>
  <verify>
Run `grep -n 'IDLE_TIMEOUT\|HARD_TIMEOUT' bin/quorum-slot-dispatch.cjs` — should show matches in classifyDispatchError and JSDoc.

Run `node -e "const m = require('./bin/quorum-slot-dispatch.cjs'); console.log(m.classifyDispatchError('IDLE_TIMEOUT after 20000ms of inactivity'), m.classifyDispatchError('HARD_TIMEOUT after 300000ms total'), m.classifyDispatchError('TIMEOUT after 30000ms'))"` — should print `IDLE_TIMEOUT HARD_TIMEOUT TIMEOUT`.

Run `npm test 2>&1 | tail -5` — full test suite passes.
  </verify>
  <done>
classifyDispatchError recognizes IDLE_TIMEOUT, HARD_TIMEOUT, and legacy TIMEOUT patterns. JSDoc updated. UNAVAIL detection still works via substring match. All tests pass.
  </done>
</task>

</tasks>

<verification>
1. `grep -c 'idleTimer' bin/call-quorum-slot.cjs` returns 4+ (declaration, set in data handlers, clear in close/error)
2. `grep -c 'hardTimer' bin/call-quorum-slot.cjs` returns 3+ (declaration, clear in close/error)
3. `grep 'IDLE_TIMEOUT' bin/call-quorum-slot.cjs bin/quorum-slot-dispatch.cjs | wc -l` returns 4+
4. `grep 'HARD_TIMEOUT' bin/call-quorum-slot.cjs bin/quorum-slot-dispatch.cjs | wc -l` returns 4+
5. `node -e "const p = require('./bin/providers.json'); const all = p.providers.every(pr => pr.idle_timeout_ms === 20000 && pr.hard_timeout_ms === 300000); console.log(all)"` prints `true`
6. `npm test` passes with 0 failures
</verification>

<success_criteria>
- Idle timer resets on every stdout/stderr data event in runSubprocess
- Hard wall-clock cap timer never resets and fires after absolute elapsed time
- Error messages clearly distinguish IDLE_TIMEOUT vs HARD_TIMEOUT with durations
- Both classifyErrorType and classifyDispatchError recognize the new patterns
- providers.json has idle_timeout_ms (20000) and hard_timeout_ms (300000) on all providers
- latency_budget_ms still acts as the ultimate ceiling (LTCY-01)
- --timeout CLI arg backward-compatible (maps to idle timeout)
- All existing tests pass
</success_criteria>

<output>
After completion, create `.planning/quick/318-replace-fixed-wall-clock-quorum-timeout-/318-SUMMARY.md`
</output>
