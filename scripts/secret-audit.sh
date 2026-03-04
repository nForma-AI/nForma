#!/usr/bin/env bash
# secret-audit.sh — Full-history secret audit using gitleaks and trufflehog
# Usage: bash scripts/secret-audit.sh
# Runs locally; install gitleaks and trufflehog first.

set -euo pipefail

echo "=== QGSD Full-History Secret Audit ==="
echo ""

# --- Gitleaks full-history scan ---
echo "[1/2] Running gitleaks full-history scan..."
if command -v gitleaks &>/dev/null; then
  gitleaks detect \
    --source . \
    --config .gitleaks.toml \
    --redact \
    --verbose \
    --report-format json \
    --report-path .gitleaks-report.json \
    || echo "  -> gitleaks found potential secrets (see .gitleaks-report.json)"
  echo "  -> gitleaks report: .gitleaks-report.json"
else
  echo "  -> SKIPPED: gitleaks not installed (brew install gitleaks)"
fi

echo ""

# --- TruffleHog full-history scan ---
echo "[2/2] Running trufflehog full-history scan..."
if command -v trufflehog &>/dev/null; then
  trufflehog git \
    file://. \
    --only-verified \
    --json \
    > .trufflehog-report.json 2>&1 \
    || echo "  -> trufflehog found potential secrets (see .trufflehog-report.json)"
  echo "  -> trufflehog report: .trufflehog-report.json"
else
  echo "  -> SKIPPED: trufflehog not installed (brew install trufflehog)"
fi

echo ""
echo "=== Audit complete ==="
echo "Report files (.gitleaks-report.json, .trufflehog-report.json) are gitignored."
