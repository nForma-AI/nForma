#!/usr/bin/env node
'use strict';
// bin/count-scenarios.cjs
// Counts scenarios (instance upper-bound) for every formal model across all frameworks.
// Outputs a sorted table: biggest models first, so you know what to split.
//
// Frameworks: Alloy (.als), TLA+ (.tla via state-space-report.json), UPPAAL (.xml)
//
// Usage:
//   node bin/count-scenarios.cjs              # table to stdout
//   node bin/count-scenarios.cjs --json       # JSON to stdout

const fs   = require('fs');
const path = require('path');

const ROOT       = process.cwd();
const ALLOY_DIR  = path.join(ROOT, '.planning', 'formal', 'alloy');
const TLA_REPORT = path.join(ROOT, '.planning', 'formal', 'state-space-report.json');
const UPPAAL_DIR = path.join(ROOT, '.planning', 'formal', 'uppaal');

const jsonMode = process.argv.includes('--json');

// ── Alloy parser ─────────────────────────────────────────────────────────────

function parseAlloySigs(content) {
  const sigs = [];
  const sigRegex = /\b(abstract\s+)?(one\s+|lone\s+)?sig\s+(\w+(?:\s*,\s*\w+)*)\s*(?:extends\s+(\w+)\s*)?\{([^}]*)\}/g;
  let match;
  while ((match = sigRegex.exec(content)) !== null) {
    const isAbstract = !!match[1];
    const mult = (match[2] || '').trim();
    const nameStr = match[3];
    const parent = match[4] || null;
    const body = match[5];

    const names = nameStr.split(',').map(function(n) { return n.trim(); }).filter(Boolean);
    for (const name of names) {
      const fields = parseFields(body);
      sigs.push({ name, isAbstract, mult, parent, fields });
    }
  }
  return sigs;
}

function parseFields(body) {
  const fields = [];
  const lines = body.split(',');
  for (const line of lines) {
    const trimmed = line.replace(/--.*$/, '').trim();
    if (!trimmed) continue;
    const fieldMatch = trimmed.match(/^(\w+)\s*:\s*(one\s+|set\s+|lone\s+|seq\s+)?(.+)$/);
    if (fieldMatch) {
      fields.push({
        name: fieldMatch[1],
        mult: (fieldMatch[2] || 'one').trim(),
        type: fieldMatch[3].trim(),
      });
    }
  }
  return fields;
}

function parseAlloyCommands(content) {
  const commands = [];
  const cmdRegex = /\b(run|check)\s+(?:(\w+)\s*)?(?:\{[^}]*\}\s*)?for\s+(.+)/g;
  let match;
  while ((match = cmdRegex.exec(content)) !== null) {
    const type = match[1];
    const name = match[2] || '(anonymous)';
    const scopeStr = match[3].trim();
    const scope = parseScopeStr(scopeStr);
    commands.push({ type, name, scopeStr, scope });
  }
  return commands;
}

function parseScopeStr(scopeStr) {
  var scope = {};
  var defaultScope = null;

  var clean = scopeStr.replace(/--.*$/, '').trim();
  var butMatch = clean.match(/^(\d+)\s+but\s+(.+)$/);
  var entries = butMatch ? butMatch[2] : clean;
  if (butMatch) {
    defaultScope = parseInt(butMatch[1], 10);
  }

  var parts = entries.split(',');
  for (var i = 0; i < parts.length; i++) {
    var trimmed = parts[i].trim();
    var m = trimmed.match(/^(\d+)\s+(\w+)$/);
    if (m) {
      scope[m[2]] = parseInt(m[1], 10);
    } else {
      var bareNum = trimmed.match(/^(\d+)$/);
      if (bareNum && defaultScope === null) {
        defaultScope = parseInt(bareNum[1], 10);
      }
    }
  }

  if (defaultScope !== null) {
    scope._default = defaultScope;
  }

  return scope;
}

