import type { ListingDraft } from "../types";
import type { Confidence, ScrapeSource } from "./types";

/**
 * Facebook's propertyrentals category mixes goods in with flats — a ₹600
 * "Wooden railing" sits beside a ₹20,000 1BHK. These are the giveaways.
 */
const GOODS_PATTERNS = [
  /\brailing\b/i,
  /\bsofa\b/i,
  /\bcurtain/i,
  /\bfurniture\b/i,
  /\bmattress\b/i,
  /\bwardrobe\b/i,
  /\bcupboard\b/i,
  /\bdining\s+(?:table|set)\b/i,
  /\bbed\s*(?:sheet|frame)\b/i,
  /\binterior\s+(?:work|design|decor)/i,
  /\bfalse\s+ceiling\b/i,
  /\bmodular\s+kitchen\b/i,
  /\bpackers?\s+(?:and|&)\s+movers?\b/i,
  /\bpainting\s+service/i,
];

/** Below this, a monthly "rent" in Bengaluru is almost certainly not rent. */
export const MIN_PLAUSIBLE_RENT = 5000;

export type Score = {
  confidence: Confidence;
  reasons: string[];
};

export function looksLikeGoods(text: string): boolean {
  return GOODS_PATTERNS.some((p) => p.test(text));
}

/**
 * Score, never drop. A misfiring heuristic should be recoverable from the
 * review tray, not silently eat a real listing.
 */
export function scoreCapture(
  draft: ListingDraft,
  rawText: string,
  source: ScrapeSource
): Score {
  const reasons: string[] = [];
  const hasRent = typeof draft.rent === "number" && draft.rent > 0;
  const hasBhk = typeof draft.bhk === "number" && draft.bhk > 0;
  const hasArea = Boolean(draft.area);

  if (source === "facebook" && looksLikeGoods(rawText)) {
    reasons.push("Reads like goods for sale, not a rental");
    return { confidence: "low", reasons };
  }

  if (!hasBhk && hasRent && (draft.rent as number) < MIN_PLAUSIBLE_RENT) {
    reasons.push(
      `No BHK and rent under ₹${MIN_PLAUSIBLE_RENT.toLocaleString("en-IN")}`
    );
    return { confidence: "low", reasons };
  }

  if (!hasRent && !hasBhk) {
    reasons.push("Neither rent nor BHK could be read");
    return { confidence: "low", reasons };
  }

  if (hasRent && hasBhk && hasArea) {
    reasons.push("Rent, BHK and area all read cleanly");
    return { confidence: "high", reasons };
  }

  if (!hasRent) reasons.push("Rent missing");
  if (!hasBhk) reasons.push("BHK missing");
  if (!hasArea) reasons.push("Area not recognised");
  return { confidence: "medium", reasons };
}
