#!/usr/bin/env node
'use strict';

/**
 * update-scoreboard.cjs
 *
 * CLI script to update .planning/quorum-scoreboard.json atomically.
 * Reads current JSON, applies score delta for one model/round, recalculates
 * all cumulative stats from scratch, writes back.
 *
 * Usage (round vote):
 *   node bin/update-scoreboard.cjs \
 *     --model <name> --result <code> --task <label> --round <n> --verdict <v> \
 *     [--scoreboard <path>] [--category <cat>] [--subcategory <subcat>] \
 *     [--task-description <text>]
 *
 * Usage (team identity — once per session):
 *   node bin/update-scoreboard.cjs init-team \
 *     --claude-model <model-id> \
 *     --team '<json-object-of-agent-identities>' \
 *     [--scoreboard <path>]
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const os = require('os');

// ---------------------------------------------------------------------------
// Score delta lookup
// ---------------------------------------------------------------------------

const SCORE_DELTAS = {
  TP:      1,
  TN:      5,
  FP:     -3,
  FN:     -1,
  'TP+':   3,   // +1 TP effectiveness + +2 improvement bonus
  UNAVAIL: 0,
  '':      0,
};

const VALID_MODELS   = ['claude', 'gemini', 'opencode', 'copilot', 'codex', 'deepseek', 'minimax', 'qwen-coder', 'kimi', 'llama4'];
const VALID_RESULTS  = ['TP', 'TN', 'FP', 'FN', 'TP+', 'UNAVAIL', ''];
const VALID_VERDICTS = ['APPROVE', 'BLOCK', 'DELIBERATE', 'CONSENSUS', 'GAPS_FOUND', '—'];

// ---------------------------------------------------------------------------
// Argument parsing
// ---------------------------------------------------------------------------

function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i++) {
    const key = argv[i];
    if (key.startsWith('--')) {
      const name = key.slice(2);
      const value = argv[i + 1] !== undefined && !argv[i + 1].startsWith('--')
        ? argv[++i]
        : '';
      args[name] = value;
    }
  }
  return args;
}

// ---------------------------------------------------------------------------
// Usage / validation
// ---------------------------------------------------------------------------

const USAGE = `Usage: node bin/update-scoreboard.cjs --model <name> --result <code> --task <label> --round <n> --verdict <v> [--scoreboard <path>] [--category <cat>] [--subcategory <subcat>] [--task-description <text>]
  --model             claude | gemini | opencode | copilot | codex
  --result            TP | TN | FP | FN | TP+ | (empty for not scored)
  --task              task label, e.g. "quick-25"
  --round             round number (integer)
  --verdict           APPROVE | BLOCK | DELIBERATE | CONSENSUS | GAPS_FOUND | —
  --category          (optional) explicit parent category name
  --subcategory       (optional) explicit subcategory name
  --task-description  (optional) debate question/topic text; used by Haiku auto-classification when --category/--subcategory omitted
  --slot              slot name (e.g. claude-1) — use instead of --model for MCP server instances
  --model-id          full model id from health_check (e.g. "deepseek-ai/DeepSeek-V3") — required with --slot`;

function validate(args) {
  const errors = [];

  // --slot and --model are mutually exclusive
  if (args.slot && args.model) {
    errors.push('--slot and --model are mutually exclusive');
  } else if (args.slot) {
    // Slot mode: require --model-id
    if (!args['model-id']) errors.push('--model-id is required when using --slot');
  } else {
    // Model mode: require --model
    if (!args.model)   errors.push('--model is required');
  }
  if (!args.task)    errors.push('--task is required');
  if (!args.round)   errors.push('--round is required');
  if (!args.verdict) errors.push('--verdict is required');
  // --result can be empty string (not scored), but must be present as key
  if (!('result' in args)) errors.push('--result is required (use empty string for not scored)');

  if (args.model && !VALID_MODELS.includes(args.model)) {
    errors.push(`--model must be one of: ${VALID_MODELS.join(', ')}`);
  }

  const result = args.result || '';
  if (!VALID_RESULTS.includes(result)) {
    errors.push(`--result must be one of: TP, TN, FP, FN, TP+, (empty)`);
  }

  const roundNum = parseInt(args.round, 10);
  if (isNaN(roundNum) || roundNum < 1) {
    errors.push('--round must be a positive integer');
  }

  if (errors.length > 0) {
    process.stderr.write(USAGE + '\n\nErrors:\n' + errors.map(e => '  ' + e).join('\n') + '\n');
    process.exit(1);
  }

  return {
    model:           args.model,
    slot:            args.slot            || null,
    modelId:         args['model-id']     || null,
    result:          result,
    task:            args.task,
    round:           roundNum,
    verdict:         args.verdict,
    scoreboard:      args.scoreboard || '.planning/quorum-scoreboard.json',
    category:        args.category        || null,
    subcategory:     args.subcategory     || null,
    taskDescription: args['task-description'] || null,
  };
}

// ---------------------------------------------------------------------------
// JSON schema helpers
// ---------------------------------------------------------------------------

function emptyModelStats() {
  return { score: 0, tp: 0, tn: 0, fp: 0, fn: 0, impr: 0 };
}

function emptyData() {
  return {
    models: {
      claude:      emptyModelStats(),
      gemini:      emptyModelStats(),
      opencode:    emptyModelStats(),
      copilot:     emptyModelStats(),
      codex:       emptyModelStats(),
      deepseek:    emptyModelStats(),
      minimax:     emptyModelStats(),
      'qwen-coder': emptyModelStats(),
      kimi:        emptyModelStats(),
      llama4:      emptyModelStats(),
    },
    slots: {},        // NEW: slot-keyed map; key = '<slot-name>:<model-id>'
    categories: {},
    rounds: [],
  };
}

function loadData(scoreboard) {
  const absPath = path.resolve(process.cwd(), scoreboard);
  if (!fs.existsSync(absPath)) {
    return emptyData();
  }
  try {
    const raw = fs.readFileSync(absPath, 'utf8');
    const data = JSON.parse(raw);
    // Backward compat: ensure categories exists
    if (!data.categories) {
      data.categories = {};
    }
    // Backward compat: ensure slots exists
    if (!data.slots) {
      data.slots = {};
    }
    return data;
  } catch (e) {
    process.stderr.write(`[update-scoreboard] WARNING: could not parse ${absPath}: ${e.message}\n`);
    return emptyData();
  }
}

// ---------------------------------------------------------------------------
// Cumulative stats recompute (from-scratch to avoid drift)
// ---------------------------------------------------------------------------

function recomputeStats(data) {
  // Reset all model stats
  for (const model of VALID_MODELS) {
    if (!data.models[model]) data.models[model] = emptyModelStats();
    const m = data.models[model];
    m.score = 0;
    m.tp    = 0;
    m.tn    = 0;
    m.fp    = 0;
    m.fn    = 0;
    m.impr  = 0;
  }

  for (const round of data.rounds) {
    const votes = round.votes || {};
    for (const model of VALID_MODELS) {
      const vote = votes[model];
      if (!vote || vote === '') continue;

      const m = data.models[model];
      const delta = SCORE_DELTAS[vote];
      if (delta === undefined) continue; // unknown vote code — skip

      m.score += delta;

      if (vote === 'TP' || vote === 'TP+') m.tp += 1;
      if (vote === 'TN')                   m.tn += 1;
      if (vote === 'FP')                   m.fp += 1;
      if (vote === 'FN')                   m.fn += 1;
      if (vote === 'TP+')                  m.impr += 1;
    }
  }
}

// ---------------------------------------------------------------------------
// Slot-keyed stats helpers
// ---------------------------------------------------------------------------

function emptySlotStats(slot, modelId) {
  return { slot, model: modelId, score: 0, tp: 0, tn: 0, fp: 0, fn: 0, impr: 0 };
}

function recomputeSlots(data) {
  // Reset all slot stats in data.slots
  for (const key of Object.keys(data.slots)) {
    const s = data.slots[key];
    s.score = 0; s.tp = 0; s.tn = 0; s.fp = 0; s.fn = 0; s.impr = 0;
  }
  // Replay all rounds — look for votes keyed by composite slot:model-id keys
  for (const round of data.rounds) {
    const votes = round.votes || {};
    for (const [key, vote] of Object.entries(votes)) {
      if (!key.includes(':')) continue;  // slot keys contain ':'
      if (!vote || vote === '') continue;
      if (!data.slots[key]) continue;  // key not in slots map — skip
      const s = data.slots[key];
      const delta = SCORE_DELTAS[vote];
      if (delta === undefined) continue;
      s.score += delta;
      if (vote === 'TP' || vote === 'TP+') s.tp += 1;
      if (vote === 'TN')  s.tn += 1;
      if (vote === 'FP')  s.fp += 1;
      if (vote === 'FN')  s.fn += 1;
      if (vote === 'TP+') s.impr += 1;
    }
  }
}

// ---------------------------------------------------------------------------
// Today's date in MM-DD format
// ---------------------------------------------------------------------------

function todayMMDD() {
  const d = new Date();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${mm}-${dd}`;
}

// ---------------------------------------------------------------------------
// Haiku auto-classification
// ---------------------------------------------------------------------------

/**
 * Attempt to classify a task description using claude-haiku-4-5-20251001.
 * Returns { category, subcategory, is_new } or null on any failure (fail-open).
 */
