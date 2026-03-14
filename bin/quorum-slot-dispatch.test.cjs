#!/usr/bin/env node
'use strict';
// bin/quorum-slot-dispatch.test.cjs
// TDD tests for v0.24-05: Prompt construction (DISP-04) and output parsing (DISP-05)
// Requirements: DISP-04, DISP-05
//
// STRUCTURAL tests are RED until Plan 02 creates bin/quorum-slot-dispatch.cjs.
// BEHAVIORAL tests are RED until Plan 02 implements the exported functions.
// Pattern: quorum-slot-dispatch\.cjs|buildModeAPrompt|buildModeBPrompt|parseVerdict|parseReasoning|parseCitations|parseImprovements|emitResultBlock

const { test } = require('node:test');
const assert = require('node:assert');
const path = require('node:path');

// ── Load module with fail-open guard ────────────────────────────────────────
// Wraps require() in try/catch so the runner does not crash when quorum-slot-dispatch.cjs
// does not exist yet. Each test must check `assert.ok(mod, ...)` before calling exports.
let mod;
try {
  mod = require(path.resolve(__dirname, './quorum-slot-dispatch.cjs'));
} catch (e) {
  mod = null;
}

// ── STRUCTURAL TESTS (RED until Plan 02 complete) ────────────────────────────

test('module exists: bin/quorum-slot-dispatch.cjs can be required without error', () => {
  assert.ok(mod, 'bin/quorum-slot-dispatch.cjs not found — expected after Plan 02');
});

test('prompt construction exports: buildModeAPrompt is exported as a function', () => {
  assert.ok(mod, 'bin/quorum-slot-dispatch.cjs not found — expected after Plan 02');
  assert.strictEqual(typeof mod.buildModeAPrompt, 'function',
    'buildModeAPrompt must be exported from bin/quorum-slot-dispatch.cjs');
});

test('prompt construction exports: buildModeBPrompt is exported as a function', () => {
  assert.ok(mod, 'bin/quorum-slot-dispatch.cjs not found — expected after Plan 02');
  assert.strictEqual(typeof mod.buildModeBPrompt, 'function',
    'buildModeBPrompt must be exported from bin/quorum-slot-dispatch.cjs');
});

test('output parsing exports: parseVerdict is exported as a function', () => {
  assert.ok(mod, 'bin/quorum-slot-dispatch.cjs not found — expected after Plan 02');
  assert.strictEqual(typeof mod.parseVerdict, 'function',
    'parseVerdict must be exported from bin/quorum-slot-dispatch.cjs');
});

test('output parsing exports: parseReasoning is exported as a function', () => {
  assert.ok(mod, 'bin/quorum-slot-dispatch.cjs not found — expected after Plan 02');
  assert.strictEqual(typeof mod.parseReasoning, 'function',
    'parseReasoning must be exported from bin/quorum-slot-dispatch.cjs');
});

test('output parsing exports: parseCitations is exported as a function', () => {
  assert.ok(mod, 'bin/quorum-slot-dispatch.cjs not found — expected after Plan 02');
  assert.strictEqual(typeof mod.parseCitations, 'function',
    'parseCitations must be exported from bin/quorum-slot-dispatch.cjs');
});

test('result emission export: emitResultBlock is exported as a function', () => {
  assert.ok(mod, 'bin/quorum-slot-dispatch.cjs not found — expected after Plan 02');
  assert.strictEqual(typeof mod.emitResultBlock, 'function',
    'emitResultBlock must be exported from bin/quorum-slot-dispatch.cjs');
});

test('parseImprovements exported: parseImprovements is exported as a function', () => {
  assert.ok(mod, 'bin/quorum-slot-dispatch.cjs not found — expected after Plan 02');
  assert.strictEqual(typeof mod.parseImprovements, 'function',
    'parseImprovements must be exported from bin/quorum-slot-dispatch.cjs — migration from gsd-quorum-slot-worker-improvements.test.cjs');
});

