#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const { spawnSync, execFileSync } = require('child_process');
const os = require('os');

const crypto = require('crypto');

const ROOT = process.cwd();
const SPEC_DIR = path.join(ROOT, '.planning', 'formal', 'spec');
const INDEX_PATH = path.join(ROOT, '.planning', 'formal', 'proximity-index.json');
const REGISTRY_PATH = path.join(ROOT, '.planning', 'formal', 'model-registry.json');
const BUG_GAPS_PATH = path.join(ROOT, '.planning', 'formal', 'bug-model-gaps.json');

function printHelp() {
  console.log(`Usage: node bin/formal-scope-scan.cjs --description "text" [options]

Options:
  --description "text"   Description to match against (required)
  --files file1,file2    Source files to check for overlap (optional)
  --format json|lines    Output format (default: json)
  --bug-mode             Bug-mode: match against model-registry.json with
                         formalism type and requirement coverage in output
  --persist-gap          With --bug-mode: persist lookup result to
                         bug-model-gaps.json for cross-session tracking
  --run-checkers         With --bug-mode: run matched model checkers
                         (TLC for TLA+, Alloy for .als) with 60s timeout
                         per model, max 3 models. Reports pass/fail/timeout
                         with counterexample traces when available.
  --help                 Show this help message
  --l3-threshold N       Cosine similarity threshold for Layer 3 (default: 0.35)
  --no-l3                Disable Layer 3 semantic fallback
  --l4                   Enable Layer 4 agentic fallback (disabled by default; slow/expensive)

Matching algorithm (layered — proximity index enriches scope.json matching):
  Layer 1 (scope.json — always runs):
    1. Source file overlap: --files matched against module source_files globs
    2. Concept matching: exact token match against curated concepts
    3. Module name match: exact token match against module directory name
  Layer 2 (proximity index — when proximity-index.json exists):
    4. Graph walk from --files code_file nodes to formal_module neighbors
    5. Enriches each match with: affected invariants, constants, requirements, proximity score
Layer 3 (semantic — @huggingface/transformers, runs when layers 1+2 return 0 matches):
  Computes cosine similarity between query and module concept text.
  Modules above threshold returned with matched_by: "semantic".
Layer 4 (agentic — claude CLI sub-agent, runs when layers 1+2+3 return 0 matches):
  Spawns claude CLI to search spec directories. Requires --l4 flag to enable.
  Returns matched_by: "agentic". Skips silently if claude CLI unavailable.

Bug-mode matching (--bug-mode):
  Scans model-registry.json entries using semantic/concept scoring:
    - Tokenizes bug description and matches against model path names
    - Scores requirement category prefix matches (e.g., "DETECT" in bug
      matches model with DETECT-01)
    - Returns formalism type (tla/alloy) and requirement coverage per match
    - Falls back to standard mode if model-registry.json is missing

Examples:
  node bin/formal-scope-scan.cjs --description "fix quorum deliberation bug"
  node bin/formal-scope-scan.cjs --description "update breaker" --format lines
  node bin/formal-scope-scan.cjs --files "hooks/nf-stop.js" --description "something"
  node bin/formal-scope-scan.cjs --bug-mode --description "circuit breaker timeout"
  node bin/formal-scope-scan.cjs --bug-mode --persist-gap --description "test bug"
  node bin/formal-scope-scan.cjs --bug-mode --run-checkers --description "breaker timeout"
`);
}

function parseArgs(argv) {
  const args = { description: '', files: [], format: 'json', help: false, bugMode: false, persistGap: false, runCheckers: false, l3Threshold: 0.35, noL3: false, l4: false };
  for (let i = 2; i < argv.length; i++) {
    if (argv[i] === '--help' || argv[i] === '-h') {
      args.help = true;
    } else if (argv[i] === '--description' && argv[i + 1]) {
      args.description = argv[++i];
    } else if (argv[i] === '--files' && argv[i + 1]) {
      args.files = argv[++i].split(',').map(f => f.trim()).filter(Boolean);
    } else if (argv[i] === '--format' && argv[i + 1]) {
      args.format = argv[++i];
    } else if (argv[i] === '--bug-mode') {
      args.bugMode = true;
    } else if (argv[i] === '--persist-gap') {
      args.persistGap = true;
    } else if (argv[i] === '--run-checkers') {
      args.runCheckers = true;
    } else if (argv[i] === '--l3-threshold' && argv[i + 1]) {
      args.l3Threshold = parseFloat(argv[++i]);
    } else if (argv[i] === '--no-l3') {
      args.noL3 = true;
    } else if (argv[i] === '--l4') {
      args.l4 = true;
    }
  }
  return args;
}

