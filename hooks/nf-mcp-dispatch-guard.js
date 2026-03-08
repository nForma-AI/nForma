#!/usr/bin/env node
// hooks/nf-mcp-dispatch-guard.js
// PreToolUse hook -- detects direct mcp__<slot>__<tool> calls and warns via
// additionalContext that R3.2 requires Task(subagent_type) dispatch instead.
// Allowlisted exceptions: ping, health_check (diagnostic tools).
//
// Follows fail-open pattern: try/catch wrapping entire main, exit(0) on any error.
// Hook stdout is the decision channel -- debug output goes to stderr only.

'use strict';

const { loadConfig, shouldRunHook, validateHookInput, SLOT_TOOL_SUFFIX } = require('./config-loader');

// Build set of known MCP slot family prefixes from SLOT_TOOL_SUFFIX keys
const KNOWN_FAMILIES = new Set(Object.keys(SLOT_TOOL_SUFFIX));

// Allowlisted MCP tool suffixes that bypass the guard (diagnostic tools)
const ALLOWLISTED_SUFFIXES = new Set(['ping', 'health_check']);

// Regex to parse mcp__<slot>__<suffix> tool names
const MCP_TOOL_RE = /^mcp__([a-z][\w-]*)__(.+)$/;

function main() {
  let raw = '';
  process.stdin.setEncoding('utf8');
  process.stdin.on('data', chunk => { raw += chunk; });
  process.stdin.on('end', () => {
    try {
      if (!raw || raw.trim() === '') {
        process.exit(0); // fail-open: empty stdin
      }

      const input = JSON.parse(raw);

      // Validate hook input
      const eventType = input.hook_event_name || input.hookEventName || 'PreToolUse';
      const validation = validateHookInput(eventType, input);
      if (!validation.valid) {
        process.stderr.write('[nf] WARNING: nf-mcp-dispatch-guard: invalid input: ' + JSON.stringify(validation.errors) + '\n');
        process.exit(0); // fail-open
      }

      // Profile guard
      const cwd = input.cwd || process.cwd();
      const config = loadConfig(cwd);
      const profile = config.hook_profile || 'standard';
      if (!shouldRunHook('nf-mcp-dispatch-guard', profile)) {
        process.exit(0);
      }

      // Extract tool name
      const toolName = input.tool_name || input.toolName || '';

      // Only act on mcp__ prefixed tool calls
      const match = MCP_TOOL_RE.exec(toolName);
      if (!match) {
        process.exit(0); // Not an MCP call -- no-op
      }

      const slotName = match[1];   // e.g. "codex-1"
      const suffix = match[2];     // e.g. "review"

      // Allowlisted suffixes pass through silently
      if (ALLOWLISTED_SUFFIXES.has(suffix)) {
        process.exit(0);
      }

      // Derive family name (strip trailing -N for numbered slots)
      const family = slotName.replace(/-\d+$/, '');

      // Only warn for known quorum slot families
      if (!KNOWN_FAMILIES.has(family)) {
        process.exit(0); // Unknown MCP server -- not a quorum slot
      }

      // Emit additionalContext warning about R3.2 dispatch requirement
      process.stdout.write(JSON.stringify({
        hookSpecificOutput: {
          hookEventName: 'PreToolUse',
          additionalContext:
            '[nf-dispatch] WARNING: Direct MCP tool call detected (' + toolName + '). ' +
            "Per R3.2, use Task(subagent_type='nf-quorum-slot-worker') for quorum dispatch. " +
            'Direct mcp__ calls bypass quorum enforcement and slot correlation. ' +
            'Allowlisted exceptions: ping, health_check.',
        },
      }));

      process.exit(0); // warn-only, never block
    } catch (e) {
      if (e instanceof SyntaxError) {
        process.stderr.write('[nf] WARNING: nf-mcp-dispatch-guard: malformed JSON on stdin: ' + e.message + '\n');
      }
      process.exit(0); // fail-open on any error
    }
  });
}

if (require.main === module) main();
