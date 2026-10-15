import { distanceMeters, type MapPosition } from "./map-position";
import { withDefaultVisitChecks, type Listing, type VisitCheck } from "./types";

const VISIT_RADIUS_M = 2000;
const MAX_ROUTE_STOPS = 11;

export function checkScore(checks: VisitCheck[]): {
  ticked: number;
  total: number;
  secondaryTicked: number;
  secondaryTotal: number;
} {
  const shown = withDefaultVisitChecks(checks);
  const primary = shown.filter((check) => check.phase === "primary");
  const secondary = shown.filter((check) => check.phase === "secondary");
  return {
    ticked: primary.filter((check) => check.checked).length,
    total: primary.length,
    secondaryTicked: secondary.filter((check) => check.checked).length,
    secondaryTotal: secondary.length,
  };
}

/** Negative when `a` should appear before `b`. */
export function compareByRank(a: Listing, b: Listing): number {
  const scoreA = checkScore(a.visitChecks);
  const scoreB = checkScore(b.visitChecks);
  if (scoreA.ticked !== scoreB.ticked) return scoreB.ticked - scoreA.ticked;
  const untickedA = scoreA.total - scoreA.ticked;
  const untickedB = scoreB.total - scoreB.ticked;
  if (untickedA !== untickedB) return untickedA - untickedB;
  if (scoreA.secondaryTicked !== scoreB.secondaryTicked) {
    return scoreB.secondaryTicked - scoreA.secondaryTicked;
  }
  const secondaryUntickedA = scoreA.secondaryTotal - scoreA.secondaryTicked;
  const secondaryUntickedB = scoreB.secondaryTotal - scoreB.secondaryTicked;
  if (secondaryUntickedA !== secondaryUntickedB) return secondaryUntickedA - secondaryUntickedB;
  const rentA = a.rent ?? Number.POSITIVE_INFINITY;
  const rentB = b.rent ?? Number.POSITIVE_INFINITY;
  if (rentA !== rentB) return rentA - rentB;
  return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
}

export function rankListings(listings: Listing[]): Listing[] {
  return [...listings].sort(compareByRank);
}

export function formatSpan(meters: number): string {
  if (meters < 1000) return `${Math.round(meters)} m`;
  return `${(meters / 1000).toFixed(1)} km`;
}

export type VisitRoute = {
  url: string;
  omitted: number;
};

export type VisitGroup = {
  id: string;
  listings: Listing[];
  spanM: number;
  approximate: boolean;
  route: VisitRoute | null;
};

function pairDistance(
  a: Listing,
  b: Listing,
  positions: Map<string, MapPosition>
): number | null {
  const left = positions.get(a.id);
  const right = positions.get(b.id);
  if (!left || !right) return null;
  return distanceMeters(left.lat, left.lng, right.lat, right.lng);
}

function orderVisit(
  members: Listing[],
  positions: Map<string, MapPosition>
): Listing[] {
  const remaining = [...members].sort(compareByRank);
  const ordered: Listing[] = [];
  const first = remaining.shift();
  if (!first) return ordered;
  ordered.push(first);
  while (remaining.length) {
    const last = ordered[ordered.length - 1];
    remaining.sort((a, b) => {
      const da = pairDistance(last, a, positions) ?? Number.POSITIVE_INFINITY;
      const db = pairDistance(last, b, positions) ?? Number.POSITIVE_INFINITY;
      if (da !== db) return da - db;
      return compareByRank(a, b);
    });
    const next = remaining.shift();
    if (!next) break;
    ordered.push(next);
  }
  return ordered;
}

function spanOf(listings: Listing[], positions: Map<string, MapPosition>): number {
  let max = 0;
  for (let i = 0; i < listings.length; i++) {
    for (let j = i + 1; j < listings.length; j++) {
      const distance = pairDistance(listings[i], listings[j], positions);
      if (distance != null && distance > max) max = distance;
    }
  }
  return max;
}

function routeFor(
  listings: Listing[],
  positions: Map<string, MapPosition>
): VisitRoute | null {
  const exact = listings.filter((listing) => positions.get(listing.id)?.exact);
  if (exact.length < 2) return null;
  const stops = exact.slice(0, MAX_ROUTE_STOPS);
  const origin = positions.get(stops[0].id);
  const destination = positions.get(stops[stops.length - 1].id);
  if (!origin || !destination) return null;
  const waypoints = stops.slice(1, -1).map((listing) => {
    const pos = positions.get(listing.id);
    return pos ? `${pos.lat},${pos.lng}` : "";
  });
  const params = new URLSearchParams({
    api: "1",
    origin: `${origin.lat},${origin.lng}`,
    destination: `${destination.lat},${destination.lng}`,
    travelmode: "driving",
  });
  if (waypoints.length) params.set("waypoints", waypoints.join("|"));
  return {
    url: `https://www.google.com/maps/dir/?${params.toString()}`,
    omitted: exact.length - stops.length,
  };
}

export function groupVisits(
  listings: Listing[],
  positions: Map<string, MapPosition>
): VisitGroup[] {
  const remaining = rankListings(listings);
  const groups: VisitGroup[] = [];

  while (remaining.length) {
    const seed = remaining.shift();
    if (!seed) break;
    const members = [seed];
    let grew = true;
    while (grew) {
      grew = false;
      for (let i = 0; i < remaining.length; ) {
        const candidate = remaining[i];
        const close = members.some((member) => {
          const distance = pairDistance(member, candidate, positions);
          return distance != null && distance <= VISIT_RADIUS_M;
        });
        if (close) {
          members.push(candidate);
          remaining.splice(i, 1);
          grew = true;
        } else {
          i += 1;
        }
      }
    }

    const ordered = orderVisit(members, positions);
    groups.push({
      id: ordered[0]?.id ?? seed.id,
      listings: ordered,
      spanM: spanOf(ordered, positions),
      approximate: ordered.some((listing) => !positions.get(listing.id)?.exact),
      route: routeFor(ordered, positions),
    });
  }

  groups.sort((a, b) => compareByRank(a.listings[0], b.listings[0]));
  return groups;
}