function globToRegex(glob) {
  let regex = '';
  let i = 0;
  while (i < glob.length) {
    if (glob[i] === '*' && glob[i + 1] === '*') {
      regex += '.*';
      i += 2;
      if (glob[i] === '/') i++; // skip trailing slash after **
    } else if (glob[i] === '*') {
      regex += '[^/]*';
      i++;
    } else if (glob[i] === '?') {
      regex += '[^/]';
      i++;
    } else if ('.+^${}()|[]\\'.includes(glob[i])) {
      regex += '\\' + glob[i];
      i++;
    } else {
      regex += glob[i];
      i++;
    }
  }
  return new RegExp('^' + regex + '$');
}

function matchesSourceFiles(providedFiles, moduleSourceFiles) {
  for (const pf of providedFiles) {
    for (const sf of moduleSourceFiles) {
      const re = globToRegex(sf);
      if (re.test(pf)) return true;
    }
  }
  return false;
}

function matchesConcepts(descLower, tokens, concepts) {
  for (const concept of concepts) {
    const conceptLower = concept.toLowerCase();
    // Exact token match
    if (tokens.includes(conceptLower)) return true;
    // Multi-word concept substring match against raw description
    if (conceptLower.includes('-') || conceptLower.includes(' ')) {
      if (descLower.includes(conceptLower)) return true;
    }
  }
  return false;
}

function matchesModuleName(tokens, moduleName) {
  return tokens.includes(moduleName.toLowerCase());
}

// ── Proximity Index Layer ─────────────────────────────────────────────────────

/**
 * Load the proximity index. Returns null if unavailable (fail-open).
 */
function loadProximityIndex() {
  try {
    if (!fs.existsSync(INDEX_PATH)) return null;
    return JSON.parse(fs.readFileSync(INDEX_PATH, 'utf8'));
  } catch (e) {
    process.stderr.write('Warning: Failed to load proximity-index.json: ' + e.message + '\n');
    return null;
  }
}

/**
 * BFS reach from a node, up to maxDepth hops, filtered by type.
 */
function reachFiltered(index, startKey, maxDepth, typeFilter) {
  const results = [];
  const visited = new Set([startKey]);
  let frontier = [{ key: startKey, depth: 0 }];

  while (frontier.length > 0) {
    const nextFrontier = [];
    for (const { key, depth } of frontier) {
      if (depth >= maxDepth) continue;
      const node = index.nodes[key];
      if (!node) continue;
      for (const edge of node.edges) {
        if (visited.has(edge.to)) continue;
        visited.add(edge.to);
        const target = index.nodes[edge.to];
        if (!target) continue;
        const d = depth + 1;
        if (typeFilter.includes(target.type)) {
          results.push({ key: edge.to, type: target.type, rel: edge.rel, depth: d });
        }
        nextFrontier.push({ key: edge.to, depth: d });
      }
    }
    frontier = nextFrontier;
  }

  return results;
}

/**
 * Compute proximity score between two nodes using edge weights and decay.
 * Uses BFS with weighted propagation — first path found (shortest) wins.
 */
function proximityScore(index, fromKey, toKey) {
  const EDGE_WEIGHTS = {
    owns: 1.0, owned_by: 1.0,
    contains: 1.0, in_file: 1.0,
    emits: 0.9, emitted_by: 0.9,
    maps_to: 0.9, mapped_from: 0.9,
    declared_in: 0.9,
    modeled_by: 0.8, models: 0.8,
    declares: 0.8, declared_by: 0.8,
    verified_by: 0.8, verifies: 0.8,
    tested_by: 0.7, tests: 0.7,
    triggers: 0.7, triggered_by: 0.7,
    transitions: 0.6,
    describes: 0.5, described_by: 0.5,
    constrains: 0.5, constrained_by: 0.5,
    scores: 0.4, scored_by: 0.4,
    affects: 0.4, affected_by: 0.4
  };
  const DECAY = 0.7;

  if (fromKey === toKey) return 1.0;
  const visited = new Set([fromKey]);
  const queue = [{ key: fromKey, score: 1.0 }];

  while (queue.length > 0) {
    const { key, score } = queue.shift();
    const node = index.nodes[key];
    if (!node) continue;

    for (const edge of node.edges) {
      if (visited.has(edge.to)) continue;
      visited.add(edge.to);
      const edgeWeight = EDGE_WEIGHTS[edge.rel] || 0.3;
      const nextScore = score * edgeWeight * DECAY;
      if (edge.to === toKey) return nextScore;
      if (nextScore > 0.01) {
        queue.push({ key: edge.to, score: nextScore });
      }
    }
  }

  return 0;
}

/**
 * Enrich scope-scan matches with proximity index data.
 * Also discovers modules missed by token matching via graph walks from --files.
 */
