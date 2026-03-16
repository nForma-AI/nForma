#!/usr/bin/env node
'use strict';

/**
 * quorum-slot-dispatch.cjs — prompt construction + output parsing wrapper
 *
 * Usage:
 *   node quorum-slot-dispatch.cjs \
 *     --slot <name> \
 *     --mode <A|B> \
 *     --round <n> \
 *     --question <text> \
 *     [--artifact-path <path>] \
 *     [--review-context <string>] \
 *     [--prior-positions-file <path>] \
 *     [--traces-file <path>] \
 *     [--request-improvements] \
 *     [--timeout <ms>] \
 *     [--cwd <dir>]
 *
 * Builds the Mode A or Mode B prompt from deterministic JS templates matching
 * agents/nf-quorum-slot-worker.md Step 2, pipes it to call-quorum-slot.cjs via
 * child_process.spawn, parses the output, and emits a structured YAML result block.
 *
 * Exported pure functions (testable without subprocess):
 *   buildModeAPrompt, buildModeBPrompt, parseVerdict, parseReasoning,
 *   parseCitations, parseImprovements, emitResultBlock, stripQuotes
 */

const { spawn }  = require('child_process');
const fs         = require('fs');
const path       = require('path');
const os         = require('os');
const planningPaths = require('./planning-paths.cjs');

// ─── Config-loader integration (two-layer merge for nf.json settings) ────────
function loadNfConfig(cwd) {
  const candidates = [
    path.join(os.homedir(), '.claude', 'hooks', 'config-loader.js'),
    path.join(__dirname, '..', 'hooks', 'dist', 'config-loader.js'),
    path.join(__dirname, '..', 'hooks', 'config-loader.js'),
  ];
  for (const p of candidates) {
    try {
      const { loadConfig } = require(p);
      return loadConfig(cwd);
    } catch (_) {}
  }
  return {}; // fail-open: empty config uses defaults
}

// ─── classifyDispatchError — classify UNAVAIL output into a human-readable type ──────────────
/**
 * Classify the raw output/error string from a failed dispatch into a concise error type.
 * Mirrors the classifyErrorType logic from call-quorum-slot.cjs.
 *
 * @param {string} output — combined stdout/stderr from the failed child process
 * @returns {'IDLE_TIMEOUT'|'HARD_TIMEOUT'|'TIMEOUT'|'AUTH'|'QUOTA'|'SPAWN_ERROR'|'CLI_SYNTAX'|'UNKNOWN'}
 */
function classifyDispatchError(output) {
  const s = String(output || '');
  if (/IDLE_TIMEOUT/i.test(s)) return 'IDLE_TIMEOUT';
  if (/HARD_TIMEOUT/i.test(s)) return 'HARD_TIMEOUT';
  if (/TIMEOUT/i.test(s)) return 'TIMEOUT'; // backward compat
  if (/402|quota|rate.?limit|resource.?exhausted/i.test(s)) return 'QUOTA';
  if (/401|403|unauthorized|forbidden/i.test(s)) return 'AUTH';
  if (/service not running|service.?down|not.?started/i.test(s)) return 'SERVICE_DOWN';
  if (/spawn error/i.test(s)) return 'SPAWN_ERROR';
  if (/usage:|unknown flag|unknown option|invalid flag|unrecognized/i.test(s)) return 'CLI_SYNTAX';
  return 'UNKNOWN';
}

// ─── Arg parsing (mirrors call-quorum-slot.cjs pattern) ───────────────────────
const argv   = process.argv.slice(2);
const getArg = (f) => {
  const i = argv.indexOf(f);
  return i !== -1 && argv[i + 1] !== undefined ? argv[i + 1] : null;
};
const hasFlag = (f) => argv.includes(f);
const reviewOnly = hasFlag('--review-only'); // EXEC-01: review-only tool restriction

// ─── Precedent loading, matching, and formatting functions ───────────────────

/**
 * Cache for loaded precedents, keyed by projectRoot.
 * @type {Map<string, Array>}
 */
const precedentsCache = new Map();

/**
 * loadPrecedents — reads `.planning/quorum/precedents.json` from projectRoot.
 * Fail-open: returns [] if file missing, malformed, or any error occurs.
 *
 * @param {string} projectRoot
 * @returns {Array} — array of precedent objects, or [] if load failed
 */
function loadPrecedents(projectRoot) {
  if (precedentsCache.has(projectRoot)) {
    return precedentsCache.get(projectRoot);
  }
  try {
    const precPath = path.join(projectRoot, '.planning', 'quorum', 'precedents.json');
    const raw = fs.readFileSync(precPath, 'utf8');
    const parsed = JSON.parse(raw);
    const precedents = Array.isArray(parsed.precedents) ? parsed.precedents : [];
    precedentsCache.set(projectRoot, precedents);
    return precedents;
  } catch (e) {
    process.stderr.write(`[quorum-slot-dispatch] precedents load failed (fail-open): ${e.message}\n`);
    precedentsCache.set(projectRoot, []);
    return [];
  }
}

/**
 * matchPrecedentsByKeywords — scores and selects relevant precedents for a question.
 * Reuses extractKeywords() for tokenization. Filters stale entries (>90 days).
 *
 * @param {Array} precedents — array of precedent objects
 * @param {string} question — the current quorum question
 * @param {number} [maxMatches=3] — max precedents to return
 * @returns {Array} — matched precedent objects sorted by relevance
 */
function matchPrecedentsByKeywords(precedents, question, maxMatches = 3) {
  if (!precedents || precedents.length === 0 || !question) return [];

  const MAX_AGE_MS = 90 * 24 * 60 * 60 * 1000;
  const questionKw = extractKeywords(question);
  if (questionKw.size === 0) return [];

  const scored = [];
  for (const prec of precedents) {
    // TTL check — inline to avoid cross-module dependency
    try {
      const precTime = new Date(prec.date).getTime();
      if (isNaN(precTime) || (Date.now() - precTime) >= MAX_AGE_MS) continue;
    } catch {
      continue;
    }

    const precQuestionKw = extractKeywords(prec.question);
    const precOutcomeKw = extractKeywords(prec.outcome);

    // Score: question overlap * 1 + outcome overlap * 2
    let score = 0;
    for (const kw of questionKw) {
      if (precQuestionKw.has(kw)) score += 1;
      if (precOutcomeKw.has(kw)) score += 2;
    }

    if (score > 0) {
      scored.push({ prec, score });
    }
  }

  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, maxMatches).map(s => s.prec);
}

