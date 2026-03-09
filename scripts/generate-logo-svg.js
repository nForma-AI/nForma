#!/usr/bin/env node
/**
 * generate-logo-svg.js
 *
 * Generates:
 *   docs/assets/nf-logo-2000.svg             (dark background #1a1b26)
 *   docs/assets/nf-logo-2000-transparent.svg (transparent background)
 *
 * Uses SVG primitives — no font dependency, pixel-perfect everywhere.
 * Same rendering technique as generate-terminal-svg.js.
 *
 * Usage:
 *   node scripts/generate-logo-svg.js
 */

'use strict';

const fs   = require('fs');
const path = require('path');

// ─── Colours ──────────────────────────────────────────────────────────────────
const SALMON = '#f4956a';   // n
const CYAN   = '#7dcfff';   // F
const BG     = '#1a1b26';

// ─── Canvas ───────────────────────────────────────────────────────────────────
const SIZE = 2000;

// ─── Cell dimensions — maintain original 8.4 : 22 width : height ratio ───────
const CHAR_W   = 48;
const LINE_H   = Math.round(CHAR_W * 22 / 8.4);   // 126px
const STROKE_W = Math.round(CHAR_W * 1.5 / 8.4);  //   9px

// ─── nForma ANSI Shadow art — n in salmon, F in cyan ───────────────────────────
// logoCol = first column index of the F portion (cyan starts here)
// Matches the install.js banner layout
const ROWS = [
  { t: '          ███████╗', logoCol: 10 },
  { t: '          ██╔════╝', logoCol: 10 },
  { t: ' ██████╗  █████╗',   logoCol: 10 },
  { t: ' ██╔══██╗ ██╔══╝',   logoCol: 10 },
  { t: ' ██║  ██║ ██║',       logoCol: 10 },
  { t: ' ╚═╝  ╚═╝ ╚═╝',      logoCol: 10 },
];

// ─── Centering ────────────────────────────────────────────────────────────────
const COLS    = Math.max(...ROWS.map(r => Array.from(r.t).length));
const logoW   = COLS * CHAR_W;
const logoH   = ROWS.length * LINE_H;
const offsetX = Math.round((SIZE - logoW) / 2);
const offsetY = Math.round((SIZE - logoH) / 2);

// ─── Renderer ─────────────────────────────────────────────────────────────────
function renderRow(row, rowIndex) {
  const { t: rowStr, logoCol: colSplit } = row;
  const cy     = rowIndex * LINE_H;
  const ch     = LINE_H;
  const cw     = CHAR_W;
  const my     = cy + ch / 2;
  const stroke = `stroke-width="${STROKE_W}" stroke-linecap="square" fill="none"`;

  const elems = [];
  Array.from(rowStr).forEach((glyph, col) => {
    if (glyph === ' ') return;
    const fill  = col < colSplit ? SALMON : CYAN;
    const x     = col * cw;
    const mx    = x + cw / 2;
    const f     = `fill="${fill}"`;
    const s     = `stroke="${fill}" ${stroke}`;

    switch (glyph) {
      case '█':
        elems.push(`<rect x="${x}" y="${cy}" width="${cw}" height="${ch}" ${f}/>`);
        break;
      case '╗': // ─┐ horizontal from left → vertical down
        elems.push(`<path d="M${x},${my} H${mx} V${cy + ch}" ${s}/>`);
        break;
      case '╔': // ┌─ horizontal from right → vertical down
        elems.push(`<path d="M${x + cw},${my} H${mx} V${cy + ch}" ${s}/>`);
        break;
      case '╝': // ─┘ horizontal from left → vertical up
        elems.push(`<path d="M${x},${my} H${mx} V${cy}" ${s}/>`);
        break;
      case '╚': // └─ horizontal from right → vertical up
        elems.push(`<path d="M${x + cw},${my} H${mx} V${cy}" ${s}/>`);
        break;
      case '║': // │ vertical line
        elems.push(`<line x1="${mx}" y1="${cy}" x2="${mx}" y2="${cy + ch}" ${s}/>`);
        break;
      case '═': // ─ horizontal line
        elems.push(`<line x1="${x}" y1="${my}" x2="${x + cw}" y2="${my}" ${s}/>`);
        break;
      case '▀': // upper half block
        elems.push(`<rect x="${x}" y="${cy}" width="${cw}" height="${ch / 2}" ${f}/>`);
        break;
      case '▄': // lower half block
        elems.push(`<rect x="${x}" y="${cy + ch / 2}" width="${cw}" height="${ch / 2}" ${f}/>`);
        break;
    }
  });

  return elems.join('\n    ');
}

function buildLogoGroup() {
  return ROWS
    .map((row, i) => renderRow(row, i))
    .filter(Boolean)
    .join('\n    ');
}

// ─── SVG builders ─────────────────────────────────────────────────────────────
function buildDark() {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${SIZE} ${SIZE}" width="${SIZE}" height="${SIZE}">
  <rect fill="${BG}" width="${SIZE}" height="${SIZE}"/>
  <g transform="translate(${offsetX}, ${offsetY})">
    ${buildLogoGroup()}
  </g>
</svg>`;
}

function buildTransparent() {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${SIZE} ${SIZE}" width="${SIZE}" height="${SIZE}">
  <g transform="translate(${offsetX}, ${offsetY})">
    ${buildLogoGroup()}
  </g>
</svg>`;
}

// ─── Write ────────────────────────────────────────────────────────────────────
const { execFileSync } = require('child_process');

const assetsDir      = path.join(__dirname, '../docs/assets');
const darkSvg        = path.join(assetsDir, 'nf-logo-2000.svg');
const darkPng        = path.join(assetsDir, 'nf-logo-2000.png');
const transpSvg      = path.join(assetsDir, 'nf-logo-2000-transparent.svg');
const transpPng      = path.join(assetsDir, 'nf-logo-2000-transparent.png');

fs.writeFileSync(darkSvg,   buildDark(),        'utf8');
fs.writeFileSync(transpSvg, buildTransparent(), 'utf8');

const sz = String(SIZE);
execFileSync('rsvg-convert', ['-w', sz, '-h', sz, '-o', darkPng,  darkSvg]);
execFileSync('rsvg-convert', ['-w', sz, '-h', sz, '-o', transpPng, transpSvg]);

console.log(`✓ Written ${path.basename(darkSvg)} + ${path.basename(darkPng)}`);
console.log(`✓ Written ${path.basename(transpSvg)} + ${path.basename(transpPng)}`);
