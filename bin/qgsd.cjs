#!/usr/bin/env node
'use strict';

/**
 * qgsd CLI — lightweight circuit breaker management
 * Installed to ~/.claude/qgsd-bin/qgsd.cjs via bin/install.js
 * Used by workflow files instead of `npx qgsd` (qgsd is not published to npm)
 */

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const args = process.argv.slice(2);

function getProjectRoot() {
  const git = spawnSync('git', ['rev-parse', '--show-toplevel'], {
    cwd: process.cwd(),
    encoding: 'utf8',
    timeout: 5000,
  });
  return (git.status === 0 && !git.error) ? git.stdout.trim() : process.cwd();
}

function getStateFile() {
  return path.join(getProjectRoot(), '.claude', 'circuit-breaker-state.json');
}

if (args.includes('--disable-breaker')) {
  const stateFile = getStateFile();
  fs.mkdirSync(path.dirname(stateFile), { recursive: true });
  const existing = fs.existsSync(stateFile)
    ? JSON.parse(fs.readFileSync(stateFile, 'utf8'))
    : {};
  fs.writeFileSync(stateFile, JSON.stringify({ ...existing, disabled: true, active: false }, null, 2), 'utf8');
  console.log('  \u2298 Circuit breaker disabled. Detection and enforcement paused.');
  process.exit(0);
}

if (args.includes('--enable-breaker')) {
  const stateFile = getStateFile();
  if (fs.existsSync(stateFile)) {
    const existing = JSON.parse(fs.readFileSync(stateFile, 'utf8'));
    fs.writeFileSync(stateFile, JSON.stringify({ ...existing, disabled: false, active: false }, null, 2), 'utf8');
  }
  console.log('  \u2713 Circuit breaker enabled. Oscillation detection resumed.');
  process.exit(0);
}

if (args.includes('--reset-breaker')) {
  const stateFile = getStateFile();
  if (fs.existsSync(stateFile)) {
    fs.rmSync(stateFile);
    console.log('  \u2713 Circuit breaker state cleared. Claude can resume Bash execution.');
  } else {
    console.log('  No active circuit breaker state found.');
  }
  process.exit(0);
}

console.error('Usage: node qgsd.cjs [--disable-breaker | --enable-breaker | --reset-breaker]');
process.exit(1);
