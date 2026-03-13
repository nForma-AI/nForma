#!/usr/bin/env node
'use strict';

/**
 * benchmark-32-combos.cjs
 *
 * Exhaustive benchmark of all 16 scoring method combinations (4 binary features)
 * with real Haiku semantic evaluation as ground truth.
 *
 * Process:
 * 1. For each of 16 combos, discover top-20 candidates using that scoring config
 * 2. Deduplicate candidates across all combos
 * 3. Evaluate each unique candidate with Haiku (via haiku-semantic-eval API)
 * 4. For each combo, report true-positive count among its top-20
 *
 * Usage:
 *   node bin/benchmark-32-combos.cjs                # run full benchmark
 *   node bin/benchmark-32-combos.cjs --top 10       # top-10 per combo
 *   node bin/benchmark-32-combos.cjs --dry-run      # show combos and candidate counts, skip Haiku
 *   node bin/benchmark-32-combos.cjs --cache         # reuse cached verdicts from previous run
 */

const fs = require('fs');
const path = require('path');
const https = require('https');

const FORMAL_DIR = path.join(process.cwd(), '.planning', 'formal');
const CACHE_PATH = path.join(FORMAL_DIR, 'benchmark-verdicts-cache.json');

// ─────────────────────────────────────────────────────────────────────────────
// Config: 4 binary features → 16 combinations
// ─────────────────────────────────────────────────────────────────────────────

const { proximity, EDGE_WEIGHTS, SEMANTIC_WEIGHTS } = require('./formal-proximity.cjs');

const FEATURES = [
  { name: 'sem', key: 'weights', on: 'SEMANTIC_WEIGHTS', off: 'EDGE_WEIGHTS' },
  { name: 'hub', key: 'hubDampen', on: true, off: false },
  { name: 'tfidf', key: 'tfidf', on: true, off: false },
  { name: 'cat', key: 'categoryBoost', on: true, off: false },
];

function generateCombos() {
  const combos = [];
  for (let mask = 0; mask < (1 << FEATURES.length); mask++) {
    const config = {};
    const nameParts = [];
    for (let i = 0; i < FEATURES.length; i++) {
      const f = FEATURES[i];
      const isOn = (mask >> i) & 1;
      if (f.key === 'weights') {
        config[f.key] = isOn ? SEMANTIC_WEIGHTS : EDGE_WEIGHTS;
      } else {
        config[f.key] = isOn ? f.on : f.off;
      }
      if (isOn) nameParts.push(f.name);
    }
    combos.push({
      name: nameParts.length > 0 ? nameParts.join('+') : 'baseline',
      config,
    });
  }
  return combos;
}

// ─────────────────────────────────────────────────────────────────────────────
// Candidate discovery (inline, method-aware)
// ─────────────────────────────────────────────────────────────────────────────

function discoverForCombo(pi, modelRegistry, requirements, comboConfig, topN, maxHops, threshold) {
  const modelPaths = Object.keys(modelRegistry.models || {});
  const reqIds = requirements.map(r => r.id);
  const candidates = [];

  for (const modelPath of modelPaths) {
    const modelInfo = modelRegistry.models[modelPath];
    const linkedReqs = new Set(modelInfo.requirements || []);
    const modelKey = `formal_model::${modelPath}`;

    for (const reqId of reqIds) {
      if (linkedReqs.has(reqId)) continue;

      const reqKey = `requirement::${reqId}`;
      const req = requirements.find(r => r.id === reqId);
      const reqText = req ? req.text : '';

      let score;
      try {
        // Pass combo config directly as method override
        score = proximity(pi, modelKey, reqKey, maxHops, {
          methodConfig: comboConfig,
          reqsData: requirements,
          reqText,
        });
      } catch {
        continue;
      }

      if (score != null && !isNaN(score) && score > threshold) {
        candidates.push({
          model: modelPath,
          requirement: reqId,
          proximity_score: Math.round(score * 10000) / 10000,
        });
      }
    }
  }

  // Sort by score desc, take top N
  candidates.sort((a, b) => b.proximity_score - a.proximity_score);
  return candidates.slice(0, topN);
}

// ─────────────────────────────────────────────────────────────────────────────
// Haiku API (same pattern as haiku-semantic-eval.cjs)
// ─────────────────────────────────────────────────────────────────────────────

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