// ── BEHAVIORAL TESTS — buildModeAPrompt ─────────────────────────────────────

test('buildModeAPrompt Round 1 basic: contains required header, repository, question, and Round 1 instructions', () => {
  assert.ok(mod, 'Module not available yet — expected after Plan 02');
  const result = mod.buildModeAPrompt({ round: 1, repoDir: '/tmp/repo', question: 'Is this good?' });
  assert.ok(result.includes('nForma Quorum — Round 1'),
    'Expected "nForma Quorum — Round 1" in output');
  assert.ok(result.includes('Repository: /tmp/repo'),
    'Expected "Repository: /tmp/repo" in output');
  assert.ok(result.includes('Question: Is this good?'),
    'Expected "Question: Is this good?" in output');
  assert.ok(result.includes('IMPORTANT: Before answering'),
    'Expected Round 1 instruction "IMPORTANT: Before answering" in output');
});

test('buildModeAPrompt Round 1: does NOT include Prior positions (no cross-pollination in R1)', () => {
  assert.ok(mod, 'Module not available yet — expected after Plan 02');
  const result = mod.buildModeAPrompt({ round: 1, repoDir: '/tmp/repo', question: 'Is this good?' });
  assert.ok(!result.includes('Prior positions'),
    'Round 1 prompt must NOT contain "Prior positions" (cross-pollination only in R2+)');
});

test('buildModeAPrompt Round 2 with prior_positions: contains prior positions and revision question', () => {
  assert.ok(mod, 'Module not available yet — expected after Plan 02');
  const result = mod.buildModeAPrompt({
    round: 2,
    repoDir: '/tmp/repo',
    question: 'Is this good?',
    priorPositions: 'Model A: APPROVE — looks fine.'
  });
  assert.ok(result.includes('Prior positions'),
    'Expected "Prior positions" in Round 2 prompt');
  assert.ok(result.includes('do you maintain your answer or revise it'),
    'Expected revision prompt in Round 2 output');
});

test('buildModeAPrompt Round 2: does NOT contain IMPORTANT: Before answering (Round 1 only)', () => {
  assert.ok(mod, 'Module not available yet — expected after Plan 02');
  const result = mod.buildModeAPrompt({
    round: 2,
    repoDir: '/tmp/repo',
    question: 'Is this good?',
    priorPositions: 'Model A: APPROVE — looks fine.'
  });
  assert.ok(!result.includes('IMPORTANT: Before answering'),
    '"IMPORTANT: Before answering" must NOT appear in Round 2 prompts');
});

test('buildModeAPrompt with artifact and review_context: contains artifact section and review context', () => {
  assert.ok(mod, 'Module not available yet — expected after Plan 02');
  const result = mod.buildModeAPrompt({
    round: 1,
    repoDir: '/tmp/repo',
    question: 'Does the plan look right?',
    artifactPath: '.planning/foo.md',
    reviewContext: 'This is a plan.'
  });
  assert.ok(result.includes('=== Artifact ==='),
    'Expected "=== Artifact ===" in output when artifactPath provided');
  assert.ok(result.includes('Path: .planning/foo.md'),
    'Expected "Path: .planning/foo.md" in output');
  assert.ok(result.includes('REVIEW CONTEXT: This is a plan.'),
    'Expected "REVIEW CONTEXT: This is a plan." in output when reviewContext provided');
});

test('buildModeAPrompt with request_improvements: contains improvements instruction block', () => {
  assert.ok(mod, 'Module not available yet — expected after Plan 02');
  const result = mod.buildModeAPrompt({
    round: 1,
    repoDir: '/tmp/repo',
    question: 'Is this good?',
    requestImprovements: true
  });
  assert.ok(result.includes('If you APPROVE and have specific, actionable improvements'),
    'Expected improvements instruction when requestImprovements=true');
  assert.ok(result.includes('Improvements:'),
    'Expected "Improvements:" section header in improvements instruction');
});

