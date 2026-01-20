#!/usr/bin/env node
// Codebase Intelligence - PostToolUse Indexing Hook
// Indexes file exports/imports when Claude writes or edits JS/TS files
// Also handles entity files for semantic codebase understanding

const fs = require('fs');
const path = require('path');
const initSqlJs = require('sql.js');

// Graph database schema (simple-graph pattern)
const GRAPH_SCHEMA = `
CREATE TABLE IF NOT EXISTS nodes (
  body TEXT,
  id TEXT GENERATED ALWAYS AS (json_extract(body, '$.id')) VIRTUAL NOT NULL UNIQUE
);
CREATE INDEX IF NOT EXISTS id_idx ON nodes(id);

CREATE TABLE IF NOT EXISTS edges (
  source TEXT NOT NULL,
  target TEXT NOT NULL,
  relationship TEXT DEFAULT 'depends_on',
  UNIQUE(source, target, relationship) ON CONFLICT REPLACE
);
CREATE INDEX IF NOT EXISTS source_idx ON edges(source);
CREATE INDEX IF NOT EXISTS target_idx ON edges(target);
`;

// Singleton SQL instance (async init, reuse across calls)
let sqlInstance = null;

/**
 * Get or initialize sql.js instance
 * Caches the SQL constructor for reuse
 */
async function getSQL() {
  if (!sqlInstance) {
    sqlInstance = await initSqlJs();
  }
  return sqlInstance;
}

/**
 * Load or create the graph database
 * Returns { db, dbPath } for operations and persistence
 */
async function loadGraphDatabase() {
  const SQL = await getSQL();
  const dbPath = path.join(process.cwd(), '.planning', 'intel', 'graph.db');

  let db;
  if (fs.existsSync(dbPath)) {
    const buffer = fs.readFileSync(dbPath);
    db = new SQL.Database(buffer);
  } else {
    db = new SQL.Database();
    db.run(GRAPH_SCHEMA);
  }

  return { db, dbPath };
}

/**
 * Persist database to disk
 * Must call after every write operation
 */
function persistDatabase(db, dbPath) {
  const data = db.export();
  const buffer = Buffer.from(data);
  fs.writeFileSync(dbPath, buffer);
}

/**
 * Get dependency hotspots from graph
 * Returns top N files by number of dependents
 */
function getHotspots(db, limit = 5) {
  const results = db.exec(`
    SELECT
      e.target as id,
      COUNT(*) as count,
      json_extract(n.body, '$.path') as path,
      json_extract(n.body, '$.type') as type
    FROM edges e
    LEFT JOIN nodes n ON e.target = n.id
    GROUP BY e.target
    ORDER BY count DESC
    LIMIT ?
  `, [limit]);

  if (!results[0]?.values) return [];

  return results[0].values.map(([id, count, path, type]) => ({
    id,
    count,
    path: path || id,
    type: type || 'unknown'
  }));
}

/**
 * Get nodes grouped by type
 */
function getNodesByType(db) {
  const results = db.exec(`
    SELECT
      json_extract(body, '$.type') as type,
      COUNT(*) as count
    FROM nodes
    GROUP BY type
    ORDER BY count DESC
  `);

  if (!results[0]?.values) return [];

  return results[0].values.map(([type, count]) => ({
    type: type || 'other',
    count
  }));
}

/**
 * Get all dependents of a file (transitive)
 * Uses recursive CTE for graph traversal
 */
function getDependents(db, entityId, maxDepth = 5) {
  const results = db.exec(`
    WITH RECURSIVE dependents(id, depth) AS (
      SELECT ?, 0
      UNION
      SELECT e.source, d.depth + 1
      FROM edges e
      JOIN dependents d ON e.target = d.id
      WHERE d.depth < ?
    )
    SELECT DISTINCT
      d.id,
      d.depth,
      json_extract(n.body, '$.path') as path
    FROM dependents d
    LEFT JOIN nodes n ON d.id = n.id
    WHERE d.id != ?
    ORDER BY d.depth, d.id
  `, [entityId.toLowerCase(), maxDepth, entityId.toLowerCase()]);

  if (!results[0]?.values) return [];

  return results[0].values.map(([id, depth, path]) => ({
    id,
    depth,
    path: path || id
  }));
}

