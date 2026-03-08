#!/usr/bin/env node
'use strict';

/**
 * solve-tui.cjs — Interactive TUI for browsing and acting on human-gated solve items.
 *
 * Imports sweep functions from nf-solve.cjs and presents items (D->C broken claims,
 * C->R untraced modules, T->R orphan tests, D->R unbacked claims) in a paginated
 * navigable interface with actions: acknowledge as false positive, add regex suppression,
 * view item detail.
 *
 * Requirements: QUICK-228
 *
 * Usage:
 *   node bin/solve-tui.cjs              # launch interactive TUI
 *   node bin/solve-tui.cjs --help       # print usage and exit
 *   node bin/solve-tui.cjs --debug-invariants  # enable runtime invariant checks
 */

const fs = require('fs');
const path = require('path');
const readline = require('readline');

const ROOT = process.cwd();
const FP_PATH = path.join(ROOT, '.planning', 'formal', 'acknowledged-false-positives.json');
const DEBUG_INVARIANTS = process.argv.includes('--debug-invariants');
const PAGE_SIZE = 10;

// ── ANSI helpers ──────────────────────────────────────────────────────────────

const BOLD = '\x1B[1m';
const CYAN = '\x1B[36m';
const YELLOW = '\x1B[33m';
const GREEN = '\x1B[32m';
const RED = '\x1B[31m';
const DIM = '\x1B[2m';
const RESET = '\x1B[0m';
const CLEAR = '\x1B[2J\x1B[0;0H';

// ── Box-drawing characters (follows cross-layer-dashboard.cjs patterns) ──────

const BOX = {
  tl: '\u250C', tr: '\u2510', bl: '\u2514', br: '\u2518',
  h: '\u2500', v: '\u2502',
  ml: '\u251C', mr: '\u2524',
  dtl: '\u2554', dtr: '\u2557', dbl: '\u255A', dbr: '\u255D',
  dh: '\u2550', dv: '\u2551',
};

// ── Data loading ──────────────────────────────────────────────────────────────

const CATEGORIES = [
  { key: 'dtoc', label: 'D->C Broken Claims', sweepFn: 'sweepDtoC', itemKey: 'broken_claims' },
  { key: 'ctor', label: 'C->R Untraced Modules', sweepFn: 'sweepCtoR', itemKey: 'untraced_modules' },
  { key: 'ttor', label: 'T->R Orphan Tests', sweepFn: 'sweepTtoR', itemKey: 'orphan_tests' },
  { key: 'dtor', label: 'D->R Unbacked Claims', sweepFn: 'sweepDtoR', itemKey: 'unbacked_claims' },
];

/**
 * Load sweep data from nf-solve.cjs and normalize to uniform item format.
 * @returns {Object} Map of category key -> { label, items[], error? }
 */
function loadSweepData() {
  let solve;
  try {
    solve = require(path.join(__dirname, 'nf-solve.cjs'));
  } catch (err) {
    const result = {};
    for (const cat of CATEGORIES) {
      result[cat.key] = { label: cat.label, items: [], error: 'Failed to load nf-solve.cjs: ' + err.message };
    }
    return result;
  }

  const result = {};
  for (const cat of CATEGORIES) {
    try {
      const fn = solve[cat.sweepFn];
      if (typeof fn !== 'function') {
        result[cat.key] = { label: cat.label, items: [], error: cat.sweepFn + ' is not a function' };
        continue;
      }
      const sweep = fn();
      const detail = sweep.detail || {};

      let rawItems = [];
      if (cat.key === 'dtoc') {
        rawItems = (detail.broken_claims || []).map(item => ({
          type: 'dtoc',
          summary: `${item.type}: ${item.value}`,
          doc_file: item.doc_file,
          line: item.line,
          claimType: item.type,
          value: item.value,
          reason: item.reason,
          category: item.category,
        }));
      } else if (cat.key === 'ctor') {
        rawItems = (detail.untraced_modules || []).map(item => ({
          type: 'ctor',
          summary: item.file || item,
          file: item.file || item,
        }));
      } else if (cat.key === 'ttor') {
        rawItems = (detail.orphan_tests || []).map(item => ({
          type: 'ttor',
          summary: typeof item === 'string' ? item : item.file || JSON.stringify(item),
          file: typeof item === 'string' ? item : item.file,
        }));
      } else if (cat.key === 'dtor') {
        rawItems = (detail.unbacked_claims || []).map(item => ({
          type: 'dtor',
          summary: item.claim_text || '',
          doc_file: item.doc_file,
          line: item.line,
          claim_text: item.claim_text,
        }));
      }

      result[cat.key] = { label: cat.label, items: rawItems, residual: sweep.residual };
    } catch (err) {
      result[cat.key] = { label: cat.label, items: [], error: 'Error: ' + err.message };
    }
  }

  return result;
}

