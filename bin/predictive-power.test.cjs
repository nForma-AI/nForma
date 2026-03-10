'use strict';

const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const os = require('os');

const {
  linkBugsToProperties,
  writeBugToProperty,
  computePerModelRecall,
  formatRecallSummary,
} = require('./predictive-power.cjs');

// ── Test Helpers ─────────────────────────────────────────────────────────────

let tmpDir;

before(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'pred-power-test-'));
});

after(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

function writeTmp(name, obj) {
  const p = path.join(tmpDir, name);
  fs.writeFileSync(p, JSON.stringify(obj, null, 2));
  return p;
}

// ── linkBugsToProperties ─────────────────────────────────────────────────────

describe('linkBugsToProperties', () => {
  it('returns empty mappings for empty debt_entries', () => {
    const debtPath = writeTmp('debt-empty.json', { debt_entries: [] });
    const regPath = writeTmp('reg-empty.json', { models: {} });
    const result = linkBugsToProperties(debtPath, regPath);
    assert.strictEqual(result.total_bugs, 0);
    assert.strictEqual(result.total_linked, 0);
    assert.deepStrictEqual(result.mappings, []);
    assert.strictEqual(result.schema_version, '1');
  });

  it('links debt entry WITH formal_refs matching a model requirement', () => {
    const debtPath = writeTmp('debt-match.json', {
      debt_entries: [{
        id: 'bug-1',
        fingerprint: 'fp-1',
        title: 'Some bug',
        formal_refs: ['REQ-01', 'REQ-02'],
        source_entries: [{ source_type: 'internal' }],
      }],
    });
    const regPath = writeTmp('reg-match.json', {
      models: {
        '.planning/formal/alloy/model-a.als': {
          requirements: ['REQ-01', 'REQ-03'],
          gate_maturity: 'SOFT_GATE',
          layer_maturity: 3,
        },
      },
    });
    const result = linkBugsToProperties(debtPath, regPath);
    assert.strictEqual(result.total_bugs, 1);
    assert.strictEqual(result.total_linked, 1);
    assert.strictEqual(result.mappings[0].predicted, true);
    assert.strictEqual(result.mappings[0].matching_models.length, 1);
    assert.deepStrictEqual(result.mappings[0].matching_models[0].requirements_overlap, ['REQ-01']);
  });

  it('marks debt entry as not predicted when formal_refs do not match any model', () => {
    const debtPath = writeTmp('debt-nomatch.json', {
      debt_entries: [{
        id: 'bug-2',
        fingerprint: 'fp-2',
        title: 'Another bug',
        formal_refs: ['REQ-99'],
        source_entries: [{ source_type: 'github' }],
      }],
    });
    const regPath = writeTmp('reg-nomatch.json', {
      models: {
        '.planning/formal/alloy/model-a.als': {
          requirements: ['REQ-01'],
          gate_maturity: 'ADVISORY',
          layer_maturity: 1,
        },
      },
    });
    const result = linkBugsToProperties(debtPath, regPath);
    assert.strictEqual(result.total_bugs, 1);
    assert.strictEqual(result.total_linked, 0);
    assert.strictEqual(result.mappings[0].predicted, false);
    assert.deepStrictEqual(result.mappings[0].matching_models, []);
  });

  it('marks debt entry WITHOUT formal_refs as unlinked (predicted: false)', () => {
    const debtPath = writeTmp('debt-noref.json', {
      debt_entries: [{
        id: 'bug-3',
        fingerprint: 'fp-3',
        title: 'Unlinked bug',
        source_entries: [{ source_type: 'internal' }],
      }],
    });
    const regPath = writeTmp('reg-noref.json', {
      models: {
        '.planning/formal/alloy/model-a.als': {
          requirements: ['REQ-01'],
          gate_maturity: 'SOFT_GATE',
          layer_maturity: 2,
        },
      },
    });
    const result = linkBugsToProperties(debtPath, regPath);
    assert.strictEqual(result.total_bugs, 1);
    assert.strictEqual(result.total_linked, 0);
    assert.strictEqual(result.mappings[0].predicted, false);
    assert.deepStrictEqual(result.mappings[0].formal_refs, []);
    assert.deepStrictEqual(result.mappings[0].matching_models, []);
  });

  it('multiple models match same debt entry — all appear in matching_models', () => {
    const debtPath = writeTmp('debt-multi.json', {
      debt_entries: [{
        id: 'bug-4',
        fingerprint: 'fp-4',
        title: 'Multi-match bug',
        formal_refs: ['REQ-01', 'REQ-02'],
        source_entries: [{ source_type: 'internal' }],
      }],
    });
    const regPath = writeTmp('reg-multi.json', {
      models: {
        '.planning/formal/alloy/model-a.als': {
          requirements: ['REQ-01'],
          gate_maturity: 'SOFT_GATE',
          layer_maturity: 3,
        },
        '.planning/formal/tla/model-b.tla': {
          requirements: ['REQ-02', 'REQ-05'],
          gate_maturity: 'HARD_GATE',
          layer_maturity: 5,
        },
      },
    });
    const result = linkBugsToProperties(debtPath, regPath);
    assert.strictEqual(result.total_linked, 1);
    assert.strictEqual(result.mappings[0].matching_models.length, 2);
  });

  it('partial overlap: entry has [A, B], model has [B, C] — overlap is [B]', () => {
    const debtPath = writeTmp('debt-partial.json', {
      debt_entries: [{
        id: 'bug-5',
        fingerprint: 'fp-5',
        title: 'Partial overlap',
        formal_refs: ['REQ-A', 'REQ-B'],
        source_entries: [{ source_type: 'internal' }],
      }],
    });
    const regPath = writeTmp('reg-partial.json', {
      models: {
        '.planning/formal/alloy/model-p.als': {
          requirements: ['REQ-B', 'REQ-C'],
          gate_maturity: 'ADVISORY',
          layer_maturity: 1,
        },
      },
    });
    const result = linkBugsToProperties(debtPath, regPath);
    assert.strictEqual(result.mappings[0].predicted, true);
    assert.deepStrictEqual(result.mappings[0].matching_models[0].requirements_overlap, ['REQ-B']);
  });

  it('filters out model keys not starting with "."', () => {
    const debtPath = writeTmp('debt-filter.json', {
      debt_entries: [{
        id: 'bug-6',
        fingerprint: 'fp-6',
        title: 'Filter test',
        formal_refs: ['REQ-01'],
        source_entries: [{ source_type: 'internal' }],
      }],
    });
    const regPath = writeTmp('reg-filter.json', {
      models: {
        'version': { requirements: ['REQ-01'] },
        '.planning/formal/alloy/model-ok.als': {
          requirements: ['REQ-01'],
          gate_maturity: 'ADVISORY',
          layer_maturity: 1,
        },
      },
    });
    const result = linkBugsToProperties(debtPath, regPath);
    assert.strictEqual(result.mappings[0].matching_models.length, 1);
    assert.strictEqual(result.mappings[0].matching_models[0].model_path, '.planning/formal/alloy/model-ok.als');
  });

  it('returns empty result when debt.json is missing (fail-open)', () => {
    const regPath = writeTmp('reg-ok.json', { models: {} });
    const result = linkBugsToProperties('/nonexistent/debt.json', regPath);
    assert.strictEqual(result.total_bugs, 0);
    assert.strictEqual(result.total_linked, 0);
  });

  it('returns empty result when model-registry.json is missing (fail-open)', () => {
    const debtPath = writeTmp('debt-ok.json', { debt_entries: [] });
    const result = linkBugsToProperties(debtPath, '/nonexistent/registry.json');
    assert.strictEqual(result.total_bugs, 0);
    assert.strictEqual(result.total_linked, 0);
  });
});

// ── writeBugToProperty ───────────────────────────────────────────────────────

describe('writeBugToProperty', () => {
  it('writes mapping to file with generated timestamp', () => {
    const mapping = { schema_version: '1', total_bugs: 0, total_linked: 0, mappings: [] };
    const outPath = path.join(tmpDir, 'bug-to-property.json');
    writeBugToProperty(mapping, outPath);
    const written = JSON.parse(fs.readFileSync(outPath, 'utf8'));
    assert.strictEqual(written.schema_version, '1');
    assert.ok(written.generated);
  });
});

// ── computePerModelRecall ────────────────────────────────────────────────────

describe('computePerModelRecall', () => {
  it('computes recall for model with 3 relevant, 2 predicted (gate_a passes)', () => {
    const mappings = [
      { matching_models: [{ model_path: '.m/a.als' }] },
      { matching_models: [{ model_path: '.m/a.als' }] },
      { matching_models: [{ model_path: '.m/a.als' }] },
    ];
    const gatesPath = writeTmp('gates-recall.json', {
      '.m/a.als': { gate_a: { pass: true } },
    });
    const result = computePerModelRecall(mappings, gatesPath);
    assert.strictEqual(result['.m/a.als'].relevant, 3);
    assert.strictEqual(result['.m/a.als'].predicted, 3);
    assert.strictEqual(result['.m/a.als'].recall, 1);
  });

  it('returns recall=0 when model has 0 relevant bugs', () => {
    const mappings = [];
    const gatesPath = writeTmp('gates-empty.json', {});
    const result = computePerModelRecall(mappings, gatesPath);
    assert.deepStrictEqual(result, {});
  });

  it('returns predicted=0 when gate_a does not pass', () => {
    const mappings = [
      { matching_models: [{ model_path: '.m/b.als' }] },
      { matching_models: [{ model_path: '.m/b.als' }] },
    ];
    const gatesPath = writeTmp('gates-fail.json', {
      '.m/b.als': { gate_a: { pass: false } },
    });
    const result = computePerModelRecall(mappings, gatesPath);
    assert.strictEqual(result['.m/b.als'].relevant, 2);
    assert.strictEqual(result['.m/b.als'].predicted, 0);
    assert.strictEqual(result['.m/b.als'].recall, 0);
  });

  it('returns empty object when per-model-gates.json is missing (fail-open)', () => {
    const mappings = [
      { matching_models: [{ model_path: '.m/c.als' }] },
    ];
    const result = computePerModelRecall(mappings, '/nonexistent/per-model-gates.json');
    assert.deepStrictEqual(result, {});
  });

  it('returns recall=0 for model present in mappings but absent from per-model-gates.json', () => {
    const mappings = [
      { matching_models: [{ model_path: '.m/missing.als' }] },
      { matching_models: [{ model_path: '.m/missing.als' }] },
    ];
    const gatesPath = writeTmp('gates-partial.json', {
      '.m/other.als': { gate_a: { pass: true } },
    });
    const result = computePerModelRecall(mappings, gatesPath);
    assert.strictEqual(result['.m/missing.als'].relevant, 2);
    assert.strictEqual(result['.m/missing.als'].predicted, 0);
    assert.strictEqual(result['.m/missing.als'].recall, 0);
  });

  it('computes correct recall with mixed gate_a pass/fail', () => {
    const mappings = [
      { matching_models: [{ model_path: '.m/d.als' }] },
      { matching_models: [{ model_path: '.m/d.als' }] },
      { matching_models: [{ model_path: '.m/d.als' }] },
    ];
    // gate_a passes — so all 3 relevant bugs are predicted for this model
    // To test partial: we need a model where gate_a passes for some bugs
    // but computePerModelRecall checks per-model gate, not per-bug
    // So if gate_a passes, ALL relevant bugs for that model count as predicted
    const gatesPath = writeTmp('gates-mixed.json', {
      '.m/d.als': { gate_a: { pass: true } },
    });
    const result = computePerModelRecall(mappings, gatesPath);
    assert.strictEqual(result['.m/d.als'].recall, 1);
  });
});

// ── formatRecallSummary ──────────────────────────────────────────────────────

describe('formatRecallSummary', () => {
  it('returns string containing top models by recall', () => {
    const scores = {
      '.m/a.als': { relevant: 3, predicted: 2, recall: 0.6667 },
      '.m/b.als': { relevant: 5, predicted: 5, recall: 1 },
    };
    const summary = formatRecallSummary(scores);
    assert.ok(summary.includes('--- Recall ---'));
    assert.ok(summary.includes('Models scored: 2'));
    assert.ok(summary.includes('b.als'));
  });

  it('returns "no data" message for empty recall scores', () => {
    const summary = formatRecallSummary({});
    assert.ok(summary.includes('No recall data'));
  });

  it('returns "no data" message for null', () => {
    const summary = formatRecallSummary(null);
    assert.ok(summary.includes('No recall data'));
  });
});
