#!/usr/bin/env node
'use strict';
// bin/generate-petri-net.cjs
// Generates a Graphviz DOT + SVG Petri Net for the QGSD quorum token-passing model.
// Requirements: PET-01, PET-02, PET-03
//
// Usage:
//   node bin/generate-petri-net.cjs
//
// Output:
//   formal/petri/quorum-petri-net.dot  — Graphviz DOT source
//   formal/petri/quorum-petri-net.svg  — Rendered SVG (via @hpcc-js/wasm-graphviz)
//
// No system Graphviz install required — uses @hpcc-js/wasm-graphviz WASM build.

const fs   = require('fs');
const path = require('path');

// Quorum configuration
const QUORUM_SLOTS    = ['gemini', 'opencode', 'copilot', 'codex', 'claude'];
const MIN_QUORUM_SIZE = Math.ceil(QUORUM_SLOTS.length / 2);  // = 3

// Optional --min-quorum=N override (makes PET-03 deadlock check exercisable at runtime)
const minQuorumArg = process.argv.slice(2).find(a => a.startsWith('--min-quorum='));
const effectiveMinQuorum = minQuorumArg
  ? parseInt(minQuorumArg.split('=')[1], 10)
  : MIN_QUORUM_SIZE;

// PET-03: structural deadlock check (pure logic — before any rendering)
// A structural deadlock occurs when the quorum transition can NEVER fire because
// min_quorum_size > available_slots (more approvals needed than slots available)
if (effectiveMinQuorum > QUORUM_SLOTS.length) {
  process.stderr.write(
    '[generate-petri-net] WARNING: Structural deadlock detected.\n' +
    '[generate-petri-net] min_quorum_size (' + effectiveMinQuorum + ') > ' +
    'available_slots (' + QUORUM_SLOTS.length + ').\n' +
    '[generate-petri-net] Quorum transition can never fire.\n'
  );
  // Do NOT exit 1 — still emit the net for documentation purposes (per PET-03)
}

// buildDot: pure function — exported via _pure for unit testing
function buildDot(slots, minQuorum) {
  return [
    'digraph quorum_petri_net {',
    '  rankdir=LR;',
    '  label="QGSD Quorum Petri Net (min_quorum=' + minQuorum + '/' + slots.length + ')";',
    '  node [fontname="Helvetica"];',
    '',
    '  // Places (circles)',
    '  node [shape=circle, fixedsize=true, width=1.2];',
    '  idle         [label="idle"];',
    '  collecting   [label="collecting\\nvotes"];',
    '  deliberating [label="deliberating"];',
    '  decided      [label="decided"];',
    '',
    '  // Transitions (filled rectangles)',
    '  node [shape=rect, height=0.3, width=1.5, style=filled, fillcolor=black, fontcolor=white];',
    '  t_start      [label="start quorum"];',
    '  t_approve    [label="approve\\n(>=' + minQuorum + '/' + slots.length + ')"];',
    '  t_deliberate [label="deliberate"];',
    '  t_force      [label="force decide\\n(max rounds)"];',
    '',
    '  // Arcs (bipartite: place->transition or transition->place only)',
    '  idle -> t_start;',
    '  t_start -> collecting;',
    '  collecting -> t_approve;',
    '  collecting -> t_deliberate;',
    '  t_approve -> decided;',
    '  t_deliberate -> deliberating;',
    '  deliberating -> t_approve;',
    '  deliberating -> t_force;',
    '  t_force -> decided;',
    '}',
  ].join('\n');
}

// Export pure functions for unit testing
module.exports._pure = { buildDot };

// Guard against running main logic when required as a module (test imports)
if (require.main === module) {
  const dotContent = buildDot(QUORUM_SLOTS, effectiveMinQuorum);
  const outDir     = path.join(process.cwd(), 'formal', 'petri');
  const dotPath    = path.join(outDir, 'quorum-petri-net.dot');
  const svgPath    = path.join(outDir, 'quorum-petri-net.svg');

  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(dotPath, dotContent);
  process.stdout.write('[generate-petri-net] DOT written to: ' + dotPath + '\n');

  // PET-02: render DOT to SVG via @hpcc-js/wasm-graphviz (ESM-primary — dynamic import)
  (async () => {
    let Graphviz;
    try {
      ({ Graphviz } = await import('@hpcc-js/wasm-graphviz'));
    } catch (importErr) {
      process.stderr.write(
        '[generate-petri-net] @hpcc-js/wasm-graphviz not installed.\n' +
        '[generate-petri-net] Run: npm install --save-dev @hpcc-js/wasm-graphviz\n'
      );
      process.exit(1);
    }
    try {
      const graphviz = await Graphviz.load();
      const svg      = graphviz.dot(dotContent);
      fs.writeFileSync(svgPath, svg);
      process.stdout.write('[generate-petri-net] SVG written to: ' + svgPath + '\n');
    } catch (renderErr) {
      process.stderr.write('[generate-petri-net] SVG render failed: ' + renderErr.message + '\n');
      process.exit(1);
    }
  })();
}
