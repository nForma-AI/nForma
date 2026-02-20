#!/usr/bin/env node
// hooks/qgsd-stop.js
// Stop hook — quorum verification gate for GSD planning commands.
//
// Reads JSON from stdin (Claude Code Stop event payload), applies guards in
// strict order, then scans the current-turn transcript window for quorum
// evidence. Blocks with decision:block if a planning command was issued but
// quorum tool calls are missing. Fails open on all errors.
//
// Config: ~/.claude/qgsd.json (falls back to DEFAULT_CONFIG if absent/malformed)

'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');

const DEFAULT_CONFIG = {
  quorum_commands: [
    'plan-phase', 'new-project', 'new-milestone',
    'discuss-phase', 'verify-work', 'research-phase',
  ],
  fail_mode: 'open',
  required_models: {
    codex:    { tool_prefix: 'mcp__codex-cli__',  required: true },
    gemini:   { tool_prefix: 'mcp__gemini-cli__', required: true },
    opencode: { tool_prefix: 'mcp__opencode__',   required: true },
  },
};

function loadConfig() {
  const configPath = path.join(os.homedir(), '.claude', 'qgsd.json');
  if (!fs.existsSync(configPath)) return DEFAULT_CONFIG;
  try {
    const fileConfig = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    return { ...DEFAULT_CONFIG, ...fileConfig };
  } catch {
    return DEFAULT_CONFIG;
  }
}

// Builds the regex that matches /gsd:<quorum-command> in any text.
function buildCommandPattern(quorumCommands) {
  const escaped = quorumCommands.map(c => c.replace(/-/g, '\\-'));
  return new RegExp('\\/gsd:(' + escaped.join('|') + ')');
}

// Returns true if a parsed JSONL user entry is a human text message.
// Excludes tool_result-only messages (intermediate turn messages from
// multi-step tool call sequences) which also use type:"user" in the JSONL.
function isHumanMessage(entry) {
  const content = entry.message?.content;
  if (typeof content === 'string') return content.length > 0;
  if (Array.isArray(content)) return content.some(c => c?.type === 'text');
  return false;
}

// Scans backward from end to find last HUMAN user message boundary.
// Skips tool_result user messages — those are intermediate turn messages,
// not human turn boundaries. Returns all lines from the boundary forward.
// If no human message is found, returns all lines (conservative — treats
// whole transcript as current turn to avoid false passes).
function getCurrentTurnLines(lines) {
  let lastUserIdx = -1;
  for (let i = lines.length - 1; i >= 0; i--) {
    try {
      const entry = JSON.parse(lines[i]);
      if (entry.type === 'user' && isHumanMessage(entry)) {
        lastUserIdx = i;
        break;
      }
    } catch {
      // Skip malformed lines
    }
  }
  return lastUserIdx >= 0 ? lines.slice(lastUserIdx) : lines;
}

// Returns true if any user entry in currentTurnLines contains a GSD quorum command.
function hasQuorumCommand(currentTurnLines, cmdPattern) {
  for (const line of currentTurnLines) {
    try {
      const entry = JSON.parse(line);
      if (entry.type !== 'user') continue;
      if (cmdPattern.test(JSON.stringify(entry.message || entry))) return true;
    } catch {
      // Skip malformed lines
    }
  }
  return false;
}

// Extracts the matched /gsd:<command> text from the first matching user line.
// Falls back to '/gsd:plan-phase' if no match is found (should not happen
// since hasQuorumCommand already confirmed a match).
function extractCommand(currentTurnLines, cmdPattern) {
  for (const line of currentTurnLines) {
    try {
      const entry = JSON.parse(line);
      if (entry.type !== 'user') continue;
      const match = cmdPattern.exec(JSON.stringify(entry.message || entry));
      if (match) return match[0];
    } catch {
      // Skip malformed lines
    }
  }
  return '/gsd:plan-phase';
}

