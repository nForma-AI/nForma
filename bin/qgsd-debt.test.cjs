/**
 * Integration test for complete debt lifecycle
 * Tests schema + validation + state machine + fingerprinting + ledger + retention
 */

const { describe, it } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const crypto = require('node:crypto');

// Import all modules
const { validateDebtEntry } = require('./validate-debt-entry.cjs');
const { canTransition, transitionDebtEntry } = require('./debt-state-machine.cjs');
const { fingerprintIssue } = require('./fingerprint-issue.cjs');
const { fingerprintDrift } = require('./fingerprint-drift.cjs');
const { readDebtLedger, writeDebtLedger } = require('./debt-ledger.cjs');
const { applyRetentionPolicy, writeArchive } = require('./debt-retention.cjs');

describe('Complete Debt Lifecycle Integration', () => {
  let tempDir;

  const setup = () => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'debt-lifecycle-test-'));
  };

  const teardown = () => {
    if (tempDir && fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true });
    }
  };

  describe('Issue Fingerprinting Lifecycle', () => {
    it('complete issue lifecycle: create -> validate -> write -> read -> transition -> archive', () => {
      setup();
      try {
        // 1. Create a new debt entry using fingerprintIssue
        const issue = {
          exception_type: 'TypeError',
          function_name: 'processData',
          message: 'Cannot read property "value" of undefined'
        };

        const fingerprint = fingerprintIssue(issue);
        assert(fingerprint);
        assert.strictEqual(fingerprint.length, 16);
        assert(/^[a-z0-9]+$/.test(fingerprint));

        // 2. Create debt entry object
        const entryId = crypto.randomUUID();
        const now = new Date().toISOString();
        const debtEntry = {
          id: entryId,
          fingerprint: fingerprint,
          title: 'TypeError in processData',
          occurrences: 1,
          first_seen: now,
          last_seen: now,
          environments: ['production'],
          status: 'open',
          resolved_at: null,
          formal_ref: null,
          source_entries: [
            {
              source_type: 'sentry',
              source_id: 'sentry-12345',
              observed_at: now
            }
          ]
        };

        // 3. Validate the entry
        const validation = validateDebtEntry(debtEntry);
        assert.strictEqual(validation, true, 'Entry should validate successfully');

        // 4. Create ledger and write to file
        const ledgerPath = path.join(tempDir, 'debt.json');
        const ledger = {
          schema_version: '1',
          created_at: now,
          last_updated: now,
          debt_entries: [debtEntry]
        };

        writeDebtLedger(ledgerPath, ledger);
        assert(fs.existsSync(ledgerPath));

        // 5. Read back using readDebtLedger
        const readLedger = readDebtLedger(ledgerPath);
        assert.strictEqual(readLedger.debt_entries.length, 1);
        assert.strictEqual(readLedger.debt_entries[0].id, entryId);
        assert.strictEqual(readLedger.debt_entries[0].fingerprint, fingerprint);

        // 6. Transition status: open -> acknowledged
        let result = transitionDebtEntry(readLedger.debt_entries[0], 'acknowledged');
        assert.strictEqual(result.success, true);
        assert.strictEqual(result.entry.status, 'acknowledged');

        // 7. Transition status: acknowledged -> resolving
        result = transitionDebtEntry(result.entry, 'resolving');
        assert.strictEqual(result.success, true);
        assert.strictEqual(result.entry.status, 'resolving');

        // 8. Transition status: resolving -> resolved
        result = transitionDebtEntry(result.entry, 'resolved');
        assert.strictEqual(result.success, true);
        assert.strictEqual(result.entry.status, 'resolved');
        assert(result.entry.resolved_at);

        // 9. Attempt invalid transition: resolved -> open
        result = transitionDebtEntry(result.entry, 'open');
        assert.strictEqual(result.success, false);
        assert(result.error);
        assert.match(result.error, /not allowed/i);

        // 10. Set resolved_at to 120 days ago, apply retention policy with 90-day max_age
        const resolvedEntry = result.entry ? result.entry : readLedger.debt_entries[0];
        resolvedEntry.status = 'resolved';
        resolvedEntry.resolved_at = new Date(Date.now() - 120 * 24 * 60 * 60 * 1000).toISOString();

        const updateledger = {
          schema_version: '1',
          created_at: now,
          last_updated: now,
          debt_entries: [resolvedEntry]
        };

        const retentionResult = applyRetentionPolicy(updateledger, 90);
        assert.strictEqual(retentionResult.active.length, 0, 'Old resolved entry should be archived');
        assert.strictEqual(retentionResult.archived.length, 1, 'Old resolved entry should be in archive');

        // 11. Write archive using writeArchive
        const archivePath = path.join(tempDir, 'debt-archive.jsonl');
        writeArchive(retentionResult.archived, archivePath);
        assert(fs.existsSync(archivePath));

        // 12. Verify active ledger no longer contains the archived entry
        const archivedLedger = {
          schema_version: '1',
          created_at: now,
          last_updated: now,
          debt_entries: retentionResult.active
        };
        assert.strictEqual(archivedLedger.debt_entries.length, 0);

        // 13. Verify archive content
        const archiveContent = fs.readFileSync(archivePath, 'utf8');
        const archivedLines = archiveContent.trim().split('\n');
        assert.strictEqual(archivedLines.length, 1);
        const archivedEntry = JSON.parse(archivedLines[0]);
        assert.strictEqual(archivedEntry.fingerprint, fingerprint);
      } finally {
        teardown();
      }
    });
  });

  describe('Drift Fingerprinting Lifecycle', () => {
    it('drift lifecycle: create -> validate -> transition -> archive', () => {
      setup();
      try {
        // 1. Create drift entry using fingerprintDrift
        const drift = {
          formal_parameter_key: 'config.yaml:max_workers'
        };

        const fingerprint = fingerprintDrift(drift);
        assert(fingerprint);
        assert.strictEqual(fingerprint.length, 16);

        // 2. Create debt entry for drift
        const entryId = crypto.randomUUID();
        const now = new Date().toISOString();
        const debtEntry = {
          id: entryId,
          fingerprint: fingerprint,
          title: 'Drift detected in config.yaml:max_workers',
          occurrences: 1,
          first_seen: now,
          last_seen: now,
          environments: ['staging'],
          status: 'open',
          resolved_at: null,
          formal_ref: 'PERF-42',
          source_entries: [
            {
              source_type: 'prometheus',
              source_id: 'prometheus-drift-1',
              observed_at: now
            }
          ]
        };

        // 3. Validate entry
        const validation = validateDebtEntry(debtEntry);
        assert.strictEqual(validation, true);

        // 4. Transition through full lifecycle
        const ledgerPath = path.join(tempDir, 'drift-debt.json');
        const ledger = {
          schema_version: '1',
          created_at: now,
          last_updated: now,
          debt_entries: [debtEntry]
        };

        writeDebtLedger(ledgerPath, ledger);
        const readLedger = readDebtLedger(ledgerPath);

        let current = readLedger.debt_entries[0];
        const transitions = [
          { from: 'open', to: 'acknowledged' },
          { from: 'acknowledged', to: 'resolving' },
          { from: 'resolving', to: 'resolved' }
        ];

        for (const trans of transitions) {
          const result = transitionDebtEntry(current, trans.to);
          assert.strictEqual(result.success, true);
          assert.strictEqual(result.entry.status, trans.to);
          current = result.entry;
        }

        // 5. Verify fingerprint stability
        const newDrift = {
          formal_parameter_key: 'config.yaml:max_workers'
        };
        const newFingerprint = fingerprintDrift(newDrift);
        assert.strictEqual(newFingerprint, fingerprint, 'Same key should produce same fingerprint');
      } finally {
        teardown();
      }
    });

    it('fingerprint stability test: same key produces same fingerprint across multiple runs', () => {
      // Test determinism of fingerprintDrift
      const key = 'formal:parameter:key:v1';
      const fp1 = fingerprintDrift({ formal_parameter_key: key });
      const fp2 = fingerprintDrift({ formal_parameter_key: key });
      const fp3 = fingerprintDrift({ formal_parameter_key: key });

      assert.strictEqual(fp1, fp2);
      assert.strictEqual(fp2, fp3);
    });

    it('different drift keys produce different fingerprints', () => {
      const fp1 = fingerprintDrift({ formal_parameter_key: 'key1' });
      const fp2 = fingerprintDrift({ formal_parameter_key: 'key2' });

      assert.notStrictEqual(fp1, fp2);
    });
  });

  describe('Multi-Entry Ledger Lifecycle', () => {
    it('ledger with mixed statuses applies retention policy correctly', () => {
      setup();
      try {
        const now = new Date().toISOString();
        const oldTime = new Date(Date.now() - 120 * 24 * 60 * 60 * 1000).toISOString();

        const ledger = {
          schema_version: '1',
          created_at: now,
          last_updated: now,
          debt_entries: [
            {
              id: crypto.randomUUID(),
              fingerprint: fingerprintIssue({ exception_type: 'Error', function_name: 'f1', message: 'msg1' }),
              title: 'Open entry',
              occurrences: 1,
              first_seen: oldTime,
              last_seen: oldTime,
              environments: ['production'],
              status: 'open',
              resolved_at: null,
              formal_ref: null,
              source_entries: [{ source_type: 'github', source_id: '1', observed_at: oldTime }]
            },
            {
              id: crypto.randomUUID(),
              fingerprint: fingerprintIssue({ exception_type: 'Error', function_name: 'f2', message: 'msg2' }),
              title: 'Resolved old entry',
              occurrences: 1,
              first_seen: oldTime,
              last_seen: oldTime,
              environments: ['production'],
              status: 'resolved',
              resolved_at: oldTime,
              formal_ref: null,
              source_entries: [{ source_type: 'github', source_id: '2', observed_at: oldTime }]
            },
            {
              id: crypto.randomUUID(),
              fingerprint: fingerprintIssue({ exception_type: 'Error', function_name: 'f3', message: 'msg3' }),
              title: 'Recently resolved entry',
              occurrences: 1,
              first_seen: now,
              last_seen: now,
              environments: ['production'],
              status: 'resolved',
              resolved_at: now,
              formal_ref: null,
              source_entries: [{ source_type: 'github', source_id: '3', observed_at: now }]
            }
          ]
        };

        const result = applyRetentionPolicy(ledger, 90);

        // Open entry should stay active (never archived regardless of age)
        const openEntry = result.active.find(e => e.status === 'open');
        assert(openEntry);

        // Recently resolved should stay active (within 90 days)
        const recentEntry = result.active.find(e => e.title === 'Recently resolved entry');
        assert(recentEntry);

        // Old resolved should be archived
        const archivedEntry = result.archived.find(e => e.title === 'Resolved old entry');
        assert(archivedEntry);
      } finally {
        teardown();
      }
    });
  });

  describe('Error Handling in Integration', () => {
    it('invalid drift (missing formal_parameter_key) fails validation', () => {
      assert.throws(
        () => fingerprintDrift({ formal_parameter_key: '' }),
        /formal_parameter_key required/
      );
    });

    it('invalid status transition is caught before writing', () => {
      const entry = {
        id: crypto.randomUUID(),
        fingerprint: '0123456789abcdef',
        title: 'Test',
        occurrences: 1,
        first_seen: new Date().toISOString(),
        last_seen: new Date().toISOString(),
        environments: ['production'],
        status: 'resolved',
        resolved_at: new Date().toISOString(),
        formal_ref: null,
        source_entries: [
          { source_type: 'github', source_id: '1', observed_at: new Date().toISOString() }
        ]
      };

      const result = transitionDebtEntry(entry, 'open');
      assert.strictEqual(result.success, false);
      assert(result.error);
    });

    it('corrupt ledger file gracefully returns empty ledger', () => {
      setup();
      try {
        const badPath = path.join(tempDir, 'bad.json');
        fs.writeFileSync(badPath, '{invalid json');

        const ledger = readDebtLedger(badPath);
        assert.strictEqual(ledger.debt_entries.length, 0);
        assert.strictEqual(ledger.schema_version, '1');
      } finally {
        teardown();
      }
    });
  });
});