/**
 * formatPrecedentsSection — formats matched precedents into a text block for prompt injection.
 * Returns null if input is empty/null.
 *
 * @param {Array} precedents — array of matched precedent objects
 * @returns {string|null} — formatted section or null
 */
function formatPrecedentsSection(precedents) {
  if (!precedents || precedents.length === 0) return null;

  const lines = [];
  lines.push('=== PAST QUORUM PRECEDENTS ===');
  lines.push('The following past quorum decisions are relevant to this question.');
  lines.push('Consider whether they apply or should be revisited:');
  lines.push('');

  for (const prec of precedents) {
    const q = prec.question && prec.question.length > 120
      ? prec.question.slice(0, 120) + '...'
      : (prec.question || '');
    const o = prec.outcome && prec.outcome.length > 150
      ? prec.outcome.slice(0, 150) + '...'
      : (prec.outcome || '');
    lines.push(`- **${prec.consensus}** (${prec.date}): ${q}`);
    lines.push(`  Outcome: ${o}`);
  }

  lines.push('');
  lines.push('================================');

  return lines.join('\n');
}

// ─── Requirements loading and matching functions ──────────────────────────────

/**
 * Cache for loaded requirements, keyed by projectRoot to avoid re-reading disk.
 * @type {Map<string, Array>}
 */
const requirementsCache = new Map();

/**
 * loadRequirements — reads `.planning/formal/requirements.json` from projectRoot.
 * Fail-open: returns [] if file missing, malformed, or any error occurs.
 * Caches result keyed by projectRoot to avoid re-reading disk.
 *
 * @param {string} projectRoot
 * @returns {Array} — array of requirement objects, or [] if load failed
 */
function loadRequirements(projectRoot) {
  if (requirementsCache.has(projectRoot)) {
    return requirementsCache.get(projectRoot);
  }

  try {
    const filePath = path.join(projectRoot, '.planning', 'formal', 'requirements.json');
    const content = fs.readFileSync(filePath, 'utf8');
    const data = JSON.parse(content);
    const reqs = Array.isArray(data.requirements) ? data.requirements : [];
    requirementsCache.set(projectRoot, reqs);
    return reqs;
  } catch (e) {
    // Fail-open: return empty array on any error (missing file, malformed JSON, etc.)
    requirementsCache.set(projectRoot, []);
    return [];
  }
}

/**
 * List of English stopwords to filter out during keyword extraction.
 * @type {Set<string>}
 */
const STOPWORDS = new Set([
  'the', 'a', 'is', 'it', 'to', 'of', 'and', 'or', 'in', 'for', 'this', 'that',
  'with', 'from', 'be', 'are', 'was', 'has', 'have', 'do', 'does', 'not', 'but',
  'an', 'on', 'at', 'by', 'we', 'should', 'would', 'could', 'will', 'can',
  'what', 'how', 'why', 'when', 'which', 'these', 'those', 'as', 'if', 'then',
  'there', 'their', 'they', 'them', 'its', 'so', 'some', 'any', 'all', 'each',
  'every', 'both', 'other', 'very', 'just', 'only', 'more', 'most', 'less', 'too'
]);

/**
 * Map artifact path segments to category groups for stronger matching.
 * @type {Map<string, string>}
 */
const PATH_CATEGORY_MAP = new Map([
  ['hook', 'Hooks & Enforcement'],
  ['quorum', 'Quorum & Dispatch'],
  ['dispatch', 'Quorum & Dispatch'],
  ['install', 'Installer & CLI'],
  ['mcp', 'MCP & Agents'],
  ['agent', 'MCP & Agents'],
  ['slot', 'MCP & Agents'],
  ['formal', 'Formal Verification'],
  ['alloy', 'Formal Verification'],
  ['tla', 'Formal Verification'],
  ['prism', 'Formal Verification'],
  ['config', 'Configuration'],
  ['plan', 'Planning & Tracking'],
  ['state', 'Planning & Tracking'],
  ['test', 'Testing & Quality'],
  ['observe', 'Observability & Diagnostics'],
  ['telemetry', 'Observability & Diagnostics'],
  ['scoreboard', 'Observability & Diagnostics']
]);

/**
 * matchRequirementsByKeywords — filters requirements based on keywords from question and artifact path.
 * Returns max 20 matching requirements, sorted by relevance score (descending).
 *
 * @param {Array} requirements — full requirements array
 * @param {string} question — the question text
 * @param {string|null} artifactPath — optional artifact path (e.g. "hooks/nf-stop.js")
 * @returns {Array} — filtered requirements (max 20), sorted by score descending
 */