function callHaikuAPI(apiKey, prompt, maxTokens) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: maxTokens,
      messages: [{ role: 'user', content: prompt }],
    });

    const req = https.request({
      hostname: 'api.anthropic.com',
      path: '/v1/messages',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'Content-Length': Buffer.byteLength(body),
      },
      timeout: 30000,
    }, (res) => {
      let data = '';
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => {
        if (res.statusCode === 429 || res.statusCode >= 500) {
          reject(Object.assign(new Error(`HTTP ${res.statusCode}`), { statusCode: res.statusCode }));
          return;
        }
        try {
          const parsed = JSON.parse(data);
          const text = ((parsed.content || [])[0] || {}).text || '';
          resolve(text);
        } catch (e) { reject(e); }
      });
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('timeout')); });
    req.write(body);
    req.end();
  });
}

function parseHaikuResponse(text) {
  if (!text || typeof text !== 'string') {
    return { verdict: 'maybe', confidence: 0.0, reasoning: 'empty response' };
  }
  // Try direct JSON
  try {
    const parsed = JSON.parse(text.trim());
    if (parsed && parsed.verdict) {
      const v = String(parsed.verdict).toLowerCase().trim();
      return {
        verdict: v === 'yes' ? 'yes' : v === 'no' ? 'no' : 'maybe',
        confidence: typeof parsed.confidence === 'number' ? parsed.confidence : 0.5,
        reasoning: parsed.reasoning || '',
      };
    }
  } catch { /* fall through */ }
  // Try markdown fence
  const fenceMatch = text.match(/```(?:json)?\s*\n?([\s\S]*?)```/);
  if (fenceMatch) {
    try {
      const parsed = JSON.parse(fenceMatch[1].trim());
      if (parsed && parsed.verdict) {
        const v = String(parsed.verdict).toLowerCase().trim();
        return {
          verdict: v === 'yes' ? 'yes' : v === 'no' ? 'no' : 'maybe',
          confidence: typeof parsed.confidence === 'number' ? parsed.confidence : 0.5,
          reasoning: parsed.reasoning || '',
        };
      }
    } catch { /* fall through */ }
  }
  return { verdict: 'maybe', confidence: 0.0, reasoning: `unparseable: ${text.slice(0, 100)}` };
}

async function evaluateCandidate(apiKey, model, requirement, reqText) {
  const prompt = `You are evaluating whether a formal model semantically satisfies a requirement.
Model path: ${model}
Requirement ID: ${requirement}
Requirement text: ${reqText}
Does this model address the intent of this requirement? Consider both direct coverage and transitive coverage through related models.
Respond ONLY with valid JSON: {"verdict":"yes"|"no"|"maybe","confidence":0.0-1.0,"reasoning":"..."}
Note: confidence MUST be a decimal between 0.0 and 1.0 (NOT 0-100).`;

  let retries = 0;
  while (retries < 3) {
    try {
      const text = await callHaikuAPI(apiKey, prompt, 200);
      return parseHaikuResponse(text);
    } catch (err) {
      retries++;
      const delay = Math.pow(2, retries) * 1000;
      process.stderr.write(`[benchmark] WARN: ${err.message} on ${model} <-> ${requirement}, retry ${retries}/3 in ${delay}ms\n`);
      await sleep(delay);
    }
  }
  return { verdict: 'maybe', confidence: 0.0, reasoning: 'evaluation failed after retries' };
}

// ─────────────────────────────────────────────────────────────────────────────
// Main
// ─────────────────────────────────────────────────────────────────────────────

