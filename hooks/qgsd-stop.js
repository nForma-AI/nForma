#!/usr/bin/env node
// hooks/qgsd-stop.js
// Stop hook — quorum verification gate for GSD planning commands.
//
// Reads JSON from stdin (Claude Code Stop event payload), applies guards in
// strict order, then scans the current-turn transcript window for quorum
// evidence. Blocks with decision:block if a planning command was issued but
// quorum tool calls are missing. Fails open on all errors.
//
// Config: ~/.claude/qgsd.json (two-layer merge via shared config-loader)
// Unavailability: reads ~/.claude.json mcpServers to detect which models are installed
//   (QGSD_CLAUDE_JSON env var overrides the path — for testing only)

'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');

const { loadConfig, DEFAULT_CONFIG } = require('./config-loader');

// Builds the regex that matches /gsd:<quorum-command> or /qgsd:<quorum-command> in any text.
function buildCommandPattern(quorumCommands) {
  const escaped = quorumCommands.map(c => c.replace(/-/g, '\\-'));
  return new RegExp('\\/q?gsd:(' + escaped.join('|') + ')');
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

// Extracts the value of the <command-name> XML tag injected by Claude Code for real slash command
// invocations. Returns the trimmed tag content or null if the tag is absent.
// This tag is ONLY present for actual invocations — never in @file-expanded workflow content.
function extractCommandTag(entry) {
  let text = '';
  const content = entry.message?.content;
  if (typeof content === 'string') {
    text = content;
  } else if (Array.isArray(content)) {
    const first = content.find(c => c?.type === 'text');
    text = first ? (first.text || '') : '';
  }
  const m = text.match(/<command-name>([\s\S]*?)<\/command-name>/);
  return m ? m[1].trim() : null;
}

// Returns true if any user entry in currentTurnLines contains a GSD quorum command.
// Uses XML-tag-first strategy: if a <command-name> tag is present, only that tag is tested
// against cmdPattern (never the full body). Falls back to first 300 chars of message text
// when no tag is found, to avoid matching @file-expanded workflow content.
function hasQuorumCommand(currentTurnLines, cmdPattern) {
  for (const line of currentTurnLines) {
    try {
      const entry = JSON.parse(line);
      if (entry.type !== 'user') continue;
      const tag = extractCommandTag(entry);
      if (tag !== null) {
        // Tag present: test only the tag value — do NOT fall through to body scan
        if (cmdPattern.test(tag)) return true;
        continue;
      }
      // No tag: fall back to first 300 chars of message text (avoids @file-expanded content)
      const content = entry.message?.content;
      let textContent = '';
      if (typeof content === 'string') {
        textContent = content;
      } else if (Array.isArray(content)) {
        const first = content.find(c => c?.type === 'text');
        textContent = first ? (first.text || '') : '';
      }
      if (cmdPattern.test(textContent.slice(0, 300))) return true;
    } catch {
      // Skip malformed lines
    }
  }
  return false;
}

// Extracts the matched /gsd:<command> or /qgsd:<command> text from the first matching user line.
// Uses XML-tag-first strategy: prefers the <command-name> tag for accurate command identification.
// Falls back to first 300 chars of message text, then to '/qgsd:plan-phase' as ultimate fallback.
function extractCommand(currentTurnLines, cmdPattern) {
  for (const line of currentTurnLines) {
    try {
      const entry = JSON.parse(line);
      if (entry.type !== 'user') continue;
      const tag = extractCommandTag(entry);
      if (tag !== null) {
        const tagMatch = cmdPattern.exec(tag);
        if (tagMatch) return tagMatch[0];
        continue; // Tag present but wrong command — do not fall through
      }
      // No tag: fall back to first 300 chars of message text
      const content = entry.message?.content;
      let textContent = '';
      if (typeof content === 'string') {
        textContent = content;
      } else if (Array.isArray(content)) {
        const first = content.find(c => c?.type === 'text');
        textContent = first ? (first.text || '') : '';
      }
      const textMatch = cmdPattern.exec(textContent.slice(0, 300));
      if (textMatch) return textMatch[0];
    } catch {
      // Skip malformed lines
    }
  }
  return '/qgsd:plan-phase';
}

// Scans assistant entries in currentTurnLines for tool_use blocks whose
// name starts with a required model's tool_prefix.
// Also accepts a Task call to qgsd-quorum-orchestrator as full quorum evidence —
// the orchestrator handles all model calls internally in its own sub-transcript.
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
        // Accept Task(subagent_type=qgsd-quorum-orchestrator) as full quorum evidence.
        // The orchestrator handles all model calls in its own sub-transcript.
        if (block.name === 'Task') {
          const input = block.input || {};
          const subagentType = input.subagent_type || input.subagentType || '';
          if (subagentType === 'qgsd-quorum-orchestrator') {
            // Mark all required models as satisfied
            for (const modelKey of Object.keys(requiredModels)) {
              found.add(modelKey);
            }
            return found; // No need to scan further
          }
        }
        // Standard MCP tool call evidence
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

// Reads ~/.claude.json to determine which MCP servers are registered.
// Returns an array of derived tool prefixes (e.g. ['mcp__codex-cli__', 'mcp__gemini-cli__']).
// Returns null if the file is missing or malformed — callers treat null as "unknown" (conservative).
//
// TESTING ONLY: set QGSD_CLAUDE_JSON env var to override the file path.
// In production, always reads ~/.claude.json.
//
// KNOWN LIMITATION: Only reads ~/.claude.json (user-scoped MCPs). Project-scoped MCPs
// configured in .mcp.json are not checked. If a required model is only configured at
// project level, it will be classified as unavailable and skipped (fail-open).
// In practice, quorum models (Codex, Gemini, OpenCode) are global tools.
function getAvailableMcpPrefixes() {
  const claudeJsonPath = process.env.QGSD_CLAUDE_JSON || path.join(os.homedir(), '.claude.json');
  if (!fs.existsSync(claudeJsonPath)) return null;
  try {
    const d = JSON.parse(fs.readFileSync(claudeJsonPath, 'utf8'));
    const servers = d.mcpServers || {};
    return Object.keys(servers).map(name => 'mcp__' + name + '__');
  } catch (e) {
    process.stderr.write('[qgsd] WARNING: Could not parse ~/.claude.json: ' + e.message + '\n');
    return null;
  }
}

// Planning artifact file path patterns — matches only planning artifacts, not codebase docs.
// Each pattern is specific enough to avoid false positives from ls/cat/grep Bash calls.
const ARTIFACT_PATTERNS = [
  /-PLAN\.md/,        // e.g. 04-01-PLAN.md
  /-RESEARCH\.md/,    // e.g. 04-RESEARCH.md
  /-CONTEXT\.md/,     // e.g. 04-CONTEXT.md (discuss-phase output)
  /-UAT\.md/,         // e.g. 04-UAT.md (verify-work UAT output)
  /ROADMAP\.md/,      // ROADMAP.md (new-project, new-milestone)
  /REQUIREMENTS\.md/, // REQUIREMENTS.md (new-project)
  /PROJECT\.md/,      // PROJECT.md (new-project early commit)
];

// Returns true if the current turn contains a Bash tool_use block that BOTH:
// (a) invokes gsd-tools.cjs commit, AND
// (b) references a planning artifact file path (not codebase/*.md).
// Requiring both conditions prevents false positives from ls/cat/grep commands.
function hasArtifactCommit(currentTurnLines) {
  for (const line of currentTurnLines) {
    try {
      const entry = JSON.parse(line);
      if (entry.type !== 'assistant') continue;
      const content = entry.message && entry.message.content;
      if (!Array.isArray(content)) continue;
      for (const block of content) {
        if (block.type !== 'tool_use') continue;
        if (block.name !== 'Bash') continue;
        const cmdStr = JSON.stringify(block.input || '');
        // Both conditions must hold in the same Bash block
        if (!cmdStr.includes('gsd-tools.cjs commit')) continue;
        if (ARTIFACT_PATTERNS.some(p => p.test(cmdStr))) return true;
      }
    } catch { /* skip */ }
  }
  return false;
}

// The exact token Claude must include in its final output to mark a decision turn.
// Used by hasDecisionMarker (Stop hook) and injected into Claude's context (Prompt hook).
const DECISION_MARKER = '<!-- GSD_DECISION -->';

// Returns true if the last assistant text block in currentTurnLines contains DECISION_MARKER.
// Walks lines in reverse to find the most recent assistant entry with a text content block.
function hasDecisionMarker(currentTurnLines) {
  for (let i = currentTurnLines.length - 1; i >= 0; i--) {
    try {
      const entry = JSON.parse(currentTurnLines[i]);
      if (entry.type !== 'assistant') continue;
      const content = entry.message && entry.message.content;
      if (!Array.isArray(content)) continue;
      for (const block of content) {
        if (block.type !== 'text') continue;
        if (block.text && block.text.includes(DECISION_MARKER)) return true;
      }
      // Found the last assistant entry — no text block with marker → stop scanning
      break;
    } catch { /* skip */ }
  }
  return false;
}

// Derives the canonical tool name for the block reason message.
// Uses known model keys first; falls back to prefix + key for unknown models.
function deriveMissingToolName(modelKey, modelDef) {
  const prefix = modelDef.tool_prefix;
  if (modelKey === 'codex') return prefix + 'review';
  if (modelKey === 'gemini') return prefix + 'gemini';
  if (modelKey === 'opencode') return prefix + 'opencode';
  if (modelKey === 'copilot') return prefix + 'ask';
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

      // GUARD 5: Only enforce quorum on project decision turns (SCOPE-01, SCOPE-02, SCOPE-03)
      // A turn is a decision turn if it contains a planning artifact commit OR a decision marker.
      // GSD-internal operation turns (routing, agent spawning, questioning) have neither.
      const isDecisionTurn = hasArtifactCommit(currentTurnLines) || hasDecisionMarker(currentTurnLines);
      if (!isDecisionTurn) {
        process.exit(0); // GSD-internal operation — not a project decision turn
      }

      // Scan for quorum tool_use evidence in current turn (STOP-01)
      const foundModels = findQuorumEvidence(currentTurnLines, config.required_models);

      // Check which MCP servers are actually registered (for fail-open unavailability detection)
      const availablePrefixes = getAvailableMcpPrefixes(); // null = unknown (conservative)

      // Identify missing required models — separate unavailable (skip) from missing (block)
      const unavailableKeys = [];
      const missingKeys = Object.entries(config.required_models)
        .filter(([modelKey, modelDef]) => {
          if (!modelDef.required) return false;
          if (foundModels.has(modelKey)) return false; // called — not missing
          // Check unavailability only when we have a definitive server list
          if (availablePrefixes !== null) {
            const isConfigured = availablePrefixes.some(p => p === modelDef.tool_prefix);
            if (!isConfigured) {
              // Model's prefix not in mcpServers → unavailable → fail-open: skip
              unavailableKeys.push({ modelKey, prefix: modelDef.tool_prefix });
              return false;
            }
          }
          // Required, not called, and either available or unknown → block candidate
          return true;
        })
        .map(([modelKey]) => modelKey);

      // PASS: all required (available) models found or all missing were unavailable (STOP-09)
      if (missingKeys.length === 0) {
        if (unavailableKeys.length > 0) {
          const note = unavailableKeys.map(u => u.modelKey + ' (' + u.prefix + ')').join(', ');
          process.stderr.write('[qgsd] INFO: Quorum passed. Note: ' + note + ' was unavailable and skipped.\n');
        }
        process.exit(0);
      }

      // BLOCK: quorum incomplete — some required available models were not called (STOP-07, STOP-08)
      const missingTools = missingKeys.map(modelKey =>
        deriveMissingToolName(modelKey, config.required_models[modelKey])
      );

      const command = extractCommand(currentTurnLines, cmdPattern);

      const unavailNote = unavailableKeys.length > 0
        ? ' [Note: ' + unavailableKeys.map(u => u.modelKey + ' (' + u.prefix + ')').join(', ') + ' was unavailable and skipped per fail-open policy]'
        : '';

      const blockReason =
        `QUORUM REQUIRED: Before completing this ${command} response, call ` +
        `${missingTools.join(', ')} with your current plan. ` +
        'Present their responses, then deliver your final output.' + unavailNote;

      process.stdout.write(JSON.stringify({ decision: 'block', reason: blockReason }));
      process.exit(0);

    } catch {
      // Fail-open: never crash the user's session on any unexpected error
      process.exit(0);
    }
  });
}

main();
