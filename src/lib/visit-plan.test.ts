import assert from "node:assert/strict";
import { test } from "node:test";
import { distanceMeters, type MapPosition } from "./map-position";
import { emptyListing, type Listing, type VisitCheck } from "./types";
import { checkScore, compareByRank, formatSpan, groupVisits } from "./visit-plan";

const house = (over: Partial<Listing>): Listing =>
  emptyListing({
    id: "fixed",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...over,
  });

function checks(flags: boolean[]): VisitCheck[] {
  return flags.map((checked, index) => ({
    id: `c${index}`,
    label: `Check ${index}`,
    checked,
  }));
}

function at(id: string, lat: number, lng: number, exact = true): [string, MapPosition] {
  return [id, { lat, lng, exact }];
}

test("an empty checklist scores as 0/3", () => {
  assert.deepEqual(checkScore([]), { ticked: 0, total: 3 });
});

test("score counts saved ticks and unticks", () => {
  assert.deepEqual(checkScore(checks([true, true, false, false])), {
    ticked: 2,
    total: 4,
  });
});

test("more ticks rank first", () => {
  const high = house({ id: "high", visitChecks: checks([true, true, true]) });
  const low = house({ id: "low", visitChecks: checks([true, false, false]) });
  assert.ok(compareByRank(high, low) < 0);
});

test("the same tick count with fewer unticks ranks first", () => {
  const full = house({ id: "full", visitChecks: checks([true, true, true]) });
  const extra = house({
    id: "extra",
    visitChecks: checks([true, true, true, false, false]),
  });
  assert.ok(compareByRank(full, extra) < 0);
});

test("lower rent ranks first and a missing rent sorts last", () => {
  const cheap = house({ id: "cheap", rent: 20000 });
  const dear = house({ id: "dear", rent: 28000 });
  const none = house({ id: "none", rent: null });
  assert.ok(compareByRank(cheap, dear) < 0);
  assert.ok(compareByRank(dear, none) < 0);
});

test("the same score and rent puts the newer update first", () => {
  const older = house({
    id: "old",
    rent: 25000,
    updatedAt: "2026-01-01T00:00:00.000Z",
  });
  const newer = house({
    id: "new",
    rent: 25000,
    updatedAt: "2026-06-01T00:00:00.000Z",
  });
  assert.ok(compareByRank(newer, older) < 0);
});

test("a chain within 2 km is one group and a far house stays out", () => {
  const best = house({
    id: "a",
    lat: 12.9,
    lng: 77.65,
    visitChecks: checks([true, true, true]),
  });
  const mid = house({ id: "b", lat: 12.91, lng: 77.65, visitChecks: checks([true]) });
  const farLink = house({ id: "c", lat: 12.92, lng: 77.65 });
  const away = house({ id: "d", lat: 13.0, lng: 77.65, visitChecks: checks([true, true]) });
  const positions = new Map([
    at("a", 12.9, 77.65),
    at("b", 12.91, 77.65),
    at("c", 12.92, 77.65),
    at("d", 13.0, 77.65),
  ]);

  const groups = groupVisits([away, farLink, mid, best], positions);
  assert.deepEqual(
    groups.map((group) => group.listings.map((listing) => listing.id)),
    [
      ["a", "b", "c"],
      ["d"],
    ]
  );
  assert.equal(groups[0].approximate, false);
  assert.ok(groups[0].spanM > 2000);
  assert.ok(groups[0].route);
  assert.equal(groups[1].route, null);
});

test("a house 2 km away joins and one just past 2 km stays out", () => {
  const origin = house({
    id: "origin",
    visitChecks: checks([true, true, true]),
  });
  const closeLat = 12.9 + 2000 / 111320;
  const farLng = 77.65 + 3000 / 108500;
  assert.ok(distanceMeters(12.9, 77.65, closeLat, 77.65) <= 2000);
  assert.ok(distanceMeters(12.9, 77.65, 12.9, farLng) > 2000);
  assert.ok(distanceMeters(closeLat, 77.65, 12.9, farLng) > 2000);
  const close = house({ id: "close" });
  const far = house({ id: "far" });
  const positions = new Map([
    at("origin", 12.9, 77.65),
    at("close", closeLat, 77.65),
    at("far", 12.9, farLng),
  ]);

  const groups = groupVisits([far, close, origin], positions);
  const ids = groups.map((group) => group.listings.map((listing) => listing.id));
  assert.deepEqual(ids, [["origin", "close"], ["far"]]);
});

