import {
  type Area,
  type Furnished,
  type HousingType,
  type ListingDraft,
  type Parking,
  type Source,
} from "./types";
import { extractHints, extractOpenGraph, sourceFromUrl } from "./heuristics";

export type ListingCandidate = {
  id: string;
  label: string;
  origin: "json-ld" | "page-json" | "open-graph" | "page-text" | "notes";
  confidence: number;
  filled: string[];
  missing: string[];
  hints: ReturnType<typeof extractHints> & {
    address?: string;
    housingType?: HousingType;
    contact?: string;
    lat?: number;
    lng?: number;
  };
};

export type ExtractResponse = {
  candidates: ListingCandidate[];
  warnings: string[];
  fetch: {
    attempted: boolean;
    ok: boolean;
    status?: number;
    skipped?: string;
  };
};

const FRAGILE_HOSTS: { test: RegExp; message: string; skip: boolean }[] = [
  {
    test: /(^|\.)(facebook\.com|fb\.com|instagram\.com)$/i,
    message:
      "Facebook and Instagram block public fetches. Paste the listing text (rent, area, society) below instead.",
    skip: true,
  },
  {
    test: /(^|\.)nobroker\.in$/i,
    message:
      "NoBroker often blocks automated reads. If this fails, paste the listing text from the app.",
    skip: false,
  },
];

function hostOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
}

function decodeHtml(value: string): string {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/\s+/g, " ")
    .trim();
}

export function htmlToText(html: string): string {
  return decodeHtml(
    html
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
      .replace(/<[^>]+>/g, " ")
      .replace(/&nbsp;/gi, " ")
  );
}

function parseJsonLdBlocks(html: string): unknown[] {
  const blocks: unknown[] = [];
  const re =
    /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let match: RegExpExecArray | null;
  while ((match = re.exec(html))) {
    const raw = match[1]?.trim();
    if (!raw) continue;
    try {
      blocks.push(JSON.parse(raw));
    } catch {
      try {
        blocks.push(JSON.parse(raw.replace(/,\s*([}\]])/g, "$1")));
      } catch {
        /* ignore broken ld+json */
      }
    }
  }
  return blocks;
}

function walk(value: unknown, visit: (obj: Record<string, unknown>) => void, depth = 0) {
  if (depth > 8 || value == null) return;
  if (Array.isArray(value)) {
    value.slice(0, 40).forEach((item) => walk(item, visit, depth + 1));
    return;
  }
  if (typeof value !== "object") return;
  const obj = value as Record<string, unknown>;
  visit(obj);
  for (const nested of Object.values(obj).slice(0, 40)) {
    walk(nested, visit, depth + 1);
  }
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function pickString(...values: unknown[]): string | undefined {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) return decodeHtml(value.trim());
    if (value && typeof value === "object") {
      const rec = value as Record<string, unknown>;
      if (typeof rec.name === "string" && rec.name.trim()) return rec.name.trim();
      if (typeof rec["@value"] === "string") return rec["@value"];
    }
  }
  return undefined;
}

function pickMoney(...values: unknown[]): number | undefined {
  for (const value of values) {
    if (typeof value === "number" && Number.isFinite(value) && value > 0) {
      if (value >= 8 && value < 100) return Math.round(value * 1000);
      if (value >= 100) return Math.round(value);
      continue;
    }
    if (typeof value === "string") {
      const cleaned = value.replace(/[₹,\s]/g, "").replace(/rs\.?/i, "");
      if (/k$/i.test(cleaned)) {
        const n = Number(cleaned.replace(/k$/i, ""));
        if (Number.isFinite(n) && n > 0) return Math.round(n * 1000);
      }
      const n = Number(cleaned);
      if (Number.isFinite(n) && n > 0) {
        if (n >= 8 && n < 100) return Math.round(n * 1000);
        if (n >= 100) return Math.round(n);
      }
    }
    const rec = asRecord(value);
    if (rec) {
      const nested = pickMoney(rec.value, rec.price, rec.amount, rec.minPrice);
      if (nested) return nested;
    }
  }
  return undefined;
}

function pickCount(...values: unknown[]): number | undefined {
  for (const value of values) {
    if (typeof value === "number" && Number.isFinite(value) && value > 0 && value <= 20) {
      return value;
    }
    if (typeof value === "string") {
      const n = Number(value.replace(/[^\d.]/g, ""));
      if (Number.isFinite(n) && n > 0 && n <= 20) return n;
    }
  }
  return undefined;
}

