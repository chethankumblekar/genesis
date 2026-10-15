import { NextResponse } from "next/server";
import { rejectScraped } from "@/lib/scrape/scrape-repo";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const row = await rejectScraped(id);
    if (!row) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    return NextResponse.json({ scraped: row });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Could not reject listing";
    const status = message.includes("DATABASE_URL") ? 503 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
