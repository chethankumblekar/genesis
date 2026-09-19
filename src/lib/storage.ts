import { STORAGE_KEY } from "./constants";
import type { ExportFile, Listing } from "./types";

export function loadListings(): Listing[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (Array.isArray(parsed)) return parsed as Listing[];
    if (
      parsed &&
      typeof parsed === "object" &&
      Array.isArray((parsed as ExportFile).listings)
    ) {
      return (parsed as ExportFile).listings;
    }
    return [];
  } catch {
    return [];
  }
}

export function saveListings(listings: Listing[]): void {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(listings));
}

export function toExportFile(listings: Listing[]): ExportFile {
  return {
    version: 1,
    exportedAt: new Date().toISOString(),
    listings,
  };
}

export function parseImport(text: string): Listing[] {
  const parsed = JSON.parse(text) as unknown;
  if (Array.isArray(parsed)) return parsed as Listing[];
  if (
    parsed &&
    typeof parsed === "object" &&
    Array.isArray((parsed as ExportFile).listings)
  ) {
    return (parsed as ExportFile).listings;
  }
  throw new Error("JSON must be a listing array or { version, listings }");
}

export function mergeListings(current: Listing[], incoming: Listing[]): Listing[] {
  const map = new Map(current.map((l) => [l.id, l]));
  for (const listing of incoming) {
    if (!listing?.id) continue;
    map.set(listing.id, listing);
  }
  return Array.from(map.values());
}
