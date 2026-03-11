#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const FORMAL_DIR = path.join(process.cwd(), '.planning', 'formal');
const PROXIMITY_INDEX_PATH = path.join(FORMAL_DIR, 'proximity-index.json');
const MODEL_REGISTRY_PATH = path.join(FORMAL_DIR, 'model-registry.json');
const REQUIREMENTS_PATH = path.join(FORMAL_DIR, 'requirements.json');
const OUTPUT_PATH = path.join(FORMAL_DIR, 'candidates.json');

// ─────────────────────────────────────────────────────────────────────────────
// Core discovery logic (exported for testability)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Discover unlinked (model, requirement) pairs within maxHops of the
 * proximity graph with score above threshold.
 *
 * @param {object} proximityIndex - The full proximity-index.json object
 * @param {object} modelRegistry  - The full model-registry.json object
 * @param {Array}  requirements   - Array of requirement objects with .id
 * @param {object} opts           - { threshold, maxHops }
 * @returns {{ metadata: object, candidates: Array }}
 */
function discoverCandidates(proximityIndex, modelRegistry, requirements, opts = {}) {
  const { proximity } = require('./formal-proximity.cjs');

  const threshold = opts.threshold != null ? opts.threshold : 0.6;
  const maxHops = opts.maxHops != null ? opts.maxHops : 3;

  // Compute SHA256 hash of the proximity index for idempotency tracking
  const indexContent = JSON.stringify(proximityIndex);
  const proximityIndexHash = crypto.createHash('sha256').update(indexContent).digest('hex').slice(0, 8);

  const modelPaths = Object.keys(modelRegistry.models || {});
  const reqIds = requirements.map(r => r.id);

  const candidates = [];
  let totalPairsChecked = 0;

  for (const modelPath of modelPaths) {
    const modelInfo = modelRegistry.models[modelPath];
    const linkedReqs = new Set(modelInfo.requirements || []);
    const modelKey = `formal_model::${modelPath}`;

    for (const reqId of reqIds) {
      // Skip already-linked pairs
      if (linkedReqs.has(reqId)) continue;

      totalPairsChecked++;
      const reqKey = `requirement::${reqId}`;

      let score;
      try {
        score = proximity(proximityIndex, modelKey, reqKey, maxHops);
      } catch {
        process.stderr.write(`[candidate-discovery] WARN: proximity() failed for ${modelPath} <-> ${reqId}, skipping\n`);
        continue;
      }

      if (score == null || isNaN(score)) {
        process.stderr.write(`[candidate-discovery] WARN: proximity() returned ${score} for ${modelPath} <-> ${reqId}, skipping\n`);
        continue;
      }

      if (score > threshold) {
        candidates.push({
          model: modelPath,
          requirement: reqId,
          proximity_score: Math.round(score * 10000) / 10000, // 4 decimal places
        });
      }
    }
  }

  // Sort by proximity_score descending, then model+requirement for ties (deterministic)
  candidates.sort((a, b) => {
    if (b.proximity_score !== a.proximity_score) return b.proximity_score - a.proximity_score;
    const aKey = `${a.model}::${a.requirement}`;
    const bKey = `${b.model}::${b.requirement}`;
    return aKey < bKey ? -1 : aKey > bKey ? 1 : 0;
  });

  return {
    metadata: {
      generated: new Date().toISOString(),
      proximity_index_hash: proximityIndexHash,
      threshold,
      max_hops: maxHops,
      total_pairs_checked: totalPairsChecked,
      candidates_found: candidates.length,
    },
    candidates,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// CLI
// ─────────────────────────────────────────────────────────────────────────────

function parseArgs(argv) {
  const args = { minScore: 0.6, maxHops: 3, top: null, json: false, help: false };
  for (let i = 2; i < argv.length; i++) {
    if (argv[i] === '--json') args.json = true;
    else if (argv[i] === '--help' || argv[i] === '-h') args.help = true;
    else if (argv[i].startsWith('--min-score')) {
      const val = argv[i].includes('=') ? argv[i].split('=')[1] : argv[++i];
      args.minScore = parseFloat(val);
    } else if (argv[i].startsWith('--max-hops')) {
      const val = argv[i].includes('=') ? argv[i].split('=')[1] : argv[++i];
      args.maxHops = parseInt(val, 10);
    } else if (argv[i].startsWith('--top')) {
      const val = argv[i].includes('=') ? argv[i].split('=')[1] : argv[++i];
      args.top = parseInt(val, 10);
    }
  }
  return args;
}

function printHelp() {
  console.log(`Usage: node bin/candidate-discovery.cjs [options]

Options:
  --min-score <n>  Minimum proximity score threshold (default: 0.6)
  --max-hops <n>   Maximum BFS hop count (default: 3)
  --top <n>        Return only top N candidates by score (default: all)
  --json           Print summary to stdout as JSON (for piping)
  --help           Show this help message

Discovers unlinked (model, requirement) pairs within the proximity graph.
Writes .planning/formal/candidates.json.
`);
}

function main() {
  const args = parseArgs(process.argv);

  if (args.help) {
    printHelp();
    process.exit(0);
  }

  // Validate inputs exist
  if (!fs.existsSync(PROXIMITY_INDEX_PATH)) {
    process.stderr.write('[candidate-discovery] ERROR: proximity-index.json not found \u2014 run formal-verify first\n');
    process.exit(1);
  }
  if (!fs.existsSync(MODEL_REGISTRY_PATH)) {
    process.stderr.write('[candidate-discovery] ERROR: model-registry.json not found\n');
    process.exit(1);
  }
  if (!fs.existsSync(REQUIREMENTS_PATH)) {
    process.stderr.write('[candidate-discovery] ERROR: requirements.json not found\n');
    process.exit(1);
  }

  // Load inputs
  const proximityIndex = JSON.parse(fs.readFileSync(PROXIMITY_INDEX_PATH, 'utf8'));
  const modelRegistry = JSON.parse(fs.readFileSync(MODEL_REGISTRY_PATH, 'utf8'));
  const requirementsData = JSON.parse(fs.readFileSync(REQUIREMENTS_PATH, 'utf8'));
  const requirements = requirementsData.requirements || [];

  const modelCount = Object.keys(modelRegistry.models || {}).length;
  const reqCount = requirements.length;
  process.stderr.write(`[candidate-discovery] Checking ${modelCount} models x ${reqCount} requirements...\n`);

  const result = discoverCandidates(proximityIndex, modelRegistry, requirements, {
    threshold: args.minScore,
    maxHops: args.maxHops,
  });

  // Log histogram of candidate scores to stderr (BEFORE truncation)
  if (result.candidates.length > 0) {
    const buckets = { '0.6-0.7': 0, '0.7-0.8': 0, '0.8-0.9': 0, '0.9-1.0': 0 };
    for (const c of result.candidates) {
      if (c.proximity_score < 0.7) buckets['0.6-0.7']++;
      else if (c.proximity_score < 0.8) buckets['0.7-0.8']++;
      else if (c.proximity_score < 0.9) buckets['0.8-0.9']++;
      else buckets['0.9-1.0']++;
    }
    process.stderr.write(`[candidate-discovery] Score histogram:\n`);
    for (const [range, count] of Object.entries(buckets)) {
      if (count > 0) process.stderr.write(`  ${range}: ${count}\n`);
    }
  }

  // Apply --top N truncation if specified
  if (args.top != null && args.top > 0 && args.top < result.candidates.length) {
    const beforeCount = result.candidates.length;
    result.candidates = result.candidates.slice(0, args.top);
    result.metadata.candidates_before_top = beforeCount;
    result.metadata.top = args.top;
    result.metadata.candidates_found = result.candidates.length;
    process.stderr.write(`[candidate-discovery] Showing top ${args.top} of ${beforeCount} candidates\n`);
  }

  process.stderr.write(`[candidate-discovery] Checked ${result.metadata.total_pairs_checked} pairs, found ${result.metadata.candidates_found} candidates (threshold=${result.metadata.threshold}, maxHops=${result.metadata.max_hops})\n`);

  // Write candidates.json
  fs.writeFileSync(OUTPUT_PATH, JSON.stringify(result, null, 2) + '\n');
  process.stderr.write(`[candidate-discovery] Written to: ${OUTPUT_PATH}\n`);

  // JSON output for piping
  if (args.json) {
    process.stdout.write(JSON.stringify(result) + '\n');
  }

  process.exit(0);
}

if (require.main === module) {
  main();
}

module.exports = { discoverCandidates };
