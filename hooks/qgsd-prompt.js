#!/usr/bin/env node
// hooks/qgsd-prompt.js
// UserPromptSubmit hook — detects GSD planning commands and injects quorum instructions
// into Claude's context window before Claude processes the prompt.
//
// Output mechanism: hookSpecificOutput.additionalContext (NOT systemMessage)
// systemMessage only shows a UI warning; additionalContext goes into Claude's context.

const { loadConfig, DEFAULT_CONFIG } = require('./config-loader');

const DEFAULT_QUORUM_INSTRUCTIONS_FALLBACK = `QUORUM REQUIRED (structural enforcement — Stop hook will verify)

Before presenting any planning output to the user, you MUST:
  1. Call mcp__codex-cli__review with the full plan content
  2. Call mcp__gemini-cli__gemini with the full plan content
  3. Call mcp__opencode__opencode with the full plan content
  4. Present all model responses, resolve any concerns, then deliver your final output
  5. Include the token <!-- GSD_DECISION --> somewhere in your FINAL output (not in intermediate messages or status updates — only when you are delivering the completed plan, research, verification report, or filtered question list to the user)

Fail-open: if a model is UNAVAILABLE (quota/error), note it and proceed with available models.
The Stop hook reads the transcript — skipping quorum will block your response.`;

let raw = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', chunk => raw += chunk);
process.stdin.on('end', () => {
  try {
    const input = JSON.parse(raw);
    const prompt = (input.prompt || '').trim();

    const config = loadConfig();
    const commands = config.quorum_commands;
    const instructions = config.quorum_instructions || DEFAULT_QUORUM_INSTRUCTIONS_FALLBACK;

    // Anchored allowlist pattern — requires /gsd: prefix and word boundary after command.
    // This prevents /gsd:execute-phase from matching when allowlist contains 'execute',
    // and prevents substring matches within longer strings.
    const cmdPattern = new RegExp('^\\s*\\/gsd:(' + commands.join('|') + ')(\\s|$)');

    if (!cmdPattern.test(prompt)) {
      process.exit(0); // Silent pass — UPS-05
    }

    // Inject quorum instructions via additionalContext (NOT systemMessage)
    process.stdout.write(JSON.stringify({
      hookSpecificOutput: {
        hookEventName: 'UserPromptSubmit',
        additionalContext: instructions
      }
    }));
    process.exit(0);

  } catch (e) {
    process.exit(0); // Fail-open on any error
  }
});