// ── FP persistence ────────────────────────────────────────────────────────────

function readFPFile() {
  try {
    return JSON.parse(fs.readFileSync(FP_PATH, 'utf8'));
  } catch {
    return { entries: [], patterns: [] };
  }
}

function writeFPFile(data) {
  const tmpPath = FP_PATH + '.tmp';
  try {
    fs.writeFileSync(tmpPath, JSON.stringify(data, null, 2) + '\n', 'utf8');
    fs.renameSync(tmpPath, FP_PATH);
    return true;
  } catch (err) {
    try { fs.unlinkSync(tmpPath); } catch {}
    return false;
  }
}

function acknowledgeItem(item) {
  const fpData = readFPFile();
  const now = new Date().toISOString();

  if (item.type === 'dtoc') {
    fpData.entries.push({
      doc_file: item.doc_file,
      value: item.value,
      type: item.claimType,
      reason: 'Acknowledged via TUI',
      acknowledged_at: now,
    });
  } else {
    const sourceMap = { ctor: 'C->R', ttor: 'T->R', dtor: 'D->R' };
    fpData.entries.push({
      source: sourceMap[item.type] || item.type,
      value: item.file || item.claim_text || item.summary,
      reason: 'Acknowledged via TUI',
      acknowledged_at: now,
    });
  }

  return writeFPFile(fpData);
}

function addRegexPattern(item, regex, reason) {
  const fpData = readFPFile();
  const typeMap = { dtoc: item.claimType || 'general', ctor: 'C->R', ttor: 'T->R', dtor: 'D->R' };
  fpData.patterns.push({
    type: typeMap[item.type] || 'general',
    regex: regex,
    reason: reason,
    enabled: true,
  });
  return writeFPFile(fpData);
}

// ── File context reader ───────────────────────────────────────────────────────

function readFileContext(filePath, targetLine, contextLines) {
  contextLines = contextLines || 3;
  const absPath = path.isAbsolute(filePath) ? filePath : path.join(ROOT, filePath);
  try {
    const content = fs.readFileSync(absPath, 'utf8');
    const lines = content.split('\n');
    return { lines, totalLines: lines.length };
  } catch (err) {
    return { lines: [], totalLines: 0, error: err.message };
  }
}

// ── TUI State ─────────────────────────────────────────────────────────────────

const state = {
  depth: 0,              // 0=main menu, 1=category list, 2=item detail
  selectedCategory: 0,   // index into CATEGORIES
  selectedItem: 0,       // index into filtered items
  page: 0,               // current page in list view
  filter: '',            // text filter
  typeFilter: 'all',     // D->C type filter
  categoryFilter: 'all', // D->C category filter
  viewMode: 'detail',    // 'detail' or 'file'
  fileViewOffset: 0,     // scroll offset for file viewer
  data: null,            // sweep data
  message: '',           // transient status message
  inputMode: null,       // null, 'filter', 'regex', 'reason'
  inputBuffer: '',       // for line input
  pendingRegex: '',      // temp storage during regex flow
  sessionAcknowledged: 0,
  sessionPatterns: 0,
};

// ── Filtering ─────────────────────────────────────────────────────────────────

function getFilteredItems() {
  if (!state.data) return [];
  const catKey = CATEGORIES[state.selectedCategory].key;
  const catData = state.data[catKey];
  if (!catData || !catData.items) return [];

  let items = catData.items;

  // Text filter
  if (state.filter) {
    const lower = state.filter.toLowerCase();
    items = items.filter(item => {
      const searchable = Object.values(item).map(v => String(v)).join(' ').toLowerCase();
      return searchable.includes(lower);
    });
  }

  // D->C type filter
  if (catKey === 'dtoc' && state.typeFilter !== 'all') {
    items = items.filter(item => item.claimType === state.typeFilter);
  }

  // D->C category filter
  if (catKey === 'dtoc' && state.categoryFilter !== 'all') {
    items = items.filter(item => item.category === state.categoryFilter);
  }

  return items;
}

function getTotalPages() {
  const items = getFilteredItems();
  return Math.max(1, Math.ceil(items.length / PAGE_SIZE));
}

function getPageItems() {
  const items = getFilteredItems();
  const start = state.page * PAGE_SIZE;
  return items.slice(start, start + PAGE_SIZE);
}

// ── Rendering ─────────────────────────────────────────────────────────────────

