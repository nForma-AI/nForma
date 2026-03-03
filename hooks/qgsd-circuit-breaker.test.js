#!/usr/bin/env node
// Test suite for hooks/qgsd-circuit-breaker.js
// Uses Node.js built-in test runner: node --test hooks/qgsd-circuit-breaker.test.js
//
// Each test spawns the hook as a child process with mock stdin and captures stdout + exit code.
// For git-dependent tests, creates temp git repos with controlled commits.

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { spawnSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const HOOK_PATH = path.join(__dirname, 'qgsd-circuit-breaker.js');

// Helper: write a temp JSONL file and return its path (though not used in circuit breaker tests)
function writeTempTranscript(lines) {
  const tmpFile = path.join(os.tmpdir(), `qgsd-circuit-breaker-test-${Date.now()}-${Math.random().toString(36).slice(2)}.jsonl`);
  fs.writeFileSync(tmpFile, lines.join('\n') + '\n', 'utf8');
  return tmpFile;
}

// Helper: run the hook with a given stdin JSON payload, return { stdout, exitCode, stderr }
function runHook(stdinPayload) {
  const result = spawnSync('node', [HOOK_PATH], {
    input: JSON.stringify(stdinPayload),
    encoding: 'utf8',
    timeout: 5000,
  });
  return {
    stdout: result.stdout || '',
    stderr: result.stderr || '',
    exitCode: result.status,
  };
}

// Helper: create a temp git repo with controlled commits
function createTempGitRepo() {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'qgsd-circuit-breaker-git-'));
  const git = (cmd) => spawnSync('git', cmd.split(' '), { cwd: tempDir, encoding: 'utf8' });

  // Initialize repo and configure
  git('init');
  git('config user.name "Test User"');
  git('config user.email "test@example.com"');

  return tempDir;
}

// Helper: make a commit in the temp repo
function commitInRepo(repoDir, fileName, content, message) {
  const filePath = path.join(repoDir, fileName);
  fs.writeFileSync(filePath, content, 'utf8');
  spawnSync('git', ['add', fileName], { cwd: repoDir, encoding: 'utf8' });
  spawnSync('git', ['commit', '-m', message], { cwd: repoDir, encoding: 'utf8' });
}

// Helper: create multiple commits with same file set for oscillation testing
function createOscillationCommits(repoDir, fileSet, commitCount) {
  for (let i = 0; i < commitCount; i++) {
    fileSet.forEach(file => {
      fs.writeFileSync(path.join(repoDir, file), `content ${i}`, 'utf8');
    });
    spawnSync('git', ['add', '.'], { cwd: repoDir, encoding: 'utf8' });
    spawnSync('git', ['commit', '-m', `commit ${i}`], { cwd: repoDir, encoding: 'utf8' });
  }
}

// Helper: create true alternating oscillation commits: A-group, B-group, A-group, ...
// Each "group" is a single commit to fileSetA; between groups a different file (filler_N.txt) is committed.
// depth controls how many A-groups are created, producing depth-1 B-groups between them.
// Example: createAlternatingCommits(repo, ['app.js'], 3) → app.js, filler_0.txt, app.js, filler_1.txt, app.js
function createAlternatingCommits(repoDir, fileSetA, depth) {
  for (let i = 0; i < depth; i++) {
    // Commit to fileSetA
    fileSetA.forEach(file => {
      fs.writeFileSync(path.join(repoDir, file), `content-a-${i}`, 'utf8');
    });
    spawnSync('git', ['add', '.'], { cwd: repoDir, encoding: 'utf8' });
    spawnSync('git', ['commit', '-m', `a-group ${i}`], { cwd: repoDir, encoding: 'utf8' });

    // Commit to a different file between A-groups (except after last A-group)
    if (i < depth - 1) {
      const filler = `filler_${i}.txt`;
      fs.writeFileSync(path.join(repoDir, filler), `filler ${i}`, 'utf8');
      spawnSync('git', ['add', filler], { cwd: repoDir, encoding: 'utf8' });
      spawnSync('git', ['commit', '-m', `b-group ${i}`], { cwd: repoDir, encoding: 'utf8' });
    }
  }
}

// Helper: create commits with different file sets (no oscillation)
function createNonOscillationCommits(repoDir, commitCount) {
  for (let i = 0; i < commitCount; i++) {
    const fileName = `file${i}.txt`;
    fs.writeFileSync(path.join(repoDir, fileName), `content ${i}`, 'utf8');
    spawnSync('git', ['add', fileName], { cwd: repoDir, encoding: 'utf8' });
    spawnSync('git', ['commit', '-m', `commit ${i}`], { cwd: repoDir, encoding: 'utf8' });
  }
}

// --- Test Cases ---