test('buildModeAPrompt Round 2 with review_context: includes review context reminder', () => {
  assert.ok(mod, 'Module not available yet — expected after Plan 02');
  const result = mod.buildModeAPrompt({
    round: 2,
    repoDir: '/tmp/repo',
    question: 'Is this good?',
    priorPositions: 'Model A: APPROVE.',
    reviewContext: 'This is a plan.'
  });
  assert.ok(result.includes('REVIEW CONTEXT REMINDER: This is a plan.'),
    'Expected "REVIEW CONTEXT REMINDER: This is a plan." in Round 2 prompt with reviewContext');
});

// ── BEHAVIORAL TESTS — buildModeBPrompt ─────────────────────────────────────

test('buildModeBPrompt Round 1: contains execution review header, traces section, and verdict format', () => {
  assert.ok(mod, 'Module not available yet — expected after Plan 02');
  const result = mod.buildModeBPrompt({
    round: 1,
    repoDir: '/tmp/repo',
    question: 'Does it pass?',
    traces: '=== Command: node --test === exit 0'
  });
  assert.ok(result.includes('nForma Quorum — Execution Review (Round 1)'),
    'Expected "nForma Quorum — Execution Review (Round 1)" in Mode B prompt');
  assert.ok(result.includes('=== EXECUTION TRACES ==='),
    'Expected "=== EXECUTION TRACES ===" section in Mode B prompt');
  assert.ok(result.includes('verdict: APPROVE | REJECT | FLAG'),
    'Expected verdict format "verdict: APPROVE | REJECT | FLAG" in Mode B prompt');
});

test('buildModeBPrompt Round 2 with prior_positions: contains prior positions section', () => {
  assert.ok(mod, 'Module not available yet — expected after Plan 02');
  const result = mod.buildModeBPrompt({
    round: 2,
    repoDir: '/tmp/repo',
    question: 'Does it pass?',
    traces: '=== Command: node --test === exit 0',
    priorPositions: 'Model A: APPROVE — tests pass.'
  });
  assert.ok(result.includes('Prior positions'),
    'Expected "Prior positions" in Mode B Round 2 prompt');
});

// ── BEHAVIORAL TESTS — parseVerdict ─────────────────────────────────────────

test('parseVerdict Mode B — APPROVE: extracts APPROVE from verdict line', () => {
  assert.ok(mod, 'Module not available yet — expected after Plan 02');
  const result = mod.parseVerdict('verdict: APPROVE\nreasoning: Tests pass.');
  assert.strictEqual(result, 'APPROVE',
    'Expected parseVerdict to return "APPROVE" when verdict: APPROVE in output');
});

test('parseVerdict Mode B — REJECT: extracts REJECT from verdict line', () => {
  assert.ok(mod, 'Module not available yet — expected after Plan 02');
  const result = mod.parseVerdict('verdict: REJECT\nreasoning: Tests fail.');
  assert.strictEqual(result, 'REJECT',
    'Expected parseVerdict to return "REJECT" when verdict: REJECT in output');
});

test('parseVerdict Mode B — FLAG: extracts FLAG from verdict line', () => {
  assert.ok(mod, 'Module not available yet — expected after Plan 02');
  const result = mod.parseVerdict('verdict: FLAG\nreasoning: Ambiguous result.');
  assert.strictEqual(result, 'FLAG',
    'Expected parseVerdict to return "FLAG" when verdict: FLAG in output');
});

test('parseVerdict Mode B — no match defaults to FLAG', () => {
  assert.ok(mod, 'Module not available yet — expected after Plan 02');
  const result = mod.parseVerdict('Some random output without verdict');
  assert.strictEqual(result, 'FLAG',
    'Expected parseVerdict to return "FLAG" when no verdict: line found (fail-open default)');
});

// ── BEHAVIORAL TESTS — parseReasoning ───────────────────────────────────────

test('parseReasoning — extracts reasoning from reasoning: line', () => {
  assert.ok(mod, 'Module not available yet — expected after Plan 02');
  const result = mod.parseReasoning('verdict: APPROVE\nreasoning: All checks pass and tests are green.');
  assert.ok(result && result.includes('All checks pass'),
    'Expected parseReasoning to extract text after "reasoning:" line');
});

