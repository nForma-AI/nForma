'use strict';

// Run TUI tests with --test-force-exit on Node 20+.
// On Node 18 (which lacks --test-force-exit), use --test-timeout and force
// process.exit after completion to prevent hanging on open handles.

const { execFile } = require('child_process');
const major = parseInt(process.versions.node, 10);

const args = ['--test'];
if (major >= 20) {
  args.push('--test-force-exit');
} else {
  // Node 18: set a generous test timeout; force exit after child completes
  args.push('--test-timeout', '30000');
}
args.push('test/tui-unit.test.cjs');

const child = execFile(process.execPath, args, {
  stdio: 'inherit',
  env: { ...process.env, NF_TEST_MODE: '1' },
  timeout: 120000, // 2 min hard cap
}, (err) => {
  if (err) {
    process.exit(err.code === 'ETIMEDOUT' ? 1 : (err.status || 1));
  }
  // Force exit on Node 18 to prevent hanging on open handles
  if (major < 20) setTimeout(() => process.exit(0), 1000);
});

child.on('exit', (code) => {
  if (major < 20) setTimeout(() => process.exit(code || 0), 1000);
});
