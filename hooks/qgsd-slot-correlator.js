#!/usr/bin/env node
// hooks/qgsd-slot-correlator.js
// SubagentStart hook — writes a correlation placeholder file for qgsd-quorum-slot-worker subagents.
//
// At SubagentStart time, the prompt/slot name is not available in the hook payload.
// This hook writes a stub correlation file { agent_id, ts, slot: null } so the
// token collector (SubagentStop) can locate and clean up the file per agent_id.
// The slot is resolved from last_assistant_message preamble by the token collector.
//
// Guards:
//   - Only processes agent_type === 'qgsd-quorum-slot-worker' (exits 0 otherwise)
//   - If agent_id is absent: exits 0 gracefully
//   - Fail-open: any unhandled error exits 0

'use strict';

const fs   = require('fs');
const path = require('path');

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

      // Guard: agent_id required to write a meaningful correlation file
      if (!input.agent_id) {
        process.exit(0);
      }

      const pp = require(path.join(__dirname, '..', 'bin', 'planning-paths.cjs'));
      const corrPath = pp.resolve(process.cwd(), 'quorum-correlation', { agentId: input.agent_id });

      try {
        fs.writeFileSync(corrPath, JSON.stringify({
          agent_id: input.agent_id,
          ts:       new Date().toISOString(),
          slot:     null, // SubagentStart does not include prompt — slot resolved at SubagentStop
        }), 'utf8');
      } catch (_) {} // observational — never fails

      process.exit(0);

    } catch (_) {
      // Fail-open
      process.exit(0);
    }
  });
}

main();