function enrichWithProximityIndex(matches, files, tokens) {
  const index = loadProximityIndex();
  if (!index || !index.nodes) return matches;

  const matchedModules = new Set(matches.map(m => m.module));

  // Walk from provided --files to discover formal_modules via graph
  if (files.length > 0) {
    for (const file of files) {
      const fileKey = 'code_file::' + file;
      if (!index.nodes[fileKey]) continue;

      const reachable = reachFiltered(index, fileKey, 2, ['formal_module']);
      for (const r of reachable) {
        const modName = r.key.replace('formal_module::', '');
        if (!matchedModules.has(modName)) {
          matchedModules.add(modName);
          const invariantsPath = '.planning/formal/spec/' + modName + '/invariants.md';
          matches.push({ module: modName, path: invariantsPath, matched_by: 'proximity_graph' });
        }
      }
    }
  }

  // Enrich each match with proximity data
  for (const match of matches) {
    const moduleKey = 'formal_module::' + match.module;
    if (!index.nodes[moduleKey]) continue;

    // Find affected invariants (depth 2)
    const invariants = reachFiltered(index, moduleKey, 2, ['invariant']);
    if (invariants.length > 0) {
      match.invariants = invariants.map(inv => inv.key.replace('invariant::', ''));
    }

    // Find affected requirements (depth 3)
    const requirements = reachFiltered(index, moduleKey, 3, ['requirement']);
    if (requirements.length > 0) {
      match.requirements = requirements.map(req => req.key.replace('requirement::', ''));
    }

    // Find constants at risk (depth 2)
    const constants = reachFiltered(index, moduleKey, 2, ['constant']);
    if (constants.length > 0) {
      const enrichedConstants = [];
      for (const c of constants) {
        const cNode = index.nodes[c.key];
        if (cNode && cNode.formal_value !== undefined) {
          enrichedConstants.push({ name: c.key.replace('constant::', ''), formal_value: cNode.formal_value });
        }
      }
      if (enrichedConstants.length > 0) match.constants = enrichedConstants;
    }

    // Compute proximity score from each --file to this module
    if (files.length > 0) {
      let maxScore = 0;
      for (const file of files) {
        const fileKey = 'code_file::' + file;
        if (!index.nodes[fileKey]) continue;
        const score = proximityScore(index, fileKey, moduleKey);
        if (score > maxScore) maxScore = score;
      }
      if (maxScore > 0) {
        match.proximity_score = Math.round(maxScore * 1000) / 1000;
      }
    }
  }

  // Sort: direct matches first (source_file > concept > module_name > proximity_graph), then by score
  matches.sort((a, b) => {
    const weights = { source_file: 3, concept: 2, module_name: 1, proximity_graph: 0 };
    const aWeight = weights[a.matched_by] || 0;
    const bWeight = weights[b.matched_by] || 0;
    if (aWeight !== bWeight) return bWeight - aWeight;
    return (b.proximity_score || 0) - (a.proximity_score || 0);
  });

  return matches;
}

// ── Bug-Mode Layer ──────────────────────────────────────────────────────────

/**
 * Load model-registry.json. Returns null if unavailable (fail-open).
 */
function loadModelRegistry(registryPath) {
  const p = registryPath || REGISTRY_PATH;
  try {
    if (!fs.existsSync(p)) return null;
    return JSON.parse(fs.readFileSync(p, 'utf8'));
  } catch (e) {
    process.stderr.write('Warning: Failed to load model-registry.json: ' + e.message + '\n');
    return null;
  }
}

/**
 * Derive formalism type from model path key (e.g., ".planning/formal/tla/X.tla" -> "tla").
 */
function deriveFormalism(modelKey) {
  if (modelKey.endsWith('.tla')) return 'tla';
  if (modelKey.endsWith('.als')) return 'alloy';
  return 'unknown';
}

/**
 * Score concept match between a bug description and model metadata.
 * Tokenizes description, matches against model path name tokens and requirement category prefixes.
 */
