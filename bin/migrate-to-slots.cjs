#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');

// SLOT_MIGRATION_MAP: old model-based names → new slot names
const SLOT_MIGRATION_MAP = {
  'codex-cli':         'codex-cli-1',
  'gemini-cli':        'gemini-cli-1',
  'opencode':          'opencode-1',
  'copilot-cli':       'copilot-1',
  'claude-deepseek':   'claude-1',
  'claude-minimax':    'claude-2',
  'claude-qwen-coder': 'claude-3',
  'claude-kimi':       'claude-4',
  'claude-llama4':     'claude-5',
  'claude-glm':        'claude-6',
};

/**
 * Migrate ~/.claude.json mcpServers keys from model-based names to slot names.
 * @param {string} claudeJsonPath - Absolute path to ~/.claude.json
 * @param {boolean} dryRun - If true, do not write changes
 * @returns {{ changed: number, renamed: Array<{from: string, to: string}> }}
 */
function migrateClaudeJson(claudeJsonPath, dryRun = false) {
  let raw;
  try {
    raw = JSON.parse(fs.readFileSync(claudeJsonPath, 'utf8'));
  } catch (e) {
    if (e.code === 'ENOENT') {
      return { changed: 0, renamed: [] };
    }
    throw new Error(`Failed to read ${claudeJsonPath}: ${e.message}`);
  }

  const servers = raw.mcpServers || {};
  let changed = 0;
  const renamed = [];

  for (const [oldName, newName] of Object.entries(SLOT_MIGRATION_MAP)) {
    if (servers[oldName] !== undefined && servers[newName] === undefined) {
      // Rename: assign to new key, delete old key
      servers[newName] = servers[oldName];
      delete servers[oldName];
      changed++;
      renamed.push({ from: oldName, to: newName });
    }
    // oldName absent + newName present → already migrated (skip, idempotent)
    // both present → skip (safety — don't overwrite)
  }

  if (changed > 0) {
    raw.mcpServers = servers;
    if (!dryRun) {
      fs.writeFileSync(claudeJsonPath, JSON.stringify(raw, null, 2) + '\n', 'utf8');
    }
  }

  return { changed, renamed };
}

// tool_prefix migration map for qgsd.json
const QGSD_PREFIX_MAP = {
  'mcp__codex-cli__':   'mcp__codex-cli-1__',
  'mcp__gemini-cli__':  'mcp__gemini-cli-1__',
  'mcp__opencode__':    'mcp__opencode-1__',
  'mcp__copilot-cli__': 'mcp__copilot-1__',
};

/**
 * Migrate ~/.claude/qgsd.json required_models tool_prefix values to slot-based prefixes.
 * @param {string} qgsdJsonPath - Absolute path to ~/.claude/qgsd.json
 * @param {boolean} dryRun - If true, do not write changes
 * @returns {{ changed: number, patched: Array<{key: string, from: string, to: string}> }}
 */
function migrateQgsdJson(qgsdJsonPath, dryRun = false) {
  if (!fs.existsSync(qgsdJsonPath)) {
    return { changed: 0, patched: [] };
  }

  let raw;
  try {
    raw = JSON.parse(fs.readFileSync(qgsdJsonPath, 'utf8'));
  } catch (e) {
    throw new Error(`Failed to read ${qgsdJsonPath}: ${e.message}`);
  }

  const requiredModels = raw.required_models;
  if (!requiredModels || typeof requiredModels !== 'object') {
    return { changed: 0, patched: [] };
  }

  let changed = 0;
  const patched = [];

  for (const [modelKey, modelDef] of Object.entries(requiredModels)) {
    if (modelDef && typeof modelDef.tool_prefix === 'string') {
      const newPrefix = QGSD_PREFIX_MAP[modelDef.tool_prefix];
      if (newPrefix) {
        patched.push({ key: modelKey, from: modelDef.tool_prefix, to: newPrefix });
        modelDef.tool_prefix = newPrefix;
        changed++;
      }
    }
  }

  if (changed > 0 && !dryRun) {
    fs.writeFileSync(qgsdJsonPath, JSON.stringify(raw, null, 2) + '\n', 'utf8');
  }

  return { changed, patched };
}

// CLI entrypoint
if (require.main === module) {
  const dryRun = process.argv.includes('--dry-run');
  const claudeJsonPath = path.join(os.homedir(), '.claude.json');
  const qgsdJsonPath = path.join(os.homedir(), '.claude', 'qgsd.json');

  let r1, r2;
  try {
    r1 = migrateClaudeJson(claudeJsonPath, dryRun);
  } catch (e) {
    console.error(`Error migrating ~/.claude.json: ${e.message}`);
    process.exit(1);
  }

  try {
    r2 = migrateQgsdJson(qgsdJsonPath, dryRun);
  } catch (e) {
    console.error(`Error migrating ~/.claude/qgsd.json: ${e.message}`);
    process.exit(1);
  }

  if (r1.changed === 0 && r2.changed === 0) {
    console.log('Already migrated — no changes needed');
  } else if (dryRun) {
    const totalRenames = r1.renamed.length + r2.patched.length;
    console.log(`[DRY RUN] Would rename ${totalRenames} entries:`);
    for (const { from, to } of r1.renamed) {
      console.log(`  mcpServers: ${from} → ${to}`);
    }
    for (const { key, from, to } of r2.patched) {
      console.log(`  qgsd.json required_models.${key}.tool_prefix: ${from} → ${to}`);
    }
  } else {
    if (r1.changed > 0) {
      console.log(`Migrated ${r1.changed} mcpServers entries:`);
      for (const { from, to } of r1.renamed) {
        console.log(`  ${from} → ${to}`);
      }
    }
    if (r2.changed > 0) {
      console.log(`Patched ${r2.changed} qgsd.json tool_prefix values`);
      for (const { key, from, to } of r2.patched) {
        console.log(`  required_models.${key}.tool_prefix: ${from} → ${to}`);
      }
    }
  }

  process.exit(0);
}

module.exports = { migrateClaudeJson, migrateQgsdJson, SLOT_MIGRATION_MAP };
