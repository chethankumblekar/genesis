import { NextResponse } from "next/server";
import { checkScrapeToken, corsHeaders } from "@/lib/scrape/auth";
import { ingestCaptures } from "@/lib/scrape/scrape-repo";
import { isScrapeSource, type RawCapture } from "@/lib/scrape/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function OPTIONS(request: Request) {
  return new NextResponse(null, { status: 204, headers: corsHeaders(request) });
}

export async function POST(request: Request) {
  const cors = corsHeaders(request);

  const failure = checkScrapeToken(request);
  if (failure) {
    return NextResponse.json(
      { error: failure.error },
      { status: failure.status, headers: cors }
    );
  }

  let body: { source?: unknown; items?: unknown };
  try {
    body = (await request.json()) as { source?: unknown; items?: unknown };
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400, headers: cors });
  }

  if (!isScrapeSource(body.source)) {
    return NextResponse.json(
      { error: "Unknown source. Expected 'nobroker' or 'facebook'." },
      { status: 400, headers: cors }
    );
  }

  if (!Array.isArray(body.items) || body.items.length === 0) {
    return NextResponse.json(
      { error: "No listings found on that page." },
      { status: 400, headers: cors }
    );
  }

  try {
    const results = await ingestCaptures(body.source, body.items as RawCapture[]);
    const counts = {
      added: results.filter((r) => r.outcome === "added").length,
      updated: results.filter((r) => r.outcome === "updated").length,
      skipped: results.filter((r) => r.outcome === "skipped").length,
    };
    return NextResponse.json({ counts, results }, { headers: cors });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Could not save captures";
    const status = message.includes("DATABASE_URL") ? 503 : 500;
    return NextResponse.json({ error: message }, { status, headers: cors });
  }
}
