import { STATUS_LABELS } from "./constants";
import type { Listing, Status } from "./types";

export function formatInr(value: number | null | undefined): string {
  if (value == null || Number.isNaN(value)) return "—";
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(value);
}

export function statusLabel(status: Status): string {
  return STATUS_LABELS[status];
}

export function listingTitle(listing: Listing): string {
  return listing.society.trim() || listing.address.trim() || "Untitled listing";
}

export function isOverBudget(listing: Listing, maxRent: number): boolean {
  return listing.rent != null && listing.rent > maxRent;
}
