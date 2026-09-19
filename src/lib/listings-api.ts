import type { Listing, ListingDraft } from "./types";

async function readError(res: Response): Promise<string> {
  try {
    const data = (await res.json()) as { error?: string };
    if (data.error) return data.error;
  } catch {
    /* ignore */
  }
  return `Request failed (${res.status})`;
}

export async function apiListListings(): Promise<Listing[]> {
  const res = await fetch("/api/listings", { cache: "no-store" });
  if (!res.ok) throw new Error(await readError(res));
  return (await res.json()) as Listing[];
}

export async function apiUpsertListing(listing: Listing): Promise<Listing> {
  const res = await fetch("/api/listings", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(listing),
  });
  if (!res.ok) throw new Error(await readError(res));
  return (await res.json()) as Listing;
}

export async function apiPatchListing(
  id: string,
  patch: ListingDraft
): Promise<Listing> {
  const res = await fetch(`/api/listings/${encodeURIComponent(id)}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(patch),
  });
  if (!res.ok) throw new Error(await readError(res));
  return (await res.json()) as Listing;
}

export async function apiDeleteListing(id: string): Promise<void> {
  const res = await fetch(`/api/listings/${encodeURIComponent(id)}`, {
    method: "DELETE",
  });
  if (!res.ok) throw new Error(await readError(res));
}

export async function apiReplaceListings(
  listings: Listing[],
  merge = false
): Promise<Listing[]> {
  const res = await fetch("/api/listings", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ listings, merge }),
  });
  if (!res.ok) throw new Error(await readError(res));
  return (await res.json()) as Listing[];
}
