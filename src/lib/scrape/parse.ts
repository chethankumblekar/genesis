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
  const idx = all.findIndex((line) => line.toLowerCase() === label.toLowerCase());
  if (idx < 0) return undefined;
  for (let i = idx - 1; i >= 0; i--) {
    if (matches(all[i])) return all[i];
  }
  return undefined;
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
  const idx = all.findIndex((line) => line.toLowerCase() === "rent");
  if (idx < 0) return undefined;

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
  return undefined;
}

export function furnishedFrom(line: string | undefined): Furnished | undefined {
  if (!line) return undefined;
  if (/\bunfurnished\b/i.test(line)) return "unfurnished";
  if (/\bsemi[-\s]?furnished\b/i.test(line)) return "semi";
  if (/\bfully[-\s]?furnished\b|\bfurnished\b/i.test(line)) return "fully";
  return undefined;
}

export function housingTypeFrom(text: string): HousingType | undefined {
  if (/\bservice[d]?\s+apartment\b/i.test(text)) return "service_apartment";
  if (/\bgated\b|\bsociety\b/i.test(text)) return "gated_society";
  if (/\bapartment\b|\bflat\b/i.test(text)) return "apartment";
  return undefined;
}

function bhkFrom(line: string | undefined): number | undefined {
  if (!line) return undefined;
  const m = line.match(/(\d(?:\.\d)?)\s*-?\s*bhk/i);
  return m ? Number(m[1]) : undefined;
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

  const floor = valueBefore(all, "Floor", (l) => /floor|ground|\d/i.test(l));
  if (floor) draft.floor = floor;

  // Line 2 is the address block: "Independent House, Sector 7, Near ...".
  if (all[1] && !/^₹/.test(all[1]) && all[1] !== "Explore Nearby") {
    draft.address = all[1];
  }

  const housingType = housingTypeFrom(`${all[0] ?? ""} ${all[1] ?? ""}`);
  if (housingType) draft.housingType = housingType;

  return draft;
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
  const body = all.filter((l) => !MONEY.test(l));
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
  return source === "nobroker"
    ? parseNoBrokerCard(capture)
    : parseFacebookCard(capture);
}
