#!/usr/bin/env node
// proximity-embed.mjs — Local embedding cache builder + unlinked candidate discovery
//
// Two outputs:
//   1. embedding-cache.json  — node→vector lookup, consumed by formal-proximity.cjs
//                              for embedding-amplified scoring
//   2. embedding-candidates.json — unlinked high-similarity pairs (discovery mode)
//
// Uses all-MiniLM-L6-v2 via @huggingface/transformers (23MB ONNX, CPU, cached).
'use strict';

import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';

// @huggingface/transformers is an optional dependency (~23MB + ONNX runtime).
// Lazy-load to fail fast with a helpful message if not installed.
let pipeline;
try {
  ({ pipeline } = await import('@huggingface/transformers'));
} catch {
  process.stderr.write(
    '[embed] @huggingface/transformers is not installed.\n' +
    '        Run: npm install @huggingface/transformers\n' +
    '        This is an optional dependency for embedding-amplified proximity.\n'
  );
  process.exit(1);
}

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const FORMAL_DIR = path.join(ROOT, '.planning', 'formal');
const CACHE_FILE = path.join(FORMAL_DIR, 'embedding-cache.json');
const CANDIDATES_FILE = path.join(FORMAL_DIR, 'embedding-candidates.json');
const MODEL_NAME = 'Xenova/all-MiniLM-L6-v2';

// ─────────────────────────────────────────────────────────────────────────────
// CLI
// ─────────────────────────────────────────────────────────────────────────────
const args = process.argv.slice(2);
const DRY_RUN = args.includes('--dry-run');
const JSON_OUT = args.includes('--json');
const CACHE_ONLY = args.includes('--cache-only');
const TOP_K = parseInt(args.find(a => a.startsWith('--top='))?.split('=')[1] || '30', 10);
const THRESHOLD = parseFloat(args.find(a => a.startsWith('--threshold='))?.split('=')[1] || '0.55');

if (args.includes('--help') || args.includes('-h')) {
  console.log(`Usage: node bin/proximity-embed.mjs [options]

Build embedding cache and discover unlinked high-similarity pairs.
Model: all-MiniLM-L6-v2 (23MB ONNX, cached after first download).

Outputs:
  .planning/formal/embedding-cache.json       — node→vector lookup for scoring
  .planning/formal/embedding-candidates.json   — unlinked candidate pairs

Options:
  --cache-only      Build cache only, skip candidate discovery
  --threshold=N     Minimum cosine similarity for candidates (default: 0.55)
  --top=N           Max candidates to output (default: 30)
  --dry-run         Compute but don't write to disk
  --json            Print results to stdout as JSON
  --help            Show this help
`);
  process.exit(0);
}