test('parseReasoning — returns null when no reasoning line present', () => {
  assert.ok(mod, 'Module not available yet — expected after Plan 02');
  const result = mod.parseReasoning('verdict: APPROVE\nsome other text');
  // Either null or empty — must not throw
  assert.ok(result === null || result === '' || result === undefined,
    'Expected parseReasoning to return null/empty when no reasoning: line present');
});

// ── BEHAVIORAL TESTS — parseCitations ───────────────────────────────────────

test('parseCitations — extracts citation block from citations: | section', () => {
  assert.ok(mod, 'Module not available yet — expected after Plan 02');
  const input = 'citations: |\n  bin/foo.cjs line 42\n  bin/bar.cjs line 10';
  const result = mod.parseCitations(input);
  assert.ok(result && result.includes('bin/foo.cjs line 42'),
    'Expected parseCitations to extract "bin/foo.cjs line 42" from citations block');
});

test('parseCitations — handles mixed indentation (tab vs space)', () => {
  assert.ok(mod, 'Module not available yet — expected after Plan 02');
  const input = 'citations: |\n\tbin/foo.cjs line 42\n\tbin/bar.cjs line 10';
  const result = mod.parseCitations(input);
  // Tab-indented citations must still be extracted
  assert.ok(result && result.includes('bin/foo.cjs line 42'),
    'Expected parseCitations to handle tab-indented citations');
});

test('parseCitations — returns null when no citations section present', () => {
  assert.ok(mod, 'Module not available yet — expected after Plan 02');
  const result = mod.parseCitations('verdict: APPROVE\nreasoning: No issues.');
  assert.ok(result === null || result === '' || result === undefined,
    'Expected parseCitations to return null when no citations: section in output');
});

// ── BEHAVIORAL TESTS — emitResultBlock ──────────────────────────────────────

test('emitResultBlock — produces correct YAML format with required fields', () => {
  assert.ok(mod, 'Module not available yet — expected after Plan 02');
  const result = mod.emitResultBlock({
    slot: 'gemini-1',
    round: 1,
    verdict: 'APPROVE',
    reasoning: 'OK',
    rawOutput: 'test output'
  });
  assert.ok(result.includes('slot: gemini-1'),
    'Expected "slot: gemini-1" in emitResultBlock output');
  assert.ok(result.includes('round: 1'),
    'Expected "round: 1" in emitResultBlock output');
  assert.ok(result.includes('verdict: APPROVE'),
    'Expected "verdict: APPROVE" in emitResultBlock output');
});

// ── NEW TESTS FOR REQUIREMENTS MATCHING ──────────────────────────────────────

test('loadRequirements smoke test: loads 237+ requirements from .planning/formal/requirements.json', () => {
  assert.ok(mod, 'Module not available yet');
  const reqs = mod.loadRequirements(process.cwd());
  assert.ok(Array.isArray(reqs), 'loadRequirements must return an array');
  assert.ok(reqs.length > 200, `Expected > 200 requirements, got ${reqs.length}`);
  for (const req of reqs.slice(0, 5)) {
    assert.ok(req.id, `Requirement ${JSON.stringify(req)} missing id field`);
    assert.ok(req.text, `Requirement ${req.id} missing text field`);
    assert.ok(req.category, `Requirement ${req.id} missing category field`);
  }
});

test('loadRequirements fail-open: returns empty array on nonexistent path', () => {
  assert.ok(mod, 'Module not available yet');
  const reqs = mod.loadRequirements('/nonexistent/path/that/does/not/exist');
  assert.ok(Array.isArray(reqs), 'loadRequirements must return an array');
  assert.strictEqual(reqs.length, 0, 'Expected empty array for nonexistent path');
});

