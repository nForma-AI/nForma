/**
 * Debt retention policy module
 * Handles archival of resolved entries older than max_age
 */

const fs = require('node:fs');
const path = require('node:path');

/**
 * Apply retention policy to debt ledger
 * Archives resolved entries older than max_age to separate array
 * Non-resolved entries are NEVER archived regardless of age
 * @param {object} ledger - Debt ledger object
 * @param {number} maxAgeDays - Maximum age in days for resolved entries (default: 90)
 * @returns {object} { active: [], archived: [] } - Split ledger entries
 */
function applyRetentionPolicy(ledger, maxAgeDays = 90) {
  const active = [];
  const archived = [];

  // Calculate cutoff timestamp
  const now = new Date();
  const cutoffMs = now.getTime() - (maxAgeDays * 24 * 60 * 60 * 1000);
  const cutoffDate = new Date(cutoffMs);

  // Process each entry
  for (const entry of ledger.debt_entries) {
    // Only archive resolved entries
    if (entry.status !== 'resolved') {
      active.push(entry);
      continue;
    }

    // Determine cutoff timestamp: prefer resolved_at, fall back to last_seen
    const relevantTimestamp = entry.resolved_at || entry.last_seen;
    if (!relevantTimestamp) {
      // No timestamp available, keep active to avoid data loss
      active.push(entry);
      continue;
    }

    const entryDate = new Date(relevantTimestamp);
    if (entryDate < cutoffDate) {
      // Entry is older than max_age, archive it
      archived.push(entry);
    } else {
      // Entry is newer than max_age, keep it active
      active.push(entry);
    }
  }

  return { active, archived };
}

/**
 * Write archived entries to JSONL file
 * Appends entries (does not overwrite)
 * @param {array} archivedEntries - Array of debt entries to archive
 * @param {string} archivePath - Path to .jsonl archive file
 */
function writeArchive(archivedEntries, archivePath) {
  // Ensure parent directory exists
  const dir = path.dirname(archivePath);
  fs.mkdirSync(dir, { recursive: true });

  // Write each entry as a separate JSON line
  const lines = archivedEntries.map(entry => JSON.stringify(entry)).join('\n');
  if (lines.length > 0) {
    fs.appendFileSync(archivePath, lines + '\n', 'utf8');
  }
}

module.exports = {
  applyRetentionPolicy,
  writeArchive
};
