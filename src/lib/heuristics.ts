import { AREAS, type Area, type Furnished, type Parking, type Source } from "./types";

const AREA_ALIASES: { area: Area; patterns: RegExp[] }[] = [
  { area: "HSR", patterns: [/\bhsr(?:\s*layout)?\b/i, /\bagara\b/i] },
  { area: "Harlur", patterns: [/\bharalur\b/i, /\bharlur\b/i] },
  { area: "Kudlu", patterns: [/\bkudlu(?:\s*gate)?\b/i] },
  {
    area: "Koramangala",
    patterns: [/\bkora?mangala\b/i, /\bkora\b/i],
  },
  { area: "BTM", patterns: [/\bbtm(?:\s*layout)?\b/i] },
  {
    area: "Nearby",
    patterns: [
      /\bbellandur\b/i,
      /\bsarjapur\b/i,
      /\belectronic\s*city\b/i,
      /\bsilk\s*board\b/i,
      /\bhosa\s*road\b/i,
      /\bbommanahalli\b/i,
      /\bjp\s*nagar\b/i,
      /\bhulimavu\b/i,
    ],
  },
];

export type ExtractedHints = {
  rent?: number;
  deposit?: number;
  bhk?: number;
  area?: Area;
  society?: string;
  parking?: Parking;
  furnished?: Furnished;
  source?: Source;
  url?: string;
  photoUrls?: string[];
  notes?: string;
};

export function sourceFromUrl(url: string): Source | undefined {
  try {
    const host = new URL(url).hostname.replace(/^www\./, "");
    if (host.includes("nobroker")) return "NoBroker";
    if (host.includes("facebook") || host.includes("fb.com")) return "Facebook";
    if (host.includes("housing")) return "Housing";
    if (host.includes("99acres")) return "99acres";
  } catch {
    return undefined;
  }
  return "other";
}

function parseMoney(raw: string): number | undefined {
  const cleaned = raw.replace(/[, ]/g, "");
  const n = Number(cleaned);
  if (!Number.isFinite(n) || n <= 0) return undefined;
  if (n < 100) return Math.round(n * 1000);
  return Math.round(n);
}

export function extractHints(text: string, url?: string): ExtractedHints {
  const hints: ExtractedHints = {};
  const blob = text.replace(/\s+/g, " ").trim();
  if (!blob && !url) return hints;

  const rentMatch =
    blob.match(
      /(?:₹|rs\.?|inr)\s*([0-9]{1,2}(?:[,\s]?[0-9]{2,3})+|[0-9]{4,6}|[0-9]{1,2}(?:\.\d)?\s*k)/i
    ) ||
    blob.match(
      /(?:rent(?:al)?|pcm|per month|\/mo|\/month|pm)\D{0,12}(?:₹|rs\.?)?\s*([0-9]{1,2}[,\d]{2,6}|[0-9]{1,2}(?:\.\d)?\s*k)/i
    ) ||
    blob.match(/\b([0-9]{1,2}(?:\.\d)?)\s*k(?:\/mo|\/month|\s*rent)?\b/i);

  if (rentMatch?.[1]) {
    const token = rentMatch[1].toLowerCase().includes("k")
      ? String(Number(rentMatch[1].toLowerCase().replace("k", "").trim()) * 1000)
      : rentMatch[1];
    hints.rent = parseMoney(token);
  }

  const depositMatch = blob.match(
    /(?:deposit|advance|security)\D{0,12}(?:₹|rs\.?)?\s*([0-9]{1,3}(?:[,\s]?[0-9]{2,3})+|[0-9]{4,7}|[0-9]{1,3}\s*k)/i
  );
  if (depositMatch?.[1]) {
    const token = depositMatch[1].toLowerCase().includes("k")
      ? String(Number(depositMatch[1].toLowerCase().replace(/k/i, "").trim()) * 1000)
      : depositMatch[1];
    hints.deposit = parseMoney(token);
  }

  const bhkMatch = blob.match(/(\d(?:\.\d)?)\s*-?\s*bhk/i);
  if (bhkMatch) hints.bhk = Number(bhkMatch[1]);

  for (const { area, patterns } of AREA_ALIASES) {
    if (patterns.some((p) => p.test(blob))) {
      hints.area = area;
      break;
    }
  }
  if (!hints.area) {
    const exact = AREAS.find((a) => blob.toLowerCase().includes(a.toLowerCase()));
    if (exact) hints.area = exact;
  }

  if (/\bno\s+parking\b|\bwithout\s+parking\b/i.test(blob)) {
    hints.parking = "no";
  } else if (/\b(?:car\s+)?parking\b|\b2[\s-]?wheeler\b|\b4[\s-]?wheeler\b/i.test(blob)) {
    hints.parking = "yes";
  }

  if (/\bunfurnished\b/i.test(blob)) hints.furnished = "unfurnished";
  else if (/\bsemi[-\s]?furnished\b/i.test(blob)) hints.furnished = "semi";
  else if (/\b(?:fully\s+)?furnished\b/i.test(blob)) hints.furnished = "fully";

  const skipSociety = new Set(AREAS.map((a) => a.toLowerCase()));
  const properName = blob.match(
    /\b([A-Z]{2,}(?:\s+[A-Z][a-zA-Z]+){1,4}|\b[A-Z][a-z]+(?:\s+[A-Z][a-zA-Z]+){1,4}\s+(?:Apartment|Apartments|Residency|Enclave|Homes|Villas?|Society|Layout|Gate))\b/
  );
  if (properName?.[1] && !skipSociety.has(properName[1].toLowerCase())) {
    hints.society = properName[1].trim();
  } else {
    const societyMatch =
      blob.match(
        /\b(?:in|at)\s+([A-Z][A-Za-z0-9 .'&-]{2,40}(?:apartment|apartments|residency|enclave|layout|society|homes|villa|villas|gate)?)/
      ) || blob.match(/^(.{8,60}?)(?:\s[-–|:]|\s+in\s+)/);
    if (
      societyMatch?.[1] &&
      societyMatch[1].length < 60 &&
      !skipSociety.has(societyMatch[1].trim().toLowerCase())
    ) {
      hints.society = societyMatch[1].trim();
    }
  }

  if (url) {
    hints.url = url;
    hints.source = sourceFromUrl(url);
  }

  return hints;
}

export function extractOpenGraph(html: string): {
  title?: string;
  description?: string;
  image?: string;
} {
  const attr = (prop: string) => {
    const escaped = prop.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const a = html.match(
      new RegExp(
        `<meta[^>]+(?:property|name)=['"]${escaped}['"][^>]+content=['"]([^'"]+)['"]`,
        "i"
      )
    );
    if (a?.[1]) return decodeHtml(a[1]);
    const b = html.match(
      new RegExp(
        `<meta[^>]+content=['"]([^'"]+)['"][^>]+(?:property|name)=['"]${escaped}['"]`,
        "i"
      )
    );
    return b?.[1] ? decodeHtml(b[1]) : undefined;
  };

  const titleTag = html.match(/<title[^>]*>([^<]+)<\/title>/i)?.[1];
  return {
    title: attr("og:title") || attr("twitter:title") || (titleTag ? decodeHtml(titleTag) : undefined),
    description:
      attr("og:description") ||
      attr("twitter:description") ||
      attr("description"),
    image: attr("og:image") || attr("twitter:image"),
  };
}

function decodeHtml(value: string): string {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\s+/g, " ")
    .trim();
}