function matchRequirementsByKeywords(requirements, question, artifactPath) {
  if (!requirements || requirements.length === 0) {
    return [];
  }

  // Extract keywords from question
  const questionKeywords = extractKeywords(question);

  // Extract keywords from artifact path
  const pathKeywords = artifactPath ? extractPathKeywords(artifactPath) : new Set();
  const pathCategories = artifactPath ? extractPathCategories(artifactPath) : [];

  // Score each requirement
  const scored = requirements.map(req => {
    let score = 0;

    // Match on id prefix (e.g. "DISP" from "DISP-01")
    const idPrefix = req.id ? req.id.split('-')[0].toLowerCase() : '';
    if (idPrefix && (questionKeywords.has(idPrefix) || pathKeywords.has(idPrefix))) {
      score += 2;
    }

    // Match on category_raw
    if (req.category_raw) {
      const catRaw = req.category_raw.toLowerCase();
      for (const kw of questionKeywords) {
        if (catRaw.includes(kw)) score += 1;
      }
    }

    // Match on category (group)
    if (req.category) {
      const cat = req.category.toLowerCase();
      for (const kw of questionKeywords) {
        if (cat.includes(kw)) score += 1;
      }
      // Boost if category matches path-derived categories
      for (const pathCat of pathCategories) {
        if (cat === pathCat.toLowerCase()) {
          score += 3; // Strong signal from artifact path
        }
      }
    }

    // Match on text
    if (req.text) {
      const text = req.text.toLowerCase();
      for (const kw of questionKeywords) {
        if (text.includes(kw)) score += 1;
      }
      for (const kw of pathKeywords) {
        if (text.includes(kw)) score += 1;
      }
    }

    return { req, score };
  });

  // Sort by score descending, filter out zero-score entries, cap at 20
  return scored
    .filter(({ score }) => score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 20)
    .map(({ req }) => req);
}

/**
 * extractKeywords — splits text into tokens and filters out stopwords.
 * Splits on spaces, slashes, hyphens, dots, underscores.
 *
 * @param {string} text
 * @returns {Set<string>} — set of meaningful lowercase tokens
 */
function extractKeywords(text) {
  if (!text) return new Set();

  // Split on common delimiters: space, /, -, ., _
  const tokens = text.toLowerCase()
    .split(/[\s\/\-\._]+/)
    .filter(t => t.length > 0 && !STOPWORDS.has(t));

  return new Set(tokens);
}

/**
 * extractPathKeywords — extracts tokens from artifact path (just filename parts).
 *
 * @param {string} artifactPath
 * @returns {Set<string>} — meaningful tokens from path
 */
function extractPathKeywords(artifactPath) {
  if (!artifactPath) return new Set();

  // Extract just the filename part
  const filename = path.basename(artifactPath);
  const tokens = filename.toLowerCase()
    .split(/[\s\/\-\._]+/)
    .filter(t => t.length > 0 && !STOPWORDS.has(t));

  return new Set(tokens);
}

/**
 * extractPathCategories — maps artifact path segments to category groups.
 * Checks each segment of the path against PATH_CATEGORY_MAP.
 *
 * @param {string} artifactPath
 * @returns {Array<string>} — matching category groups
 */
function extractPathCategories(artifactPath) {
  if (!artifactPath) return [];

  const categories = new Set();
  const segments = artifactPath.toLowerCase().split(/[\s\/\-\._]+/);

  for (const segment of segments) {
    if (PATH_CATEGORY_MAP.has(segment)) {
      categories.add(PATH_CATEGORY_MAP.get(segment));
    }
  }

  return Array.from(categories);
}

/**
 * formatRequirementsSection — formats an array of requirements into a text block.
 * Returns null if the array is empty (no section should be injected).
 *
 * @param {Array} requirements — array of requirement objects
 * @returns {string|null} — formatted section or null
 */
function formatRequirementsSection(requirements) {
  if (!requirements || requirements.length === 0) {
    return null;
  }

  const lines = [];
  lines.push('=== APPLICABLE REQUIREMENTS ===');
  lines.push('The following project requirements are relevant to this review.');
  lines.push('Consider whether the proposed change satisfies or violates these:');
  lines.push('');

  for (const req of requirements) {
    const category = req.category || 'Unknown';
    lines.push(`- [${req.id}] ${req.text} (${category})`);
  }

  lines.push('');
  lines.push('================================');

  return lines.join('\n');
}

// ─── Pure prompt-construction functions ──────────────────────────────────────

/**
 * buildModeAPrompt — constructs the Mode A question prompt.
 *
 * Matches the EXACT template from agents/nf-quorum-slot-worker.md Step 2 Mode A.
 *
 * @param {object} opts
 * @param {number}  opts.round
 * @param {string}  opts.repoDir
 * @param {string}  opts.question
 * @param {string} [opts.artifactPath]
 * @param {string} [opts.artifactContent]  - pre-read content (avoids model read failures)
 * @param {string} [opts.reviewContext]
 * @param {string} [opts.priorPositions]   - Round 2+ cross-pollination
 * @param {boolean}[opts.requestImprovements]
 * @param {Array}  [opts.requirements]     - array of requirement objects to inject
 * @returns {string}
 */
