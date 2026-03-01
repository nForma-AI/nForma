#!/usr/bin/env node
// bin/aggregate-requirements.cjs
// Requirements aggregation pipeline: parse .planning/REQUIREMENTS.md into formal/requirements.json
// Provides: parseRequirements, parseTraceability, validateEnvelope, aggregateRequirements

'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// Parse requirement bullets from REQUIREMENTS.md
// Returns array of { id, text, category, completed } sorted by id
function parseRequirements(content) {
  const requirements = [];
  let currentCategory = null;

  const lines = content.split('\n');

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Match category headers: ### Category — PREFIX or ### Category -- PREFIX
    const categoryMatch = line.match(/^###\s+(.+?)\s+[—–-]{1,2}\s*([A-Z]+)$/);
    if (categoryMatch) {
      currentCategory = categoryMatch[1].trim();
      continue;
    }

    // Match requirement bullets: - [ ] **ID**: text or - [x] **ID**: text
    const reqMatch = line.match(/^-\s+\[([ x])\]\s+\*\*([A-Z]+-\d+)\*\*:\s*(.+)$/);
    if (reqMatch) {
      const [, completed_mark, id, text] = reqMatch;
      requirements.push({
        id,
        text: text.trim(),
        category: currentCategory || 'Uncategorized',
        completed: completed_mark === 'x'
      });
    }
  }

  // Sort by id (lexicographic) for determinism
  return requirements.sort((a, b) => a.id.localeCompare(b.id));
}

// Parse the Traceability table from REQUIREMENTS.md
// Returns map: { [reqId]: { phase, status } }
function parseTraceability(content) {
  const traceability = {};

  // Match table rows: | REQ-ID | vX.XX-NN | Status |
  const tableRowRegex = /^\|\s*([A-Z]+-\d+)\s*\|\s*(v[\d.]+-\d+)\s*\|\s*(\w+)\s*\|/gm;
  let match;

  while ((match = tableRowRegex.exec(content)) !== null) {
    const [, reqId, phase, status] = match;
    traceability[reqId] = {
      phase,
      status: status === 'Complete' ? 'Complete' : 'Pending'
    };
  }

  return traceability;
}

// Extract milestone from document title
// Matches: # Requirements: QGSD vX.XX ... or similar
function extractMilestone(content) {
  const match = content.match(/#\s+Requirements:.*?(v[\d.]+)/);
  return match ? match[1] : 'unknown';
}

// Inline schema validation: check all required fields and types
function validateEnvelope(obj) {
  const errors = [];

  if (!obj || typeof obj !== 'object') {
    errors.push('Envelope must be an object');
    return { valid: false, errors };
  }

  // Check schema_version
  if (typeof obj.schema_version !== 'string' || obj.schema_version !== '1') {
    errors.push('schema_version must be string "1"');
  }

  // Check source
  if (typeof obj.source !== 'string') {
    errors.push('source must be a string');
  }

  // Check aggregated_at (ISO 8601)
  if (typeof obj.aggregated_at !== 'string') {
    errors.push('aggregated_at must be a string (ISO 8601)');
  } else if (!isValidISO8601(obj.aggregated_at)) {
    errors.push('aggregated_at is not valid ISO 8601');
  }

  // Check frozen_at (string or null)
  if (obj.frozen_at !== null && typeof obj.frozen_at !== 'string') {
    errors.push('frozen_at must be null or a string (ISO 8601)');
  } else if (obj.frozen_at && !isValidISO8601(obj.frozen_at)) {
    errors.push('frozen_at is not valid ISO 8601');
  }

  // Check content_hash
  if (!obj.content_hash || typeof obj.content_hash !== 'string') {
    errors.push('content_hash must be a string');
  } else if (!/^sha256:[a-f0-9]{64}$/.test(obj.content_hash)) {
    errors.push('content_hash must match pattern sha256:[64-hex-chars]');
  }

  // Check requirements array
  if (!Array.isArray(obj.requirements)) {
    errors.push('requirements must be an array');
    return { valid: false, errors };
  }

  // Validate each requirement
  obj.requirements.forEach((req, idx) => {
    if (!req.id || typeof req.id !== 'string') {
      errors.push('requirements[' + idx + '].id must be a string');
    } else if (!/^[A-Z]+-\d+$/.test(req.id)) {
      errors.push('requirements[' + idx + '].id does not match pattern');
    }

    if (!req.text || typeof req.text !== 'string') {
      errors.push('requirements[' + idx + '].text must be a non-empty string');
    }

    if (!req.category || typeof req.category !== 'string') {
      errors.push('requirements[' + idx + '].category must be a non-empty string');
    }

    if (!req.phase || typeof req.phase !== 'string') {
      errors.push('requirements[' + idx + '].phase must be a string');
    } else if (!/^v[\d.]+-\d+$/.test(req.phase)) {
      errors.push('requirements[' + idx + '].phase does not match pattern');
    }

    if (!['Pending', 'Complete'].includes(req.status)) {
      errors.push('requirements[' + idx + '].status must be Pending or Complete');
    }

    if (!req.provenance || typeof req.provenance !== 'object') {
      errors.push('requirements[' + idx + '].provenance must be an object');
    } else {
      if (typeof req.provenance.source_file !== 'string') {
        errors.push('requirements[' + idx + '].provenance.source_file must be a string');
      }
      if (typeof req.provenance.milestone !== 'string') {
        errors.push('requirements[' + idx + '].provenance.milestone must be a string');
      }
    }
  });

  return {
    valid: errors.length === 0,
    errors
  };
}

// Validate ISO 8601 datetime string
function isValidISO8601(dateString) {
  const iso8601Regex = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{3})?Z?$/;
  if (!iso8601Regex.test(dateString)) {
    return false;
  }
  return !isNaN(Date.parse(dateString));
}

