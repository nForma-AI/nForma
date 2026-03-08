#!/usr/bin/env node
// @requirement HLTH-02
// Behavioral test: The W007 check in validate health does not emit false positives
// for versioned phase directories that are present on both disk and ROADMAP.
// W007 fires when a phase exists on disk but NOT in ROADMAP. The normalizePhaseName
// function ensures versioned names like "v0.15-01-health-fix" match ROADMAP entries
// like "v0.15-01".

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const os = require('node:os');

const GSD_TOOLS = '/Users/jonathanborduas/code/QGSD/core/bin/gsd-tools.cjs';

function createTempProject() {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'hlth02-'));
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

test('HLTH-02: W007 not emitted for versioned phase dir when ROADMAP lists matching phase', () => {
  const tmpDir = createTempProject();
  try {
    // Create versioned phase on disk
    fs.mkdirSync(path.join(tmpDir, '.planning', 'phases', 'v0.15-01-health-fix'), { recursive: true });
    // ROADMAP references v0.15-01
    fs.writeFileSync(path.join(tmpDir, '.planning', 'ROADMAP.md'),
      '# Roadmap\n\n### Phase v0.15-01: Health Fix\n');
    fs.writeFileSync(path.join(tmpDir, '.planning', 'STATE.md'),
      '# Project State\n\n## Current Position\n\nPhase v0.15-01\nPlan: 1\nStatus: in-progress\n');
    fs.writeFileSync(path.join(tmpDir, '.planning', 'config.json'),
      JSON.stringify({ model_profile: 'quality' }));

    const data = runValidateHealth(tmpDir);
    const w007 = (data.warnings || data.issues || []).some(
      i => i.code === 'W007' && i.message && i.message.includes('v0.15-01')
    );
    assert.ok(!w007, `W007 must not fire for v0.15-01 when disk+ROADMAP agree`);
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});
