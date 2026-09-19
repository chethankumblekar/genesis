import {
  AREAS,
  FURNISHED,
  HOUSING_TYPES,
  PARKING,
  POWER_BACKUP,
  SOURCES,
  STATUSES,
  emptyListing,
  type Listing,
} from "./types";
import { ensureSchema, getPool } from "./db";

type ListingRow = {
  id: string;
  society: string;
  address: string;
  area: string;
  rent: number | null;
  deposit: number | null;
  bhk: number;
  housing_type: string;
  parking: string;
  available_from: string;
  source: string;
  url: string;
  contact: string;
  photo_urls: unknown;
  notes: string;
  furnished: string;
  floor: string;
  power_backup: string;
  lat: number | string | null;
  lng: number | string | null;
  status: string;
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

function asNumber(value: unknown): number | null {
  if (value == null || value === "") return null;
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : null;
}

function asString(value: unknown): string {
  return typeof value === "string" ? value : value == null ? "" : String(value);
}

function asIso(value: unknown): string {
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "string" && value) {
    const d = new Date(value);
    if (!Number.isNaN(d.getTime())) return d.toISOString();
  }
  return new Date().toISOString();
}

function asPhotoUrls(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.map((item) => String(item)).filter(Boolean);
  }
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value) as unknown;
      if (Array.isArray(parsed)) {
        return parsed.map((item) => String(item)).filter(Boolean);
      }
    } catch {
      return [];
    }
  }
  return [];
}

export function normalizeListing(input: unknown): Listing {
  const raw =
    input && typeof input === "object" ? (input as Record<string, unknown>) : {};
  const base = emptyListing();
  return {
    ...base,
    id: asString(raw.id) || base.id,
    society: asString(raw.society),
    address: asString(raw.address),
    area: oneOf(raw.area, AREAS, base.area),
    rent: asNumber(raw.rent),
    deposit: asNumber(raw.deposit),
    bhk: asNumber(raw.bhk) ?? 2,
    housingType: oneOf(raw.housingType, HOUSING_TYPES, base.housingType),
    parking: oneOf(raw.parking, PARKING, base.parking),
    availableFrom: asString(raw.availableFrom),
    source: oneOf(raw.source, SOURCES, base.source),
    url: asString(raw.url),
    contact: asString(raw.contact),
    photoUrls: asPhotoUrls(raw.photoUrls),
    notes: asString(raw.notes),
    furnished: oneOf(raw.furnished, FURNISHED, base.furnished),
    floor: asString(raw.floor),
    powerBackup: oneOf(raw.powerBackup, POWER_BACKUP, base.powerBackup),
    lat: asNumber(raw.lat),
    lng: asNumber(raw.lng),
    status: oneOf(raw.status, STATUSES, base.status),
    createdAt: asString(raw.createdAt) || base.createdAt,
    updatedAt: new Date().toISOString(),
  };
}

function rowToListing(row: ListingRow): Listing {
  return {
    id: row.id,
    society: row.society ?? "",
    address: row.address ?? "",
    area: oneOf(row.area, AREAS, "HSR"),
    rent: asNumber(row.rent),
    deposit: asNumber(row.deposit),
    bhk: asNumber(row.bhk) ?? 2,
    housingType: oneOf(row.housing_type, HOUSING_TYPES, "gated_society"),
    parking: oneOf(row.parking, PARKING, "unknown"),
    availableFrom: row.available_from ?? "",
    source: oneOf(row.source, SOURCES, "other"),
    url: row.url ?? "",
    contact: row.contact ?? "",
    photoUrls: asPhotoUrls(row.photo_urls),
    notes: row.notes ?? "",
    furnished: oneOf(row.furnished, FURNISHED, "unknown"),
    floor: row.floor ?? "",
    powerBackup: oneOf(row.power_backup, POWER_BACKUP, "unknown"),
    lat: asNumber(row.lat),
    lng: asNumber(row.lng),
    status: oneOf(row.status, STATUSES, "new"),
    createdAt: asIso(row.created_at),
    updatedAt: asIso(row.updated_at),
  };
}

