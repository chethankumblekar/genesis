import type { ListingDraft } from "../types";

/**
 * What the user wants kept when harvesting a results page. Applied server-side
 * after normalization, so it runs on parsed rent/BHK rather than on a second
 * copy of the parsing rules inside the extension.
 */
export type CaptureFilter = {
  bhk?: number[];
  minRent?: number;
  maxRent?: number;
};

export type FilterVerdict = { ok: true } | { ok: false; reason: string };

function num(value: unknown): number | undefined {
  const n = typeof value === "string" ? Number(value) : (value as number);
  return typeof n === "number" && Number.isFinite(n) && n > 0 ? n : undefined;
}

/** Accepts whatever the extension sends; anything unusable is simply no filter. */
export function parseFilter(raw: unknown): CaptureFilter {
  if (!raw || typeof raw !== "object") return {};
  const r = raw as Record<string, unknown>;
  const filter: CaptureFilter = {};

  if (Array.isArray(r.bhk)) {
    const list = r.bhk.map(num).filter((n): n is number => n != null);
    if (list.length) filter.bhk = list;
  }
  const min = num(r.minRent);
  const max = num(r.maxRent);
  if (min != null) filter.minRent = min;
  if (max != null) filter.maxRent = max;
  return filter;
}

export function isEmptyFilter(filter: CaptureFilter): boolean {
  return !filter.bhk?.length && filter.minRent == null && filter.maxRent == null;
}

/**
 * A listing whose rent could not be read is NOT filtered out on price. Lease
 * listings carry no monthly rent at all, and silently dropping them would hide
 * exactly the cards that most need a human look.
 */
export function matchesFilter(
  draft: ListingDraft,
  filter: CaptureFilter
): FilterVerdict {
  if (isEmptyFilter(filter)) return { ok: true };

  if (filter.bhk?.length) {
    const bhk = draft.bhk;
    if (typeof bhk === "number" && !filter.bhk.includes(bhk)) {
      return { ok: false, reason: `${bhk} BHK not in ${filter.bhk.join("/")} BHK` };
    }
  }

  const rent = typeof draft.rent === "number" ? draft.rent : undefined;
  if (rent != null) {
    if (filter.maxRent != null && rent > filter.maxRent) {
      return {
        ok: false,
        reason: `₹${rent.toLocaleString("en-IN")} over ₹${filter.maxRent.toLocaleString("en-IN")}`,
      };
    }
    if (filter.minRent != null && rent < filter.minRent) {
      return {
        ok: false,
        reason: `₹${rent.toLocaleString("en-IN")} under ₹${filter.minRent.toLocaleString("en-IN")}`,
      };
    }
  }

  return { ok: true };
}
