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
 * agents/qgsd-quorum-slot-worker.md Step 2, pipes it to call-quorum-slot.cjs via
 * child_process.spawn, parses the output, and emits a structured YAML result block.
 *
 * Exported pure functions (testable without subprocess):
 *   buildModeAPrompt, buildModeBPrompt, parseVerdict, parseReasoning,
 *   parseCitations, parseImprovements, emitResultBlock, stripQuotes
 */

const { spawn }  = require('child_process');
const fs         = require('fs');
const path       = require('path');

// ─── Arg parsing (mirrors call-quorum-slot.cjs pattern) ───────────────────────
const argv   = process.argv.slice(2);
const getArg = (f) => {
  const i = argv.indexOf(f);
  return i !== -1 && argv[i + 1] !== undefined ? argv[i + 1] : null;
};
const hasFlag = (f) => argv.includes(f);

// ─── Pure prompt-construction functions ──────────────────────────────────────

/**
 * buildModeAPrompt — constructs the Mode A question prompt.
 *
 * Matches the EXACT template from agents/qgsd-quorum-slot-worker.md Step 2 Mode A.
 *
 * @param {object} opts
 * @param {number}  opts.round
 * @param {string}  opts.repoDir
 * @param {string}  opts.question
 * @param {string} [opts.artifactPath]
 * @param {string} [opts.reviewContext]
 * @param {string} [opts.priorPositions]   - Round 2+ cross-pollination
 * @param {boolean}[opts.requestImprovements]
 * @returns {string}
 */
function buildModeAPrompt({ round, repoDir, question, artifactPath, reviewContext, priorPositions, requestImprovements }) {
  const lines = [];

  // Header
  lines.push(`QGSD Quorum — Round ${round}`);
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
    lines.push('(Read this file to obtain its full content before evaluating.)');
    lines.push('================');
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
    lines.push('Before revising your position, use your tools to re-check relevant files. At minimum');
    lines.push('re-read CLAUDE.md and .planning/STATE.md if they exist, and re-read the artifact file if');
    lines.push('one was provided.');
    lines.push('');
    lines.push('Given the above, do you maintain your answer or revise it? State your updated position');
    lines.push('clearly (2\u20134 sentences).');

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
    lines.push('IMPORTANT: Before answering, use your available tools to read files from the');
    lines.push('Repository directory above. At minimum read: CLAUDE.md (if it exists),');
    lines.push('.planning/STATE.md (if it exists), and the artifact file at the path shown in the');
    lines.push('Artifact section above (if present). Then read any other files directly relevant to');
    lines.push('the question. Your answer must be grounded in what you actually find in the repo.');
    lines.push('');
    lines.push('You are one AI model in a multi-model quorum. Your peer reviewers are other AI language');
    lines.push('models \u2014 not human experts. Give your honest answer with reasoning. Be concise (3\u20136');
    lines.push('sentences). Do not defer to peer models.');

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
 * Matches the EXACT template from agents/qgsd-quorum-slot-worker.md Step 2 Mode B.
 *
 * @param {object} opts
 * @param {number}  opts.round
 * @param {string}  opts.repoDir
 * @param {string}  opts.question
 * @param {string}  opts.traces             - execution trace output (required for Mode B)
 * @param {string} [opts.artifactPath]
 * @param {string} [opts.reviewContext]
 * @param {string} [opts.priorPositions]   - Round 2+
 * @returns {string}
 */
function buildModeBPrompt({ round, repoDir, question, traces, artifactPath, reviewContext, priorPositions }) {
  const lines = [];

  // Header
  lines.push(`QGSD Quorum — Execution Review (Round ${round})`);
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
    lines.push('(Read this file to obtain its full content before evaluating.)');
    lines.push('================');
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
  lines.push('Before giving your verdict, use your tools to read files from the Repository directory');
  lines.push('above. At minimum read: CLAUDE.md (if it exists), .planning/STATE.md (if it exists), and');
  lines.push('the artifact file at the path shown above (if present).');
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
 * @param {string} [opts.unavailMessage]
 * @returns {string}
 */
function emitResultBlock({ slot, round, verdict, reasoning, citations, improvements, rawOutput, isUnavail, unavailMessage }) {
  const lines = [];

  lines.push(`slot: ${slot}`);
  lines.push(`round: ${round}`);
  lines.push(`verdict: ${verdict}`);

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
  let prompt;
  if (mode === 'B') {
    prompt = buildModeBPrompt({ round, repoDir, question, artifactPath, reviewContext, priorPositions, traces: traces || '' });
  } else {
    prompt = buildModeAPrompt({ round, repoDir, question, artifactPath, reviewContext, priorPositions, requestImprovements });
  }

  // Locate call-quorum-slot.cjs relative to this script
  const cqsPath = path.join(__dirname, 'call-quorum-slot.cjs');

  // Spawn call-quorum-slot.cjs as child process with stdin pipe
  const rawOutput = await new Promise((resolve) => {
    let child;
    try {
      child = spawn(process.execPath, [cqsPath, '--slot', slot, '--timeout', String(timeout), '--cwd', cwd], {
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
    const MAX_BUF = 10 * 1024 * 1024;

    child.stdout.on('data', d => {
      if (stdout.length < MAX_BUF) stdout += d.toString().slice(0, MAX_BUF - stdout.length);
    });
    child.stderr.on('data', d => {
      stderr += d.toString().slice(0, 4096);
    });

    child.on('close', (code) => {
      resolve({ exitCode: code, output: stdout || stderr || '(no output)' });
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
      reasoning: 'Bash call failed or timed out.',
      rawOutput: output,
      isUnavail: true,
      unavailMessage: output.slice(0, 500)
    });
  } else {
    const verdict      = parseVerdict(output, mode);
    const reasoning    = parseReasoning(output) || output.slice(0, 400);
    const citations    = parseCitations(output);
    const improvements = requestImprovements ? parseImprovements(output) : [];

    result = emitResultBlock({
      slot,
      round,
      verdict,
      reasoning,
      citations,
      improvements: improvements.length > 0 ? improvements : undefined,
      rawOutput: output
    });
  }

  process.stdout.write(result);
  if (!result.endsWith('\n')) process.stdout.write('\n');
  process.exit(0);
}

// ─── Module exports ───────────────────────────────────────────────────────────
if (typeof module !== 'undefined') {
  module.exports = {
    buildModeAPrompt,
    buildModeBPrompt,
    parseVerdict,
    parseReasoning,
    parseCitations,
    parseImprovements,
    emitResultBlock,
    stripQuotes,
  };
}

// ─── Entry point guard ────────────────────────────────────────────────────────
if (require.main === module) {
  main().catch(err => {
    process.stderr.write(`[quorum-slot-dispatch] Fatal: ${err.message}\n`);
    process.exit(1);
  });
}
