#!/usr/bin/env bash
# Per-boot startup: ensure PostgreSQL is running before the dev server starts.
set -euo pipefail

# pg_ctlcluster exits non-zero if already running; that is fine.
sudo pg_ctlcluster 16 main start 2>/dev/null || true

for _ in $(seq 1 30); do
  if sudo -u postgres pg_isready -q; then
    echo "PostgreSQL is ready."
    exit 0
  fi
  sleep 1
done

echo "PostgreSQL did not become ready in time." >&2
exit 1