function buildModeAPrompt({ round, repoDir, question, artifactPath, artifactContent, reviewContext, priorPositions, requestImprovements, requirements, precedents }) {
  const lines = [];

  // Header
  lines.push(`nForma Quorum — Round ${round}`);
  lines.push('');

  // Repository + question
  lines.push(`Repository: ${repoDir}`);
  lines.push('');
  lines.push(`Question: ${question}`);

  // Artifact section (conditional)
  if (artifactPath) {
    lines.push('');
    lines.push('=== Artifact ===');
    lines.push(`Path: ${artifactPath}`);
    if (artifactContent) {
      lines.push('Content:');
      lines.push(artifactContent);
    } else {
      lines.push('(Read this file to obtain its full content before evaluating.)');
    }
    lines.push('================');
  }

  // Requirements section (conditional — injected right after question/artifact, before review context)
  if (requirements && requirements.length > 0) {
    const reqSection = formatRequirementsSection(requirements);
    if (reqSection) {
      lines.push('');
      lines.push(reqSection);
    }
  }

  // Precedents section (conditional — injected after requirements, before review context)
  if (precedents && precedents.length > 0) {
    const precSection = formatPrecedentsSection(precedents);
    if (precSection) {
      lines.push('');
      lines.push(precSection);
    }
  }

  // Review context (conditional — first occurrence)
  if (reviewContext) {
    lines.push('');
    lines.push(`\u26a0 REVIEW CONTEXT: ${reviewContext}`);
  }

  if (round >= 2 && priorPositions) {
    // ── Round 2+ path ─────────────────────────────────────────────────────
    lines.push('');
    lines.push('The following positions are from other AI models in this quorum — not human experts.');
    lines.push('Evaluate them as peer AI opinions.');
    lines.push('');
    lines.push('Prior positions:');
    lines.push(priorPositions);

    // Review context reminder (Round 2+ only, when reviewContext present)
    if (reviewContext) {
      lines.push('');
      lines.push(`\u26a0 REVIEW CONTEXT REMINDER: ${reviewContext}`);
      lines.push('(If any prior position applied evaluation criteria inconsistent with the above — e.g.');
      lines.push('rejected a plan because code was absent, or approved test results without checking');
      lines.push('assertions — reconsider your position in light of the correct evaluation criteria.)');
    }

    lines.push('');
    if (artifactContent) {
      lines.push('Before revising your position, re-review the artifact content provided above and');
      lines.push('use your tools to check any other relevant files if needed.');
    } else {
      lines.push('Before revising your position, use your tools to re-check relevant files. At minimum');
      lines.push('re-read CLAUDE.md and .planning/STATE.md if they exist, and re-read the artifact file if');
      lines.push('one was provided.');
    }
    lines.push('');
    lines.push('Given the above, do you maintain your answer or revise it? State your updated position');
    lines.push('clearly (2\u20134 sentences).');
    lines.push('');
    lines.push('IMPORTANT: Keep your TOTAL response under 3000 characters.');

    // Improvements block (Round 2+, when requestImprovements)
    if (requestImprovements) {
      lines.push('If you APPROVE and have specific, actionable improvements, append:');
      lines.push('');
      lines.push('Improvements:');
      lines.push('- suggestion: [concise change \u2014 one sentence]');
      lines.push('  rationale: [why this strengthens the plan]');
      lines.push('');
      lines.push('Omit this section entirely if you have no improvements, or if you BLOCK.');
    }

    lines.push('');
    lines.push('If your re-check references specific files, line numbers, or code snippets, record');
    lines.push('them in a citations: field in your response (optional).');

  } else {
    // ── Round 1 path ──────────────────────────────────────────────────────
    lines.push('');
    if (artifactContent) {
      lines.push('The artifact content is provided above. Use your available tools to read any other');
      lines.push('relevant files from the Repository directory if needed. Your answer must be grounded');
      lines.push('in the artifact content and what you actually find in the repo.');
    } else {
      lines.push('IMPORTANT: Before answering, use your available tools to read files from the');
      lines.push('Repository directory above. At minimum read: CLAUDE.md (if it exists),');
      lines.push('.planning/STATE.md (if it exists), and the artifact file at the path shown in the');
      lines.push('Artifact section above (if present). Then read any other files directly relevant to');
      lines.push('the question. Your answer must be grounded in what you actually find in the repo.');
    }
    lines.push('');
    lines.push('You are one AI model in a multi-model quorum. Your peer reviewers are other AI language');
    lines.push('models \u2014 not human experts. Give your honest answer with reasoning. Be concise (3\u20136');
    lines.push('sentences). Do not defer to peer models.');
    lines.push('');
    lines.push('IMPORTANT: Keep your TOTAL response under 3000 characters. Do not include lengthy code');
    lines.push('excerpts, full file contents, or verbose explanations. Summarize findings concisely.');

    // Improvements block (Round 1, when requestImprovements)
    if (requestImprovements) {
      lines.push('If you APPROVE and have specific, actionable improvements, append:');
      lines.push('');
      lines.push('Improvements:');
      lines.push('- suggestion: [concise change \u2014 one sentence]');
      lines.push('  rationale: [why this strengthens the plan]');
      lines.push('');
      lines.push('Omit this section entirely if you have no improvements, or if you BLOCK.');
    }

    lines.push('');
    lines.push('If your answer references specific files, line numbers, or code snippets from the');
    lines.push('repository, record them in a citations: field in your response (optional \u2014 only');
    lines.push('include if you actually cite code).');
  }

  return lines.join('\n');
}

/**
 * buildModeBPrompt — constructs the Mode B execution review prompt.
 *
 * Matches the EXACT template from agents/nf-quorum-slot-worker.md Step 2 Mode B.
 *
 * @param {object} opts
 * @param {number}  opts.round
 * @param {string}  opts.repoDir
 * @param {string}  opts.question
 * @param {string}  opts.traces             - execution trace output (required for Mode B)
 * @param {string} [opts.artifactPath]
 * @param {string} [opts.artifactContent]  - pre-read content (avoids model read failures)
 * @param {string} [opts.reviewContext]
 * @param {string} [opts.priorPositions]   - Round 2+
 * @param {Array}  [opts.requirements]     - array of requirement objects to inject
 * @param {boolean}[opts.reviewOnly]       - EXEC-01: inject read-only tool restriction
 * @returns {string}
 */
