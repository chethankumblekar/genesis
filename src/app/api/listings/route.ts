import { NextResponse } from "next/server";
import {
  listListings,
  normalizeListing,
  replaceListings,
  upsertListing,
} from "@/lib/listings-repo";
import { mergeListings } from "@/lib/storage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function errorResponse(err: unknown, fallback: string) {
  const message = err instanceof Error ? err.message : fallback;
  const status = message.includes("DATABASE_URL") ? 503 : 500;
  return NextResponse.json({ error: message }, { status });
}

export async function GET() {
  try {
    const listings = await listListings();
    return NextResponse.json(listings);
  } catch (err) {
    return errorResponse(err, "Could not load listings");
  }
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as unknown;
    const listing = await upsertListing(body);
    return NextResponse.json(listing);
  } catch (err) {
    return errorResponse(err, "Could not save listing");
  }
}

export async function PUT(request: Request) {
  try {
    const body: unknown = await request.json();
    const incoming = Array.isArray(body)
      ? body
      : body &&
          typeof body === "object" &&
          Array.isArray((body as { listings?: unknown }).listings)
        ? (body as { listings: unknown[] }).listings
        : null;
    if (!incoming) {
      return NextResponse.json(
        { error: "Body must be a listing array or { listings }" },
        { status: 400 }
      );
    }
    const merge =
      Boolean(body) &&
      typeof body === "object" &&
      !Array.isArray(body) &&
      (body as { merge?: boolean }).merge === true;
    const parsed = incoming.map(normalizeListing);
    const next = merge ? mergeListings(await listListings(), parsed) : parsed;
    const listings = await replaceListings(next);
    return NextResponse.json(listings);
  } catch (err) {
    return errorResponse(err, "Could not import listings");
  }
}
