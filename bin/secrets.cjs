'use strict';
const SERVICE = 'qgsd';

// Lazy-load keytar with a graceful error if the native addon is missing
function getKeytar() {
  try {
    return require('keytar');
  } catch (e) {
    throw new Error(
      'keytar native addon not found. Run `npm install keytar` (requires libsecret-dev on Linux).\n' +
      'Original error: ' + e.message
    );
  }
}

async function set(service, key, value) {
  await getKeytar().setPassword(service, key, value);
}

async function get(service, key) {
  return getKeytar().getPassword(service, key);
}

async function del(service, key) {
  return getKeytar().deletePassword(service, key);
}

async function list(service) {
  return getKeytar().findCredentials(service);
  // returns [{account, password}]
}

/**
 * Reads all secrets stored under `service` from the keychain,
 * then patches matching env keys in every mcpServers entry in ~/.claude.json.
 *
 * Algorithm:
 *   1. Load all credentials for the service (account = env var name, password = value)
 *   2. Read ~/.claude.json (parse JSON; if missing/corrupt, log warning and return)
 *   3. Iterate claudeJson.mcpServers — for each server with an `env` block,
 *      for each credential whose account name appears as a key in `env`,
 *      overwrite `env[account]` with the credential's password.
 *   4. Write the patched JSON back to ~/.claude.json with 2-space indent.
 */
async function syncToClaudeJson(service) {
  const os = require('os');
  const fs = require('fs');
  const path = require('path');

  const claudeJsonPath = path.join(os.homedir(), '.claude.json');

  let credentials;
  try {
    credentials = await list(service);
  } catch (e) {
    process.stderr.write('[qgsd-secrets] keytar unavailable: ' + e.message + '\n');
    return;
  }

  if (!credentials || credentials.length === 0) return;

  // Build a lookup map: { ACCOUNT_NAME: password }
  const credMap = {};
  for (const c of credentials) {
    credMap[c.account] = c.password;
  }

  let raw;
  try {
    raw = fs.readFileSync(claudeJsonPath, 'utf8');
  } catch (e) {
    process.stderr.write('[qgsd-secrets] ~/.claude.json not found, skipping sync\n');
    return;
  }

  let claudeJson;
  try {
    claudeJson = JSON.parse(raw);
  } catch (e) {
    process.stderr.write('[qgsd-secrets] ~/.claude.json is invalid JSON, skipping sync\n');
    return;
  }

  if (!claudeJson.mcpServers || typeof claudeJson.mcpServers !== 'object') return;

  let patched = 0;
  for (const serverName of Object.keys(claudeJson.mcpServers)) {
    const server = claudeJson.mcpServers[serverName];
    if (!server.env || typeof server.env !== 'object') continue;
    for (const envKey of Object.keys(server.env)) {
      if (credMap[envKey] !== undefined) {
        server.env[envKey] = credMap[envKey];
        patched++;
      }
    }
  }

  if (patched > 0) {
    fs.writeFileSync(claudeJsonPath, JSON.stringify(claudeJson, null, 2));
  }
}

module.exports = { set, get, delete: del, list, syncToClaudeJson, SERVICE };
