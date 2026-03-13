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
 * Keyword pre-screen: extract key terms from requirement text and model file,
 * compute overlap. Zero overlap = auto-reject.
 * @param {string} modelPath - Path to formal model file
 * @param {string} reqText - Requirement text
 * @returns {boolean} true if there is meaningful keyword overlap
 */
function keywordOverlap(modelPath, reqText) {
  // Extract terms from requirement (3+ char words, lowercased, deduplicated)
  const STOP_WORDS = new Set(['the', 'and', 'for', 'are', 'but', 'not', 'you', 'all', 'can', 'has', 'her', 'was', 'one', 'our', 'out', 'with', 'that', 'this', 'from', 'they', 'been', 'have', 'its', 'will', 'would', 'could', 'should', 'each', 'which', 'their', 'there', 'when', 'must', 'shall']);
  const extractTerms = (text) => {
    if (!text) return new Set();
    return new Set(
      text.toLowerCase()
        .replace(/[^a-z0-9\s-_]/g, ' ')
        .split(/\s+/)
        .filter(w => w.length >= 3 && !STOP_WORDS.has(w))
    );
  };

  const reqTerms = extractTerms(reqText);
  if (reqTerms.size === 0) return true; // Can't filter if no terms

  // Read model file content
  let modelContent = '';
  try {
    const fullPath = path.join(process.cwd(), modelPath);
    modelContent = fs.readFileSync(fullPath, 'utf8');
  } catch {
    return true; // Can't read file = don't filter
  }

  const modelTerms = extractTerms(modelContent);
  if (modelTerms.size === 0) return true;

  // Count overlapping terms
  let overlap = 0;
  for (const term of reqTerms) {
    if (modelTerms.has(term)) overlap++;
  }

  // Zero overlap = reject
  return overlap > 0;
}

/**
 * Discover unlinked (model, requirement) pairs within maxHops of the
 * proximity graph with score above threshold, plus top-N zero-path pairs
 * ranked by coverage-gap heuristic.
 *
 * @param {object} proximityIndex - The full proximity-index.json object
 * @param {object} modelRegistry  - The full model-registry.json object
 * @param {Array}  requirements   - Array of requirement objects with .id
 * @param {object} opts           - { threshold, maxHops, nonNeighborTop }
 * @returns {{ metadata: object, candidates: Array }}
 */