function render() {
  const W = 78;
  const hr = BOX.h.repeat(W);
  const dhr = BOX.dh.repeat(W);
  const lines = [];

  // Header
  lines.push(BOX.dtl + dhr + BOX.dtr);
  const breadcrumb = getBreadcrumb();
  lines.push(BOX.dv + (BOLD + CYAN + '  nForma Solve TUI' + RESET + DIM + '  ' + breadcrumb + RESET).padEnd(W + 20) + BOX.dv);
  lines.push(BOX.dbl + dhr + BOX.dbr);
  lines.push('');

  if (state.depth === 0) {
    renderMainMenu(lines, W, hr);
  } else if (state.depth === 1) {
    renderCategoryList(lines, W, hr);
  } else if (state.depth === 2) {
    if (state.viewMode === 'file') {
      renderFileView(lines, W, hr);
    } else {
      renderItemDetail(lines, W, hr);
    }
  }

  // Message bar
  if (state.message) {
    lines.push('');
    lines.push(GREEN + '  ' + state.message + RESET);
  }

  // Input mode prompt
  if (state.inputMode === 'filter') {
    lines.push('');
    lines.push(YELLOW + '  Filter: ' + state.inputBuffer + '_' + RESET);
  } else if (state.inputMode === 'regex') {
    lines.push('');
    lines.push(YELLOW + '  Regex pattern: ' + state.inputBuffer + '_' + RESET);
  } else if (state.inputMode === 'reason') {
    lines.push('');
    lines.push(YELLOW + '  Reason: ' + state.inputBuffer + '_' + RESET);
  }

  // Footer
  lines.push('');
  lines.push(DIM + '  ' + getFooterHints() + RESET);

  process.stdout.write(CLEAR + lines.join('\n') + '\n');
}

function getBreadcrumb() {
  if (state.depth === 0) return '';
  const catLabel = CATEGORIES[state.selectedCategory].label;
  if (state.depth === 1) return '> ' + catLabel;
  const items = getFilteredItems();
  const item = items[state.selectedItem];
  const itemLabel = item ? truncate(item.summary, 30) : '?';
  return '> ' + catLabel + ' > ' + itemLabel;
}

function getFooterHints() {
  if (state.inputMode) return 'Enter: confirm | ESC: cancel';
  if (state.depth === 0) return 'Up/Down: navigate | Enter: select | q/ESC: quit';
  if (state.depth === 1) {
    let hints = 'Up/Down: navigate | Enter: select | n/p: page | f: filter | ESC: back | q: quit';
    const catKey = CATEGORIES[state.selectedCategory].key;
    if (catKey === 'dtoc') hints += ' | t: type | c: category';
    return hints;
  }
  if (state.depth === 2) {
    if (state.viewMode === 'file') return 'Up/Down: scroll | ESC: back';
    return 'a: acknowledge FP | r: add regex | v: view file | ESC: back | q: quit';
  }
  return '';
}

function renderMainMenu(lines, W, hr) {
  if (!state.data) {
    lines.push('  Loading...');
    return;
  }

  // Stats box
  let totalItems = 0;
  for (const cat of CATEGORIES) {
    const d = state.data[cat.key];
    if (d) totalItems += d.items.length;
  }

  lines.push(BOX.tl + hr + BOX.tr);
  lines.push(BOX.v + BOLD + '  Summary'.padEnd(W) + RESET + BOX.v);
  lines.push(BOX.ml + hr + BOX.mr);
  lines.push(BOX.v + `  Total items: ${totalItems}`.padEnd(W) + BOX.v);
  lines.push(BOX.v + `  Acknowledged this session: ${state.sessionAcknowledged}`.padEnd(W) + BOX.v);
  lines.push(BOX.v + `  Patterns added this session: ${state.sessionPatterns}`.padEnd(W) + BOX.v);
  lines.push(BOX.bl + hr + BOX.br);
  lines.push('');

  // Category list
  lines.push(BOX.tl + hr + BOX.tr);
  lines.push(BOX.v + BOLD + '  Categories'.padEnd(W) + RESET + BOX.v);
  lines.push(BOX.ml + hr + BOX.mr);

  for (let i = 0; i < CATEGORIES.length; i++) {
    const cat = CATEGORIES[i];
    const d = state.data[cat.key];
    const prefix = i === state.selectedCategory ? CYAN + '> ' + RESET : '  ';
    const highlight = i === state.selectedCategory ? BOLD : '';

    let detail = '';
    if (d && d.error) {
      detail = RED + ' (error)' + RESET;
    } else if (d && d.items.length === 0) {
      detail = DIM + ' (empty)' + RESET;
    } else if (d) {
      const count = d.items.length;
      if (cat.key === 'dtoc') {
        // Show type breakdown
        const types = {};
        for (const item of d.items) {
          types[item.claimType] = (types[item.claimType] || 0) + 1;
        }
        const breakdown = Object.entries(types).map(([t, c]) => `${c} ${t}`).join(', ');
        detail = `: ${count} items (${breakdown})`;
      } else {
        detail = `: ${count} items`;
      }
    }

    lines.push(BOX.v + prefix + highlight + cat.label + RESET + detail.padEnd(W - cat.label.length - 2) + BOX.v);
  }

  lines.push(BOX.bl + hr + BOX.br);
}