function pickCoord(...values: unknown[]): number | undefined {
  for (const value of values) {
    if (typeof value === "number" && Number.isFinite(value) && Math.abs(value) <= 180) {
      return value;
    }
    if (typeof value === "string") {
      const n = Number(value.trim());
      if (Number.isFinite(n) && n !== 0 && Math.abs(n) <= 180) return n;
    }
    const rec = asRecord(value);
    if (rec) {
      const nested = pickCoord(rec.value, rec["@value"]);
      if (nested != null) return nested;
    }
  }
  return undefined;
}

export const CANDIDATE_ORIGIN_LABELS: Record<ListingCandidate["origin"], string> = {
  "json-ld": "Structured data",
  "page-json": "Page data",
  "open-graph": "Page preview",
  "page-text": "Page text",
  notes: "Your notes",
};

function housingFromText(text: string | undefined): HousingType | undefined {
  if (!text) return undefined;
  if (/service\s*apartment|serviced/i.test(text)) return "service_apartment";
  if (/gated|society|villa|enclave/i.test(text)) return "gated_society";
  if (/apartment|flat|builder/i.test(text)) return "apartment";
  return undefined;
}

function geoFrom(obj: Record<string, unknown>): { lat?: number; lng?: number } {
  const geo = asRecord(obj.geo) || asRecord(obj.location);
  const lat = pickCoord(
    obj.latitude,
    obj.lat,
    geo?.latitude,
    geo?.lat,
    asRecord(geo?.geo)?.latitude
  );
  const lng = pickCoord(
    obj.longitude,
    obj.lng,
    obj.lon,
    geo?.longitude,
    geo?.lng,
    asRecord(geo?.geo)?.longitude
  );
  return { lat, lng };
}

function societyFromTitle(title: string | undefined): string | undefined {
  if (!title) return undefined;
  const cleaned = title.replace(/\s+/g, " ").trim();
  const inMatch = cleaned.match(/\bin\s+([^,|–-]{3,50})/i);
  if (inMatch?.[1]) {
    const name = inMatch[1].replace(/\s+(bangalore|bengaluru|karnataka|india)\s*$/i, "").trim();
    if (
      name.length >= 3 &&
      !/^(hsr|harlur|kudlu|koramangala|btm)(\s+layout)?$/i.test(name)
    ) {
      return name.slice(0, 80);
    }
  }
  if (/\bbhk\b|for rent|rent in|apartment for/i.test(cleaned)) return undefined;
  return cleaned.slice(0, 80);
}

function draftFromObject(obj: Record<string, unknown>, url?: string) {
  const offer = asRecord(obj.offers) || obj;
  const address =
    pickString(
      obj.address,
      asRecord(obj.address)?.streetAddress,
      asRecord(obj.address)?.addressLocality,
      obj.locality,
      obj.localityName,
      obj.location,
      obj.area,
      obj.suburb
    ) || "";
  const title = pickString(
    obj.name,
    obj.title,
    obj.propertyTitle,
    obj.projectName,
    obj.society,
    obj.buildingName,
    obj.headline
  );
  const description = pickString(obj.description, obj.summary, obj.overview);
  const blob = [title, description, address, JSON.stringify(obj).slice(0, 4000)].join("\n");
  const hints = extractHints(blob, url);
  const rent =
    pickMoney(
      obj.rent,
      obj.monthlyRent,
      obj.price,
      obj.minPrice,
      offer.price,
      asRecord(obj.priceSpecification)?.price
    ) ?? hints.rent;
  const bhk =
    pickCount(obj.bhk, obj.bedrooms, obj.numberOfBedrooms, obj.bedroom) ?? hints.bhk;
  const photos = [
    pickString(obj.image, asRecord(obj.image)?.url, obj.photo, obj.thumbnail),
    ...(Array.isArray(obj.image)
      ? obj.image.map((img) => pickString(img, asRecord(img)?.url)).filter(Boolean)
      : []),
  ].filter((p): p is string => Boolean(p));
  const { lat, lng } = geoFrom(obj);
  const contact =
    pickString(
      obj.telephone,
      obj.phone,
      obj.contact,
      asRecord(obj.broker)?.telephone
    ) || hints.contact;
  return {
    ...hints,
    society: hints.society || societyFromTitle(title) || undefined,
    address: hints.address || address || undefined,
    rent: rent ?? hints.rent,
    bhk: bhk ?? hints.bhk,
    photoUrls: photos.length ? photos.slice(0, 6) : hints.photoUrls,
    housingType: housingFromText([title, description, blob].join(" ")),
    contact,
    lat,
    lng,
    notes: description,
    url: pickString(obj.url) || url,
    source: url ? sourceFromUrl(url) : hints.source,
  };
}

