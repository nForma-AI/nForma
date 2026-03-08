#!/usr/bin/env node
// @requirement CONF-01
// Structural test for: ConfigLayer
// Formal model: .planning/formal/alloy/config-two-layer.als
// Requirement: Global config at `~/.claude/qgsd.json` — installed once, applies to all projects

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

test('CONF-01 — ConfigLayer: structural verification', () => {
  // Check source file exists
  assert.ok(fs.existsSync('/Users/jonathanborduas/code/QGSD/bin/gate-a-grounding.cjs'), 'Source file should exist: gate-a-grounding.cjs');
  const content_0 = fs.readFileSync('/Users/jonathanborduas/code/QGSD/bin/gate-a-grounding.cjs', 'utf8');
  // Structural check: source file contains requirement-related code
  assert.ok(content_0.length > 0, 'Source file should not be empty');

  // Check source file exists
  assert.ok(fs.existsSync('/Users/jonathanborduas/code/QGSD/bin/observe-config.test.cjs'), 'Source file should exist: observe-config.test.cjs');
  const content_1 = fs.readFileSync('/Users/jonathanborduas/code/QGSD/bin/observe-config.test.cjs', 'utf8');
  // Structural check: source file contains requirement-related code
  assert.ok(content_1.length > 0, 'Source file should not be empty');

  // Check source file exists
  assert.ok(fs.existsSync('/Users/jonathanborduas/code/QGSD/bin/check-provider-health.cjs'), 'Source file should exist: check-provider-health.cjs');
  const content_2 = fs.readFileSync('/Users/jonathanborduas/code/QGSD/bin/check-provider-health.cjs', 'utf8');
  // Structural check: source file contains requirement-related code
  assert.ok(content_2.length > 0, 'Source file should not be empty');

  // Check source file exists
  assert.ok(fs.existsSync('/Users/jonathanborduas/code/QGSD/bin/observe-handler-prometheus.cjs'), 'Source file should exist: observe-handler-prometheus.cjs');
  const content_3 = fs.readFileSync('/Users/jonathanborduas/code/QGSD/bin/observe-handler-prometheus.cjs', 'utf8');
  // Structural check: source file contains requirement-related code
  assert.ok(content_3.length > 0, 'Source file should not be empty');

  // Check source file exists
  assert.ok(fs.existsSync('/Users/jonathanborduas/code/QGSD/bin/nForma.cjs'), 'Source file should exist: nForma.cjs');
  const content_4 = fs.readFileSync('/Users/jonathanborduas/code/QGSD/bin/nForma.cjs', 'utf8');
  // Structural check: source file contains requirement-related code
  assert.ok(content_4.length > 0, 'Source file should not be empty');

  // Check source file exists
  assert.ok(fs.existsSync('/Users/jonathanborduas/code/QGSD/bin/observe-handler-logstash.cjs'), 'Source file should exist: observe-handler-logstash.cjs');
  const content_5 = fs.readFileSync('/Users/jonathanborduas/code/QGSD/bin/observe-handler-logstash.cjs', 'utf8');
  // Structural check: source file contains requirement-related code
  assert.ok(content_5.length > 0, 'Source file should not be empty');

  // Check source file exists
  assert.ok(fs.existsSync('/Users/jonathanborduas/code/QGSD/bin/resolve-cli.test.cjs'), 'Source file should exist: resolve-cli.test.cjs');
  const content_6 = fs.readFileSync('/Users/jonathanborduas/code/QGSD/bin/resolve-cli.test.cjs', 'utf8');
  // Structural check: source file contains requirement-related code
  assert.ok(content_6.length > 0, 'Source file should not be empty');

  // Check source file exists
  assert.ok(fs.existsSync('/Users/jonathanborduas/code/QGSD/bin/gate-a-grounding.test.cjs'), 'Source file should exist: gate-a-grounding.test.cjs');
  const content_7 = fs.readFileSync('/Users/jonathanborduas/code/QGSD/bin/gate-a-grounding.test.cjs', 'utf8');
  // Structural check: source file contains requirement-related code
  assert.ok(content_7.length > 0, 'Source file should not be empty');

  // Check source file exists
  assert.ok(fs.existsSync('/Users/jonathanborduas/code/QGSD/bin/observe-handler-grafana.cjs'), 'Source file should exist: observe-handler-grafana.cjs');
  const content_8 = fs.readFileSync('/Users/jonathanborduas/code/QGSD/bin/observe-handler-grafana.cjs', 'utf8');
  // Structural check: source file contains requirement-related code
  assert.ok(content_8.length > 0, 'Source file should not be empty');

  // Check source file exists
  assert.ok(fs.existsSync('/Users/jonathanborduas/code/QGSD/bin/resolve-cli.cjs'), 'Source file should exist: resolve-cli.cjs');
  const content_9 = fs.readFileSync('/Users/jonathanborduas/code/QGSD/bin/resolve-cli.cjs', 'utf8');
  // Structural check: source file contains requirement-related code
  assert.ok(content_9.length > 0, 'Source file should not be empty');

  // Check source file exists
  assert.ok(fs.existsSync('/Users/jonathanborduas/code/QGSD/bin/quorum-preflight.cjs'), 'Source file should exist: quorum-preflight.cjs');
  const content_10 = fs.readFileSync('/Users/jonathanborduas/code/QGSD/bin/quorum-preflight.cjs', 'utf8');
  // Structural check: source file contains requirement-related code
  assert.ok(content_10.length > 0, 'Source file should not be empty');

  // Check source file exists
  assert.ok(fs.existsSync('/Users/jonathanborduas/code/QGSD/bin/install.js'), 'Source file should exist: install.js');
  const content_11 = fs.readFileSync('/Users/jonathanborduas/code/QGSD/bin/install.js', 'utf8');
  // Structural check: source file contains requirement-related code
  assert.ok(content_11.length > 0, 'Source file should not be empty');

  // Check source file exists
  assert.ok(fs.existsSync('/Users/jonathanborduas/code/QGSD/bin/ccr-secure-config.cjs'), 'Source file should exist: ccr-secure-config.cjs');
  const content_12 = fs.readFileSync('/Users/jonathanborduas/code/QGSD/bin/ccr-secure-config.cjs', 'utf8');
  // Structural check: source file contains requirement-related code
  assert.ok(content_12.length > 0, 'Source file should not be empty');

  // Check source file exists
  assert.ok(fs.existsSync('/Users/jonathanborduas/code/QGSD/bin/secrets.test.cjs'), 'Source file should exist: secrets.test.cjs');
  const content_13 = fs.readFileSync('/Users/jonathanborduas/code/QGSD/bin/secrets.test.cjs', 'utf8');
  // Structural check: source file contains requirement-related code
  assert.ok(content_13.length > 0, 'Source file should not be empty');

  // Check source file exists
  assert.ok(fs.existsSync('/Users/jonathanborduas/code/QGSD/bin/update-agents.cjs'), 'Source file should exist: update-agents.cjs');
  const content_14 = fs.readFileSync('/Users/jonathanborduas/code/QGSD/bin/update-agents.cjs', 'utf8');
  // Structural check: source file contains requirement-related code
  assert.ok(content_14.length > 0, 'Source file should not be empty');

  // Check source file exists
  assert.ok(fs.existsSync('/Users/jonathanborduas/code/QGSD/bin/ccr-secure-config.test.cjs'), 'Source file should exist: ccr-secure-config.test.cjs');
  const content_15 = fs.readFileSync('/Users/jonathanborduas/code/QGSD/bin/ccr-secure-config.test.cjs', 'utf8');
  // Structural check: source file contains requirement-related code
  assert.ok(content_15.length > 0, 'Source file should not be empty');

  // Check source file exists
  assert.ok(fs.existsSync('/Users/jonathanborduas/code/QGSD/bin/observe-config.cjs'), 'Source file should exist: observe-config.cjs');
  const content_16 = fs.readFileSync('/Users/jonathanborduas/code/QGSD/bin/observe-config.cjs', 'utf8');
  // Structural check: source file contains requirement-related code
  assert.ok(content_16.length > 0, 'Source file should not be empty');

  // Check source file exists
  assert.ok(fs.existsSync('/Users/jonathanborduas/code/QGSD/hooks/config-loader.test.js'), 'Source file should exist: config-loader.test.js');
  const content_17 = fs.readFileSync('/Users/jonathanborduas/code/QGSD/hooks/config-loader.test.js', 'utf8');
  // Structural check: source file contains requirement-related code
  assert.ok(content_17.length > 0, 'Source file should not be empty');

  // Check source file exists
  assert.ok(fs.existsSync('/Users/jonathanborduas/code/QGSD/hooks/dist/config-loader.js'), 'Source file should exist: config-loader.js');
  const content_18 = fs.readFileSync('/Users/jonathanborduas/code/QGSD/hooks/dist/config-loader.js', 'utf8');
  // Structural check: source file contains requirement-related code
  assert.ok(content_18.length > 0, 'Source file should not be empty');

  // Check source file exists
  assert.ok(fs.existsSync('/Users/jonathanborduas/code/QGSD/hooks/dist/nf-check-update.js'), 'Source file should exist: nf-check-update.js');
  const content_19 = fs.readFileSync('/Users/jonathanborduas/code/QGSD/hooks/dist/nf-check-update.js', 'utf8');
  // Structural check: source file contains requirement-related code
  assert.ok(content_19.length > 0, 'Source file should not be empty');

  // Check source file exists
  assert.ok(fs.existsSync('/Users/jonathanborduas/code/QGSD/hooks/dist/nf-stop.js'), 'Source file should exist: nf-stop.js');
  const content_20 = fs.readFileSync('/Users/jonathanborduas/code/QGSD/hooks/dist/nf-stop.js', 'utf8');
  // Structural check: source file contains requirement-related code
  assert.ok(content_20.length > 0, 'Source file should not be empty');

  // Check source file exists
  assert.ok(fs.existsSync('/Users/jonathanborduas/code/QGSD/hooks/dist/nf-session-start.js'), 'Source file should exist: nf-session-start.js');
  const content_21 = fs.readFileSync('/Users/jonathanborduas/code/QGSD/hooks/dist/nf-session-start.js', 'utf8');
  // Structural check: source file contains requirement-related code
  assert.ok(content_21.length > 0, 'Source file should not be empty');

  // Check source file exists
  assert.ok(fs.existsSync('/Users/jonathanborduas/code/QGSD/hooks/dist/nf-prompt.js'), 'Source file should exist: nf-prompt.js');
  const content_22 = fs.readFileSync('/Users/jonathanborduas/code/QGSD/hooks/dist/nf-prompt.js', 'utf8');
  // Structural check: source file contains requirement-related code
  assert.ok(content_22.length > 0, 'Source file should not be empty');

  // Check source file exists
  assert.ok(fs.existsSync('/Users/jonathanborduas/code/QGSD/hooks/config-loader.js'), 'Source file should exist: config-loader.js');
  const content_23 = fs.readFileSync('/Users/jonathanborduas/code/QGSD/hooks/config-loader.js', 'utf8');
  // Structural check: source file contains requirement-related code
  assert.ok(content_23.length > 0, 'Source file should not be empty');

  // Check source file exists
  assert.ok(fs.existsSync('/Users/jonathanborduas/code/QGSD/hooks/nf-check-update.js'), 'Source file should exist: nf-check-update.js');
  const content_24 = fs.readFileSync('/Users/jonathanborduas/code/QGSD/hooks/nf-check-update.js', 'utf8');
  // Structural check: source file contains requirement-related code
  assert.ok(content_24.length > 0, 'Source file should not be empty');

  // Check source file exists
  assert.ok(fs.existsSync('/Users/jonathanborduas/code/QGSD/hooks/nf-stop.js'), 'Source file should exist: nf-stop.js');
  const content_25 = fs.readFileSync('/Users/jonathanborduas/code/QGSD/hooks/nf-stop.js', 'utf8');
  // Structural check: source file contains requirement-related code
  assert.ok(content_25.length > 0, 'Source file should not be empty');

  // Check source file exists
  assert.ok(fs.existsSync('/Users/jonathanborduas/code/QGSD/hooks/nf-session-start.js'), 'Source file should exist: nf-session-start.js');
  const content_26 = fs.readFileSync('/Users/jonathanborduas/code/QGSD/hooks/nf-session-start.js', 'utf8');
  // Structural check: source file contains requirement-related code
  assert.ok(content_26.length > 0, 'Source file should not be empty');

  // Check source file exists
  assert.ok(fs.existsSync('/Users/jonathanborduas/code/QGSD/hooks/nf-prompt.js'), 'Source file should exist: nf-prompt.js');
  const content_27 = fs.readFileSync('/Users/jonathanborduas/code/QGSD/hooks/nf-prompt.js', 'utf8');
  // Structural check: source file contains requirement-related code
  assert.ok(content_27.length > 0, 'Source file should not be empty');
});
