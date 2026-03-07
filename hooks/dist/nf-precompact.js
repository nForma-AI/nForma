#!/usr/bin/env node
// hooks/nf-precompact.js
// PreCompact hook — injects nForma session state as additionalContext before context compaction.
// Reads .planning/STATE.md "Current Position" section and any pending task files.
// Output survives compaction and appears in the first message of the compacted context.
// Fails open on all errors — never blocks compaction.

'use strict';

const fs   = require('fs');
const path = require('path');

// Fail-open require of execution-progress module (VERF-01)
const executionProgress = (() => {
  try { return require(path.join(__dirname, '..', 'bin', 'execution-progress.cjs')); }
  catch { return null; }
})();

// Fail-open require of memory-store module (MEMP-01, MEMP-04)
const memoryStore = (() => {
  try { return require(path.join(__dirname, '..', 'bin', 'memory-store.cjs')); }
  catch { return null; }
})();

// Extract the "## Current Position" section from STATE.md content.
// Returns the trimmed text between "## Current Position" and the next "## " header.
// Returns null if the section is not found.
function extractCurrentPosition(stateContent) {
  const startMarker = '## Current Position';
  const startIdx = stateContent.indexOf(startMarker);
  if (startIdx === -1) return null;

  const afterStart = startIdx + startMarker.length;
  // Find the next section header (## followed by a space at start of line)
  const nextHeaderMatch = stateContent.slice(afterStart).search(/\n## /);
  let section;
  if (nextHeaderMatch === -1) {
    section = stateContent.slice(afterStart);
  } else {
    section = stateContent.slice(afterStart, afterStart + nextHeaderMatch);
  }
  return section.trim() || null;
}

// Read pending task files without consuming them (unlike nf-prompt.js's consumePendingTask).
// Checks .claude/pending-task.txt and .claude/pending-task-*.txt files.
// Returns an array of { filename, content } objects for each file found.
function readPendingTasks(cwd) {
  const claudeDir = path.join(cwd, '.claude');
  const results = [];

  if (!fs.existsSync(claudeDir)) return results;

  // Check generic pending-task.txt first
  const genericFile = path.join(claudeDir, 'pending-task.txt');
  if (fs.existsSync(genericFile)) {
    try {
      const content = fs.readFileSync(genericFile, 'utf8').trim();
      if (content) results.push({ filename: 'pending-task.txt', content });
    } catch (e) {
      process.stderr.write('[nf-precompact] Could not read ' + genericFile + ': ' + e.message + '\n');
    }
  }

  // Check session-scoped pending-task-*.txt files
  try {
    const entries = fs.readdirSync(claudeDir);
    for (const entry of entries) {
      if (entry.startsWith('pending-task-') && entry.endsWith('.txt') && !entry.endsWith('.claimed')) {
        const filePath = path.join(claudeDir, entry);
        try {
          const content = fs.readFileSync(filePath, 'utf8').trim();
          if (content) results.push({ filename: entry, content });
        } catch (e) {
          process.stderr.write('[nf-precompact] Could not read ' + filePath + ': ' + e.message + '\n');
        }
      }
    }
  } catch (e) {
    process.stderr.write('[nf-precompact] Could not read .claude dir: ' + e.message + '\n');
  }

  return results;
}

// Read execution progress and increment iteration counter on compaction (VERF-01).
// Returns updated progress object or null if no active execution.
function readExecutionProgress(cwd) {
  if (!executionProgress) return null;
  try {
    const status = executionProgress.getStatus(cwd);
    if (status.status === 'no_progress_file') return null;
    if (status.status !== 'in_progress') return null;
    // Increment iteration count (only happens on compaction, not on status checks)
    const updated = executionProgress.incrementIteration(cwd);
    return updated;
  } catch (e) {
    process.stderr.write('[nf-precompact] Could not read execution progress: ' + e.message + '\n');
    return null;
  }
}

// Format execution progress as injection block for compaction continuation context.
// Returns string or null. Output capped at 3200 characters.
function formatProgressInjection(progress) {
  if (!progress) return null;

  const completed = progress.tasks.filter(t => t.status === 'complete');
  const completedCount = completed.length;
  const next = progress.tasks.find(t => t.status === 'pending' || t.status === 'in_progress');

  const lines = [
    '## Execution Progress (auto-injected at compaction)',
    '',
    'Plan: ' + progress.plan_file,
    'Status: ' + progress.status + ' (' + completedCount + '/' + progress.total_tasks + ' tasks complete, iteration ' + progress.iteration_count + ' of ' + progress.max_iterations + ')',
  ];

  if (progress.status === 'failed') {
    lines.push('');
    lines.push('EXECUTION FAILED: ' + progress.failure_reason);
    lines.push('Report this failure to the user. Do NOT continue execution.');
    return lines.join('\n');
  }

  // For plans with 6+ completed tasks, summarize instead of listing all
  if (completedCount > 5) {
    lines.push('');
    lines.push('Tasks 1-' + completedCount + ' complete. Resume at Task ' + (next ? next.number : 'N/A') + '.');
  } else if (completedCount > 0) {
    lines.push('');
    lines.push('Completed tasks:');
    for (const t of completed) {
      lines.push('  [x] ' + t.name + ' (commit ' + (t.commit_hash || 'unknown') + ')');
    }
  }

  if (next) {
    lines.push('');
    lines.push('Resume at:');
    lines.push('  [ ] ' + next.name);
    lines.push('');
    lines.push('IMPORTANT: Read ' + progress.plan_file + ' and continue from Task ' + next.number + '.');
    lines.push('Do NOT re-execute Tasks 1-' + completedCount + ' -- they are already committed.');
  }

  const result = lines.join('\n');
  // Cap at 3200 characters (800 token estimate)
  if (result.length > 3200) {
    // Truncate completed task list but keep header + resume instruction
    const headerEnd = result.indexOf('Completed tasks:');
    const resumeStart = result.indexOf('Resume at:');
    if (headerEnd !== -1 && resumeStart !== -1) {
      return result.slice(0, headerEnd) + 'Tasks 1-' + completedCount + ' complete (truncated for space).\n\n' + result.slice(resumeStart);
    }
    return result.slice(0, 3200);
  }
  return result;
}

// Read memory injection for compaction continuation context.
// Returns formatted string or null if no entries or module unavailable.
function readMemoryInjection(cwd) {
  if (!memoryStore || !memoryStore.formatMemoryInjection) return null;
  try {
    return memoryStore.formatMemoryInjection(cwd);
  } catch (e) {
    process.stderr.write('[nf-precompact] Could not read memory: ' + e.message + '\n');
    return null;
  }
}

let raw = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', chunk => { raw += chunk; });
process.stdin.on('end', () => {
  try {
    const input = JSON.parse(raw);
    const cwd = input.cwd || process.cwd();

    const statePath = path.join(cwd, '.planning', 'STATE.md');

    let additionalContext;

    if (!fs.existsSync(statePath)) {
      // No STATE.md — minimal context
      additionalContext = 'nForma session resumed after compaction. Run `cat .planning/STATE.md` for project state.';
    } else {
      let stateContent;
      try {
        stateContent = fs.readFileSync(statePath, 'utf8');
      } catch (e) {
        process.stderr.write('[nf-precompact] Could not read STATE.md: ' + e.message + '\n');
        additionalContext = 'nForma session resumed after compaction. Run `cat .planning/STATE.md` for project state.';
        emitOutput(additionalContext);
        return;
      }

      const currentPosition = extractCurrentPosition(stateContent);
      const pendingTasks = readPendingTasks(cwd);

      const lines = [
        'nForma CONTINUATION CONTEXT (auto-injected at compaction)',
        '',
        '## Current Position',
        currentPosition || '(Could not extract Current Position section — run `cat .planning/STATE.md` for full state.)',
      ];

      if (pendingTasks.length > 0) {
        lines.push('');
        lines.push('## Pending Task');
        // Include the first pending task found (generic file takes priority)
        lines.push(pendingTasks[0].content);
        if (pendingTasks.length > 1) {
          process.stderr.write('[nf-precompact] Multiple pending task files found; injecting first: ' + pendingTasks[0].filename + '\n');
        }
      }

      lines.push('');
      lines.push('## Resume Instructions');
      lines.push('You are mid-session on a nForma project. The context above shows where you were.');
      lines.push('- If a PLAN.md is in progress, continue executing from the current plan.');
      lines.push('- If a pending task is shown above, execute it next.');
      lines.push('- Run `cat .planning/STATE.md` to get full project state if needed.');
      lines.push('- All project rules in CLAUDE.md still apply (quorum required for planning commands).');

      // Execution progress injection (VERF-01)
      const execProgress = readExecutionProgress(cwd);
      const progressBlock = formatProgressInjection(execProgress);
      if (progressBlock) {
        lines.push('');
        lines.push(progressBlock);
      }

      // Memory snapshot injection (MEMP-01, MEMP-04)
      const memoryBlock = readMemoryInjection(cwd);
      if (memoryBlock) {
        lines.push('');
        lines.push(memoryBlock);
      }

      additionalContext = lines.join('\n');
    }

    emitOutput(additionalContext);

  } catch (e) {
    process.stderr.write('[nf-precompact] Fatal error: ' + e.message + '\n');
    process.exit(0); // Fail open — never block compaction
  }
});

function emitOutput(additionalContext) {
  process.stdout.write(JSON.stringify({
    hookSpecificOutput: {
      hookEventName: 'PreCompact',
      additionalContext,
    },
  }));
  process.exit(0);
}

// Export helpers for unit testing (tree-shaken at runtime — no cost)
// The file is a script and exits via process.exit() before reaching this line in normal operation.
// When require()d by tests, the stdin handler is registered but never fires, so module.exports is set.
if (typeof module !== 'undefined') {
  module.exports = module.exports || {};
  module.exports.extractCurrentPosition = extractCurrentPosition;
  module.exports.readPendingTasks = readPendingTasks;
  module.exports.readExecutionProgress = readExecutionProgress;
  module.exports.formatProgressInjection = formatProgressInjection;
  module.exports.readMemoryInjection = readMemoryInjection;
}
