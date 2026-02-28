#!/usr/bin/env node
'use strict';
// bin/run-tlc.cjs
// Invokes TLC model checker for the QGSD formal TLA+ specification.
// Requirements: TLA-04
//
// Usage:
//   node bin/run-tlc.cjs MCsafety     # safety check (N=5, symmetry, ~30s)
//   node bin/run-tlc.cjs MCliveness   # liveness check (N=3, no symmetry, ~60s)
//   node bin/run-tlc.cjs --config=MCsafety
//
// Prerequisites:
//   - Java >=17 (https://adoptium.net/)
//   - formal/tla/tla2tools.jar (see formal/tla/README.md for download command)

const { spawnSync } = require('child_process');
const fs   = require('fs');
const path = require('path');
const { writeCheckResult } = require('./write-check-result.cjs');

const VALID_CONFIGS = ['MCsafety', 'MCliveness', 'MCMCPEnv'];

// ── Surface map for liveness detection ──────────────────────────────────────
const SURFACE_MAP = {
  'MCliveness':            'quorum',
  'MCdeliberation':        'deliberation',
  'MCprefilter':           'prefilter',
  'MCrecruiting-liveness': 'recruiting',
  'MCbreaker':             'breaker',
  'MCconvergence':         'convergence',
  'MCoscillation':         'oscillation',
  'MCaccount-manager':     'account-manager',
  'MCMCPEnv':              'mcp-calls',  // MCPENV-02
};

/**
 * Detect liveness properties in a TLC config that lack fairness declarations.
 * Returns array of property names missing a matching ## header in invariants.md.
 * Returns [] if no PROPERTY/PROPERTIES lines found (not a liveness config).
 * @param {string} configName - Config name (e.g., 'MCliveness')
 * @param {string} cfgPath    - Absolute path to the .cfg file
 * @param {string} [specDir]  - Override for formal/spec directory (test injection)
 * @returns {string[]} Property names with no fairness declaration
 */
function detectLivenessProperties(configName, cfgPath, specDir) {
  const defaultSpecDir = path.join(__dirname, '..', 'formal', 'spec');
  const resolvedSpecDir = specDir || defaultSpecDir;

  let cfgContent;
  try {
    cfgContent = fs.readFileSync(cfgPath, 'utf8');
  } catch (e) {
    return []; // Can't read config — not a detection failure
  }

  // Extract all property names from PROPERTY/PROPERTIES lines (handles multi-name lines)
  const propertyNames = [];
  for (const line of cfgContent.split('\n')) {
    const m = line.trim().match(/^PROPERT(?:Y|IES)\s+(.*)/);
    if (m) {
      propertyNames.push(...m[1].trim().split(/\s+/).filter(n => /^\w+$/.test(n)));
    }
  }
  if (propertyNames.length === 0) {
    return []; // No liveness properties declared
  }

  const surface = SURFACE_MAP[configName] || null;
  if (!surface) {
    return []; // Unknown surface — can't validate; do not block unknown configs
  }

  const invariantsPath = path.join(resolvedSpecDir, surface, 'invariants.md');
  let invariantsContent;
  try {
    invariantsContent = fs.readFileSync(invariantsPath, 'utf8');
  } catch (e) {
    // invariants.md missing entirely — all properties lack declarations
    return propertyNames;
  }

  return propertyNames.filter(propName => !invariantsContent.includes('## ' + propName));
}

