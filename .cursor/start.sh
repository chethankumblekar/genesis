#!/usr/bin/env bash
# Per-boot startup: ensure PostgreSQL is running before the dev server starts.
# Idempotent and safe to call more than once.
set -euo pipefail

# Already accepting connections? Nothing to do.
if sudo -u postgres pg_isready -q 2>/dev/null; then
  echo "PostgreSQL already running."
  exit 0
fi

# A snapshot/build taken while Postgres was running leaves a stale postmaster.pid
# that can block startup. Remove it before starting.
sudo rm -f /var/lib/postgresql/16/main/postmaster.pid

sudo pg_ctlcluster 16 main start

for _ in $(seq 1 30); do
  if sudo -u postgres pg_isready -q; then
    echo "PostgreSQL is ready."
    exit 0
  fi
  sleep 1
done

echo "PostgreSQL did not become ready in time." >&2
exit 1