function buildModeBPrompt({ round, repoDir, question, traces, artifactPath, artifactContent, reviewContext, priorPositions, requirements, precedents, reviewOnly }) {
  const lines = [];

  // Header
  lines.push(`nForma Quorum — Execution Review (Round ${round})`);

  // EXEC-01: Review-only tool restriction for Mode B prompts
  if (reviewOnly) {
    lines.push('');
    lines.push('IMPORTANT: This is a READ-ONLY review task. You MUST NOT modify any files. Only use read operations (Read, Grep, Glob tools). Do NOT use Write, Edit, Bash(write), or any destructive commands.');
  }
  lines.push('');

  // Repository + question
  lines.push(`Repository: ${repoDir}`);
  lines.push('');
  lines.push(`QUESTION: ${question}`);

  // Artifact section (conditional)
  if (artifactPath) {
    lines.push('');
    lines.push('=== Artifact ===');
    lines.push(`Path: ${artifactPath}`);
    if (artifactContent) {
      lines.push('Content:');
      lines.push(artifactContent);
    } else {
      lines.push('(Read this file to obtain its full content before evaluating.)');
    }
    lines.push('================');
  }

  // Requirements section (conditional — injected right after question/artifact, before review context)
  if (requirements && requirements.length > 0) {
    const reqSection = formatRequirementsSection(requirements);
    if (reqSection) {
      lines.push('');
      lines.push(reqSection);
    }
  }

  // Precedents section (conditional — injected after requirements, before review context)
  if (precedents && precedents.length > 0) {
    const precSection = formatPrecedentsSection(precedents);
    if (precSection) {
      lines.push('');
      lines.push(precSection);
    }
  }

  // Review context (conditional — first occurrence)
  if (reviewContext) {
    lines.push('');
    lines.push(`\u26a0 REVIEW CONTEXT: ${reviewContext}`);
  }

  // Execution traces (always present in Mode B)
  lines.push('');
  lines.push('=== EXECUTION TRACES ===');
  lines.push(traces || '');

  // Prior positions (Round 2+)
  if (round >= 2 && priorPositions) {
    lines.push('');
    lines.push('Prior positions:');
    lines.push(priorPositions);

    // Review context reminder (Round 2+ only, when reviewContext present)
    if (reviewContext) {
      lines.push('');
      lines.push(`\u26a0 REVIEW CONTEXT REMINDER: ${reviewContext}`);
      lines.push('(If any prior position applied incorrect evaluation criteria, reconsider in light of the above.)');
    }
  }

  lines.push('');
  if (artifactContent) {
    lines.push('The artifact content is provided above. Use your tools to read any other relevant files');
    lines.push('from the Repository directory if needed.');
  } else {
    lines.push('Before giving your verdict, use your tools to read files from the Repository directory');
    lines.push('above. At minimum read: CLAUDE.md (if it exists), .planning/STATE.md (if it exists), and');
    lines.push('the artifact file at the path shown above (if present).');
  }
  lines.push('');
  lines.push('Note: prior positions are opinions from other AI models \u2014 not human specialists.');
  lines.push('');
  lines.push('Review the execution traces above. Give:');
  lines.push('');
  lines.push('verdict: APPROVE | REJECT | FLAG');
  lines.push('reasoning: [2\u20134 sentences grounded in the actual trace output \u2014 not assumptions]');
  lines.push('');
  lines.push('APPROVE if output clearly shows the question is satisfied.');
  lines.push('REJECT if output shows it is NOT satisfied.');
  lines.push('FLAG if output is ambiguous or requires human judgment.');
  lines.push('');
  lines.push('IMPORTANT: Keep your TOTAL response under 3000 characters. Do not reproduce full');
  lines.push('trace output — summarize key findings concisely.');
  lines.push('');
  lines.push('If your verdict references specific lines from the execution traces or files, record');
  lines.push('them in a citations: field (optional \u2014 only when you directly cite output lines or');
  lines.push('file content).');

  return lines.join('\n');
}

// ─── Output parsing functions ─────────────────────────────────────────────────

/**
 * parseVerdict — extracts verdict from raw CLI output.
 *
 * Mode A: first 500 chars of rawOutput (free-form position summary)
 * Mode B (default): extract APPROVE|REJECT|FLAG from "verdict:" line; default FLAG
 *
 * @param {string} rawOutput
 * @param {string} [mode]  'A' or 'B' (default B)
 * @returns {string}
 */
function parseVerdict(rawOutput, mode) {
  if (mode === 'A') {
    return (rawOutput || '').slice(0, 500);
  }
  // Mode B: extract APPROVE|REJECT|FLAG
  const match = (rawOutput || '').match(/verdict:\s*(APPROVE|REJECT|FLAG)/i);
  return match ? match[1].toUpperCase() : 'FLAG';
}

/**
 * parseReasoning — extracts reasoning from "reasoning: ..." line.
 *
 * @param {string} rawOutput
 * @returns {string|null}
 */
function parseReasoning(rawOutput) {
  if (!rawOutput) return null;
  const match = rawOutput.match(/^reasoning:\s*(.+)$/m);
  if (match) return match[1].trim();
  // Fallback: first 400 chars
  return null;
}

/**
 * parseCitations — extracts citations block from "citations: |" section.
 *
 * Handles both space-indented and tab-indented YAML block scalar content.
 *
 * @param {string} rawOutput
 * @returns {string|null}
 */
function parseCitations(rawOutput) {
  if (!rawOutput) return null;

  const lines = rawOutput.split('\n');
  let inCitations = false;
  const citationLines = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    if (!inCitations) {
      // Detect "citations: |" or "citations:" line
      if (/^citations:\s*\|?\s*$/.test(trimmed)) {
        inCitations = true;
        continue;
      }
    } else {
      // Indented continuation (space or tab)
      if (line.startsWith(' ') || line.startsWith('\t')) {
        citationLines.push(trimmed);
      } else if (trimmed === '') {
        // blank line inside block — keep
        citationLines.push('');
      } else {
        // Non-indented non-empty line — end of block
        break;
      }
    }
  }

  if (citationLines.length === 0) return null;

  // Remove trailing empty lines
  while (citationLines.length > 0 && citationLines[citationLines.length - 1] === '') {
    citationLines.pop();
  }

  return citationLines.length > 0 ? citationLines.join('\n') : null;
}

/**
 * stripQuotes — strips surrounding single or double quotes from a string.
 * @param {string} s
 * @returns {string}
 */
function stripQuotes(s) {
  if (!s) return s;
  if ((s.startsWith('"') && s.endsWith('"')) || (s.startsWith("'") && s.endsWith("'"))) {
    return s.slice(1, -1);
  }
  return s;
}

/**
 * parseImprovements — scans rawOutput for "Improvements:" section, parses list entries.
 *
 * Migrated from bin/gsd-quorum-slot-worker-improvements.test.cjs (canonical location).
 * Never throws — improvements are additive, not required.
 *
 * @param {string} rawOutput
 * @returns {Array<{suggestion: string, rationale: string}>}
 */
