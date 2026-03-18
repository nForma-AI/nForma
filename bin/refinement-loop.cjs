#!/usr/bin/env node
'use strict';

/**
 * refinement-loop.cjs
 *
 * Bug context normalization and inverted verification loop for model refinement.
 * When --bug-context is provided, the model checker's semantics are inverted:
 * finding a violation means the model REPRODUCES the bug (success),
 * passing means the model does NOT capture the failure (retry).
 *
 * Usage:
 *   node bin/refinement-loop.cjs --model <path> --bug-context <text-or-file> --formalism tla|alloy [--max-attempts 3] [--verbose] [--format json|text]
 *
 * Module exports:
 *   { normalizeBugContext, verifyBugReproduction, formatIterationFeedback, _setDeps }
 */

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

// ---- Dependency Injection for Testing ----

let deps = {
  execFileSync,
  existsSync: fs.existsSync,
  readFileSync: fs.readFileSync
};

/**
 * Override dependencies for testing.
 * @param {Object} overrides - { execFileSync, existsSync, readFileSync }
 */
function _setDeps(overrides) {
  deps = { ...deps, ...overrides };
}

// ---- Bug Context Normalization (MRF-01) ----

/**
 * Normalize --bug-context input: inline text or file path (auto-detected).
 * @param {string|null|undefined} value - Raw bug context value
 * @returns {string} Normalized plain text (empty string on any error)
 */
function normalizeBugContext(value) {
  try {
    if (value == null || typeof value !== 'string' || value.trim() === '') {
      return '';
    }
    const trimmed = value.trim();
    // Auto-detect: if it's a valid file path, read contents
    if (deps.existsSync(trimmed)) {
      return deps.readFileSync(trimmed, 'utf-8').trim();
    }
    // Otherwise treat as inline text
    return trimmed;
  } catch (_err) {
    // Fail-open: return empty string on any error
    return '';
  }
}

// ---- Inverted Verification Loop (MRF-02) ----

/**
 * Parse checker output to extract a summary line.
 * @param {string} output - Checker stdout/stderr
 * @param {boolean} hasError - Whether checker reported an error
 * @returns {string} Short summary
 */
function parseCheckerSummary(output, hasError) {
  if (!output || typeof output !== 'string') {
    return hasError ? 'violation found' : 'model passes';
  }
  // Look for invariant violation message
  const invMatch = output.match(/Invariant\s+(\S+)\s+is violated/i);
  if (invMatch) {
    return `invariant ${invMatch[1]} violated`;
  }
  // Look for assertion failure (Alloy)
  const assertMatch = output.match(/Assertion\s+(\S+).*may not hold/i);
  if (assertMatch) {
    return `assertion ${assertMatch[1]} may not hold`;
  }
  // Look for "no error" message
  if (/no error has been found/i.test(output)) {
    return 'model invariants hold, bug not captured';
  }
  // Look for state count
  const stateMatch = output.match(/(\d+)\s+states?\s+found/i);
  if (stateMatch) {
    return hasError
      ? `violation found after exploring ${stateMatch[1]} states`
      : `${stateMatch[1]} states explored, no violation`;
  }
  return hasError ? 'violation found' : 'model passes';
}

/**
 * Extract counterexample trace from checker output.
 * @param {string} output - Checker stdout/stderr
 * @returns {string|null} Trace text or null
 */
function extractCounterexample(output) {
  if (!output || typeof output !== 'string') return null;
  // TLC counterexample pattern
  const traceMatch = output.match(/Error:\s*.*?\n((?:State \d+.*\n?)+)/s);
  if (traceMatch) return traceMatch[0].trim();
  // Generic "State" pattern
  const stateLines = output.split('\n').filter(l => /^State \d+/.test(l));
  if (stateLines.length > 0) return stateLines.join('\n');
  return null;
}

/**
 * Run the inverted verification loop for model refinement.
 * INVERTED SEMANTICS: error = reproduced (success), pass = not captured (retry).
 *
 * @param {string} modelPath - Path to the formal model file
 * @param {string} bugContext - Normalized bug description text
 * @param {Object} [options] - Configuration
 * @param {string} options.formalism - 'tla' or 'alloy'
 * @param {number} [options.maxAttempts=3] - Max iterations
 * @param {boolean} [options.verbose=false] - Show full checker output
 * @param {Function} [options.onIteration] - Callback({ attempt, passed, summary })
 * @returns {Object} { status, attempts, model_path, counterexample, iterations }
 */
