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

// ─── Terminal content ─────────────────────────────────────────────────────────
// Each entry: { parts: [{ text, color }], indent: 0 }
// Mirrors actual install.js banner + install output.

const version = pkg.version;

const LINES = [
  // Prompt + command
  { parts: [{ t: '~', c: COLORS.prompt }, { t: ' $ ', c: COLORS.dim }, { t: 'npx qgsd@latest', c: COLORS.white }] },
  { parts: [] },  // blank

  // QGSD ASCII art — Q in salmon, GSD in cyan
  { parts: [{ t: '  ██████╗  ██████╗ ███████╗██████╗ ', c: COLORS.salmon, split: 9 }], logo: true, logoCol: 9 },
  { parts: [{ t: ' ██╔═══██╗██╔════╝ ██╔════╝██╔══██╗', c: COLORS.salmon, split: 10 }], logo: true, logoCol: 10 },
  { parts: [{ t: ' ██║   ██║██║  ███╗███████╗██║  ██║', c: COLORS.salmon, split: 10 }], logo: true, logoCol: 10 },
  { parts: [{ t: ' ██║▄▄ ██║██║   ██║╚════██║██║  ██║', c: COLORS.salmon, split: 10 }], logo: true, logoCol: 10 },
  { parts: [{ t: ' ╚██████╔╝╚██████╔╝███████║██████╔╝', c: COLORS.salmon, split: 10 }], logo: true, logoCol: 10 },
  { parts: [{ t: '  ╚══▀▀═╝  ╚═════╝ ╚══════╝╚═════╝ ', c: COLORS.salmon, split: 10 }], logo: true, logoCol: 10 },

  { parts: [] },  // blank
  { parts: [{ t: `  Quorum Gets Shit Done `, c: COLORS.white }, { t: `v${version}`, c: COLORS.dim }] },
  { parts: [{ t: '  Inspired by Get Shit Done by TÂCHES', c: COLORS.dim }] },
  { parts: [] },  // blank

  // Install output
  { parts: [{ t: '  ✓', c: COLORS.green }, { t: ' Installed commands/qgsd', c: COLORS.white }] },
  { parts: [{ t: '  ✓', c: COLORS.green }, { t: ' Installed get-shit-done', c: COLORS.white }] },
  { parts: [{ t: '  ✓', c: COLORS.green }, { t: ' Installed agents',        c: COLORS.white }] },
  { parts: [{ t: '  ✓', c: COLORS.green }, { t: ' Configured quorum hooks', c: COLORS.white }] },
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

function buildTextLine(lineObj, y) {
  if (!lineObj.parts.length) return '';   // blank line — nothing to emit

  if (lineObj.logo) {
    // Split each logo line at logoCol characters: first part salmon, rest cyan
    const raw   = lineObj.parts[0].t;
    const col   = lineObj.logoCol;
    const left  = raw.slice(0, col);
    const right = raw.slice(col);
    return `<text font-family=${JSON.stringify(FONT)} font-size="${FONT_SIZE}" y="${y}" xml:space="preserve">` +
      `<tspan fill="${COLORS.salmon}">${esc(left)}</tspan>` +
      `<tspan fill="${COLORS.cyan}">${esc(right)}</tspan>` +
      `</text>`;
  }

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
