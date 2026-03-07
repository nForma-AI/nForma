const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { buildIndex, proximity, EDGE_WEIGHTS, REVERSE_RELS } = require('./formal-proximity.cjs');

describe('formal-proximity builder', () => {

  describe('buildIndex with real files', () => {
    it('should build index from real artifacts without crashing', () => {
      const { index, totalNodes, totalEdges } = buildIndex();
      assert.equal(index.schema_version, '1');
      assert.ok(index.generated);
      assert.equal(index.node_key_format, 'type::id');
      assert.ok(totalNodes > 0, 'should have nodes');
      assert.ok(totalEdges > 0, 'should have edges');
      assert.ok(Object.keys(index.sources).length > 0, 'should have sources');
    });

    it('should produce code_file nodes from scope.json', () => {
      const { index } = buildIndex();
      const codeFileNodes = Object.keys(index.nodes).filter(k => k.startsWith('code_file::'));
      assert.ok(codeFileNodes.length > 0, 'should have code_file nodes');
    });

    it('should produce formal_module nodes from scope.json', () => {
      const { index } = buildIndex();
      const moduleNodes = Object.keys(index.nodes).filter(k => k.startsWith('formal_module::'));
      assert.ok(moduleNodes.length > 0, 'should have formal_module nodes');
    });

    it('should produce constant nodes from constants-mapping.json', () => {
      const { index } = buildIndex();
      const constNodes = Object.keys(index.nodes).filter(k => k.startsWith('constant::'));
      assert.ok(constNodes.length > 0, 'should have constant nodes');
    });

    it('should produce requirement nodes from model-registry.json', () => {
      const { index } = buildIndex();
      const reqNodes = Object.keys(index.nodes).filter(k => k.startsWith('requirement::'));
      assert.ok(reqNodes.length > 0, 'should have requirement nodes');
    });

    it('should produce risk_transition nodes with hyphen-delimited composite keys', () => {
      const { index } = buildIndex();
      const rtNodes = Object.keys(index.nodes).filter(k => k.startsWith('risk_transition::'));
      assert.ok(rtNodes.length > 0, 'should have risk_transition nodes');
      for (const key of rtNodes) {
        const id = key.replace('risk_transition::', '');
        const parts = id.split('-');
        assert.ok(parts.length >= 3, `key ${key} should have at least 3 hyphen-separated parts`);
      }
    });

    it('risk_transition keys should match expected pattern', () => {
      const { index } = buildIndex();
      const rtNodes = Object.keys(index.nodes).filter(k => k.startsWith('risk_transition::'));
      const hasIdleCircuitBreak = rtNodes.some(k => k.includes('IDLE-CIRCUIT_BREAK-IDLE'));
      assert.ok(hasIdleCircuitBreak, 'should have IDLE-CIRCUIT_BREAK-IDLE transition');
    });
  });

  describe('reverse edges', () => {
    it('every forward edge should have a matching reverse edge', () => {
      const { index } = buildIndex();
      for (const [nodeKey, node] of Object.entries(index.nodes)) {
        for (const edge of node.edges) {
          const reverseRel = REVERSE_RELS[edge.rel];
          if (!reverseRel) continue;
          const targetNode = index.nodes[edge.to];
          if (!targetNode) continue;
          const hasReverse = targetNode.edges.some(
            e => e.to === nodeKey && e.rel === reverseRel
          );
          assert.ok(hasReverse, `Missing reverse: ${edge.to} --${reverseRel}--> ${nodeKey}`);
        }
      }
    });
  });

  describe('orphan detection', () => {
    it('should report orphan count', () => {
      const { orphanCount, orphans } = buildIndex();
      assert.equal(typeof orphanCount, 'number');
      assert.ok(Array.isArray(orphans));
    });
  });

  describe('proximity scoring', () => {
    it('should return 1.0 for same node', () => {
      const { index } = buildIndex();
      const anyKey = Object.keys(index.nodes)[0];
      assert.equal(proximity(index, anyKey, anyKey), 1.0);
    });

    it('should return 0 for non-existent node', () => {
      const { index } = buildIndex();
      assert.equal(proximity(index, 'fake::node', 'other::node'), 0);
    });

    it('should return positive score for directly connected nodes', () => {
      const { index } = buildIndex();
      let fromKey, toKey;
      for (const [key, node] of Object.entries(index.nodes)) {
        if (node.edges.length > 0) {
          fromKey = key;
          toKey = node.edges[0].to;
          break;
        }
      }
      if (fromKey && toKey) {
        const score = proximity(index, fromKey, toKey);
        assert.ok(score > 0, `score should be positive, got ${score}`);
      }
    });
  });

  describe('edge weights', () => {
    it('should have weights for all relationship types', () => {
      const expectedRels = [
        'owns', 'owned_by', 'contains', 'in_file', 'emits', 'emitted_by',
        'maps_to', 'mapped_from', 'declared_in', 'declares',
        'modeled_by', 'models', 'verified_by', 'verifies',
        'tested_by', 'tests', 'triggers', 'triggered_by',
        'transitions', 'transitioned_by', 'describes', 'described_by',
        'scores', 'scored_by', 'affects', 'affected_by',
      ];
      for (const rel of expectedRels) {
        assert.ok(EDGE_WEIGHTS[rel] !== undefined, `Missing weight for ${rel}`);
        assert.ok(EDGE_WEIGHTS[rel] > 0, `Weight for ${rel} should be positive`);
        assert.ok(EDGE_WEIGHTS[rel] <= 1.0, `Weight for ${rel} should be <= 1.0`);
      }
    });
  });

  describe('fail-open behavior', () => {
    it('should handle empty debt.json without crashing', () => {
      const { index } = buildIndex();
      assert.ok(index);
      assert.equal(index.schema_version, '1');
    });
  });

  describe('REVERSE_RELS mapping', () => {
    it('should be symmetric: reverse of reverse equals original', () => {
      for (const [fwd, rev] of Object.entries(REVERSE_RELS)) {
        assert.equal(REVERSE_RELS[rev], fwd, `REVERSE_RELS[${rev}] should map back to ${fwd}`);
      }
    });
  });
});