function verifyBugReproduction(modelPath, bugContext, options) {
  options = options || {};
  const formalism = options.formalism || 'tla';
  const maxAttempts = options.maxAttempts || 3;
  const verbose = options.verbose || false;
  const onIteration = options.onIteration || null;

  const iterations = [];

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    let output = '';
    let hasError = false;

    try {
      // Determine checker command
      const checkerScript = formalism === 'alloy'
        ? path.join(__dirname, 'run-alloy.cjs')
        : path.join(__dirname, 'run-tlc.cjs');

      // Run checker as subprocess via execFileSync (no shell injection risk)
      output = deps.execFileSync('node', [checkerScript, modelPath], {
        encoding: 'utf-8',
        timeout: 60000,
        stdio: ['pipe', 'pipe', 'pipe']
      });
      // Zero exit = checker passed = model does NOT capture the failure
      hasError = false;
    } catch (err) {
      if (err.status && err.status !== 0) {
        // Non-zero exit = checker found violation = model REPRODUCES the bug
        output = (err.stdout || '') + (err.stderr || '');
        hasError = true;
      } else {
        // Spawn failure, timeout, or other error — fail-open as "not reproduced"
        output = err.message || 'checker subprocess error';
        hasError = false;
        process.stderr.write(`[refinement-loop] Checker error on attempt ${attempt}: ${err.message}\n`);
      }
    }

    const summary = parseCheckerSummary(output, hasError);

    if (hasError) {
      // Model found a violation — it REPRODUCES the bug — SUCCESS
      const counterexample = extractCounterexample(output);
      const iteration = { attempt, passed: false, summary };
      iterations.push(iteration);
      if (onIteration) onIteration(iteration);

      return {
        status: 'reproduced',
        attempts: attempt,
        model_path: modelPath,
        counterexample: counterexample,
        iterations
      };
    }

    // Model passes — does NOT capture the failure — RETRY
    const iteration = { attempt, passed: true, summary };
    iterations.push(iteration);
    if (onIteration) onIteration(iteration);
  }

  // All attempts exhausted — model does not reproduce the bug
  return {
    status: 'not_reproduced',
    attempts: maxAttempts,
    model_path: modelPath,
    counterexample: null,
    iterations
  };
}

// ---- Iteration Feedback Formatting ----

/**
 * Format a single iteration's feedback for display.
 * @param {Object} iteration - { attempt, passed, summary }
 * @param {boolean} [verbose=false] - Include full output
 * @param {string} [fullOutput=''] - Full checker output (for verbose mode)
 * @returns {string} Formatted feedback line
 */
function formatIterationFeedback(iteration, verbose, fullOutput) {
  const status = iteration.passed ? 'still passes' : 'reproduced';
  const line = `Attempt ${iteration.attempt}: ${status} \u2014 ${iteration.summary}`;
  if (verbose && fullOutput) {
    return `${line}\n  Full output:\n${fullOutput.split('\n').map(l => '    ' + l).join('\n')}`;
  }
  return line;
}

// ---- CLI Interface ----

function parseArgs(argv) {
  const args = {
    model: null,
    bugContext: null,
    formalism: 'tla',
    maxAttempts: 3,
    verbose: false,
    format: 'json',
    help: false,
    normalize: null
  };
  for (let i = 2; i < argv.length; i++) {
    if (argv[i] === '--model' && argv[i + 1]) {
      args.model = argv[++i];
    } else if (argv[i] === '--bug-context' && argv[i + 1]) {
      args.bugContext = argv[++i];
    } else if (argv[i] === '--formalism' && argv[i + 1]) {
      args.formalism = argv[++i];
    } else if (argv[i] === '--max-attempts' && argv[i + 1]) {
      args.maxAttempts = parseInt(argv[++i], 10) || 3;
    } else if (argv[i] === '--verbose') {
      args.verbose = true;
    } else if (argv[i] === '--format' && argv[i + 1]) {
      args.format = argv[++i];
    } else if (argv[i] === '--normalize' && argv[i + 1]) {
      args.normalize = argv[++i];
    } else if (argv[i] === '--help' || argv[i] === '-h') {
      args.help = true;
    }
  }
  return args;
}

function printHelp() {
  console.log('Usage: node bin/refinement-loop.cjs --model <path> --bug-context <text-or-file> --formalism tla|alloy');
  console.log('');
  console.log('Options:');
  console.log('  --model           Path to formal model file (.tla or .als) (required)');
  console.log('  --bug-context     Bug description as inline text or file path (required)');
  console.log('  --formalism       Model formalism: tla or alloy (default: tla)');
  console.log('  --max-attempts    Max refinement iterations (default: 3)');
  console.log('  --verbose         Show full model checker output');
  console.log('  --format          Output format: json or text (default: json)');
  console.log('  --normalize       Normalize a bug context value and print result');
  console.log('  --help            Show this help message');
}

function main() {
  const args = parseArgs(process.argv);

  if (args.help) {
    printHelp();
    process.exit(0);
  }

  // Normalize mode
  if (args.normalize !== null) {
    console.log(normalizeBugContext(args.normalize));
    process.exit(0);
  }

  if (!args.model) {
    console.error('Error: --model <path> is required');
    printHelp();
    process.exit(1);
  }

  if (!args.bugContext) {
    console.error('Error: --bug-context <text-or-file> is required');
    printHelp();
    process.exit(1);
  }

  const normalizedContext = normalizeBugContext(args.bugContext);

  const result = verifyBugReproduction(args.model, normalizedContext, {
    formalism: args.formalism,
    maxAttempts: args.maxAttempts,
    verbose: args.verbose,
    onIteration: (iter) => {
      if (args.format === 'text') {
        console.log(formatIterationFeedback(iter, args.verbose));
      }
    }
  });

  if (args.format === 'text') {
    console.log('---');
    console.log(`Result: ${result.status}`);
    console.log(`Attempts: ${result.attempts}`);
    console.log(`Model: ${result.model_path}`);
    if (result.counterexample) {
      console.log(`Counterexample:\n${result.counterexample}`);
    }
  } else {
    console.log(JSON.stringify(result, null, 2));
  }
}

// Run CLI if invoked directly
if (require.main === module) {
  main();
}

// Module exports for programmatic use and testing
module.exports = {
  normalizeBugContext,
  verifyBugReproduction,
  formatIterationFeedback,
  _setDeps
};
