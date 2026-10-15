import assert from "node:assert/strict";
import { test } from "node:test";
import { normalizeCapture } from "./normalize";
import { isEmptyFilter, matchesFilter, parseFilter } from "./filter";
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

/* Card details the listing schema has no field for. Real values, 2026-09-22. */

const CARD_WITH_FLOOR = `2 BHK Flat In Ambient Asset Homes For Rent In Hsr Layout
27th Cross Rd, Sector 3
Explore Nearby
₹ 24,000
+ 2800
₹ 2,800
Maintenance
Rent
₹1,20,000
Deposit
1,225 sqft
Builtup
1/5
Semi Furnished
Furnishing
2 BHK
Apartment Type
Family
Preferred Tenants
Ready to Move
Available From`;

test("floor is read from the bare N/M row that has no label", () => {
  const result = normalizeCapture("nobroker", capture(CARD_WITH_FLOOR));
  assert.equal(result.draft.floor, "1 of 5");
  // and the maintenance figure still is not mistaken for rent
  assert.equal(result.draft.rent, 24000);
});

test("card details with no schema field are kept in notes", () => {
  const result = normalizeCapture("nobroker", capture(CARD_WITH_FLOOR));
  const notes = String(result.draft.notes);
  assert.match(notes, /1,225 sqft/);
  assert.match(notes, /Maintenance ₹2,800 extra/);
  assert.match(notes, /Preferred tenants: Family/);
});

test("maintenance-included cards say so rather than omitting it", () => {
  const result = normalizeCapture("nobroker", capture(NOBROKER_CARD));
  assert.match(String(result.draft.notes), /Maintenance included/);
  assert.match(String(result.draft.notes), /800 sqft/);
});

test("a date is never mistaken for a floor", () => {
  const result = normalizeCapture(
    "nobroker",
    capture(CARD_WITH_FLOOR.replace("Ready to Move", "01-Oct-2026"))
  );
  assert.equal(result.draft.floor, "1 of 5");
  assert.equal(result.draft.availableFrom, "01-Oct-2026");
});

/* Import filters. Applied after parsing, so they see real rent/BHK values. */

test("BHK filter keeps only the wanted sizes", () => {
  assert.equal(matchesFilter({ bhk: 2, rent: 25000 }, { bhk: [2] }).ok, true);
  assert.equal(matchesFilter({ bhk: 3, rent: 25000 }, { bhk: [2] }).ok, false);
  assert.equal(matchesFilter({ bhk: 1, rent: 25000 }, { bhk: [1, 2] }).ok, true);
});

test("rent range filters on the parsed rent", () => {
  assert.equal(matchesFilter({ rent: 25000 }, { maxRent: 30000 }).ok, true);
  assert.equal(matchesFilter({ rent: 55400 }, { maxRent: 30000 }).ok, false);
  assert.equal(matchesFilter({ rent: 8000 }, { minRent: 15000 }).ok, false);
});

test("a filtered listing explains itself", () => {
  const v = matchesFilter({ rent: 55400, bhk: 2 }, { maxRent: 30000 });
  assert.equal(v.ok, false);
  if (!v.ok) assert.match(v.reason, /55,400.*over.*30,000/);
});

test("listings with no readable rent survive a price filter", () => {
  // Lease cards carry no monthly rent; dropping them would hide exactly the
  // listings that most need a human look.
  assert.equal(matchesFilter({ bhk: 2 }, { maxRent: 30000 }).ok, true);
});

test("an empty filter keeps everything", () => {
  assert.equal(isEmptyFilter({}), true);
  assert.equal(matchesFilter({ rent: 99999, bhk: 5 }, {}).ok, true);
});

test("filter input from the extension is sanitised", () => {
  assert.deepEqual(parseFilter({ bhk: ["2", 3, "x"], maxRent: "30000" }), {
    bhk: [2, 3],
    maxRent: 30000,
  });
  assert.deepEqual(parseFilter(null), {});
  assert.deepEqual(parseFilter({ bhk: [], maxRent: 0 }), {});
});

/* Detail-page captures. Cards never carry coordinates; detail pages do. */

