import { ensureSchema, getPool } from "../db";
import { upsertListing } from "../listings-repo";
import type { Listing } from "../types";
import { normalizeCapture } from "./normalize";
import {
  CONFIDENCES,
  SCRAPE_STATUSES,
  type Confidence,
  type RawCapture,
  type ScrapeSource,
  type ScrapeStatus,
  type ScrapedListing,
} from "./types";

type ScrapedRow = {
  id: string;
  source: string;
  external_id: string;
  url: string;
  raw: unknown;
  draft: unknown;
  confidence: string;
  reasons: unknown;
  filled: unknown;
  missing: unknown;
  status: string;
  listing_id: string | null;
  captured_at: Date | string;
  created_at: Date | string;
  updated_at: Date | string;
};

function oneOf<T extends readonly string[]>(
  value: unknown,
  allowed: T,
  fallback: T[number]
): T[number] {
  return typeof value === "string" && (allowed as readonly string[]).includes(value)
    ? (value as T[number])
    : fallback;
}

function asJsonArray(value: unknown): string[] {
  if (Array.isArray(value)) return value.map(String);
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value) as unknown;
      return Array.isArray(parsed) ? parsed.map(String) : [];
    } catch {
      return [];
    }
  }
  return [];
}

function asObject(value: unknown): Record<string, unknown> {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value) as unknown;
      if (parsed && typeof parsed === "object") {
        return parsed as Record<string, unknown>;
      }
    } catch {
      return {};
    }
  }
  return {};
}

function asIso(value: unknown): string {
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "string" && value) {
    const d = new Date(value);
    if (!Number.isNaN(d.getTime())) return d.toISOString();
  }
  return new Date().toISOString();
}

function rowToScraped(row: ScrapedRow): ScrapedListing {
  return {
    id: row.id,
    source: oneOf(row.source, ["nobroker", "facebook"] as const, "nobroker"),
    externalId: row.external_id,
    url: row.url ?? "",
    raw: asObject(row.raw) as unknown as RawCapture,
    draft: asObject(row.draft),
    confidence: oneOf(row.confidence, CONFIDENCES, "medium") as Confidence,
    reasons: asJsonArray(row.reasons),
    filled: asJsonArray(row.filled),
    missing: asJsonArray(row.missing),
    status: oneOf(row.status, SCRAPE_STATUSES, "pending") as ScrapeStatus,
    capturedAt: asIso(row.captured_at),
    createdAt: asIso(row.created_at),
    updatedAt: asIso(row.updated_at),
  };
}

export type IngestOutcome = "added" | "updated" | "skipped";

export type IngestResult = {
  externalId: string;
  outcome: IngestOutcome;
  confidence?: Confidence;
};

/**
 * Re-harvesting a page you have already triaged must be a no-op: rows the user
 * imported or rejected are left untouched, so rejected junk never resurfaces.
 */
const INGEST_SQL = `
INSERT INTO scraped_listings (
  id, source, external_id, url, raw, draft, confidence, reasons, filled,
  missing, status, captured_at, created_at, updated_at
) VALUES (
  $1, $2, $3, $4, $5::jsonb, $6::jsonb, $7, $8::jsonb, $9::jsonb,
  $10::jsonb, 'pending', $11, $12, $12
)
ON CONFLICT (source, external_id) DO UPDATE SET
  url = EXCLUDED.url,
  raw = EXCLUDED.raw,
  draft = EXCLUDED.draft,
  confidence = EXCLUDED.confidence,
  reasons = EXCLUDED.reasons,
  filled = EXCLUDED.filled,
  missing = EXCLUDED.missing,
  captured_at = EXCLUDED.captured_at,
  updated_at = EXCLUDED.updated_at
WHERE scraped_listings.status = 'pending'
RETURNING (xmax = 0) AS inserted;
`;

export async function ingestCaptures(
  source: ScrapeSource,
  captures: RawCapture[]
): Promise<IngestResult[]> {
  await ensureSchema();
  const pool = getPool();
  const results: IngestResult[] = [];

  for (const capture of captures) {
    if (!capture?.externalId) continue;
    const normalized = normalizeCapture(source, capture);
    const now = new Date().toISOString();
    const { rows } = await pool.query<{ inserted: boolean }>(INGEST_SQL, [
      crypto.randomUUID(),
      source,
      normalized.externalId,
      normalized.url,
      JSON.stringify(capture),
      JSON.stringify(normalized.draft),
      normalized.confidence,
      JSON.stringify(normalized.reasons),
      JSON.stringify(normalized.filled),
      JSON.stringify(normalized.missing),
      normalized.capturedAt || now,
      now,
    ]);

    // No row back means the ON CONFLICT WHERE filtered it: already triaged.
    if (!rows[0]) {
      results.push({ externalId: normalized.externalId, outcome: "skipped" });
      continue;
    }
    results.push({
      externalId: normalized.externalId,
      outcome: rows[0].inserted ? "added" : "updated",
      confidence: normalized.confidence,
    });
  }

  return results;
}

export async function listPending(): Promise<ScrapedListing[]> {
  await ensureSchema();
  const { rows } = await getPool().query<ScrapedRow>(
    `SELECT * FROM scraped_listings WHERE status = 'pending'
     ORDER BY captured_at DESC, created_at DESC`
  );
  return rows.map(rowToScraped);
}

export async function getScraped(id: string): Promise<ScrapedListing | null> {
  await ensureSchema();
  const { rows } = await getPool().query<ScrapedRow>(
    "SELECT * FROM scraped_listings WHERE id = $1",
    [id]
  );
  return rows[0] ? rowToScraped(rows[0]) : null;
}

export async function rejectScraped(id: string): Promise<ScrapedListing | null> {
  await ensureSchema();
  const { rows } = await getPool().query<ScrapedRow>(
    `UPDATE scraped_listings SET status = 'rejected', updated_at = $2
     WHERE id = $1 RETURNING *`,
    [id, new Date().toISOString()]
  );
  return rows[0] ? rowToScraped(rows[0]) : null;
}

/**
 * Promote into the real board. `edits` carries whatever the user changed in the
 * review tray before importing.
 */
export async function promoteScraped(
  id: string,
  edits: Record<string, unknown> = {}
): Promise<Listing | null> {
  const scraped = await getScraped(id);
  if (!scraped) return null;

  const listing = await upsertListing({
    ...scraped.draft,
    ...edits,
    status: "new",
  });

  await getPool().query(
    `UPDATE scraped_listings SET status = 'imported', listing_id = $2, updated_at = $3
     WHERE id = $1`,
    [id, listing.id, new Date().toISOString()]
  );

  return listing;
}
