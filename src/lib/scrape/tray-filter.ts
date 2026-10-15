import type { ScrapedListing } from "./types";
import type {
  Area,
  Furnished,
  HousingType,
  ListingDraft,
} from "../types";
import type { Confidence, ScrapeSource } from "./types";

export type TrayFilter = {
  q: string;
  bhk: number[];
  minRent: string;
  maxRent: string;
  maxDeposit: string;
  area: Area | "all";
  source: ScrapeSource | "all";
  furnished: Furnished | "all";
  housingType: HousingType | "all";
  confidence: Confidence | "all";
  sort: "captured" | "rentAsc" | "rentDesc";
};

export const EMPTY_FILTER: TrayFilter = {
  q: "",
  bhk: [],
  minRent: "",
  maxRent: "",
  maxDeposit: "",
  area: "all",
  source: "all",
  furnished: "all",
  housingType: "all",
  confidence: "all",
  sort: "captured",
};

function positive(value: string): number | null {
  const n = Number(value.trim());
  return value.trim() && Number.isFinite(n) && n > 0 ? n : null;
}

/** How many filters are narrowing the list, for the collapsed summary. */
export function activeCount(f: TrayFilter): number {
  return [
    f.q.trim() !== "",
    f.bhk.length > 0,
    positive(f.minRent) != null,
    positive(f.maxRent) != null,
    positive(f.maxDeposit) != null,
    f.area !== "all",
    f.source !== "all",
    f.furnished !== "all",
    f.housingType !== "all",
    f.confidence !== "all",
  ].filter(Boolean).length;
}

/**
 * Narrows the list on screen only -- nothing is discarded, so clearing brings
 * every capture back. A listing whose rent or deposit could not be read is
 * never hidden by a price filter: leases carry no monthly rent, and those are
 * exactly the ones worth a human look.
 */
export function matchesTrayFilter(row: ScrapedListing, f: TrayFilter): boolean {
  const draft = row.draft as ListingDraft;

  const q = f.q.trim().toLowerCase();
  if (q) {
    const haystack = [draft.society, draft.address, draft.notes, draft.url]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();
    if (!haystack.includes(q)) return false;
  }

  if (f.bhk.length) {
    if (typeof draft.bhk !== "number" || !f.bhk.includes(draft.bhk)) return false;
  }

  const max = positive(f.maxRent);
  const min = positive(f.minRent);
  if (typeof draft.rent === "number") {
    if (max != null && draft.rent > max) return false;
    if (min != null && draft.rent < min) return false;
  }

  const maxDep = positive(f.maxDeposit);
  if (maxDep != null && typeof draft.deposit === "number" && draft.deposit > maxDep) {
    return false;
  }

  if (f.area !== "all" && draft.area !== f.area) return false;
  if (f.source !== "all" && row.source !== f.source) return false;
  if (f.confidence !== "all" && row.confidence !== f.confidence) return false;
  if (f.furnished !== "all" && draft.furnished !== f.furnished) return false;
  if (f.housingType !== "all" && draft.housingType !== f.housingType) return false;

  return true;
}

export function sortRows(rows: ScrapedListing[], sort: TrayFilter["sort"]) {
  if (sort === "captured") return rows;
  const rent = (r: ScrapedListing) => (r.draft as ListingDraft).rent;
  return [...rows].sort((a, b) => {
    const ra = rent(a);
    const rb = rent(b);
    // Unreadable rents sink to the bottom rather than sorting as zero.
    if (ra == null && rb == null) return 0;
    if (ra == null) return 1;
    if (rb == null) return -1;
    return sort === "rentAsc" ? ra - rb : rb - ra;
  });
}