async function classifyWithHaiku(taskDescription, categories) {
  // SDK availability guard
  let Anthropic;
  try {
    require.resolve('@anthropic-ai/sdk');
    Anthropic = require('@anthropic-ai/sdk');
  } catch (_) {
    return null; // SDK not installed — skip silently
  }

  try {
    // Build formatted taxonomy list for prompt
    const taxonomyLines = Object.entries(categories).map(([cat, subs]) => {
      const subsStr = subs.map(s => `    - ${s}`).join('\n');
      return `  ${cat}:\n${subsStr}`;
    }).join('\n');

    const prompt = `You are classifying a quorum debate topic into a category taxonomy.

Debate topic: ${taskDescription}

Taxonomy:
${taxonomyLines}

Return ONLY valid JSON (no markdown, no explanation):
{"category": "<parent category name>", "subcategory": "<subcategory name>", "is_new": false}

If the topic does not match any existing category or subcategory well, propose new names:
{"category": "<new parent name>", "subcategory": "<new subcategory name>", "is_new": true}

Choose the single best match. Return nothing except the JSON object.`;

    const client = new Anthropic.default({ apiKey: process.env.ANTHROPIC_API_KEY });
    const message = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 128,
      messages: [{ role: 'user', content: prompt }],
    });

    const text = message.content[0].text.trim();
    const result = JSON.parse(text);
    if (typeof result.category !== 'string' || typeof result.subcategory !== 'string') {
      return null;
    }
    return result;
  } catch (_) {
    return null; // any error — fail-open
  }
}

