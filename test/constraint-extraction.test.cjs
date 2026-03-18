'use strict';

const { describe, it, before } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

const {
  extractTlaConstraints,
  extractAlloyConstraints,
  renderConstraintSummary
} = require('../bin/model-constrained-fix.cjs');

// ── Pre-flight: verify test fixtures exist ────────────────────────────────────

const TLA_CIRCUIT_BREAKER = '.planning/formal/tla/NFCircuitBreaker.tla';
const TLA_CONFIG_LOADER = '.planning/formal/tla/NFConfigLoader.tla';
const ALLOY_ACCOUNT_POOL = '.planning/formal/alloy/account-pool-structure.als';
const ALLOY_ARCH_REGISTRY = '.planning/formal/alloy/architecture-registry.als';

before(() => {
  assert.ok(fs.existsSync(TLA_CIRCUIT_BREAKER), 'Test fixture NFCircuitBreaker.tla must exist');
  assert.ok(fs.existsSync(ALLOY_ACCOUNT_POOL), 'Test fixture account-pool-structure.als must exist');
  assert.ok(fs.existsSync(TLA_CONFIG_LOADER), 'Test fixture NFConfigLoader.tla must exist');
  assert.ok(fs.existsSync(ALLOY_ARCH_REGISTRY), 'Test fixture architecture-registry.als must exist');
});

// ── TLA+ Extraction Tests (CEX-01) ───────────────────────────────────────────

describe('extractTlaConstraints', () => {
  it('extracts TypeOK invariant with active \\in BOOLEAN from NFCircuitBreaker.tla', () => {
    const content = fs.readFileSync(TLA_CIRCUIT_BREAKER, 'utf-8');
    const constraints = extractTlaConstraints(content, TLA_CIRCUIT_BREAKER);
    const typeOK = constraints.find(c => c.name === 'TypeOK');
    assert.ok(typeOK, 'TypeOK invariant should be extracted');
    assert.strictEqual(typeOK.type, 'invariant');
    assert.ok(typeOK.formal.includes('active'), 'TypeOK formal should mention active');
    assert.ok(typeOK.formal.includes('\\in BOOLEAN'), 'TypeOK formal should contain \\in BOOLEAN');
  });

  it('extracts VARIABLES section (active, disabled)', () => {
    const content = fs.readFileSync(TLA_CIRCUIT_BREAKER, 'utf-8');
    const constraints = extractTlaConstraints(content, TLA_CIRCUIT_BREAKER);
    const vars = constraints.filter(c => c.type === 'state_variable');
    const varNames = vars.map(v => v.name);
    assert.ok(varNames.includes('active'), 'Should extract active variable');
    assert.ok(varNames.includes('disabled'), 'Should extract disabled variable');
  });

  it('extracts action predicates (OscillationDetected, ResetBreaker, DisableBreaker, EnableBreaker)', () => {
    const content = fs.readFileSync(TLA_CIRCUIT_BREAKER, 'utf-8');
    const constraints = extractTlaConstraints(content, TLA_CIRCUIT_BREAKER);
    const actions = constraints.filter(c => c.type === 'action');
    const actionNames = actions.map(a => a.name);
    assert.ok(actionNames.includes('OscillationDetected'), 'Should extract OscillationDetected');
    assert.ok(actionNames.includes('ResetBreaker'), 'Should extract ResetBreaker');
    assert.ok(actionNames.includes('DisableBreaker'), 'Should extract DisableBreaker');
    assert.ok(actionNames.includes('EnableBreaker'), 'Should extract EnableBreaker');
  });

  it('links @requirement DETECT-01 to TypeOK with confidence 0.95', () => {
    const content = fs.readFileSync(TLA_CIRCUIT_BREAKER, 'utf-8');
    const constraints = extractTlaConstraints(content, TLA_CIRCUIT_BREAKER);
    const typeOK = constraints.find(c => c.name === 'TypeOK');
    assert.strictEqual(typeOK.requirement_id, 'DETECT-01');
    assert.strictEqual(typeOK.confidence, 0.95);
  });

  it('assigns confidence 0.7 to actions without @requirement markers', () => {
    const content = fs.readFileSync(TLA_CIRCUIT_BREAKER, 'utf-8');
    const constraints = extractTlaConstraints(content, TLA_CIRCUIT_BREAKER);
    const oscDetected = constraints.find(c => c.name === 'OscillationDetected');
    assert.ok(oscDetected, 'OscillationDetected should exist');
    assert.strictEqual(oscDetected.confidence, 0.7);
  });

  it('generalizes to NFConfigLoader.tla (second spec)', () => {
    const content = fs.readFileSync(TLA_CONFIG_LOADER, 'utf-8');
    const constraints = extractTlaConstraints(content, TLA_CONFIG_LOADER);

    // Should extract TypeOK
    const typeOK = constraints.find(c => c.name === 'TypeOK');
    assert.ok(typeOK, 'Should extract TypeOK from NFConfigLoader');
    assert.strictEqual(typeOK.type, 'invariant');

    // Should extract variables (globalLoaded, projectLoaded, mergedConfig, valid)
    const vars = constraints.filter(c => c.type === 'state_variable');
    assert.ok(vars.length >= 4, 'Should extract at least 4 state variables');

    // Should extract actions
    const actions = constraints.filter(c => c.type === 'action');
    assert.ok(actions.length >= 2, 'Should extract multiple actions');
  });

  it('sets spec_path on all extracted constraints', () => {
    const content = fs.readFileSync(TLA_CIRCUIT_BREAKER, 'utf-8');
    const constraints = extractTlaConstraints(content, TLA_CIRCUIT_BREAKER);
    for (const c of constraints) {
      assert.strictEqual(c.spec_path, TLA_CIRCUIT_BREAKER);
    }
  });
});

