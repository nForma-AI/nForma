#!/usr/bin/env node
// Codebase Intelligence - PostToolUse Indexing Hook
// Indexes file exports/imports when Claude writes or edits JS/TS files

const fs = require('fs');
const path = require('path');

// JS/TS file extensions to index
const INDEXABLE_EXTENSIONS = ['.js', '.ts', '.jsx', '.tsx', '.mjs', '.cjs'];

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
 * Update the index.json file with new file entry
 * Uses read-modify-write pattern with synchronous operations
 */
function updateIndex(filePath, exports, imports) {
  const indexPath = path.join(process.cwd(), '.planning', 'intel', 'index.json');

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

  // Ensure directory exists
  fs.mkdirSync(path.dirname(indexPath), { recursive: true });

  // Write atomically
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

// Read JSON from stdin (standard hook pattern)
let input = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', chunk => input += chunk);
process.stdin.on('end', () => {
  try {
    const data = JSON.parse(input);

    // Only process Write and Edit tools
    if (!['Write', 'Edit'].includes(data.tool_name)) {
      process.exit(0);
    }

    const filePath = data.tool_input?.file_path;
    if (!filePath) {
      process.exit(0);
    }

    // Only index JS/TS files
    const ext = path.extname(filePath).toLowerCase();
    if (!INDEXABLE_EXTENSIONS.includes(ext)) {
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