// ---------------------------------------------------------------------------
// init-team: capture team fingerprint (idempotent — skips if unchanged)
// ---------------------------------------------------------------------------

async function initTeam(argv) {
  const args = parseArgs(argv);
  const scoreboardPath = args.scoreboard || '.planning/quorum-scoreboard.json';
  const claudeModel = args['claude-model'] || process.env.CLAUDE_MODEL || process.env.ANTHROPIC_MODEL || 'unknown';

  // Parse agent identities from --team JSON
  let agents = {};
  if (args.team) {
    try {
      agents = JSON.parse(args.team);
    } catch (e) {
      process.stderr.write(`[init-team] WARNING: could not parse --team JSON: ${e.message}\n`);
    }
  }

  // Auto-detect MCPs and plugins from ~/.claude.json
  let mcps = [];
  let plugins = [];
  try {
    const claudeJsonPath = process.env.QGSD_CLAUDE_JSON || path.join(os.homedir(), '.claude.json');
    const claudeJson = JSON.parse(fs.readFileSync(claudeJsonPath, 'utf8'));
    mcps = Object.keys(claudeJson.mcpServers || {});
    plugins = claudeJson.plugins || [];
  } catch (e) {
    process.stderr.write(`[init-team] WARNING: could not read ~/.claude.json: ${e.message}\n`);
  }

  // Compute fingerprint from canonical team composition
  const canonical = JSON.stringify({
    claude_model: claudeModel,
    agents: Object.fromEntries(Object.entries(agents).sort()),
    mcps: [...mcps].sort(),
    plugins: [...plugins].sort(),
  });
  const fingerprint = crypto.createHash('sha256').update(canonical).digest('hex').slice(0, 16);

  const data = loadData(scoreboardPath);

  // Skip if fingerprint unchanged
  if (data.team && data.team.fingerprint === fingerprint) {
    process.stdout.write(`[init-team] fingerprint: ${fingerprint} | no change\n`);
    return;
  }

  const prevFingerprint = data.team ? data.team.fingerprint : null;

  data.team = {
    fingerprint,
    captured_at: new Date().toISOString(),
    claude_model: claudeModel,
    agents,
    mcps,
    plugins,
  };

  const absPath = path.resolve(process.cwd(), scoreboardPath);
  fs.mkdirSync(path.dirname(absPath), { recursive: true });
  fs.writeFileSync(absPath, JSON.stringify(data, null, 2) + '\n', 'utf8');

  const agentCount = Object.keys(agents).length;
  if (prevFingerprint) {
    process.stdout.write(`[init-team] fingerprint: ${fingerprint} (updated from ${prevFingerprint}) | ${agentCount} agents, ${mcps.length} MCPs, ${plugins.length} plugins\n`);
  } else {
    process.stdout.write(`[init-team] fingerprint: ${fingerprint} | ${agentCount} agents, ${mcps.length} MCPs, ${plugins.length} plugins\n`);
  }
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  const rawArgs = process.argv.slice(2);

  // Subcommand routing
  if (rawArgs[0] === 'init-team') {
    return initTeam(rawArgs.slice(1));
  }

  const parsed  = parseArgs(rawArgs);
  const cfg     = validate(parsed);

  const data = loadData(cfg.scoreboard);

  // ---------------------------------------------------------------------------
  // Slot mode: --slot + --model-id path (SCBD-01, SCBD-02, SCBD-03)
  // ---------------------------------------------------------------------------
  if (cfg.slot) {
    const compositeKey = `${cfg.slot}:${cfg.modelId}`;

    // Ensure slot entry exists in data.slots
    if (!data.slots[compositeKey]) {
      data.slots[compositeKey] = emptySlotStats(cfg.slot, cfg.modelId);
    }

    // Append to rounds with vote keyed by compositeKey
    const roundEntry = {
      date:    todayMMDD(),
      task:    cfg.task,
      round:   cfg.round,
      votes:   { [compositeKey]: cfg.result },
      verdict: cfg.verdict,
    };
    if (data.team && data.team.fingerprint) {
      roundEntry.team_fingerprint = data.team.fingerprint;
    }
    data.rounds.push(roundEntry);

    // Recompute slot stats only (do NOT call recomputeStats — that is for --model path)
    recomputeSlots(data);

    // Write back
    const absPath = path.resolve(process.cwd(), cfg.scoreboard);
    fs.mkdirSync(path.dirname(absPath), { recursive: true });
    fs.writeFileSync(absPath, JSON.stringify(data, null, 2) + '\n', 'utf8');

    // Print confirmation
    process.stdout.write(`[update-scoreboard] slot ${cfg.slot} (${cfg.modelId}): ${cfg.result} | score=${data.slots[compositeKey].score}\n`);
    return;
  }

  // ---------------------------------------------------------------------------
  // Model mode: --model path (existing behavior, unchanged)
  // ---------------------------------------------------------------------------

  // Ensure all model keys exist
  for (const model of VALID_MODELS) {
    if (!data.models[model]) data.models[model] = emptyModelStats();
  }

  // Resolve category/subcategory
  let resolvedCategory    = cfg.category;
  let resolvedSubcategory = cfg.subcategory;

  if (!resolvedCategory && !resolvedSubcategory && cfg.taskDescription) {
    // Auto-classify via Haiku
    const classification = await classifyWithHaiku(cfg.taskDescription, data.categories);
    if (classification) {
      resolvedCategory    = classification.category;
      resolvedSubcategory = classification.subcategory;

      if (classification.is_new) {
        // Add new category/subcategory dynamically
        if (!data.categories[resolvedCategory]) {
          data.categories[resolvedCategory] = [];
        }
        if (!data.categories[resolvedCategory].includes(resolvedSubcategory)) {
          data.categories[resolvedCategory].push(resolvedSubcategory);
        }
      } else {
        // Existing category — if subcategory is a variant not yet listed, append it
        if (data.categories[resolvedCategory] && !data.categories[resolvedCategory].includes(resolvedSubcategory)) {
          data.categories[resolvedCategory].push(resolvedSubcategory);
        }
      }
    }
  } else if (resolvedCategory && resolvedSubcategory) {
    // Explicit flags provided — no Haiku needed
    // (categories map is not modified for explicit flags)
  }

  // Find existing round entry matching task + round number
  const existingIdx = data.rounds.findIndex(
    r => r.task === cfg.task && r.round === cfg.round
  );

  if (existingIdx !== -1) {
    // Update existing entry: set/overwrite the model's vote, preserve verdict
    data.rounds[existingIdx].votes = data.rounds[existingIdx].votes || {};
    data.rounds[existingIdx].votes[cfg.model] = cfg.result;
    // Allow verdict update too
    data.rounds[existingIdx].verdict = cfg.verdict;
    // Set category if resolved
    if (resolvedCategory && resolvedSubcategory) {
      data.rounds[existingIdx].category    = resolvedCategory;
      data.rounds[existingIdx].subcategory = resolvedSubcategory;
    }
  } else {
    // Append new round entry
    const newEntry = {
      date:    todayMMDD(),
      task:    cfg.task,
      round:   cfg.round,
      votes:   { [cfg.model]: cfg.result },
      verdict: cfg.verdict,
    };
    if (resolvedCategory && resolvedSubcategory) {
      newEntry.category    = resolvedCategory;
      newEntry.subcategory = resolvedSubcategory;
    }
    if (data.team && data.team.fingerprint) {
      newEntry.team_fingerprint = data.team.fingerprint;
    }
    data.rounds.push(newEntry);
  }

  // Recompute all cumulative stats from scratch
  recomputeStats(data);

  // Write back
  const absPath = path.resolve(process.cwd(), cfg.scoreboard);
  fs.mkdirSync(path.dirname(absPath), { recursive: true });
  fs.writeFileSync(absPath, JSON.stringify(data, null, 2) + '\n', 'utf8');

  // Print confirmation
  const delta    = SCORE_DELTAS[cfg.result] || 0;
  const sign     = delta >= 0 ? '+' : '';
  const newScore = data.models[cfg.model].score;
  const deltaStr = cfg.result === '' ? '(not scored)' : `${cfg.result} (${sign}${delta})`;
  let confirmation = `[update-scoreboard] ${cfg.model}: ${deltaStr} → score: ${newScore} | ${cfg.task} R${cfg.round} ${cfg.verdict}`;
  if (resolvedCategory && resolvedSubcategory) {
    confirmation += ` | category: ${resolvedCategory} > ${resolvedSubcategory}`;
  }
  process.stdout.write(confirmation + '\n');
}

main().catch(err => {
  process.stderr.write(`[update-scoreboard] FATAL: ${err.message}\n`);
  process.exit(1);
});