// JS/TS file extensions to index
const INDEXABLE_EXTENSIONS = ['.js', '.ts', '.jsx', '.tsx', '.mjs', '.cjs'];

// Entity file location
const ENTITY_DIR = '.planning/intel/entities';

// Convention detection thresholds
const MIN_SAMPLES = 5;
const MIN_MATCH_RATE = 0.70;

// Well-known directory purposes
const DIRECTORY_PURPOSES = {
  'components': 'UI components',
  'hooks': 'React/custom hooks',
  'utils': 'Utility functions',
  'lib': 'Utility functions',
  'services': 'Service layer',
  'api': 'API endpoints',
  'routes': 'API endpoints',
  'types': 'TypeScript types',
  'models': 'Data models',
  'tests': 'Test files',
  '__tests__': 'Test files',
  'test': 'Test files',
  'spec': 'Test files',
  'controllers': 'Controllers',
  'middleware': 'Middleware',
  'config': 'Configuration',
  'constants': 'Constants',
  'assets': 'Static assets',
  'styles': 'Stylesheets',
  'pages': 'Page components',
  'views': 'View templates'
};

// Suffix patterns and their purposes
const SUFFIX_PURPOSES = {
  'test': 'Test files',
  'spec': 'Test files',
  'service': 'Service layer',
  'controller': 'Controllers',
  'model': 'Data models',
  'util': 'Utility functions',
  'utils': 'Utility functions',
  'helper': 'Helper functions',
  'helpers': 'Helper functions',
  'config': 'Configuration',
  'types': 'TypeScript types',
  'type': 'TypeScript types',
  'interface': 'TypeScript interfaces',
  'interfaces': 'TypeScript interfaces',
  'constants': 'Constants',
  'constant': 'Constants',
  'hook': 'React/custom hooks',
  'hooks': 'React/custom hooks',
  'context': 'React context',
  'store': 'State store',
  'slice': 'Redux slice',
  'reducer': 'Redux reducer',
  'action': 'Redux action',
  'actions': 'Redux actions',
  'api': 'API layer',
  'route': 'Route definitions',
  'routes': 'Route definitions',
  'middleware': 'Middleware',
  'schema': 'Schema definitions',
  'styles': 'Stylesheets',
  'mock': 'Mock data',
  'mocks': 'Mock data',
  'fixture': 'Test fixtures',
  'fixtures': 'Test fixtures'
};

/**
 * Extract import sources from file content
 * Returns array of import source paths (e.g., 'react', './utils', '@org/pkg')
 */
function extractImports(content) {
  const imports = new Set();

  // ES6 imports: import { x } from 'y', import x from 'y', import * as x from 'y'
  const es6Named = /import\s+(?:\{[^}]*\}|\*\s+as\s+\w+|\w+)\s+from\s+['"]([^'"]+)['"]/g;
  let match;
  while ((match = es6Named.exec(content)) !== null) {
    imports.add(match[1]);
  }

  // ES6 side-effect imports: import 'y'
  const es6SideEffect = /import\s+['"]([^'"]+)['"]/g;
  while ((match = es6SideEffect.exec(content)) !== null) {
    // Avoid matching 'from' part of previous pattern
    if (!content.slice(Math.max(0, match.index - 10), match.index).includes('from')) {
      imports.add(match[1]);
    }
  }

  // CommonJS: require('y')
  const cjs = /require\s*\(\s*['"]([^'"]+)['"]\s*\)/g;
  while ((match = cjs.exec(content)) !== null) {
    imports.add(match[1]);
  }

  return Array.from(imports);
}

/**
 * Extract exported symbol names from file content
 * Returns array of export names (e.g., 'functionA', 'ClassB', 'default')
 */