// ── Alloy Extraction Tests (CEX-02) ──────────────────────────────────────────

describe('extractAlloyConstraints', () => {
  it('extracts PoolState signature with pool and active fields', () => {
    const content = fs.readFileSync(ALLOY_ACCOUNT_POOL, 'utf-8');
    const constraints = extractAlloyConstraints(content, ALLOY_ACCOUNT_POOL);
    const poolState = constraints.find(c => c.name === 'PoolState' && c.type === 'signature');
    assert.ok(poolState, 'PoolState signature should be extracted');
    assert.ok(poolState.fields.length >= 2, 'PoolState should have at least 2 fields');
    const fieldsJoined = poolState.fields.join(' ');
    assert.ok(fieldsJoined.includes('pool'), 'Fields should include pool');
    assert.ok(fieldsJoined.includes('active'), 'Fields should include active');
  });

  it('extracts ValidState predicate', () => {
    const content = fs.readFileSync(ALLOY_ACCOUNT_POOL, 'utf-8');
    const constraints = extractAlloyConstraints(content, ALLOY_ACCOUNT_POOL);
    const validState = constraints.find(c => c.name === 'ValidState' && c.type === 'predicate');
    assert.ok(validState, 'ValidState predicate should be extracted');
    assert.ok(validState.formal.includes('s.active'), 'ValidState formal should reference s.active');
  });

  it('extracts operation predicates (AddOp, SwitchOp)', () => {
    const content = fs.readFileSync(ALLOY_ACCOUNT_POOL, 'utf-8');
    const constraints = extractAlloyConstraints(content, ALLOY_ACCOUNT_POOL);
    const preds = constraints.filter(c => c.type === 'predicate');
    const predNames = preds.map(p => p.name);
    assert.ok(predNames.includes('AddOp'), 'Should extract AddOp predicate');
    assert.ok(predNames.includes('SwitchOp'), 'Should extract SwitchOp predicate');
  });

  it('links requirement markers from assertions with confidence 0.95', () => {
    const content = fs.readFileSync(ALLOY_ACCOUNT_POOL, 'utf-8');
    const constraints = extractAlloyConstraints(content, ALLOY_ACCOUNT_POOL);
    const addPres = constraints.find(c => c.name === 'AddPreservesValidity' && c.type === 'assertion');
    assert.ok(addPres, 'AddPreservesValidity assertion should be extracted');
    assert.strictEqual(addPres.requirement_id, 'CRED-07');
    assert.strictEqual(addPres.confidence, 0.95);
  });

  it('generalizes to architecture-registry.als (second spec)', () => {
    const content = fs.readFileSync(ALLOY_ARCH_REGISTRY, 'utf-8');
    const constraints = extractAlloyConstraints(content, ALLOY_ARCH_REGISTRY);

    // Should extract signatures
    const sigs = constraints.filter(c => c.type === 'signature');
    assert.ok(sigs.length >= 2, 'Should extract multiple signatures');

    // Should extract facts
    const facts = constraints.filter(c => c.type === 'fact');
    assert.ok(facts.length >= 1, 'Should extract at least one fact');

    // Should extract assertions
    const assertions = constraints.filter(c => c.type === 'assertion');
    assert.ok(assertions.length >= 1, 'Should extract at least one assertion');

    // Should have requirement markers
    const withReqs = constraints.filter(c => c.requirement_id !== null);
    assert.ok(withReqs.length >= 1, 'Should link at least one requirement');
  });

  it('sets spec_path on all extracted constraints', () => {
    const content = fs.readFileSync(ALLOY_ACCOUNT_POOL, 'utf-8');
    const constraints = extractAlloyConstraints(content, ALLOY_ACCOUNT_POOL);
    for (const c of constraints) {
      assert.strictEqual(c.spec_path, ALLOY_ACCOUNT_POOL);
    }
  });
});

