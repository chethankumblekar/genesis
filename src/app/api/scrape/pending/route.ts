import { NextResponse } from "next/server";
import { listPending } from "@/lib/scrape/scrape-repo";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    return NextResponse.json({ pending: await listPending() });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Could not load captures";
    const status = message.includes("DATABASE_URL") ? 503 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
