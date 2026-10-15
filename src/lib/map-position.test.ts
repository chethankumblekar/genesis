import assert from "node:assert/strict";
import { test } from "node:test";
import { AREA_CENTERS } from "./constants";
import { mapPosition, mapPositions } from "./map-position";
import type { Listing } from "./types";

const listing = (over: Partial<Listing>): Listing =>
  ({ id: "a", area: "HSR", lat: null, lng: null, ...over }) as Listing;

test("a listing with real coordinates keeps them exactly", () => {
  const pos = mapPosition(listing({ lat: 12.8808069, lng: 77.6510067 }));
  assert.deepEqual(pos, { lat: 12.8808069, lng: 77.6510067, exact: true });
});

test("a listing without coordinates falls back near its area centre", () => {
  const pos = mapPosition(listing({ area: "Koramangala" }));
  assert.ok(pos);
  assert.equal(pos.exact, false);
  const c = AREA_CENTERS.Koramangala;
  // Close enough to read as "in Koramangala", never claiming the exact spot.
  assert.ok(Math.abs(pos.lat - c.lat) < 0.012, "within ~1.3km of centre");
  assert.ok(Math.abs(pos.lng - c.lng) < 0.012);
});

test("the fallback spot is stable across calls, not random", () => {
  const a = mapPosition(listing({ id: "abc" }));
  const b = mapPosition(listing({ id: "abc" }));
  assert.deepEqual(a, b);
});

test("listings in the same area do not stack on one point", () => {
  const rows = [
    listing({ id: "one" }),
    listing({ id: "two" }),
    listing({ id: "three" }),
  ];
  const positions = mapPositions(rows);
  const keys = [...positions.values()].map((p) => `${p.lat},${p.lng}`);
  assert.equal(new Set(keys).size, 3, "each gets its own spot");
});

test("exact positions are never nudged by the spreading", () => {
  const rows = [
    listing({ id: "one" }),
    listing({ id: "exact", lat: 12.9, lng: 77.6 }),
    listing({ id: "two" }),
  ];
  const positions = mapPositions(rows);
  assert.deepEqual(positions.get("exact"), { lat: 12.9, lng: 77.6, exact: true });
});