test('matchRequirementsByKeywords — quorum keywords: returns DISP/QUORUM requirements', () => {
  assert.ok(mod, 'Module not available yet');
  const reqs = mod.loadRequirements(process.cwd());
  const matched = mod.matchRequirementsByKeywords(reqs, 'quorum dispatch timeout slot', null);
  assert.ok(matched.length > 0, 'Expected at least one match for "quorum dispatch"');
  assert.ok(matched.length <= 20, `Expected <= 20 matches, got ${matched.length}`);
  const hasDispOrQuorum = matched.some(r =>
    r.id.startsWith('DISP') || r.id.startsWith('QUORUM') || r.category.includes('Quorum')
  );
  assert.ok(hasDispOrQuorum, 'Expected at least one DISP or QUORUM requirement in matches');
});

test('matchRequirementsByKeywords — hook keywords: returns Hooks & Enforcement requirements', () => {
  assert.ok(mod, 'Module not available yet');
  const reqs = mod.loadRequirements(process.cwd());
  const matched = mod.matchRequirementsByKeywords(reqs, 'stop hook enforcement oscillation', null);
  assert.ok(matched.length > 0, 'Expected at least one match for "stop hook enforcement"');
  const hasHookOrEnforcement = matched.some(r =>
    r.category.includes('Hooks') || r.category.includes('Enforcement')
  );
  assert.ok(hasHookOrEnforcement, 'Expected at least one hook/enforcement requirement in matches');
});

test('matchRequirementsByKeywords — artifact path matching: maps artifact path to category', () => {
  assert.ok(mod, 'Module not available yet');
  const reqs = mod.loadRequirements(process.cwd());
  const matched = mod.matchRequirementsByKeywords(reqs, 'review this', 'hooks/nf-stop.js');
  assert.ok(matched.length > 0, 'Expected matches when artifact path contains "hook"');
  const hasHookOrEnforcement = matched.some(r =>
    r.category.includes('Hooks') || r.category.includes('Enforcement')
  );
  assert.ok(hasHookOrEnforcement, 'Expected hook/enforcement requirements from artifact path');
});

test('matchRequirementsByKeywords — gibberish query returns empty array', () => {
  assert.ok(mod, 'Module not available yet');
  const reqs = mod.loadRequirements(process.cwd());
  const matched = mod.matchRequirementsByKeywords(reqs, 'xyzzy flurble 12345', null);
  assert.ok(Array.isArray(matched), 'matchRequirementsByKeywords must return an array');
  assert.strictEqual(matched.length, 0, 'Expected zero matches for gibberish query');
});

test('matchRequirementsByKeywords — broad query capped at 20 results', () => {
  assert.ok(mod, 'Module not available yet');
  const reqs = mod.loadRequirements(process.cwd());
  const matched = mod.matchRequirementsByKeywords(
    reqs,
    'quorum hook install config test formal plan observe',
    null
  );
  assert.ok(matched.length <= 20, `Expected <= 20 matches, got ${matched.length}`);
});

test('formatRequirementsSection — formats correctly with requirement data', () => {
  assert.ok(mod, 'Module not available yet');
  const mockReqs = [
    { id: 'TEST-01', text: 'test text', category: 'Testing' },
    { id: 'TEST-02', text: 'another test', category: 'Testing' }
  ];
  const result = mod.formatRequirementsSection(mockReqs);
  assert.ok(result, 'formatRequirementsSection must not return null for non-empty array');
  assert.ok(result.includes('APPLICABLE REQUIREMENTS'), 'Expected header in formatted section');
  assert.ok(result.includes('[TEST-01]'), 'Expected [TEST-01] requirement ID in output');
  assert.ok(result.includes('[TEST-02]'), 'Expected [TEST-02] requirement ID in output');
  assert.ok(result.includes('test text'), 'Expected requirement text in output');
  assert.ok(result.includes('Testing'), 'Expected category in output');
});

test('formatRequirementsSection — returns null for empty array', () => {
  assert.ok(mod, 'Module not available yet');
  const result = mod.formatRequirementsSection([]);
  assert.strictEqual(result, null, 'formatRequirementsSection must return null for empty array');
});