function extractExports(content) {
  const exports = new Set();

  // Named exports: export { x, y, z }
  const namedExport = /export\s*\{([^}]+)\}/g;
  let match;
  while ((match = namedExport.exec(content)) !== null) {
    const names = match[1].split(',').map(n => {
      // Handle "x as y" syntax - export the alias
      const parts = n.trim().split(/\s+as\s+/);
      return parts[parts.length - 1].trim();
    }).filter(n => n);
    names.forEach(n => exports.add(n));
  }

  // Declaration exports: export const|let|var|function|async function|class
  const declExport = /export\s+(?:const|let|var|function\*?|async\s+function|class)\s+(\w+)/g;
  while ((match = declExport.exec(content)) !== null) {
    exports.add(match[1]);
  }

  // Default export: export default (with optional identifier)
  const defaultExport = /export\s+default\s+(?:function\s*\*?\s*|class\s+)?(\w+)?/g;
  while ((match = defaultExport.exec(content)) !== null) {
    exports.add('default');
    if (match[1]) {
      exports.add(match[1]);
    }
  }

  // CommonJS: module.exports = { x, y }
  const cjsExport = /module\.exports\s*=\s*\{([^}]+)\}/g;
  while ((match = cjsExport.exec(content)) !== null) {
    const names = match[1].split(',').map(n => {
      // Handle "x: y" syntax - export the key
      const parts = n.trim().split(/\s*:\s*/);
      return parts[0].trim();
    }).filter(n => n && /^\w+$/.test(n));
    names.forEach(n => exports.add(n));
  }

  // CommonJS: module.exports = identifier
  const cjsSingleExport = /module\.exports\s*=\s*(\w+)\s*[;\n]/g;
  while ((match = cjsSingleExport.exec(content)) !== null) {
    exports.add('default');
    exports.add(match[1]);
  }

  // TypeScript: export type X, export interface X
  const tsExport = /export\s+(?:type|interface)\s+(\w+)/g;
  while ((match = tsExport.exec(content)) !== null) {
    exports.add(match[1]);
  }

  return Array.from(exports);
}

/**
 * Detect naming convention case type for a given name
 * Returns: 'camelCase' | 'PascalCase' | 'snake_case' | 'SCREAMING_SNAKE' | 'kebab-case' | null
 */
function detectCase(name) {
  if (!name || typeof name !== 'string') return null;

  // Skip 'default' as it's a keyword, not a naming convention indicator
  if (name === 'default') return null;

  // Case detection patterns (order matters for specificity)
  const patterns = [
    { name: 'SCREAMING_SNAKE', regex: /^[A-Z][A-Z0-9]*(?:_[A-Z0-9]+)+$/ },
    { name: 'snake_case', regex: /^[a-z][a-z0-9]*(?:_[a-z0-9]+)+$/ },
    { name: 'kebab-case', regex: /^[a-z][a-z0-9]*(?:-[a-z0-9]+)+$/ },
    { name: 'PascalCase', regex: /^[A-Z][a-z0-9]+(?:[A-Z][a-z0-9]+)*$/ },
    { name: 'camelCase', regex: /^[a-z][a-z0-9]*(?:[A-Z][a-z0-9]+)+$/ }
  ];

  for (const { name: caseName, regex } of patterns) {
    if (regex.test(name)) {
      return caseName;
    }
  }

  // Single lowercase word could be camelCase (e.g., 'main', 'app')
  if (/^[a-z][a-z0-9]*$/.test(name)) {
    return 'camelCase';
  }

  // Single PascalCase word (e.g., 'App', 'Main')
  if (/^[A-Z][a-z0-9]+$/.test(name)) {
    return 'PascalCase';
  }

  // Single SCREAMING word (e.g., 'DEBUG', 'API')
  if (/^[A-Z][A-Z0-9]*$/.test(name)) {
    return 'SCREAMING_SNAKE';
  }

  return null;
}

/**
 * Detect conventions from the index
 * Analyzes exports, directories, and file suffixes
 * Returns conventions object with detected patterns
 */
