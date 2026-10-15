import type { Furnished, HousingType, ListingDraft } from "../types";
import type { RawCapture, ScrapeSource } from "./types";

/** Card text arrives as innerText: meaningful lines, blank lines to discard. */
export function lines(text: string): string[] {
  return text
    .split("\n")
    .map((line) => line.replace(/\s+/g, " ").trim())
    .filter(Boolean);
}

const MONEY = /₹\s*([0-9][0-9,]*)/;

export function money(line: string): number | undefined {
  const m = line.match(MONEY);
  if (!m) return undefined;
  const n = Number(m[1].replace(/,/g, ""));
  return Number.isFinite(n) && n > 0 ? n : undefined;
}

/**
 * NoBroker renders each stat as VALUE then LABEL ("₹40,000" / "Deposit"), but
 * not always adjacently — rent is four lines above its own label, behind the
 * maintenance rows. So: find the label, then walk backwards to the nearest
 * preceding line that looks like the value we want.
 */
export function valueBefore(
  all: string[],
  label: string,
  matches: (line: string) => boolean
): string | undefined {
  // Detail pages repeat words like "Rent" in the site navigation, so the first
  // occurrence of a label is not necessarily the stat. Try each in turn and
  // take the first that actually has a plausible value above it.
  for (let idx = 0; idx < all.length; idx++) {
    if (all[idx].toLowerCase() !== label.toLowerCase()) continue;
    for (let i = idx - 1; i >= 0; i--) {
      if (matches(all[i])) return all[i];
    }
  }
  return undefined;
}

/** The Overview block reverses the pattern: label first, value on the next line. */
export function valueAfter(all: string[], label: string): string | undefined {
  const idx = all.findIndex((l) => l.toLowerCase() === label.toLowerCase());
  if (idx < 0 || idx + 1 >= all.length) return undefined;
  return all[idx + 1];
}

/**
 * Rent needs its own walk-back. Cards with a separate maintenance charge render
 *
 *     ₹ 21,000 / + 300 / ₹ 300 / Maintenance / Rent
 *
 * so the nearest money line above the "Rent" label is the *maintenance* amount.
 * Cards with no extra maintenance render "No Extra Maintenance / Included /
 * Rent", where the nearest money line is correct. Walk back, and if we crossed
 * a "Maintenance" label on the way, discard the first figure we meet.
 */
export function rentFrom(all: string[]): number | undefined {
  // Detail pages carry a "Rent" navigation link above the listing itself, so
  // try every occurrence and take the first with a figure above it.
  for (let idx = 0; idx < all.length; idx++) {
    if (all[idx].toLowerCase() !== "rent") continue;

    let skipNextMoney = false;
    for (let i = idx - 1; i >= 0; i--) {
      const line = all[i];
      if (line.toLowerCase() === "maintenance") {
        skipNextMoney = true;
        continue;
      }
      if (!MONEY.test(line)) continue;
      if (skipNextMoney) {
        skipNextMoney = false;
        continue;
      }
      return money(line);
    }
  }
  return undefined;
}

export function furnishedFrom(line: string | undefined): Furnished | undefined {
  if (!line) return undefined;
  if (/\bunfurnished\b/i.test(line)) return "unfurnished";
  if (/\bsemi[-\s]?furnished\b/i.test(line)) return "semi";
  if (/\bfully[-\s]?furnished\b|\bfurnished\b/i.test(line)) return "fully";
  // The detail page's Overview block writes the value on its own: "Semi".
  if (/^\s*semi\s*$/i.test(line)) return "semi";
  if (/^\s*(?:fully|full)\s*$/i.test(line)) return "fully";
  if (/^\s*(?:none|no)\s*$/i.test(line)) return "unfurnished";
  return undefined;
}

export function housingTypeFrom(text: string): HousingType | undefined {
  if (/\bservice[d]?\s+apartment\b/i.test(text)) return "service_apartment";
  if (/\bgated\b|\bsociety\b/i.test(text)) return "gated_society";
  if (/\bapartment\b|\bflat\b/i.test(text)) return "apartment";
  return undefined;
}