// Scans assistant entries in currentTurnLines for tool_use blocks whose
// name starts with a required model's tool_prefix.
// Returns a Set of model keys (e.g. 'codex', 'gemini', 'opencode') found.
function findQuorumEvidence(currentTurnLines, requiredModels) {
  const found = new Set();
  for (const line of currentTurnLines) {
    try {
      const entry = JSON.parse(line);
      if (entry.type !== 'assistant') continue;
      const content = entry.message && entry.message.content;
      if (!Array.isArray(content)) continue;
      for (const block of content) {
        if (block.type !== 'tool_use') continue;
        for (const [modelKey, modelDef] of Object.entries(requiredModels)) {
          if (block.name && block.name.startsWith(modelDef.tool_prefix)) {
            found.add(modelKey);
          }
        }
      }
    } catch {
      // Skip malformed lines
    }
  }
  return found;
}

// Derives the canonical tool name for the block reason message.
// Uses known model keys first; falls back to prefix + key for unknown models.
function deriveMissingToolName(modelKey, modelDef) {
  const prefix = modelDef.tool_prefix;
  if (modelKey === 'codex') return prefix + 'review';
  if (modelKey === 'gemini') return prefix + 'gemini';
  if (modelKey === 'opencode') return prefix + 'opencode';
  return prefix + modelKey;
}

function main() {
  let raw = '';
  process.stdin.setEncoding('utf8');
  process.stdin.on('data', chunk => { raw += chunk; });
  process.stdin.on('end', () => {
    try {
      const input = JSON.parse(raw);

      // GUARD 1: Infinite loop prevention — MUST be first (STOP-02)
      if (input.stop_hook_active) {
        process.exit(0);
      }

      // GUARD 2: Subagent exclusion (STOP-03)
      if (input.hook_event_name === 'SubagentStop') {
        process.exit(0);
      }

      // GUARD 3: Transcript must exist (fail-open)
      if (!input.transcript_path || !fs.existsSync(input.transcript_path)) {
        process.exit(0);
      }

      const config = loadConfig();

      // Read and split transcript JSONL; skip empty lines
      const lines = fs.readFileSync(input.transcript_path, 'utf8')
        .split('\n')
        .filter(l => l.trim().length > 0);

      // Scope to current turn: lines since last user message (STOP-04)
      const currentTurnLines = getCurrentTurnLines(lines);

      // Build command pattern once; reuse for detection and extraction
      const cmdPattern = buildCommandPattern(config.quorum_commands);

      // GUARD 4: Only enforce quorum if a planning command is in current turn (STOP-06)
      if (!hasQuorumCommand(currentTurnLines, cmdPattern)) {
        process.exit(0);
      }

      // Scan for quorum tool_use evidence in current turn (STOP-01)
      const foundModels = findQuorumEvidence(currentTurnLines, config.required_models);

      // Identify missing required models
      const missingKeys = Object.entries(config.required_models)
        .filter(([modelKey, modelDef]) => modelDef.required && !foundModels.has(modelKey))
        .map(([modelKey]) => modelKey);

      // PASS: all required models found (STOP-09)
      if (missingKeys.length === 0) {
        process.exit(0);
      }

      // BLOCK: quorum incomplete (STOP-07, STOP-08)
      const missingTools = missingKeys.map(modelKey =>
        deriveMissingToolName(modelKey, config.required_models[modelKey])
      );

      const command = extractCommand(currentTurnLines, cmdPattern);

      const blockReason =
        `QUORUM REQUIRED: Before completing this ${command} response, call ` +
        `${missingTools.join(', ')} with your current plan. ` +
        'Present their responses, then deliver your final output.';

      process.stdout.write(JSON.stringify({ decision: 'block', reason: blockReason }));
      process.exit(0);

    } catch {
      // Fail-open: never crash the user's session on any unexpected error
      process.exit(0);
    }
  });
}

main();
