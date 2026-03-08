#!/usr/bin/env node
// @requirement DETECT-06
// Structural test: Oscillation detection requires at least one diff pair with net content
// removal (deletions > additions) before classifying as oscillation. Pure zero-net
// substitution pairs are not treated as reversion evidence.
// Verifies hasReversionInHashes logic in nf-circuit-breaker.js.

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const SOURCE = path.resolve(__dirname, '../../../hooks/nf-circuit-breaker.js');
const content = fs.readFileSync(SOURCE, 'utf8');

test('DETECT-06: hasReversionInHashes function is defined', () => {
  assert.match(content, /function hasReversionInHashes/, 'hasReversionInHashes must be defined');
});

test('DETECT-06: hasNegativePair tracking variable is used', () => {
  // The algorithm must track whether at least one pair has negative net change
  assert.match(content, /hasNegativePair/, 'hasNegativePair variable must be tracked');
});

test('DETECT-06: return condition requires both non-positive total AND negative pair', () => {
  // The critical invariant: totalNetChange <= 0 && hasNegativePair
  assert.match(content, /totalNetChange\s*<=\s*0\s*&&\s*hasNegativePair/,
    'Return must require totalNetChange <= 0 AND hasNegativePair');
});

test('DETECT-06: pairNet is computed as additions minus deletions', () => {
  assert.match(content, /pairNet\s*=\s*additions\s*-\s*deletions/,
    'pairNet must be computed as additions - deletions');
});

test('DETECT-06: hasNegativePair is set when pairNet < 0', () => {
  assert.match(content, /pairNet\s*<\s*0.*hasNegativePair\s*=\s*true|hasNegativePair\s*=\s*true.*pairNet\s*<\s*0/s,
    'hasNegativePair must be set to true when pairNet < 0');
});

test('DETECT-06: detectOscillation calls hasReversionInHashes for second-pass check', () => {
  assert.match(content, /hasReversionInHashes\(gitRoot,\s*oscillatingHashes,\s*files\)/,
    'detectOscillation must call hasReversionInHashes for second-pass reversion check');
});
