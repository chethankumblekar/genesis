#!/usr/bin/env bash
# Idempotent bootstrap for the HouseHunting Cloud Agent environment.
# Prepares PostgreSQL (the app persists listings there) and installs Node deps.
set -euo pipefail

cd "$(dirname "$0")/.."

# 1. System dependency: PostgreSQL. Installed here so the base image stays generic.
if ! command -v pg_ctlcluster >/dev/null 2>&1; then
  sudo apt-get update -qq
  sudo DEBIAN_FRONTEND=noninteractive apt-get install -y postgresql postgresql-contrib
fi

# 2. Bring the cluster up briefly so we can provision the role/db (start.sh owns per-boot startup).
sudo pg_ctlcluster 16 main start 2>/dev/null || true
for _ in $(seq 1 30); do
  sudo -u postgres pg_isready -q && break
  sleep 1
done

# 3. Role + database matching docker-compose defaults (idempotent).
sudo -u postgres psql -v ON_ERROR_STOP=1 <<'SQL'
DO $$ BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'househunting') THEN
    CREATE ROLE househunting LOGIN PASSWORD 'househunting' CREATEDB;
  END IF;
END $$;
SQL
sudo -u postgres psql -tAc "SELECT 1 FROM pg_database WHERE datname = 'househunting'" | grep -q 1 \
  || sudo -u postgres createdb -O househunting househunting

# 4. Local env file for `npm run dev` (mirrors README: cp .env.example .env).
[ -f .env ] || cp .env.example .env

# 5. Node dependencies from the lockfile.
npm ci
