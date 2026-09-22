import type { Listing, ListingDraft } from "../types";
import type { ScrapedListing } from "./types";

async function readError(res: Response): Promise<string> {
  try {
    const data = (await res.json()) as { error?: string };
    if (data.error) return data.error;
  } catch {
    /* ignore */
  }
  return `Request failed (${res.status})`;
}

export type TrayData = { pending: ScrapedListing[]; rejected: ScrapedListing[] };

export async function apiListCaptures(): Promise<TrayData> {
  const res = await fetch("/api/scrape/pending", { cache: "no-store" });
  if (!res.ok) throw new Error(await readError(res));
  const data = (await res.json()) as Partial<TrayData>;
  return { pending: data.pending ?? [], rejected: data.rejected ?? [] };
}

export async function apiPromoteScraped(
  id: string,
  edits: ListingDraft = {}
): Promise<Listing> {
  const res = await fetch(`/api/scrape/${id}/promote`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(edits),
  });
  if (!res.ok) throw new Error(await readError(res));
  const data = (await res.json()) as { listing: Listing };
  return data.listing;
}

export async function apiRejectScraped(id: string): Promise<void> {
  const res = await fetch(`/api/scrape/${id}/reject`, { method: "POST" });
  if (!res.ok) throw new Error(await readError(res));
}

export async function apiRestoreScraped(id: string): Promise<void> {
  const res = await fetch(`/api/scrape/${id}/restore`, { method: "POST" });
  if (!res.ok) throw new Error(await readError(res));
}
