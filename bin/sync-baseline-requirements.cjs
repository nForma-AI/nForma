#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

/**
 * Merge baseline requirements into .formal/requirements.json.
 * Idempotent: matches on exact `text` field to skip duplicates.
 * Assigns next-available IDs per category prefix for new entries.
 *
 * @param {string} profile - One of: web, mobile, desktop, api, cli, library
 * @param {string} [projectRoot] - Path to project root, defaults to process.cwd()
 * @returns {{ added: Array, skipped: Array, total_before: number, total_after: number }}
 */
function syncBaselineRequirements(profile, projectRoot) {
  const root = projectRoot || process.cwd();

  // 1. Load baseline requirements
  let baseline;
  try {
    const { loadBaselineRequirements } = require('./load-baseline-requirements.cjs');
    baseline = loadBaselineRequirements(profile);
  } catch (err) {
    console.error(`Error loading baseline requirements: ${err.message}`);
    process.exit(2);
  }

  // 2. Read existing requirements
  const reqPath = path.join(root, '.formal', 'requirements.json');
  let rawEnvelope;
  let requirements;

  if (fs.existsSync(reqPath)) {
    try {
      rawEnvelope = JSON.parse(fs.readFileSync(reqPath, 'utf8'));
      requirements = rawEnvelope.requirements || [];
    } catch (_) {
      rawEnvelope = {};
      requirements = [];
    }
  } else {
    // Create .formal directory if needed
    fs.mkdirSync(path.join(root, '.formal'), { recursive: true });
    rawEnvelope = {};
    requirements = [];
  }

  // 3. Build lookup of existing requirement texts -> id
  const existingTexts = new Map(requirements.map(r => [r.text, r.id]));

  // 4. Build map of highest existing ID number per prefix
  const maxId = {};
  for (const r of requirements) {
    if (!r.id) continue;
    const dashIdx = r.id.lastIndexOf('-');
    if (dashIdx === -1) continue;
    const prefix = r.id.substring(0, dashIdx);
    const num = parseInt(r.id.substring(dashIdx + 1), 10);
    if (!isNaN(num)) {
      maxId[prefix] = Math.max(maxId[prefix] || 0, num);
    }
  }

  const added = [];
  const skipped = [];
  const totalBefore = requirements.length;

  // 5-6. Process each baseline category
  for (const cat of baseline.categories) {
    if (!cat.requirements || cat.requirements.length === 0) continue;

    // Derive prefix from first requirement's ID (e.g., "UX-01" -> "UX")
    const firstId = cat.requirements[0].id;
    const dashIdx = firstId.lastIndexOf('-');
    const prefix = firstId.substring(0, dashIdx);

    for (const req of cat.requirements) {
      if (existingTexts.has(req.text)) {
        // 6a. Skip duplicate
        skipped.push({
          id: req.id,
          text: req.text,
          existingId: existingTexts.get(req.text),
        });
      } else {
        // 6c. Assign next available ID
        maxId[prefix] = (maxId[prefix] || 0) + 1;
        const padLen = maxId[prefix] > 99 ? String(maxId[prefix]).length : 2;
        const newId = prefix + '-' + String(maxId[prefix]).padStart(padLen, '0');

        const newReq = {
          id: newId,
          text: req.text,
          category: cat.name,
          phase: 'baseline',
          status: 'Pending',
          provenance: {
            source_file: 'qgsd-baseline',
            milestone: 'baseline',
          },
        };

        requirements.push(newReq);
        existingTexts.set(req.text, newId);
        added.push({ id: newId, text: req.text });
      }
    }
  }

  // 7. Write if anything was added
  if (added.length > 0) {
    const contentHash = 'sha256:' + crypto
      .createHash('sha256')
      .update(JSON.stringify(requirements, null, 2))
      .digest('hex');

    // Defensive: only write if hash actually changed
    const existingHash = rawEnvelope.content_hash || null;
    if (existingHash !== contentHash) {
      const envelope = {
        aggregated_at: new Date().toISOString(),
        content_hash: contentHash,
        frozen_at: rawEnvelope.frozen_at || null,
        schema_version: rawEnvelope.schema_version || undefined,
        requirements,
      };

      // Remove undefined keys
      if (envelope.schema_version === undefined) delete envelope.schema_version;

      fs.writeFileSync(reqPath, JSON.stringify(envelope, null, 2) + '\n');
    }
  }

  return {
    added,
    skipped,
    total_before: totalBefore,
    total_after: requirements.length,
  };
}

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------

function printReport(result, profile) {
  console.log(`Baseline sync: ${profile} profile`);
  console.log(`  Before: ${result.total_before} requirements`);
  console.log(`  Added:  ${result.added.length} new requirements`);
  console.log(`  Skipped: ${result.skipped.length} (already present by text match)`);
  console.log(`  After:  ${result.total_after} requirements`);

  if (result.added.length > 0) {
    console.log('\nAdded:');
    for (const a of result.added) {
      console.log(`  + [${a.id}] ${a.text}`);
    }
  }

  if (result.skipped.length > 0) {
    console.log('\nSkipped:');
    for (const s of result.skipped) {
      console.log(`  ~ [${s.id}] matched existing [${s.existingId}]`);
    }
  }
}

if (require.main === module) {
  const args = process.argv.slice(2);

  // --json flag
  const jsonOutput = args.includes('--json');

  // Parse --profile
  const profileIdx = args.indexOf('--profile');
  let profile = null;

  if (profileIdx !== -1 && args[profileIdx + 1]) {
    profile = args[profileIdx + 1];
  } else {
    // Try reading from .planning/config.json
    try {
      const config = JSON.parse(fs.readFileSync(
        path.join(process.cwd(), '.planning/config.json'), 'utf8'
      ));
      profile = config.profile;
    } catch (_) {}

    if (!profile) {
      console.error('Usage: node bin/sync-baseline-requirements.cjs --profile <web|mobile|desktop|api|cli|library>');
      console.error('       Or set "profile" in .planning/config.json');
      process.exit(1);
    }
  }

  const result = syncBaselineRequirements(profile);
  if (jsonOutput) {
    console.log(JSON.stringify(result, null, 2));
  } else {
    printReport(result, profile);
  }
}

module.exports = { syncBaselineRequirements };