function parseImprovements(rawOutput) {
  if (!rawOutput || typeof rawOutput !== 'string') return [];

  const lines = rawOutput.split('\n');
  let inSection = false;
  const results = [];
  let currentEntry = null;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Detect section start
    if (!inSection && line.trimStart().startsWith('Improvements:')) {
      inSection = true;
      continue;
    }

    if (!inSection) continue;

    // Detect section end: non-indented non-empty line that isn't a list item
    const trimmed = line.trim();
    if (trimmed === '') continue; // blank lines: skip, stay in section

    // Check if this is a new top-level key (non-indented, non-list-item) — section ends
    if (!line.startsWith(' ') && !line.startsWith('\t') && !trimmed.startsWith('-') && trimmed !== '') {
      // End of improvements section
      if (currentEntry && currentEntry.suggestion && currentEntry.rationale) {
        results.push({ suggestion: currentEntry.suggestion, rationale: currentEntry.rationale });
      }
      currentEntry = null;
      inSection = false;
      continue;
    }

    // Match `- suggestion:` line — starts a new entry
    const suggestionMatch = trimmed.match(/^-\s+suggestion:\s*(.*)$/);
    if (suggestionMatch) {
      // Save previous entry if complete
      if (currentEntry && currentEntry.suggestion && currentEntry.rationale) {
        results.push({ suggestion: currentEntry.suggestion, rationale: currentEntry.rationale });
      }
      const val = stripQuotes(suggestionMatch[1].trim());
      currentEntry = { suggestion: val, rationale: null };
      continue;
    }

    // Match `rationale:` line (indented continuation)
    const rationaleMatch = trimmed.match(/^rationale:\s*(.*)$/);
    if (rationaleMatch && currentEntry) {
      const val = stripQuotes(rationaleMatch[1].trim());
      currentEntry.rationale = val;
      continue;
    }
  }

  // Flush last entry
  if (currentEntry && currentEntry.suggestion && currentEntry.rationale) {
    results.push({ suggestion: currentEntry.suggestion, rationale: currentEntry.rationale });
  }

  return results;
}

/**
 * emitResultBlock — produces the YAML-formatted result block matching the agent spec Step 4.
 *
 * Returns a string (does NOT write to stdout — main() handles that).
 *
 * @param {object} opts
 * @param {string}  opts.slot
 * @param {number}  opts.round
 * @param {string}  opts.verdict
 * @param {string}  opts.reasoning
 * @param {string} [opts.citations]
 * @param {Array}  [opts.improvements]
 * @param {string} [opts.rawOutput]
 * @param {boolean}[opts.isUnavail]
 * @param {string} [opts.error_type] — classified error type for UNAVAIL results (IDLE_TIMEOUT/HARD_TIMEOUT/TIMEOUT/AUTH/QUOTA/SPAWN_ERROR/CLI_SYNTAX/UNKNOWN)
 * @param {string} [opts.unavailMessage]
 * @returns {string}
 */
function emitResultBlock({ slot, round, verdict, reasoning, citations, improvements, matched_requirement_ids, rawOutput, isUnavail, error_type, unavailMessage }) {
  const lines = [];

  lines.push(`slot: ${slot}`);
  lines.push(`round: ${round}`);
  lines.push(`verdict: ${verdict}`);
  if (error_type) {
    lines.push(`error_type: ${error_type}`);
  }

  if (reasoning) {
    lines.push(`reasoning: ${reasoning}`);
  } else {
    lines.push('reasoning:');
  }

  if (citations) {
    lines.push('citations: |');
    const citLines = citations.split('\n');
    for (const cl of citLines) {
      lines.push(`  ${cl}`);
    }
  }

  if (improvements && improvements.length > 0) {
    lines.push('improvements:');
    for (const imp of improvements) {
      lines.push(`  - suggestion: "${imp.suggestion}"`);
      lines.push(`    rationale: "${imp.rationale}"`);
    }
  }

  if (matched_requirement_ids && matched_requirement_ids.length > 0) {
    lines.push(`matched_requirement_ids: [${matched_requirement_ids.join(', ')}]`);
  }

  if (isUnavail && unavailMessage) {
    lines.push('unavail_message: |');
    const msgLines = unavailMessage.slice(0, 500).split('\n');
    for (const ml of msgLines) {
      lines.push(`  ${ml}`);
    }
  }

  lines.push('raw: |');
  const rawTruncated = (rawOutput || '').slice(0, 5000);
  const rawLines = rawTruncated.split('\n');
  for (const rl of rawLines) {
    lines.push(`  ${rl}`);
  }

  return lines.join('\n') + '\n';
}

// ─── Pre-dispatch context enrichment (ORCH-01) ───────────────────────────────
//
// ARCHITECTURAL RATIONALE (ORCH-01):
// Pre-dispatch enrichment with up to 2 iterative retrieval rounds approximates
// on-demand retrieval without requiring slot workers to have direct tool access.
// This is architecturally necessary because slot workers dispatch to external
// CLIs (codex, gemini, opencode, copilot) that lack Read/Grep/Glob tools --
// they cannot perform retrieval themselves. By enriching the prompt BEFORE
// dispatch, we satisfy ORCH-01's intent ("iterative retrieval") within Claude
// Code's subagent constraints.
//

/**
 * enrichPromptWithRetrieval — enriches a quorum prompt with domain-specific
 * retrieved context from context-retriever.cjs and context-stack.cjs.
 *
 * Fail-open: on ANY error (missing modules, I/O failures, etc.), returns the
 * original prompt unchanged. Retrieval errors never prevent quorum dispatch.
 *
 * @param {string} prompt      — the built prompt to enrich
 * @param {string} question    — the question being asked
 * @param {string|null} artifactPath — optional artifact path
 * @param {string} cwd         — working directory
 * @returns {string} — enriched prompt, or original prompt on error
 */
