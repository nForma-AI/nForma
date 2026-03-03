'use strict';

/**
 * auth-drivers/pool.cjs — file-copy credential pool driver
 *
 * For providers that store OAuth credentials as a JSON file that can be
 * copied between a pool directory and an active location.
 * Backed by account-manager.cjs (TLA+-formalized FSM).
 *
 * Applies to: gemini-1, gemini-2, codex-1, codex-2
 *
 * Required providers.json fields:
 *   oauth_rotation.creds_dir    — pool directory (~/.gemini/accounts)
 *   oauth_rotation.active_file  — live credential file (~/.gemini/oauth_creds.json)
 *   auth.login                  — add command (e.g. ["gemini", "auth", "login"])
 */

const acm = require('../account-manager.cjs');

/**
 * list(provider) → [{ name, active }]
 * Reads the pool directory and the .qgsd-active pointer — no subprocess.
 */
function list(provider) {
  const credsDir = acm.getCredsDir(provider);
  const pool     = acm.listPool(credsDir);
  const active   = acm.readActivePtr(credsDir);
  return pool.map(name => ({ name, active: name === active }));
}

/**
 * switch(provider, name) — copies pool entry to active_file, updates pointer.
 * Driven by the FSM; throws on invalid transition or I/O error.
 */
function switchAccount(provider, name) {
  const fsm = new acm.AccountManagerFSM();
  acm.cmdSwitch(fsm, provider, name);
}

/**
 * addCredentialFile(provider) → string
 * Returns the active_file path — promptLoginExternal polls its mtime to
 * auto-detect when sign-in completes.
 */
function addCredentialFile(provider) {
  return acm.getActiveFile(provider);
}

/**
 * extractAccountName(provider) → string | null
 * For Gemini: decodes the id_token JWT to get the Google email (no network).
 * For Codex (no id_token): returns null → TUI prompts for a name.
 */
function extractAccountName(provider) {
  return acm.extractEmailFromCreds(acm.getActiveFile(provider));
}

/**
 * add(provider, name) — captures current active_file into pool under `name`.
 * Called after promptLoginExternal resolves (credential file already written by CLI).
 */
async function add(provider, name) {
  const fsm = new acm.AccountManagerFSM();
  await acm.cmdAdd(fsm, provider, name, false);
}

module.exports = { list, switch: switchAccount, addCredentialFile, extractAccountName, add };