test('buildModeAPrompt includes requirements section when provided', () => {
  assert.ok(mod, 'Module not available yet');
  const mockReqs = [
    { id: 'R-01', text: 'must validate', category: 'Testing' }
  ];
  const result = mod.buildModeAPrompt({
    round: 1,
    repoDir: '/tmp/repo',
    question: 'Is this good?',
    requirements: mockReqs
  });
  assert.ok(result.includes('APPLICABLE REQUIREMENTS'),
    'Expected "APPLICABLE REQUIREMENTS" in Mode A prompt with requirements');
  assert.ok(result.includes('[R-01]'),
    'Expected requirement ID in Mode A prompt');
});

test('buildModeAPrompt omits requirements section when empty array', () => {
  assert.ok(mod, 'Module not available yet');
  const result = mod.buildModeAPrompt({
    round: 1,
    repoDir: '/tmp/repo',
    question: 'Is this good?',
    requirements: []
  });
  assert.ok(!result.includes('APPLICABLE REQUIREMENTS'),
    'Expected NO "APPLICABLE REQUIREMENTS" section when requirements array is empty');
});

test('buildModeBPrompt includes requirements section when provided', () => {
  assert.ok(mod, 'Module not available yet');
  const mockReqs = [
    { id: 'R-01', text: 'must validate', category: 'Testing' }
  ];
  const result = mod.buildModeBPrompt({
    round: 1,
    repoDir: '/tmp/repo',
    question: 'Does it pass?',
    traces: '=== test output ===',
    requirements: mockReqs
  });
  assert.ok(result.includes('APPLICABLE REQUIREMENTS'),
    'Expected "APPLICABLE REQUIREMENTS" in Mode B prompt with requirements');
  assert.ok(result.includes('[R-01]'),
    'Expected requirement ID in Mode B prompt');
});

// ── BEHAVIORAL TESTS — EXEC-01 review-only restriction ──────────────────────

test('buildModeBPrompt with reviewOnly=true includes READ-ONLY restriction text', () => {
  assert.ok(mod, 'Module not available yet');
  const result = mod.buildModeBPrompt({
    round: 1,
    repoDir: '/tmp/repo',
    question: 'Does it pass?',
    traces: '=== test output ===',
    reviewOnly: true,
  });
  assert.ok(result.includes('READ-ONLY review task'),
    'Expected "READ-ONLY review task" restriction text when reviewOnly=true');
  assert.ok(result.includes('Do NOT use Write, Edit, Bash(write)'),
    'Expected explicit tool restriction in review-only mode');
});

test('buildModeBPrompt with reviewOnly=false does NOT include READ-ONLY restriction text', () => {
  assert.ok(mod, 'Module not available yet');
  const result = mod.buildModeBPrompt({
    round: 1,
    repoDir: '/tmp/repo',
    question: 'Does it pass?',
    traces: '=== test output ===',
    reviewOnly: false,
  });
  assert.ok(!result.includes('READ-ONLY review task'),
    'Expected NO "READ-ONLY review task" restriction when reviewOnly=false');
});

test('buildModeBPrompt with reviewOnly undefined does NOT include READ-ONLY restriction text', () => {
  assert.ok(mod, 'Module not available yet');
  const result = mod.buildModeBPrompt({
    round: 1,
    repoDir: '/tmp/repo',
    question: 'Does it pass?',
    traces: '=== test output ===',
  });
  assert.ok(!result.includes('READ-ONLY review task'),
    'Expected NO "READ-ONLY review task" restriction when reviewOnly is undefined');
});

test('buildModeAPrompt does NOT include READ-ONLY restriction regardless of reviewOnly', () => {
  assert.ok(mod, 'Module not available yet');
  const result = mod.buildModeAPrompt({
    round: 1,
    repoDir: '/tmp/repo',
    question: 'Is this good?',
  });
  assert.ok(!result.includes('READ-ONLY review task'),
    'Mode A prompts must NOT contain review-only restriction text');
});

