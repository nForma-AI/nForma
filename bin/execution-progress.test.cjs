'use strict';
// bin/execution-progress.test.cjs
// Tests for file-based execution progress tracking.

const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');

const {
  getProgressPath,
  initProgress,
  completeTask,
  getStatus,
  incrementIteration,
  clearProgress,
  PROGRESS_FILE,
  DEFAULT_MAX_ITERATIONS,
  STUCK_THRESHOLD,
} = require('./execution-progress.cjs');

let tmpDir;

function freshTmp() {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'exec-progress-'));
  return tmpDir;
}

function cleanTmp() {
  if (tmpDir) {
    try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch (_) {}
  }
}

describe('execution-progress', () => {

  describe('constants', () => {
    it('exports expected constants', () => {
      assert.equal(PROGRESS_FILE, '.planning/execution-progress.json');
      assert.equal(DEFAULT_MAX_ITERATIONS, 5);
      assert.equal(STUCK_THRESHOLD, 3);
    });
  });

  describe('getProgressPath', () => {
    it('returns path joining cwd with PROGRESS_FILE', () => {
      const result = getProgressPath('/some/dir');
      assert.equal(result, '/some/dir/.planning/execution-progress.json');
    });
  });

  describe('initProgress', () => {
    before(() => freshTmp());
    after(() => cleanTmp());

    it('creates valid JSON file matching schema', () => {
      const result = initProgress(tmpDir, {
        planFile: 'v0.30-02-01-PLAN.md',
        totalTasks: 3,
        taskNames: ['Task 1: Create module', 'Task 2: Extend hook', 'Task 3: Wire workflow'],
      });

      assert.equal(result.version, 1);
      assert.equal(result.total_tasks, 3);
      assert.equal(result.status, 'in_progress');
      assert.equal(result.iteration_count, 0);
      assert.equal(result.max_iterations, 5);
      assert.equal(result.last_known_commit, null);
      assert.equal(result.tasks.length, 3);
      assert.equal(result.tasks[0].number, 1);
      assert.equal(result.tasks[0].status, 'pending');
      assert.equal(result.tasks[0].commit_hash, null);
      assert.equal(result.tasks[0].completed_at, null);
      assert.equal(result.tasks[0].resume_attempts, 0);
      assert.ok(result.started_at);
      assert.ok(result.updated_at);

      // Verify file was written
      const filePath = getProgressPath(tmpDir);
      assert.ok(fs.existsSync(filePath));
      const written = JSON.parse(fs.readFileSync(filePath, 'utf8'));
      assert.equal(written.version, 1);
    });

    it('extracts phase/plan from planFile string', () => {
      const result = initProgress(tmpDir, {
        planFile: 'v0.30-02-01-PLAN.md',
        totalTasks: 2,
        taskNames: ['Task 1', 'Task 2'],
      });

      assert.equal(result.phase, 'v0.30-02');
      assert.equal(result.plan, '01');
    });

    it('overwrites stale progress from a different plan (idempotent)', () => {
      initProgress(tmpDir, {
        planFile: 'v0.30-01-01-PLAN.md',
        totalTasks: 2,
        taskNames: ['Old Task 1', 'Old Task 2'],
      });

      const result = initProgress(tmpDir, {
        planFile: 'v0.30-02-01-PLAN.md',
        totalTasks: 3,
        taskNames: ['New Task 1', 'New Task 2', 'New Task 3'],
      });

      assert.equal(result.plan_file, 'v0.30-02-01-PLAN.md');
      assert.equal(result.total_tasks, 3);
      assert.equal(result.tasks.length, 3);
      assert.equal(result.iteration_count, 0);
    });
  });

  describe('completeTask', () => {
    before(() => freshTmp());
    after(() => cleanTmp());

    it('marks task complete with commit hash and timestamp', () => {
      initProgress(tmpDir, {
        planFile: 'v0.30-02-01-PLAN.md',
        totalTasks: 3,
        taskNames: ['Task 1', 'Task 2', 'Task 3'],
      });

      const result = completeTask(tmpDir, { taskNumber: 1, commitHash: 'abc1234' });

      assert.equal(result.tasks[0].status, 'complete');
      assert.equal(result.tasks[0].commit_hash, 'abc1234');
      assert.ok(result.tasks[0].completed_at);
      assert.equal(result.last_known_commit, 'abc1234');
      assert.equal(result.status, 'in_progress');
    });

    it('sets root status to "complete" when ALL tasks are done', () => {
      initProgress(tmpDir, {
        planFile: 'v0.30-02-01-PLAN.md',
        totalTasks: 2,
        taskNames: ['Task 1', 'Task 2'],
      });

      completeTask(tmpDir, { taskNumber: 1, commitHash: 'abc1234' });
      const result = completeTask(tmpDir, { taskNumber: 2, commitHash: 'def5678' });

      assert.equal(result.status, 'complete');
    });

    it('returns null when file does not exist', () => {
      const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ep-nofile-'));
      try {
        const result = completeTask(dir, { taskNumber: 1, commitHash: 'abc1234' });
        assert.equal(result, null);
      } finally {
        fs.rmSync(dir, { recursive: true, force: true });
      }
    });

    it('returns null when task number not found', () => {
      initProgress(tmpDir, {
        planFile: 'v0.30-02-01-PLAN.md',
        totalTasks: 2,
        taskNames: ['Task 1', 'Task 2'],
      });

      const result = completeTask(tmpDir, { taskNumber: 99, commitHash: 'abc1234' });
      assert.equal(result, null);
    });
  });

  describe('getStatus', () => {
    before(() => freshTmp());
    after(() => cleanTmp());

    it('returns { status: "no_progress_file" } when file missing', () => {
      const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ep-nostatus-'));
      try {
        const result = getStatus(dir);
        assert.deepStrictEqual(result, { status: 'no_progress_file' });
      } finally {
        fs.rmSync(dir, { recursive: true, force: true });
      }
    });

    it('returns full progress object when file exists', () => {
      initProgress(tmpDir, {
        planFile: 'v0.30-02-01-PLAN.md',
        totalTasks: 2,
        taskNames: ['Task 1', 'Task 2'],
      });

      const result = getStatus(tmpDir);
      assert.equal(result.version, 1);
      assert.equal(result.status, 'in_progress');
      assert.equal(result.tasks.length, 2);
    });

    it('does NOT modify the file (read-only)', () => {
      initProgress(tmpDir, {
        planFile: 'v0.30-02-01-PLAN.md',
        totalTasks: 2,
        taskNames: ['Task 1', 'Task 2'],
      });

      const filePath = getProgressPath(tmpDir);
      const contentBefore = fs.readFileSync(filePath, 'utf8');
      getStatus(tmpDir);
      const contentAfter = fs.readFileSync(filePath, 'utf8');

      assert.equal(contentAfter, contentBefore);
    });
  });

  describe('incrementIteration', () => {
    before(() => freshTmp());
    after(() => cleanTmp());

    it('increments counter and writes updated file', () => {
      initProgress(tmpDir, {
        planFile: 'v0.30-02-01-PLAN.md',
        totalTasks: 2,
        taskNames: ['Task 1', 'Task 2'],
      });

      const result = incrementIteration(tmpDir);
      assert.equal(result.iteration_count, 1);
      assert.equal(result.status, 'in_progress');

      const onDisk = JSON.parse(fs.readFileSync(getProgressPath(tmpDir), 'utf8'));
      assert.equal(onDisk.iteration_count, 1);
    });

    it('sets status to "failed" with reason "iteration_cap_exhausted" when counter reaches max_iterations', () => {
      const progress = initProgress(tmpDir, {
        planFile: 'v0.30-02-01-PLAN.md',
        totalTasks: 2,
        taskNames: ['Task 1', 'Task 2'],
      });

      const filePath = getProgressPath(tmpDir);
      progress.iteration_count = DEFAULT_MAX_ITERATIONS - 1;
      fs.writeFileSync(filePath, JSON.stringify(progress, null, 2), 'utf8');

      const result = incrementIteration(tmpDir);
      assert.equal(result.iteration_count, DEFAULT_MAX_ITERATIONS);
      assert.equal(result.status, 'failed');
      assert.equal(result.failure_reason, 'iteration_cap_exhausted');
    });

    it('detects stuck-on-task: same task in_progress across 3 increments', () => {
      const progress = initProgress(tmpDir, {
        planFile: 'v0.30-02-01-PLAN.md',
        totalTasks: 3,
        taskNames: ['Task 1', 'Task 2', 'Task 3'],
      });

      progress.tasks[1].status = 'in_progress';
      fs.writeFileSync(getProgressPath(tmpDir), JSON.stringify(progress, null, 2), 'utf8');

      incrementIteration(tmpDir);
      incrementIteration(tmpDir);
      const result = incrementIteration(tmpDir);

      assert.equal(result.status, 'failed');
      assert.equal(result.failure_reason, 'stuck_on_task');
      assert.equal(result.stuck_task, 2);
      assert.equal(result.tasks[1].resume_attempts, 3);
    });

    it('returns null when file does not exist', () => {
      const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ep-noiter-'));
      try {
        const result = incrementIteration(dir);
        assert.equal(result, null);
      } finally {
        fs.rmSync(dir, { recursive: true, force: true });
      }
    });
  });

  describe('clearProgress', () => {
    before(() => freshTmp());
    after(() => cleanTmp());

    it('removes the file', () => {
      initProgress(tmpDir, {
        planFile: 'v0.30-02-01-PLAN.md',
        totalTasks: 1,
        taskNames: ['Task 1'],
      });

      const filePath = getProgressPath(tmpDir);
      assert.ok(fs.existsSync(filePath));

      clearProgress(tmpDir);
      assert.ok(!fs.existsSync(filePath));
    });

    it('is a no-op when file does not exist (no throw)', () => {
      const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ep-noclear-'));
      try {
        assert.doesNotThrow(() => clearProgress(dir));
      } finally {
        fs.rmSync(dir, { recursive: true, force: true });
      }
    });
  });
});