test("coordinates from a detail capture reach the draft", () => {
  const result = normalizeCapture("nobroker", {
    ...capture(NOBROKER_CARD),
    kind: "detail",
    coords: { lat: 12.9121, lng: 77.6386 },
  });
  assert.equal(result.draft.lat, 12.9121);
  assert.equal(result.draft.lng, 77.6386);
});

test("a card capture without coordinates leaves them unset", () => {
  const result = normalizeCapture("nobroker", capture(NOBROKER_CARD));
  assert.equal(result.draft.lat, undefined);
  assert.equal(result.draft.lng, undefined);
});

test("a detail capture still parses the fields a card would", () => {
  const result = normalizeCapture("nobroker", {
    ...capture(NOBROKER_CARD),
    kind: "detail",
  });
  assert.equal(result.draft.rent, 10000);
  assert.equal(result.draft.bhk, 2);
});

/**
 * NoBroker detail page. Condensed from a real capture (2026-09-22) but keeping
 * every structural trap: a "Rent" nav link above the listing, headline stats
 * reading value-then-label, an Overview block reading label-then-value, a flat
 * Amenities list, and an SEO tail advertising other localities.
 */
const DETAIL_PAGE = `Pay Tuition Fee
Post Your Property
Sign up
Menu
Rent
2 BHK Flat In Prabhavathi Park View For Rent In Singasandra
Prabhavathi Park View 14th Cross, Kudlu Main Rd, Singasandra, Bengaluru
₹23,500
+ 1500
Rent
1,040
Sq.Ft
₹ 1,00,000
Deposit
2 Bedroom
No. of Bedroom
Apartment
Property Type
Anyone
Preferred Tenant
Immediately
Possession
Bike and Car
Parking
>10 Years
Age of Building
2
Balcony
Overview
Furnishing Status
Semi
Facing
West
Water Supply
Borewell
Floor
2/4
Bathroom
2
Gated Security
Yes
Amenities
Lift
Gym
Security
Power backup
Nearby Localities
2 BHK Flats for rent in Koramangala
UnFurnished Flats for rent in Singasandra`;

const detail = (text = DETAIL_PAGE) => ({
  ...capture(text),
  kind: "detail" as const,
});

test("detail page: rent is not read from the navigation link", () => {
  // The first "Rent" in the document is a nav item with the site header above
  // it; the real one is four lines below the price.
  assert.equal(normalizeCapture("nobroker", detail()).draft.rent, 23500);
});

test("detail page: parking and power backup are finally available", () => {
  const d = normalizeCapture("nobroker", detail()).draft;
  assert.equal(d.parking, "yes");
  assert.equal(d.powerBackup, "yes");
});

test("detail page: 'None' parking is read as no, not as missing", () => {
  const d = normalizeCapture(
    "nobroker",
    detail(DETAIL_PAGE.replace("Bike and Car", "None"))
  ).draft;
  assert.equal(d.parking, "no");
});

test("detail page: Overview reads label-then-value", () => {
  const d = normalizeCapture("nobroker", detail()).draft;
  assert.equal(d.furnished, "semi"); // bare "Semi", not "Semi Furnished"
  assert.equal(d.floor, "2 of 4");
});

test("detail page: the SEO tail does not set area or furnishing", () => {
  const d = normalizeCapture("nobroker", detail()).draft;
  // The tail advertises Koramangala and "UnFurnished" listings elsewhere.
  assert.notEqual(d.area, "Koramangala");
  assert.equal(d.furnished, "semi");
});

test("detail page: society, deposit and possession", () => {
  const d = normalizeCapture("nobroker", detail()).draft;
  assert.equal(d.society, "Prabhavathi Park View");
  assert.equal(d.deposit, 100000);
  assert.equal(d.availableFrom, "Immediately");
  assert.equal(d.bhk, 2);
});

test("detail page: extras with no schema field land in notes", () => {
  const notes = String(normalizeCapture("nobroker", detail()).draft.notes);
  assert.match(notes, /1,040 sqft/);
  assert.match(notes, /West facing/);
  assert.match(notes, /Water: Borewell/);
  assert.match(notes, /Amenities: .*Power backup/);
});

test("a card capture is still parsed as a card, not a detail page", () => {
  const d = normalizeCapture("nobroker", capture(NOBROKER_CARD)).draft;
  assert.equal(d.rent, 10000);
  assert.equal(d.parking, undefined);
});
