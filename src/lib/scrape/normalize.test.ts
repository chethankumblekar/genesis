import assert from "node:assert/strict";
import { test } from "node:test";
import { normalizeCapture } from "./normalize";
import { looksLikeGoods, scoreCapture } from "./score";
import type { RawCapture } from "./types";

function capture(text: string, over: Partial<RawCapture> = {}): RawCapture {
  return {
    externalId: "x1",
    url: "https://example.com/x1",
    text,
    imageUrls: [],
    capturedAt: "2026-09-20T00:00:00.000Z",
    ...over,
  };
}

/** Verbatim innerText of a real NoBroker card, captured 2026-09-20. */
const NOBROKER_CARD = `2 BHK House For Rent In Hsr Layout
Independent House, Sector 7, Near Golden Arch Montessori School
Explore Nearby
₹ 10,000
+
No Extra Maintenance
Included
Rent
₹40,000
Deposit
800 sqft
Builtup
Semi Furnished
Furnishing
2 BHK
Apartment Type
Family
Preferred Tenants
Ready to Move
Available From
Get Owner Details`;

test("NoBroker card: rent is read past the maintenance rows, not off the adjacent line", () => {
  const result = normalizeCapture(
    "nobroker",
    capture(NOBROKER_CARD, {
      externalId: "ff8081814ff00cb1014ff3d2d23711ab",
      url: "https://www.nobroker.in/property/2-bhk-apartment-for-rent-in-hsr-layout-bangalore-for-rs-10000/ff8081814ff00cb1014ff3d2d23711ab/detail",
    })
  );

  // The line directly above "Rent" is "Included" — a naive parser reads that.
  assert.equal(result.draft.rent, 10000);
  assert.equal(result.draft.deposit, 40000);
  assert.equal(result.draft.bhk, 2);
  assert.equal(result.draft.area, "HSR");
  assert.equal(result.draft.furnished, "semi");
  assert.equal(result.draft.availableFrom, "Ready to Move");
  assert.equal(result.draft.source, "NoBroker");
  assert.match(String(result.draft.address), /Sector 7/);
  assert.equal(result.confidence, "high");
});

test("NoBroker card keeps its external id and canonical url for dedupe", () => {
  const result = normalizeCapture(
    "nobroker",
    capture(NOBROKER_CARD, { externalId: "8a9f929d747c957e01747db0934d6a41" })
  );
  assert.equal(result.externalId, "8a9f929d747c957e01747db0934d6a41");
  assert.equal(result.url, "https://example.com/x1");
});

test("Facebook card reads rent and BHK from a three-line card", () => {
  const result = normalizeCapture(
    "facebook",
    capture("₹20,000\n1BHK\nBengaluru, KA", {
      externalId: "1420158113319923",
      url: "https://www.facebook.com/marketplace/item/1420158113319923",
    })
  );
  assert.equal(result.draft.rent, 20000);
  assert.equal(result.draft.bhk, 1);
  assert.equal(result.draft.source, "Facebook");
  assert.equal(result.draft.address, "Bengaluru, KA");
});

test("Facebook goods are scored low, not dropped", () => {
  const result = normalizeCapture(
    "facebook",
    capture("₹600\nWooden railing wood railing glass railing\nBengaluru, KA")
  );
  assert.equal(result.confidence, "low");
  assert.match(result.reasons.join(" "), /goods/i);
  // Still normalized and returned — recoverable from the review tray.
  assert.equal(result.draft.rent, 600);
});

test("cheap listing with no BHK scores low", () => {
  const result = normalizeCapture("facebook", capture("₹1,200\nRoom\nBengaluru, KA"));
  assert.equal(result.confidence, "low");
});

test("a real flat priced low still survives when BHK is present", () => {
  const result = normalizeCapture(
    "facebook",
    capture("₹4,500\n1 BHK in HSR Layout\nBengaluru, KA")
  );
  assert.notEqual(result.confidence, "low");
  assert.equal(result.draft.bhk, 1);
  assert.equal(result.draft.area, "HSR");
});

test("missing fields are reported for the review tray", () => {
  const result = normalizeCapture("facebook", capture("₹18,000\nRent\nBengaluru, KA"));
  assert.ok(result.missing.includes("bhk"));
  assert.ok(result.filled.includes("rent"));
});

test("goods detector does not fire on ordinary flat wording", () => {
  assert.equal(looksLikeGoods("2 BHK semi furnished flat in HSR Layout"), false);
  assert.equal(looksLikeGoods("Selling wooden railing"), true);
});

test("scoring is source-aware: NoBroker is never junk-filtered", () => {
  const score = scoreCapture(
    { rent: 600, bhk: 2, area: "HSR" },
    "Wooden railing",
    "nobroker"
  );
  assert.notEqual(score.confidence, "low");
});

/**
 * Real card, captured 2026-09-20. Maintenance is billed separately, so a ₹300
 * figure sits between the real rent and the "Rent" label.
 */
const NOBROKER_WITH_MAINTENANCE = `2 BHK House For Rent In Sector 7 Hsr Layout
Independent House, Sector 7Near Central Bank of India
Explore Nearby
₹ 21,000
+ 300
₹ 300
Maintenance
Rent
₹1,00,000
Deposit
1,200 sqft
Builtup
1/6
Semi Furnished
Furnishing
2 BHK
Apartment Type
All
Preferred Tenants
Ready to Move
Available From
Get Owner Details`;