// ── BEHAVIORAL TESTS — enrichPromptWithRetrieval (ORCH-01) ──────────────────

test('enrichPromptWithRetrieval export: enrichPromptWithRetrieval is exported as a function', () => {
  assert.ok(mod, 'Module not available yet');
  assert.strictEqual(typeof mod.enrichPromptWithRetrieval, 'function',
    'enrichPromptWithRetrieval must be exported from bin/quorum-slot-dispatch.cjs');
});

test('enrichPromptWithRetrieval — returns original prompt when no context needs detected', () => {
  assert.ok(mod, 'Module not available yet');
  const original = 'Test prompt content';
  // Empty question + null artifactPath → no domains detected → no enrichment
  const result = mod.enrichPromptWithRetrieval(original, '', null, '/nonexistent/path/xyz');
  assert.ok(typeof result === 'string', 'enrichPromptWithRetrieval must return a string');
  assert.strictEqual(result, original, 'Should return original prompt when no context needs detected');
});

test('enrichPromptWithRetrieval — appends RETRIEVED CONTEXT when context is found', () => {
  assert.ok(mod, 'Module not available yet');
  const original = 'Test prompt about testing';
  // Use the real cwd which has .planning/formal/ files; 'test coverage verify' triggers test domain
  const result = mod.enrichPromptWithRetrieval(original, 'test coverage verify', null, process.cwd());
  if (result !== original) {
    assert.ok(result.includes('=== RETRIEVED CONTEXT ==='),
      'Expected "=== RETRIEVED CONTEXT ===" markers when context is retrieved');
    assert.ok(result.startsWith(original),
      'Enriched prompt must start with the original prompt');
  }
});

test('enrichPromptWithRetrieval — fails open on errors (invalid cwd)', () => {
  assert.ok(mod, 'Module not available yet');
  const original = 'Test prompt content';
  let result;
  assert.doesNotThrow(() => {
    result = mod.enrichPromptWithRetrieval(original, 'test query', 'some/path.js', '/nonexistent/invalid/path');
  }, 'enrichPromptWithRetrieval must not throw on invalid cwd');
  assert.ok(typeof result === 'string', 'enrichPromptWithRetrieval must return a string');
});

test('enrichPromptWithRetrieval — respects token budget', () => {
  assert.ok(mod, 'Module not available yet');
  const original = 'Test prompt';
  const result = mod.enrichPromptWithRetrieval(original, 'formal verification alloy tla prism', null, process.cwd());
  const retriever = require(path.resolve(__dirname, './context-retriever.cjs'));
  const budget = retriever.TOKEN_BUDGET_CHARS;
  const addedLength = result.length - original.length;
  assert.ok(addedLength <= budget + 200,
    'Added context (' + addedLength + ' chars) must be within TOKEN_BUDGET_CHARS (' + budget + ')');
});

// ── classifyDispatchError unit tests ─────────────────────────────────────────

test('classifyDispatchError export: classifyDispatchError is exported as a function', () => {
  assert.ok(mod, 'Module not available yet');
  assert.strictEqual(typeof mod.classifyDispatchError, 'function',
    'classifyDispatchError must be exported from bin/quorum-slot-dispatch.cjs');
});

test('TC-DISPATCH-UNAVAIL-1: classifyDispatchError returns TIMEOUT when output contains TIMEOUT', () => {
  assert.ok(mod, 'Module not available yet');
  const result = mod.classifyDispatchError('Process TIMEOUT after 60000ms — slot did not respond');
  assert.strictEqual(result, 'TIMEOUT', 'Must classify TIMEOUT string as TIMEOUT');
});

test('TC-DISPATCH-UNAVAIL-2: classifyDispatchError returns AUTH when output contains 401', () => {
  assert.ok(mod, 'Module not available yet');
  const result = mod.classifyDispatchError('Error: 401 Unauthorized — invalid API key');
  assert.strictEqual(result, 'AUTH', 'Must classify 401 string as AUTH');
});

