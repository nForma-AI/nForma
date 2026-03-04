/**
 * Source handler implementations for /qgsd:observe
 * GitHub, Sentry, sentry-feedback, and bash handlers
 *
 * ALL handlers return the SAME schema:
 * { source_label, source_type, status: "ok"|"error"|"pending_mcp", issues: [...], error?, _mcp_instruction? }
 *
 * GitHub and bash handlers do their work directly (CLI calls via execFileSync).
 * Sentry and sentry-feedback return status: "pending_mcp" with _mcp_instruction.
 */

const { execFileSync } = require('node:child_process');

// Severity labels recognized from GitHub labels (ordered by priority)
const SEVERITY_LABELS = ['critical', 'error', 'bug', 'warning', 'enhancement', 'info'];

/**
 * Parse a duration string like "7d", "24h", "30m" into milliseconds
 * @param {string} duration - Duration string
 * @returns {number} Milliseconds
 */
function parseDuration(duration) {
  if (!duration) return 0;
  const match = String(duration).match(/^(\d+)([dhms])$/);
  if (!match) return 0;
  const num = parseInt(match[1], 10);
  const unit = match[2];
  const multipliers = { d: 86400000, h: 3600000, m: 60000, s: 1000 };
  return num * (multipliers[unit] || 0);
}

/**
 * Format age from ISO date to human-readable string
 * @param {string} isoDate - ISO8601 date string
 * @returns {string} Human-readable age like "5m", "2h", "3d"
 */
function formatAge(isoDate) {
  if (!isoDate) return 'unknown';
  const diffMs = Date.now() - new Date(isoDate).getTime();
  if (diffMs < 0) return 'future';
  const minutes = Math.floor(diffMs / 60000);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  return `${days}d`;
}

/**
 * Classify severity from GitHub labels
 * @param {Array} labels - Array of label objects with 'name' field, or strings
 * @returns {string} Severity string
 */
function classifySeverityFromLabels(labels) {
  if (!Array.isArray(labels)) return 'info';
  const labelNames = labels.map(l => (typeof l === 'string' ? l : l.name || '').toLowerCase());
  for (const sev of SEVERITY_LABELS) {
    if (labelNames.some(name => name.includes(sev))) {
      return sev;
    }
  }
  return 'info';
}

/**
 * Detect repo from git remote
 * @param {Function} [execFn] - execFileSync function for testing
 * @returns {string|null} owner/repo string or null
 */
function detectRepoFromGit(execFn) {
  const execFile = execFn || execFileSync;
  try {
    const url = execFile('git', ['remote', 'get-url', 'origin'], { encoding: 'utf8' }).trim();
    // Parse SSH: git@github.com:owner/repo.git or HTTPS: https://github.com/owner/repo.git
    const sshMatch = url.match(/github\.com[:/]([^/]+\/[^/.]+)/);
    if (sshMatch) return sshMatch[1];
    return null;
  } catch {
    return null;
  }
}

/**
 * GitHub source handler
 * Uses gh CLI via execFileSync (no shell injection risk) to fetch issues
 *
 * @param {object} sourceConfig - { type, label, repo?, filter?: { state, labels, since, limit } }
 * @param {object} options - { sinceOverride?, limitOverride?, execFn? }
 * @returns {object} Standard schema result
 */
function handleGitHub(sourceConfig, options) {
  const label = sourceConfig.label || 'GitHub';
  const execFile = options.execFn || execFileSync;

  try {
    const repo = sourceConfig.repo || detectRepoFromGit(execFile);
    if (!repo) {
      return {
        source_label: label,
        source_type: 'github',
        status: 'error',
        error: 'Could not determine repo — set repo in config or ensure git remote is configured',
        issues: []
      };
    }

    const filter = sourceConfig.filter || {};
    const state = filter.state || 'open';
    const limit = options.limitOverride || filter.limit || 10;
    const since = options.sinceOverride || filter.since;
    const labels = filter.labels || [];

    // Build gh CLI args — using execFileSync (array args, no shell interpolation)
    const args = ['issue', 'list', '--repo', repo, '--state', state,
      '--limit', String(limit), '--json', 'number,title,url,labels,createdAt,assignees'];

    for (const lbl of labels) {
      args.push('--label', lbl);
    }

    const output = execFile('gh', args, { encoding: 'utf8' });
    let issues = JSON.parse(output);

    // Apply since filter
    if (since) {
      const cutoffMs = parseDuration(since);
      if (cutoffMs > 0) {
        const cutoff = Date.now() - cutoffMs;
        issues = issues.filter(i => new Date(i.createdAt).getTime() > cutoff);
      }
    }

    return {
      source_label: label,
      source_type: 'github',
      status: 'ok',
      issues: issues.map(issue => ({
        id: `gh-${issue.number}`,
        title: issue.title,
        severity: classifySeverityFromLabels(issue.labels),
        url: issue.url || '',
        age: formatAge(issue.createdAt),
        created_at: issue.createdAt,
        meta: `#${issue.number} · ${(issue.assignees || []).length} assignee(s)`,
        source_type: 'github',
        issue_type: sourceConfig.issue_type || 'issue'
      }))
    };
  } catch (err) {
    return {
      source_label: label,
      source_type: 'github',
      status: 'error',
      error: `GitHub fetch failed: ${err.message}`,
      issues: []
    };
  }
}