// ─────────────────────────────────────────────────────────────────────────────
// Extract text representations from formal artifacts
// ─────────────────────────────────────────────────────────────────────────────
function extractDocuments() {
  const docs = []; // { key, type, text }

  // Requirements
  const reqPath = path.join(FORMAL_DIR, 'requirements.json');
  const reqData = readJson(reqPath);
  if (reqData?.requirements) {
    const reqs = Array.isArray(reqData.requirements)
      ? reqData.requirements
      : Object.values(reqData.requirements);
    for (const req of reqs) {
      if (!req.id || !req.text) continue;
      docs.push({
        key: `requirement::${req.id}`,
        type: 'requirement',
        text: `[${req.category || ''}] ${req.id}: ${req.text}`,
      });
    }
  }

  // Scope modules
  const specDir = path.join(FORMAL_DIR, 'spec');
  if (fs.existsSync(specDir)) {
    for (const dir of fs.readdirSync(specDir, { withFileTypes: true })) {
      if (!dir.isDirectory()) continue;
      const scope = readJson(path.join(specDir, dir.name, 'scope.json'));
      if (!scope) continue;
      const concepts = (scope.concepts || []).join(', ');
      const files = (scope.source_files || []).map(f => path.basename(f)).join(', ');
      docs.push({
        key: `formal_module::${dir.name}`,
        type: 'formal_module',
        text: `Module ${dir.name}: concepts=[${concepts}], files=[${files}]`,
      });
    }
  }

  // Formal models
  const regPath = path.join(FORMAL_DIR, 'model-registry.json');
  const regData = readJson(regPath);
  if (regData?.models) {
    for (const [modelPath, info] of Object.entries(regData.models)) {
      const reqs = (info.requirements || []).join(', ');
      const layer = info.source_layer || 'unknown';
      docs.push({
        key: `formal_model::${modelPath}`,
        type: 'formal_model',
        text: `Formal model ${path.basename(modelPath)} (${layer}): covers [${reqs}]`,
      });
    }
  }

  // Invariants
  const invPath = path.join(FORMAL_DIR, 'semantics', 'invariant-catalog.json');
  const invData = readJson(invPath);
  if (invData?.invariants) {
    for (const inv of invData.invariants) {
      const invId = inv.config ? `${inv.name}@${inv.config}` : inv.name;
      docs.push({
        key: `invariant::${invId}`,
        type: 'invariant',
        text: `Invariant ${inv.name}: ${inv.description || ''} [${inv.config || ''}]`,
      });
    }
  }

  // Code files — extract from proximity-index graph nodes.
  // Text is built from filename + connected concepts/modules for semantic context.
  const indexPath = path.join(FORMAL_DIR, 'proximity-index.json');
  const indexData = readJson(indexPath);
  if (indexData?.nodes) {
    for (const [key, node] of Object.entries(indexData.nodes)) {
      if (node.type !== 'code_file') continue;
      const filePath = node.id;
      const basename = path.basename(filePath).replace(/\.(cjs|js|mjs|ts)$/, '');
      // Collect connected concepts and modules for richer text
      const connected = [];
      for (const edge of (node.edges || [])) {
        const target = indexData.nodes[edge.to];
        if (target && (target.type === 'concept' || target.type === 'formal_module')) {
          connected.push(target.id);
        }
      }
      const ctx = connected.length > 0 ? `, context=[${connected.join(', ')}]` : '';
      docs.push({
        key,
        type: 'code_file',
        text: `Code file ${basename} (${filePath})${ctx}`,
      });
    }
  }

  return docs;
}

// ─────────────────────────────────────────────────────────────────────────────
// Load existing graph edges (for candidate filtering)
// ─────────────────────────────────────────────────────────────────────────────
function loadExistingEdges() {
  const indexPath = path.join(FORMAL_DIR, 'proximity-index.json');
  const index = readJson(indexPath);
  if (!index?.nodes) return new Set();

  const edgeSet = new Set();
  for (const [nodeKey, node] of Object.entries(index.nodes)) {
    for (const edge of (node.edges || [])) {
      const pair = [nodeKey, edge.to].sort().join('<->');
      edgeSet.add(pair);
    }
  }
  return edgeSet;
}

// ─────────────────────────────────────────────────────────────────────────────
// Embed documents locally
// ─────────────────────────────────────────────────────────────────────────────
async function embedDocuments(docs) {
  process.stderr.write(`[embed] Loading model (first run downloads ~23MB)...\n`);
  const extractor = await pipeline('feature-extraction', MODEL_NAME, {
    quantized: true,
  });

  process.stderr.write(`[embed] Embedding ${docs.length} documents...\n`);
  const texts = docs.map(d => d.text);
  const output = await extractor(texts, { pooling: 'mean', normalize: true });

  const dim = output.dims[1];
  const embeddings = [];
  for (let i = 0; i < docs.length; i++) {
    embeddings.push(Array.from(output.data.slice(i * dim, (i + 1) * dim)));
  }

  process.stderr.write(`[embed] Done. ${docs.length} vectors × ${dim} dimensions\n`);
  return { embeddings, dim };
}

