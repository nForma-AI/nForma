#!/usr/bin/env node
// hooks/qgsd-prompt.js
// UserPromptSubmit hook — two responsibilities:
//
// 1. CIRCUIT BREAKER RECOVERY: If the circuit breaker is active, inject the
//    oscillation-resolution-mode workflow into Claude's context so resolution
//    starts automatically on the next user message.
//
// 2. QUORUM INJECTION: If the prompt is a GSD planning command, inject quorum
//    instructions so Claude runs multi-model review before presenting output.
//
// Output mechanism: hookSpecificOutput.additionalContext (NOT systemMessage)
// systemMessage only shows a UI warning; additionalContext goes into Claude's context.

'use strict';

const fs   = require('fs');
const path = require('path');
const os   = require('os');
const { spawnSync } = require('child_process');
const { loadConfig } = require('./config-loader');

const DEFAULT_QUORUM_INSTRUCTIONS_FALLBACK = `QUORUM REQUIRED (structural enforcement — Stop hook will verify)

**Preferred method — spawn the quorum orchestrator agent:**

  Task(subagent_type="qgsd-quorum-orchestrator", prompt="[your plan/question/decision here]")

  The orchestrator handles provider pre-flight, team identity, sequential model calls,
  deliberation rounds, scoreboard updates, and returns a structured consensus verdict.
  The Stop hook recognises this Task call as valid quorum evidence — no additional
  model calls are needed in the main conversation.

**Fallback (if orchestrator unavailable) — call models directly:**
  1. Call mcp__codex-cli-1__review with the full plan content
  2. Call mcp__gemini-cli-1__gemini with the full plan content
  3. Call mcp__opencode-1__opencode with the full plan content
  4. Call mcp__copilot-1__ask with the full plan content

After quorum (either method):
  5. Present the consensus result and resolve any concerns
  6. Include the token <!-- GSD_DECISION --> in your FINAL output (only when delivering
     the completed plan, research, verification report, or filtered question list)

Fail-open: if a model is UNAVAILABLE (quota/error), note it and proceed with available models.
The Stop hook reads the transcript — skipping quorum will block your response.`;

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
    const prompt = (input.prompt || '').trim();
    const cwd    = input.cwd || process.cwd();

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

    // ── Priority 2: Planning command → inject quorum instructions ────────────
    const config = loadConfig(cwd);
    const commands = config.quorum_commands;

    // Dynamic fallback step generation from quorum_active (COMP-02)
    // Tool suffix lookup for fallback step generation
    // Keys match the slot name prefix (after stripping trailing -N index)
    const SLOT_TOOL_SUFFIX = {
      'codex-cli': 'review',
      'codex':     'review',
      'gemini-cli': 'gemini',
      'gemini':    'gemini',
      'opencode':  'opencode',
      'copilot-cli': 'ask',
      'copilot':   'ask',
      'claude':    'claude',
    };
    function slotToolCall(slotName) {
      // Strip trailing numeric index (e.g. codex-cli-1 → codex-cli, claude-1 → claude)
      const family = slotName.replace(/-\d+$/, '');
      const suffix = SLOT_TOOL_SUFFIX[family] || 'claude';
      return `mcp__${slotName}__${suffix}`;
    }

    const activeSlots = (config.quorum_active && config.quorum_active.length > 0)
      ? config.quorum_active
      : null; // null = use hardcoded fallback list

    let instructions;
    if (config.quorum_instructions) {
      // Explicit quorum_instructions in config — use as-is
      instructions = config.quorum_instructions;
    } else if (activeSlots) {
      // Dynamic fallback: generate step list from quorum_active
      const dynamicSteps = activeSlots.map((slot, i) =>
        `  ${i + 1}. Call ${slotToolCall(slot)} with the full plan content`
      ).join('\n');
      const afterSteps = activeSlots.length + 1;
      instructions = `QUORUM REQUIRED (structural enforcement — Stop hook will verify)\n\n` +
        `**Preferred method — spawn the quorum orchestrator agent:**\n\n` +
        `  Task(subagent_type="qgsd-quorum-orchestrator", prompt="[your plan/question/decision here]")\n\n` +
        `  The orchestrator handles provider pre-flight, team identity, sequential model calls,\n` +
        `  deliberation rounds, scoreboard updates, and returns a structured consensus verdict.\n` +
        `  The Stop hook recognises this Task call as valid quorum evidence — no additional\n` +
        `  model calls are needed in the main conversation.\n\n` +
        `**Fallback (if orchestrator unavailable) — call models directly:**\n` +
        dynamicSteps + '\n\n' +
        `After quorum (either method):\n` +
        `  ${afterSteps}. Present the consensus result and resolve any concerns\n` +
        `  ${afterSteps + 1}. Include the token <!-- GSD_DECISION --> in your FINAL output\n\n` +
        `Fail-open: if a model is UNAVAILABLE (quota/error), note it and proceed with available models.\n` +
        `The Stop hook reads the transcript — skipping quorum will block your response.`;
    } else {
      // Neither quorum_instructions nor quorum_active configured — use hardcoded fallback
      instructions = DEFAULT_QUORUM_INSTRUCTIONS_FALLBACK;
    }

    // Append model override block if any preferences are set
    const prefs = config.model_preferences || {};
    const overrideEntries = Object.entries(prefs).filter(([, m]) => m && typeof m === 'string');
    if (overrideEntries.length > 0) {
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

    // Anchored allowlist pattern — requires /gsd: or /qgsd: prefix and word boundary after command.
    const cmdPattern = new RegExp('^\\s*\\/q?gsd:(' + commands.join('|') + ')(\\s|$)');
    if (!cmdPattern.test(prompt)) {
      process.exit(0); // Silent pass — UPS-05
    }

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