function scoreConceptMatch(bugDescription, modelKey, modelMetadata) {
  const tokens = bugDescription.toLowerCase().split(/\s+/).filter(t => t.length > 2);
  if (tokens.length === 0) return 0;
  let score = 0;

  // Extract descriptive tokens from model key path (e.g., "NFCircuitBreaker.tla" -> ["nfcircuitbreaker"])
  // Also split camelCase/PascalCase into individual words
  const baseName = path.basename(modelKey).replace(/\.(tla|als)$/, '');
  const modelNameTokens = baseName
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2')
    .toLowerCase()
    .split(/[\s\-_]+/)
    .filter(t => t.length > 2);

  // Score model description tokens
  if (modelMetadata.description) {
    const descTokens = modelMetadata.description.toLowerCase().split(/\s+/).filter(t => t.length > 2);
    for (const modelToken of descTokens) {
      if (tokens.includes(modelToken)) score += 0.1;
    }
  }

  // Score model name tokens
  for (const modelToken of modelNameTokens) {
    if (tokens.some(t => t === modelToken || modelToken.includes(t) || t.includes(modelToken))) {
      score += 0.1;
    }
  }

  // Score requirement category prefix matches (e.g., "DETECT" from "DETECT-01")
  for (const req of (modelMetadata.requirements || [])) {
    const category = req.split('-')[0].toLowerCase();
    if (category.length > 2 && tokens.some(t => category.includes(t) || t.includes(category))) {
      score += 0.2;
    }
  }

  return Math.min(score, 1.0);
}

/**
 * Run bug-mode matching: scan model-registry.json entries, score by concept match,
 * enrich with formalism type and requirement coverage.
 */
function runBugModeMatching(description, files, registryPath) {
  const registry = loadModelRegistry(registryPath);
  if (!registry || !registry.models) {
    process.stderr.write('Warning: model-registry.json not available, falling back to standard mode\n');
    return null; // signal caller to fall back
  }

  const matches = [];
  for (const [modelKey, modelMeta] of Object.entries(registry.models)) {
    const relevanceScore = scoreConceptMatch(description, modelKey, modelMeta);
    if (relevanceScore > 0) {
      matches.push({
        model: modelKey,
        path: modelKey,
        matched_by: 'bug_pattern',
        formalism: deriveFormalism(modelKey),
        requirement_coverage: modelMeta.requirements || [],
        bug_relevance_score: Math.round(relevanceScore * 1000) / 1000
      });
    }
  }

  // Rank by bug_relevance_score descending
  matches.sort((a, b) => b.bug_relevance_score - a.bug_relevance_score);

  return matches;
}

// ── Bug-Model Gaps Persistence ──────────────────────────────────────────────

/**
 * Generate a deterministic bug ID from description.
 */
function hashBugId(description) {
  return crypto.createHash('sha256').update(description).digest('hex').slice(0, 8);
}

/**
 * Load bug-model-gaps.json. Returns default structure if missing.
 */
function loadBugModelGaps(gapsPath) {
  const p = gapsPath || BUG_GAPS_PATH;
  try {
    if (!fs.existsSync(p)) return { version: '1.0', entries: [] };
    return JSON.parse(fs.readFileSync(p, 'utf8'));
  } catch (e) {
    process.stderr.write('Warning: Failed to load bug-model-gaps.json: ' + e.message + '\n');
    return { version: '1.0', entries: [] };
  }
}

/**
 * Save bug-model-gaps.json to disk.
 */
function saveBugModelGaps(data, gapsPath) {
  const p = gapsPath || BUG_GAPS_PATH;
  const dir = path.dirname(p);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  fs.writeFileSync(p, JSON.stringify(data, null, 2) + '\n', 'utf8');
}

/**
 * Persist a bug-mode lookup result to bug-model-gaps.json.
 * Deduplicates by exact description match.
 */
function persistBugGap(description, matches, gapsPath) {
  const data = loadBugModelGaps(gapsPath);
  const bugId = hashBugId(description);
  const timestamp = new Date().toISOString();
  const matchedModels = matches.map(m => m.model || m.path);
  const status = matchedModels.length > 0 ? 'no_reproduction' : 'no_coverage';

  // Check for existing entry with same description (dedup)
  const existingIdx = data.entries.findIndex(e => e.description === description);
  if (existingIdx >= 0) {
    // Update existing entry
    data.entries[existingIdx].timestamp = timestamp;
    data.entries[existingIdx].matched_models = matchedModels;
    data.entries[existingIdx].status = status;
  } else {
    // Append new entry
    data.entries.push({
      bug_id: bugId,
      description,
      timestamp,
      status,
      matched_models: matchedModels,
      checked_models: [],
      session_id: null
    });
  }

  saveBugModelGaps(data, gapsPath);
  return data;
}

/**
 * Persist a bug-mode lookup result with checker results to bug-model-gaps.json.
 * Updates status based on checker outcomes:
 *   - "reproduced" if any checker result is "fail"
 *   - "no_reproduction" if all checkers pass or timeout
 *   - "no_coverage" if no models matched
 */
