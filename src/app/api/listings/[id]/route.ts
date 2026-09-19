import { NextResponse } from "next/server";
import { deleteListing, getListing, patchListing } from "@/lib/listings-repo";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function errorResponse(err: unknown, fallback: string) {
  const message = err instanceof Error ? err.message : fallback;
  const status = message.includes("DATABASE_URL") ? 503 : 500;
  return NextResponse.json({ error: message }, { status });
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const listing = await getListing(id);
    if (!listing) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    return NextResponse.json(listing);
  } catch (err) {
    return errorResponse(err, "Could not load listing");
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = (await request.json()) as unknown;
    const listing = await patchListing(id, body);
    if (!listing) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    return NextResponse.json(listing);
  } catch (err) {
    return errorResponse(err, "Could not update listing");
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const ok = await deleteListing(id);
    if (!ok) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    return NextResponse.json({ ok: true });
  } catch (err) {
    return errorResponse(err, "Could not delete listing");
  }
}
