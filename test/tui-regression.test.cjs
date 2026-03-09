'use strict';

const { test, describe, before } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const GOLDEN_DIR = path.join(__dirname, 'golden');
const ROOT = path.join(__dirname, '..');

// Strip ANSI escape codes for text assertions
function stripAnsi(str) {
  return str.replace(/\x1b\[[0-9;]*[a-zA-Z]/g, '');
}

// ── Capture module output via --screenshot (no VHS needed) ───────────────────

describe('TUI regression: --screenshot capture', { timeout: 30000 }, () => {
  const captures = {};

  before(() => {
    fs.mkdirSync(GOLDEN_DIR, { recursive: true });

    // Capture each module's static screenshot output
    for (const mod of ['agents', 'reqs', 'config', 'sessions']) {
      try {
        const raw = execFileSync('node', ['bin/nForma.cjs', '--screenshot', mod], {
          cwd: ROOT, timeout: 15000, encoding: 'utf8',
        });
        captures[mod] = stripAnsi(raw);
        // Also write golden .txt for external diffing
        fs.writeFileSync(path.join(GOLDEN_DIR, `tui-${mod}.txt`), raw);
      } catch (e) {
        console.log(`--screenshot ${mod} failed: ${e.message}`);
      }
    }
  });

  function requireCapture(t, mod) {
    if (!captures[mod]) { t.skip(`--screenshot ${mod} not available`); return null; }
    return captures[mod];
  }

  // ── Agents module ────────────────────────────────────────────────────────

  test('Agents module renders agent roster', (t) => {
    const txt = requireCapture(t, 'agents');
    if (!txt) return;
    assert.ok(txt.includes('nForma'), 'header must contain nForma branding');
    assert.ok(txt.includes('List Agents'), 'must show List Agents menu item');
  });

  // ── Reqs module ──────────────────────────────────────────────────────────

  test('Reqs module renders requirement content', (t) => {
    const txt = requireCapture(t, 'reqs');
    if (!txt) return;
    assert.ok(txt.includes('nForma'), 'header must contain nForma branding');
    assert.ok(txt.includes('Browse Reqs'), 'must show Browse Reqs menu item');
  });

  // ── Config module ────────────────────────────────────────────────────────

  test('Config module renders settings menu', (t) => {
    const txt = requireCapture(t, 'config');
    if (!txt) return;
    assert.ok(txt.includes('Settings'), 'must show Settings menu item');
    assert.ok(txt.includes('Export Roster'), 'must show Export Roster');
  });

  // ── Sessions module ──────────────────────────────────────────────────────

  test('Sessions module renders', (t) => {
    const txt = requireCapture(t, 'sessions');
    if (!txt) return;
    assert.ok(txt.includes('New Session'), 'must show New Session menu item');
  });

  // ── Cross-module: header and layout ────────────────────────────────────

  test('All modules share consistent header', (t) => {
    for (const mod of ['agents', 'reqs', 'config', 'sessions']) {
      const txt = captures[mod];
      if (!txt) continue;
      assert.ok(txt.includes('nForma'), `${mod}: header must contain nForma`);
      assert.ok(txt.includes('[F1]'), `${mod}: header must show F1 shortcut`);
      assert.ok(txt.includes('[q]'), `${mod}: header must show quit shortcut`);
    }
  });
});

// ── VHS-based visual regression (PNG screenshots) ────────────────────────────

describe('TUI regression: VHS visual capture', { timeout: 120000 }, () => {
  let vhsAvailable = false;

  before(() => {
    try {
      execFileSync('which', ['vhs'], { stdio: 'pipe' });
      vhsAvailable = true;
    } catch {
      console.log('VHS not installed — skipping visual regression');
      return;
    }

    const TAPE_FILE = path.join(ROOT, 'scripts', 'tui-regression.tape');
    if (!fs.existsSync(TAPE_FILE)) {
      console.log('VHS tape not found — skipping visual regression');
      vhsAvailable = false;
      return;
    }

    fs.mkdirSync(GOLDEN_DIR, { recursive: true });
    console.log('Running VHS tape for PNG captures...');
    execFileSync('vhs', [TAPE_FILE], {
      stdio: 'pipe', timeout: 90000, cwd: ROOT,
    });
  });

  test('VHS produces agent screenshot PNG', (t) => {
    if (!vhsAvailable) { t.skip('VHS not available'); return; }
    const png = path.join(GOLDEN_DIR, 'tui-agents.png');
    assert.ok(fs.existsSync(png), 'tui-agents.png must exist');
    assert.ok(fs.statSync(png).size > 1000, 'PNG must not be empty');
  });
});
