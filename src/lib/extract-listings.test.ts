import assert from "node:assert/strict";
import { test } from "node:test";
import {
  candidateToDraft,
  extractListingCandidates,
  fragileHostMessage,
} from "./extract-listings";

test("JSON-LD listing keeps BHK and coordinates as-is", () => {
  const html = `
    <script type="application/ld+json">
    {
      "@type": "RealEstateListing",
      "name": "SNN Raj Serenity",
      "description": "2 BHK apartment in Harlur with parking",
      "url": "https://housing.com/snn",
      "telephone": "9876543210",
      "numberOfBedrooms": 2,
      "price": 28000,
      "address": { "streetAddress": "Near Kudlu Gate", "addressLocality": "Harlur" },
      "geo": { "latitude": 12.89, "longitude": 77.66 },
      "image": "https://example.com/photo.jpg"
    }
    </script>
  `;
  const { candidates } = extractListingCandidates({
    html,
    url: "https://housing.com/snn",
  });
  assert.ok(candidates.length >= 1);
  const top = candidates[0];
  assert.equal(top.hints.bhk, 2);
  assert.equal(top.hints.rent, 28000);
  assert.equal(top.hints.lat, 12.89);
  assert.equal(top.hints.lng, 77.66);
  assert.equal(top.hints.area, "Harlur");
  assert.ok((top.confidence ?? 0) >= 70);
  const draft = candidateToDraft(top);
  assert.equal(draft.bhk, 2);
  assert.equal(draft.society, "SNN Raj Serenity");
});

test("notes split by dashes become a pickable list", () => {
  const notes = `2 BHK in SNN Raj Serenity, Harlur, ₹28,000, parking
---
2 BHK Prestige Park View, HSR Layout, rent 26,000, no parking`;
  const { candidates } = extractListingCandidates({ notes });
  assert.equal(candidates.length, 2);
  const rents = candidates.map((c) => c.hints.rent).sort();
  assert.deepEqual(rents, [26000, 28000]);
  assert.ok(candidates.some((c) => c.hints.area === "Harlur"));
  assert.ok(candidates.some((c) => c.hints.area === "HSR"));
});

test("generic Open Graph titles are not used as society names", () => {
  const html = `
    <meta property="og:title" content="2 BHK Apartment for Rent in HSR Layout, Bangalore" />
    <meta property="og:description" content="2 BHK in HSR, rent ₹26,000, parking available at Prestige Park View" />
  `;
  const { candidates } = extractListingCandidates({ html, url: "https://99acres.com/x" });
  assert.ok(candidates.length >= 1);
  const top = candidates[0];
  assert.notEqual(top.hints.society, "2 BHK Apartment for Rent in HSR Layout, Bangalore");
  assert.equal(top.hints.rent, 26000);
  assert.equal(top.hints.area, "HSR");
});

test("Facebook hosts are skipped with a paste-the-text message", () => {
  const hit = fragileHostMessage("https://www.facebook.com/marketplace/item/1");
  assert.ok(hit);
  assert.equal(hit.skip, true);
  assert.match(hit.message, /Facebook/);
});

test("item lists and page JSON yield multiple options", () => {
  const html = `
    <script type="application/ld+json">
    {
      "@type": "ItemList",
      "itemListElement": [
        { "@type": "Apartment", "name": "Alpha Homes", "numberOfBedrooms": 2, "price": 25000, "address": "Koramangala" },
        { "@type": "Apartment", "name": "Beta Residency", "numberOfBedrooms": 2, "price": 29000, "address": "BTM Layout" }
      ]
    }
    </script>
  `;
  const { candidates } = extractListingCandidates({ html });
  assert.ok(candidates.length >= 2, `got ${candidates.length}`);
  assert.ok(candidates.some((c) => /Alpha/i.test(c.label)));
  assert.ok(candidates.some((c) => /Beta/i.test(c.label)));
});

test("phone numbers in notes land on the draft", () => {
  const notes = "2 BHK in Harlur, ₹28,000, parking. Call 9123456789";
  const { candidates } = extractListingCandidates({ notes });
  assert.equal(candidates.length, 1);
  assert.equal(candidates[0].hints.contact, "9123456789");
  assert.equal(candidateToDraft(candidates[0]).contact, "9123456789");
});
