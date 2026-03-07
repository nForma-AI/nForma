#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

const PROGRESS_FILE = '.planning/execution-progress.json';
const DEFAULT_MAX_ITERATIONS = 5;
const STUCK_THRESHOLD = 3;

function getProgressPath(cwd) {
  return path.join(cwd, PROGRESS_FILE);
}

function initProgress(cwd, { planFile, totalTasks, taskNames }) {
  const progress = {
    version: 1,
    phase: planFile.match(/v[\d.]+-\d+/)?.[0] || 'unknown',
    plan: planFile.match(/-(\d+)-PLAN/)?.[1] || '01',
    plan_file: planFile,
    total_tasks: totalTasks,
    status: 'in_progress',
    started_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    iteration_count: 0,
    max_iterations: DEFAULT_MAX_ITERATIONS,
    last_known_commit: null,
    tasks: taskNames.map((name, i) => ({
      number: i + 1,
      name,
      status: 'pending',
      commit_hash: null,
      completed_at: null,
      resume_attempts: 0,
    })),
  };
  const progressPath = getProgressPath(cwd);
  fs.mkdirSync(path.dirname(progressPath), { recursive: true });
  fs.writeFileSync(progressPath, JSON.stringify(progress, null, 2), 'utf8');
  return progress;
}

function completeTask(cwd, { taskNumber, commitHash }) {
  const progressPath = getProgressPath(cwd);
  if (!fs.existsSync(progressPath)) return null;

  const progress = JSON.parse(fs.readFileSync(progressPath, 'utf8'));
  const task = progress.tasks.find(t => t.number === taskNumber);
  if (!task) return null;

  task.status = 'complete';
  task.commit_hash = commitHash;
  task.completed_at = new Date().toISOString();
  progress.updated_at = new Date().toISOString();
  progress.last_known_commit = commitHash;

  if (progress.tasks.every(t => t.status === 'complete' || t.status === 'skipped')) {
    progress.status = 'complete';
  }

  fs.writeFileSync(progressPath, JSON.stringify(progress, null, 2), 'utf8');
  return progress;
}

function getStatus(cwd) {
  const progressPath = getProgressPath(cwd);
  if (!fs.existsSync(progressPath)) return { status: 'no_progress_file' };
  return JSON.parse(fs.readFileSync(progressPath, 'utf8'));
}

function incrementIteration(cwd) {
  const progressPath = getProgressPath(cwd);
  if (!fs.existsSync(progressPath)) return null;

  const progress = JSON.parse(fs.readFileSync(progressPath, 'utf8'));
  progress.iteration_count += 1;
  progress.updated_at = new Date().toISOString();

  // Check iteration cap
  if (progress.iteration_count >= progress.max_iterations) {
    progress.status = 'failed';
    progress.failure_reason = 'iteration_cap_exhausted';
  }

  // Check stuck detection: same task in_progress for STUCK_THRESHOLD iterations
  const inProgressTask = progress.tasks.find(t => t.status === 'in_progress');
  if (inProgressTask) {
    inProgressTask.resume_attempts = (inProgressTask.resume_attempts || 0) + 1;
    if (inProgressTask.resume_attempts >= STUCK_THRESHOLD) {
      progress.status = 'failed';
      progress.failure_reason = 'stuck_on_task';
      progress.stuck_task = inProgressTask.number;
    }
  }

  fs.writeFileSync(progressPath, JSON.stringify(progress, null, 2), 'utf8');
  return progress;
}

function clearProgress(cwd) {
  const progressPath = getProgressPath(cwd);
  if (fs.existsSync(progressPath)) {
    fs.unlinkSync(progressPath);
  }
}

// CLI interface
if (require.main === module) {
  try {
    const args = process.argv.slice(2);
    const command = args[0];
    const cwd = process.cwd();

    function getArg(name) {
      const idx = args.indexOf('--' + name);
      if (idx === -1 || idx + 1 >= args.length) return null;
      return args[idx + 1];
    }

    switch (command) {
      case 'init': {
        const planFile = getArg('plan');
        const tasks = parseInt(getArg('tasks'), 10);
        const namesStr = getArg('names');
        const taskNames = namesStr ? namesStr.split(',').map(n => n.trim()) : [];
        // Pad or truncate taskNames to match tasks count
        while (taskNames.length < tasks) taskNames.push(`Task ${taskNames.length + 1}`);
        const result = initProgress(cwd, { planFile, totalTasks: tasks, taskNames });
        process.stdout.write(JSON.stringify(result) + '\n');
        break;
      }
      case 'complete-task': {
        const number = parseInt(getArg('number'), 10);
        const commit = getArg('commit');
        const result = completeTask(cwd, { taskNumber: number, commitHash: commit });
        process.stdout.write(JSON.stringify(result) + '\n');
        break;
      }
      case 'get-status': {
        const result = getStatus(cwd);
        process.stdout.write(JSON.stringify(result) + '\n');
        break;
      }
      case 'increment-iteration': {
        const result = incrementIteration(cwd);
        process.stdout.write(JSON.stringify(result) + '\n');
        break;
      }
      case 'clear': {
        clearProgress(cwd);
        process.stdout.write(JSON.stringify({ cleared: true }) + '\n');
        break;
      }
      default:
        process.stderr.write('Unknown command: ' + command + '\n');
        process.stderr.write('Usage: execution-progress.cjs <init|complete-task|get-status|increment-iteration|clear>\n');
        process.exit(0);
    }
  } catch (e) {
    process.stderr.write('[execution-progress] Error: ' + e.message + '\n');
    process.exit(0); // Fail open
  }
}

module.exports = {
  getProgressPath,
  initProgress,
  completeTask,
  getStatus,
  incrementIteration,
  clearProgress,
  PROGRESS_FILE,
  DEFAULT_MAX_ITERATIONS,
  STUCK_THRESHOLD,
};