async function main() {
  const args = process.argv.slice(2);
  const topN = parseInt(args.find((a, i, arr) => arr[i - 1] === '--top') || '20', 10);
  const maxHops = parseInt(args.find((a, i, arr) => arr[i - 1] === '--max-hops') || '5', 10);
  const threshold = parseFloat(args.find((a, i, arr) => arr[i - 1] === '--threshold') || '0.3');
  const dryRun = args.includes('--dry-run');
  const useCache = args.includes('--cache');

  // Load data
  const pi = JSON.parse(fs.readFileSync(path.join(FORMAL_DIR, 'proximity-index.json'), 'utf8'));
  const modelRegistry = JSON.parse(fs.readFileSync(path.join(FORMAL_DIR, 'model-registry.json'), 'utf8'));
  const reqsData = JSON.parse(fs.readFileSync(path.join(FORMAL_DIR, 'requirements.json'), 'utf8')).requirements;

  const combos = generateCombos();
  console.log(`Benchmarking ${combos.length} scoring combinations (top-${topN}, threshold=${threshold}, maxHops=${maxHops})`);
  console.log('');

  // Step 1: Discover candidates for each combo
  const comboResults = new Map(); // combo.name -> candidate[]
  const allCandidatesMap = new Map(); // "model|requirement" -> { model, requirement }

  for (const combo of combos) {
    process.stderr.write(`[benchmark] Discovering candidates for ${combo.name}...\n`);
    const candidates = discoverForCombo(pi, modelRegistry, reqsData, combo.config, topN, maxHops, threshold);
    comboResults.set(combo.name, candidates);

    for (const c of candidates) {
      const key = `${c.model}|${c.requirement}`;
      if (!allCandidatesMap.has(key)) {
        allCandidatesMap.set(key, { model: c.model, requirement: c.requirement });
      }
    }
  }

  const uniqueCandidates = [...allCandidatesMap.values()];
  console.log(`Unique candidates across all combos: ${uniqueCandidates.length}`);
  console.log('');

  // Show per-combo candidate counts
  console.log('Combo candidate counts:');
  for (const combo of combos) {
    const cands = comboResults.get(combo.name);
    const scoreRange = cands.length > 0
      ? `${cands[cands.length - 1].proximity_score.toFixed(4)}-${cands[0].proximity_score.toFixed(4)}`
      : 'n/a';
    console.log(`  ${combo.name.padEnd(22)} ${String(cands.length).padStart(3)} candidates  (score: ${scoreRange})`);
  }
  console.log('');

  if (dryRun) {
    console.log('[dry-run] Skipping Haiku evaluation.');
    return;
  }

  // Step 2: Evaluate with Haiku (or load cache)
  let verdictCache = {};
  if (useCache) {
    try {
      verdictCache = JSON.parse(fs.readFileSync(CACHE_PATH, 'utf8'));
      console.log(`Loaded ${Object.keys(verdictCache).length} cached verdicts.`);
    } catch { /* no cache */ }
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    console.error('ERROR: ANTHROPIC_API_KEY not set. Run with --dry-run to skip evaluation.');
    process.exit(1);
  }

  const toEvaluate = uniqueCandidates.filter(c => !verdictCache[`${c.model}|${c.requirement}`]);
  console.log(`Evaluating ${toEvaluate.length} candidates with Haiku (${Object.keys(verdictCache).length} cached)...`);

  let evaluated = 0;
  for (const c of toEvaluate) {
    const req = reqsData.find(r => r.id === c.requirement);
    const reqText = req ? req.text : '';
    const result = await evaluateCandidate(apiKey, c.model, c.requirement, reqText);
    verdictCache[`${c.model}|${c.requirement}`] = result;
    evaluated++;
    if (evaluated % 10 === 0) {
      process.stderr.write(`[benchmark] Evaluated ${evaluated}/${toEvaluate.length}\n`);
      // Save intermediate cache
      fs.writeFileSync(CACHE_PATH, JSON.stringify(verdictCache, null, 2));
    }
  }

  // Final cache save
  fs.writeFileSync(CACHE_PATH, JSON.stringify(verdictCache, null, 2));
  console.log(`Evaluation complete. Total verdicts: ${Object.keys(verdictCache).length}`);
  console.log('');

  // Step 3: Score each combo by true-positive rate
  const results = [];
  for (const combo of combos) {
    const cands = comboResults.get(combo.name);
    let yesCount = 0, noCount = 0, maybeCount = 0;
    for (const c of cands) {
      const key = `${c.model}|${c.requirement}`;
      const verdict = verdictCache[key];
      if (!verdict) continue;
      if (verdict.verdict === 'yes') yesCount++;
      else if (verdict.verdict === 'no') noCount++;
      else maybeCount++;
    }
    const total = cands.length;
    const precision = total > 0 ? ((yesCount + maybeCount * 0.5) / total * 100).toFixed(1) : '0.0';
    const truePositiveRate = total > 0 ? (yesCount / total * 100).toFixed(1) : '0.0';
    results.push({
      name: combo.name,
      total,
      yes: yesCount,
      no: noCount,
      maybe: maybeCount,
      truePositiveRate,
      precision,
    });
  }

  // Sort by yes count desc, then by (yes+maybe) desc
  results.sort((a, b) => {
    if (b.yes !== a.yes) return b.yes - a.yes;
    return (b.yes + b.maybe) - (a.yes + a.maybe);
  });

  // Print results table
  console.log('combo                   total  yes   no  maybe  TP_rate  precision');
  console.log('──────────────────────  ─────  ───  ───  ─────  ───────  ─────────');
  for (const r of results) {
    console.log(
      r.name.padEnd(22) + '  ' +
      String(r.total).padStart(5) + '  ' +
      String(r.yes).padStart(3) + '  ' +
      String(r.no).padStart(3) + '  ' +
      String(r.maybe).padStart(5) + '  ' +
      (r.truePositiveRate + '%').padStart(7) + '  ' +
      (r.precision + '%').padStart(9)
    );
  }

  console.log('');
  const best = results[0];
  console.log(`Best combo: "${best.name}" (${best.yes} true positives out of ${best.total}, TP rate: ${best.truePositiveRate}%)`);
}

main().catch(err => {
  console.error('Fatal:', err);
  process.exit(1);
});
