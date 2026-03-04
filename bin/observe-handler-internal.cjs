/**
 * Internal work detection handler for /qgsd:observe
 * Scans local project state for:
 * 1. Unfinished quick tasks (PLAN.md without SUMMARY.md)
 * 2. Stale debug sessions (quorum-debug-latest.md)
 * 3. Active milestone phases without VERIFICATION.md
 *
 * Returns standard observe schema: { source_label, source_type, status, issues[] }
 */

const fs = require('node:fs');
const path = require('node:path');

/**
 * Format age from mtime (Date) to human-readable string
 * @param {Date} mtime - File modification time
 * @returns {string} Human-readable age like "5m", "2h", "3d"
 */
function formatAge(mtime) {
  if (!mtime || !(mtime instanceof Date)) return 'unknown';
  const diffMs = Date.now() - mtime.getTime();
  if (diffMs < 0) return 'future';
  const minutes = Math.floor(diffMs / 60000);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  return `${days}d`;
}

/**
 * Internal work detection handler
 * Scans three categories: unfinished quick tasks, stale debug sessions, active unverified phases
 *
 * @param {object} sourceConfig - { label?, ...other config }
 * @param {object} options - { projectRoot? }
 * @returns {object} Standard observe schema result
 */
function handleInternal(sourceConfig, options) {
  const label = sourceConfig.label || 'Internal Work';
  const projectRoot = options.projectRoot || process.cwd();
  const issues = [];

  try {
    // Category 1: Unfinished quick tasks
    try {
      const quickDir = path.resolve(projectRoot, '.planning/quick');
      if (fs.existsSync(quickDir)) {
        const entries = fs.readdirSync(quickDir, { withFileTypes: true });
        for (const entry of entries) {
          if (!entry.isDirectory()) continue;

          // Extract task number from directory name: e.g., "168-add-internal-work-detection"
          const dirName = entry.name;
          const match = dirName.match(/^(\d+)-/);
          if (!match) continue;

          const taskNum = match[1];
          const slug = dirName.slice(match[0].length);

          const planPath = path.join(quickDir, dirName, `${taskNum}-PLAN.md`);
          const summaryPath = path.join(quickDir, dirName, `${taskNum}-SUMMARY.md`);

          // Check: PLAN exists but SUMMARY does not
          if (fs.existsSync(planPath) && !fs.existsSync(summaryPath)) {
            const planStat = fs.statSync(planPath);
            issues.push({
              id: `internal-quick-${taskNum}`,
              title: `Unfinished quick task #${taskNum}: ${slug}`,
              severity: 'warning',
              url: '',
              age: formatAge(planStat.mtime),
              created_at: planStat.mtime.toISOString(),
              meta: 'PLAN exists, no SUMMARY',
              source_type: 'internal',
              issue_type: 'issue',
              _route: `/qgsd:quick "${slug}"`
            });
          }
        }
      }
    } catch (err) {
      // Log warning but continue with other scans (fail-open)
      console.warn(`[observe-internal] Warning scanning quick tasks: ${err.message}`);
    }

    // Category 2: Stale debug sessions
    try {
      const debugPath = path.resolve(projectRoot, '.planning/quick/quorum-debug-latest.md');
      if (fs.existsSync(debugPath)) {
        const stat = fs.statSync(debugPath);

        // Check if less than 7 days old
        const diffMs = Date.now() - stat.mtime.getTime();
        const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;

        if (diffMs < sevenDaysMs) {
          // Read file content to check for "unresolved" or "status: open"
          const content = fs.readFileSync(debugPath, 'utf8');
          const isUnresolved = /unresolved|status:\s*open/i.test(content);

          if (isUnresolved) {
            issues.push({
              id: 'internal-debug-latest',
              title: 'Unresolved debug session: quorum-debug-latest.md',
              severity: 'info',
              url: '',
              age: formatAge(stat.mtime),
              created_at: stat.mtime.toISOString(),
              meta: 'Debug session may need resolution',
              source_type: 'internal',
              issue_type: 'issue',
              _route: '/qgsd:debug --resume'
            });
          }
        }
      }
    } catch (err) {
      // Log warning but continue with other scans (fail-open)
      console.warn(`[observe-internal] Warning scanning debug sessions: ${err.message}`);
    }

    // Category 3: Active milestone phases without VERIFICATION.md
    try {
      const stateFilePath = path.resolve(projectRoot, '.planning/STATE.md');
      if (fs.existsSync(stateFilePath)) {
        const stateContent = fs.readFileSync(stateFilePath, 'utf8');

        // Extract Phase: value from STATE.md
        const phaseMatch = stateContent.match(/^Phase:\s+(.+?)$/m);
        if (phaseMatch) {
          let phase = phaseMatch[1].trim();

          // Skip if phase is empty or placeholder
          if (phase && phase !== '-' && phase !== '---') {
            // Sanitize phase string to prevent path traversal
            phase = phase.replace(/[^a-z0-9-]/g, '');

            if (phase) {
              const phaseDir = path.join(projectRoot, '.planning/phases', phase);

              // Check if phase directory exists
              if (fs.existsSync(phaseDir) && fs.statSync(phaseDir).isDirectory()) {
                // Check if any VERIFICATION.md file exists
                const entries = fs.readdirSync(phaseDir);
                const hasVerification = entries.some(f => f.endsWith('-VERIFICATION.md'));

                if (!hasVerification) {
                  issues.push({
                    id: `internal-milestone-${phase}`,
                    title: `Active phase ${phase} has no verification`,
                    severity: 'warning',
                    url: '',
                    age: '',
                    created_at: new Date().toISOString(),
                    meta: 'Phase active in STATE.md but no VERIFICATION.md found',
                    source_type: 'internal',
                    issue_type: 'issue',
                    _route: '/qgsd:solve'
                  });
                }
              }
            }
          }
        }
      }
    } catch (err) {
      // Log warning but continue with other scans (fail-open)
      console.warn(`[observe-internal] Warning scanning milestone phases: ${err.message}`);
    }

    return {
      source_label: label,
      source_type: 'internal',
      status: 'ok',
      issues
    };
  } catch (err) {
    return {
      source_label: label,
      source_type: 'internal',
      status: 'error',
      error: `Internal work detection failed: ${err.message}`,
      issues: []
    };
  }
}

module.exports = { handleInternal };