function persistBugGapWithCheckers(description, matches, gapsPath) {
  const data = loadBugModelGaps(gapsPath);
  const bugId = hashBugId(description);
  const timestamp = new Date().toISOString();
  const matchedModels = matches.map(m => m.model || m.path);

  // Determine status from checker results
  let status;
  if (matchedModels.length === 0) {
    status = 'no_coverage';
  } else {
    const anyFail = matches.some(m => m.checker_result === 'fail');
    status = anyFail ? 'reproduced' : 'no_reproduction';
  }

  // Build checked_models array from enriched matches
  const checkedModels = matches
    .filter(m => m.checker_result)
    .map(m => ({
      model: m.model,
      formalism: m.formalism,
      result: m.checker_result,
      trace: m.checker_trace || null,
      runtime_ms: m.checker_runtime_ms || 0
    }));

  // Dedup by description
  const existingIdx = data.entries.findIndex(e => e.description === description);
  if (existingIdx >= 0) {
    data.entries[existingIdx].timestamp = timestamp;
    data.entries[existingIdx].matched_models = matchedModels;
    data.entries[existingIdx].status = status;
    data.entries[existingIdx].checked_models = checkedModels;
  } else {
    data.entries.push({
      bug_id: bugId,
      description,
      timestamp,
      status,
      matched_models: matchedModels,
      checked_models: checkedModels,
      session_id: null
    });
  }

  saveBugModelGaps(data, gapsPath);
  return data;
}

// ── Model Checker Execution ─────────────────────────────────────────────────

/**
 * Find MC config file for a TLA+ spec by scanning .cfg files for module name references.
 * @param {string} specPath - Model key path (e.g., ".planning/formal/tla/NFCircuitBreaker.tla")
 * @param {string} [projectRoot] - Project root directory
 * @returns {string|null} Config name (e.g., "MCsafety") or null if not found
 */
function findTlcConfig(specPath, projectRoot) {
  const root = projectRoot || ROOT;
  const tlaDir = path.join(root, '.planning', 'formal', 'tla');
  const specBaseName = path.basename(specPath, '.tla');

  try {
    if (!fs.existsSync(tlaDir)) return null;
    const cfgFiles = fs.readdirSync(tlaDir).filter(f => f.startsWith('MC') && f.endsWith('.cfg'));

    for (const cfgFile of cfgFiles) {
      const cfgContent = fs.readFileSync(path.join(tlaDir, cfgFile), 'utf8');
      // Check if cfg references this spec module (in header comments or SPECIFICATION line)
      if (cfgContent.includes(specBaseName)) {
        return cfgFile.replace('.cfg', '');
      }
    }

    // Fallback: try naming convention MC + stripped spec name
    const stripped = specBaseName.replace(/^NF/, '').replace(/^QGSD/, '');
    const conventionName = 'MC' + stripped;
    if (fs.existsSync(path.join(tlaDir, conventionName + '.cfg'))) {
      return conventionName;
    }

    return null;
  } catch (e) {
    process.stderr.write('Warning: Failed to scan TLC configs: ' + e.message + '\n');
    return null;
  }
}

/**
 * Run a single model checker and return the result.
 * @param {object} match - Match object with model, formalism fields
 * @param {number} timeoutMs - Timeout in milliseconds
 * @param {string} [projectRoot] - Project root directory
 * @returns {object} { model, formalism, result, trace, runtime_ms }
 */
