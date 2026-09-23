import type { ScrapeSource } from "./types";

/**
 * Site furniture that sits in the same DOM as the listing photos: button icons,
 * logos, map markers, promo art. Observed on real captures -- a "Pay Rent"
 * button icon was being stored as a listing photograph.
 */
const CHROME = [
  /^https?:\/\/assets\.nobroker\.in\//i,
  /\/nb-new\/public\//i,
  /\/static\/img\//i,
  /\/List-Page\//i,
  /\/MaterialIcons\//i,
  /\.svg(?:$|\?)/i,
  /\/(?:logo|icon|sprite|placeholder|avatar)[^/]*$/i,
];

/** Real NoBroker listing photos live here, named after the property id. */
const NOBROKER_PHOTO = /^https?:\/\/images\.nobroker\.in\/images\//i;

/** Facebook serves Marketplace photos from its content CDN. */
const FACEBOOK_PHOTO = /^https?:\/\/[^/]*fbcdn\.net\//i;

export const MAX_PHOTOS = 8;

function isChrome(url: string): boolean {
  return CHROME.some((p) => p.test(url));
}

/**
 * Keep what is plausibly a photograph of the property. Prefers images named
 * after the listing's own id, since a results page holds every card's photos
 * and a card's DOM subtree is not always the boundary it looks like.
 */
export function filterPhotos(
  urls: unknown,
  source: ScrapeSource,
  externalId?: string
): string[] {
  if (!Array.isArray(urls)) return [];

  const clean = urls
    .filter((u): u is string => typeof u === "string" && /^https?:\/\//i.test(u))
    .filter((u) => !isChrome(u));

  const unique = [...new Set(clean)];

  if (source === "nobroker") {
    const own = externalId
      ? unique.filter((u) => u.includes(externalId))
      : [];
    const anyListing = unique.filter((u) => NOBROKER_PHOTO.test(u));
    // Its own photos first, then other listing photos, never site furniture.
    const ordered = [...own, ...anyListing.filter((u) => !own.includes(u))];
    return ordered.slice(0, MAX_PHOTOS);
  }

  return unique.filter((u) => FACEBOOK_PHOTO.test(u)).slice(0, MAX_PHOTOS);
}
