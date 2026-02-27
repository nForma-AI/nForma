#!/usr/bin/env node
// hooks/qgsd-prompt.js
// UserPromptSubmit hook — three responsibilities:
//
// 1. CIRCUIT BREAKER RECOVERY: If the circuit breaker is active, inject the
//    oscillation-resolution-mode workflow into Claude's context so resolution
//    starts automatically on the next user message.
//
// 2. PENDING TASK INJECTION: If a pending-task file exists, atomically claim it
//    and inject it as a queued command (survives /clear). Session-scoped files
//    take priority over the generic file to prevent cross-session delivery.
//
// 3. QUORUM INJECTION: If the prompt is a GSD planning command, inject quorum
//    instructions so Claude runs multi-model review before presenting output.
//
// Output mechanism: hookSpecificOutput.additionalContext (NOT systemMessage)
// systemMessage only shows a UI warning; additionalContext goes into Claude's context.

'use strict';

const fs   = require('fs');
const path = require('path');
const os   = require('os');
const { spawnSync } = require('child_process');
const { loadConfig, slotToToolCall } = require('./config-loader');
const { schema_version } = require('./conformance-schema.cjs');

const DEFAULT_QUORUM_INSTRUCTIONS_FALLBACK = `QUORUM REQUIRED (structural enforcement — Stop hook will verify)

Run the full R3 quorum protocol inline (dispatch_pattern from commands/qgsd/quorum.md):

1. State Claude's own position (vote) first — APPROVE or BLOCK with 1-2 sentence rationale
2. Run provider pre-flight: node ~/.claude/qgsd-bin/check-provider-health.cjs --json
3. Dispatch all active slots as sibling qgsd-quorum-slot-worker Tasks in one message turn:
   Task(subagent_type="qgsd-quorum-slot-worker", prompt="slot: <slot>\\nround: 1\\n...")
4. Synthesize results inline. Deliberate up to 10 rounds per R3.3 if no consensus.
5. Update scoreboard: node ~/.claude/qgsd-bin/update-scoreboard.cjs merge-wave ...
6. Include the token <!-- GSD_DECISION --> in your FINAL output (only when delivering
   the completed plan, research, verification report, or filtered question list)

Fail-open: if a model is UNAVAILABLE (quota/error), note it and proceed with available models.
Failover rule: if a slot returns an error or quota exceeded, skip it and continue with remaining active slots.
The Stop hook reads the transcript — skipping quorum will block your response.`;

// Appends a structured conformance event to .planning/conformance-events.jsonl.
// Uses appendFileSync (atomic for writes < POSIX PIPE_BUF = 4096 bytes).
// Always wrapped in try/catch — hooks are fail-open; never crashes on logging failure.
// NEVER writes to stdout — stdout is the Claude Code hook decision channel.
function appendConformanceEvent(event) {
  try {
    const logPath = path.join(process.cwd(), '.planning', 'conformance-events.jsonl');
    fs.mkdirSync(path.dirname(logPath), { recursive: true });
    fs.appendFileSync(logPath, JSON.stringify(event) + '\n', 'utf8');
  } catch (err) {
    process.stderr.write('[qgsd] conformance log write failed: ' + err.message + '\n');
  }
}

// Locate the oscillation-resolution-mode workflow.
// Tries global install path first (~/.claude/qgsd/), then local (.claude/qgsd/).
function findResolutionWorkflow(cwd) {
  const candidates = [
    path.join(os.homedir(), '.claude', 'qgsd', 'workflows', 'oscillation-resolution-mode.md'),
    path.join(cwd, '.claude', 'qgsd', 'workflows', 'oscillation-resolution-mode.md'),
  ];
  for (const p of candidates) {
    if (fs.existsSync(p)) return fs.readFileSync(p, 'utf8');
  }
  return null;
}

