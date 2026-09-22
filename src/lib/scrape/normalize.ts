import { extractHints } from "../heuristics";
import type { ListingDraft } from "../types";
import { parseCard } from "./parse";
import { scoreCapture } from "./score";
import {
  SCRAPE_SOURCE_LABELS,
  type NormalizedCapture,
  type RawCapture,
  type ScrapeSource,
} from "./types";

/** Fields the review tray reports on. Order is the order they are shown. */
const REPORTED_FIELDS = [
  "rent",
  "bhk",
  "area",
  "society",
  "address",
  "deposit",
  "furnished",
  "availableFrom",
] as const;

function present(draft: ListingDraft, field: (typeof REPORTED_FIELDS)[number]) {
  const value = draft[field];
  if (value == null) return false;
  if (typeof value === "string") return value.trim() !== "";
  if (typeof value === "number") return value > 0;
  return true;
}

/**
 * Site parser first (it reads labelled fields and is far more reliable), then
 * `extractHints` fills the gaps — that is where area aliases, phone numbers and
 * society-name guessing already live, under test.
 */
export function normalizeCapture(
  source: ScrapeSource,
  capture: RawCapture
): NormalizedCapture {
  const parsed = parseCard(source, capture);
  const hints = extractHints(capture.text, capture.url);

  const draft: ListingDraft = {
    ...hints,
    ...parsed,
    source: SCRAPE_SOURCE_LABELS[source],
    url: capture.url,
    photoUrls: capture.imageUrls.filter(Boolean),
  };

  // NoBroker renders rent and deposit as labelled fields, so the site parser is
  // authoritative for them: if it declined, the figure genuinely is not there.
  // Letting `extractHints` fill the gap scrapes up maintenance charges and
  // deposits instead — a lease card would import a ₹3,000 "rent".
  if (source === "nobroker") {
    if (parsed.rent == null) delete draft.rent;
    if (parsed.deposit == null) delete draft.deposit;
  }

  // `extractHints` sets these too, but the site parser only overrides when it
  // actually found something — so re-apply the hint where the parser was silent.
  if (draft.area == null && hints.area) draft.area = hints.area;
  // An empty string from the NoBroker parser is a decision, not a gap: the
  // title genuinely names no society, so do not let the heuristic guess one.
  if (!draft.society && parsed.society !== "" && hints.society) {
    draft.society = hints.society;
  }
  if (!draft.address && hints.address) draft.address = hints.address;
  if (draft.contact == null && hints.contact) draft.contact = hints.contact;

  // Only the detail page exposes coordinates; a card capture never has them.
  const lat = capture.coords?.lat;
  const lng = capture.coords?.lng;
  if (typeof lat === "number" && typeof lng === "number") {
    draft.lat = lat;
    draft.lng = lng;
  }

  // Facebook cards carry no locality finer than "Bengaluru, KA", so `area`
  // usually cannot be read. Leaving it unset is not harmless: `emptyListing()`
  // defaults to HSR on promote, which would file a listing under an area it
  // has nothing to do with. "Nearby" is this app's honest catch-all.
  const areaResolved = draft.area != null;
  if (!areaResolved) draft.area = "Nearby";

  const { confidence, reasons } = scoreCapture(
    draft,
    capture.text,
    source,
    areaResolved
  );

  const filled: string[] = [];
  const missing: string[] = [];
  for (const field of REPORTED_FIELDS) {
    // `area` is reported as missing even though it now holds "Nearby", so the
    // review tray still asks the user to confirm where the place actually is.
    const ok = field === "area" ? areaResolved : present(draft, field);
    (ok ? filled : missing).push(field);
  }

  return {
    externalId: capture.externalId,
    url: capture.url,
    source,
    draft,
    confidence,
    reasons,
    filled,
    missing,
    capturedAt: capture.capturedAt,
  };
}