// ─────────────────────────────────────────────────────────────────────────────
// Build embedding cache (node key → vector)
// ─────────────────────────────────────────────────────────────────────────────
function buildCache(docs, embeddings, dim) {
  // Content fingerprint for staleness detection
  const textConcat = docs.map(d => d.text).join('\n');
  const contentHash = crypto.createHash('sha256').update(textConcat).digest('hex').slice(0, 12);

  const vectors = {};
  for (let i = 0; i < docs.length; i++) {
    vectors[docs[i].key] = embeddings[i];
  }

  return {
    schema_version: '1',
    generated: new Date().toISOString(),
    model: MODEL_NAME,
    dim,
    content_hash: contentHash,
    count: docs.length,
    vectors,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Find unlinked high-similarity pairs
// ─────────────────────────────────────────────────────────────────────────────
function rankCandidates(docs, embeddings, existingEdges, threshold, topK) {
  const candidates = [];

  for (let i = 0; i < docs.length; i++) {
    for (let j = i + 1; j < docs.length; j++) {
      if (docs[i].type === docs[j].type) continue;

      const pairKey = [docs[i].key, docs[j].key].sort().join('<->');
      if (existingEdges.has(pairKey)) continue;

      const sim = cosineSim(embeddings[i], embeddings[j]);
      if (sim >= threshold) {
        candidates.push({
          a: docs[i].key,
          b: docs[j].key,
          similarity: Math.round(sim * 1000) / 1000,
          a_type: docs[i].type,
          b_type: docs[j].type,
          a_text: docs[i].text.slice(0, 120),
          b_text: docs[j].text.slice(0, 120),
        });
      }
    }
  }

  candidates.sort((a, b) => b.similarity - a.similarity);
  return candidates.slice(0, topK);
}

// ─────────────────────────────────────────────────────────────────────────────
// Utilities
// ─────────────────────────────────────────────────────────────────────────────
function readJson(filePath) {
  try { return JSON.parse(fs.readFileSync(filePath, 'utf8')); }
  catch { return null; }
}

function cosineSim(a, b) {
  let dot = 0;
  for (let i = 0; i < a.length; i++) dot += a[i] * b[i];
  return dot;
}

// ─────────────────────────────────────────────────────────────────────────────
// Main
// ─────────────────────────────────────────────────────────────────────────────
async function main() {
  const docs = extractDocuments();
  process.stderr.write(`[embed] Extracted ${docs.length} documents from formal artifacts\n`);

  if (docs.length < 2) {
    process.stderr.write('[embed] Not enough documents to compare. Exiting.\n');
    process.exit(0);
  }

  const { embeddings, dim } = await embedDocuments(docs);

  // Always build the cache
  const cache = buildCache(docs, embeddings, dim);

  if (!DRY_RUN) {
    fs.writeFileSync(CACHE_FILE, JSON.stringify(cache));
    process.stderr.write(`[embed] Cache written: ${path.relative(ROOT, CACHE_FILE)} (${cache.count} vectors)\n`);
  }

  if (CACHE_ONLY) {
    if (JSON_OUT) {
      process.stdout.write(JSON.stringify({ cache_file: CACHE_FILE, count: cache.count, dim }, null, 2) + '\n');
    }
    return;
  }

  // Candidate discovery
  const existingEdges = loadExistingEdges();
  process.stderr.write(`[embed] Loaded ${existingEdges.size} existing graph edges\n`);

  const candidates = rankCandidates(docs, embeddings, existingEdges, THRESHOLD, TOP_K);

  const result = {
    schema_version: '1',
    generated: new Date().toISOString(),
    model: MODEL_NAME,
    config: { threshold: THRESHOLD, top_k: TOP_K },
    stats: {
      documents_embedded: docs.length,
      existing_edges: existingEdges.size,
      candidates_found: candidates.length,
    },
    candidates,
  };

  if (JSON_OUT) {
    process.stdout.write(JSON.stringify(result, null, 2) + '\n');
  } else {
    process.stderr.write(`\n── Embedding Candidates (threshold=${THRESHOLD}, top=${TOP_K}) ──\n\n`);
    for (const c of candidates) {
      process.stderr.write(`  ${c.similarity.toFixed(3)}  ${c.a}  ↔  ${c.b}\n`);
    }
    process.stderr.write(`\n  Total: ${candidates.length} unlinked high-similarity pairs\n`);
  }

  if (!DRY_RUN) {
    fs.writeFileSync(CANDIDATES_FILE, JSON.stringify(result, null, 2));
    process.stderr.write(`  Written to ${path.relative(ROOT, CANDIDATES_FILE)}\n`);
  }
}

main().catch(err => {
  process.stderr.write(`[embed] Fatal: ${err.message}\n`);
  process.exit(1);
});