function renderCategoryList(lines, W, hr) {
  const catKey = CATEGORIES[state.selectedCategory].key;
  const catLabel = CATEGORIES[state.selectedCategory].label;
  const filtered = getFilteredItems();
  const totalPages = getTotalPages();
  const pageItems = getPageItems();

  // Info bar
  lines.push(BOX.tl + hr + BOX.tr);
  const pageInfo = `Page ${state.page + 1}/${totalPages} | ${filtered.length} items`;
  lines.push(BOX.v + BOLD + ('  ' + catLabel).padEnd(W - pageInfo.length - 2) + RESET + DIM + pageInfo + '  ' + RESET + BOX.v);
  lines.push(BOX.ml + hr + BOX.mr);

  // Active filters
  const filters = [];
  if (state.filter) filters.push('text: "' + state.filter + '"');
  if (catKey === 'dtoc' && state.typeFilter !== 'all') filters.push('type: ' + state.typeFilter);
  if (catKey === 'dtoc' && state.categoryFilter !== 'all') filters.push('cat: ' + state.categoryFilter);
  if (filters.length > 0) {
    lines.push(BOX.v + YELLOW + '  Filters: ' + filters.join(' | ') + RESET + ' '.repeat(Math.max(0, W - 12 - filters.join(' | ').length)) + BOX.v);
    lines.push(BOX.ml + hr + BOX.mr);
  }

  if (pageItems.length === 0) {
    lines.push(BOX.v + DIM + '  (no items)'.padEnd(W) + RESET + BOX.v);
  } else {
    for (let i = 0; i < pageItems.length; i++) {
      const globalIdx = state.page * PAGE_SIZE + i;
      const item = pageItems[i];
      const prefix = globalIdx === state.selectedItem ? CYAN + '> ' + RESET : '  ';
      const highlight = globalIdx === state.selectedItem ? BOLD : '';
      const num = String(globalIdx + 1).padStart(3) + '. ';
      const summary = truncate(item.summary, W - 8);
      lines.push(BOX.v + prefix + highlight + num + summary + RESET + ' '.repeat(Math.max(0, W - summary.length - 6)) + BOX.v);
    }
  }

  lines.push(BOX.bl + hr + BOX.br);
}

