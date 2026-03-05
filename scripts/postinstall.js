#!/usr/bin/env node
'use strict';
const fs = require('fs');
const path = require('path');

// 1. Remove nested node-pty@1.0.0 so blessed-xterm uses top-level 1.1.0
try {
  fs.rmSync('node_modules/blessed-xterm/node_modules/node-pty', { recursive: true, force: true });
} catch (_) {}

// 2. Fix spawn-helper permissions (npm strips +x from prebuilt binaries)
try {
  const helper = path.join('node_modules', 'node-pty', 'prebuilds',
    `${process.platform}-${process.arch}`, 'spawn-helper');
  if (fs.existsSync(helper)) fs.chmodSync(helper, 0o755);
} catch (_) {}

// 3. Patch blessed-xterm clone() to skip screen/parent (they contain tty handles
//    with read-only properties that crash the clone library on modern Node)
try {
  const file = 'node_modules/blessed-xterm/blessed-xterm.js';
  let src = fs.readFileSync(file, 'utf8');
  if (!src.includes('_screen')) {
    src = src.replace(
      'options = clone(options)',
      [
        'const _screen = options.screen; delete options.screen',
        '        const _parent = options.parent; delete options.parent',
        '        options = clone(options)',
        '        if (_screen) options.screen = _screen',
        '        if (_parent) options.parent = _parent',
      ].join('\n')
    );
    fs.writeFileSync(file, src);
  }
} catch (_) {}

// 4. Auto-migrate .planning/ from flat layout to v0.27+ hierarchy
try {
  const { migrate } = require('../bin/migrate-planning.cjs');
  const root = path.resolve(__dirname, '..');
  if (fs.existsSync(path.join(root, '.planning'))) {
    const stats = migrate(root, false);
    if (stats.moved > 0) {
      console.log(`[postinstall] Migrated .planning/ hierarchy: ${stats.moved} files moved`);
    }
  }
} catch (_) {}
