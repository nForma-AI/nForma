#!/usr/bin/env node
// @requirement REL-01
// Structural: external-service failures are caught and handled gracefully (try/catch wrapping)

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..', '..', '..');

// REL-01: Failures in external services are caught and handled gracefully.
// Structural strategy: verify key files that interact with external services
// contain try/catch blocks for graceful degradation.

const externalServiceFiles = [
  'bin/telemetry-collector.cjs',
  'bin/check-provider-health.cjs',
  'bin/call-quorum-slot.cjs',
  'hooks/nf-stop.js',
  'hooks/nf-prompt.js',
];

for (const relPath of externalServiceFiles) {
  test(`REL-01: ${relPath} contains try/catch for graceful failure handling`, () => {
    const filePath = path.join(ROOT, relPath);
    const content = fs.readFileSync(filePath, 'utf8');
    assert.match(content, /try\s*\{/, `${relPath} must contain try/catch for graceful error handling`);
    assert.match(content, /catch\s*\(/, `${relPath} must contain catch block for error recovery`);
  });
}

test('REL-01: hooks use fail-open pattern (process.exit(0) in catch)', () => {
  for (const hookFile of ['hooks/nf-stop.js', 'hooks/nf-prompt.js']) {
    const content = fs.readFileSync(path.join(ROOT, hookFile), 'utf8');
    assert.match(content, /process\.exit\(0\)/, `${hookFile} must have fail-open process.exit(0)`);
  }
});