function renderItemDetail(lines, W, hr) {
  const filtered = getFilteredItems();
  const item = filtered[state.selectedItem];
  if (!item) {
    lines.push('  No item selected');
    return;
  }

  lines.push(BOX.tl + hr + BOX.tr);
  lines.push(BOX.v + BOLD + '  Item Detail'.padEnd(W) + RESET + BOX.v);
  lines.push(BOX.ml + hr + BOX.mr);

  if (item.type === 'dtoc') {
    addDetailLine(lines, W, 'File', item.doc_file);
    addDetailLine(lines, W, 'Line', String(item.line || 'N/A'));
    addDetailLine(lines, W, 'Type', item.claimType);
    addDetailLine(lines, W, 'Value', item.value);
    addDetailLine(lines, W, 'Reason', item.reason);
    addDetailLine(lines, W, 'Category', item.category);
  } else if (item.type === 'ctor') {
    addDetailLine(lines, W, 'File', item.file);
    // Show first 5 lines
    const ctx = readFileContext(item.file);
    if (ctx.error) {
      addDetailLine(lines, W, 'Preview', RED + ctx.error + RESET);
    } else {
      lines.push(BOX.ml + hr + BOX.mr);
      const previewLines = ctx.lines.slice(0, 5);
      for (let i = 0; i < previewLines.length; i++) {
        const ln = DIM + String(i + 1).padStart(4) + BOX.v + RESET + ' ' + truncate(previewLines[i], W - 8);
        lines.push(BOX.v + '  ' + ln + ' '.repeat(Math.max(0, W - ln.length - 2 + 10)) + BOX.v);
      }
    }
  } else if (item.type === 'ttor') {
    addDetailLine(lines, W, 'Test file', item.file);
    const ctx = readFileContext(item.file);
    if (ctx.error) {
      addDetailLine(lines, W, 'Preview', RED + ctx.error + RESET);
    } else {
      lines.push(BOX.ml + hr + BOX.mr);
      const previewLines = ctx.lines.slice(0, 10);
      for (let i = 0; i < previewLines.length; i++) {
        const ln = DIM + String(i + 1).padStart(4) + BOX.v + RESET + ' ' + truncate(previewLines[i], W - 8);
        lines.push(BOX.v + '  ' + ln + ' '.repeat(Math.max(0, W - ln.length - 2 + 10)) + BOX.v);
      }
    }
  } else if (item.type === 'dtor') {
    addDetailLine(lines, W, 'File', item.doc_file);
    addDetailLine(lines, W, 'Line', String(item.line || 'N/A'));
    addDetailLine(lines, W, 'Claim', item.claim_text);
  }

  // Show context lines for items with line numbers
  if ((item.doc_file || item.file) && item.line) {
    const filePath = item.doc_file || item.file;
    const ctx = readFileContext(filePath);
    if (!ctx.error && ctx.lines.length > 0) {
      lines.push(BOX.ml + hr + BOX.mr);
      lines.push(BOX.v + BOLD + '  Context'.padEnd(W) + RESET + BOX.v);
      lines.push(BOX.ml + hr + BOX.mr);
      const startLine = Math.max(0, item.line - 4);
      const endLine = Math.min(ctx.lines.length, item.line + 3);
      for (let i = startLine; i < endLine; i++) {
        const lineNum = String(i + 1).padStart(4);
        const isTarget = i + 1 === item.line;
        const color = isTarget ? YELLOW : '';
        const marker = isTarget ? '>' : ' ';
        const lineText = truncate(ctx.lines[i] || '', W - 10);
        lines.push(BOX.v + color + ' ' + marker + lineNum + BOX.v + ' ' + lineText + RESET + ' '.repeat(Math.max(0, W - lineText.length - 8)) + BOX.v);
      }
    }
  }

  lines.push(BOX.bl + hr + BOX.br);
}

function renderFileView(lines, W, hr) {
  const filtered = getFilteredItems();
  const item = filtered[state.selectedItem];
  if (!item) { lines.push('  No item'); return; }

  const filePath = item.doc_file || item.file;
  if (!filePath) { lines.push('  No file associated'); return; }

  const ctx = readFileContext(filePath);
  if (ctx.error) {
    lines.push('  ' + RED + 'Error: ' + ctx.error + RESET);
    return;
  }

  const viewLines = 20;
  const start = state.fileViewOffset;
  const end = Math.min(ctx.lines.length, start + viewLines);

  lines.push(BOX.tl + hr + BOX.tr);
  const info = `Lines ${start + 1}-${end} of ${ctx.totalLines}`;
  lines.push(BOX.v + BOLD + ('  ' + truncate(filePath, W - info.length - 4)).padEnd(W - info.length - 2) + RESET + DIM + info + '  ' + RESET + BOX.v);
  lines.push(BOX.ml + hr + BOX.mr);

  for (let i = start; i < end; i++) {
    const lineNum = String(i + 1).padStart(4);
    const isTarget = item.line && (i + 1 === item.line);
    const color = isTarget ? YELLOW : '';
    const marker = isTarget ? '>' : ' ';
    const lineText = truncate(ctx.lines[i] || '', W - 10);
    lines.push(BOX.v + color + ' ' + marker + lineNum + BOX.v + ' ' + lineText + RESET + ' '.repeat(Math.max(0, W - lineText.length - 8)) + BOX.v);
  }

  lines.push(BOX.bl + hr + BOX.br);
}

function addDetailLine(lines, W, label, value) {
  const padLabel = (label + ':').padEnd(12);
  const text = '  ' + padLabel + (value || 'N/A');
  lines.push(BOX.v + truncate(text, W).padEnd(W) + BOX.v);
}

function truncate(str, maxLen) {
  if (!str) return '';
  str = String(str);
  if (str.length <= maxLen) return str;
  return str.slice(0, maxLen - 3) + '...';
}

// ── Invariant checks ──────────────────────────────────────────────────────────

