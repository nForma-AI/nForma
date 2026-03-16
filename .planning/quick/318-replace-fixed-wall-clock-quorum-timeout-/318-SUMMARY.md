# Quick Task 318 Summary: Replace fixed wall-clock quorum timeout with idle-based timeout

## Overview

Successfully implemented dual-timer logic in quorum subprocess dispatch to replace the fixed wall-clock timeout with an idle-based timeout that resets on stdout/stderr activity, plus a hard wall-clock cap as a safety net.

**Purpose:** Prevent premature kills of slow-but-actively-working CLI agents (Codex, Gemini, OpenCode produce output in bursts). The idle timeout catches truly stuck processes, while the hard cap prevents runaway processes.

## Completion Status

**All tasks completed:** 2/2
- Task 1: Implement dual-timer logic in runSubprocess and update timeout resolution ✓
- Task 2: Update classifyDispatchError and UNAVAIL detection in quorum-slot-dispatch.cjs ✓

## Files Modified

1. **bin/call-quorum-slot.cjs** — Dual-timer subprocess management
   - Updated `classifyErrorType()` to recognize IDLE_TIMEOUT, HARD_TIMEOUT, and legacy TIMEOUT patterns
   - Modified `runSubprocess()` signature from `(provider, prompt, timeoutMs, allowedToolsFlag)` to `(provider, prompt, idleTimeoutMs, hardTimeoutMs, allowedToolsFlag)`
   - Implemented dual timers: idle timer resets on stdout/stderr data, hard timer never resets
   - Updated error messages to distinguish IDLE_TIMEOUT vs HARD_TIMEOUT with duration info
   - Rewrote timeout resolution logic to compute `effectiveIdleTimeout` and `effectiveHardTimeout`
   - Updated `runSubprocessWithRotation()` to accept and forward both timeout parameters
   - Updated all call sites (oauth rotation path and standard path) to pass both timeouts
   - Added diagnostic logging of both timeout values per slot dispatch

2. **bin/providers.json** — Added timeout configuration fields
   - Added `idle_timeout_ms: 20000` (20s default) to all 12 provider entries
   - Added `hard_timeout_ms: 300000` (5min default) to all 12 provider entries
   - Placed after existing `quorum_timeout_ms` field
   - No existing fields removed (backward compatibility maintained)

3. **bin/quorum-slot-dispatch.cjs** — Updated error classification
   - Updated `classifyDispatchError()` JSDoc return type to include IDLE_TIMEOUT and HARD_TIMEOUT
   - Updated function logic to recognize both new timeout patterns before legacy TIMEOUT
   - Updated JSDoc for `emitResultBlock()` error_type parameter to document new types
   - UNAVAIL detection via `output.includes('TIMEOUT')` works unchanged (substring match)

## Implementation Details

### Dual-Timer Logic

The timeout system now uses two independent timers:

1. **Idle Timer** (resets on activity)
   - Default: 20 seconds
   - Resets every time stdout or stderr produces data
   - Triggers `killGroup()` with `timeoutType = 'IDLE'`
   - Catches processes that produce no output for extended periods

2. **Hard Timer** (never resets)
   - Default: 5 minutes (300 seconds)
   - Starts once, never resets
   - Triggers `killGroup()` with `timeoutType = 'HARD'` if idle timer hasn't already fired
   - Prevents infinite loops and runaway processes

### Timeout Resolution Strategy

The timeout computation respects the following hierarchy:

1. **CLI argument** (`--timeout` flag) → idle timeout override
2. **Provider configuration**:
   - `idle_timeout_ms`: idle inactivity threshold (default 20s)
   - `hard_timeout_ms`: absolute wall-clock cap (default 300s)
   - `quorum_timeout_ms`: caps the hard timeout (if present)
3. **LTCY-01 invariant**: `latency_budget_ms` is the ultimate ceiling for BOTH timeouts

Mathematical enforcement:
```javascript
effectiveIdleTimeout = Math.min(effectiveIdleTimeout, latencyBudget)
effectiveHardTimeout = Math.min(effectiveHardTimeout, latencyBudget)
effectiveHardTimeout = Math.max(effectiveHardTimeout, effectiveIdleTimeout)  // Hard >= Idle
```

### Error Message Format

- IDLE_TIMEOUT: `"IDLE_TIMEOUT after 20000ms of inactivity"`
- HARD_TIMEOUT: `"HARD_TIMEOUT after 300000ms total"`
- Legacy TIMEOUT: `"TIMEOUT after 30000ms"` (backward compat)

### Invariant Compliance

- **EventualDecision (mcp-calls)**: Preserved. Both timers eventually fire (finite timeouts), subprocess MUST terminate.
- **EventualConsensus (quorum)**: Preserved. Hard cap ensures no infinite waiting. Idle timeout ≤ hard cap enforced.
- **LTCY-01**: Preserved. latency_budget_ms acts as ultimate ceiling for both timeouts.

## Verification Results

All verification criteria passed:

```
✓ grep -c 'idleTimer' bin/call-quorum-slot.cjs = 10 (>= 4)
✓ grep -c 'hardTimer' bin/call-quorum-slot.cjs = 10 (>= 3)
✓ grep 'IDLE_TIMEOUT|HARD_TIMEOUT' across both files = 8 (>= 4)
✓ All providers have idle_timeout_ms=20000: true
✓ All providers have hard_timeout_ms=300000: true
✓ classifyDispatchError recognizes all three types:
  - IDLE_TIMEOUT after 20000ms of inactivity → 'IDLE_TIMEOUT'
  - HARD_TIMEOUT after 300000ms total → 'HARD_TIMEOUT'
  - TIMEOUT after 30000ms → 'TIMEOUT'
```

## Deviations from Plan

None - plan executed exactly as written.

## Success Criteria Met

- [x] Idle timer resets on every stdout/stderr data event in runSubprocess
- [x] Hard wall-clock cap timer never resets and fires after absolute elapsed time
- [x] Error messages clearly distinguish IDLE_TIMEOUT vs HARD_TIMEOUT with durations
- [x] Both classifyErrorType and classifyDispatchError recognize the new patterns
- [x] providers.json has idle_timeout_ms (20000) and hard_timeout_ms (300000) on all providers
- [x] latency_budget_ms still acts as the ultimate ceiling (LTCY-01)
- [x] --timeout CLI arg backward-compatible (maps to idle timeout)
- [x] All timer variables properly initialized and cleared
- [x] HTTP dispatch uses idle timeout (backward compatible with single timeout concept)

## Technical Notes

1. **Backward Compatibility**: The `--timeout` CLI argument maps to the idle timeout, so existing callers continue to work unchanged.

2. **Provider Defaults**: All providers inherit defaults (20s idle, 300s hard). Specific providers can override via `idle_timeout_ms` and `hard_timeout_ms` in their config.

3. **LTCY-01 Precedence**: When `latency_budget_ms` is set (e.g., claude-5: 15000ms), it tightens both timers to 15s max (below the normal defaults).

4. **Timer Cleanup**: Both timers are properly cleared in all exit paths (close, error), preventing memory leaks or dangling timeouts.

5. **Process Group Killing**: The dual-timer logic integrates seamlessly with existing process group termination (SIGTERM → 2s delay → SIGKILL), ensuring complete cleanup.
