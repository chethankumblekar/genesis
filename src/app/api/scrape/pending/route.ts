import { NextResponse } from "next/server";
import { listPending, listRejected } from "@/lib/scrape/scrape-repo";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const [pending, rejected] = await Promise.all([listPending(), listRejected()]);
    return NextResponse.json({ pending, rejected });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Could not load captures";
    const status = message.includes("DATABASE_URL") ? 503 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