function checkInvariants(lastAction, oldDepth) {
  if (!DEBUG_INVARIANTS) return;

  // DepthBounded: depth >= 0 && depth <= 3
  if (state.depth < 0 || state.depth > 3) {
    process.stderr.write(`[INVARIANT VIOLATION] DepthBounded: depth=${state.depth}\n`);
    state.depth = 0;
  }

  // EscapeProgress: ESC always reduces depth
  if (lastAction === 'escape' && state.depth >= oldDepth) {
    process.stderr.write(`[INVARIANT VIOLATION] EscapeProgress: depth went ${oldDepth}->${state.depth}\n`);
    state.depth = Math.max(0, oldDepth - 1);
  }

  // NoDeadlock: at least one valid keypress is handled
  const validKeys = state.depth === 0
    ? ['up', 'down', 'return', 'escape', 'q']
    : state.depth === 1
      ? ['up', 'down', 'return', 'escape', 'q', 'n', 'p', 'f']
      : ['escape', 'q', 'a', 'r', 'v'];
  if (validKeys.length === 0) {
    process.stderr.write(`[INVARIANT VIOLATION] NoDeadlock: no valid keys at depth=${state.depth}\n`);
    state.depth = 0;
  }
}

// ── Input handling ────────────────────────────────────────────────────────────

const TYPE_CYCLE = ['all', 'file_path', 'cli_command', 'dependency'];
const CATEGORY_CYCLE = ['all', 'user', 'developer', 'examples'];

function handleKeypress(str, key) {
  if (!key) return;

  state.message = '';
  const oldDepth = state.depth;

  // Input mode handling (filter, regex, reason prompts)
  if (state.inputMode) {
    handleInputMode(str, key);
    render();
    return;
  }

  // Global: q to quit
  if (key.name === 'q' && !key.ctrl) {
    exitTUI();
    return;
  }

  // Ctrl+C
  if (key.ctrl && key.name === 'c') {
    exitTUI();
    return;
  }

  // ESC: reduce depth (EscapeProgress invariant)
  if (key.name === 'escape') {
    if (state.depth === 2 && state.viewMode === 'file') {
      state.viewMode = 'detail';
    } else if (state.depth > 0) {
      state.depth--;
      if (state.depth === 0) {
        state.filter = '';
        state.typeFilter = 'all';
        state.categoryFilter = 'all';
      }
    } else {
      exitTUI();
      return;
    }
    checkInvariants('escape', oldDepth);
    render();
    return;
  }

  if (state.depth === 0) {
    handleMainMenu(key);
  } else if (state.depth === 1) {
    handleCategoryList(str, key);
  } else if (state.depth === 2) {
    handleItemDetail(str, key);
  }

  checkInvariants(key.name, oldDepth);
  render();
}

function handleMainMenu(key) {
  if (key.name === 'up') {
    state.selectedCategory = Math.max(0, state.selectedCategory - 1);
  } else if (key.name === 'down') {
    state.selectedCategory = Math.min(CATEGORIES.length - 1, state.selectedCategory + 1);
  } else if (key.name === 'return') {
    state.depth = 1;
    state.selectedItem = 0;
    state.page = 0;
    state.filter = '';
    state.typeFilter = 'all';
    state.categoryFilter = 'all';
  }
}

function handleCategoryList(str, key) {
  const filtered = getFilteredItems();

  if (key.name === 'up') {
    state.selectedItem = Math.max(0, state.selectedItem - 1);
    // Adjust page if needed
    state.page = Math.floor(state.selectedItem / PAGE_SIZE);
  } else if (key.name === 'down') {
    state.selectedItem = Math.min(filtered.length - 1, state.selectedItem + 1);
    state.page = Math.floor(state.selectedItem / PAGE_SIZE);
  } else if (key.name === 'return') {
    if (filtered.length > 0 && state.selectedItem < filtered.length) {
      state.depth = 2;
      state.viewMode = 'detail';
      state.fileViewOffset = 0;
    }
  } else if (str === 'n' || key.name === 'pagedown') {
    const totalPages = getTotalPages();
    if (state.page < totalPages - 1) {
      state.page++;
      state.selectedItem = state.page * PAGE_SIZE;
    }
  } else if (str === 'p' || key.name === 'pageup') {
    if (state.page > 0) {
      state.page--;
      state.selectedItem = state.page * PAGE_SIZE;
    }
  } else if (str === 'f') {
    if (state.filter) {
      state.filter = '';
      state.selectedItem = 0;
      state.page = 0;
    } else {
      state.inputMode = 'filter';
      state.inputBuffer = '';
    }
  } else if (str === 't') {
    const catKey = CATEGORIES[state.selectedCategory].key;
    if (catKey === 'dtoc') {
      const idx = TYPE_CYCLE.indexOf(state.typeFilter);
      state.typeFilter = TYPE_CYCLE[(idx + 1) % TYPE_CYCLE.length];
      state.selectedItem = 0;
      state.page = 0;
    }
  } else if (str === 'c') {
    const catKey = CATEGORIES[state.selectedCategory].key;
    if (catKey === 'dtoc') {
      const idx = CATEGORY_CYCLE.indexOf(state.categoryFilter);
      state.categoryFilter = CATEGORY_CYCLE[(idx + 1) % CATEGORY_CYCLE.length];
      state.selectedItem = 0;
      state.page = 0;
    }
  }
}

