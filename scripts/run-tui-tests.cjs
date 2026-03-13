'use strict';

// Run TUI tests with --test-force-exit on Node 20+.
// Node 18 lacks --test-force-exit and hangs on open handles; CI skips
// TUI tests on Node 18 via workflow condition (matrix.node != '18').

const { execFileSync } = require('child_process');
const major = parseInt(process.versions.node, 10);

const args = ['--test'];
if (major >= 20) args.push('--test-force-exit');
args.push('test/tui-unit.test.cjs');

try {
  execFileSync(process.execPath, args, {
    stdio: 'inherit',
    env: { ...process.env, NF_TEST_MODE: '1' },
  });
} catch (err) {
  process.exit(err.status || 1);
}
