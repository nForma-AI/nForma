#!/usr/bin/env node
// Claude Code Statusline - GSD Edition
// Shows: model | current task | directory | context usage

const fs = require('fs');
const path = require('path');
const os = require('os');
const { loadConfig, shouldRunHook, validateHookInput } = require('./config-loader');

// Detect context window size from data
// Tier 1: explicit context_window_size from API
// Tier 2: parse display_name for context tier hint
// Tier 3: unknown (return null)
function detectContextSize(data) {
  // Tier 1: explicit context_window_size from API
  const explicit = data.context_window?.context_window_size;
  if (explicit && explicit > 0) return explicit;

  // Tier 2: parse display_name for context tier hint
  const displayName = data.model?.display_name || '';
  const match = displayName.match(/\((?:with\s+)?(\d+)([KM])\s*context/i);
  if (match) {
    const num = parseInt(match[1], 10);
    const unit = match[2].toUpperCase();
    return unit === 'M' ? num * 1_000_000 : num * 1_000;
  }

  // Tier 3: unknown — return null (fail-open)
  return null;
}

// Read JSON from stdin
let input = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', chunk => input += chunk);
process.stdin.on('end', () => {
  try {
    const data = JSON.parse(input);
    const _eventType = data.hook_event_name || data.hookEventName || 'Notification';
    const _validation = validateHookInput(_eventType, data);
    if (!_validation.valid) {
      process.stderr.write('[nf] WARNING: nf-statusline: invalid input: ' + JSON.stringify(_validation.errors) + '\n');
      process.exit(0); // Fail-open
    }

    // Profile guard — exit early if this hook is not active for the current profile
    const config = loadConfig(data.workspace?.current_dir || process.cwd());
    const profile = config.hook_profile || 'standard';
    if (!shouldRunHook('nf-statusline', profile)) {
      process.exit(0);
    }

    const model = data.model?.display_name || 'Claude';
    const dir = data.workspace?.current_dir || process.cwd();
    const session = data.session_id || '';
    const remaining = data.context_window?.remaining_percentage;

    // Context window display
    let ctx = '';
    if (remaining != null) {
      const rem = Math.round(remaining);
      const used = Math.max(0, Math.min(100, 100 - rem));

      // Build progress bar (10 segments)
      const filled = Math.floor(used / 10);
      const bar = '█'.repeat(filled) + '░'.repeat(10 - filled);

      // Token-based color thresholds (quality degrades well before context limit)
      // Total context usage = input + cache_read + cache_creation (all contribute to context window)
      const usage = data.context_window?.current_usage || {};
      const totalTokens = (usage.input_tokens || 0)
        + (usage.cache_read_input_tokens || 0)
        + (usage.cache_creation_input_tokens || 0);

      // Use total if non-zero, otherwise estimate from percentage and context_window_size
      const ctxSize = detectContextSize(data);

      let inputTokens, tokensK, tokenLabel;
      if (totalTokens > 0) {
        inputTokens = totalTokens;
        tokensK = Math.round(inputTokens / 1000);
        tokenLabel = tokensK >= 1000 ? `${(tokensK / 1000).toFixed(1)}M` : `${tokensK}K`;
      } else if (ctxSize) {
        inputTokens = Math.round((used / 100) * ctxSize);
        tokensK = Math.round(inputTokens / 1000);
        tokenLabel = tokensK >= 1000 ? `${(tokensK / 1000).toFixed(1)}M` : `${tokensK}K`;
      } else {
        inputTokens = null;
        tokenLabel = null;
      }

      // Named threshold constants for maintainability
      const TIER1_PCT = 0.10;  // green ceiling
      const TIER2_PCT = 0.20;  // yellow ceiling
      const TIER3_PCT = 0.35;  // orange ceiling (>= this → red)

      let color;
      if (inputTokens != null && ctxSize) {
        // Scale thresholds proportionally: green < 10%, yellow < 20%, orange < 35%, red >= 35%
        const t1 = ctxSize * TIER1_PCT;  // 1M: 100K, 200K: 20K
        const t2 = ctxSize * TIER2_PCT;  // 1M: 200K, 200K: 40K
        const t3 = ctxSize * TIER3_PCT;  // 1M: 350K, 200K: 70K
        if (inputTokens < t1) {
          color = '\x1b[32m';           // green
        } else if (inputTokens < t2) {
          color = '\x1b[33m';           // yellow
        } else if (inputTokens < t3) {
          color = '\x1b[38;5;208m';     // orange
        } else {
          color = '\x1b[5;31m';         // blinking red
        }
      } else if (inputTokens != null) {
        // Have tokens but no ctxSize — use original fixed thresholds as fallback
        if (inputTokens < 100_000) {
          color = '\x1b[32m';
        } else if (inputTokens < 200_000) {
          color = '\x1b[33m';
        } else if (inputTokens < 350_000) {
          color = '\x1b[38;5;208m';
        } else {
          color = '\x1b[5;31m';
        }
      } else {
        // No token info at all — use percentage-based color
        if (used < 30) {
          color = '\x1b[32m';           // green
        } else if (used < 50) {
          color = '\x1b[33m';           // yellow
        } else if (used < 70) {
          color = '\x1b[38;5;208m';     // orange
        } else {
          color = '\x1b[5;31m';         // blinking red
        }
      }

      ctx = tokenLabel
        ? ` ${color}${bar} ${used}% (${tokenLabel})\x1b[0m`
        : ` ${color}${bar} ${used}%\x1b[0m`;
    }

    // Current task from todos
    let task = '';
    const homeDir = os.homedir();
    const todosDir = path.join(homeDir, '.claude', 'todos');
    if (session && fs.existsSync(todosDir)) {
      try {
        const files = fs.readdirSync(todosDir)
          .filter(f => f.startsWith(session) && f.includes('-agent-') && f.endsWith('.json'))
          .map(f => ({ name: f, mtime: fs.statSync(path.join(todosDir, f)).mtime }))
          .sort((a, b) => b.mtime - a.mtime);

        if (files.length > 0) {
          try {
            const todos = JSON.parse(fs.readFileSync(path.join(todosDir, files[0].name), 'utf8'));
            const inProgress = todos.find(t => t.status === 'in_progress');
            if (inProgress) task = inProgress.activeForm || '';
          } catch (e) {}
        }
      } catch (e) {
        // Silently fail on file system errors - don't break statusline
      }
    }

    // nForma update available?
    let gsdUpdate = '';
    const cacheFile = path.join(homeDir, '.claude', 'cache', 'nf-update-check.json');
    if (fs.existsSync(cacheFile)) {
      try {
        const cache = JSON.parse(fs.readFileSync(cacheFile, 'utf8'));
        if (cache.update_available) {
          gsdUpdate = '\x1b[33m⬆ /nf:update\x1b[0m │ ';
        }
      } catch (e) {}
    }

    // Output
    const dirname = path.basename(dir);
    if (task) {
      process.stdout.write(`${gsdUpdate}\x1b[2m${model}\x1b[0m │ \x1b[1m${task}\x1b[0m │ \x1b[2m${dirname}\x1b[0m${ctx}`);
    } else {
      process.stdout.write(`${gsdUpdate}\x1b[2m${model}\x1b[0m │ \x1b[2m${dirname}\x1b[0m${ctx}`);
    }
  } catch (e) {
    if (e instanceof SyntaxError) {
      process.stderr.write('[nf] WARNING: nf-statusline: malformed JSON on stdin: ' + e.message + '\n');
    }
    // Silent fail - don't break statusline on parse errors
  }
});