/**
 * NoBroker says "2 BHK"; Facebook says "2 Beds 2 Baths" or
 * "2 beds 2 bathrooms - Flat". Match both, and never read the bathroom count
 * as the bedroom count.
 */
export function bhkFrom(line: string | undefined): number | undefined {
  if (!line) return undefined;
  const bhk = line.match(/(\d(?:\.\d)?)\s*-?\s*bhk/i);
  if (bhk) return Number(bhk[1]);
  const beds = line.match(/(\d(?:\.\d)?)\s*-?\s*bed(?:s|room|rooms)?\b/i);
  return beds ? Number(beds[1]) : undefined;
}

/** Marketplace stamps promo badges above the price; they are not the title. */
const FB_BADGES = /^(just listed|new listing|sponsored|free shipping)$/i;

/**
 * Floor shows up as a bare "1/8" (first of eight) with no label of its own,
 * sitting between the Builtup and Furnishing rows. Dates on these cards are
 * written "01-Oct-2026", so a slash pair is unambiguous.
 */
export function floorFrom(all: string[]): string | undefined {
  const line = all.find((l) => /^(?:ground|g|\d{1,2})\s*\/\s*\d{1,2}$/i.test(l));
  if (!line) return undefined;
  const [f, total] = line.split("/").map((x) => x.trim());
  const named = /^(?:ground|g)$/i.test(f) ? "Ground" : f;
  return `${named} of ${total}`;
}

/**
 * Details NoBroker puts on the card that the listing schema has no field for.
 * They are worth keeping, so they go into notes rather than being dropped.
 */
export function noBrokerNotes(all: string[]): string {
  const bits: string[] = [];

  const builtup = valueBefore(all, "Builtup", (l) => /\bsqft\b/i.test(l));
  if (builtup) bits.push(`Builtup ${builtup}`);

  const maintenance = valueBefore(all, "Maintenance", (l) => MONEY.test(l));
  if (maintenance) {
    const n = money(maintenance);
    if (n != null) bits.push(`Maintenance ₹${n.toLocaleString("en-IN")} extra`);
  } else if (all.some((l) => /no extra maintenance/i.test(l))) {
    bits.push("Maintenance included");
  }

  const tenants = valueBefore(
    all,
    "Preferred Tenants",
    (l) => /^(family|all|bachelors?|company|anyone)$/i.test(l)
  );
  if (tenants) bits.push(`Preferred tenants: ${tenants}`);

  return bits.join(" · ");
}

/**
 * NoBroker titles are formulaic:
 *
 *   "2 BHK Flat For Rent In Hsr Layout"            -> no society, just a type
 *   "2 BHK Flat In Ambient Asset Homes For Rent"   -> society "Ambient Asset Homes"
 *
 * Returning "" (rather than undefined) means "this card definitively has no
 * society name", so the generic heuristic does not fill it with a fragment of
 * the title such as "Flat For Rent In".
 */
export function noBrokerSociety(title: string | undefined): string | undefined {
  if (!title) return undefined;
  const named = title.match(
    /^\s*[\d.]+\s*BHK\s+.+?\s+In\s+(.+?)\s+For\s+(?:Rent|Lease)\b/i
  );
  if (named?.[1]) return named[1].trim();
  if (/^\s*[\d.]+\s*BHK\s+.+?\s+For\s+(?:Rent|Lease)\s+In\b/i.test(title)) {
    return "";
  }
  return undefined;
}

/**
 * NoBroker search-result card. Verified against live DOM 2026-09-20.
 * Line 1 is the title, line 2 the address; the rest are value/label stat pairs.
 */
