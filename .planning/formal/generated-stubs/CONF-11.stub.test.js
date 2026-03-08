#!/usr/bin/env node
// @requirement CONF-11
// Global polyrepo registry at ~/.claude/polyrepos/<name>.json and per-repo marker
// at .planning/polyrepo.json enable named groups of related repositories

const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

const PROJECT_ROOT = path.resolve(__dirname, '..', '..', '..');
const polyrepoPath = path.join(PROJECT_ROOT, 'bin', 'polyrepo.cjs');
const polyrepo = require(polyrepoPath);

test('CONF-11: polyrepo module exports POLYREPOS_DIR pointing to ~/.claude/polyrepos', () => {
  assert.ok(typeof polyrepo.POLYREPOS_DIR === 'string',
    'POLYREPOS_DIR must be a string');
  assert.match(polyrepo.POLYREPOS_DIR, /\.claude[/\\]polyrepos$/,
    'POLYREPOS_DIR must point to ~/.claude/polyrepos');
});

test('CONF-11: polyrepo module exports MARKER_FILE as polyrepo.json', () => {
  assert.equal(polyrepo.MARKER_FILE, 'polyrepo.json',
    'MARKER_FILE must be polyrepo.json');
});

test('CONF-11: polyrepo exports group management functions', () => {
  assert.equal(typeof polyrepo.createGroup, 'function', 'createGroup must be exported');
  assert.equal(typeof polyrepo.loadGroup, 'function', 'loadGroup must be exported');
  assert.equal(typeof polyrepo.saveGroup, 'function', 'saveGroup must be exported');
  assert.equal(typeof polyrepo.listGroups, 'function', 'listGroups must be exported');
  assert.equal(typeof polyrepo.listGroup, 'function', 'listGroup must be exported');
  assert.equal(typeof polyrepo.addRepo, 'function', 'addRepo must be exported');
  assert.equal(typeof polyrepo.removeRepo, 'function', 'removeRepo must be exported');
});

test('CONF-11: polyrepo exports per-repo marker functions', () => {
  assert.equal(typeof polyrepo.writeMarker, 'function', 'writeMarker must be exported');
  assert.equal(typeof polyrepo.readMarker, 'function', 'readMarker must be exported');
  assert.equal(typeof polyrepo.removeMarker, 'function', 'removeMarker must be exported');
});