/**
 * Sentry source handler
 * Returns pending_mcp status with instruction for the observe command to execute MCP call
 *
 * @param {object} sourceConfig - { type, label, project?, filter?: { status, since } }
 * @param {object} options - { sinceOverride? }
 * @returns {object} Standard schema result with pending_mcp status
 */
function handleSentry(sourceConfig, options) {
  const label = sourceConfig.label || 'Sentry';

  try {
    const project = sourceConfig.project || '';
    const parts = project.split('/');
    const organization_slug = parts[0] || '';
    const project_slug = parts[1] || '';

    const filter = sourceConfig.filter || {};
    const status = filter.status || 'unresolved';
    const since = options.sinceOverride || filter.since || '24h';

    return {
      source_label: label,
      source_type: 'sentry',
      status: 'pending_mcp',
      issues: [],
      _mcp_instruction: {
        type: 'mcp',
        tool: 'list_project_issues',
        params: {
          organization_slug,
          project_slug,
          query: `is:${status} firstSeen:>${since}`
        },
        mapper: 'mapSentryIssuesToSchema'
      }
    };
  } catch (err) {
    return {
      source_label: label,
      source_type: 'sentry',
      status: 'error',
      error: `Sentry handler failed: ${err.message}`,
      issues: []
    };
  }
}

/**
 * Map raw Sentry MCP result to standard schema
 * @param {Array} mcpResult - Array of Sentry issue objects from MCP
 * @param {object} sourceConfig - Source config for labels
 * @returns {object} Standard schema result with mapped issues
 */
function mapSentryIssuesToSchema(mcpResult, sourceConfig) {
  const label = sourceConfig.label || 'Sentry';
  const levelMap = { fatal: 'error', error: 'error', warning: 'warning', info: 'info' };

  try {
    const issues = (Array.isArray(mcpResult) ? mcpResult : []).map(issue => ({
      id: `sentry-${issue.id}`,
      title: issue.title || issue.culprit || 'Unknown Sentry issue',
      severity: levelMap[issue.level] || 'info',
      url: issue.permalink || '',
      age: formatAge(issue.firstSeen || issue.dateCreated),
      created_at: issue.firstSeen || issue.dateCreated || new Date().toISOString(),
      meta: `${issue.count || 0} events · ${issue.userCount || 0} users`,
      source_type: 'sentry',
      issue_type: sourceConfig.issue_type || 'issue'
    }));

    return {
      source_label: label,
      source_type: 'sentry',
      status: 'ok',
      issues
    };
  } catch (err) {
    return {
      source_label: label,
      source_type: 'sentry',
      status: 'error',
      error: `Sentry mapping failed: ${err.message}`,
      issues: []
    };
  }
}

/**
 * Sentry feedback source handler
 * Returns pending_mcp status with instruction
 *
 * @param {object} sourceConfig - { type, label, project?, filter?: { since } }
 * @param {object} options - { sinceOverride? }
 * @returns {object} Standard schema result with pending_mcp status
 */
