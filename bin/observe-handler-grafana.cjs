/**
 * Grafana source handler for /qgsd:observe
 * Fetches alert rules from Grafana unified alerting API
 * Returns standard issue schema for the observe registry
 */

/**
 * Format age from ISO date to human-readable string
 * @param {string} isoDate - ISO8601 date string
 * @returns {string} Human-readable age
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
 * Map Grafana alert state to severity
 * @param {string} state - Grafana alert state
 * @returns {string} Severity level
 */
function mapStateSeverity(state) {
  const mapping = {
    alerting: 'error',
    firing: 'error',
    pending: 'warning',
    nodata: 'warning',
    normal: 'info',
    ok: 'info',
    paused: 'info'
  };
  return mapping[state] || 'info';
}

/**
 * Grafana source handler
 * Fetches alert rules from Grafana unified alerting API and maps to standard schema
 *
 * @param {object} sourceConfig - { type, label, endpoint, auth_env?, issue_type? }
 * @param {object} options - { fetchFn? }
 * @returns {Promise<object>} Standard schema result
 */
async function handleGrafana(sourceConfig, options) {
  const label = sourceConfig.label || 'Grafana';
  const endpoint = (sourceConfig.endpoint || '').replace(/\/$/, '');
  const fetchFn = (options && options.fetchFn) || globalThis.fetch;

  try {
    // Build auth headers
    const headers = {};
    if (sourceConfig.auth_env) {
      const token = process.env[sourceConfig.auth_env];
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }
    }

    const url = `${endpoint}/api/v1/provisioning/alert-rules`;
    const response = await fetchFn(url, { headers });

    if (!response.ok) {
      return {
        source_label: label,
        source_type: 'grafana',
        status: 'error',
        error: `HTTP ${response.status} from Grafana`,
        issues: []
      };
    }

    const rules = await response.json();
    const ruleList = Array.isArray(rules) ? rules : [];

    const issues = ruleList.map((rule, idx) => {
      const labels = rule.labels || {};
      const annotations = rule.annotations || {};
      const state = labels.grafana_state || '';
      const severity = mapStateSeverity(state);

      // Build URL from dashboardUid if available
      const ruleUrl = rule.dashboardUid
        ? `${endpoint}/d/${rule.dashboardUid}`
        : endpoint;

      // Build meta from annotations and context
      const metaParts = [];
      if (annotations.summary) metaParts.push(annotations.summary);
      if (rule.ruleGroup) metaParts.push(`group: ${rule.ruleGroup}`);
      if (rule.folderUID) metaParts.push(`folder: ${rule.folderUID}`);

      return {
        id: `grafana-alert-${rule.id || idx}`,
        title: rule.title || `alert-rule-${idx}`,
        severity,
        url: ruleUrl,
        age: formatAge(rule.updated),
        created_at: rule.updated || new Date().toISOString(),
        meta: metaParts.join(' | '),
        source_type: 'grafana',
        issue_type: sourceConfig.issue_type || 'drift'
      };
    });

    return {
      source_label: label,
      source_type: 'grafana',
      status: 'ok',
      issues
    };
  } catch (err) {
    return {
      source_label: label,
      source_type: 'grafana',
      status: 'error',
      error: `Grafana fetch failed: ${err.message}`,
      issues: []
    };
  }
}

module.exports = { handleGrafana };