function enrichPromptWithRetrieval(prompt, question, artifactPath, cwd) {
  try {
    // Dual-path require for context-retriever.cjs
    const retriever = (() => {
      try { return require(path.join(__dirname, 'context-retriever.cjs')); }
      catch { return null; }
    })();
    if (!retriever) return prompt;

    // Dual-path require for context-stack.cjs (optional)
    const contextStack = (() => {
      try { return require(path.join(__dirname, 'context-stack.cjs')); }
      catch { return null; }
    })();

    const charBudget = retriever.TOKEN_BUDGET_CHARS || 32000;
    let additionalContext = '';
    let existingContext = '';

    // Iterative retrieval: up to MAX_ROUNDS (2) rounds
    const maxRounds = retriever.MAX_ROUNDS || 2;
    for (let round = 0; round < maxRounds; round++) {
      const needs = retriever.analyzeContextNeeds(question, artifactPath, existingContext);
      if (!needs || needs.length === 0) break;

      const remainingBudget = charBudget - additionalContext.length;
      if (remainingBudget <= 0) break;

      const fetched = retriever.fetchContext(cwd, needs, remainingBudget);
      if (!fetched) break;

      additionalContext += fetched;
      existingContext = additionalContext;
    }

    // Append context stack entries if available and within budget
    if (contextStack) {
      try {
        const stackInjection = contextStack.formatInjection(cwd, 'current');
        if (stackInjection) {
          const remaining = charBudget - additionalContext.length;
          if (stackInjection.length <= remaining) {
            additionalContext += '\n' + stackInjection;
          }
        }
      } catch { /* fail-open */ }
    }

    // Only append if we actually retrieved something
    if (additionalContext.trim()) {
      return prompt + '\n\n=== RETRIEVED CONTEXT ===\n' + additionalContext + '\n=========================\n';
    }

    return prompt;
  } catch {
    // Fail-open: retrieval errors never prevent quorum dispatch
    return prompt;
  }
}

// ─── Main (CLI entry point) ───────────────────────────────────────────────────

