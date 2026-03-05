#!/usr/bin/env node
// hooks/qgsd-token-collector.js
// SubagentStop hook — reads agent_transcript_path, sums message.usage fields,
// appends a token record to .planning/token-usage.jsonl.
//
// Guards:
//   - Only processes agent_type === 'qgsd-quorum-slot-worker' (exits 0 otherwise)
//   - If transcript path is absent or missing: writes null-token record and exits 0 (fail-open)
//   - isSidechain === true entries are excluded from token sum
//   - isApiErrorMessage === true entries are excluded from token sum
//   - Never writes to stdout (stdout is the Claude Code hook decision channel)
//   - Fail-open: any unhandled error exits 0 without crashing the user's session

'use strict';

const fs   = require('fs');
const path = require('path');

// Resolve slot name from correlation file or last_assistant_message preamble.
// Order:
//   1. Read correlation file at .planning/quorum-slot-corr-<agent_id>.json
//      - If slot is set → return it (and delete file)
//      - If slot is null → delete file, fall through to next
//   2. Parse "slot: <name>" from first matching line in last_assistant_message
//   3. Fallback: return agent_id or 'unknown'
function resolveSlot(input) {
  if (input.agent_id) {
    const pp = require(path.join(__dirname, '..', 'bin', 'planning-paths.cjs'));
    const corrPath = pp.resolveWithFallback(process.cwd(), 'quorum-correlation', { agentId: input.agent_id });
    if (fs.existsSync(corrPath)) {
      try {
        const data = JSON.parse(fs.readFileSync(corrPath, 'utf8'));
        try { fs.unlinkSync(corrPath); } catch (_) {}
        if (data.slot) return data.slot;
        // slot is null → fall through to last_assistant_message
      } catch (_) {
        // Malformed correlation file — fall through
      }
    }
  }

  // Parse from last_assistant_message preamble
  if (input.last_assistant_message) {
    const m = input.last_assistant_message.match(/^slot:\s*(\S+)/m);
    if (m) return m[1];
  }

  // Final fallback
  return input.agent_id || 'unknown';
}

// Append a token record to .planning/token-usage.jsonl.
// Never throws — any error is silently swallowed (observational).
function appendRecord(input, inputTokens, outputTokens, cacheCreate, cacheRead) {
  try {
    const slot = resolveSlot(input);
    const record = JSON.stringify({
      ts:                            new Date().toISOString(),
      session_id:                    input.session_id   || null,
      agent_id:                      input.agent_id     || null,
      slot,
      input_tokens:                  inputTokens,
      output_tokens:                 outputTokens,
      cache_creation_input_tokens:   cacheCreate,
      cache_read_input_tokens:       cacheRead,
    });
    const pp2 = require(path.join(__dirname, '..', 'bin', 'planning-paths.cjs'));
    const logPath = pp2.resolve(process.cwd(), 'token-usage');
    fs.appendFileSync(logPath, record + '\n', 'utf8');
  } catch (_) {} // observational — never fails
}

function main() {
  let raw = '';
  process.stdin.setEncoding('utf8');
  process.stdin.on('data', chunk => { raw += chunk; });
  process.stdin.on('end', () => {
    try {
      const input = JSON.parse(raw);

      // Guard: only process qgsd-quorum-slot-worker subagents
      if (input.agent_type !== 'qgsd-quorum-slot-worker') {
        process.exit(0);
      }

      // Guard: absent or missing transcript → null sentinel record
      if (!input.agent_transcript_path || !fs.existsSync(input.agent_transcript_path)) {
        appendRecord(input, null, null, null, null);
        process.exit(0);
      }

      // Read and parse transcript JSONL
      const rawTranscript = fs.readFileSync(input.agent_transcript_path, 'utf8');
      const lines = rawTranscript.split('\n').filter(l => l.trim().length > 0);

      let inputSum       = 0;
      let outputSum      = 0;
      let cacheCreateSum = 0;
      let cacheReadSum   = 0;

      for (const line of lines) {
        try {
          const entry = JSON.parse(line);
          // Only sum assistant entries
          if (entry.type !== 'assistant') continue;
          // Exclude sidechain entries
          if (entry.isSidechain === true) continue;
          // Exclude API error entries
          if (entry.isApiErrorMessage === true) continue;
          // Require usage data
          const usage = entry.message && entry.message.usage;
          if (!usage) continue;

          inputSum       += (usage.input_tokens                 || 0);
          outputSum      += (usage.output_tokens                || 0);
          cacheCreateSum += (usage.cache_creation_input_tokens  || 0);
          cacheReadSum   += (usage.cache_read_input_tokens      || 0);
        } catch (_) {
          // Skip malformed lines
        }
      }

      appendRecord(input, inputSum, outputSum, cacheCreateSum, cacheReadSum);
      process.exit(0);

    } catch (_) {
      // Fail-open: never crash the session on any unexpected error
      process.exit(0);
    }
  });
}

main();
