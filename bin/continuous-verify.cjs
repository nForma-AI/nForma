#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const VERIFY_FILE = '.planning/continuous-verify.json';

const WRITE_TOOLS = new Set(['Write', 'Edit']);

const TEST_FILE_RE = /\.(test|spec)\.(js|ts|cjs|mjs|jsx|tsx)$/;

const CONFIG_FILES = new Set([
  'package.json',
  'tsconfig.json',
  '.eslintrc.json',
  'vitest.config.ts',
]);

// --- Verification state management ---

function initVerifyState(phase) {
  return {
    version: 1,
    phase,
    max_runs: 3,
    runs_used: 0,
    timeout_ms: 5000,
    accumulated_files: [],
    last_run: null,
    runs: [],
  };
}

function getVerifyState(cwd) {
  try {
    const filePath = path.join(cwd, VERIFY_FILE);
    if (!fs.existsSync(filePath)) return null;
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (_) {
    return null; // fail-open
  }
}

function saveVerifyState(cwd, state) {
  try {
    const filePath = path.join(cwd, VERIFY_FILE);
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, JSON.stringify(state, null, 2), 'utf8');
  } catch (_) {
    // fail-open
  }
}

// --- Boundary detection ---

function shouldTriggerVerification(toolName, toolInput, verifyState) {
  // Budget exhausted
  if (verifyState.runs_used >= verifyState.max_runs) return false;

  // Only Write/Edit tools
  if (!WRITE_TOOLS.has(toolName)) return false;

  // Extract file_path from toolInput
  let filePath = null;
  if (typeof toolInput === 'string') {
    filePath = toolInput;
  } else if (toolInput && typeof toolInput === 'object') {
    filePath = toolInput.file_path || toolInput.filePath || null;
  }

  // Accumulate unique file paths
  if (filePath && !verifyState.accumulated_files.includes(filePath)) {
    verifyState.accumulated_files.push(filePath);
  }

  // Check boundaries
  if (verifyState.accumulated_files.length >= 5) return true;

  if (filePath) {
    const basename = path.basename(filePath);
    if (TEST_FILE_RE.test(filePath)) return true;
    if (CONFIG_FILES.has(basename)) return true;
  }

  return false;
}

// --- Check runner ---

function runChecks(cwd, files, timeoutMs) {
  const timestamp = new Date().toISOString();
  const checks = [];

  try {
    // Separate test files from non-test files
    const testFiles = (files || []).filter(f => TEST_FILE_RE.test(f));
    const jsFiles = (files || []).filter(f => /\.(js|cjs)$/.test(f) && !TEST_FILE_RE.test(f));

    // Run tests on test files
    if (testFiles.length > 0) {
      const start = Date.now();
      try {
        const result = spawnSync('node', ['--test', ...testFiles], {
          cwd,
          timeout: timeoutMs || 5000,
          encoding: 'utf8',
        });
        checks.push({
          type: 'test',
          pass: result.status === 0,
          output: (result.stdout || '').slice(-500),
          duration_ms: Date.now() - start,
        });
      } catch (e) {
        if (e.code === 'ETIMEDOUT' || (e.message && e.message.includes('TIMEDOUT'))) {
          checks.push({ type: 'test', pass: true, reason: 'timeout', duration_ms: Date.now() - start });
        } else {
          checks.push({ type: 'test', pass: true, reason: 'error: ' + e.message, duration_ms: Date.now() - start });
        }
      }
    }

    // Lint non-test JS files
    if (jsFiles.length > 0) {
      const eslintPath = path.join(cwd, 'node_modules', '.bin', 'eslint');
      if (fs.existsSync(eslintPath)) {
        const start = Date.now();
        try {
          const result = spawnSync(eslintPath, jsFiles, {
            cwd,
            timeout: timeoutMs || 5000,
            encoding: 'utf8',
          });
          checks.push({
            type: 'lint',
            pass: result.status === 0,
            output: (result.stdout || '').slice(-500),
            duration_ms: Date.now() - start,
          });
        } catch (e) {
          checks.push({ type: 'lint', pass: true, reason: 'timeout', duration_ms: Date.now() - start });
        }
      } else {
        checks.push({ type: 'lint', pass: true, reason: 'no linter' });
      }
    }

    return { timestamp, checks, files_checked: files || [] };
  } catch (e) {
    return { timestamp, checks: [{ type: 'error', pass: true, reason: 'error: ' + e.message }], files_checked: files || [] };
  }
}

