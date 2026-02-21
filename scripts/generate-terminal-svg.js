#!/usr/bin/env node
/**
 * generate-terminal-svg.js
 *
 * Generates assets/terminal.svg — the terminal screenshot shown in README.md.
 * Mirrors the actual `npx qgsd@latest` install output from bin/install.js.
 *
 * Usage:
 *   node scripts/generate-terminal-svg.js
 *   npm run generate-terminal   (if added to package.json scripts)
 *
 * Re-run whenever you change the version, banner, or install output lines.
 */

'use strict';

const fs   = require('fs');
const path = require('path');

const pkg = JSON.parse(fs.readFileSync(path.join(__dirname, '../package.json'), 'utf8'));

// ─── Colour palette (Tokyo Night) ────────────────────────────────────────────
const COLORS = {
  bg:       '#1a1b26',
  border:   '#24283b',
  titlebar: '#1f2335',
  btnRed:   '#f7768e',
  btnYellow:'#e0af68',
  btnGreen: '#9ece6a',
  salmon:   '#f4956a',   // Q in the QGSD logo
  cyan:     '#7dcfff',   // GSD in the logo + highlights
  green:    '#9ece6a',   // ✓ checkmarks
  dim:      '#565f89',   // muted text
  white:    '#c0caf5',   // normal text
  prompt:   '#7aa2f7',   // shell prompt ~
};

const FONT = "'SF Mono', 'Fira Code', 'JetBrains Mono', Consolas, monospace";

// ─── Layout constants ─────────────────────────────────────────────────────────
const W          = 960;
const H          = 580;
const TITLE_H    = 36;
const PADDING_X  = 32;
const PADDING_Y  = 64;   // top of content area
const LINE_H     = 22;   // pixels per line
const FONT_SIZE  = 14;
const CHAR_W     = FONT_SIZE * 0.6;  // ~8.4px — standard monospace width ratio
const STROKE_W   = 1.5;              // stroke width for box-drawing char paths

// ─── Terminal content ─────────────────────────────────────────────────────────
// Each entry: { parts: [{ text, color }], indent: 0 }
// Mirrors actual install.js banner + install output.

const version = pkg.version;

const LINES = [
  // Prompt + command
  { parts: [{ t: '~', c: COLORS.prompt }, { t: ' $ ', c: COLORS.dim }, { t: 'npx qgsd@latest', c: COLORS.white }] },
  { parts: [] },  // blank

  // QGSD ASCII art — original ANSI Shadow font.
  // Rendered as SVG primitives (rects + paths) — no font dependency, pixel-perfect.
  // Q in salmon (first logoCol cols), GSD in cyan (rest).
  { parts: [{ t: '  ██████╗  ██████╗ ███████╗██████╗ ', c: COLORS.salmon }], logo: true, logoCol: 9 },
  { parts: [{ t: ' ██╔═══██╗██╔════╝ ██╔════╝██╔══██╗', c: COLORS.salmon }], logo: true, logoCol: 10 },
  { parts: [{ t: ' ██║   ██║██║  ███╗███████╗██║  ██║', c: COLORS.salmon }], logo: true, logoCol: 10 },
  { parts: [{ t: ' ██║▄▄ ██║██║   ██║╚════██║██║  ██║', c: COLORS.salmon }], logo: true, logoCol: 10 },
  { parts: [{ t: ' ╚██████╔╝╚██████╔╝███████║██████╔╝', c: COLORS.salmon }], logo: true, logoCol: 10 },
  { parts: [{ t: '  ╚══▀▀═╝  ╚═════╝ ╚══════╝╚═════╝ ', c: COLORS.salmon }], logo: true, logoCol: 10 },

  { parts: [] },  // blank
  { parts: [{ t: `  Quorum Gets Shit Done `, c: COLORS.white }, { t: `v${version}`, c: COLORS.dim }] },
  { parts: [{ t: '  Built on get-shit-done-cc by TÂCHES.', c: COLORS.dim }] },
  { parts: [{ t: '  Full automation through quorum of coding agents. By Jonathan Borduas.', c: COLORS.dim }] },
  { parts: [] },  // blank
  { parts: [{ t: '  The task of leadership is to create an alignment of strengths', c: COLORS.cyan }] },
  { parts: [{ t: '   so strong that it makes the system\u2019s weaknesses irrelevant.', c: COLORS.cyan }] },
  { parts: [{ t: '  \u2014 Peter Drucker', c: COLORS.dim }] },
  { parts: [] },  // blank

  // Install output — show only what matters to the user
  { parts: [{ t: '  ✓', c: COLORS.green }, { t: ' 32 commands installed',   c: COLORS.white }] },
  { parts: [{ t: '  ✓', c: COLORS.green }, { t: ' Quorum hooks configured', c: COLORS.white }] },
  { parts: [] },  // blank

  // Done message
  { parts: [{ t: '  Done! ', c: COLORS.green }, { t: 'Run ', c: COLORS.white }, { t: '/qgsd:help', c: COLORS.cyan }, { t: ' to get started.', c: COLORS.white }] },
  { parts: [] },  // blank

  // New prompt
  { parts: [{ t: '~', c: COLORS.prompt }, { t: ' $ ', c: COLORS.dim }, { t: '▌', c: COLORS.white }] },
];

// ─── SVG builder ─────────────────────────────────────────────────────────────

function esc(s) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// ─── Logo renderer — SVG primitives, no font dependency ──────────────────────
// Each glyph maps to an exact <rect> or <path>. Cell dimensions match the text
// grid so the logo aligns perfectly with the text lines above/below.

