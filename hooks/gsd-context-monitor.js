#!/usr/bin/env node
// hooks/gsd-context-monitor.js
// PostToolUse hook — context window monitor.
//
// Reads context_window metrics from the PostToolUse event payload.
// Injects WARNING or CRITICAL into additionalContext when context usage
// exceeds configurable thresholds. Fails open on all errors.
//
// Config: context_monitor.warn_pct (default 70%) and
//         context_monitor.critical_pct (default 90%) in nf.json.
// Two-layer merge via shared config-loader.

'use strict';

const { loadConfig, shouldRunHook } = require('./config-loader');

let raw = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', chunk => { raw += chunk; });
process.stdin.on('end', () => {
  try {
    const input = JSON.parse(raw);

    // Profile guard — exit early if this hook is not active for the current profile
    const config = loadConfig(input.cwd || process.cwd());
    const profile = config.hook_profile || 'standard';
    if (!shouldRunHook('gsd-context-monitor', profile)) {
      process.exit(0);
    }

    const ctxWindow = input.context_window;
    if (!ctxWindow || ctxWindow.remaining_percentage == null) {
      process.exit(0); // No context data — fail-open
    }

    const remaining = ctxWindow.remaining_percentage;
    const usedPct = Math.round(100 - remaining);

    const config = loadConfig(input.cwd || process.cwd());
    const monitorCfg = config.context_monitor || {};
    const warnPct = monitorCfg.warn_pct != null ? monitorCfg.warn_pct : 70;
    const criticalPct = monitorCfg.critical_pct != null ? monitorCfg.critical_pct : 90;

    let message;
    if (usedPct >= criticalPct) {
      message =
        `CONTEXT MONITOR CRITICAL: Context window ${usedPct}% used (${Math.round(remaining)}% remaining). ` +
        'STOP new work immediately. Save state and inform the user that context is nearly exhausted. ' +
        'Run /nf:pause-work to save execution state.';
    } else if (usedPct >= warnPct) {
      message =
        `CONTEXT MONITOR WARNING: Context window ${usedPct}% used (${Math.round(remaining)}% remaining). ` +
        'Begin wrapping up current task. Do not start new complex work. ' +
        'Consider /nf:pause-work to save state.';
    } else {
      process.exit(0); // Below warning threshold — no injection needed
    }

    process.stdout.write(JSON.stringify({
      hookSpecificOutput: {
        hookEventName: 'PostToolUse',
        additionalContext: message,
      },
    }));
    process.exit(0);

  } catch (e) {
    // Fail-open: never crash the user's session on any unexpected error
    process.exit(0);
  }
});
