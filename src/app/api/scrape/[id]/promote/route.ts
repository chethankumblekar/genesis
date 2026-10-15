import { NextResponse } from "next/server";
import { promoteScraped } from "@/lib/scrape/scrape-repo";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    let edits: Record<string, unknown> = {};
    try {
      const body = (await request.json()) as unknown;
      if (body && typeof body === "object") edits = body as Record<string, unknown>;
    } catch {
      // No body is fine: promote the draft exactly as captured.
    }

    const listing = await promoteScraped(id, edits);
    if (!listing) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    return NextResponse.json({ listing });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Could not import listing";
    const status = message.includes("DATABASE_URL") ? 503 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