function renderLogoLine(lineObj, y) {
  const raw      = lineObj.parts[0].t;
  const colSplit = lineObj.logoCol;
  const cy       = y - LINE_H;          // cell top (seamless with LINE_H rows)
  const ch       = LINE_H;              // cell height
  const cw       = CHAR_W;              // cell width
  const my       = cy + ch / 2;         // cell vertical midpoint
  const stroke   = `stroke-width="${STROKE_W}" stroke-linecap="square" fill="none"`;

  const elems = [];
  Array.from(raw).forEach((glyph, col) => {
    if (glyph === ' ') return;
    const fill = col < colSplit ? COLORS.salmon : COLORS.cyan;
    const x    = col * cw;
    const mx   = x + cw / 2;
    const f    = `fill="${fill}"`;
    const s    = `stroke="${fill}" ${stroke}`;

    switch (glyph) {
      case '█':
        elems.push(`<rect x="${x.toFixed(1)}" y="${cy.toFixed(1)}" width="${cw.toFixed(1)}" height="${ch}" ${f}/>`);
        break;
      case '╗': // ─┐ horizontal from left → vertical down
        elems.push(`<path d="M${x.toFixed(1)},${my.toFixed(1)} H${mx.toFixed(1)} V${(cy+ch).toFixed(1)}" ${s}/>`);
        break;
      case '╔': // ┌─ horizontal from right → vertical down
        elems.push(`<path d="M${(x+cw).toFixed(1)},${my.toFixed(1)} H${mx.toFixed(1)} V${(cy+ch).toFixed(1)}" ${s}/>`);
        break;
      case '╝': // ─┘ horizontal from left → vertical up
        elems.push(`<path d="M${x.toFixed(1)},${my.toFixed(1)} H${mx.toFixed(1)} V${cy.toFixed(1)}" ${s}/>`);
        break;
      case '╚': // └─ horizontal from right → vertical up
        elems.push(`<path d="M${(x+cw).toFixed(1)},${my.toFixed(1)} H${mx.toFixed(1)} V${cy.toFixed(1)}" ${s}/>`);
        break;
      case '║': // │ vertical line
        elems.push(`<line x1="${mx.toFixed(1)}" y1="${cy.toFixed(1)}" x2="${mx.toFixed(1)}" y2="${(cy+ch).toFixed(1)}" ${s}/>`);
        break;
      case '═': // ─ horizontal line
        elems.push(`<line x1="${x.toFixed(1)}" y1="${my.toFixed(1)}" x2="${(x+cw).toFixed(1)}" y2="${my.toFixed(1)}" ${s}/>`);
        break;
      case '▀': // upper half block
        elems.push(`<rect x="${x.toFixed(1)}" y="${cy.toFixed(1)}" width="${cw.toFixed(1)}" height="${(ch/2).toFixed(1)}" ${f}/>`);
        break;
      case '▄': // lower half block
        elems.push(`<rect x="${x.toFixed(1)}" y="${(cy+ch/2).toFixed(1)}" width="${cw.toFixed(1)}" height="${(ch/2).toFixed(1)}" ${f}/>`);
        break;
    }
  });
  return elems.join('\n    ');
}

function buildTextLine(lineObj, y) {
  if (!lineObj.parts.length) return '';   // blank line — nothing to emit

  if (lineObj.logo) return renderLogoLine(lineObj, y);

  const spans = lineObj.parts.map(p =>
    `<tspan fill="${p.c}">${esc(p.t)}</tspan>`
  ).join('');
  return `<text font-family=${JSON.stringify(FONT)} font-size="${FONT_SIZE}" y="${y}" xml:space="preserve">${spans}</text>`;
}

function buildSVG() {
  const contentLines = LINES.map((line, i) =>
    buildTextLine(line, i * LINE_H)
  ).filter(Boolean);

  // Auto-size height to fit content
  const contentHeight = LINES.length * LINE_H + 16;
  const totalH        = Math.max(H, PADDING_Y + contentHeight + 32);

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${totalH}">
  <!-- Window frame -->
  <rect fill="${COLORS.border}" width="${W}" height="${totalH}" rx="12"/>
  <rect fill="${COLORS.bg}" x="1" y="1" width="${W - 2}" height="${totalH - 2}" rx="11"/>

  <!-- Title bar -->
  <rect fill="${COLORS.titlebar}" x="1" y="1" width="${W - 2}" height="${TITLE_H}" rx="11"/>
  <rect fill="${COLORS.bg}" x="1" y="${TITLE_H - 10}" width="${W - 2}" height="12"/>

  <!-- Traffic lights -->
  <circle fill="${COLORS.btnRed}"    cx="24" cy="19" r="7"/>
  <circle fill="${COLORS.btnYellow}" cx="48" cy="19" r="7"/>
  <circle fill="${COLORS.btnGreen}"  cx="72" cy="19" r="7"/>

  <!-- Window title -->
  <text x="${W / 2}" y="24" text-anchor="middle"
        font-family=${JSON.stringify(FONT)} font-size="13" fill="${COLORS.dim}">Terminal</text>

  <!-- Content -->
  <g transform="translate(${PADDING_X}, ${PADDING_Y})">
    ${contentLines.join('\n    ')}
  </g>
</svg>`;
}

// ─── Write output ─────────────────────────────────────────────────────────────

const outPath = path.join(__dirname, '../assets/terminal.svg');
const svg     = buildSVG();
fs.writeFileSync(outPath, svg, 'utf8');
console.log(`✓ Written to ${path.relative(process.cwd(), outPath)}  (v${version})`);