// ── English Rendering Tests (CEX-03) ─────────────────────────────────────────

describe('renderConstraintSummary', () => {
  it('produces English with "SAFETY:" prefix for invariants', () => {
    const constraints = [{
      type: 'invariant',
      name: 'TypeOK',
      formal: '/\\ active \\in BOOLEAN',
      requirement_id: 'DETECT-01',
      confidence: 0.95,
      spec_path: 'test.tla'
    }];
    const summary = renderConstraintSummary(constraints);
    assert.ok(summary.constraints[0].english.startsWith('SAFETY:'), 'Should start with SAFETY:');
  });

  it('produces English with "ASSERT:" prefix for assertions', () => {
    const constraints = [{
      type: 'assertion',
      name: 'ValidCheck',
      formal: 'all s: State | valid[s]',
      requirement_id: 'CHECK-01',
      confidence: 0.95,
      spec_path: 'test.als'
    }];
    const summary = renderConstraintSummary(constraints);
    assert.ok(summary.constraints[0].english.startsWith('ASSERT:'), 'Should start with ASSERT:');
  });

  it('limits output to maxConstraints parameter', () => {
    const constraints = [];
    for (let i = 0; i < 10; i++) {
      constraints.push({
        type: 'invariant',
        name: `Inv${i}`,
        formal: 'x = TRUE',
        requirement_id: null,
        confidence: 0.7,
        spec_path: 'test.tla'
      });
    }
    const summary = renderConstraintSummary(constraints, 3);
    assert.strictEqual(summary.constraint_count, 3);
    assert.strictEqual(summary.constraints.length, 3);
  });

  it('sorts by confidence descending', () => {
    const constraints = [
      { type: 'action', name: 'Low', formal: 'x', requirement_id: null, confidence: 0.7, spec_path: 'test.tla' },
      { type: 'invariant', name: 'High', formal: 'y', requirement_id: 'REQ-01', confidence: 0.95, spec_path: 'test.tla' }
    ];
    const summary = renderConstraintSummary(constraints, 10);
    assert.strictEqual(summary.constraints[0].name, 'High', 'Higher confidence should come first');
    assert.strictEqual(summary.constraints[1].name, 'Low');
  });

  it('translates TLA+ operators (AND, is in)', () => {
    const content = fs.readFileSync(TLA_CIRCUIT_BREAKER, 'utf-8');
    const constraints = extractTlaConstraints(content, TLA_CIRCUIT_BREAKER);
    const summary = renderConstraintSummary(constraints, 10);
    const typeOK = summary.constraints.find(c => c.name === 'TypeOK');
    assert.ok(typeOK, 'TypeOK should be in rendered summary');
    assert.ok(typeOK.english.includes('AND'), 'Should translate /\\ to AND');
    assert.ok(typeOK.english.includes('is in'), 'Should translate \\in to is in');
  });

  it('translates Alloy operators (implies, is a member of)', () => {
    const content = fs.readFileSync(ALLOY_ACCOUNT_POOL, 'utf-8');
    const constraints = extractAlloyConstraints(content, ALLOY_ACCOUNT_POOL);
    const summary = renderConstraintSummary(constraints, 10);
    const assertion = summary.constraints.find(c => c.type === 'assertion');
    assert.ok(assertion, 'Should have at least one assertion');
    assert.ok(assertion.english.includes('implies'), 'Should translate => to implies');
  });

  it('includes requirement IDs in rendered output when available', () => {
    const content = fs.readFileSync(TLA_CIRCUIT_BREAKER, 'utf-8');
    const constraints = extractTlaConstraints(content, TLA_CIRCUIT_BREAKER);
    const summary = renderConstraintSummary(constraints, 10);
    const withReq = summary.constraints.find(c => c.requirement_id);
    assert.ok(withReq, 'Should have constraint with requirement_id');
    assert.ok(withReq.english.includes('[Req:'), 'Should include [Req: ...] in english');
  });

  it('returns correct formalism field for TLA+', () => {
    const constraints = [{ type: 'invariant', name: 'X', formal: 'y', requirement_id: null, confidence: 0.7, spec_path: 'test.tla' }];
    const summary = renderConstraintSummary(constraints);
    assert.strictEqual(summary.formalism, 'tla');
  });

  it('returns correct formalism field for Alloy', () => {
    const constraints = [{ type: 'assertion', name: 'X', formal: 'y', requirement_id: null, confidence: 0.7, spec_path: 'test.als' }];
    const summary = renderConstraintSummary(constraints);
    assert.strictEqual(summary.formalism, 'alloy');
  });
});