function discoverCandidates(proximityIndex, modelRegistry, requirements, opts = {}) {
  const { proximity, ENSEMBLE_METHODS } = require('./formal-proximity.cjs');

  // Load category-groups for domain gating
  const CATEGORY_GROUPS_PATH = path.join(process.cwd(), '.planning', 'formal', 'category-groups.json');
  let categoryGroups = {};
  try { categoryGroups = JSON.parse(fs.readFileSync(CATEGORY_GROUPS_PATH, 'utf8')); } catch { /* no category groups available */ }

  // Build model -> category group lookup from model-registry requirements
  // modelCategoryGroups: Map<modelPath, Set<categoryGroup>>
  const modelCategoryGroups = new Map();
  for (const [mp, mi] of Object.entries(modelRegistry.models || {})) {
    const groups = new Set();
    for (const rId of (mi.requirements || [])) {
      const req = requirements.find(r => r.id === rId);
      if (req && req.category && categoryGroups[req.category]) {
        groups.add(categoryGroups[req.category]);
      }
    }
    modelCategoryGroups.set(mp, groups);
  }

  // Build requirement -> category group lookup
  const reqCategoryGroup = new Map();
  for (const req of requirements) {
    if (req.category && categoryGroups[req.category]) {
      reqCategoryGroup.set(req.id, categoryGroups[req.category]);
    }
  }

  // Build requirement -> already-covered flag (formal_models non-empty)
  const reqAlreadyCovered = new Map();
  for (const req of requirements) {
    reqAlreadyCovered.set(req.id, Array.isArray(req.formal_models) && req.formal_models.length > 0);
  }

  const threshold = opts.threshold != null ? opts.threshold : 0.6;
  const maxHops = opts.maxHops != null ? opts.maxHops : 5;
  const nonNeighborTop = opts.nonNeighborTop != null ? opts.nonNeighborTop : 20;

  // Compute SHA256 hash of the proximity index for idempotency tracking
  const indexContent = JSON.stringify(proximityIndex);
  const proximityIndexHash = crypto.createHash('sha256').update(indexContent).digest('hex').slice(0, 8);

  const modelPaths = Object.keys(modelRegistry.models || {});
  const reqIds = requirements.map(r => r.id);

  const methods = ENSEMBLE_METHODS;
  const candidates = [];
  const zeroPairs = []; // Pairs with score 0 (no graph path)
  let totalPairsChecked = 0;
  let filteredCount = 0;

  for (const modelPath of modelPaths) {
    const modelInfo = modelRegistry.models[modelPath];
    const linkedReqs = new Set(modelInfo.requirements || []);
    const modelKey = `formal_model::${modelPath}`;

    for (const reqId of reqIds) {
      // Skip already-linked pairs
      if (linkedReqs.has(reqId)) continue;

      totalPairsChecked++;
      const reqKey = `requirement::${reqId}`;

      const req = requirements.find(r => r.id === reqId);
      const reqText = req ? req.text : '';

      // Ensemble scoring: score with primary method (first in ENSEMBLE_METHODS).
      // Secondary methods are used in the top-N union pass after this loop.
      let score;
      try {
        score = proximity(proximityIndex, modelKey, reqKey, maxHops, { method: methods[0], reqsData: requirements, reqText });
      } catch {
        process.stderr.write(`[candidate-discovery] WARN: proximity() failed for ${modelPath} <-> ${reqId}, skipping\n`);
        continue;
      }

      if (score == null || isNaN(score)) {
        process.stderr.write(`[candidate-discovery] WARN: proximity() returned ${score} for ${modelPath} <-> ${reqId}, skipping\n`);
        continue;
      }

      if (score > threshold) {
        let dominated = false;
        let filterReason = null;

        // Pre-filter 1: Category-domain gating
        // If model's declared requirements are ALL in one category group,
        // and the candidate requirement is in a DIFFERENT category group,
        // reject unless score > 0.95
        const modelGroups = modelCategoryGroups.get(modelPath);
        const reqGroup = reqCategoryGroup.get(reqId);
        if (modelGroups && modelGroups.size === 1 && reqGroup) {
          const modelGroup = [...modelGroups][0];
          if (modelGroup !== reqGroup && score <= 0.95) {
            dominated = true;
            filterReason = 'cross_domain';
          }
        }

        // Pre-filter 2: Already-covered requirement check
        // If requirement already has formal_models, raise threshold to 0.95
        if (!dominated && reqAlreadyCovered.get(reqId) && score <= 0.95) {
          dominated = true;
          filterReason = 'already_covered';
        }

        // Pre-filter 3: Keyword pre-screen
        if (!dominated) {
          const req = requirements.find(r => r.id === reqId);
          const reqText = req ? req.text : '';
          if (!keywordOverlap(modelPath, reqText)) {
            dominated = true;
            filterReason = 'no_keyword_overlap';
          }
        }

        if (!dominated) {
          candidates.push({
            model: modelPath,
            requirement: reqId,
            proximity_score: Math.round(score * 10000) / 10000,
            source: 'graph',
          });
        } else {
          filteredCount++;
        }
      } else if (score === 0) {
        // Track zero-path pairs for non-neighbor discovery
        zeroPairs.push({ model: modelPath, requirement: reqId });
      }
    }
  }

  // Ensemble union pass: run secondary methods on all model-requirement pairs,
  // add their top candidates that the primary method missed.
  // Each secondary method finds different true positives (validated by Haiku benchmark).
  // Candidates go through the same pre-filters as primary to control noise.
  if (methods.length > 1) {
    const existingPairs = new Set(candidates.map(c => `${c.model}|${c.requirement}`));
    const secondaryCandidates = [];

    for (let mi = 1; mi < methods.length; mi++) {
      const method = methods[mi];
      const methodCandidates = [];

      for (const modelPath of modelPaths) {
        const modelInfo = modelRegistry.models[modelPath];
        const linkedReqs = new Set(modelInfo.requirements || []);
        const modelKey = `formal_model::${modelPath}`;

        for (const reqId of reqIds) {
          if (linkedReqs.has(reqId)) continue;
          const pairKey = `${modelPath}|${reqId}`;
          if (existingPairs.has(pairKey)) continue;

          const reqKey = `requirement::${reqId}`;
          const req = requirements.find(r => r.id === reqId);
          const reqText = req ? req.text : '';

          let score;
          try {
            score = proximity(proximityIndex, modelKey, reqKey, maxHops, { method, reqsData: requirements, reqText });
          } catch { continue; }

          if (score == null || isNaN(score) || score <= threshold) continue;

          // Apply same pre-filters as primary method
          let dominated = false;

          // Domain gating
          const mGroups = modelCategoryGroups.get(modelPath);
          const rGroup = reqCategoryGroup.get(reqId);
          if (mGroups && mGroups.size === 1 && rGroup) {
            if ([...mGroups][0] !== rGroup && score <= 0.95) dominated = true;
          }

          // Already-covered check
          if (!dominated && reqAlreadyCovered.get(reqId) && score <= 0.95) dominated = true;

          // Keyword pre-screen
          if (!dominated && !keywordOverlap(modelPath, reqText)) dominated = true;

          if (!dominated) {
            methodCandidates.push({
              model: modelPath,
              requirement: reqId,
              proximity_score: Math.round(score * 10000) / 10000,
              source: 'ensemble',
              scoring_method: method,
            });
          }
        }
      }

      // Apply diversity round-robin within this method's candidates too
      methodCandidates.sort((a, b) => b.proximity_score - a.proximity_score);
      const perMethodLimit = 20; // generous: --top controls final output size
      const byModel = new Map();
      for (const c of methodCandidates) {
        if (!byModel.has(c.model)) byModel.set(c.model, []);
        byModel.get(c.model).push(c);
      }
      const modelGrps = [...byModel.entries()].sort((a, b) => b[1][0].proximity_score - a[1][0].proximity_score);
      const selected = [];
      const cursors = new Map(modelGrps.map(([m]) => [m, 0]));
      while (selected.length < perMethodLimit) {
        let picked = false;
        for (const [model, group] of modelGrps) {
          if (selected.length >= perMethodLimit) break;
          const idx = cursors.get(model);
          if (idx < group.length) {
            const c = group[idx];
            if (!existingPairs.has(`${c.model}|${c.requirement}`)) {
              selected.push(c);
              existingPairs.add(`${c.model}|${c.requirement}`);
            }
            cursors.set(model, idx + 1);
            picked = true;
          }
        }
        if (!picked) break;
      }
      secondaryCandidates.push(...selected);
    }

    // Merge secondary candidates into main list
    candidates.push(...secondaryCandidates);
    if (secondaryCandidates.length > 0) {
      process.stderr.write(`[candidate-discovery] Ensemble: added ${secondaryCandidates.length} candidates from ${methods.length - 1} secondary method(s)\n`);
    }
  }

  // Non-neighbor discovery: rank zero-path pairs by coverage-gap heuristic
  let orphanModels = [];
  let orphanReqs = [];
  if (nonNeighborTop > 0 && zeroPairs.length > 0) {
    // Pre-compute reqModelCount: Map<reqId, count of models that have this req in their requirements>
    const reqModelCount = new Map();
    for (const modelInfo of Object.values(modelRegistry.models || {})) {
      if (Array.isArray(modelInfo.requirements)) {
        for (const reqId of modelInfo.requirements) {
          reqModelCount.set(reqId, (reqModelCount.get(reqId) || 0) + 1);
        }
      }
    }

    // Compute priority for each zero pair
    const rankedPairs = [];
    for (const pair of zeroPairs) {
      // Check if this pair is already in candidates (shouldn't be, but defensive)
      const alreadyFound = candidates.some(c => c.model === pair.model && c.requirement === pair.requirement);
      if (alreadyFound) continue;

      // modelCoverage = linked reqs + BFS candidates already found for this model
      const modelInfo = modelRegistry.models[pair.model];
      const linkedCount = (modelInfo.requirements || []).length;
      const bfsCount = candidates.filter(c => c.model === pair.model).length;
      const modelCoverage = linkedCount + bfsCount;

      // reqCoverage = models linked to req + BFS candidates already found for this req
      const linkedModelCount = reqModelCount.get(pair.requirement) || 0;
      const bfsCandidateCount = candidates.filter(c => c.requirement === pair.requirement).length;
      const reqCoverage = linkedModelCount + bfsCandidateCount;

      // priority = 1/(modelCoverage+1) + 1/(reqCoverage+1)
      const priority = 1 / (modelCoverage + 1) + 1 / (reqCoverage + 1);
      rankedPairs.push({ ...pair, priority });
    }

    // Sort by priority descending and take top N
    rankedPairs.sort((a, b) => b.priority - a.priority);

    // Extract unique orphan models (models with 0 linked requirements)
    const orphanModelMap = new Map();
    for (const pair of rankedPairs) {
      const modelInfo = modelRegistry.models[pair.model];
      if ((modelInfo.requirements || []).length === 0) {
        orphanModelMap.set(pair.model, (orphanModelMap.get(pair.model) || 0) + 1);
      }
    }
    orphanModels = [...orphanModelMap.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, nonNeighborTop)
      .map(([p, count]) => ({ path: p, zeroPairCount: count }));

    // Extract unique orphan requirements (requirements with no formal_models coverage)
    const orphanReqMap = new Map();
    for (const pair of rankedPairs) {
      if (!reqAlreadyCovered.get(pair.requirement)) {
        orphanReqMap.set(pair.requirement, (orphanReqMap.get(pair.requirement) || 0) + 1);
      }
    }
    orphanReqs = [...orphanReqMap.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, nonNeighborTop)
      .map(([id, count]) => ({ id, zeroPairCount: count }));
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
      candidates_filtered: filteredCount,
      orphan_models_count: orphanModels.length,
      orphan_requirements_count: orphanReqs.length,
      non_neighbor_top: nonNeighborTop,
    },
    candidates,
    orphans: {
      models: orphanModels,
      requirements: orphanReqs,
    },
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// CLI
// ─────────────────────────────────────────────────────────────────────────────

function parseArgs(argv) {
  const args = { minScore: 0.6, maxHops: 5, nonNeighborTop: 20, top: null, json: false, help: false };
  for (let i = 2; i < argv.length; i++) {
    if (argv[i] === '--json') args.json = true;
    else if (argv[i] === '--help' || argv[i] === '-h') args.help = true;
    else if (argv[i].startsWith('--min-score')) {
      const val = argv[i].includes('=') ? argv[i].split('=')[1] : argv[++i];
      args.minScore = parseFloat(val);
    } else if (argv[i].startsWith('--max-hops')) {
      const val = argv[i].includes('=') ? argv[i].split('=')[1] : argv[++i];
      args.maxHops = parseInt(val, 10);
    } else if (argv[i].startsWith('--non-neighbor-top')) {
      const val = argv[i].includes('=') ? argv[i].split('=')[1] : argv[++i];
      args.nonNeighborTop = parseInt(val, 10);
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
  --min-score <n>        Minimum proximity score threshold (default: 0.6)
  --max-hops <n>         Maximum BFS hop count (default: 3)
  --non-neighbor-top <n> Include top N non-neighboring pairs by coverage gap (default: 20)
  --top <n>              Return only top N candidates by score (default: all)
  --json                 Print summary to stdout as JSON (for piping)
  --help                 Show this help message

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
    nonNeighborTop: args.nonNeighborTop,
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

  // Log orphan discovery counts
  if (result.orphans.models.length > 0 || result.orphans.requirements.length > 0) {
    process.stderr.write(`[candidate-discovery] Found ${result.orphans.models.length} orphan models, ${result.orphans.requirements.length} orphan requirements (limit ${result.metadata.non_neighbor_top})\n`);
  }

  // Log pre-filtered candidates
  if (result.metadata.candidates_filtered > 0) {
    process.stderr.write(`[candidate-discovery] Pre-filtered ${result.metadata.candidates_filtered} candidates (cross-domain, already-covered, or no keyword overlap)\n`);
  }

  // Apply --top N truncation with diversity-aware selection
  // Round-robin across models so no single model monopolizes the top-N slots.
  if (args.top != null && args.top > 0 && args.top < result.candidates.length) {
    const beforeCount = result.candidates.length;

    // Group candidates by model, preserving score order within each group
    const byModel = new Map();
    for (const c of result.candidates) {
      if (!byModel.has(c.model)) byModel.set(c.model, []);
      byModel.get(c.model).push(c);
    }

    // Sort model groups by their best candidate score (descending)
    const modelGroups = [...byModel.entries()]
      .sort((a, b) => b[1][0].proximity_score - a[1][0].proximity_score);

    // Round-robin pick: cycle through models, taking one candidate per pass
    const selected = [];
    const cursors = new Map(modelGroups.map(([m]) => [m, 0]));
    while (selected.length < args.top) {
      let picked = false;
      for (const [model, group] of modelGroups) {
        if (selected.length >= args.top) break;
        const idx = cursors.get(model);
        if (idx < group.length) {
          selected.push(group[idx]);
          cursors.set(model, idx + 1);
          picked = true;
        }
      }
      if (!picked) break; // all groups exhausted
    }

    result.candidates = selected;
    result.metadata.candidates_before_top = beforeCount;
    result.metadata.top = args.top;
    result.metadata.top_strategy = 'diversity_round_robin';
    result.metadata.models_represented = byModel.size;
    result.metadata.candidates_found = result.candidates.length;
    process.stderr.write(`[candidate-discovery] Showing top ${args.top} of ${beforeCount} candidates (round-robin across ${byModel.size} models)\n`);
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