function getSigScope(sigName, scope, sigs) {
  if (scope[sigName] !== undefined) return scope[sigName];

  var sig = sigs.find(function(s) { return s.name === sigName; });
  if (sig && sig.mult === 'one') return 1;
  if (sig && sig.mult === 'lone') return 1;

  if (scope._default !== undefined) return scope._default;
  return 3;
}

function getIntBits(scope) {
  return scope['int'] || scope['Int'] || 4;
}

function estimateAlloyScenarios(sigs, cmd) {
  var scope = cmd.scope;
  var intBits = getIntBits(scope);
  var intRange = Math.pow(2, intBits);

  var sigAtoms = {};
  for (var i = 0; i < sigs.length; i++) {
    var sig = sigs[i];
    if (sig.isAbstract && !sig.mult) {
      sigAtoms[sig.name] = 0;
    } else {
      sigAtoms[sig.name] = getSigScope(sig.name, scope, sigs);
    }
  }

  // Abstract sigs: count = sum of children
  for (var i = 0; i < sigs.length; i++) {
    var sig = sigs[i];
    if (sig.isAbstract && !sig.mult) {
      var children = sigs.filter(function(s) { return s.parent === sig.name; });
      var sum = 0;
      for (var j = 0; j < children.length; j++) {
        sum += (sigAtoms[children[j].name] || 0);
      }
      sigAtoms[sig.name] = sum;
    }
  }

  var totalScenarios = 1n;

  for (var i = 0; i < sigs.length; i++) {
    var sig = sigs[i];
    var atomCount = sigAtoms[sig.name] || 0;
    if (atomCount === 0) continue;

    for (var k = 0; k < sig.fields.length; k++) {
      var field = sig.fields[k];
      var targetSize;

      if (field.type === 'Int' || field.type === 'int') {
        targetSize = intRange;
      } else if (field.type === 'Bool' || field.type === 'BOOLEAN') {
        targetSize = 2;
      } else if (sigAtoms[field.type] !== undefined) {
        targetSize = sigAtoms[field.type];
      } else {
        targetSize = scope._default || 3;
      }

      if (targetSize <= 0) targetSize = 1;

      var fieldScenarios;
      if (field.mult === 'one') {
        fieldScenarios = BigInt(targetSize) ** BigInt(atomCount);
      } else if (field.mult === 'lone') {
        fieldScenarios = BigInt(targetSize + 1) ** BigInt(atomCount);
      } else if (field.mult === 'set') {
        fieldScenarios = (2n ** BigInt(targetSize)) ** BigInt(atomCount);
      } else if (field.mult === 'seq') {
        fieldScenarios = BigInt(targetSize) ** BigInt(atomCount * 3);
      } else {
        fieldScenarios = BigInt(targetSize) ** BigInt(atomCount);
      }

      totalScenarios *= fieldScenarios;
    }
  }

  return totalScenarios;
}

function analyzeAlloyModel(filePath) {
  var content = fs.readFileSync(filePath, 'utf8');
  var sigs = parseAlloySigs(content);
  var commands = parseAlloyCommands(content);

  var results = [];
  for (var i = 0; i < commands.length; i++) {
    var scenarios = estimateAlloyScenarios(sigs, commands[i]);
    results.push({
      command: commands[i].type + ' ' + commands[i].name,
      scope: commands[i].scopeStr,
      scenarios: scenarios,
    });
  }

  var maxScenarios = 0n;
  var maxCmd = null;
  for (var i = 0; i < results.length; i++) {
    if (results[i].scenarios > maxScenarios) {
      maxScenarios = results[i].scenarios;
      maxCmd = results[i];
    }
  }

  return {
    commands: results,
    sigCount: sigs.length,
    fieldCount: sigs.reduce(function(s, sig) { return s + sig.fields.length; }, 0),
    maxScenarios: maxScenarios,
    maxCommand: maxCmd ? maxCmd.command : null,
    maxScope: maxCmd ? maxCmd.scope : null,
  };
}