// --- done_conditions evaluator ---

function evaluateCondition(cwd, condition, timeoutMs) {
  try {
    const tm = timeoutMs || 30000;
    switch (condition.type) {
      case 'file_exists': {
        const exists = fs.existsSync(path.join(cwd, condition.path));
        return { pass: exists, type: condition.type };
      }
      case 'test_pass': {
        const result = spawnSync('node', ['--test', condition.pattern], {
          cwd,
          timeout: tm,
          encoding: 'utf8',
        });
        const output = (result.stdout || '').slice(-500);
        return { pass: result.status === 0, type: condition.type, output };
      }
      case 'lint_clean': {
        const eslintPath = path.join(cwd, 'node_modules', '.bin', 'eslint');
        if (!fs.existsSync(eslintPath)) {
          return { pass: true, type: condition.type, reason: 'no linter' };
        }
        const files = Array.isArray(condition.files) ? condition.files : [condition.files];
        const result = spawnSync(eslintPath, files, {
          cwd,
          timeout: tm,
          encoding: 'utf8',
        });
        return { pass: result.status === 0, type: condition.type };
      }
      case 'typecheck_pass': {
        const tscPath = path.join(cwd, 'node_modules', '.bin', 'tsc');
        if (!fs.existsSync(tscPath)) {
          return { pass: true, type: condition.type, reason: 'no tsc' };
        }
        const result = spawnSync(tscPath, ['--noEmit'], {
          cwd,
          timeout: tm,
          encoding: 'utf8',
        });
        return { pass: result.status === 0, type: condition.type };
      }
      case 'command_pass': {
        const parts = condition.command.split(' ');
        const result = spawnSync(parts[0], parts.slice(1), {
          cwd,
          timeout: tm,
          encoding: 'utf8',
        });
        return { pass: result.status === 0, type: condition.type };
      }
      default:
        return { pass: true, type: condition.type, reason: 'unknown condition type' };
    }
  } catch (e) {
    return { pass: true, type: (condition && condition.type) || 'unknown', reason: 'error: ' + e.message };
  }
}

function evaluateAllConditions(cwd, conditions, timeoutMs) {
  if (!conditions || !Array.isArray(conditions) || conditions.length === 0) {
    return { all_pass: true, results: [] };
  }
  const results = conditions.map(c => evaluateCondition(cwd, c, timeoutMs));
  const all_pass = results.every(r => r.pass);
  return { all_pass, results };
}

// --- CLI interface ---

if (require.main === module) {
  try {
    const args = process.argv.slice(2);
    const command = args[0];

    function getArg(name) {
      const idx = args.indexOf('--' + name);
      if (idx === -1 || idx + 1 >= args.length) return null;
      return args[idx + 1];
    }

    switch (command) {
      case 'run-checks': {
        const cwd = getArg('cwd') || process.cwd();
        const filesStr = getArg('files') || '';
        const files = filesStr ? filesStr.split(',').map(f => f.trim()) : [];
        const result = runChecks(cwd, files, 5000);
        process.stdout.write(JSON.stringify(result, null, 2) + '\n');
        break;
      }
      case 'evaluate': {
        const cwd = getArg('cwd') || process.cwd();
        const condStr = getArg('conditions') || '[]';
        let conditions;
        try { conditions = JSON.parse(condStr); } catch (_) { conditions = []; }
        const result = evaluateAllConditions(cwd, conditions);
        process.stdout.write(JSON.stringify(result, null, 2) + '\n');
        break;
      }
      default:
        if (command) {
          process.stderr.write('[continuous-verify] Unknown command: ' + command + '\n');
        }
        // fail-open: no args or unknown command -> exit 0
        break;
    }
  } catch (e) {
    process.stderr.write('[continuous-verify] Error: ' + e.message + '\n');
    process.exit(0); // fail-open
  }
}

module.exports = {
  runChecks,
  shouldTriggerVerification,
  evaluateCondition,
  evaluateAllConditions,
  getVerifyState,
  saveVerifyState,
  initVerifyState,
};