function handleItemDetail(str, key) {
  if (state.viewMode === 'file') {
    // File viewer mode
    const item = getFilteredItems()[state.selectedItem];
    if (!item) return;
    const filePath = item.doc_file || item.file;
    if (!filePath) return;
    const ctx = readFileContext(filePath);
    if (key.name === 'up') {
      state.fileViewOffset = Math.max(0, state.fileViewOffset - 1);
    } else if (key.name === 'down') {
      state.fileViewOffset = Math.min(Math.max(0, ctx.totalLines - 20), state.fileViewOffset + 1);
    }
    return;
  }

  // Detail mode actions
  if (str === 'a') {
    const items = getFilteredItems();
    const item = items[state.selectedItem];
    if (item) {
      const ok = acknowledgeItem(item);
      if (ok) {
        state.sessionAcknowledged++;
        state.message = 'Acknowledged -- will be suppressed on next sweep';
        // Remove from in-memory list
        const catKey = CATEGORIES[state.selectedCategory].key;
        const catItems = state.data[catKey].items;
        const originalIdx = catItems.indexOf(item);
        if (originalIdx >= 0) catItems.splice(originalIdx, 1);
        state.depth = 1;
        state.selectedItem = Math.min(state.selectedItem, getFilteredItems().length - 1);
        if (state.selectedItem < 0) state.selectedItem = 0;
        state.page = Math.floor(state.selectedItem / PAGE_SIZE);
      } else {
        state.message = RED + 'Error writing acknowledgment file' + RESET;
      }
    }
  } else if (str === 'r') {
    state.inputMode = 'regex';
    state.inputBuffer = '';
  } else if (str === 'v') {
    const item = getFilteredItems()[state.selectedItem];
    if (item && (item.doc_file || item.file)) {
      state.viewMode = 'file';
      state.fileViewOffset = 0;
      if (item.line) {
        state.fileViewOffset = Math.max(0, item.line - 10);
      }
    } else {
      state.message = 'No file associated with this item';
    }
  }
}

function handleInputMode(str, key) {
  if (key.name === 'escape') {
    state.inputMode = null;
    state.inputBuffer = '';
    return;
  }

  if (key.name === 'return') {
    if (state.inputMode === 'filter') {
      state.filter = state.inputBuffer;
      state.selectedItem = 0;
      state.page = 0;
      state.inputMode = null;
      state.inputBuffer = '';
    } else if (state.inputMode === 'regex') {
      // Validate regex
      try {
        new RegExp(state.inputBuffer);
        state.pendingRegex = state.inputBuffer;
        state.inputMode = 'reason';
        state.inputBuffer = '';
      } catch (err) {
        state.message = RED + 'Invalid regex: ' + err.message + RESET;
        state.inputBuffer = '';
      }
    } else if (state.inputMode === 'reason') {
      const item = getFilteredItems()[state.selectedItem];
      if (item) {
        const ok = addRegexPattern(item, state.pendingRegex, state.inputBuffer || 'Added via TUI');
        if (ok) {
          state.sessionPatterns++;
          state.message = 'Pattern added -- will be applied on next sweep';
          state.depth = 1;
          state.selectedItem = Math.min(state.selectedItem, getFilteredItems().length - 1);
          if (state.selectedItem < 0) state.selectedItem = 0;
        } else {
          state.message = RED + 'Error writing pattern file' + RESET;
        }
      }
      state.inputMode = null;
      state.inputBuffer = '';
      state.pendingRegex = '';
    }
    return;
  }

  if (key.name === 'backspace') {
    state.inputBuffer = state.inputBuffer.slice(0, -1);
    return;
  }

  // Regular character input
  if (str && !key.ctrl && !key.meta && str.length === 1) {
    state.inputBuffer += str;
  }
}

// ── Terminal management ───────────────────────────────────────────────────────

function exitTUI() {
  if (process.stdin.isTTY) {
    process.stdin.setRawMode(false);
  }
  process.stdin.removeAllListeners('keypress');

  console.log('');
  console.log(BOLD + 'Session Summary' + RESET);
  console.log(`  Acknowledged: ${state.sessionAcknowledged} items`);
  console.log(`  Patterns added: ${state.sessionPatterns}`);
  console.log('');
  process.exit(0);
}

// ── Help text ─────────────────────────────────────────────────────────────────