const UPSERT_SQL = `
INSERT INTO listings (
  id, society, address, area, rent, deposit, bhk, housing_type, parking,
  available_from, source, url, contact, photo_urls, notes, furnished, floor,
  power_backup, lat, lng, status, created_at, updated_at
) VALUES (
  $1, $2, $3, $4, $5, $6, $7, $8, $9,
  $10, $11, $12, $13, $14::jsonb, $15, $16, $17,
  $18, $19, $20, $21, $22, $23
)
ON CONFLICT (id) DO UPDATE SET
  society = EXCLUDED.society,
  address = EXCLUDED.address,
  area = EXCLUDED.area,
  rent = EXCLUDED.rent,
  deposit = EXCLUDED.deposit,
  bhk = EXCLUDED.bhk,
  housing_type = EXCLUDED.housing_type,
  parking = EXCLUDED.parking,
  available_from = EXCLUDED.available_from,
  source = EXCLUDED.source,
  url = EXCLUDED.url,
  contact = EXCLUDED.contact,
  photo_urls = EXCLUDED.photo_urls,
  notes = EXCLUDED.notes,
  furnished = EXCLUDED.furnished,
  floor = EXCLUDED.floor,
  power_backup = EXCLUDED.power_backup,
  lat = EXCLUDED.lat,
  lng = EXCLUDED.lng,
  status = EXCLUDED.status,
  updated_at = EXCLUDED.updated_at
RETURNING *;
`;

function listingParams(listing: Listing) {
  return [
    listing.id,
    listing.society,
    listing.address,
    listing.area,
    listing.rent,
    listing.deposit,
    listing.bhk,
    listing.housingType,
    listing.parking,
    listing.availableFrom,
    listing.source,
    listing.url,
    listing.contact,
    JSON.stringify(listing.photoUrls),
    listing.notes,
    listing.furnished,
    listing.floor,
    listing.powerBackup,
    listing.lat,
    listing.lng,
    listing.status,
    listing.createdAt,
    listing.updatedAt,
  ];
}

export async function listListings(): Promise<Listing[]> {
  await ensureSchema();
  const { rows } = await getPool().query<ListingRow>(
    "SELECT * FROM listings ORDER BY updated_at DESC"
  );
  return rows.map(rowToListing);
}

export async function getListing(id: string): Promise<Listing | null> {
  await ensureSchema();
  const { rows } = await getPool().query<ListingRow>(
    "SELECT * FROM listings WHERE id = $1",
    [id]
  );
  return rows[0] ? rowToListing(rows[0]) : null;
}

export async function upsertListing(input: unknown): Promise<Listing> {
  const listing = normalizeListing(input);
  await ensureSchema();
  const { rows } = await getPool().query<ListingRow>(UPSERT_SQL, listingParams(listing));
  return rowToListing(rows[0]);
}

export async function patchListing(
  id: string,
  patch: unknown
): Promise<Listing | null> {
  const current = await getListing(id);
  if (!current) return null;
  const raw = patch && typeof patch === "object" ? (patch as Record<string, unknown>) : {};
  return upsertListing({ ...current, ...raw, id });
}

export async function deleteListing(id: string): Promise<boolean> {
  await ensureSchema();
  const result = await getPool().query("DELETE FROM listings WHERE id = $1", [id]);
  return (result.rowCount ?? 0) > 0;
}

export async function replaceListings(input: unknown): Promise<Listing[]> {
  const items = Array.isArray(input) ? input.map(normalizeListing) : [];
  await ensureSchema();
  const client = await getPool().connect();
  try {
    await client.query("BEGIN");
    await client.query("DELETE FROM listings");
    const saved: Listing[] = [];
    for (const listing of items) {
      const { rows } = await client.query<ListingRow>(UPSERT_SQL, listingParams(listing));
      saved.push(rowToListing(rows[0]));
    }
    await client.query("COMMIT");
    return saved.sort(
      (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
    );
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}