function handleSentryFeedback(sourceConfig, options) {
  const label = sourceConfig.label || 'Sentry Feedback';

  try {
    const project = sourceConfig.project || '';
    const parts = project.split('/');
    const organization_slug = parts[0] || '';
    const project_slug = parts[1] || '';

    return {
      source_label: label,
      source_type: 'sentry-feedback',
      status: 'pending_mcp',
      issues: [],
      _mcp_instruction: {
        type: 'mcp',
        tool: 'list_user_feedback',
        params: {
          organization_slug,
          project_slug
        },
        mapper: 'mapSentryFeedbackToSchema'
      }
    };
  } catch (err) {
    return {
      source_label: label,
      source_type: 'sentry-feedback',
      status: 'error',
      error: `Sentry feedback handler failed: ${err.message}`,
      issues: []
    };
  }
}

/**
 * Map raw Sentry feedback MCP result to standard schema
 * @param {Array} mcpResult - Array of feedback objects from MCP
 * @param {object} sourceConfig - Source config for labels
 * @returns {object} Standard schema result with mapped feedback
 */
function mapSentryFeedbackToSchema(mcpResult, sourceConfig) {
  const label = sourceConfig.label || 'Sentry Feedback';

  try {
    const issues = (Array.isArray(mcpResult) ? mcpResult : []).map((fb, idx) => {
      const comment = fb.comments || fb.message || 'No comment';
      const truncated = comment.length > 80 ? comment.slice(0, 80) + '...' : comment;

      return {
        id: `feedback-${fb.id || idx}`,
        title: `[Feedback] ${truncated}`,
        severity: 'info',
        url: fb.url || '',
        age: formatAge(fb.dateCreated),
        created_at: fb.dateCreated || new Date().toISOString(),
        meta: fb.email ? `by ${fb.email}` : 'anonymous',
        source_type: 'sentry-feedback',
        issue_type: sourceConfig.issue_type || 'issue'
      };
    });

    return {
      source_label: label,
      source_type: 'sentry-feedback',
      status: 'ok',
      issues
    };
  } catch (err) {
    return {
      source_label: label,
      source_type: 'sentry-feedback',
      status: 'error',
      error: `Sentry feedback mapping failed: ${err.message}`,
      issues: []
    };
  }
}

/**
 * Bash source handler
 * Uses execFileSync with ['sh', '-c', command] — command comes from user's own config
 *
 * @param {object} sourceConfig - { type, label, command, parser?: "lines"|"json" }
 * @param {object} options - { execFn? }
 * @returns {object} Standard schema result
 */
function handleBash(sourceConfig, options) {
  const label = sourceConfig.label || 'Bash';
  const execFile = options.execFn || execFileSync;

  try {
    if (!sourceConfig.command) {
      return {
        source_label: label,
        source_type: 'bash',
        status: 'error',
        error: 'No command configured for bash source',
        issues: []
      };
    }

    // execFileSync with ['sh', '-c', command] — command is from trusted config file
    const output = execFile('sh', ['-c', sourceConfig.command], { encoding: 'utf8' });
    const parser = sourceConfig.parser || 'lines';

    let issues;
    if (parser === 'json') {
      const parsed = JSON.parse(output);
      const items = Array.isArray(parsed) ? parsed : [];
      issues = items.map((item, idx) => ({
        id: `bash-${idx}`,
        title: item.title || String(item),
        severity: item.severity || 'info',
        url: item.url || '',
        age: '',
        created_at: new Date().toISOString(),
        meta: '',
        source_type: 'bash',
        issue_type: sourceConfig.issue_type || 'issue'
      }));
    } else {
      // lines parser
      const lines = output.split('\n').filter(l => l.trim() !== '');
      issues = lines.map((line, idx) => ({
        id: `bash-${idx}`,
        title: line.trim(),
        severity: 'info',
        url: '',
        age: '',
        created_at: new Date().toISOString(),
        meta: '',
        source_type: 'bash',
        issue_type: sourceConfig.issue_type || 'issue'
      }));
    }

    return {
      source_label: label,
      source_type: 'bash',
      status: 'ok',
      issues
    };
  } catch (err) {
    return {
      source_label: label,
      source_type: 'bash',
      status: 'error',
      error: `Bash command failed: ${err.message}`,
      issues: []
    };
  }
}

module.exports = {
  handleGitHub,
  handleSentry,
  handleSentryFeedback,
  handleBash,
  mapSentryIssuesToSchema,
  mapSentryFeedbackToSchema,
  // Exported for testing
  parseDuration,
  formatAge,
  classifySeverityFromLabels,
  detectRepoFromGit
};