// Atomically claim and read a pending-task file, if one exists.
// Checks session-scoped file first (.claude/pending-task-<sessionId>.txt) to prevent
// cross-session delivery, then falls back to the generic .claude/pending-task.txt.
// Uses fs.renameSync for atomic claiming — POSIX guarantees only one process wins.
// Returns the task string, or null if no pending task exists.
function consumePendingTask(cwd, sessionId) {
  const claudeDir = path.join(cwd, '.claude');
  if (!fs.existsSync(claudeDir)) return null;

  const candidates = [];
  if (sessionId) candidates.push(path.join(claudeDir, `pending-task-${sessionId}.txt`));
  candidates.push(path.join(claudeDir, 'pending-task.txt'));

  for (const pendingFile of candidates) {
    if (!fs.existsSync(pendingFile)) continue;

    const claimedFile = pendingFile + '.claimed';
    try {
      fs.renameSync(pendingFile, claimedFile); // atomic claim — only one session wins
    } catch {
      continue; // another session claimed it first, or file vanished — skip
    }

    try {
      const task = fs.readFileSync(claimedFile, 'utf8').trim();
      fs.unlinkSync(claimedFile);
      if (task) return task;
    } catch {
      try { fs.unlinkSync(claimedFile); } catch {} // best-effort cleanup
    }
  }
  return null;
}

// Parses --n N flag from a prompt string.
// Returns N (integer >= 1) if found, or null if absent/invalid.
function parseQuorumSizeFlag(prompt) {
  const m = prompt.match(/--n\s+(\d+)/);
  if (!m) return null;
  const n = parseInt(m[1], 10);
  return (Number.isInteger(n) && n >= 1) ? n : null;
}

// Check if the circuit breaker is active (and not disabled) for a given git root.
function isBreakerActive(cwd) {
  const gitResult = spawnSync('git', ['rev-parse', '--show-toplevel'], {
    cwd, encoding: 'utf8', timeout: 5000,
  });
  if (gitResult.status !== 0 || gitResult.error) return false;
  const gitRoot = gitResult.stdout.trim();
  const statePath = path.join(gitRoot, '.claude', 'circuit-breaker-state.json');
  if (!fs.existsSync(statePath)) return false;
  try {
    const state = JSON.parse(fs.readFileSync(statePath, 'utf8'));
    return state.active === true && state.disabled !== true;
  } catch { return false; }
}

