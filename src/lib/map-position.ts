import { AREA_CENTERS } from "./constants";
import type { Listing } from "./types";

export type MapPosition = {
  lat: number;
  lng: number;
  /** True when this is the listing's own position, false when it is a stand-in. */
  exact: boolean;
};

/**
 * Spread listings that share an area centre around it, instead of stacking them
 * all on one pixel. Derived from the id so a listing keeps the same spot across
 * reloads rather than jumping about.
 */
function ring(id: string, index: number): { dLat: number; dLng: number } {
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = (hash * 31 + id.charCodeAt(i)) | 0;
  }
  const angle = ((Math.abs(hash) % 360) * Math.PI) / 180;
  // Widen the ring as more listings pile onto the same centre. ~150m a step.
  const radius = 0.004 + (index % 4) * 0.0022;
  return { dLat: Math.sin(angle) * radius, dLng: Math.cos(angle) * radius };
}

/**
 * Where to draw a listing. Search-result cards carry no coordinates -- only a
 * listing's own page does -- so most of the board would otherwise never appear
 * on the map at all. Those fall back to a spot near their area's centre, marked
 * inexact so the map never implies a precision it does not have.
 */
export function mapPosition(listing: Listing, index = 0): MapPosition | null {
  if (listing.lat != null && listing.lng != null) {
    return { lat: listing.lat, lng: listing.lng, exact: true };
  }

  const centre = AREA_CENTERS[listing.area];
  if (!centre) return null;

  const { dLat, dLng } = ring(listing.id, index);
  return { lat: centre.lat + dLat, lng: centre.lng + dLng, exact: false };
}

/** Positions for a whole board, keeping the per-area spread stable. */
export function mapPositions(listings: Listing[]): Map<string, MapPosition> {
  const perArea = new Map<string, number>();
  const out = new Map<string, MapPosition>();

  for (const listing of listings) {
    const seen = listing.lat != null ? 0 : (perArea.get(listing.area) ?? 0);
    if (listing.lat == null) perArea.set(listing.area, seen + 1);
    const pos = mapPosition(listing, seen);
    if (pos) out.set(listing.id, pos);
  }
  return out;
}