test("separate maintenance charge is not mistaken for the rent", () => {
  const result = normalizeCapture("nobroker", capture(NOBROKER_WITH_MAINTENANCE));
  assert.equal(result.draft.rent, 21000);
  assert.equal(result.draft.deposit, 100000);
  assert.equal(result.draft.bhk, 2);
});

test("lakh-formatted deposits parse", () => {
  const result = normalizeCapture(
    "nobroker",
    capture(NOBROKER_CARD.replace("₹40,000\nDeposit", "₹1,00,000\nDeposit"))
  );
  assert.equal(result.draft.deposit, 100000);
});

/** A lease listing: no monthly rent at all, only a large deposit. */
test("lease listings surface for review instead of inventing a rent", () => {
  const lease = `2 BHK Flat In Studio Amuse For Lease In Hsr Layout
15th Main Rd, Sector 3,
Explore Nearby
Only Deposit
+ 3000
₹ 3,000
Maintenance
Rent
₹25,00,000
Deposit
1,100 sqft
Builtup
Semi Furnished
Furnishing
2 BHK
Apartment Type`;
  const result = normalizeCapture("nobroker", capture(lease));
  assert.equal(result.draft.rent, undefined);
  assert.equal(result.draft.deposit, 2500000);
  assert.ok(result.missing.includes("rent"));
  assert.notEqual(result.confidence, "high");
});

/* Real Facebook Marketplace cards, captured 2026-09-20. Marketplace never
   writes "BHK" — it writes "2 Beds 2 Baths". */

test("Facebook bedroom counts are read from Beds, not BHK", () => {
  const result = normalizeCapture(
    "facebook",
    capture("₹26,000\n2 Beds 2 Baths - Apartment\nBengaluru, KA")
  );
  assert.equal(result.draft.bhk, 2);
  assert.equal(result.draft.rent, 26000);
  assert.equal(result.draft.housingType, "apartment");
});

test("bathroom count is never mistaken for the bedroom count", () => {
  const result = normalizeCapture(
    "facebook",
    capture("₹25,999\n3 Beds 2 Baths - Apartment\nBengaluru, KA")
  );
  assert.equal(result.draft.bhk, 3);
});

test("'bedrooms'/'bathrooms' long form parses", () => {
  const result = normalizeCapture(
    "facebook",
    capture("₹27,000\n2 beds 2 bathrooms – Flat\nBengaluru, KA")
  );
  assert.equal(result.draft.bhk, 2);
});

test("'Just listed' badge is not treated as the title", () => {
  const result = normalizeCapture(
    "facebook",
    capture("Just listed\n₹18,000\n2 beds 2 bathrooms – Flat\nBengaluru, KA")
  );
  assert.ok(!/just listed/i.test(String(result.draft.society)));
  assert.equal(result.draft.bhk, 2);
});

test("an unreadable area becomes Nearby, never a silently wrong HSR", () => {
  const result = normalizeCapture(
    "facebook",
    capture("₹19,000\n2 Beds 2 Baths House\nBengaluru, KA")
  );
  // emptyListing() would default this to HSR on promote — filing a listing
  // under an area it has nothing to do with.
  assert.equal(result.draft.area, "Nearby");
  assert.ok(result.missing.includes("area"), "tray must still ask about area");
  assert.notEqual(result.confidence, "high");
});

test("a recognised area is still reported as filled", () => {
  const result = normalizeCapture(
    "facebook",
    capture("₹19,000\n2 Beds in Koramangala\nBengaluru, KA")
  );
  assert.equal(result.draft.area, "Koramangala");
  assert.ok(result.filled.includes("area"));
  assert.equal(result.confidence, "high");
});

/* NoBroker titles are formulaic; a fragment like "Flat For Rent In" is not a
   society name. Real titles, captured 2026-09-20. */

test("a formulaic NoBroker title yields no society, not a fragment", () => {
  const result = normalizeCapture(
    "nobroker",
    capture(NOBROKER_CARD.replace(
      "2 BHK House For Rent In Hsr Layout",
      "2 BHK Flat For Rent In Koramangala"
    ))
  );
  assert.equal(result.draft.society ?? "", "");
  assert.ok(result.missing.includes("society"));
  assert.equal(result.draft.area, "Koramangala");
});

test("a NoBroker title that does name a society keeps it", () => {
  const result = normalizeCapture(
    "nobroker",
    capture(NOBROKER_CARD.replace(
      "2 BHK House For Rent In Hsr Layout",
      "2 BHK Flat In Ambient Asset Homes For Rent In Hsr Layout"
    ))
  );
  assert.equal(result.draft.society, "Ambient Asset Homes");
  assert.ok(result.filled.includes("society"));
});

test("a lease title naming a society keeps it too", () => {
  const result = normalizeCapture(
    "nobroker",
    capture(NOBROKER_CARD.replace(
      "2 BHK House For Rent In Hsr Layout",
      "2 BHK Flat In Studio Amuse For Lease In Hsr Layout"
    ))
  );
  assert.equal(result.draft.society, "Studio Amuse");
});
