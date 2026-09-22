import type { ListingDraft, Source } from "../types";

/** Sites we can harvest. Kept separate from `Source` because `Source` is a
 *  user-facing label set that also contains things we never scrape (broker). */
export const SCRAPE_SOURCES = ["nobroker", "facebook"] as const;
export type ScrapeSource = (typeof SCRAPE_SOURCES)[number];

export const SCRAPE_SOURCE_LABELS: Record<ScrapeSource, Source> = {
  nobroker: "NoBroker",
  facebook: "Facebook",
};

export const CONFIDENCES = ["high", "medium", "low"] as const;
export type Confidence = (typeof CONFIDENCES)[number];

export const SCRAPE_STATUSES = ["pending", "imported", "rejected"] as const;
export type ScrapeStatus = (typeof SCRAPE_STATUSES)[number];

/**
 * What the extension sends. Deliberately dumb: text and ids only, no parsing.
 * Parsing lives server-side so a bad regex is an app fix, not an extension reload.
 */
export type RawCapture = {
  externalId: string;
  url: string;
  text: string;
  imageUrls: string[];
  capturedAt: string;
  /** "card" is a search-result tile; "detail" is a single listing's own page. */
  kind?: "card" | "detail";
  /**
   * Coordinates, when the page exposes them. Search cards do not; detail pages
   * carry them for their map, so the extension lifts them out of the embedded
   * JSON rather than the visible text.
   */
  coords?: { lat: number; lng: number };
};

export type NormalizedCapture = {
  externalId: string;
  url: string;
  source: ScrapeSource;
  draft: ListingDraft;
  confidence: Confidence;
  /** Why it scored the way it did — shown in the review tray. */
  reasons: string[];
  filled: string[];
  missing: string[];
  capturedAt: string;
};

export type ScrapedListing = NormalizedCapture & {
  id: string;
  status: ScrapeStatus;
  raw: RawCapture;
  createdAt: string;
  updatedAt: string;
};

export function isScrapeSource(value: unknown): value is ScrapeSource {
  return (
    typeof value === "string" &&
    (SCRAPE_SOURCES as readonly string[]).includes(value)
  );
}
