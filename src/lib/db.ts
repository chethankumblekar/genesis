import { Pool } from "pg";

const globalForPg = globalThis as unknown as { pool?: Pool; schema?: Promise<void> };

const SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS listings (
  id TEXT PRIMARY KEY,
  society TEXT NOT NULL DEFAULT '',
  address TEXT NOT NULL DEFAULT '',
  area TEXT NOT NULL,
  rent INTEGER,
  deposit INTEGER,
  bhk INTEGER NOT NULL DEFAULT 2,
  housing_type TEXT NOT NULL,
  parking TEXT NOT NULL,
  available_from TEXT NOT NULL DEFAULT '',
  source TEXT NOT NULL,
  url TEXT NOT NULL DEFAULT '',
  contact TEXT NOT NULL DEFAULT '',
  photo_urls JSONB NOT NULL DEFAULT '[]'::jsonb,
  notes TEXT NOT NULL DEFAULT '',
  furnished TEXT NOT NULL DEFAULT 'unknown',
  floor TEXT NOT NULL DEFAULT '',
  power_backup TEXT NOT NULL DEFAULT 'unknown',
  lat DOUBLE PRECISION,
  lng DOUBLE PRECISION,
  status TEXT NOT NULL DEFAULT 'new',
  created_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL
);
CREATE INDEX IF NOT EXISTS listings_updated_at_idx ON listings (updated_at DESC);
`;

export function getDatabaseUrl(): string {
  const url = process.env.DATABASE_URL?.trim();
  if (!url) {
    throw new Error("DATABASE_URL is not set");
  }
  return url;
}

export function getPool(): Pool {
  if (!globalForPg.pool) {
    globalForPg.pool = new Pool({
      connectionString: getDatabaseUrl(),
      max: 10,
    });
  }
  return globalForPg.pool;
}

export function ensureSchema(): Promise<void> {
  if (!globalForPg.schema) {
    globalForPg.schema = getPool()
      .query(SCHEMA_SQL)
      .then(() => undefined);
  }
  return globalForPg.schema;
}