function looksLikeListing(obj: Record<string, unknown>): boolean {
  const keys = Object.keys(obj).join(" ").toLowerCase();
  const hasRent = /rent|price|amount/.test(keys);
  const hasHome = /bhk|bedroom|society|locality|apartment|property|flat/.test(keys);
  return hasRent && hasHome;
}

function filledFields(hints: ListingCandidate["hints"]): string[] {
  const fields: [string, unknown][] = [
    ["society", hints.society],
    ["rent", hints.rent],
    ["deposit", hints.deposit],
    ["bhk", hints.bhk],
    ["area", hints.area],
    ["parking", hints.parking],
    ["furnished", hints.furnished],
    ["address", hints.address],
    ["photo", hints.photoUrls?.[0]],
    ["contact", hints.contact],
  ];
  return fields.filter(([, v]) => v != null && v !== "").map(([k]) => k);
}

function missingFields(filled: string[]): string[] {
  return ["society", "rent", "area", "bhk", "parking"].filter((k) => !filled.includes(k));
}

function confidence(origin: ListingCandidate["origin"], filled: string[]): number {
  const base =
    origin === "json-ld" ? 28 : origin === "page-json" ? 18 : origin === "open-graph" ? 12 : 8;
  const points: Record<string, number> = {
    rent: 22,
    area: 18,
    bhk: 14,
    society: 14,
    parking: 6,
    deposit: 6,
    photo: 5,
    address: 5,
    furnished: 4,
    contact: 4,
  };
  const score = filled.reduce((sum, key) => sum + (points[key] ?? 0), base);
  return Math.max(8, Math.min(98, score));
}

function candidateLabel(hints: ListingCandidate["hints"]): string {
  const bits = [
    hints.bhk ? `${hints.bhk} BHK` : null,
    hints.area,
    hints.rent ? `₹${hints.rent.toLocaleString("en-IN")}` : null,
  ].filter(Boolean);
  const title = hints.society || hints.address || "Listing";
  return bits.length ? `${title} · ${bits.join(" · ")}` : title;
}

function toCandidate(
  hints: ListingCandidate["hints"],
  origin: ListingCandidate["origin"],
  id: string
): ListingCandidate | null {
  const filled = filledFields(hints);
  if (filled.length < 2) return null;
  return {
    id,
    label: candidateLabel(hints),
    origin,
    confidence: confidence(origin, filled),
    filled,
    missing: missingFields(filled),
    hints,
  };
}

function dedupe(candidates: ListingCandidate[]): ListingCandidate[] {
  const seen = new Set<string>();
  const out: ListingCandidate[] = [];
  for (const item of candidates.sort((a, b) => b.confidence - a.confidence)) {
    const key = [
      item.hints.society?.toLowerCase() || "",
      item.hints.rent ?? "",
      item.hints.area ?? "",
      item.hints.bhk ?? "",
      item.hints.address?.toLowerCase().slice(0, 40) || "",
    ].join("|");
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(item);
  }
  return out.slice(0, 8);
}

function splitNoteBlocks(notes: string): string[] {
  const trimmed = notes.trim();
  if (!trimmed) return [];
  const byRule = trimmed
    .split(/\n\s*(?:-{3,}|={3,}|\*{3,})\s*\n/)
    .map((s) => s.trim())
    .filter(Boolean);
  if (byRule.length > 1) return byRule;
  const numbered = trimmed
    .split(/\n\s*(?:\d+[).]|Listing\s*\d+:)\s+/i)
    .map((s) => s.trim())
    .filter((s) => s.length > 24);
  if (numbered.length > 1) return numbered;
  const bhkChunks = trimmed
    .split(/(?=\b\d\s*BHK\b)/i)
    .map((s) => s.trim())
    .filter((s) => s.length > 24);
  return bhkChunks.length > 1 ? bhkChunks : [trimmed];
}