// ── Main execution (only when run directly, not when require()'d by tests) ──
if (require.main === module) {
  // ── Parse --config argument ────────────────────────────────────────────────
  const args       = process.argv.slice(2);
  const configArg  = args.find(a => a.startsWith('--config=')) || null;
  const configName = configArg
    ? configArg.split('=')[1]
    : (args.find(a => !a.startsWith('-')) || 'MCsafety');

  if (!VALID_CONFIGS.includes(configName)) {
    process.stderr.write(
      '[run-tlc] Unknown config: ' + configName +
      '. Valid: ' + VALID_CONFIGS.join(', ') + '\n'
    );
    try { writeCheckResult({ tool: 'run-tlc', formalism: 'tla', result: 'fail', metadata: { config: configName } }); } catch (e) { process.stderr.write('[run-tlc] Warning: failed to write check result: ' + e.message + '\n'); }
    process.exit(1);
  }

  // ── 1. Locate Java ─────────────────────────────────────────────────────────
  const JAVA_HOME = process.env.JAVA_HOME;
  let javaExe;

  if (JAVA_HOME) {
    javaExe = path.join(JAVA_HOME, 'bin', 'java');
    if (!fs.existsSync(javaExe)) {
      process.stderr.write(
        '[run-tlc] JAVA_HOME is set but java binary not found at: ' + javaExe + '\n' +
        '[run-tlc] Unset JAVA_HOME or fix the path.\n'
      );
      try { writeCheckResult({ tool: 'run-tlc', formalism: 'tla', result: 'fail', metadata: { config: configName } }); } catch (e) { process.stderr.write('[run-tlc] Warning: failed to write check result: ' + e.message + '\n'); }
      process.exit(1);
    }
  } else {
    // Fall back to PATH lookup
    const probe = spawnSync('java', ['--version'], { encoding: 'utf8' });
    if (probe.error || probe.status !== 0) {
      process.stderr.write(
        '[run-tlc] Java not found. Install Java >=17 and set JAVA_HOME.\n' +
        '[run-tlc] Download: https://adoptium.net/\n'
      );
      try { writeCheckResult({ tool: 'run-tlc', formalism: 'tla', result: 'fail', metadata: { config: configName } }); } catch (e) { process.stderr.write('[run-tlc] Warning: failed to write check result: ' + e.message + '\n'); }
      process.exit(1);
    }
    javaExe = 'java';
  }

  // ── 2. Check Java version >=17 ─────────────────────────────────────────────
  const versionResult = spawnSync(javaExe, ['--version'], { encoding: 'utf8' });
  if (versionResult.error || versionResult.status !== 0) {
    process.stderr.write('[run-tlc] Failed to run: ' + javaExe + ' --version\n');
    try { writeCheckResult({ tool: 'run-tlc', formalism: 'tla', result: 'fail', metadata: { config: configName } }); } catch (e) { process.stderr.write('[run-tlc] Warning: failed to write check result: ' + e.message + '\n'); }
    process.exit(1);
  }
  const versionOutput = versionResult.stdout + versionResult.stderr;
  // Java version string varies: "openjdk 17.0.1 ..." or "java version \"17.0.1\""
  const versionMatch = versionOutput.match(/(?:openjdk\s+|java version\s+[""]?)(\d+)/i);
  const javaMajor    = versionMatch ? parseInt(versionMatch[1], 10) : 0;
  if (javaMajor < 17) {
    process.stderr.write(
      '[run-tlc] Java >=17 required. Found: ' + versionOutput.split('\n')[0] + '\n' +
      '[run-tlc] Download Java 17+: https://adoptium.net/\n'
    );
    try { writeCheckResult({ tool: 'run-tlc', formalism: 'tla', result: 'fail', metadata: { config: configName } }); } catch (e) { process.stderr.write('[run-tlc] Warning: failed to write check result: ' + e.message + '\n'); }
    process.exit(1);
  }

  // ── 3. Locate tla2tools.jar ────────────────────────────────────────────────
  const jarPath = path.join(__dirname, '..', 'formal', 'tla', 'tla2tools.jar');
  if (!fs.existsSync(jarPath)) {
    process.stderr.write(
      '[run-tlc] tla2tools.jar not found at: ' + jarPath + '\n' +
      '[run-tlc] Download v1.8.0:\n' +
      '  curl -L https://github.com/tlaplus/tlaplus/releases/download/v1.8.0/tla2tools.jar \\\n' +
      '       -o formal/tla/tla2tools.jar\n'
    );
    try { writeCheckResult({ tool: 'run-tlc', formalism: 'tla', result: 'fail', metadata: { config: configName } }); } catch (e) { process.stderr.write('[run-tlc] Warning: failed to write check result: ' + e.message + '\n'); }
    process.exit(1);
  }

  // ── 4. Invoke TLC ──────────────────────────────────────────────────────────
  const specPath = path.join(__dirname, '..', 'formal', 'tla', 'QGSDQuorum.tla');
  const cfgPath  = path.join(__dirname, '..', 'formal', 'tla', configName + '.cfg');
  // Use -workers 1 for liveness (defensive — avoids known multi-worker liveness bugs in older TLC)
  const workers  = configName === 'MCliveness' ? '1' : 'auto';

  process.stdout.write('[run-tlc] Config: ' + configName + '  Workers: ' + workers + '\n');
  process.stdout.write('[run-tlc] Spec:   ' + specPath + '\n');
  process.stdout.write('[run-tlc] Cfg:    ' + cfgPath + '\n');

  const tlcResult = spawnSync(javaExe, [
    '-jar', jarPath,
    '-config', cfgPath,
    '-workers', workers,
    specPath,
  ], { encoding: 'utf8', stdio: 'inherit' });

  if (tlcResult.error) {
    process.stderr.write('[run-tlc] TLC invocation failed: ' + tlcResult.error.message + '\n');
    try { writeCheckResult({ tool: 'run-tlc', formalism: 'tla', result: 'fail', metadata: { config: configName } }); } catch (e) { process.stderr.write('[run-tlc] Warning: failed to write check result: ' + e.message + '\n'); }
    process.exit(1);
  }

  const passed = (tlcResult.status || 0) === 0;

  if (passed) {
    const missingDeclarations = detectLivenessProperties(configName, cfgPath);
    if (missingDeclarations.length > 0) {
      try {
        writeCheckResult({
          tool: 'run-tlc',
          formalism: 'tla',
          result: 'inconclusive',
          metadata: {
            config: configName,
            reason: 'Fairness declaration missing for: ' + missingDeclarations.join(', '),
          }
        });
      } catch (e) {
        process.stderr.write('[run-tlc] Warning: failed to write inconclusive result: ' + e.message + '\n');
      }
      process.stdout.write('[run-tlc] Result: inconclusive — fairness declaration missing for: ' + missingDeclarations.join(', ') + '\n');
      process.exit(0); // inconclusive is not a failure
    } else {
      try {
        writeCheckResult({ tool: 'run-tlc', formalism: 'tla', result: 'pass', metadata: { config: configName } });
      } catch (e) {
        process.stderr.write('[run-tlc] Warning: failed to write check result: ' + e.message + '\n');
      }
      process.exit(0);
    }
  } else {
    try {
      writeCheckResult({ tool: 'run-tlc', formalism: 'tla', result: 'fail', metadata: { config: configName } });
    } catch (e) {
      process.stderr.write('[run-tlc] Warning: failed to write check result: ' + e.message + '\n');
    }
    process.exit(tlcResult.status || 0);
  }
}

// Export for testing — safe because main execution is guarded by require.main === module
module.exports = { detectLivenessProperties };