function detectConventions(index) {
  const conventions = {
    version: 1,
    updated: Date.now(),
    naming: {},
    directories: {},
    suffixes: {}
  };

  if (!index || !index.files) {
    return conventions;
  }

  // Collect all exports across all files for naming analysis
  const caseCounts = {};
  let totalExports = 0;

  // Collect directory info
  const directoryCounts = {};

  // Collect suffix patterns
  const suffixCounts = {};

  for (const [filePath, fileData] of Object.entries(index.files)) {
    // Analyze exports for naming conventions
    if (fileData.exports && Array.isArray(fileData.exports)) {
      for (const exportName of fileData.exports) {
        const caseType = detectCase(exportName);
        if (caseType) {
          caseCounts[caseType] = (caseCounts[caseType] || 0) + 1;
          totalExports++;
        }
      }
    }

    // Analyze directory structure
    const dirParts = filePath.split(path.sep);
    for (const dirName of dirParts) {
      const purpose = DIRECTORY_PURPOSES[dirName];
      if (purpose) {
        const dirKey = dirName;
        if (!directoryCounts[dirKey]) {
          directoryCounts[dirKey] = { purpose, files: 0 };
        }
        directoryCounts[dirKey].files++;
      }
    }

    // Analyze file suffix patterns
    const suffixMatch = filePath.match(/\.([a-z]+)\.(js|ts|jsx|tsx|mjs|cjs)$/i);
    if (suffixMatch) {
      const suffix = suffixMatch[1].toLowerCase();
      const fullSuffix = `.${suffix}.${suffixMatch[2].toLowerCase()}`;
      if (!suffixCounts[fullSuffix]) {
        const purpose = SUFFIX_PURPOSES[suffix] || 'Unknown';
        suffixCounts[fullSuffix] = { purpose, count: 0 };
      }
      suffixCounts[fullSuffix].count++;
    }
  }

  // Determine dominant naming convention for exports
  if (totalExports >= MIN_SAMPLES) {
    let dominant = null;
    let maxCount = 0;

    for (const [caseType, count] of Object.entries(caseCounts)) {
      if (count > maxCount) {
        maxCount = count;
        dominant = caseType;
      }
    }

    if (dominant && (maxCount / totalExports) >= MIN_MATCH_RATE) {
      conventions.naming.exports = {
        dominant,
        count: maxCount,
        percentage: Math.round((maxCount / totalExports) * 100)
      };
    }
  }

  // Include directories with known purposes
  for (const [dirName, data] of Object.entries(directoryCounts)) {
    conventions.directories[dirName] = {
      purpose: data.purpose,
      files: data.files
    };
  }

  // Include suffix patterns with 5+ occurrences
  for (const [suffix, data] of Object.entries(suffixCounts)) {
    if (data.count >= MIN_SAMPLES) {
      conventions.suffixes[suffix] = {
        purpose: data.purpose,
        count: data.count
      };
    }
  }

  return conventions;
}

/**
 * Generate summary.md content from index and conventions
 * Target: < 500 tokens for context injection
 */
function generateSummary(index, conventions) {
  const lines = [];
  const fileCount = Object.keys(index.files || {}).length;

  lines.push('# Codebase Intelligence Summary');
  lines.push('');
  lines.push(`Last updated: ${new Date().toISOString()}`);
  lines.push(`Indexed files: ${fileCount}`);
  lines.push('');

  // Naming conventions
  if (conventions.naming?.exports?.dominant) {
    const n = conventions.naming.exports;
    lines.push('## Naming Conventions');
    lines.push('');
    lines.push(`- Export naming: ${n.dominant} (${n.percentage}% of ${n.count} exports)`);
    lines.push('');
  }

  // Key directories (top 5)
  const dirs = Object.entries(conventions.directories || {});
  if (dirs.length > 0) {
    lines.push('## Key Directories');
    lines.push('');
    for (const [dir, info] of dirs.slice(0, 5)) {
      lines.push(`- \`${dir}/\`: ${info.purpose} (${info.files} files)`);
    }
    lines.push('');
  }

  // Suffix patterns (top 3)
  const suffixes = Object.entries(conventions.suffixes || {});
  if (suffixes.length > 0) {
    lines.push('## File Patterns');
    lines.push('');
    for (const [suffix, info] of suffixes.slice(0, 3)) {
      lines.push(`- \`*${suffix}\`: ${info.purpose} (${info.count} files)`);
    }
    lines.push('');
  }

  // Total exports count
  let totalExports = 0;
  for (const fileData of Object.values(index.files || {})) {
    if (fileData.exports) {
      totalExports += fileData.exports.filter(e => e !== 'default').length;
    }
  }
  if (totalExports > 0) {
    lines.push(`Total exports: ${totalExports}`);
  }

  return lines.join('\n');
}