export function parseNoBrokerCard(capture: RawCapture): ListingDraft {
  const all = lines(capture.text);
  const draft: ListingDraft = {};

  const rent = rentFrom(all);
  if (rent != null) draft.rent = rent;

  const depositLine = valueBefore(all, "Deposit", (l) => MONEY.test(l));
  const deposit = depositLine ? money(depositLine) : undefined;
  if (deposit != null) draft.deposit = deposit;

  const bhk =
    bhkFrom(valueBefore(all, "Apartment Type", (l) => /bhk/i.test(l))) ??
    bhkFrom(all[0]);
  if (bhk != null) draft.bhk = bhk;

  const furnished = furnishedFrom(
    valueBefore(all, "Furnishing", (l) => /furnish/i.test(l))
  );
  if (furnished) draft.furnished = furnished;

  const availableFrom = valueBefore(
    all,
    "Available From",
    (l) => /ready to move|immediate|\b\d{4}\b|\b(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)/i.test(l)
  );
  if (availableFrom) draft.availableFrom = availableFrom;

  const floor = floorFrom(all);
  if (floor) draft.floor = floor;

  const notes = noBrokerNotes(all);
  if (notes) draft.notes = notes;

  // Line 2 is the address block: "Independent House, Sector 7, Near ...".
  if (all[1] && !/^₹/.test(all[1]) && all[1] !== "Explore Nearby") {
    draft.address = all[1];
  }

  const society = noBrokerSociety(all[0]);
  if (society !== undefined) draft.society = society;

  const housingType = housingTypeFrom(`${all[0] ?? ""} ${all[1] ?? ""}`);
  if (housingType) draft.housingType = housingType;

  return draft;
}

/**
 * A listing's own page on NoBroker. Verified against a real capture 2026-09-22.
 *
 * Three layouts live in one document: the headline stats read value-then-label
 * ("₹23,500" / "Rent"), the Overview block reads label-then-value ("Facing" /
 * "West"), and Amenities is a plain list. The page also opens with site
 * navigation, so nothing here may assume a fixed line position.
 */
export const DETAIL_TAIL_MARKERS = [
  "Nearby Localities",
  "People Also Searched For",
  "Top Localities",
  "Similar Properties",
];

/**
 * Detail pages end in a long SEO tail -- "2 BHK Flats for rent in Koramangala",
 * "UnFurnished Flats for rent in Singasandra" and so on. Those lines are about
 * other listings entirely, and the generic hint extractor happily reads an area
 * and a furnishing status straight out of them. Cut them off.
 */
export function trimDetailTail(all: string[]): string[] {
  let cut = all.length;
  for (const marker of DETAIL_TAIL_MARKERS) {
    const idx = all.findIndex((l) => l.toLowerCase() === marker.toLowerCase());
    if (idx >= 0 && idx < cut) cut = idx;
  }
  return all.slice(0, cut);
}

export function parseNoBrokerDetail(capture: RawCapture): ListingDraft {
  const all = trimDetailTail(lines(capture.text));
  const draft: ListingDraft = {};

  // The title is found by shape, not position -- line 1 is a nav link.
  const titleIdx = all.findIndex((l) =>
    /^\s*[\d.]+\s*BHK\s+.+\s+For\s+(?:Rent|Lease)\s+In\b/i.test(l)
  );
  const title = titleIdx >= 0 ? all[titleIdx] : undefined;

  const rent = rentFrom(all);
  if (rent != null) draft.rent = rent;

  const depositLine = valueBefore(all, "Deposit", (l) => MONEY.test(l));
  const deposit = depositLine ? money(depositLine) : undefined;
  if (deposit != null) draft.deposit = deposit;

  const bhk =
    bhkFrom(valueBefore(all, "No. of Bedroom", (l) => /bedroom|bhk/i.test(l))) ??
    bhkFrom(title);
  if (bhk != null) draft.bhk = bhk;

  // "Bike and Car", "Car", "Bike", or "None".
  const parking = valueBefore(all, "Parking", (l) =>
    /^(?:bike|car|bike and car|car and bike|none|no)\b/i.test(l)
  );
  if (parking) {
    draft.parking = /^(?:none|no)\b/i.test(parking) ? "no" : "yes";
  }

  // Amenities is a flat list, so presence of the line is the answer.
  const hasAmenity = (name: RegExp) => all.some((l) => name.test(l));
  if (hasAmenity(/^power\s*back\s*up$/i)) draft.powerBackup = "yes";

  const furnished = furnishedFrom(valueAfter(all, "Furnishing Status"));
  if (furnished) draft.furnished = furnished;

  const floor = floorFrom(all);
  if (floor) draft.floor = floor;

  const possession = valueBefore(
    all,
    "Possession",
    (l) => /immediate|ready|\b\d{4}\b|\b(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)/i.test(l)
  );
  if (possession) draft.availableFrom = possession;

  const society = noBrokerSociety(title);
  if (society !== undefined) draft.society = society;

  // The address is the line under the title, before the price block.
  if (titleIdx >= 0 && all[titleIdx + 1] && !MONEY.test(all[titleIdx + 1])) {
    draft.address = all[titleIdx + 1];
  }

  const housingType = housingTypeFrom(
    `${title ?? ""} ${valueBefore(all, "Property Type", (l) => /apartment|flat|villa|house|independent/i.test(l)) ?? ""}`
  );
  if (housingType) draft.housingType = housingType;

  const notes = noBrokerDetailNotes(all);
  if (notes) draft.notes = notes;

  return draft;
}

