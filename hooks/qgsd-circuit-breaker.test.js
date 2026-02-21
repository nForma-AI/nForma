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

// Test CB-TC6: Write command, no state, exactly oscillation_depth commits touch same file set → exit 0, state written active:true, correct schema
test('CB-TC6: Write command with exact oscillation depth triggers state write', () => {
  const repoDir = createTempGitRepo();
  try {
    // Create 3 commits with same file set (exactly depth=3)
    createOscillationCommits(repoDir, ['file1.txt', 'file2.txt'], 3);
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
    // Create commits BEFORE writing the state file so git add . does not capture it
    createOscillationCommits(repoDir, ['file1.txt', 'file2.txt'], 3);

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
    // Create commits BEFORE writing the state file so git add . does not capture it
    createOscillationCommits(repoDir, ['file1.txt'], 3);

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

    // Create commits that trigger oscillation
    createOscillationCommits(repoDir, ['file1.txt'], 3);

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
    // Create a root commit touching only a.txt, then 3 oscillation commits touching [a.txt, b.txt].
    // The 3 oscillation commits trigger detection (depth=3).
    // git log returns newest-first: [osc2, osc1, osc0, root]
    // snapshot[3] (oldest = root) should be ['a.txt'] thanks to --root flag in diff-tree.
    commitInRepo(repoDir, 'a.txt', 'root content', 'root commit');
    createOscillationCommits(repoDir, ['a.txt', 'b.txt'], 3);

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
    // 4 commits total: 3 oscillation + 1 root
    assert.strictEqual(state.commit_window_snapshot.length, 4, 'should capture all 4 commits');
    // Each entry must be an array
    state.commit_window_snapshot.forEach((entry, i) =>
      assert(Array.isArray(entry), `snapshot[${i}] should be an array`)
    );
    // Oldest commit (index 3) is the root — only touched a.txt
    assert.deepStrictEqual(state.commit_window_snapshot[3], ['a.txt'], 'root commit snapshot should be [a.txt]');
  } finally {
    fs.rmSync(repoDir, { recursive: true, force: true });
  }
});

// Test CB-TC13: Write command with run_in_background:true in tool_input → same detection logic
test('CB-TC13: Background write command still triggers detection', () => {
  const repoDir = createTempGitRepo();
  try {
    createOscillationCommits(repoDir, ['file1.txt'], 3);
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
    // Create commits BEFORE blocking .claude so git add . does not capture the blocking file
    createOscillationCommits(repoDir, ['file1.txt'], 3);
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
test('CB-TC17: Block reason includes file names, root cause, git log, and reset-breaker instructions', () => {
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
    // Root cause analysis instruction
    assert.ok(reason.includes('root cause'), 'reason must include root cause analysis instruction');
    // Allowed read-only operations
    assert.ok(reason.includes('git log'), 'reason must include git log as allowed operation');
    // Reset breaker instruction
    assert.ok(reason.includes('npx qgsd --reset-breaker'), 'reason must include reset-breaker command');
  } finally {
    fs.rmSync(repoDir, { recursive: true, force: true });
  }
});

// Test CB-TC18 (NEW): config oscillation_depth integration — project config depth:2 triggers at 2 commits (not default 3)
test('CB-TC18: Project config oscillation_depth:2 triggers oscillation detection at depth 2', () => {
  const repoDir = createTempGitRepo();
  try {
    // Create exactly 2 commits touching same file set (below default depth=3, meets depth=2)
    createOscillationCommits(repoDir, ['src/app.js'], 2);

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