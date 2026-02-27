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

const { loadConfig, DEFAULT_CONFIG, slotToToolCall } = require('./config-loader');
const { schema_version } = require('./conformance-schema.cjs');

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

// Returns true if any assistant turn used Task(subagent_type=qgsd-quorum-slot-worker).
// Slot-workers are the inline dispatch mechanism — one per active slot per round.
// Replaced qgsd-quorum-orchestrator (deprecated quick-103) as full quorum evidence.
function wasSlotWorkerUsed(currentTurnLines) {
  for (const line of currentTurnLines) {
    try {
      const entry = JSON.parse(line);
      if (entry.type !== 'assistant') continue;
      const content = entry.message && entry.message.content;
      if (!Array.isArray(content)) continue;
      for (const block of content) {
        if (block.type !== 'tool_use' || block.name !== 'Task') continue;
        const input = block.input || {};
        const subagentType = input.subagent_type || input.subagentType || '';
        if (subagentType === 'qgsd-quorum-slot-worker') return true;
      }
    } catch { /* skip */ }
  }
  return false;
}

// Returns true if any assistant turn made a tool_use call whose name starts with prefix.
function wasSlotCalled(currentTurnLines, prefix) {
  for (const line of currentTurnLines) {
    try {
      const entry = JSON.parse(line);
      if (entry.type !== 'assistant') continue;
      const content = entry.message && entry.message.content;
      if (!Array.isArray(content)) continue;
      for (const block of content) {
        if (block.type === 'tool_use' && block.name && block.name.startsWith(prefix)) return true;
      }
    } catch { /* skip */ }
  }
  return false;
}

// Returns true if the slot was called AND its tool_result was NOT an error.
// Specifically:
// 1. Scans for assistant entries with tool_use blocks whose name starts with prefix. Records IDs.
// 2. Scans for user entries whose content contains a tool_result matching one of those IDs.
// 3. If the tool_result content contains "type":"tool_error" or is_error:true, returns false.
// 4. If a matching non-error tool_result exists, returns true.
// 5. If no tool_use found for this prefix, returns false.
// Errors and quota responses do NOT count toward the ceiling.
function wasSlotCalledSuccessfully(currentTurnLines, prefix) {
  // Step 1: collect tool_use IDs for this prefix
  const toolUseIds = new Set();
  for (const line of currentTurnLines) {
    try {
      const entry = JSON.parse(line);
      if (entry.type !== 'assistant') continue;
      const content = entry.message && entry.message.content;
      if (!Array.isArray(content)) continue;
      for (const block of content) {
        if (block.type === 'tool_use' && block.name && block.name.startsWith(prefix)) {
          if (block.id) toolUseIds.add(block.id);
        }
      }
    } catch { /* skip */ }
  }

  if (toolUseIds.size === 0) return false; // No tool_use found for this prefix

  // Step 2: find matching tool_result entries and check for errors
  for (const line of currentTurnLines) {
    try {
      const entry = JSON.parse(line);
      if (entry.type !== 'user') continue;
      const content = entry.message && entry.message.content;
      if (!Array.isArray(content)) continue;
      for (const block of content) {
        if (block.type !== 'tool_result') continue;
        if (!toolUseIds.has(block.tool_use_id)) continue;
        // Matching tool_result found — check for error
        const contentStr = JSON.stringify(block.content || '');
        const isError = block.is_error === true || contentStr.includes('"type":"tool_error"');
        if (isError) return false; // Error/quota response — does not count
        return true; // Non-error response — counts toward ceiling
      }
    } catch { /* skip */ }
  }

  // tool_use found but no tool_result yet — treat as not successfully called
  return false;
}

// Builds the ordered agent pool from config.
// If quorum_active is set, derives pool from it (preferred path).
// Falls back to required_models for backward compat.
// Returns array of { slot, prefix, authType, callTool }.
function buildAgentPool(config) {
  const agentConfig = config.agent_config || {};
  const quorumActive = config.quorum_active || [];

  let entries;
  if (quorumActive.length > 0) {
    entries = quorumActive.map(slot => ({
      slot,
      prefix:   'mcp__' + slot + '__',
      authType: (agentConfig[slot] && agentConfig[slot].auth_type) || 'api',
      callTool: slotToToolCall(slot),
    }));
  } else {
    // Backward compat: derive from required_models
    // Use deriveMissingToolName to get canonical tool names (e.g. copilot → __ask not __copilot)
    entries = Object.entries(config.required_models || {}).map(([key, def]) => ({
      slot:     key,
      prefix:   def.tool_prefix,
      authType: 'api',
      callTool: deriveMissingToolName(key, def),
    }));
  }

  // Sort sub before api when preferSub is enabled
  if (config.quorum && config.quorum.preferSub) {
    entries.sort((a, b) => {
      if (a.authType === 'sub' && b.authType !== 'sub') return -1;
      if (a.authType !== 'sub' && b.authType === 'sub') return 1;
      return 0;
    });
  }

  return entries;
}