/** Detail-page extras the listing schema has no field for. */
export function noBrokerDetailNotes(all: string[]): string {
  const bits: string[] = [];

  const sqft = valueBefore(all, "Sq.Ft", (l) => /^[\d,]+$/.test(l));
  if (sqft) bits.push(`Builtup ${sqft} sqft`);

  const facing = valueAfter(all, "Facing");
  if (facing && /^(north|south|east|west)/i.test(facing)) bits.push(`${facing} facing`);

  const bathroom = valueAfter(all, "Bathroom");
  if (bathroom && /^\d+$/.test(bathroom)) bits.push(`${bathroom} bathroom(s)`);

  const balcony = valueBefore(all, "Balcony", (l) => /^\d+$/.test(l));
  if (balcony) bits.push(`${balcony} balcony(s)`);

  const water = valueAfter(all, "Water Supply");
  if (water && /borewell|corporation|both/i.test(water)) bits.push(`Water: ${water}`);

  const age = valueBefore(all, "Age of Building", (l) => /year/i.test(l));
  if (age) bits.push(`Age: ${age}`);

  const tenants = valueBefore(all, "Preferred Tenant", (l) =>
    /^(family|all|anyone|bachelors?|company)$/i.test(l)
  );
  if (tenants) bits.push(`Preferred tenants: ${tenants}`);

  const amenities = [
    "Lift",
    "Gym",
    "Security",
    "Power backup",
    "Rain water harvesting",
    "Children's play area",
  ].filter((a) => all.some((l) => l.toLowerCase() === a.toLowerCase()));
  if (amenities.length) bits.push(`Amenities: ${amenities.join(", ")}`);

  return bits.join(" · ");
}

/**
 * Facebook Marketplace card: "₹20,000" / "1BHK" / "Bengaluru, KA".
 * Far less structured than NoBroker — mostly a price, a free-text title, a locality.
 */
export function parseFacebookCard(capture: RawCapture): ListingDraft {
  const all = lines(capture.text);
  const draft: ListingDraft = {};

  const priceLine = all.find((l) => MONEY.test(l));
  const rent = priceLine ? money(priceLine) : undefined;
  if (rent != null) draft.rent = rent;

  const bhk = all.map(bhkFrom).find((b) => b != null);
  if (bhk != null) draft.bhk = bhk;

  // Last line is the locality FB stamps on every card; middle lines are the title.
  const body = all.filter((l) => !MONEY.test(l) && !FB_BADGES.test(l));
  if (body.length) {
    draft.address = body[body.length - 1];
    const title = body.slice(0, -1).join(" ").trim();
    if (title) draft.society = title;
  }

  const housingType = housingTypeFrom(capture.text);
  if (housingType) draft.housingType = housingType;

  return draft;
}

export function parseCard(source: ScrapeSource, capture: RawCapture): ListingDraft {
  if (source !== "nobroker") return parseFacebookCard(capture);
  return capture.kind === "detail"
    ? parseNoBrokerDetail(capture)
    : parseNoBrokerCard(capture);
}