// ── Edge Cases ───────────────────────────────────────────────────────────────

describe('edge cases', () => {
  it('returns empty array for empty TLA+ spec', () => {
    const constraints = extractTlaConstraints('', 'empty.tla');
    assert.deepStrictEqual(constraints, []);
  });

  it('returns empty array for empty Alloy spec', () => {
    const constraints = extractAlloyConstraints('', 'empty.als');
    assert.deepStrictEqual(constraints, []);
  });

  it('returns empty array for null/undefined input (TLA+)', () => {
    assert.deepStrictEqual(extractTlaConstraints(null, 'x.tla'), []);
    assert.deepStrictEqual(extractTlaConstraints(undefined, 'x.tla'), []);
  });

  it('returns empty array for null/undefined input (Alloy)', () => {
    assert.deepStrictEqual(extractAlloyConstraints(null, 'x.als'), []);
    assert.deepStrictEqual(extractAlloyConstraints(undefined, 'x.als'), []);
  });

  it('handles spec with only VARIABLES (no invariants/assertions)', () => {
    const tlaContent = '---- MODULE Test ----\nVARIABLES x, y\n====';
    const constraints = extractTlaConstraints(tlaContent, 'test.tla');
    const vars = constraints.filter(c => c.type === 'state_variable');
    assert.ok(vars.length >= 2, 'Should extract state variables');
    const invariants = constraints.filter(c => c.type === 'invariant');
    assert.strictEqual(invariants.length, 0, 'Should have no invariants');
  });

  it('handles malformed spec content without crashing (fail-open)', () => {
    const garbage = 'not a valid spec file {{{ \\\\// random text @@@';
    assert.doesNotThrow(() => extractTlaConstraints(garbage, 'bad.tla'));
    assert.doesNotThrow(() => extractAlloyConstraints(garbage, 'bad.als'));
  });

  it('renderConstraintSummary handles empty constraints array', () => {
    const summary = renderConstraintSummary([]);
    assert.strictEqual(summary.constraint_count, 0);
    assert.deepStrictEqual(summary.constraints, []);
  });

  it('renderConstraintSummary handles non-array input gracefully', () => {
    const summary = renderConstraintSummary(null);
    assert.strictEqual(summary.constraint_count, 0);
  });
});