// Reads ~/.claude.json to determine which MCP servers are registered.
// Returns an array of derived tool prefixes (e.g. ['mcp__codex-cli-1__', 'mcp__gemini-cli-1__']).
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

// Parses --n N flag from a text string.
// Returns N (integer >= 1) if found, or null if absent/invalid.
function parseQuorumSizeFlag(text) {
  const m = text.match(/--n\s+(\d+)/);
  if (!m) return null;
  const n = parseInt(m[1], 10);
  return (Number.isInteger(n) && n >= 1) ? n : null;
}

// Extracts the user-typed prompt text from the current turn lines.
// Checks <command-name> tag first; falls back to first 300 chars of message text.
function extractPromptText(currentTurnLines) {
  for (const line of currentTurnLines) {
    try {
      const entry = JSON.parse(line);
      if (entry.type !== 'user') continue;
      const tag = extractCommandTag(entry);
      if (tag !== null) return tag;
      const content = entry.message?.content;
      if (typeof content === 'string') return content.slice(0, 300);
      if (Array.isArray(content)) {
        const first = content.find(c => c?.type === 'text');
        return first ? (first.text || '').slice(0, 300) : '';
      }
    } catch { /* skip */ }
  }
  return '';
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

      // Extract --n N flag from current-turn user prompt (if present)
      const promptText = extractPromptText(currentTurnLines);
      const quorumSizeOverride = parseQuorumSizeFlag(promptText);
      const soloMode = quorumSizeOverride === 1;

      // GUARD 6: Solo mode (--n 1) — Claude-only quorum, no external models required
      if (soloMode) {
        appendConformanceEvent({
          ts: new Date().toISOString(),
          phase: 'DECIDING',
          action: 'quorum_complete',
          slots_available: 0,
          vote_result: 1,
          outcome: 'APPROVE',
          schema_version,
        });
        process.exit(0); // Solo mode: Claude's vote is the quorum — no block
      }

      // Build agent pool from config
      const agentPool = buildAgentPool(config);

      // Get available MCP prefixes from ~/.claude.json
      const availablePrefixes = getAvailableMcpPrefixes();

      // Check if slot-workers handled quorum (inline dispatch counts as full quorum evidence)
      if (wasSlotWorkerUsed(currentTurnLines)) {
        process.exit(0);
      }

      // Ceiling: require maxSize successful (non-error) responses from the full pool.
      // Named maxSize for consistency with qgsd-prompt.js and the config schema.
      // --n N override: N total participants means N-1 external models required.
      const maxSize = quorumSizeOverride !== null && quorumSizeOverride > 1
        ? quorumSizeOverride - 1  // --n N means N-1 external models required
        : (config.quorum && Number.isInteger(config.quorum.maxSize) && config.quorum.maxSize >= 1)
          ? config.quorum.maxSize
          : 2;

      // Iterate the full agentPool (already sorted sub-first when preferSub is set).
      // Count successful (non-error) responses. Stop once ceiling is satisfied.
      // missingAgents is populated for failure reporting — only read in the block path below.
      let successCount = 0;
      const missingAgents = []; // only read when successCount < maxSize (block path)
      for (const agent of agentPool) {
        // If availablePrefixes is null (unknown), treat as available (conservative enforcement)
        const isAvailable = availablePrefixes === null || availablePrefixes.includes(agent.prefix);
        if (!isAvailable) continue; // Model not installed — skip

        if (wasSlotCalledSuccessfully(currentTurnLines, agent.prefix)) {
          successCount++;
          if (successCount >= maxSize) break; // ceiling satisfied — stop counting
        } else {
          // Track failures for error reporting (only used in the block path below)
          let toolName;
          if (agent.callTool) {
            toolName = agent.callTool;
          } else {
            toolName = deriveMissingToolName(agent.slot, { tool_prefix: agent.prefix });
          }
          missingAgents.push(toolName);
        }
      }

      if (successCount < maxSize) {
        // Only read missingAgents here — never in the success path
        appendConformanceEvent({
          ts:              new Date().toISOString(),
          phase:           'DECIDING',
          action:          'quorum_block',
          slots_available: agentPool.length,
          vote_result:     successCount,
          outcome:         'BLOCK',
          schema_version,
        });
        process.stdout.write(JSON.stringify({
          decision: 'block',
          reason: 'QUORUM REQUIRED: Missing tool calls for: ' + missingAgents.join(', ') + '. Run the required quorum agent(s) before completing this planning command.'
        }));
        process.exit(0);
      }

      appendConformanceEvent({
        ts:              new Date().toISOString(),
        phase:           'DECIDING',
        action:          'quorum_complete',
        slots_available: agentPool.length,
        vote_result:     successCount,
        outcome:         'APPROVE',
        schema_version,
      });
      process.exit(0);

    } catch {
      // Fail-open: never crash the user's session on any unexpected error
      process.exit(0);
    }
  });
}

main();