/**
 * Check if a file path is an entity file
 */
function isEntityFile(filePath) {
  return filePath.includes('.planning/intel/entities/') &&
         filePath.endsWith('.md');
}

/**
 * Check if a file is a code file we should index
 */
function isCodeFile(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  return INDEXABLE_EXTENSIONS.includes(ext);
}

/**
 * Extract [[wiki-links]] from entity content
 * Returns array of linked entity names (e.g., 'src-lib-db', 'src-api-auth')
 */
function extractWikiLinks(content) {
  const links = [];
  const regex = /\[\[([^\]]+)\]\]/g;
  let match;
  while ((match = regex.exec(content)) !== null) {
    links.push(match[1]);
  }
  return links;
}

/**
 * Parse frontmatter from entity content
 * Returns object with frontmatter fields
 */
function parseEntityFrontmatter(content) {
  const frontmatter = {};
  const fmMatch = content.match(/^---\n([\s\S]*?)\n---/);
  if (fmMatch) {
    const fmLines = fmMatch[1].split('\n');
    for (const line of fmLines) {
      const colonIdx = line.indexOf(':');
      if (colonIdx > 0) {
        const key = line.slice(0, colonIdx).trim();
        const value = line.slice(colonIdx + 1).trim();
        frontmatter[key] = value;
      }
    }
  }
  return frontmatter;
}

/**
 * Extract purpose from entity content (first paragraph after ## Purpose)
 */
