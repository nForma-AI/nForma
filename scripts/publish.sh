#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT_DIR="$(dirname "$SCRIPT_DIR")"
ENV_FILE="$ROOT_DIR/.env"

if [ ! -f "$ENV_FILE" ]; then
  echo "Error: .env file not found at $ENV_FILE"
  echo "Create it with: NPM_TOKEN=npm_xxxx"
  exit 1
fi

NPM_TOKEN=$(grep -E '^NPM_TOKEN=' "$ENV_FILE" | cut -d'=' -f2- | tr -d '"' | tr -d "'")

if [ -z "$NPM_TOKEN" ]; then
  echo "Error: NPM_TOKEN not found in .env"
  exit 1
fi

echo "Publishing @nforma.ai/qgsd..."

# Write a temporary project-level .npmrc with the token
NPMRC="$ROOT_DIR/.npmrc"
trap 'rm -f "$NPMRC"' EXIT
echo "//registry.npmjs.org/:_authToken=$NPM_TOKEN" > "$NPMRC"

npm publish --access public "$@"