test("visit order starts at the best house, then the nearest", () => {
  const best = house({
    id: "best",
    visitChecks: checks([true, true, true]),
  });
  const near = house({ id: "near", visitChecks: checks([true, true]) });
  const side = house({ id: "side", visitChecks: checks([true, true]) });
  const positions = new Map([
    at("best", 12.9, 77.65),
    at("near", 12.905, 77.65),
    at("side", 12.9, 77.66),
  ]);

  const [group] = groupVisits([side, near, best], positions);
  assert.deepEqual(
    group.listings.map((listing) => listing.id),
    ["best", "near", "side"]
  );
});

test("an approximate pin stays in the group and off the route", () => {
  const first = house({
    id: "first",
    visitChecks: checks([true, true, true]),
  });
  const second = house({ id: "second", visitChecks: checks([true]) });
  const guess = house({ id: "guess" });
  const positions = new Map([
    at("first", 12.9, 77.65),
    at("guess", 12.904, 77.65, false),
    at("second", 12.908, 77.65),
  ]);

  const [group] = groupVisits([guess, second, first], positions);
  assert.deepEqual(
    group.listings.map((listing) => listing.id),
    ["first", "guess", "second"]
  );
  assert.equal(group.approximate, true);
  assert.ok(group.route);
  const url = new URL(group.route.url);
  assert.equal(url.origin + url.pathname, "https://www.google.com/maps/dir/");
  assert.equal(url.searchParams.get("travelmode"), "driving");
  assert.equal(url.searchParams.get("origin"), "12.9,77.65");
  assert.equal(url.searchParams.get("destination"), "12.908,77.65");
  assert.equal(url.searchParams.get("waypoints"), null);
  assert.equal(group.route.omitted, 0);
  assert.equal(url.searchParams.get("origin")?.includes("12.904"), false);
});

test("fewer than two exact pins has no route", () => {
  const only = house({ id: "only", visitChecks: checks([true]) });
  const guess = house({ id: "guess" });
  const positions = new Map([
    at("only", 12.9, 77.65),
    at("guess", 12.905, 77.65, false),
  ]);
  const [group] = groupVisits([guess, only], positions);
  assert.equal(group.route, null);
  assert.equal(group.approximate, true);
});

test("a house with no position is its own group", () => {
  const placed = house({ id: "placed", visitChecks: checks([true]) });
  const missing = house({ id: "missing", visitChecks: checks([true, true, true]) });
  const positions = new Map([at("placed", 12.9, 77.65)]);
  const groups = groupVisits([placed, missing], positions);
  assert.deepEqual(
    groups.map((group) => group.listings.map((listing) => listing.id)),
    [["missing"], ["placed"]]
  );
});

test("a route longer than 11 exact stops keeps the first 11", () => {
  const listings = Array.from({ length: 13 }, (_, index) =>
    house({
      id: `h${String(index).padStart(2, "0")}`,
      visitChecks: index === 0 ? checks([true, true, true]) : [],
    })
  );
  const positions = new Map(
    listings.map((listing, index) => at(listing.id, 12.9 + index * 0.0003, 77.65))
  );
  const [group] = groupVisits(listings, positions);
  assert.equal(group.listings.length, 13);
  assert.ok(group.route);
  assert.equal(group.route.omitted, 2);
  const url = new URL(group.route.url);
  assert.equal(url.searchParams.get("origin"), "12.9,77.65");
  const destination = url.searchParams.get("destination");
  assert.equal(destination, `${12.9 + 10 * 0.0003},77.65`);
  const waypoints = url.searchParams.get("waypoints")?.split("|") ?? [];
  assert.equal(waypoints.length, 9);
  assert.equal(waypoints[0], `${12.9 + 0.0003},77.65`);
  assert.ok(!url.toString().includes(String(12.9 + 11 * 0.0003)));
});

test("span reads in metres under 1 km and kilometres from 1 km", () => {
  assert.equal(formatSpan(800), "800 m");
  assert.equal(formatSpan(1000), "1.0 km");
  assert.equal(formatSpan(1200), "1.2 km");
});
