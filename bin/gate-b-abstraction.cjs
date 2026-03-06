#!/usr/bin/env node
'use strict';

/**
 * gate-b-abstraction.cjs — Gate B L2-L3 traceability verification.
 *
 * Verifies every L3 reasoning artifact entry has valid derived_from links
 * to L2 semantics sources. Reports orphaned hazards.
 *
 * Requirements: GATE-02
 *
 * Usage:
 *   node bin/gate-b-abstraction.cjs            # print summary to stdout
 *   node bin/gate-b-abstraction.cjs --json     # print full results JSON to stdout
 */

const fs   = require('fs');
const path = require('path');

const ROOT = process.env.PROJECT_ROOT || path.join(__dirname, '..');
const FORMAL = path.join(ROOT, '.planning', 'formal');
const GATES_DIR = path.join(FORMAL, 'gates');
const REASONING_DIR = path.join(FORMAL, 'reasoning');
const SEMANTICS_DIR = path.join(FORMAL, 'semantics');
const EVIDENCE_DIR = path.join(FORMAL, 'evidence');
const OUT_FILE = path.join(GATES_DIR, 'gate-b-abstraction.json');

const JSON_FLAG = process.argv.includes('--json');

// ── L2 artifact cache ──────────────────────────────────────────────────────

const l2Cache = {};

function loadL2Artifact(artifactRelPath) {
  if (l2Cache[artifactRelPath]) return l2Cache[artifactRelPath];

  const fullPath = path.join(FORMAL, artifactRelPath);
  if (!fs.existsSync(fullPath)) return null;

  let data;
  if (fullPath.endsWith('.jsonl')) {
    data = fs.readFileSync(fullPath, 'utf8')
      .trim().split('\n').filter(Boolean).map(line => JSON.parse(line));
  } else {
    data = JSON.parse(fs.readFileSync(fullPath, 'utf8'));
  }

  l2Cache[artifactRelPath] = data;
  return data;
}

// ── Link resolution ─────────────────────────────────────────────────────────

/**
 * Resolve a derived_from link by loading the referenced L2 artifact and
 * navigating to the ref path. Returns true if the link is valid.
 */
function resolveL2Link(link) {
  if (!link || !link.artifact || !link.ref) return false;

  const data = loadL2Artifact(link.artifact);
  if (data === null) return false;

  // For JSONL (mismatch-register), just verify the file loaded (array)
  if (link.artifact.endsWith('.jsonl')) {
    return Array.isArray(data) && data.length > 0;
  }

  // For L3 self-references (reasoning/ artifacts), verify file exists
  if (link.layer === 'L3') {
    const l3Path = path.join(FORMAL, link.artifact);
    return fs.existsSync(l3Path);
  }

  const ref = link.ref;

  // Handle array filter refs: invariants[name=X,config=Y] or invariants[config=X]
  const arrayFilterMatch = ref.match(/^(\w+)\[(.+)\]$/);
  if (arrayFilterMatch) {
    const arrayKey = arrayFilterMatch[1];
    const filterStr = arrayFilterMatch[2];
    const arr = data[arrayKey];
    if (!Array.isArray(arr)) return false;

    // Parse filter conditions: key=value pairs
    const conditions = filterStr.split(',').map(c => {
      const [k, v] = c.trim().split('=');
      return { key: k, value: v };
    });

    // Find at least one item matching all conditions
    return arr.some(item =>
      conditions.every(cond => String(item[cond.key]) === cond.value)
    );
  }

  // Handle dot-path navigation: observed_transitions.IDLE.QUORUM_START
  const parts = ref.split('.');
  let current = data;
  for (const part of parts) {
    // Handle wildcard: sessions[*].actions
    if (part === '*' || part.includes('[*]')) {
      // For wildcard refs, just check the parent array/object exists
      return current !== undefined && current !== null;
    }
    if (current === undefined || current === null) return false;
    if (typeof current !== 'object') return false;
    current = current[part];
  }

  return current !== undefined && current !== null;
}

// ── Gate B check ────────────────────────────────────────────────────────────

