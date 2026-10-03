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
  visit_booked TEXT NOT NULL DEFAULT '',
  visited BOOLEAN NOT NULL DEFAULT false,
  visit_checks JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL
);
ALTER TABLE listings ADD COLUMN IF NOT EXISTS visited BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE listings ADD COLUMN IF NOT EXISTS visit_checks JSONB NOT NULL DEFAULT '[]'::jsonb;
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'listings' AND column_name = 'visit_booked'
  ) THEN
    ALTER TABLE listings ADD COLUMN visit_booked TEXT NOT NULL DEFAULT '';
  ELSIF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'listings'
      AND column_name = 'visit_booked' AND data_type = 'boolean'
  ) THEN
    UPDATE listings SET status = 'contacted', visit_booked = true WHERE status = 'visit_booked';
    UPDATE listings SET status = 'contacted', visit_booked = true, visited = true WHERE status = 'visited';
    ALTER TABLE listings ALTER COLUMN visit_booked DROP DEFAULT;
    ALTER TABLE listings
      ALTER COLUMN visit_booked TYPE TEXT
      USING CASE WHEN visit_booked THEN to_char(CURRENT_DATE, 'YYYY-MM-DD') ELSE '' END;
    ALTER TABLE listings ALTER COLUMN visit_booked SET DEFAULT '';
    ALTER TABLE listings ALTER COLUMN visit_booked SET NOT NULL;
  END IF;
END $$;
CREATE INDEX IF NOT EXISTS listings_updated_at_idx ON listings (updated_at DESC);

CREATE TABLE IF NOT EXISTS scraped_listings (
  id TEXT PRIMARY KEY,
  source TEXT NOT NULL,
  external_id TEXT NOT NULL,
  url TEXT NOT NULL DEFAULT '',
  raw JSONB NOT NULL DEFAULT '{}'::jsonb,
  draft JSONB NOT NULL DEFAULT '{}'::jsonb,
  confidence TEXT NOT NULL DEFAULT 'medium',
  reasons JSONB NOT NULL DEFAULT '[]'::jsonb,
  filled JSONB NOT NULL DEFAULT '[]'::jsonb,
  missing JSONB NOT NULL DEFAULT '[]'::jsonb,
  status TEXT NOT NULL DEFAULT 'pending',
  listing_id TEXT,
  captured_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL,
  UNIQUE (source, external_id)
);
CREATE INDEX IF NOT EXISTS scraped_listings_status_idx
  ON scraped_listings (status, captured_at DESC);
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
      connectionTimeoutMillis: 5000,
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
