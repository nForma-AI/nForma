'use strict';

// Run TUI tests with --test-force-exit on Node 20+.
// On Node 18 (which lacks --test-force-exit), run without it and force
// process.exit after child completes to prevent hanging on open handles.

const { spawnSync } = require('child_process');
const major = parseInt(process.versions.node, 10);

const args = ['--test'];
if (major >= 20) {
  args.push('--test-force-exit');
}
// Node 18: no extra flags — spawnSync timeout + forced process.exit handle the hang
args.push('test/tui-unit.test.cjs');

const result = spawnSync(process.execPath, args, {
  stdio: 'inherit',
  env: { ...process.env, NF_TEST_MODE: '1' },
  timeout: 120000,
});

const code = result.status ?? 1;

if (major < 20) {
  // Force exit to prevent Node 18 test runner from hanging on open handles
  setTimeout(() => process.exit(code), 500);
} else {
  process.exit(code);
}
