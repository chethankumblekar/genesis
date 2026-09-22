import { NextResponse } from "next/server";
import { restoreScraped } from "@/lib/scrape/scrape-repo";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const row = await restoreScraped(id);
    if (!row) {
      return NextResponse.json(
        { error: "Not found, or not rejected" },
        { status: 404 }
      );
    }
    return NextResponse.json({ scraped: row });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Could not restore listing";
    const status = message.includes("DATABASE_URL") ? 503 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
