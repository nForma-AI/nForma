'use strict';
// bin/claude-md-references.test.cjs
// Automated audit: fails if any CLAUDE.md file-read instruction found in workflow/agent files
// Requirements: IMPR-04
//
// Scans a predefined list of workflow and agent files and fails if any contain a
// direct CLAUDE.md file-read instruction. This prevents re-introduction of CLAUDE.md
// file-read dependencies that were removed in phase v0.19-06.

const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

// Root of the QGSD repository (two levels up from bin/)
const REPO_ROOT = path.join(__dirname, '..');

// Files to audit for CLAUDE.md file-read instructions
const FILES_TO_AUDIT = [
  'qgsd-core/workflows/execute-phase.md',
  'qgsd-core/workflows/plan-phase.md',
  'qgsd-core/workflows/quick.md',
  'agents/qgsd-executor.md',
  'agents/qgsd-phase-researcher.md',
  'agents/qgsd-plan-checker.md',
  'agents/qgsd-planner.md',
  'agents/qgsd-quorum-worker.md',
  'agents/qgsd-quorum-slot-worker.md',
  'commands/qgsd/quick.md',
  'commands/qgsd/quorum.md',
];

// FILE_READ_PATTERN — matches lines that instruct reading CLAUDE.md as a file:
//   "Read `./CLAUDE.md`"  →  matches
//   "read CLAUDE.md"      →  matches
//   "load `CLAUDE.md`"    →  matches
//   "check CLAUDE.md"     →  matches
//   "open CLAUDE.md"      →  matches
// Does NOT match:
//   "CLAUDE.md references" (no verb prefix)
//   "# CLAUDE.md audit"   (comment/heading, no verb)
//   "see CLAUDE.md for"   ("see" not in verb list)
// MAINTAINABILITY NOTE: If new reading verbs appear in CLAUDE.md references
// across the codebase (e.g., `@`, `import`, `source`, `include`), extend the
// verb list below and update this pattern accordingly. Re-run the failing test
// to confirm the new variant is caught before committing.
const FILE_READ_PATTERN = /(?:Read|read|load|check|open)\s+[`'"]?(?:\.\/)?CLAUDE\.md[`'"]?/;

test('CLAUDE.md file-read references audit — all workflow/agent files', () => {
  const violations = [];

  for (const relPath of FILES_TO_AUDIT) {
    const fullPath = path.join(REPO_ROOT, relPath);

    // Skip files that don't exist (optional files not yet created)
    if (!fs.existsSync(fullPath)) {
      continue;
    }

    const contents = fs.readFileSync(fullPath, 'utf8');
    const lines = contents.split('\n');

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (FILE_READ_PATTERN.test(line)) {
        violations.push({
          file: relPath,
          lineNumber: i + 1,
          line: line.trim(),
        });
      }
    }
  }

  if (violations.length > 0) {
    const report = violations
      .map(v => `  ${v.file}:${v.lineNumber}: ${v.line}`)
      .join('\n');
    assert.fail(
      `Found ${violations.length} CLAUDE.md file-read instruction(s) in audited files.\n` +
      `These references were removed in phase v0.19-06 (IMPR-04).\n` +
      `Remove or replace with self-contained inline guidance:\n\n${report}`
    );
  }

  assert.strictEqual(violations.length, 0, 'No CLAUDE.md file-read instructions should exist in audited files');
});
