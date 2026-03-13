'use strict';

// Run TUI tests with --test-force-exit on Node 20+.
// On Node 18 (which lacks --test-force-exit), run without it. The spawnSync
// timeout kills the hanging process, and we treat timeout-after-all-tests-pass
// as success (exit 0).

const { spawnSync } = require('child_process');
const major = parseInt(process.versions.node, 10);

const args = ['--test'];
if (major >= 20) {
  args.push('--test-force-exit');
}
args.push('test/tui-unit.test.cjs');

const result = spawnSync(process.execPath, args, {
  stdio: major < 20 ? ['inherit', 'pipe', 'inherit'] : 'inherit',
  env: { ...process.env, NF_TEST_MODE: '1' },
  timeout: major < 20 ? 60000 : 0, // 60s timeout only on Node 18
});

if (major < 20) {
  // Print stdout
  const output = result.stdout ? result.stdout.toString() : '';
  process.stdout.write(output);

  // If timed out but all tests passed, treat as success
  if (result.signal === 'SIGTERM' && output.includes('# fail 0')) {
    process.exit(0);
  }
}

process.exit(result.status ?? 1);