export function extractListingCandidates(input: {
  html?: string;
  url?: string;
  notes?: string;
}): ExtractResponse {
  const html = input.html || "";
  const url = input.url || "";
  const notes = input.notes || "";
  const warnings: string[] = [];
  const raw: ListingCandidate[] = [];
  let n = 0;
  const push = (
    hints: ListingCandidate["hints"],
    origin: ListingCandidate["origin"]
  ) => {
    const item = toCandidate(hints, origin, `c${++n}`);
    if (item) raw.push(item);
  };

  if (html) {
    for (const block of parseJsonLdBlocks(html)) {
      walk(block, (obj) => {
        const type = String(obj["@type"] || obj.type || "");
        if (
          /ItemList|OfferCatalog/i.test(type) &&
          Array.isArray(obj.itemListElement)
        ) {
          obj.itemListElement.forEach((el) => {
            const rec = asRecord(el) || asRecord(asRecord(el)?.item);
            if (rec) push(draftFromObject(rec, url), "json-ld");
          });
          return;
        }
        if (
          /RealEstateListing|Apartment|Residence|House|Accommodation|Offer|Product/i.test(
            type
          ) ||
          looksLikeListing(obj)
        ) {
          push(draftFromObject(obj, url), "json-ld");
        }
      });
    }

    const nextData = html.match(
      /<script[^>]*id=["']__NEXT_DATA__["'][^>]*>([\s\S]*?)<\/script>/i
    );
    if (nextData?.[1]) {
      try {
        walk(JSON.parse(nextData[1]) as unknown, (obj) => {
          if (looksLikeListing(obj)) push(draftFromObject(obj, url), "page-json");
        });
      } catch {
        /* ignore */
      }
    }

    const jsonScripts =
      /<script[^>]*type=["']application\/json["'][^>]*>([\s\S]*?)<\/script>/gi;
    let jsonMatch: RegExpExecArray | null;
    while ((jsonMatch = jsonScripts.exec(html))) {
      const raw = jsonMatch[1]?.trim();
      if (!raw || raw === nextData?.[1]?.trim()) continue;
      try {
        walk(JSON.parse(raw) as unknown, (obj) => {
          if (looksLikeListing(obj)) push(draftFromObject(obj, url), "page-json");
        });
      } catch {
        /* ignore */
      }
    }

    const og = extractOpenGraph(html);
    const pageText = htmlToText(html).slice(0, 20_000);
    const ogHints = extractHints(
      [og.title, og.description, pageText.slice(0, 4000), notes].filter(Boolean).join("\n"),
      url || undefined
    );
    const ogSociety = societyFromTitle(og.title);
    if (ogSociety && !ogHints.society) ogHints.society = ogSociety;
    if (og.image) ogHints.photoUrls = [og.image, ...(ogHints.photoUrls || [])];
    if (notes) ogHints.notes = notes;
    push(ogHints, og.title || og.description ? "open-graph" : "page-text");
  }

  for (const block of splitNoteBlocks(notes)) {
    const hints = extractHints(block, url || undefined);
    hints.notes = block;
    if (url) hints.url = url;
    push(hints, "notes");
  }

  const candidates = dedupe(raw);
  if (!candidates.length && (notes || html)) {
    warnings.push(
      "Could not guess a listing from this. Add rent, area, and society in the notes box."
    );
  }
  return {
    candidates,
    warnings,
    fetch: { attempted: false, ok: false },
  };
}

export function candidateToDraft(candidate: ListingCandidate): ListingDraft {
  const h = candidate.hints;
  return {
    society: h.society || "",
    address: h.address || "",
    notes: h.notes || "",
    rent: h.rent ?? null,
    deposit: h.deposit ?? null,
    bhk: h.bhk ?? 2,
    area: h.area,
    parking: h.parking,
    furnished: h.furnished,
    source: h.source,
    url: h.url || "",
    photoUrls: h.photoUrls,
    housingType: h.housingType,
    contact: h.contact || "",
    lat: h.lat ?? null,
    lng: h.lng ?? null,
    status: "new",
  };
}

export function fragileHostMessage(url: string): { skip: boolean; message: string } | null {
  const host = hostOf(url);
  if (!host) return null;
  const hit = FRAGILE_HOSTS.find((h) => h.test.test(host));
  return hit ? { skip: hit.skip, message: hit.message } : null;
}

export { extractHints, sourceFromUrl };
export type { Area, Furnished, Parking, Source };
