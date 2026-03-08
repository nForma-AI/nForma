#!/usr/bin/env node
// @requirement HLTH-03
// Behavioral test: The W002 check in validate health does not emit false positives
// for versioned phase references in STATE.md when the corresponding directory exists.
// W002 fires when STATE.md references a phase not found on disk.

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const os = require('node:os');

const GSD_TOOLS = '/Users/jonathanborduas/code/QGSD/core/bin/gsd-tools.cjs';

function createTempProject() {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'hlth03-'));
  const planningDir = path.join(tmpDir, '.planning');
  fs.mkdirSync(path.join(planningDir, 'phases'), { recursive: true });
  return tmpDir;
}

function runValidateHealth(tmpDir) {
  const result = execFileSync(process.execPath, [GSD_TOOLS, 'validate', 'health'], {
    cwd: tmpDir,
    encoding: 'utf8',
    timeout: 10000,
    env: { ...process.env, NODE_ENV: 'test' },
  });
  return JSON.parse(result);
}

test('HLTH-03: W002 not emitted for versioned phase ref in STATE.md when dir exists', () => {
  const tmpDir = createTempProject();
  try {
    // Create versioned phase directory on disk
    fs.mkdirSync(path.join(tmpDir, '.planning', 'phases', 'v0.15-01-health-fix'), { recursive: true });
    // STATE.md references phase v0.15-01
    fs.writeFileSync(path.join(tmpDir, '.planning', 'STATE.md'),
      '# Project State\n\n## Current Position\n\nPhase v0.15-01\nPlan: 1\nStatus: in-progress\n');
    fs.writeFileSync(path.join(tmpDir, '.planning', 'ROADMAP.md'),
      '# Roadmap\n\n### Phase v0.15-01: Health Fix\n');
    fs.writeFileSync(path.join(tmpDir, '.planning', 'config.json'),
      JSON.stringify({ model_profile: 'quality' }));

    const data = runValidateHealth(tmpDir);
    const w002 = (data.warnings || data.issues || []).some(
      i => i.code === 'W002' && i.message && i.message.includes('v0.15-01')
    );
    assert.ok(!w002, `W002 must not fire for v0.15-01 when phase dir exists on disk`);
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});
