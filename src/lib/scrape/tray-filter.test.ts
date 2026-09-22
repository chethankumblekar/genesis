import assert from "node:assert/strict";
import { test } from "node:test";
import {
  EMPTY_FILTER,
  activeCount,
  matchesTrayFilter,
  sortRows,
  type TrayFilter,
} from "./tray-filter";
import type { ScrapedListing } from "./types";

function row(draft: Record<string, unknown>, over: Partial<ScrapedListing> = {}) {
  return {
    id: String(Math.random()),
    source: "nobroker",
    externalId: "x",
    url: "https://x",
    raw: {},
    draft,
    confidence: "high",
    reasons: [],
    filled: [],
    missing: [],
    status: "pending",
    capturedAt: "",
    createdAt: "",
    updatedAt: "",
    ...over,
  } as unknown as ScrapedListing;
}

const f = (over: Partial<TrayFilter> = {}): TrayFilter => ({ ...EMPTY_FILTER, ...over });

test("an empty filter matches everything", () => {
  assert.equal(matchesTrayFilter(row({ rent: 99999, bhk: 5 }), f()), true);
  assert.equal(activeCount(f()), 0);
});

test("bhk, area and rent narrow independently", () => {
  const r = row({ bhk: 2, rent: 25000, area: "HSR" });
  assert.equal(matchesTrayFilter(r, f({ bhk: [2] })), true);
  assert.equal(matchesTrayFilter(r, f({ bhk: [1, 3] })), false);
  assert.equal(matchesTrayFilter(r, f({ area: "Kudlu" })), false);
  assert.equal(matchesTrayFilter(r, f({ maxRent: "20000" })), false);
  assert.equal(matchesTrayFilter(r, f({ minRent: "30000" })), false);
});

test("a listing with no readable rent survives a price filter", () => {
  // Five of the real captures are leases with no monthly rent.
  const lease = row({ bhk: 2, area: "HSR" });
  assert.equal(matchesTrayFilter(lease, f({ maxRent: "20000" })), true);
  assert.equal(matchesTrayFilter(lease, f({ maxDeposit: "50000" })), true);
});

test("deposit filter applies only when a deposit was read", () => {
  assert.equal(matchesTrayFilter(row({ deposit: 200000 }), f({ maxDeposit: "100000" })), false);
  assert.equal(matchesTrayFilter(row({ deposit: 90000 }), f({ maxDeposit: "100000" })), true);
});

test("search looks across society, address and notes", () => {
  const r = row({
    society: "Ambient Asset Homes",
    address: "27th Cross Rd",
    notes: "Builtup 1,225 sqft",
  });
  assert.equal(matchesTrayFilter(r, f({ q: "ambient" })), true);
  assert.equal(matchesTrayFilter(r, f({ q: "27th" })), true);
  assert.equal(matchesTrayFilter(r, f({ q: "sqft" })), true);
  assert.equal(matchesTrayFilter(r, f({ q: "nonsense" })), false);
});

test("source and confidence filter on the capture, not the draft", () => {
  const fb = row({ bhk: 2 }, { source: "facebook", confidence: "low" });
  assert.equal(matchesTrayFilter(fb, f({ source: "facebook" })), true);
  assert.equal(matchesTrayFilter(fb, f({ source: "nobroker" })), false);
  assert.equal(matchesTrayFilter(fb, f({ confidence: "low" })), true);
  assert.equal(matchesTrayFilter(fb, f({ confidence: "high" })), false);
});

test("furnished and housing type filter on parsed values", () => {
  const r = row({ furnished: "semi", housingType: "apartment" });
  assert.equal(matchesTrayFilter(r, f({ furnished: "semi" })), true);
  assert.equal(matchesTrayFilter(r, f({ furnished: "fully" })), false);
  assert.equal(matchesTrayFilter(r, f({ housingType: "apartment" })), true);
  assert.equal(matchesTrayFilter(r, f({ housingType: "gated_society" })), false);
});

test("unreadable rents sort last, never as zero", () => {
  const rows = [row({ rent: 30000 }), row({}), row({ rent: 12000 })];
  const asc = sortRows(rows, "rentAsc").map((r) => (r.draft as { rent?: number }).rent);
  assert.deepEqual(asc, [12000, 30000, undefined]);
  const desc = sortRows(rows, "rentDesc").map((r) => (r.draft as { rent?: number }).rent);
  assert.deepEqual(desc, [30000, 12000, undefined]);
});

test("sorting by capture order leaves the list untouched", () => {
  const rows = [row({ rent: 30000 }), row({ rent: 12000 })];
  assert.equal(sortRows(rows, "captured"), rows);
});

test("active count drives the collapsed summary", () => {
  assert.equal(activeCount(f({ bhk: [2] })), 1);
  assert.equal(activeCount(f({ bhk: [2], maxRent: "30000", area: "HSR" })), 3);
  // sort is not a filter, so it does not count
  assert.equal(activeCount(f({ sort: "rentAsc" })), 0);
  // a blank or nonsense number is not an active filter
  assert.equal(activeCount(f({ maxRent: "  " })), 0);
  assert.equal(activeCount(f({ maxRent: "0" })), 0);
});