// ── Main ─────────────────────────────────────────────────────────────────────

function formatBigInt(n) {
  if (n === null || n === undefined) return '?';
  var s = n.toString();
  if (s.length <= 6) return s;
  var exp = s.length - 1;
  return s[0] + '.' + s.substring(1, 3) + 'e' + exp;
}

function riskLevel(n) {
  if (n === null || n === undefined) return 'UNKNOWN';
  if (n <= 1000n) return 'MINIMAL';
  if (n <= 100000n) return 'LOW';
  if (n <= 10000000n) return 'MODERATE';
  return 'HIGH';
}

function main() {
  var rows = [];

  // ── Alloy models ──
  if (fs.existsSync(ALLOY_DIR)) {
    var files = fs.readdirSync(ALLOY_DIR).filter(function(f) { return f.endsWith('.als'); }).sort();
    for (var i = 0; i < files.length; i++) {
      try {
        var analysis = analyzeAlloyModel(path.join(ALLOY_DIR, files[i]));
        rows.push({
          framework: 'Alloy',
          model: files[i].replace('.als', ''),
          scenarios: analysis.maxScenarios,
          risk: riskLevel(analysis.maxScenarios),
          sigs: analysis.sigCount,
          fields: analysis.fieldCount,
          commands: analysis.commands.length,
          detail: analysis.maxScope || '',
        });
      } catch (err) {
        rows.push({
          framework: 'Alloy',
          model: files[i].replace('.als', ''),
          scenarios: null,
          risk: 'ERROR',
          sigs: 0,
          fields: 0,
          commands: 0,
          detail: err.message,
        });
      }
    }
  }

  // ── TLA+ models (from existing report) ──
  if (fs.existsSync(TLA_REPORT)) {
    var report = JSON.parse(fs.readFileSync(TLA_REPORT, 'utf8'));
    var entries = Object.entries(report.models || {});
    for (var i = 0; i < entries.length; i++) {
      var modelPath = entries[i][0];
      var data = entries[i][1];
      var name = data.module_name || path.basename(modelPath, '.tla');
      if (name.includes('_TTrace_')) continue;
      var states = data.estimated_states;
      var scenariosBig = states !== null ? BigInt(states) : null;
      rows.push({
        framework: 'TLA+',
        model: name,
        scenarios: scenariosBig,
        risk: states !== null ? riskLevel(scenariosBig) : (data.has_unbounded ? 'HIGH' : 'UNKNOWN'),
        sigs: data.variables ? data.variables.length : 0,
        fields: 0,
        commands: (data.invariant_count || 0) + (data.property_count || 0),
        detail: data.has_unbounded ? 'UNBOUNDED' : (states !== null ? states + ' states' : 'unresolvable'),
      });
    }
  }

  // ── UPPAAL models ──
  if (fs.existsSync(UPPAAL_DIR)) {
    var uFiles = fs.readdirSync(UPPAAL_DIR).filter(function(f) { return f.endsWith('.xml'); });
    for (var i = 0; i < uFiles.length; i++) {
      var content = fs.readFileSync(path.join(UPPAAL_DIR, uFiles[i]), 'utf8');
      var templateCount = (content.match(/<template>/g) || []).length;
      var locationCount = (content.match(/<location /g) || []).length;
      var clockCount = (content.match(/clock\s+\w/g) || []).length;
      rows.push({
        framework: 'UPPAAL',
        model: uFiles[i].replace('.xml', ''),
        scenarios: null,
        risk: 'TIMED',
        sigs: templateCount,
        fields: locationCount,
        commands: clockCount,
        detail: templateCount + ' automata, ' + locationCount + ' locations, ' + clockCount + ' clocks',
      });
    }
  }

  // Sort: HIGH/biggest first
  var riskOrder = { HIGH: 0, UNKNOWN: 1, ERROR: 1, TIMED: 1, MODERATE: 2, LOW: 3, MINIMAL: 4 };
  rows.sort(function(a, b) {
    var ra = riskOrder[a.risk] !== undefined ? riskOrder[a.risk] : 2;
    var rb = riskOrder[b.risk] !== undefined ? riskOrder[b.risk] : 2;
    if (ra !== rb) return ra - rb;
    var sa = a.scenarios || 0n;
    var sb = b.scenarios || 0n;
    if (sa > sb) return -1;
    if (sa < sb) return 1;
    return 0;
  });

  if (jsonMode) {
    var jsonRows = rows.map(function(r) {
      return Object.assign({}, r, {
        scenarios: r.scenarios !== null ? r.scenarios.toString() : null,
      });
    });
    process.stdout.write(JSON.stringify({ models: jsonRows, total: rows.length }, null, 2) + '\n');
    return;
  }

  // ── Table output ──
  var header = ['Risk', 'Framework', 'Model', 'Scenarios', 'Sigs', 'Fields', 'Cmds', 'Detail'];
  var colWidths = header.map(function(h, idx) {
    var maxData = 0;
    for (var j = 0; j < rows.length; j++) {
      var r = rows[j];
      var vals = [r.risk, r.framework, r.model, formatBigInt(r.scenarios), String(r.sigs), String(r.fields), String(r.commands), r.detail];
      maxData = Math.max(maxData, String(vals[idx]).length);
    }
    return Math.max(h.length, maxData);
  });
  colWidths[7] = Math.min(colWidths[7], 45);

  var sep = colWidths.map(function(w) { return '-'.repeat(w + 2); }).join('+');

  function formatRow(vals) {
    return vals.map(function(v, i) {
      var s = String(v).substring(0, colWidths[i] + 2);
      return (' ' + s).padEnd(colWidths[i] + 2);
    }).join('|');
  }

  console.log(formatRow(header));
  console.log(sep);

  var prevRisk = null;
  for (var j = 0; j < rows.length; j++) {
    var r = rows[j];
    if (prevRisk !== null && r.risk !== prevRisk) {
      var prevOrder = riskOrder[prevRisk] !== undefined ? riskOrder[prevRisk] : 2;
      var currOrder = riskOrder[r.risk] !== undefined ? riskOrder[r.risk] : 2;
      if (currOrder !== prevOrder) {
        console.log(sep);
      }
    }
    prevRisk = r.risk;
    console.log(formatRow([
      r.risk,
      r.framework,
      r.model,
      formatBigInt(r.scenarios),
      r.sigs,
      r.fields,
      r.commands,
      r.detail,
    ]));
  }

  console.log(sep);

  // Summary
  var byRisk = {};
  var byFramework = {};
  for (var j = 0; j < rows.length; j++) {
    byRisk[rows[j].risk] = (byRisk[rows[j].risk] || 0) + 1;
    byFramework[rows[j].framework] = (byFramework[rows[j].framework] || 0) + 1;
  }
  console.log('\nTotal: ' + rows.length + ' models');
  console.log('By risk:      ' + Object.entries(byRisk).map(function(e) { return e[0] + '=' + e[1]; }).join('  '));
  console.log('By framework: ' + Object.entries(byFramework).map(function(e) { return e[0] + '=' + e[1]; }).join('  '));

  var splitCandidates = rows.filter(function(r) { return r.risk === 'HIGH' && r.scenarios !== null && r.scenarios > 10000000n; });
  if (splitCandidates.length > 0) {
    console.log('\nSplit candidates (HIGH risk, >10M scenarios):');
    for (var j = 0; j < splitCandidates.length; j++) {
      var r = splitCandidates[j];
      console.log('  ' + r.framework + '/' + r.model + ': ' + formatBigInt(r.scenarios) + ' scenarios');
    }
  }
}

main();