async function main() {
  const slot               = getArg('--slot');
  const mode               = getArg('--mode') || 'A';
  const roundArg           = getArg('--round');
  const question           = getArg('--question') || '';
  const artifactPath       = getArg('--artifact-path') || null;
  const reviewContext      = getArg('--review-context') || null;
  const priorPositionsFile = getArg('--prior-positions-file') || null;
  const tracesFile         = getArg('--traces-file') || null;
  const requestImprovements = hasFlag('--request-improvements');
  const timeoutArg         = getArg('--timeout');
  const cwd                = getArg('--cwd') || process.cwd();

  if (!slot) {
    process.stderr.write('[quorum-slot-dispatch] --slot is required\n');
    process.exit(1);
  }
  if (!roundArg) {
    process.stderr.write('[quorum-slot-dispatch] --round is required\n');
    process.exit(1);
  }

  const round   = parseInt(roundArg, 10);
  const timeout = timeoutArg ? parseInt(timeoutArg, 10) : 30000;

  // Read optional temp files
  let priorPositions = null;
  if (priorPositionsFile) {
    try {
      priorPositions = fs.readFileSync(priorPositionsFile, 'utf8');
    } catch (e) {
      process.stderr.write(`[quorum-slot-dispatch] Could not read prior-positions-file: ${e.message}\n`);
    }
  }

  let traces = null;
  if (tracesFile) {
    try {
      traces = fs.readFileSync(tracesFile, 'utf8');
    } catch (e) {
      process.stderr.write(`[quorum-slot-dispatch] Could not read traces-file: ${e.message}\n`);
    }
  }

  // Build prompt
  const repoDir = cwd;

  // Pre-read artifact file content to inline in prompt (prevents read failures in models)
  const ARTIFACT_MAX_BYTES = 50 * 1024; // 50KB cap
  let artifactContent = null;
  if (artifactPath) {
    try {
      const resolvedPath = path.isAbsolute(artifactPath) ? artifactPath : path.join(cwd, artifactPath);
      const stat = fs.statSync(resolvedPath);
      if (stat.size <= ARTIFACT_MAX_BYTES) {
        artifactContent = fs.readFileSync(resolvedPath, 'utf8');
      } else {
        process.stderr.write(`[quorum-slot-dispatch] artifact too large (${stat.size} bytes > ${ARTIFACT_MAX_BYTES}), models must read it themselves\n`);
      }
    } catch (e) {
      process.stderr.write(`[quorum-slot-dispatch] could not pre-read artifact: ${e.message}\n`);
    }
  }

  // Load and match requirements (fail-open: if loading fails, requirements will be empty)
  const allRequirements = loadRequirements(repoDir);
  const matchedRequirements = matchRequirementsByKeywords(allRequirements, question, artifactPath);

  // Load and match precedents (fail-open: if loading fails, precedents will be empty)
  const allPrecedents = loadPrecedents(repoDir);
  const matchedPrecedents = matchPrecedentsByKeywords(allPrecedents, question);

  // EXEC-01: Determine review mode — Mode B or explicit --review-only flag
  const isReviewMode = mode === 'B' || reviewOnly;

  let prompt;
  if (mode === 'B') {
    prompt = buildModeBPrompt({ round, repoDir, question, artifactPath, artifactContent, reviewContext, priorPositions, traces: traces || '', requirements: matchedRequirements, precedents: matchedPrecedents, reviewOnly: isReviewMode });
  } else {
    prompt = buildModeAPrompt({ round, repoDir, question, artifactPath, artifactContent, reviewContext, priorPositions, requestImprovements, requirements: matchedRequirements, precedents: matchedPrecedents });
  }

  // ── Context retrieval enrichment (ORCH-01) ──────────────────────────────────
  // Check config kill switch via two-layer config-loader merge (DEFAULT_CONFIG -> global -> project).
  // Fail-open: if config load fails, retrieval is ON (default enabled).
  const nfConfig = loadNfConfig(cwd);
  const retrievalEnabled = nfConfig.context_retrieval_enabled !== false;

  if (retrievalEnabled) {
    prompt = enrichPromptWithRetrieval(prompt, question, artifactPath, cwd);
  }

  // Locate call-quorum-slot.cjs relative to this script
  const cqsPath = path.join(__dirname, 'call-quorum-slot.cjs');

  // EXEC-01: Detect ccr-based slot to pass --allowed-tools for review-only restriction
  const isCcrSlot = (() => {
    try {
      const pPath = path.join(__dirname, 'providers.json');
      const providers = JSON.parse(fs.readFileSync(pPath, 'utf8')).providers || [];
      const provider = providers.find(p => p.name === slot);
      return provider && (provider.display_type === 'claude-code-router' || (provider.cli && provider.cli.includes('ccr')));
    } catch { return false; }
  })();

  // Build spawn args — add --allowed-tools for ccr slots in review mode
  const spawnArgs = [cqsPath, '--slot', slot, '--timeout', String(timeout), '--cwd', cwd];
  if (isReviewMode && isCcrSlot) {
    spawnArgs.push('--allowed-tools', 'Read,Grep,Glob');
  }

  // Spawn call-quorum-slot.cjs as child process with stdin pipe
  const rawOutput = await new Promise((resolve) => {
    let child;
    try {
      child = spawn(process.execPath, spawnArgs, {
        stdio: ['pipe', 'pipe', 'pipe']
      });
    } catch (err) {
      resolve({ exitCode: 1, output: `[spawn error: ${err.message}]` });
      return;
    }

    // Write prompt to child stdin and close
    child.stdin.write(prompt, 'utf8');
    child.stdin.end();

    let stdout = '';
    let stderr = '';
    // Cap subprocess output to 50KB — prevents 100K+ responses from overflowing
    // Claude Code's MCP result size limit when emitted via emitResultBlock.
    // The emitResultBlock rawOutput field is already truncated to 5K (line ~780),
    // but capping here avoids buffering megabytes of unused data in memory.
    const MAX_BUF = 50 * 1024;
    let truncated = false;

    child.stdout.on('data', d => {
      if (!truncated) {
        const chunk = d.toString();
        if (stdout.length + chunk.length > MAX_BUF) {
          stdout += chunk.slice(0, MAX_BUF - stdout.length);
          truncated = true;
        } else {
          stdout += chunk;
        }
      }
    });
    child.stderr.on('data', d => {
      stderr += d.toString().slice(0, 4096);
    });

    child.on('close', (code) => {
      const suffix = truncated ? '\n\n[OUTPUT TRUNCATED at 50KB by quorum-slot-dispatch]' : '';
      resolve({ exitCode: code, output: (stdout || stderr || '(no output)') + suffix });
    });

    child.on('error', (err) => {
      resolve({ exitCode: 1, output: `[spawn error: ${err.message}]` });
    });
  });

  const { exitCode, output } = rawOutput;
  const isUnavail = exitCode !== 0 || output.includes('TIMEOUT');

  let result;
  if (isUnavail) {
    result = emitResultBlock({
      slot,
      round,
      verdict: 'UNAVAIL',
      reasoning: `UNAVAIL (${classifyDispatchError(output)}): ${output.slice(0, 200).replace(/\n/g, ' ')}`,
      rawOutput: output,
      isUnavail: true,
      error_type: classifyDispatchError(output),
      unavailMessage: output.slice(0, 500)
    });
  } else {
    const verdict      = parseVerdict(output, mode);
    const reasoning    = parseReasoning(output) || output.slice(0, 400);
    const citations    = parseCitations(output);
    const improvements = requestImprovements ? parseImprovements(output) : [];
    const matchedReqIds = matchedRequirements.map(r => r.id).filter(Boolean);

    result = emitResultBlock({
      slot,
      round,
      verdict,
      reasoning,
      citations,
      improvements: improvements.length > 0 ? improvements : undefined,
      matched_requirement_ids: matchedReqIds,
      rawOutput: output
    });

    // Auto-persist debate trace file (fail-open)
    try {
      const dateStr = new Date().toISOString().slice(0, 10);
      const slug = question.replace(/[^a-z0-9]+/gi, '-').slice(0, 50).toLowerCase().replace(/-+$/, '');
      const traceFilename = `${dateStr}-${slot}-${slug}.md`;
      const debatePath = planningPaths.resolve(cwd, 'quorum-debate', { filename: traceFilename });
      const traceContent = [
        '---',
        `date: ${dateStr}`,
        `question: "${question.replace(/"/g, '\\"')}"`,
        `slot: ${slot}`,
        `round: ${round}`,
        `mode: "${mode || 'unknown'}"`,
        `verdict: ${verdict}`,
        `matched_requirement_ids: [${matchedReqIds.join(', ')}]`,
        `artifact_path: "${artifactPath || ''}"`,
        '---',
        '',
        `# Debate Trace: ${slot} on round ${round}`,
        '',
        '## Reasoning',
        reasoning || '(none)',
        '',
        '## Citations',
        citations || '(none)',
        ''
      ].join('\n');
      fs.mkdirSync(path.dirname(debatePath), { recursive: true });
      fs.writeFileSync(debatePath, traceContent, 'utf8');
    } catch (e) {
      process.stderr.write(`[quorum-slot-dispatch] debate trace write failed: ${e.message}\n`);
    }
  }

  process.stdout.write(result);
  if (!result.endsWith('\n')) process.stdout.write('\n');
  process.exit(0);
}

// ─── Module exports ───────────────────────────────────────────────────────────
module.exports = {
    buildModeAPrompt,
    buildModeBPrompt,
    parseVerdict,
    parseReasoning,
    parseCitations,
    parseImprovements,
    emitResultBlock,
    stripQuotes,
    loadRequirements,
    matchRequirementsByKeywords,
    formatRequirementsSection,
    loadPrecedents,
    matchPrecedentsByKeywords,
    formatPrecedentsSection,
    enrichPromptWithRetrieval,
    classifyDispatchError,
  };

// ─── Entry point guard ────────────────────────────────────────────────────────
if (require.main === module) {
  main().catch(err => {
    process.stderr.write(`[quorum-slot-dispatch] Fatal: ${err.message}\n`);
    process.exit(1);
  });
}