function runSingleChecker(match, timeoutMs, projectRoot) {
  const root = projectRoot || ROOT;
  const startMs = Date.now();

  if (match.formalism === 'tla') {
    const configName = findTlcConfig(match.model, root);
    if (!configName) {
      return {
        model: match.model,
        formalism: 'tla',
        result: 'skipped',
        trace: null,
        runtime_ms: Date.now() - startMs,
        reason: 'No MC config file found for ' + match.model
      };
    }

    const result = spawnSync('node', [
      path.join(root, 'bin', 'run-tlc.cjs'),
      configName,
      '--project-root=' + root
    ], { encoding: 'utf8', timeout: timeoutMs, stdio: 'pipe' });

    const runtimeMs = Date.now() - startMs;

    // Timeout detection
    if (result.status === null && result.signal === 'SIGTERM') {
      return { model: match.model, formalism: 'tla', result: 'timeout', trace: null, runtime_ms: runtimeMs };
    }

    // Check for error/spawn failure (e.g., Java not installed)
    if (result.error) {
      return {
        model: match.model,
        formalism: 'tla',
        result: 'skipped',
        trace: null,
        runtime_ms: runtimeMs,
        reason: result.error.message
      };
    }

    const combined = (result.stdout || '') + (result.stderr || '');

    // Detect invariant violations or assertion failures
    if (result.status !== 0 || /Invariant\s+\S+\s+is violated/i.test(combined) || /Assertion\s+\S+\s+may be violated/i.test(combined)) {
      // Extract counterexample trace
      let trace = null;
      const traceMatch = combined.match(/Error:[\s\S]*?(?=Finished|$)/);
      if (traceMatch) trace = traceMatch[0].trim();
      return { model: match.model, formalism: 'tla', result: 'fail', trace, runtime_ms: runtimeMs };
    }

    return { model: match.model, formalism: 'tla', result: 'pass', trace: null, runtime_ms: runtimeMs };

  } else if (match.formalism === 'alloy') {
    const specBaseName = path.basename(match.model, '.als');

    const result = spawnSync('node', [
      path.join(root, 'bin', 'run-alloy.cjs'),
      '--spec=' + specBaseName,
      '--project-root=' + root
    ], { encoding: 'utf8', timeout: timeoutMs, stdio: 'pipe' });

    const runtimeMs = Date.now() - startMs;

    // Timeout detection
    if (result.status === null && result.signal === 'SIGTERM') {
      return { model: match.model, formalism: 'alloy', result: 'timeout', trace: null, runtime_ms: runtimeMs };
    }

    // Check for error/spawn failure
    if (result.error) {
      return {
        model: match.model,
        formalism: 'alloy',
        result: 'skipped',
        trace: null,
        runtime_ms: runtimeMs,
        reason: result.error.message
      };
    }

    const combined = (result.stdout || '') + (result.stderr || '');

    // Alloy counterexample detection
    if (result.status !== 0 || /Counterexample/i.test(combined)) {
      let trace = null;
      const cexMatch = combined.match(/Counterexample[\s\S]*/i);
      if (cexMatch) trace = cexMatch[0].trim();
      return { model: match.model, formalism: 'alloy', result: 'fail', trace, runtime_ms: runtimeMs };
    }

    return { model: match.model, formalism: 'alloy', result: 'pass', trace: null, runtime_ms: runtimeMs };

  } else {
    return {
      model: match.model,
      formalism: match.formalism || 'unknown',
      result: 'skipped',
      trace: null,
      runtime_ms: Date.now() - startMs,
      reason: 'Unsupported formalism: ' + (match.formalism || 'unknown')
    };
  }
}

/**
 * Run model checkers on matched models.
 * @param {Array} matches - Array of bug-mode match objects
 * @param {number} [maxModels=3] - Maximum number of models to check
 * @param {number} [timeoutMs=60000] - Timeout per checker in milliseconds
 * @param {string} [projectRoot] - Project root directory
 * @returns {Array} Array of checker result objects
 */
function runModelCheckers(matches, maxModels, timeoutMs, projectRoot) {
  const max = maxModels || 3;
  const timeout = timeoutMs || 60000;
  const results = [];

  // Sort by bug_relevance_score descending (already sorted, but be defensive)
  const sorted = [...matches].sort((a, b) => (b.bug_relevance_score || 0) - (a.bug_relevance_score || 0));

  for (let i = 0; i < sorted.length; i++) {
    if (i >= max) {
      results.push({
        model: sorted[i].model,
        formalism: sorted[i].formalism,
        result: 'skipped',
        trace: null,
        runtime_ms: 0,
        reason: 'Exceeded max model limit (' + max + ')'
      });
      continue;
    }

    const checkerResult = runSingleChecker(sorted[i], timeout, projectRoot);
    results.push(checkerResult);
  }

  return results;
}

// ── Layer 3: Semantic Similarity ─────────────────────────────────────────────

/**
 * Cosine similarity — vectors are assumed to already be L2-normalized,
 * so dot product == cosine similarity.
 */
function cosineSim(a, b) {
  let dot = 0;
  for (let i = 0; i < a.length; i++) dot += a[i] * b[i];
  return dot;
}

/**
 * Resolve Claude CLI binary — not on PATH, lives at ~/.local/share/claude/versions/X.Y.Z
 */
function resolveClaudeCLI() {
  const versionsDir = path.join(os.homedir(), '.local', 'share', 'claude', 'versions');
  if (!fs.existsSync(versionsDir)) return 'claude';
  const versions = fs.readdirSync(versionsDir)
    .filter(f => /^\d+\.\d+\.\d+$/.test(f) && fs.statSync(path.join(versionsDir, f)).isFile())
    .sort((a, b) => {
      const ap = a.split('.').map(Number), bp = b.split('.').map(Number);
      for (let i = 0; i < 3; i++) { if (ap[i] !== bp[i]) return bp[i] - ap[i]; }
      return 0;
    });
  return versions.length > 0 ? path.join(versionsDir, versions[0]) : 'claude';
}

/**
 * Layer 3: Semantic similarity using @huggingface/transformers.
 * Runs only when layers 1+2 return 0 matches.
 * Gracefully skips (returns []) if the package is unavailable.
 * @param {string} query - Search description
 * @param {Array<{name: string, concepts: string[]}>} modules - Module list with concepts
 * @param {number} threshold - Cosine similarity threshold (default 0.35)
 * @returns {Promise<Array>}
 */