function printHelp() {
  console.log(`
${BOLD}nForma Solve TUI${RESET} — Interactive browser for human-gated solve items

${BOLD}Usage:${RESET}
  node bin/solve-tui.cjs              Launch interactive TUI
  node bin/solve-tui.cjs --help       Show this help
  node bin/solve-tui.cjs --debug-invariants  Enable runtime invariant checks

${BOLD}Navigation:${RESET}
  Up/Down     Navigate within lists
  Enter       Select item / enter category
  ESC         Go back one level (always reduces depth)
  q           Quit from any level
  n/p         Next/Previous page in list view
  PgUp/PgDn   Same as n/p

${BOLD}Filtering (in list view):${RESET}
  f           Toggle text filter
  t           Cycle type filter (D->C only: all/file_path/cli_command/dependency)
  c           Cycle category filter (D->C only: all/user/developer/examples)

${BOLD}Actions (in item detail):${RESET}
  a           Acknowledge item as false positive
  r           Add regex suppression pattern
  v           View file content around the item

${BOLD}Data Sources:${RESET}
  D->C        Broken structural claims in documentation
  C->R        Source modules with no requirement tracing
  T->R        Test files with no requirement annotation
  D->R        Documentation claims without requirement backing
`);
}

// ── Main ──────────────────────────────────────────────────────────────────────

function main() {
  if (process.argv.includes('--help') || process.argv.includes('-h')) {
    printHelp();
    process.exit(0);
  }

  // Load data
  state.data = loadSweepData();

  // Check if all empty
  let totalItems = 0;
  for (const cat of CATEGORIES) {
    const d = state.data[cat.key];
    if (d) totalItems += d.items.length;
  }
  if (totalItems === 0) {
    console.log(GREEN + 'All clean! No human-gated items found.' + RESET);
    process.exit(0);
  }

  // Enter raw mode
  if (!process.stdin.isTTY) {
    console.error('Error: solve-tui requires an interactive terminal (TTY)');
    process.exit(1);
  }

  readline.emitKeypressEvents(process.stdin);
  process.stdin.setRawMode(true);
  process.stdin.resume();
  process.stdin.on('keypress', handleKeypress);

  render();
}

// ── Requirement & TODO creation ───────────────────────────────────────────

/**
 * Create a requirement from a solve item (C->R, T->R, or D->R).
 * @param {Object} item  Normalized solve item
 * @param {string} catKey  Category key: 'ctor', 'ttor', 'dtor'
 * @returns {{ ok: boolean, id?: string, reason?: string }}
 */
function createRequirementFromItem(item, catKey) {
  const rc = require(path.join(__dirname, 'requirements-core.cjs'));
  const prefixMap = { ctor: 'Code module', ttor: 'Test file', dtor: 'Doc claim' };
  const prefix = prefixMap[catKey] || 'Solve item';

  const id = rc.nextRequirementId('SOLVE');
  const reqObj = {
    id,
    text: prefix + ': ' + (item.file || item.claim_text || item.value || item.summary),
    category: 'Solver-Discovered',
    status: 'Proposed',
    provenance: {
      source_file: item.file || item.doc_file,
      milestone: 'solver-tui',
    },
  };

  return rc.addRequirement(reqObj);
}

/**
 * Create a TODO item from a D->C broken claim.
 * @param {Object} item  Normalized D->C solve item
 * @returns {{ ok: boolean, id?: string }}
 */
function createTodoFromItem(item) {
  const todoPath = path.join(ROOT, '.planning', 'todos.json');
  let todoData;
  try {
    todoData = JSON.parse(fs.readFileSync(todoPath, 'utf8'));
  } catch (_) {
    todoData = { created_at: new Date().toISOString(), items: [] };
  }
  if (!Array.isArray(todoData.items)) todoData.items = [];

  const now = new Date().toISOString();
  const id = 'TODO-' + Date.now();
  todoData.items.push({
    id,
    source: 'solver-dtoc',
    file: item.doc_file,
    value: item.value,
    reason: item.reason,
    line: item.line,
    created_at: now,
  });

  // Atomic write
  const tmpPath = todoPath + '.tmp';
  try {
    fs.writeFileSync(tmpPath, JSON.stringify(todoData, null, 2) + '\n', 'utf8');
    fs.renameSync(tmpPath, todoPath);
  } catch (err) {
    try { fs.unlinkSync(tmpPath); } catch (_) {}
    return { ok: false, reason: err.message };
  }

  return { ok: true, id };
}

// ── Exports ───────────────────────────────────────────────────────────────────

if (require.main === module) {
  main();
} else {
  module.exports = {
    loadSweepData,
    readFPFile,
    writeFPFile,
    acknowledgeItem,
    addRegexPattern,
    readFileContext,
    CATEGORIES,
    createRequirementFromItem,
    createTodoFromItem,
  };
}