// Compute SHA-256 hash of content
function computeContentHash(obj) {
  const jsonStr = JSON.stringify(obj, null, 2);
  return 'sha256:' + crypto.createHash('sha256').update(jsonStr).digest('hex');
}

// Main aggregation pipeline
function aggregateRequirements(options) {
  options = options || {};
  const requirementsPath = options.requirementsPath || '.planning/REQUIREMENTS.md';
  const outputPath = options.outputPath || 'formal/requirements.json';
  const deterministic = options.deterministic || false;

  // Check if output path exists and is frozen
  if (fs.existsSync(outputPath)) {
    const existing = JSON.parse(fs.readFileSync(outputPath, 'utf8'));
    if (existing.frozen_at !== null) {
      throw new Error('Envelope is frozen -- use amendment workflow (ENV-04)');
    }
  }

  // Read REQUIREMENTS.md
  if (!fs.existsSync(requirementsPath)) {
    throw new Error('REQUIREMENTS.md not found at ' + requirementsPath);
  }

  const content = fs.readFileSync(requirementsPath, 'utf8');

  // Parse requirements and traceability
  const requirements = parseRequirements(content);
  const traceability = parseTraceability(content);
  const milestone = extractMilestone(content);

  // Merge: add phase and status from traceability
  const merged = requirements.map(function(req) {
    const trace = traceability[req.id] || { phase: 'unknown', status: 'Pending' };
    return {
      id: req.id,
      text: req.text,
      category: req.category,
      phase: trace.phase,
      status: trace.status,
      provenance: {
        source_file: requirementsPath,
        milestone: milestone
      }
    };
  });

  // Sort by id for determinism
  merged.sort(function(a, b) { return a.id.localeCompare(b.id); });

  // Compute content hash from the requirements array (before envelope wrapping)
  const contentHash = computeContentHash(merged);

  // Get current timestamp or use fixed timestamp for deterministic mode
  const now = deterministic
    ? '2026-03-01T20:32:24.000Z'
    : new Date().toISOString();

  // Build envelope with keys in alphabetical order for determinism
  const envelope = {
    aggregated_at: now,
    content_hash: contentHash,
    frozen_at: null,
    requirements: merged,
    schema_version: '1',
    source: requirementsPath
  };

  // Validate envelope
  const validation = validateEnvelope(envelope);
  if (!validation.valid) {
    throw new Error('Envelope validation failed: ' + validation.errors.join('; '));
  }

  // Write atomically (temp + rename)
  const dir = path.dirname(outputPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  const tmpPath = outputPath + '.' + Date.now() + '.tmp';
  try {
    fs.writeFileSync(tmpPath, JSON.stringify(envelope, null, 2), 'utf8');
    fs.renameSync(tmpPath, outputPath);
  } catch (e) {
    try {
      fs.unlinkSync(tmpPath);
    } catch (_ignored) {}
    throw e;
  }

  return {
    valid: true,
    requirementCount: merged.length,
    outputPath: outputPath
  };
}

// CLI entrypoint
if (require.main === module) {
  try {
    const args = process.argv.slice(2);
    const opts = {};
    let dryRun = false;
    let deterministic = false;

    // Parse arguments
    for (let i = 0; i < args.length; i++) {
      if (args[i] === '--dry-run') {
        dryRun = true;
      } else if (args[i] === '--deterministic') {
        deterministic = true;
      } else if (args[i].indexOf('--requirements=') === 0) {
        opts.requirementsPath = args[i].split('=')[1];
      } else if (args[i].indexOf('--output=') === 0) {
        opts.outputPath = args[i].split('=')[1];
      }
    }

    opts.deterministic = deterministic;

    if (dryRun) {
      // Dry run: output to stdout without writing file
      const requirementsPath = opts.requirementsPath || '.planning/REQUIREMENTS.md';
      const content = fs.readFileSync(requirementsPath, 'utf8');
      const requirements = parseRequirements(content);
      const traceability = parseTraceability(content);
      const milestone = extractMilestone(content);

      const merged = requirements.map(function(req) {
        const trace = traceability[req.id] || { phase: 'unknown', status: 'Pending' };
        return {
          id: req.id,
          text: req.text,
          category: req.category,
          phase: trace.phase,
          status: trace.status,
          provenance: {
            source_file: requirementsPath,
            milestone: milestone
          }
        };
      });

      merged.sort(function(a, b) { return a.id.localeCompare(b.id); });
      const contentHash = computeContentHash(merged);
      const now = deterministic
        ? '2026-03-01T20:32:24.000Z'
        : new Date().toISOString();

      const envelope = {
        aggregated_at: now,
        content_hash: contentHash,
        frozen_at: null,
        requirements: merged,
        schema_version: '1',
        source: requirementsPath
      };

      console.log(JSON.stringify(envelope, null, 2));
    } else {
      const result = aggregateRequirements(opts);
      console.log('Aggregated ' + result.requirementCount + ' requirements to ' + result.outputPath);
    }
  } catch (e) {
    console.error('Error: ' + e.message);
    process.exit(1);
  }
}

// Exports
module.exports = {
  parseRequirements: parseRequirements,
  parseTraceability: parseTraceability,
  validateEnvelope: validateEnvelope,
  aggregateRequirements: aggregateRequirements
};