async function runSemanticLayer(query, modules, threshold) {
  let pipeline;
  try {
    const transformers = await import('@huggingface/transformers');
    pipeline = transformers.pipeline;
  } catch (_) {
    process.stderr.write('Warning: @huggingface/transformers not available, skipping Layer 3\n');
    return [];
  }

  const embedder = await pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2');
  const queryOutput = await embedder([query], { pooling: 'mean', normalize: true });
  const dim = queryOutput.dims[1];
  const queryVec = Array.from(queryOutput.data.slice(0, dim));

  const results = [];
  for (const mod of modules) {
    const conceptText = mod.concepts.join(' ');
    const modOutput = await embedder([conceptText], { pooling: 'mean', normalize: true });
    const modVec = Array.from(modOutput.data.slice(0, dim));
    const sim = cosineSim(queryVec, modVec);
    if (sim >= threshold) {
      results.push({
        module: mod.name,
        path: '.planning/formal/spec/' + mod.name + '/invariants.md',
        matched_by: 'semantic',
        similarity_score: Math.round(sim * 1000) / 1000
      });
    }
  }

  results.sort((a, b) => b.similarity_score - a.similarity_score);
  return results;
}

/**
 * Layer 4: Agentic search via claude CLI sub-agent.
 * Runs only when layers 1+2+3 return 0 matches AND --l4 is set.
 * @param {string} query - Search description
 * @param {string} specDir - Path to spec directory
 * @param {string} [claudeBin] - Optional claude binary override (for test injection)
 * @returns {Array}
 */