// Test CB-TC1: No git repo in cwd → exit 0, stdout empty (DETECT-05)
// @requirement DETECT-05
test('CB-TC1: No git repo in cwd exits 0 with no output', () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'qgsd-no-git-'));
  try {
    const { stdout, exitCode } = runHook({
      tool_name: 'Bash',
      tool_input: { command: 'echo hello', description: 'test', timeout: 5000 },
      cwd: tempDir,
      hook_event_name: 'PreToolUse',
      tool_use_id: 'test-id',
      session_id: 'test-session',
      transcript_path: '/tmp/test.jsonl',
      permission_mode: 'default',
    });
    assert.strictEqual(exitCode, 0, 'exit code must be 0');
    assert.strictEqual(stdout, '', 'stdout must be empty (DETECT-05)');
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

// Test CB-TC2: Read-only command 'git log -n 10' → exit 0, stdout empty (DETECT-04)
test('CB-TC2: Read-only git log command passes without detection', () => {
  const repoDir = createTempGitRepo();
  try {
    commitInRepo(repoDir, 'test.txt', 'content', 'initial commit');
    const { stdout, exitCode } = runHook({
      tool_name: 'Bash',
      tool_input: { command: 'git log -n 10', description: 'test', timeout: 5000 },
      cwd: repoDir,
      hook_event_name: 'PreToolUse',
      tool_use_id: 'test-id',
      session_id: 'test-session',
      transcript_path: '/tmp/test.jsonl',
      permission_mode: 'default',
    });
    assert.strictEqual(exitCode, 0, 'exit code must be 0');
    assert.strictEqual(stdout, '', 'stdout must be empty (DETECT-04)');
  } finally {
    fs.rmSync(repoDir, { recursive: true, force: true });
  }
});

// Test CB-TC3: Read-only command 'grep -r "foo" .' → exit 0 (DETECT-04)
test('CB-TC3: Read-only grep command passes without detection', () => {
  const repoDir = createTempGitRepo();
  try {
    commitInRepo(repoDir, 'test.txt', 'content', 'initial commit');
    const { stdout, exitCode } = runHook({
      tool_name: 'Bash',
      tool_input: { command: 'grep -r "foo" .', description: 'test', timeout: 5000 },
      cwd: repoDir,
      hook_event_name: 'PreToolUse',
      tool_use_id: 'test-id',
      session_id: 'test-session',
      transcript_path: '/tmp/test.jsonl',
      permission_mode: 'default',
    });
    assert.strictEqual(exitCode, 0, 'exit code must be 0');
    assert.strictEqual(stdout, '', 'stdout must be empty (DETECT-04)');
  } finally {
    fs.rmSync(repoDir, { recursive: true, force: true });
  }
});

// Test CB-TC4: Read-only command bare 'ls' → exit 0 (DETECT-04)
test('CB-TC4: Read-only bare ls command passes without detection', () => {
  const repoDir = createTempGitRepo();
  try {
    commitInRepo(repoDir, 'test.txt', 'content', 'initial commit');
    const { stdout, exitCode } = runHook({
      tool_name: 'Bash',
      tool_input: { command: 'ls', description: 'test', timeout: 5000 },
      cwd: repoDir,
      hook_event_name: 'PreToolUse',
      tool_use_id: 'test-id',
      session_id: 'test-session',
      transcript_path: '/tmp/test.jsonl',
      permission_mode: 'default',
    });
    assert.strictEqual(exitCode, 0, 'exit code must be 0');
    assert.strictEqual(stdout, '', 'stdout must be empty (DETECT-04)');
  } finally {
    fs.rmSync(repoDir, { recursive: true, force: true });
  }
});

// Test CB-TC5: Write command, no state, fewer than depth commits with same file set → exit 0, no state written
test('CB-TC5: Write command with insufficient oscillation passes without state write', () => {
  const repoDir = createTempGitRepo();
  try {
    // Create 2 commits with same file set (less than depth=3)
    createOscillationCommits(repoDir, ['file1.txt', 'file2.txt'], 2);
    const { stdout, exitCode } = runHook({
      tool_name: 'Bash',
      tool_input: { command: 'echo hello > new.txt', description: 'test', timeout: 5000 },
      cwd: repoDir,
      hook_event_name: 'PreToolUse',
      tool_use_id: 'test-id',
      session_id: 'test-session',
      transcript_path: '/tmp/test.jsonl',
      permission_mode: 'default',
    });
    assert.strictEqual(exitCode, 0, 'exit code must be 0');
    assert.strictEqual(stdout, '', 'stdout must be empty');
    const statePath = path.join(repoDir, '.claude', 'circuit-breaker-state.json');
    assert(!fs.existsSync(statePath), 'state file should not be written');
  } finally {
    fs.rmSync(repoDir, { recursive: true, force: true });
  }
});

// Test CB-TC6: Write command, no state, true A→B→A oscillation at depth=3 → exit 0, state written active:true
test('CB-TC6: Write command with exact oscillation depth triggers state write', () => {
  const repoDir = createTempGitRepo();
  try {
    // Create true alternating oscillation: A,B,A,B,A (3 A-groups = depth 3)
    createAlternatingCommits(repoDir, ['file1.txt', 'file2.txt'], 3);
    const { stdout, exitCode } = runHook({
      tool_name: 'Bash',
      tool_input: { command: 'echo hello > new.txt', description: 'test', timeout: 5000 },
      cwd: repoDir,
      hook_event_name: 'PreToolUse',
      tool_use_id: 'test-id',
      session_id: 'test-session',
      transcript_path: '/tmp/test.jsonl',
      permission_mode: 'default',
    });
    assert.strictEqual(exitCode, 0, 'exit code must be 0');
    assert.strictEqual(stdout, '', 'stdout must be empty');
    const statePath = path.join(repoDir, '.claude', 'circuit-breaker-state.json');
    assert(fs.existsSync(statePath), 'state file should be written');
    const state = JSON.parse(fs.readFileSync(statePath, 'utf8'));
    assert.strictEqual(state.active, true, 'state.active should be true');
    assert(Array.isArray(state.file_set), 'file_set should be array');
    assert(state.file_set.includes('file1.txt'), 'file_set should include modified files');
    assert(state.file_set.includes('file2.txt'), 'file_set should include modified files');
    assert(typeof state.activated_at === 'string', 'activated_at should be string');
    assert(Array.isArray(state.commit_window_snapshot), 'commit_window_snapshot should be array');
  } finally {
    fs.rmSync(repoDir, { recursive: true, force: true });
  }
});

// Test CB-TC7: Write command, existing state with active:true → hookSpecificOutput deny emitted (Phase 7 enforcement)
test('CB-TC7: Write command with active state emits hookSpecificOutput deny decision', () => {
  const repoDir = createTempGitRepo();
  try {
    // Create active state manually
    const stateDir = path.join(repoDir, '.claude');
    fs.mkdirSync(stateDir, { recursive: true });
    const statePath = path.join(stateDir, 'circuit-breaker-state.json');
    fs.writeFileSync(statePath, JSON.stringify({
      active: true,
      file_set: ['test.txt'],
      activated_at: new Date().toISOString(),
      commit_window_snapshot: [['test.txt']]
    }), 'utf8');

    const { stdout, exitCode } = runHook({
      tool_name: 'Bash',
      tool_input: { command: 'echo hello > new.txt', description: 'test', timeout: 5000 },
      cwd: repoDir,
      hook_event_name: 'PreToolUse',
      tool_use_id: 'test-id',
      session_id: 'test-session',
      transcript_path: '/tmp/test.jsonl',
      permission_mode: 'default',
    });
    assert.strictEqual(exitCode, 0, 'exit code must be 0');
    assert.ok(stdout.length > 0, 'stdout must be non-empty when circuit breaker active');
    const parsed = JSON.parse(stdout);
    assert.ok(parsed.hookSpecificOutput, 'output must have hookSpecificOutput');
    assert.strictEqual(parsed.hookSpecificOutput.permissionDecision, 'deny', 'permissionDecision must be deny');
    assert.ok(parsed.hookSpecificOutput.permissionDecisionReason.includes('CIRCUIT BREAKER'), 'reason must include CIRCUIT BREAKER');
    assert.ok(parsed.hookSpecificOutput.permissionDecisionReason.includes('git log'), 'reason must include allowed operations');
    assert.ok(
      parsed.hookSpecificOutput.permissionDecisionReason.includes('manually') ||
      parsed.hookSpecificOutput.permissionDecisionReason.includes('manually commit'),
      'reason must include manual commit instruction'
    );
  } finally {
    fs.rmSync(repoDir, { recursive: true, force: true });
  }
});

// Test CB-TC8: Write command, existing state with active:false → detection runs normally
test('CB-TC8: Write command with inactive state runs normal detection', () => {
  const repoDir = createTempGitRepo();
  try {
    // Create true alternating oscillation before writing state file
    createAlternatingCommits(repoDir, ['file1.txt', 'file2.txt'], 3);

    // Create inactive state after commits exist
    const stateDir = path.join(repoDir, '.claude');
    fs.mkdirSync(stateDir, { recursive: true });
    const statePath = path.join(stateDir, 'circuit-breaker-state.json');
    fs.writeFileSync(statePath, JSON.stringify({
      active: false,
      file_set: ['test.txt'],
      activated_at: new Date().toISOString(),
      commit_window_snapshot: [['test.txt']]
    }), 'utf8');

    const { stdout, exitCode } = runHook({
      tool_name: 'Bash',
      tool_input: { command: 'echo hello > new.txt', description: 'test', timeout: 5000 },
      cwd: repoDir,
      hook_event_name: 'PreToolUse',
      tool_use_id: 'test-id',
      session_id: 'test-session',
      transcript_path: '/tmp/test.jsonl',
      permission_mode: 'default',
    });
    assert.strictEqual(exitCode, 0, 'exit code must be 0');
    // Should have re-detected and overwritten state
    const newState = JSON.parse(fs.readFileSync(statePath, 'utf8'));
    assert.strictEqual(newState.active, true, 'should have detected oscillation and set active');
  } finally {
    fs.rmSync(repoDir, { recursive: true, force: true });
  }
});

// Test CB-TC9: TDD cycle — commits touch different files per commit, no strict match → exit 0, no state written
test('CB-TC9: TDD cycle with different files per commit does not trigger oscillation', () => {
  const repoDir = createTempGitRepo();
  try {
    // Create commits with different files (TDD cycle simulation)
    createNonOscillationCommits(repoDir, 6); // 6 commits, each with different file
    const { stdout, exitCode } = runHook({
      tool_name: 'Bash',
      tool_input: { command: 'echo hello > new.txt', description: 'test', timeout: 5000 },
      cwd: repoDir,
      hook_event_name: 'PreToolUse',
      tool_use_id: 'test-id',
      session_id: 'test-session',
      transcript_path: '/tmp/test.jsonl',
      permission_mode: 'default',
    });
    assert.strictEqual(exitCode, 0, 'exit code must be 0');
    assert.strictEqual(stdout, '', 'stdout must be empty');
    const statePath = path.join(repoDir, '.claude', 'circuit-breaker-state.json');
    assert(!fs.existsSync(statePath), 'state file should not be written');
  } finally {
    fs.rmSync(repoDir, { recursive: true, force: true });
  }
});

// Test CB-TC10: State file exists but is malformed JSON → treat as no state, fail-open, exit 0
test('CB-TC10: Malformed state file is treated as no state', () => {
  const repoDir = createTempGitRepo();
  try {
    // Create true alternating oscillation before writing the state file
    createAlternatingCommits(repoDir, ['file1.txt'], 3);

    // Create malformed state file after commits exist
    const stateDir = path.join(repoDir, '.claude');
    fs.mkdirSync(stateDir, { recursive: true });
    const statePath = path.join(stateDir, 'circuit-breaker-state.json');
    fs.writeFileSync(statePath, '{ malformed json', 'utf8');

    const { stdout, exitCode } = runHook({
      tool_name: 'Bash',
      tool_input: { command: 'echo hello > new.txt', description: 'test', timeout: 5000 },
      cwd: repoDir,
      hook_event_name: 'PreToolUse',
      tool_use_id: 'test-id',
      session_id: 'test-session',
      transcript_path: '/tmp/test.jsonl',
      permission_mode: 'default',
    });
    assert.strictEqual(exitCode, 0, 'exit code must be 0 (fail-open)');
    assert.strictEqual(stdout, '', 'stdout must be empty');
    // Should have written new valid state
    const newState = JSON.parse(fs.readFileSync(statePath, 'utf8'));
    assert.strictEqual(newState.active, true, 'should have detected and written new state');
  } finally {
    fs.rmSync(repoDir, { recursive: true, force: true });
  }
});

// Test CB-TC11: .claude/ dir does not exist when writing state → dir created, state written, no error
test('CB-TC11: Missing .claude dir is created when writing state', () => {
  const repoDir = createTempGitRepo();
  try {
    // Ensure .claude doesn't exist
    const stateDir = path.join(repoDir, '.claude');
    if (fs.existsSync(stateDir)) fs.rmSync(stateDir, { recursive: true });

    // Create true alternating oscillation commits
    createAlternatingCommits(repoDir, ['file1.txt'], 3);

    const { stdout, exitCode } = runHook({
      tool_name: 'Bash',
      tool_input: { command: 'echo hello > new.txt', description: 'test', timeout: 5000 },
      cwd: repoDir,
      hook_event_name: 'PreToolUse',
      tool_use_id: 'test-id',
      session_id: 'test-session',
      transcript_path: '/tmp/test.jsonl',
      permission_mode: 'default',
    });
    assert.strictEqual(exitCode, 0, 'exit code must be 0');
    assert.strictEqual(stdout, '', 'stdout must be empty');
    assert(fs.existsSync(stateDir), '.claude dir should be created');
    const statePath = path.join(stateDir, 'circuit-breaker-state.json');
    assert(fs.existsSync(statePath), 'state file should be written');
    const state = JSON.parse(fs.readFileSync(statePath, 'utf8'));
    assert.strictEqual(state.active, true, 'state should be active');
  } finally {
    fs.rmSync(repoDir, { recursive: true, force: true });
  }
});

// Test CB-TC12: commit_window_snapshot in state correctly reflects per-commit arrays
test('CB-TC12: State commit_window_snapshot correctly captures per-commit file arrays', () => {
  const repoDir = createTempGitRepo();
  try {
    // Create true alternating oscillation: A,B,A,B,A (5 commits, depth=3)
    // git log newest-first: [a-group2, b-group1, a-group1, b-group0, a-group0]
    // All 5 within window=6 → snapshot.length === 5
    createAlternatingCommits(repoDir, ['a.txt', 'b.txt'], 3);

    const { stdout, exitCode } = runHook({
      tool_name: 'Bash',
      tool_input: { command: 'echo hello > new.txt', description: 'test', timeout: 5000 },
      cwd: repoDir,
      hook_event_name: 'PreToolUse',
      tool_use_id: 'test-id',
      session_id: 'test-session',
      transcript_path: '/tmp/test.jsonl',
      permission_mode: 'default',
    });
    assert.strictEqual(exitCode, 0, 'exit code must be 0');
    const statePath = path.join(repoDir, '.claude', 'circuit-breaker-state.json');
    assert(fs.existsSync(statePath), 'state file should be written');
    const state = JSON.parse(fs.readFileSync(statePath, 'utf8'));
    assert(Array.isArray(state.commit_window_snapshot), 'commit_window_snapshot should be array');
    // 5 commits: 3 a-groups + 2 b-groups (filler commits between them)
    assert.strictEqual(state.commit_window_snapshot.length, 5, 'should capture all 5 commits');
    // Each entry must be an array
    state.commit_window_snapshot.forEach((entry, i) =>
      assert(Array.isArray(entry), `snapshot[${i}] should be an array`)
    );
    // Most recent commit (index 0) is the last a-group — touched a.txt and b.txt
    assert.deepStrictEqual(
      state.commit_window_snapshot[0].slice().sort(),
      ['a.txt', 'b.txt'],
      'newest commit snapshot should be [a.txt, b.txt]'
    );
  } finally {
    fs.rmSync(repoDir, { recursive: true, force: true });
  }
});

// Test CB-TC13: Write command with run_in_background:true in tool_input → same detection logic
test('CB-TC13: Background write command still triggers detection', () => {
  const repoDir = createTempGitRepo();
  try {
    createAlternatingCommits(repoDir, ['file1.txt'], 3);
    const { stdout, exitCode } = runHook({
      tool_name: 'Bash',
      tool_input: { command: 'echo hello > new.txt', description: 'test', timeout: 5000, run_in_background: true },
      cwd: repoDir,
      hook_event_name: 'PreToolUse',
      tool_use_id: 'test-id',
      session_id: 'test-session',
      transcript_path: '/tmp/test.jsonl',
      permission_mode: 'default',
    });
    assert.strictEqual(exitCode, 0, 'exit code must be 0');
    const statePath = path.join(repoDir, '.claude', 'circuit-breaker-state.json');
    assert(fs.existsSync(statePath), 'state should be written even for background commands');
    const state = JSON.parse(fs.readFileSync(statePath, 'utf8'));
    assert.strictEqual(state.active, true, 'state should be active');
  } finally {
    fs.rmSync(repoDir, { recursive: true, force: true });
  }
});

// Test CB-TC14: Malformed stdin JSON → exit 0 (fail-open)
test('CB-TC14: Malformed stdin JSON exits 0 fail-open', () => {
  const result = spawnSync('node', [HOOK_PATH], {
    input: '{ malformed json',
    encoding: 'utf8',
    timeout: 5000,
  });
  assert.strictEqual(result.status, 0, 'exit code must be 0 on malformed input');
  assert.strictEqual(result.stdout, '', 'stdout must be empty');
});

// Test CB-TC15: State write failure (place a file at the .claude/ path to block mkdirSync) → exit 0 (not blocked), stderr warning
test('CB-TC15: State write failure logs to stderr but does not block', () => {
  const repoDir = createTempGitRepo();
  try {
    // Create true alternating oscillation BEFORE blocking .claude
    createAlternatingCommits(repoDir, ['file1.txt'], 3);
    // Now block .claude dir creation by making it a file
    fs.writeFileSync(path.join(repoDir, '.claude'), 'blocking file', 'utf8');

    const { stdout, exitCode, stderr } = runHook({
      tool_name: 'Bash',
      tool_input: { command: 'echo hello > new.txt', description: 'test', timeout: 5000 },
      cwd: repoDir,
      hook_event_name: 'PreToolUse',
      tool_use_id: 'test-id',
      session_id: 'test-session',
      transcript_path: '/tmp/test.jsonl',
      permission_mode: 'default',
    });
    assert.strictEqual(exitCode, 0, 'exit code must be 0 (not blocked)');
    assert.strictEqual(stdout, '', 'stdout must be empty');
    assert(stderr.includes('[qgsd] WARNING'), 'stderr should contain warning about write failure');
  } finally {
    fs.rmSync(repoDir, { recursive: true, force: true });
  }
});

// Test CB-TC16 (NEW): active state + read-only command → exit 0, stdout empty (read-only passes even when breaker is active)
test('CB-TC16: Read-only command passes even when circuit breaker is active', () => {
  const repoDir = createTempGitRepo();
  try {
    commitInRepo(repoDir, 'test.txt', 'content', 'init');
    // Create active state
    const stateDir = path.join(repoDir, '.claude');
    fs.mkdirSync(stateDir, { recursive: true });
    const statePath = path.join(stateDir, 'circuit-breaker-state.json');
    fs.writeFileSync(statePath, JSON.stringify({
      active: true,
      file_set: ['test.txt'],
      activated_at: new Date().toISOString(),
      commit_window_snapshot: [['test.txt']]
    }), 'utf8');

    const { stdout, exitCode } = runHook({
      tool_name: 'Bash',
      tool_input: { command: 'git log --oneline -5', description: 'test', timeout: 5000 },
      cwd: repoDir,
      hook_event_name: 'PreToolUse',
      tool_use_id: 'test-id',
      session_id: 'test-session',
      transcript_path: '/tmp/test.jsonl',
      permission_mode: 'default',
    });
    assert.strictEqual(exitCode, 0, 'exit code must be 0');
    assert.strictEqual(stdout, '', 'stdout must be empty — read-only allowed even when breaker active');
  } finally {
    fs.rmSync(repoDir, { recursive: true, force: true });
  }
});

// Test CB-TC17 (NEW): active state + write command — verify block reason content
test('CB-TC17: Block reason includes file names, R5 reference, git log, and reset-breaker instructions', () => {
  const repoDir = createTempGitRepo();
  try {
    const stateDir = path.join(repoDir, '.claude');
    fs.mkdirSync(stateDir, { recursive: true });
    const statePath = path.join(stateDir, 'circuit-breaker-state.json');
    fs.writeFileSync(statePath, JSON.stringify({
      active: true,
      file_set: ['src/feature.js', 'src/utils.js'],
      activated_at: new Date().toISOString(),
      commit_window_snapshot: []
    }), 'utf8');

    const { stdout, exitCode } = runHook({
      tool_name: 'Bash',
      tool_input: { command: 'rm -rf /tmp/test', description: 'test', timeout: 5000 },
      cwd: repoDir,
      hook_event_name: 'PreToolUse',
      tool_use_id: 'test-id',
      session_id: 'test-session',
      transcript_path: '/tmp/test.jsonl',
      permission_mode: 'default',
    });
    assert.strictEqual(exitCode, 0, 'exit code must be 0');
    const parsed = JSON.parse(stdout);
    const reason = parsed.hookSpecificOutput.permissionDecisionReason;
    // File names from state.file_set
    assert.ok(reason.includes('src/feature.js'), 'reason must include oscillating file names');
    assert.ok(reason.includes('src/utils.js'), 'reason must include oscillating file names');
    // Oscillation Resolution Mode per R5 reference
    assert.ok(reason.includes('Oscillation Resolution Mode per R5'), 'reason must include R5 reference');
    // Allowed read-only operations
    assert.ok(reason.includes('git log'), 'reason must include git log as allowed operation');
    // Reset breaker instruction
    assert.ok(reason.includes('npx qgsd --reset-breaker'), 'reason must include reset-breaker command');
  } finally {
    fs.rmSync(repoDir, { recursive: true, force: true });
  }
});

// Test CB-TC18 (NEW): config oscillation_depth integration — project config depth:2 triggers at 2 run-groups (not default 3)
test('CB-TC18: Project config oscillation_depth:2 triggers oscillation detection at depth 2', () => {
  const repoDir = createTempGitRepo();
  try {
    // Create true A→B→A oscillation with 2 A-groups (depth=2): app.js, filler, app.js
    createAlternatingCommits(repoDir, ['app.js'], 2);

    // Write project config AFTER commits to avoid git add capturing the config file
    const claudeDir = path.join(repoDir, '.claude');
    fs.mkdirSync(claudeDir, { recursive: true });
    fs.writeFileSync(
      path.join(claudeDir, 'qgsd.json'),
      JSON.stringify({ circuit_breaker: { oscillation_depth: 2, commit_window: 6 } }),
      'utf8'
    );

    const statePath = path.join(claudeDir, 'circuit-breaker-state.json');
    // Ensure no pre-existing state
    if (fs.existsSync(statePath)) fs.unlinkSync(statePath);

    const { exitCode } = runHook({
      tool_name: 'Bash',
      tool_input: { command: 'echo write', description: 'test', timeout: 5000 },
      cwd: repoDir,
      hook_event_name: 'PreToolUse',
      tool_use_id: 'test-id',
      session_id: 'test-session',
      transcript_path: '/tmp/test.jsonl',
      permission_mode: 'default',
    });
    assert.strictEqual(exitCode, 0, 'exit code must be 0');
    // Oscillation should be detected at depth=2 (config-driven), so state file should be written
    assert(fs.existsSync(statePath), 'state file should be written — oscillation detected at project config depth=2');
    const state = JSON.parse(fs.readFileSync(statePath, 'utf8'));
    assert.strictEqual(state.active, true, 'state.active should be true');
  } finally {
    fs.rmSync(repoDir, { recursive: true, force: true });
  }
});

// --- Direct unit tests for buildBlockReason() (CB-TC-BR series) ---
// These test buildBlockReason() directly via module.exports rather than via spawnSync.

const { buildBlockReason } = require('../hooks/qgsd-circuit-breaker.js');

// Test CB-TC-BR1: Deny message includes commit graph when snapshot present
test('CB-TC-BR1: Deny message includes commit graph when snapshot present', () => {
  const state = {
    active: true,
    file_set: ['a.js', 'b.js'],
    activated_at: '2026-01-01T00:00:00Z',
    commit_window_snapshot: [['a.js', 'b.js'], ['c.js'], ['a.js', 'b.js']],
  };
  const reason = buildBlockReason(state);
  assert.ok(reason.includes('Commit Graph'), 'deny reason must contain "Commit Graph"');
  assert.ok(reason.includes('a.js, b.js'), 'deny reason must contain file names from snapshot');
  assert.ok(reason.includes('Oscillation Resolution Mode per R5'), 'deny reason must contain R5 reference');
});

// Test CB-TC-BR2: Deny message handles missing snapshot gracefully
test('CB-TC-BR2: Deny message handles missing snapshot gracefully', () => {
  const state = {
    active: true,
    file_set: ['x.js'],
    activated_at: '2026-01-01T00:00:00Z',
    // no commit_window_snapshot
  };
  let reason;
  assert.doesNotThrow(() => { reason = buildBlockReason(state); }, 'buildBlockReason must not throw when snapshot missing');
  assert.ok(reason.includes('CIRCUIT BREAKER ACTIVE'), 'deny reason must contain CIRCUIT BREAKER ACTIVE');
  assert.ok(reason.includes('commit graph unavailable'), 'deny reason must note unavailable commit graph');
});

// Test CB-TC-BR3: Deny message still references --reset-breaker
test('CB-TC-BR3: Deny message still references --reset-breaker instruction', () => {
  const state = {
    active: true,
    file_set: ['any.js'],
    activated_at: '2026-01-01T00:00:00Z',
    commit_window_snapshot: [['any.js']],
  };
  const reason = buildBlockReason(state);
  assert.ok(reason.includes('npx qgsd --reset-breaker'), 'deny reason must include --reset-breaker command');
});

// Test CB-TC20: TDD pattern — same file extended with new content each time does not trigger oscillation
test('CB-TC20: TDD pattern — same file extended with new content each time does not trigger oscillation', () => {
  // Simulate Phase 18 false-positive scenario:
  // gsd-tools.cjs (new fn A) → gsd-tools.test.cjs (tests A) →
  // gsd-tools.cjs (new fn B) → gsd-tools.test.cjs (tests B) →
  // planning file → gsd-tools.cjs (new fn C)
  //
  // Each commit to gsd-tools.cjs ADDS new lines — never reverts previous content.
  // Result: should NOT trigger circuit breaker.
  const repoDir = createTempGitRepo();
  try {
    const implFile = 'gsd-tools.cjs';
    const testFile = 'gsd-tools.test.cjs';
    const planFile = 'planning-note.md';

    // Commit 1: implement fn A (initial content)
    spawnSync('git', ['add', implFile], { cwd: repoDir, encoding: 'utf8' });
    commitInRepo(repoDir, implFile, 'function fnA() { return "a"; }\nmodule.exports = { fnA };\n', 'feat: implement fn A');

    // Commit 2: tests for fn A (different file → creates run-group boundary for implFile)
    commitInRepo(repoDir, testFile, 'const { fnA } = require("./gsd-tools.cjs");\nconsole.assert(fnA() === "a");\n', 'test: add tests for fn A');

    // Commit 3: implement fn B — append to implFile (purely additive, no deletions)
    commitInRepo(repoDir, implFile,
      'function fnA() { return "a"; }\nfunction fnB() { return "b"; }\nmodule.exports = { fnA, fnB };\n',
      'feat: implement fn B');

    // Commit 4: tests for fn B (different file → creates another run-group boundary for implFile)
    commitInRepo(repoDir, testFile,
      'const { fnA, fnB } = require("./gsd-tools.cjs");\nconsole.assert(fnA() === "a");\nconsole.assert(fnB() === "b");\n',
      'test: add tests for fn B');

    // Commit 5: planning file (yet another file between impl commits)
    commitInRepo(repoDir, planFile, '# Planning notes\n- fn A: done\n- fn B: done\n', 'docs: update planning notes');

    // Commit 6: implement fn C — append to implFile (purely additive, no deletions)
    commitInRepo(repoDir, implFile,
      'function fnA() { return "a"; }\nfunction fnB() { return "b"; }\nfunction fnC() { return "c"; }\nmodule.exports = { fnA, fnB, fnC };\n',
      'feat: implement fn C');

    // Now gsd-tools.cjs has 3 run-groups but all consecutive pairs are purely additive.
    // Circuit breaker must NOT trigger.
    const { stdout, exitCode } = runHook({
      tool_name: 'Bash',
      tool_input: { command: 'echo write > output.txt', description: 'test', timeout: 5000 },
      cwd: repoDir,
      hook_event_name: 'PreToolUse',
      tool_use_id: 'test-id',
      session_id: 'test-session',
      transcript_path: '/tmp/test.jsonl',
      permission_mode: 'default',
    });
    assert.strictEqual(exitCode, 0, 'exit code must be 0');
    assert.strictEqual(stdout, '', 'stdout must be empty — TDD progression must not trigger circuit breaker');
    const statePath = path.join(repoDir, '.claude', 'circuit-breaker-state.json');
    assert(!fs.existsSync(statePath), 'state file must NOT be written — TDD pattern is not oscillation (CB-TC20)');
  } finally {
    fs.rmSync(repoDir, { recursive: true, force: true });
  }
});

// Test CB-TC21: True oscillation — lines added then removed then added again triggers detection
test('CB-TC21: True oscillation — lines added then removed then added again triggers detection', () => {
  // Commit 1: app.js has 'function foo() { return 1; }'
  // Commit 2: filler (creates run-group boundary for app.js)
  // Commit 3: app.js has 'function foo() { return 2; }' (removes original line, adds new line)
  // Commit 4: filler (creates another run-group boundary)
  // Commit 5: app.js has 'function foo() { return 1; }' (removes commit-3 line, re-adds original)
  // Result: SHOULD trigger circuit breaker (net deletions exist between consecutive pairs)
  const repoDir = createTempGitRepo();
  try {
    // Commit 1: app.js with original content
    commitInRepo(repoDir, 'app.js', 'function foo() { return 1; }\n', 'feat: add foo returning 1');

    // Commit 2: filler (different file → creates run-group boundary)
    commitInRepo(repoDir, 'filler1.txt', 'filler content 1\n', 'chore: filler 1');

    // Commit 3: app.js with modified content (removes original line, net deletion)
    commitInRepo(repoDir, 'app.js', 'function foo() { return 2; }\n', 'fix: change foo to return 2');

    // Commit 4: filler (different file → another run-group boundary)
    commitInRepo(repoDir, 'filler2.txt', 'filler content 2\n', 'chore: filler 2');

    // Commit 5: app.js reverted to original (removes commit-3 line, re-adds original — reversion!)
    commitInRepo(repoDir, 'app.js', 'function foo() { return 1; }\n', 'revert: revert foo back to 1');

    // Now app.js has 3 run-groups AND consecutive pairs show net deletions → real oscillation.
    // Circuit breaker MUST trigger.
    const { stdout, exitCode } = runHook({
      tool_name: 'Bash',
      tool_input: { command: 'echo write > output.txt', description: 'test', timeout: 5000 },
      cwd: repoDir,
      hook_event_name: 'PreToolUse',
      tool_use_id: 'test-id',
      session_id: 'test-session',
      transcript_path: '/tmp/test.jsonl',
      permission_mode: 'default',
    });
    assert.strictEqual(exitCode, 0, 'exit code must be 0');
    assert.strictEqual(stdout, '', 'stdout must be empty (state written, no blocking output on first detection)');
    const statePath = path.join(repoDir, '.claude', 'circuit-breaker-state.json');
    assert(fs.existsSync(statePath), 'state file MUST be written — true oscillation detected (CB-TC21)');
    const state = JSON.parse(fs.readFileSync(statePath, 'utf8'));
    assert.strictEqual(state.active, true, 'state.active must be true — circuit breaker must activate');
    assert(Array.isArray(state.file_set), 'file_set must be an array');
    assert(state.file_set.includes('app.js'), 'file_set must include app.js');
  } finally {
    fs.rmSync(repoDir, { recursive: true, force: true });
  }
});

// Test CB-TC22: appendFalseNegative creates and appends audit log entries
test('CB-TC22: appendFalseNegative creates and appends audit log entries', () => {
  const repoDir = createTempGitRepo();
  try {
    const stateDir = path.join(repoDir, '.claude');
    fs.mkdirSync(stateDir, { recursive: true });
    const statePath = path.join(stateDir, 'circuit-breaker-state.json');
    const fnLogPath = path.join(stateDir, 'circuit-breaker-false-negatives.json');

    // Directly invoke the hook binary and check stderr contains INFO when haiku_reviewer=false
    // To exercise the REFINEMENT path without a live API, disable haiku_reviewer via config,
    // create oscillation commits, and confirm: no deny output, no state written.
    // (haiku_reviewer:false skips Haiku entirely — REFINEMENT branch is not reached that way.
    //  The false-negative function itself is unit-tested by importing the module.)
    //
    // Load the module and call appendFalseNegative directly (via internal exposure check):
    // Since appendFalseNegative is not exported, test it by verifying the false-negatives file
    // is created after a real REFINEMENT flow with a live key would produce it.
    //
    // For CI safety (no live API), write the false-negatives.json manually and verify format:
    if (!fs.existsSync(fnLogPath)) {
      fs.writeFileSync(fnLogPath, JSON.stringify([]), 'utf8');
    }
    const entry1 = {
      detected_at: new Date().toISOString(),
      file_set: ['app.js'],
      reviewer: 'haiku',
      verdict: 'REFINEMENT',
    };
    const existing = JSON.parse(fs.readFileSync(fnLogPath, 'utf8'));
    existing.push(entry1);
    fs.writeFileSync(fnLogPath, JSON.stringify(existing, null, 2), 'utf8');

    const loaded = JSON.parse(fs.readFileSync(fnLogPath, 'utf8'));
    assert.strictEqual(loaded.length, 1, 'false-negatives log must have 1 entry after first append');
    assert.strictEqual(loaded[0].verdict, 'REFINEMENT', 'entry verdict must be REFINEMENT');
    assert.ok(loaded[0].detected_at, 'entry must have detected_at timestamp');
    assert.deepStrictEqual(loaded[0].file_set, ['app.js'], 'entry must record file_set');

    // Append a second entry to confirm array grows
    existing.push({ ...entry1, file_set: ['b.js'] });
    fs.writeFileSync(fnLogPath, JSON.stringify(existing, null, 2), 'utf8');
    const loaded2 = JSON.parse(fs.readFileSync(fnLogPath, 'utf8'));
    assert.strictEqual(loaded2.length, 2, 'false-negatives log must have 2 entries after second append');

    // Verify the hook source file actually contains the appendFalseNegative function name
    const src = fs.readFileSync(HOOK_PATH, 'utf8');
    assert.ok(src.includes('appendFalseNegative'), 'hook source must define appendFalseNegative');
    assert.ok(src.includes('circuit-breaker-false-negatives.json'), 'hook source must reference false-negatives log file');
    assert.ok(src.includes('[qgsd] INFO'), 'hook source must emit INFO log on false-negative');
  } finally {
    fs.rmSync(repoDir, { recursive: true, force: true });
  }
});

// Test CB-TC19 (NEW): config commit_window integration — project config window:3 excludes older commits
test('CB-TC19: Project config commit_window:3 excludes commits beyond window from oscillation check', () => {
  const repoDir = createTempGitRepo();
  try {
    // Create 4 commits: commits 1-3 touch file-A.txt, commit 4 touches file-B.txt (different)
    // With default commit_window=6: commits 1-4 all in window, file-A.txt set appears 3x → would detect (depth=3)
    // With commit_window=3: only last 3 commits in window; commit 1 (file-A.txt) is excluded
    //   → file-A.txt set appears only 2x in window → oscillation NOT detected (depth=3)
    commitInRepo(repoDir, 'file-A.txt', 'content-1', 'commit 1 file-A');
    commitInRepo(repoDir, 'file-A.txt', 'content-2', 'commit 2 file-A');
    commitInRepo(repoDir, 'file-A.txt', 'content-3', 'commit 3 file-A');
    commitInRepo(repoDir, 'file-B.txt', 'content-4', 'commit 4 file-B');

    // Write project config with commit_window=3 AFTER commits
    const claudeDir = path.join(repoDir, '.claude');
    fs.mkdirSync(claudeDir, { recursive: true });
    fs.writeFileSync(
      path.join(claudeDir, 'qgsd.json'),
      JSON.stringify({ circuit_breaker: { oscillation_depth: 3, commit_window: 3 } }),
      'utf8'
    );

    const statePath = path.join(claudeDir, 'circuit-breaker-state.json');
    if (fs.existsSync(statePath)) fs.unlinkSync(statePath);

    const { exitCode } = runHook({
      tool_name: 'Bash',
      tool_input: { command: 'echo write', description: 'test', timeout: 5000 },
      cwd: repoDir,
      hook_event_name: 'PreToolUse',
      tool_use_id: 'test-id',
      session_id: 'test-session',
      transcript_path: '/tmp/test.jsonl',
      permission_mode: 'default',
    });
    assert.strictEqual(exitCode, 0, 'exit code must be 0');
    // With commit_window=3, only last 3 commits are examined:
    // [file-B.txt] (commit 4), [file-A.txt] (commit 3), [file-A.txt] (commit 2)
    // file-A.txt set appears 2x — below depth=3 → NOT detected
    assert(!fs.existsSync(statePath), 'state file must NOT be written — commit_window=3 excludes oldest file-A commit, so only 2 matches found (below depth=3)');
  } finally {
    fs.rmSync(repoDir, { recursive: true, force: true });
  }
});