test('TC-DISPATCH-UNAVAIL-2b: classifyDispatchError returns AUTH when output contains 403', () => {
  assert.ok(mod, 'Module not available yet');
  const result = mod.classifyDispatchError('403 Forbidden access denied');
  assert.strictEqual(result, 'AUTH', 'Must classify 403 string as AUTH');
});

test('TC-DISPATCH-UNAVAIL-3: classifyDispatchError returns QUOTA when output contains quota', () => {
  assert.ok(mod, 'Module not available yet');
  const result = mod.classifyDispatchError('Error: quota exceeded for this model');
  assert.strictEqual(result, 'QUOTA', 'Must classify quota string as QUOTA');
});

test('TC-DISPATCH-UNAVAIL-4: classifyDispatchError returns SPAWN_ERROR when output contains spawn error', () => {
  assert.ok(mod, 'Module not available yet');
  const result = mod.classifyDispatchError('[spawn error: ENOENT]');
  assert.strictEqual(result, 'SPAWN_ERROR', 'Must classify spawn error as SPAWN_ERROR');
});

test('TC-DISPATCH-UNAVAIL-5: classifyDispatchError returns CLI_SYNTAX when output contains unknown flag', () => {
  assert.ok(mod, 'Module not available yet');
  const result = mod.classifyDispatchError('Usage: gemini [options]\nunknown flag --foo');
  assert.strictEqual(result, 'CLI_SYNTAX', 'Must classify unknown flag as CLI_SYNTAX');
});

test('TC-DISPATCH-UNAVAIL-6: classifyDispatchError returns UNKNOWN for unrecognized output', () => {
  assert.ok(mod, 'Module not available yet');
  const result = mod.classifyDispatchError('Something went wrong');
  assert.strictEqual(result, 'UNKNOWN', 'Must classify unrecognized output as UNKNOWN');
});

test('TC-DISPATCH-UNAVAIL-7: emitResultBlock includes error_type when provided', () => {
  assert.ok(mod, 'Module not available yet');
  const block = mod.emitResultBlock({
    slot: 'codex-1',
    round: 1,
    verdict: 'UNAVAIL',
    reasoning: 'UNAVAIL (TIMEOUT): process timed out after 60000ms',
    rawOutput: 'TIMEOUT after 60000ms',
    isUnavail: true,
    error_type: 'TIMEOUT',
    unavailMessage: 'TIMEOUT after 60000ms',
  });
  assert.ok(block.includes('error_type: TIMEOUT'), 'emitResultBlock must include error_type: TIMEOUT in output');
  assert.ok(block.includes('verdict: UNAVAIL'), 'emitResultBlock must include verdict: UNAVAIL');
});

test('TC-DISPATCH-UNAVAIL-8: emitResultBlock omits error_type when not provided', () => {
  assert.ok(mod, 'Module not available yet');
  const block = mod.emitResultBlock({
    slot: 'codex-1',
    round: 1,
    verdict: 'APPROVE',
    reasoning: 'Looks good',
    rawOutput: 'APPROVE',
  });
  assert.ok(!block.includes('error_type:'), 'emitResultBlock must NOT include error_type for non-UNAVAIL results');
});

test('TC-DISPATCH-UNAVAIL-9: UNAVAIL reasoning includes first 200 chars of output', () => {
  assert.ok(mod, 'Module not available yet');
  const longOutput = 'TIMEOUT occurred during processing. ' + 'x'.repeat(300);
  const errorType = mod.classifyDispatchError(longOutput);
  const reasoning = 'UNAVAIL (' + errorType + '): ' + longOutput.slice(0, 200).replace(/\n/g, ' ');
  assert.ok(reasoning.startsWith('UNAVAIL (TIMEOUT):'), 'reasoning must start with UNAVAIL (TIMEOUT):');
  const prefix = 'UNAVAIL (TIMEOUT): ';
  assert.strictEqual(
    reasoning.length,
    prefix.length + 200,
    'reasoning must contain exactly 200 chars of output excerpt'
  );
});