function runAgenticLayer(query, specDir, claudeBin) {
  const bin = claudeBin !== undefined ? claudeBin : resolveClaudeCLI();

  let availableModules;
  try {
    availableModules = fs.readdirSync(specDir).filter(f => fs.statSync(path.join(specDir, f)).isDirectory());
  } catch (_) {
    process.stderr.write('Warning: Layer 4 specDir not readable, skipping\n');
    return [];
  }

  const prompt = 'You are searching for formal specification modules that match a query.\n' +
    'Available modules: ' + availableModules.join(', ') + '\n\n' +
    'Query: ' + query + '\n\n' +
    'Return ONLY a JSON array of module names from the list above that are relevant, e.g. ["breaker", "quorum"].\n' +
    'If none match, return [].';

  const env = { ...process.env };
  delete env.CLAUDECODE;

  let stdout;
  try {
    stdout = execFileSync(bin, ['-p', prompt, '--output-format', 'json'], {
      encoding: 'utf8', timeout: 30000, cwd: ROOT, env, stdio: 'pipe'
    });
  } catch (e) {
    const msg = e.code === 'ENOENT'
      ? 'Warning: claude CLI not available, skipping Layer 4\n'
      : 'Warning: Layer 4 claude CLI timed out or failed, skipping\n';
    process.stderr.write(msg);
    return [];
  }

  let names = [];
  try {
    const outer = JSON.parse(stdout);
    const text = typeof outer.result === 'string' ? outer.result : stdout;
    try {
      names = JSON.parse(text);
    } catch (_) {
      const m = text.match(/\[[\s\S]*?\]/);
      if (m) names = JSON.parse(m[0]);
    }
    if (!Array.isArray(names)) names = [];
  } catch (_) {
    process.stderr.write('Warning: Layer 4 could not parse claude CLI output, skipping\n');
    return [];
  }

  // Hallucination guard: only return modules that exist in availableModules
  const validNames = names.filter(n => typeof n === 'string' && availableModules.includes(n));
  return validNames.map(name => ({
    module: name,
    path: '.planning/formal/spec/' + name + '/invariants.md',
    matched_by: 'agentic'
  }));
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  const args = parseArgs(process.argv);

  if (args.help) {
    printHelp();
    process.exit(0);
  }

  if (!args.description) {
    console.error('Error: --description is required');
    process.exit(1);
  }

  // --run-checkers requires --bug-mode
  if (args.runCheckers && !args.bugMode) {
    console.error('Error: --run-checkers requires --bug-mode');
    process.exit(1);
  }

  // Bug-mode: match against model-registry.json
  if (args.bugMode) {
    const bugMatches = runBugModeMatching(args.description, args.files);
    if (bugMatches !== null) {
      // Run model checkers if requested
      if (args.runCheckers && bugMatches.length > 0) {
        const checkerResults = runModelCheckers(bugMatches, 3, 60000);
        // Enrich matches with checker results
        for (const cr of checkerResults) {
          const match = bugMatches.find(m => m.model === cr.model);
          if (match) {
            match.checker_result = cr.result;
            match.checker_trace = cr.trace || null;
            match.checker_runtime_ms = cr.runtime_ms;
          }
        }
      } else if (args.runCheckers && bugMatches.length === 0) {
        // No matches to check — nothing to do
      }

      // Persist gap if requested
      if (args.persistGap) {
        if (args.runCheckers) {
          persistBugGapWithCheckers(args.description, bugMatches);
        } else {
          persistBugGap(args.description, bugMatches);
        }
      }

      if (args.format === 'lines') {
        for (const m of bugMatches) {
          const extra = m.checker_result ? '\t' + m.checker_result : '';
          console.log(m.model + '\t' + m.formalism + '\t' + m.bug_relevance_score + extra);
        }
      } else {
        console.log(JSON.stringify(bugMatches, null, 2));
      }
      process.exit(0);
    }
    // bugMatches === null means registry unavailable, fall through to standard mode
  }

  // Fail-open: if spec dir doesn't exist, output empty
  if (!fs.existsSync(SPEC_DIR)) {
    if (args.format === 'lines') {
      // no output
    } else {
      console.log('[]');
    }
    process.exit(0);
  }

  const descLower = args.description.toLowerCase();
  const tokens = descLower.split(/[\s\-_]+/).filter(t => t.length > 0);

  const modules = fs.readdirSync(SPEC_DIR, { withFileTypes: true })
    .filter(d => d.isDirectory())
    .map(d => d.name);

  const matches = [];

  for (const mod of modules) {
    const scopePath = path.join(SPEC_DIR, mod, 'scope.json');
    if (!fs.existsSync(scopePath)) {
      process.stderr.write('Warning: ' + scopePath + ' not found, skipping module ' + mod + '\n');
      continue;
    }

    let scope;
    try {
      scope = JSON.parse(fs.readFileSync(scopePath, 'utf8'));
    } catch (e) {
      process.stderr.write('Warning: Failed to parse ' + scopePath + ': ' + e.message + '\n');
      continue;
    }

    const invariantsPath = '.planning/formal/spec/' + mod + '/invariants.md';
    let matchedBy = null;

    // Priority 1: Source file overlap
    if (args.files.length > 0 && scope.source_files && matchesSourceFiles(args.files, scope.source_files)) {
      matchedBy = 'source_file';
    }

    // Priority 2: Concept matching
    if (!matchedBy && scope.concepts && matchesConcepts(descLower, tokens, scope.concepts)) {
      matchedBy = 'concept';
    }

    // Priority 3: Module name match (exact token only)
    if (!matchedBy && matchesModuleName(tokens, mod)) {
      matchedBy = 'module_name';
    }

    if (matchedBy) {
      matches.push({ module: mod, path: invariantsPath, matched_by: matchedBy });
    }
  }

  // Layer 2: Proximity index enrichment (fail-open)
  const enriched = enrichWithProximityIndex(matches, args.files, tokens);

  // Layer 3: Semantic similarity fallback (runs only when layers 1+2 return 0 matches)
  let finalMatches = enriched;
  if (enriched.length === 0 && !args.noL3) {
    const modulesForL3 = modules.map(mod => {
      const scopePath = path.join(SPEC_DIR, mod, 'scope.json');
      let concepts = [];
      try { concepts = JSON.parse(fs.readFileSync(scopePath, 'utf8')).concepts || []; } catch (_) {}
      return { name: mod, concepts };
    });
    const threshold = args.l3Threshold !== undefined ? args.l3Threshold : 0.35;
    finalMatches = await runSemanticLayer(args.description, modulesForL3, threshold);
  }

  // Layer 4: Agentic fallback (runs only when layers 1+2+3 return 0 matches, and --l4 is set)
  if (finalMatches.length === 0 && args.l4) {
    finalMatches = runAgenticLayer(args.description, SPEC_DIR);
  }

  if (args.format === 'lines') {
    for (const m of finalMatches) {
      console.log(m.module + '\t' + m.path);
    }
  } else {
    console.log(JSON.stringify(finalMatches, null, 2));
  }

  process.exit(0);
}

// Export internals for testing
if (typeof module !== 'undefined') {
  module.exports = {
    parseArgs,
    scoreConceptMatch,
    deriveFormalism,
    runBugModeMatching,
    loadModelRegistry,
    hashBugId,
    loadBugModelGaps,
    saveBugModelGaps,
    persistBugGap,
    persistBugGapWithCheckers,
    findTlcConfig,
    runSingleChecker,
    runModelCheckers,
    cosineSim,
    resolveClaudeCLI,
    runSemanticLayer,
    runAgenticLayer
  };
}

// Only run main when executed directly (not required as module)
if (require.main === module) {
  main().catch(e => { console.error(e); process.exit(1); });
}