function extractPurpose(content) {
  const purposeMatch = content.match(/## Purpose\s*\n+([^\n#]+)/);
  if (purposeMatch) {
    return purposeMatch[1].trim();
  }
  return null;
}

/**
 * Generate semantic summary from graph database
 * Target: < 500 tokens for context injection
 */
async function generateGraphSummary() {
  const intelDir = path.join(process.cwd(), '.planning', 'intel');
  const dbPath = path.join(intelDir, 'graph.db');
  const summaryPath = path.join(intelDir, 'summary.md');

  if (!fs.existsSync(dbPath)) {
    return null;
  }

  try {
    const { db } = await loadGraphDatabase();

    const lines = [];
    lines.push('# Codebase Intelligence');
    lines.push('');

    const countResult = db.exec('SELECT COUNT(*) FROM nodes');
    const fileCount = countResult[0]?.values[0]?.[0] || 0;
    lines.push(`**Indexed entities:** ${fileCount}`);
    lines.push(`**Last updated:** ${new Date().toISOString().split('T')[0]}`);
    lines.push('');

    const hotspots = getHotspots(db, 5);
    if (hotspots.length > 0) {
      lines.push('## Dependency Hotspots');
      lines.push('');
      lines.push('Files with most dependents (change carefully):');
      for (const { path: filePath, count, type } of hotspots) {
        const typeLabel = type !== 'unknown' ? ` [${type}]` : '';
        lines.push(`1. \`${filePath}\` (${count} dependents)${typeLabel}`);
      }
      lines.push('');
    }

    const byType = getNodesByType(db);
    if (byType.length > 0) {
      lines.push('## Module Types');
      lines.push('');
      for (const { type, count } of byType) {
        const label = type.charAt(0).toUpperCase() + type.slice(1);
        lines.push(`- **${label}**: ${count} files`);
      }
      lines.push('');
    }

    const edgeResult = db.exec('SELECT COUNT(*) FROM edges');
    const edgeCount = edgeResult[0]?.values[0]?.[0] || 0;
    if (edgeCount > 0) {
      lines.push(`**Relationships tracked:** ${edgeCount}`);
      lines.push('');
    }

    db.close();

    const summary = lines.join('\n');
    fs.writeFileSync(summaryPath, summary);

    return summary;
  } catch (e) {
    return null;
  }
}

/**
 * Sync entity file to graph database
 * Called when an entity .md file is written
 *
 * @param {string} entityPath - Path to entity file
 */
async function syncEntityToGraph(entityPath) {
  const intelDir = path.join(process.cwd(), '.planning', 'intel');

  // Opt-in check (same as updateIndex)
  if (!fs.existsSync(intelDir)) {
    return;
  }

  try {
    const { db, dbPath } = await loadGraphDatabase();

    // Read entity file
    const content = fs.readFileSync(entityPath, 'utf8');
    const entityId = path.basename(entityPath, '.md').toLowerCase();
    const frontmatter = parseEntityFrontmatter(content);
    const links = extractWikiLinks(content);

    // Build node JSON
    const nodeBody = JSON.stringify({
      id: entityId,
      path: frontmatter.path || entityPath,
      type: frontmatter.type || 'unknown',
      updated: frontmatter.updated || new Date().toISOString().split('T')[0],
      status: frontmatter.status || 'active'
    });

    // Upsert node (ON CONFLICT handled by schema)
    db.run(
      `INSERT INTO nodes (body) VALUES (?)
       ON CONFLICT(id) DO UPDATE SET body = excluded.body`,
      [nodeBody]
    );

    // Delete old edges for this source, insert new ones
    db.run('DELETE FROM edges WHERE source = ?', [entityId]);

    if (links.length > 0) {
      const stmt = db.prepare('INSERT INTO edges (source, target) VALUES (?, ?)');
      for (const target of links) {
        stmt.run([entityId, target.toLowerCase()]);
      }
      stmt.free();
    }

    // Persist to disk (critical - sql.js is in-memory)
    persistDatabase(db, dbPath);
    db.close();
  } catch (e) {
    // Silent failure - never block Claude
    // Graph sync is best-effort enhancement
  }
}

/**
 * Regenerate summary.md from all entity files
 * Creates a semantic overview of the codebase
 * Prefers graph-backed summary when graph.db exists
 */
async function regenerateEntitySummary() {
  const intelDir = path.join(process.cwd(), '.planning', 'intel');
  const entitiesDir = path.join(intelDir, 'entities');
  const summaryPath = path.join(intelDir, 'summary.md');
  const dbPath = path.join(intelDir, 'graph.db');

  // Try graph-backed summary first (preferred when graph.db exists)
  if (fs.existsSync(dbPath)) {
    const graphSummary = await generateGraphSummary();
    if (graphSummary) {
      return; // Graph summary written successfully
    }
  }

  // Fallback: entity-file-based summary
  // Check directories exist
  if (!fs.existsSync(entitiesDir)) {
    return;
  }

  // Read all entity files
  const entityFiles = fs.readdirSync(entitiesDir)
    .filter(f => f.endsWith('.md'))
    .map(f => path.join(entitiesDir, f));

  if (entityFiles.length === 0) {
    return;
  }

  // Parse all entities
  const entities = [];
  const dependentCounts = {}; // Track how many things depend on each entity

  for (const filePath of entityFiles) {
    try {
      const content = fs.readFileSync(filePath, 'utf8');
      const frontmatter = parseEntityFrontmatter(content);
      const purpose = extractPurpose(content);
      const links = extractWikiLinks(content);

      // Count dependencies (things this entity links to)
      for (const link of links) {
        dependentCounts[link] = (dependentCounts[link] || 0) + 1;
      }

      entities.push({
        name: path.basename(filePath, '.md'),
        path: frontmatter.path || null,
        type: frontmatter.type || 'unknown',
        updated: frontmatter.updated || null,
        status: frontmatter.status || 'unknown',
        purpose,
        links
      });
    } catch (e) {
      // Skip unreadable files
    }
  }

  // Generate summary
  const lines = [];
  lines.push('# Codebase Intelligence');
  lines.push('');
  lines.push(`**Files indexed:** ${entities.length}`);
  lines.push(`**Last updated:** ${new Date().toISOString().split('T')[0]}`);
  lines.push('');

  // Group by type
  const byType = {};
  for (const entity of entities) {
    const type = entity.type || 'other';
    if (!byType[type]) {
      byType[type] = [];
    }
    byType[type].push(entity);
  }

  // Key Modules section
  lines.push('## Key Modules');
  lines.push('');

  const typeLabels = {
    'api': 'API Layer',
    'component': 'Components',
    'util': 'Utilities',
    'hook': 'Hooks',
    'service': 'Services',
    'model': 'Models',
    'config': 'Configuration',
    'other': 'Other'
  };

  for (const [type, typeEntities] of Object.entries(byType)) {
    if (typeEntities.length === 0) continue;

    const label = typeLabels[type] || type.charAt(0).toUpperCase() + type.slice(1);
    lines.push(`### ${label}`);

    // Show up to 5 entities per type, prioritize those with purposes
    const withPurpose = typeEntities.filter(e => e.purpose);
    const shown = withPurpose.slice(0, 5);
    if (shown.length < 5) {
      const remaining = typeEntities.filter(e => !e.purpose).slice(0, 5 - shown.length);
      shown.push(...remaining);
    }

    for (const entity of shown) {
      const desc = entity.purpose || 'No description';
      lines.push(`- **${entity.path || entity.name}** - ${desc}`);
    }
    lines.push('');
  }

  // Dependency Hotspots (most depended-on files)
  const hotspots = Object.entries(dependentCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);

  if (hotspots.length > 0) {
    lines.push('## Dependency Hotspots');
    lines.push('');
    lines.push('Files with most dependents (change carefully):');

    for (const [entityName, count] of hotspots) {
      const entity = entities.find(e => e.name === entityName);
      const desc = entity?.purpose || '';
      const pathStr = entity?.path || entityName;
      lines.push(`1. \`${pathStr}\` (${count} dependents)${desc ? ' - ' + desc : ''}`);
    }
    lines.push('');
  }

  // Recent Updates (last 5 by date)
  const withDates = entities
    .filter(e => e.updated)
    .sort((a, b) => b.updated.localeCompare(a.updated))
    .slice(0, 5);

  if (withDates.length > 0) {
    lines.push('## Recent Updates');
    lines.push('');
    for (const entity of withDates) {
      const desc = entity.purpose ? ` - ${entity.purpose}` : '';
      lines.push(`- ${entity.name}.md (${entity.updated})${desc}`);
    }
    lines.push('');
  }

  // Write summary
  fs.writeFileSync(summaryPath, lines.join('\n'));
}

/**
 * Update the index.json file with new file entry
 * Uses read-modify-write pattern with synchronous operations
 *
 * IMPORTANT: Only runs if .planning/intel/ already exists (opt-in behavior).
 * Directory is created by /gsd:new-project or /gsd:analyze-codebase.
 */
function updateIndex(filePath, exports, imports) {
  const intelDir = path.join(process.cwd(), '.planning', 'intel');
  const indexPath = path.join(intelDir, 'index.json');

  // Opt-in check: only index if intel directory already exists
  // This prevents polluting non-GSD projects
  if (!fs.existsSync(intelDir)) {
    return;
  }

  // Read existing index or create new
  let index = { version: 1, updated: null, files: {} };
  try {
    const content = fs.readFileSync(indexPath, 'utf8');
    index = JSON.parse(content);
  } catch (e) {
    // File doesn't exist or invalid JSON - start fresh
  }

  // Normalize file path to absolute
  const normalizedPath = path.resolve(filePath);

  // Update single file entry (incremental)
  index.files[normalizedPath] = {
    exports,
    imports,
    indexed: Date.now()
  };
  index.updated = Date.now();

  // Write atomically (directory already exists per opt-in check above)
  fs.writeFileSync(indexPath, JSON.stringify(index, null, 2));

  // Detect and save conventions (regenerated on every index update)
  const conventions = detectConventions(index);
  const conventionsPath = path.join(process.cwd(), '.planning', 'intel', 'conventions.json');
  fs.writeFileSync(conventionsPath, JSON.stringify(conventions, null, 2));

  // Generate and write summary.md for context injection
  const summary = generateSummary(index, conventions);
  const summaryPath = path.join(process.cwd(), '.planning', 'intel', 'summary.md');
  fs.writeFileSync(summaryPath, summary);
}

/**
 * Handle CLI query actions
 * Routes to appropriate graph query function based on query type
 *
 * @param {Object} data - Query action data
 * @param {string} data.action - Must be 'query'
 * @param {string} data.type - Query type: 'dependents' | 'hotspots'
 * @param {string} [data.target] - Entity ID for dependents query (e.g., 'src-lib-db')
 * @param {number} [data.limit] - Max results (default: 10 for dependents, 5 for hotspots)
 * @param {number} [data.maxDepth] - Max traversal depth for dependents (default: 5)
 * @returns {Promise<Object>} Query results
 */
async function handleQuery(data) {
  const { db, dbPath } = await loadGraphDatabase();

  try {
    switch (data.type) {
      case 'dependents': {
        if (!data.target) {
          return { error: 'target is required for dependents query' };
        }
        const results = getDependents(db, data.target, data.maxDepth || 5);
        const limited = data.limit ? results.slice(0, data.limit) : results.slice(0, 10);
        return {
          query: 'dependents',
          target: data.target,
          count: results.length,
          results: limited
        };
      }

      case 'hotspots': {
        const results = getHotspots(db, data.limit || 5);
        return {
          query: 'hotspots',
          count: results.length,
          results
        };
      }

      default:
        return { error: `Unknown query type: ${data.type}. Valid types: dependents, hotspots` };
    }
  } finally {
    db.close();
  }
}

// Read JSON from stdin (standard hook pattern)
let input = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', chunk => input += chunk);
process.stdin.on('end', () => {
  try {
    const data = JSON.parse(input);

    // Handle query actions (graph queries)
    if (data.action === 'query') {
      handleQuery(data).then(result => {
        console.log(JSON.stringify(result));
        process.exit(0);
      }).catch(err => {
        console.log(JSON.stringify({ error: err.message }));
        process.exit(1);
      });
      return; // Don't fall through to Write/Edit handling
    }

    // Only process Write and Edit tools
    if (!['Write', 'Edit'].includes(data.tool_name)) {
      process.exit(0);
    }

    const filePath = data.tool_input?.file_path;
    if (!filePath) {
      process.exit(0);
    }

    // Handle entity file writes - sync to graph, regenerate summary
    if (isEntityFile(filePath)) {
      syncEntityToGraph(filePath).then(async () => {
        await regenerateEntitySummary();
        process.exit(0);
      }).catch(() => {
        // Silent failure
        process.exit(0);
      });
      return; // Don't exit synchronously, wait for async
    }

    // Handle code file writes - existing behavior
    if (!isCodeFile(filePath)) {
      process.exit(0);
    }

    // Get file content
    // Write tool provides content in tool_input
    // Edit tool only provides old_string/new_string, so read from disk
    let content = data.tool_input?.content;
    if (!content) {
      // Edit tool - read file from disk
      const resolvedPath = path.resolve(filePath);
      if (fs.existsSync(resolvedPath)) {
        content = fs.readFileSync(resolvedPath, 'utf8');
      } else {
        // File doesn't exist (shouldn't happen after Edit, but be safe)
        process.exit(0);
      }
    }

    // Extract imports and exports
    const exports = extractExports(content);
    const imports = extractImports(content);

    // Update index
    updateIndex(filePath, exports, imports);

    process.exit(0);
  } catch (error) {
    // Silent failure - never block Claude
    process.exit(0);
  }
});
