#!/usr/bin/env node
'use strict';
// bin/resolve-prism-bin.cjs
// Resolves the PRISM model checker binary path from PRISM_BIN env var.
// Returns the path if it exists on disk, or null otherwise (fail-open).
//
// Usage (as module):
//   const { resolvePrismBin } = require('./resolve-prism-bin.cjs');
//   const prismBin = resolvePrismBin(); // string | null
//
// Referenced by:
//   - bin/run-formal-check.cjs
//   - bin/run-prism.cjs
//   - bin/run-oauth-rotation-prism.cjs
//   - bin/install-formal-tools.cjs
//   - bin/run-sensitivity-sweep.cjs

const fs = require('fs');
const path = require('path');

/**
 * Resolve the PRISM binary from the PRISM_BIN environment variable.
 * @returns {string|null} Absolute path to the PRISM binary, or null if not set/found.
 */
function resolvePrismBin() {
  const prismBin = process.env.PRISM_BIN;
  if (!prismBin) return null;

  // Expand ~ to home directory
  const resolved = prismBin.startsWith('~')
    ? path.join(require('os').homedir(), prismBin.slice(1))
    : prismBin;

  try {
    if (fs.existsSync(resolved)) return resolved;
  } catch (_) {
    // fail-open
  }

  return null;
}

module.exports = { resolvePrismBin };
