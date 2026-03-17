#!/usr/bin/env node
'use strict';
/** @requirement DISP-04 — validates shell escape safety: prompts piped via stdin not CLI args */

/**
 * SHELL-ESCAPE-01 regression tests — ccr slots must pipe prompts via stdin,
 * not as -p CLI args, to avoid shell interpretation of backticks/$.
 */

const assert = require('assert');
const { buildSpawnArgs } = require('../bin/call-quorum-slot.cjs');

const origLog = console.log;
let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    origLog(`  PASS: ${name}`);
    passed++;
  } catch (e) {
    origLog(`  FAIL: ${name}`);
    origLog(`    ${e.message}`);
    failed++;
  }
}

origLog('SHELL-ESCAPE-01 regression tests');
origLog('─'.repeat(50));

// ── CCR slot: prompt must NOT appear in args ────────────────────────────────

test('ccr slot strips -p and {prompt} from args', () => {
  const provider = {
    display_type: 'claude-code-router',
    cli: '/opt/homebrew/bin/ccr',
    args_template: ['claude-1', '-p', '{prompt}', '--dangerously-skip-permissions'],
  };
  const prompt = 'hello `world` $HOME';

  const { args, useStdinPrompt } = buildSpawnArgs(provider, prompt, null);

  assert.ok(useStdinPrompt, 'ccr must use stdin for prompt');
  assert.ok(!args.includes(prompt), 'prompt must NOT be in args');
  assert.ok(!args.includes('-p'), '-p flag must be stripped');
  assert.ok(!args.includes('{prompt}'), '{prompt} placeholder must be stripped');
  assert.deepStrictEqual(args, ['claude-1', '--dangerously-skip-permissions']);
});

// ── CCR detection via cli path ──────────────────────────────────────────────

test('ccr detected by cli path containing "ccr"', () => {
  const provider = {
    display_type: 'some-other-type',
    cli: '/usr/local/bin/ccr',
    args_template: ['preset', '-p', '{prompt}'],
  };

  const { useStdinPrompt } = buildSpawnArgs(provider, 'test', null);
  assert.ok(useStdinPrompt, 'should detect ccr via cli path');
});

// ── Non-ccr slot: prompt substituted into args ──────────────────────────────

test('non-ccr slot substitutes prompt into args normally', () => {
  const provider = {
    display_type: 'gemini-cli',
    cli: '/opt/homebrew/bin/gemini',
    args_template: ['-m', 'gemini-3-pro-preview', '-p', '{prompt}'],
  };
  const prompt = 'hello `world` $HOME';

  const { args, useStdinPrompt } = buildSpawnArgs(provider, prompt, null);

  assert.ok(!useStdinPrompt, 'non-ccr must NOT use stdin');
  assert.ok(args.includes(prompt), 'prompt must appear in args');
  assert.deepStrictEqual(args, ['-m', 'gemini-3-pro-preview', '-p', 'hello `world` $HOME']);
});

// ── CCR + allowedTools injection ────────────────────────────────────────────

test('ccr slot injects --allowedTools before --dangerously-skip-permissions', () => {
  const provider = {
    display_type: 'claude-code-router',
    cli: '/opt/homebrew/bin/ccr',
    args_template: ['claude-1', '-p', '{prompt}', '--dangerously-skip-permissions'],
  };

  const { args } = buildSpawnArgs(provider, 'test', 'Read,Grep,Glob');

  const atIdx = args.indexOf('--allowedTools');
  const dspIdx = args.indexOf('--dangerously-skip-permissions');
  assert.ok(atIdx !== -1, '--allowedTools must be present');
  assert.ok(atIdx < dspIdx, '--allowedTools must come before --dangerously-skip-permissions');
  assert.strictEqual(args[atIdx + 1], 'Read,Grep,Glob');
});

// ── Non-ccr slot: allowedTools NOT injected ─────────────────────────────────

test('non-ccr slot does not inject --allowedTools', () => {
  const provider = {
    display_type: 'codex-cli',
    cli: '/opt/homebrew/bin/codex',
    args_template: ['exec', '{prompt}'],
  };

  const { args } = buildSpawnArgs(provider, 'test', 'Read,Grep,Glob');

  assert.ok(!args.includes('--allowedTools'), 'non-ccr must not get --allowedTools');
});

// ── Backtick-heavy prompt with ccr ──────────────────────────────────────────

test('ccr args contain zero shell-sensitive chars from prompt', () => {
  const provider = {
    display_type: 'claude-code-router',
    cli: '/opt/homebrew/bin/ccr',
    args_template: ['claude-3', '-p', '{prompt}', '--dangerously-skip-permissions'],
  };
  const dangerousPrompt = 'Step 2 T1 sub-CLI: [`t1Unused.length`] $HOME $(whoami) "quoted"';

  const { args } = buildSpawnArgs(provider, dangerousPrompt, null);

  const joined = args.join(' ');
  assert.ok(!joined.includes('`'), 'no backticks should leak into ccr args');
  assert.ok(!joined.includes('$HOME'), 'no $HOME should leak into ccr args');
  assert.ok(!joined.includes('$('), 'no command substitution should leak into ccr args');
});

origLog('─'.repeat(50));
origLog(`Results: ${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