let raw = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', chunk => raw += chunk);
process.stdin.on('end', () => {
  try {
    const input = JSON.parse(raw);
    const prompt    = (input.prompt || '').trim();
    const cwd       = input.cwd || process.cwd();
    const sessionId = input.session_id || null;

    // ── Priority 1: Circuit breaker active → inject resolution workflow ──────
    if (isBreakerActive(cwd)) {
      const workflow = findResolutionWorkflow(cwd);
      const context = workflow
        ? `CIRCUIT BREAKER ACTIVE — OSCILLATION RESOLUTION MODE\n\nYou MUST follow this procedure immediately before doing anything else:\n\n${workflow}`
        : `CIRCUIT BREAKER ACTIVE — OSCILLATION RESOLUTION MODE\n\nOscillation has been detected in recent commits. Tool calls are NOT blocked — you can still read and write files — but you MUST resolve the oscillation before making further commits.\nFollow the oscillation resolution procedure in R5 of CLAUDE.md:\n1. Run: git log --oneline --name-only -6 to identify the oscillating file set.\n2. Run quorum diagnosis with structural coupling framing.\n3. Present unified solution to user for approval.\n4. Do NOT commit until user approves AND runs: npx qgsd --reset-breaker`;
      process.stdout.write(JSON.stringify({
        hookSpecificOutput: {
          hookEventName: 'UserPromptSubmit',
          additionalContext: context,
        }
      }));
      process.exit(0);
    }

    // ── Priority 2: Pending task → inject queued command ─────────────────────
    const pendingTask = consumePendingTask(cwd, sessionId);
    if (pendingTask) {
      process.stdout.write(JSON.stringify({
        hookSpecificOutput: {
          hookEventName: 'UserPromptSubmit',
          additionalContext: `PENDING QUEUED TASK — Execute this immediately before anything else:\n\n${pendingTask}\n\n(This task was queued via /qgsd:queue before the previous /clear.)`,
        }
      }));
      process.exit(0);
    }

    // ── Priority 3: Planning command → inject quorum instructions ────────────
    const config = loadConfig(cwd);
    const commands = config.quorum_commands;

    // Parse --n N override from the raw prompt
    const quorumSizeOverride = parseQuorumSizeFlag(prompt);

    // Dynamic fallback step generation from quorum_active (COMP-02)
    const activeSlots = (config.quorum_active && config.quorum_active.length > 0)
      ? config.quorum_active
      : null; // null = use hardcoded fallback list

    let instructions;

    // Solo mode: --n 1 means Claude-only quorum — bypass all external slot dispatches
    if (quorumSizeOverride === 1) {
      instructions = `<!-- QGSD_SOLO_MODE -->\nSOLO MODE ACTIVE (--n 1): Self-quorum only. Skip ALL external slot-worker Task dispatches. Claude's vote is the quorum. Write <!-- GSD_DECISION --> in your final output. The Stop hook is informed.\n\n`;
    } else if (config.quorum_instructions) {
      // Explicit quorum_instructions in config — use as-is
      instructions = config.quorum_instructions;
    } else if (activeSlots) {
      // Build ordered slot list, sub agents first when preferSub is set
      const agentCfg = config.agent_config || {};
      const preferSub = !(config.quorum && config.quorum.preferSub === false);
      const maxSize = quorumSizeOverride !== null
        ? quorumSizeOverride
        : (config.quorum && Number.isInteger(config.quorum.maxSize) && config.quorum.maxSize >= 1)
          ? config.quorum.maxSize
          : 3;

      let orderedSlots = activeSlots.map(slot => ({
        slot,
        authType: (agentCfg[slot] && agentCfg[slot].auth_type) || 'api',
      }));
      if (preferSub) {
        orderedSlots.sort((a, b) => {
          if (a.authType === 'sub' && b.authType !== 'sub') return -1;
          if (a.authType !== 'sub' && b.authType === 'sub') return 1;
          return 0;
        });
      }

      // Cap external slots to N-1 when --n N override is active (N total = Claude + N-1 external)
      const externalSlotCap = quorumSizeOverride !== null ? quorumSizeOverride - 1 : orderedSlots.length;
      const cappedSlots = orderedSlots.slice(0, externalSlotCap);

      // Generate step list, with optional section headers when preferSub is on
      let stepLines = [];
      let stepNum = 1;
      const hasMixed = preferSub && cappedSlots.some(s => s.authType === 'sub') && cappedSlots.some(s => s.authType !== 'sub');
      let inApiSection = false;
      for (const { slot, authType } of cappedSlots) {
        if (hasMixed && authType !== 'sub' && !inApiSection) {
          stepLines.push('  [API agents — overflow if sub count insufficient]');
          inApiSection = true;
        }
        stepLines.push(`  ${stepNum}. Task(subagent_type="qgsd-quorum-slot-worker", prompt="slot: ${slot}\\nround: 1\\ntimeout_ms: 60000\\nrepo_dir: <cwd>\\nmode: A\\nquestion: <question>")`);
        stepNum++;
      }
      const dynamicSteps = stepLines.join('\n');
      const afterSteps = cappedSlots.length + 1;
      const minNote = quorumSizeOverride !== null
        ? ` (QUORUM SIZE OVERRIDE (--n ${quorumSizeOverride}): Cap at ${quorumSizeOverride} total participants — Claude + ${externalSlotCap} external slot${externalSlotCap !== 1 ? 's' : ''})`
        : maxSize < activeSlots.length
          ? ` (hard ceiling: ${maxSize} successful responses required — sub agents first)`
          : '';

      instructions = `QUORUM REQUIRED${minNote} (structural enforcement — Stop hook will verify)\n\n` +
        `Run the full R3 quorum protocol inline (dispatch_pattern from commands/qgsd/quorum.md):\n` +
        `Dispatch ALL active slots as parallel sibling qgsd-quorum-slot-worker Tasks in ONE message turn.\n` +
        `NEVER call mcp__*__* tools directly — use Task(subagent_type="qgsd-quorum-slot-worker") ONLY:\n` +
        (hasMixed ? '  [Subscription agents — preferred, flat-fee]\n' : '') +
        dynamicSteps + '\n\n' +
        `Failover rule: if a slot-worker returns UNAVAIL or error, skip it — errors do not count toward the ${maxSize} required.\n\n` +
        `After quorum:\n` +
        `  ${afterSteps}. Synthesize results inline. Deliberate up to 10 rounds per R3.3 if no consensus.\n` +
        `  ${afterSteps + 1}. Update scoreboard: node ~/.claude/qgsd-bin/update-scoreboard.cjs merge-wave ...\n` +
        `  ${afterSteps + 2}. Include the token <!-- GSD_DECISION --> in your FINAL output\n\n` +
        `Fail-open: if a model is UNAVAILABLE (quota/error), note it and proceed with available models.\n` +
        `The Stop hook reads the transcript — skipping quorum will block your response.`;
    } else {
      // Neither quorum_instructions nor quorum_active configured — use hardcoded fallback
      instructions = DEFAULT_QUORUM_INSTRUCTIONS_FALLBACK;
    }

    // Append model override block if any preferences are set.
    // Skip when activeSlots is configured: Task-based dispatch uses call-quorum-slot.cjs which
    // reads the model from providers.json — injecting mcp__*__* tool names here would
    // re-introduce the direct-MCP escape hatch that the activeSlots branch eliminates.
    const prefs = config.model_preferences || {};
    const overrideEntries = Object.entries(prefs).filter(([, m]) => m && typeof m === 'string');
    if (overrideEntries.length > 0 && !activeSlots) {
      // Agent key → primary quorum tool call mapping
      const AGENT_TOOL_MAP = {
        'codex-cli-1':  'mcp__codex-cli-1__review',
        'gemini-cli-1': 'mcp__gemini-cli-1__gemini',
        'opencode-1':   'mcp__opencode-1__opencode',
        'copilot-1':    'mcp__copilot-1__ask',
        'claude-1':     'mcp__claude-1__claude',
        'claude-2':     'mcp__claude-2__claude',
        'claude-3':     'mcp__claude-3__claude',
        'claude-4':     'mcp__claude-4__claude',
        'claude-5':     'mcp__claude-5__claude',
        'claude-6':     'mcp__claude-6__claude',
      };
      const lines = overrideEntries.map(([agent, model]) => {
        const tool = AGENT_TOOL_MAP[agent] || ('mcp__' + agent);
        return '  - When calling ' + tool + ', include model="' + model + '" in the tool input';
      }).join('\n');
      instructions += '\n\nModel overrides (from qgsd.json model_preferences):\n' +
        'The following agents have preferred models configured. Pass the specified model parameter:\n' +
        lines;
    }

    // Anchored allowlist — requires /gsd: or /qgsd: prefix and word boundary after command name.
    const cmdPattern = new RegExp('^\\s*\\/q?gsd:(' + commands.join('|') + ')(\\s|$)');
    if (!cmdPattern.test(prompt)) {
      process.exit(0); // Silent pass — UPS-05
    }

    appendConformanceEvent({
      ts:              new Date().toISOString(),
      phase:           'IDLE',
      action:          'quorum_start',
      slots_available: 0,
      vote_result:     null,
      outcome:         null,
      schema_version,
    });

    process.stdout.write(JSON.stringify({
      hookSpecificOutput: {
        hookEventName: 'UserPromptSubmit',
        additionalContext: instructions,
      }
    }));
    process.exit(0);

  } catch (e) {
    process.exit(0); // Fail-open on any error
  }
});
