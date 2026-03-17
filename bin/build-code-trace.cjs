#!/usr/bin/env node

/**
 * build-code-trace.cjs
 *
 * Requirements: SOLVE-13
 *
 * Builds a code trace index from recipe and scope infrastructure to eliminate
 * false positives in sweepCtoR (source files) and sweepTtoR (test files).
 *
 * Recipe files declare which source files implement each requirement.
 * Scope files declare which files are within a scope's domain.
 *
 * This builder aggregates both into a fast-lookup index for reverse-discovery sweeps.
 */

const fs = require('fs');
const path = require('path');

/**
 * buildIndex(rootDir)
 *
 * Scans recipes and scopes, builds traced_files index and scope_only arrays.
 * Returns { version, generated_at, sources, traced_files, scope_only }
 * Also writes to .planning/formal/code-trace-index.json
 *
 * @param {string} rootDir - project root directory
 * @returns {object} index object
 */
function buildIndex(rootDir) {
  const now = new Date().toISOString();
  const index = {
    version: 1,
    generated_at: now,
    sources: { recipes: 0, scopes: 0 },
    traced_files: {},      // file -> [req_id_1, req_id_2, ...]
    scope_only: [],        // files in scopes but not traced by recipes
  };

  // ---- STEP 1: Scan .recipe.json files ----
  const recipesDir = path.join(rootDir, '.planning', 'formal', 'generated-stubs');
  if (fs.existsSync(recipesDir)) {
    try {
      const entries = fs.readdirSync(recipesDir);
      for (const entry of entries) {
        if (!entry.endsWith('.recipe.json')) continue;

        const recipePath = path.join(recipesDir, entry);
        try {
          const recipe = JSON.parse(fs.readFileSync(recipePath, 'utf8'));
          const reqId = recipe.requirement_id;

          if (reqId && Array.isArray(recipe.source_files)) {
            index.sources.recipes++;
            for (const srcFile of recipe.source_files) {
              // Normalize to relative path
              let normalized = srcFile;
              if (path.isAbsolute(srcFile)) {
                normalized = path.relative(rootDir, srcFile);
              }

              if (!index.traced_files[normalized]) {
                index.traced_files[normalized] = [];
              }
              if (!index.traced_files[normalized].includes(reqId)) {
                index.traced_files[normalized].push(reqId);
              }
            }
          }
        } catch (e) {
          // Skip malformed recipe files
        }
      }
    } catch (e) {
      // Directory doesn't exist or unreadable; continue with empty recipes
    }
  }

  // ---- STEP 2: Scan scope.json files ----
  const scopesRoot = path.join(rootDir, '.planning', 'formal', 'spec');
  const scopeOnlySet = new Set();

  if (fs.existsSync(scopesRoot)) {
    try {
      const specDirs = fs.readdirSync(scopesRoot);
      for (const specDir of specDirs) {
        const scopePath = path.join(scopesRoot, specDir, 'scope.json');
        if (!fs.existsSync(scopePath)) continue;

        try {
          const scope = JSON.parse(fs.readFileSync(scopePath, 'utf8'));
          if (Array.isArray(scope.source_files)) {
            index.sources.scopes++;
            for (const srcFile of scope.source_files) {
              // Normalize
              let normalized = srcFile;
              if (path.isAbsolute(srcFile)) {
                normalized = path.relative(rootDir, srcFile);
              }

              // Only add to scope_only if NOT already in traced_files
              if (!index.traced_files[normalized]) {
                scopeOnlySet.add(normalized);
              }
            }
          }
        } catch (e) {
          // Skip malformed scope files
        }
      }
    } catch (e) {
      // Directory unreadable; continue
    }
  }

  index.scope_only = Array.from(scopeOnlySet).sort();

  // Get list of scope directories for concept matching
  const scopeDirs = [];
  if (fs.existsSync(scopesRoot)) {
    try {
      const specDirs = fs.readdirSync(scopesRoot);
      for (const specDir of specDirs) {
        const scopePath = path.join(scopesRoot, specDir, 'scope.json');
        if (fs.existsSync(scopePath)) {
          scopeDirs.push(specDir);
        }
      }
    } catch (_) {}
  }

  // ---- STEP 3: Source-module inheritance ----
  // For every test file (*.test.cjs or *.test.js), if its source module is traced,
  // inherit the source module's requirement IDs.
  const testFiles = Object.keys(index.traced_files).filter(f =>
    f.endsWith('.test.cjs') || f.endsWith('.test.js')
  );

  for (const testFile of testFiles) {
    const sourceModule = testFile.replace(/\.test\.(cjs|js)$/, '.$1');
    if (index.traced_files[sourceModule]) {
      // Inherit source module's req IDs
      const srcReqs = index.traced_files[sourceModule];
      if (!index.traced_files[testFile]) {
        index.traced_files[testFile] = [];
      }
      for (const reqId of srcReqs) {
        if (!index.traced_files[testFile].includes(reqId)) {
          index.traced_files[testFile].push(reqId);
        }
      }
    }
  }

  // Also: for every source file, check if a corresponding test exists and add it
  // This covers bin/foo.cjs -> bin/foo.test.cjs inheritance
  const sourceFiles = Object.keys(index.traced_files).filter(f =>
    !f.endsWith('.test.cjs') && !f.endsWith('.test.js')
  );

  for (const srcFile of sourceFiles) {
    const testVariants = [
      srcFile.replace(/\.(cjs|js)$/, '.test.$1'),
    ];

    for (const testFile of testVariants) {
      // Check if test file exists on disk (optional check for completeness)
      const absTestPath = path.join(rootDir, testFile);
      if (fs.existsSync(absTestPath)) {
        if (!index.traced_files[testFile]) {
          index.traced_files[testFile] = [];
        }
        const srcReqs = index.traced_files[srcFile];
        for (const reqId of srcReqs) {
          if (!index.traced_files[testFile].includes(reqId)) {
            index.traced_files[testFile].push(reqId);
          }
        }
      }
    }
  }

  // ---- STEP 3b: Concept-based test/ inheritance ----
  // Scan actual test/ directory on disk for files not yet in traced_files
  const testDirPath = path.join(rootDir, 'test');
  let testDirFiles = [];
  try {
    testDirFiles = fs.readdirSync(testDirPath)
      .filter(f => f.endsWith('.test.cjs') || f.endsWith('.test.js'))
      .map(f => path.join('test', f));
  } catch (_) { /* test/ directory may not exist */ }

  for (const testFile of testDirFiles) {
    if (index.traced_files[testFile] && index.traced_files[testFile].length > 0) {
      // Already traced — skip
      continue;
    }

    // Extract concept from filename (e.g., test/solve-convergence-e2e.test.cjs -> solve-convergence)
    let concept = testFile
      .replace(/^test\//, '')          // Remove test/ prefix
      .replace(/\.test\.(cjs|js)$/, '') // Remove .test.cjs/.test.js suffix
      .replace(/^e2e-/, '');            // Remove e2e- prefix

    let found = false;

    // Split concept into segments for fuzzy matching (e.g., "install-fresh-clone" → ["install", "fresh", "clone"])
    const conceptSegments = concept.split('-').filter(s => s.length > 2);

    // Try matching concept to scope directories
    for (const scopeDir of scopeDirs) {
      // Exact substring match OR any concept segment starts the scope dir OR vice versa
      const matches = concept.includes(scopeDir) || scopeDir.includes(concept)
        || conceptSegments.some(seg => scopeDir.startsWith(seg) || seg.startsWith(scopeDir));
      if (matches) {
        // Read the scope.json and get source_files
        const scopePath = path.join(scopesRoot, scopeDir, 'scope.json');
        try {
          const scope = JSON.parse(fs.readFileSync(scopePath, 'utf8'));
          if (Array.isArray(scope.source_files)) {
            const collectedReqs = new Set();
            for (const srcFile of scope.source_files) {
              let normalized = srcFile;
              if (path.isAbsolute(srcFile)) {
                normalized = path.relative(rootDir, srcFile);
              }
              // Collect requirements from all source files in the scope
              if (index.traced_files[normalized]) {
                for (const reqId of index.traced_files[normalized]) {
                  collectedReqs.add(reqId);
                }
              }
            }

            if (collectedReqs.size > 0) {
              index.traced_files[testFile] = Array.from(collectedReqs);
              // Remove from scope_only if it was added there
              const scopeOnlyIdx = index.scope_only.indexOf(testFile);
              if (scopeOnlyIdx >= 0) {
                index.scope_only.splice(scopeOnlyIdx, 1);
              }
              found = true;
              break;
            }
          }
        } catch (e) {}
      }
    }

    // If no scope match, try matching against bin/*.cjs source files
    if (!found) {
      const baseName = concept;
      const binSourceFile = `bin/${baseName}.cjs`;
      if (index.traced_files[binSourceFile] && index.traced_files[binSourceFile].length > 0) {
        index.traced_files[testFile] = [...index.traced_files[binSourceFile]];
        // Remove from scope_only if it was added there
        const scopeOnlyIdx = index.scope_only.indexOf(testFile);
        if (scopeOnlyIdx >= 0) {
          index.scope_only.splice(scopeOnlyIdx, 1);
        }
      }
    }
  }

  // ---- STEP 4: Merge user overrides and write to disk ----
  const indexPath = path.join(rootDir, '.planning', 'formal', 'code-trace-index.json');

  // Preserve user-added traced_files entries (those with traced_to or reason fields,
  // indicating manual annotation rather than auto-discovery from recipes/scopes)
  try {
    if (fs.existsSync(indexPath)) {
      const existing = JSON.parse(fs.readFileSync(indexPath, 'utf8'));
      const existingTraced = existing.traced_files || {};
      for (const [filePath, entry] of Object.entries(existingTraced)) {
        // User entries are objects with traced_to/reason; auto entries are arrays of req IDs
        if (entry && typeof entry === 'object' && !Array.isArray(entry) && (entry.traced_to || entry.reason)) {
          index.traced_files[filePath] = entry;
        }
      }
    }
  } catch (e) {
    // Fail-open: if existing file can't be read, proceed with fresh index
  }

  try {
    fs.writeFileSync(indexPath, JSON.stringify(index, null, 2), 'utf8');
  } catch (e) {
    // Fail silently on write errors
  }

  return index;
}

// ---- CLI execution ----
if (require.main === module) {
  const rootDir = process.cwd();
  try {
    const index = buildIndex(rootDir);
    console.log(
      `Built code-trace index: ${Object.keys(index.traced_files).length} traced files, ` +
      `${index.scope_only.length} scope-only files from ` +
      `${index.sources.recipes} recipes and ${index.sources.scopes} scopes.`
    );
  } catch (e) {
    console.error('Error building code-trace index:', e.message);
    process.exit(1);
  }
}

module.exports = { buildIndex };
