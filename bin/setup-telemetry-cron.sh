#!/usr/bin/env bash
# setup-telemetry-cron.sh
#
# Installs an hourly cron entry that runs telemetry-collector.cjs + issue-classifier.cjs.
# Safe to run multiple times — idempotent.
#
# Usage:
#   bash bin/setup-telemetry-cron.sh

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
NODE_BIN="$(command -v node)"

if [ -z "$NODE_BIN" ]; then
  echo "ERROR: node not found in PATH. Install Node.js first."
  exit 1
fi

CRON_CMD="$NODE_BIN $SCRIPT_DIR/telemetry-collector.cjs && $NODE_BIN $SCRIPT_DIR/issue-classifier.cjs"

# Idempotency check
if crontab -l 2>/dev/null | grep -q "telemetry-collector"; then
  echo "Telemetry cron already installed."
  exit 0
fi

# Install cron entry: top of every hour
(crontab -l 2>/dev/null; echo "0 * * * * $CRON_CMD >> /tmp/qgsd-telemetry.log 2>&1") | crontab -

echo "Telemetry cron installed."

# Windows: use Task Scheduler. Create a Basic Task that runs:
#   node C:\path\to\qgsd\bin\telemetry-collector.cjs
# followed by: node C:\path\to\qgsd\bin\issue-classifier.cjs
# Trigger: Daily, repeat every 1 hour indefinitely.
