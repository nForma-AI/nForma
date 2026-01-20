#!/usr/bin/env node
// Codebase Intelligence - PostToolUse Indexing Hook
// Indexes file exports/imports when Claude writes or edits JS/TS files

const fs = require('fs');
const path = require('path');

// JS/TS file extensions to index
const INDEXABLE_EXTENSIONS = ['.js', '.ts', '.jsx', '.tsx', '.mjs', '.cjs'];

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