function checkGateB(l3Artifacts) {
  let totalEntries = 0;
  let groundedEntries = 0;
  const orphans = [];

  for (const { name, entries } of l3Artifacts) {
    for (const entry of entries) {
      totalEntries++;

      if (!entry.derived_from || !Array.isArray(entry.derived_from) || entry.derived_from.length === 0) {
        orphans.push({
          artifact: name,
          entry_id: entry.id || 'unknown',
          reason: 'missing or empty derived_from',
        });
        continue;
      }

      let allValid = true;
      for (const link of entry.derived_from) {
        if (!resolveL2Link(link)) {
          allValid = false;
          orphans.push({
            artifact: name,
            entry_id: entry.id || 'unknown',
            reason: `broken link: ${link.artifact}#${link.ref}`,
          });
          break; // Report first broken link only
        }
      }

      if (allValid) groundedEntries++;
    }
  }

  const gateBScore = totalEntries > 0 ? groundedEntries / totalEntries : 0;

  return {
    schema_version: '1',
    generated: new Date().toISOString(),
    gate_b_score: Math.round(gateBScore * 10000) / 10000, // 4 decimal places
    total_entries: totalEntries,
    grounded_entries: groundedEntries,
    orphaned_entries: orphans.length,
    orphans,
    target: 1.0,
    target_met: gateBScore >= 1.0,
  };
}

// ── Entry point ─────────────────────────────────────────────────────────────

function main() {
  // Load L3 reasoning artifacts
  const l3Artifacts = [];

  const hazardPath = path.join(REASONING_DIR, 'hazard-model.json');
  if (fs.existsSync(hazardPath)) {
    const hm = JSON.parse(fs.readFileSync(hazardPath, 'utf8'));
    l3Artifacts.push({ name: 'hazard-model.json', entries: hm.hazards || [] });
  }

  const fmPath = path.join(REASONING_DIR, 'failure-mode-catalog.json');
  if (fs.existsSync(fmPath)) {
    const fm = JSON.parse(fs.readFileSync(fmPath, 'utf8'));
    l3Artifacts.push({ name: 'failure-mode-catalog.json', entries: fm.failure_modes || [] });
  }

  const rhPath = path.join(REASONING_DIR, 'risk-heatmap.json');
  if (fs.existsSync(rhPath)) {
    const rh = JSON.parse(fs.readFileSync(rhPath, 'utf8'));
    l3Artifacts.push({ name: 'risk-heatmap.json', entries: rh.transitions || [] });
  }

  if (l3Artifacts.length === 0) {
    console.error('ERROR: No L3 reasoning artifacts found in', REASONING_DIR);
    process.exit(1);
  }

  const result = checkGateB(l3Artifacts);

  // Write output
  fs.mkdirSync(GATES_DIR, { recursive: true });
  fs.writeFileSync(OUT_FILE, JSON.stringify(result, null, 2) + '\n');

  // Emit check result
  try {
    const { writeCheckResult } = require(path.join(__dirname, 'write-check-result.cjs'));
    writeCheckResult({
      tool: 'gate-b-abstraction',
      formalism: 'trace',
      result: result.target_met ? 'pass' : 'fail',
      check_id: 'gate-b:abstraction-score',
      surface: 'trace',
      property: `Gate B traceability score: ${(result.gate_b_score * 100).toFixed(1)}% (target: 100%)`,
      runtime_ms: 0,
      summary: `${result.target_met ? 'pass' : 'fail'}: traceability ${(result.gate_b_score * 100).toFixed(1)}%, ${result.grounded_entries}/${result.total_entries} grounded`,
      requirement_ids: ['GATE-02'],
      metadata: { gate_b_score: result.gate_b_score, target: result.target, target_met: result.target_met },
    });
  } catch (e) {
    // write-check-result.cjs not available; skip
  }

  if (JSON_FLAG) {
    process.stdout.write(JSON.stringify(result));
  } else {
    console.log(`Gate B: L2-L3 Traceability`);
    console.log(`  Score: ${(result.gate_b_score * 100).toFixed(1)}%`);
    console.log(`  Total entries: ${result.total_entries}`);
    console.log(`  Grounded: ${result.grounded_entries}`);
    console.log(`  Orphaned: ${result.orphaned_entries}`);
    console.log(`  Target met: ${result.target_met}`);
    if (result.orphans.length > 0) {
      console.log(`  Orphan details:`);
      for (const o of result.orphans) {
        console.log(`    - ${o.artifact} / ${o.entry_id}: ${o.reason}`);
      }
    }
    console.log(`  Output: ${OUT_FILE}`);
  }

  process.exit(result.target_met ? 0 : 1);
}

if (require.main === module) main();

module.exports = { checkGateB, resolveL2Link, main };
