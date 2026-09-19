import { NextResponse } from "next/server";
import {
  extractListingCandidates,
  fragileHostMessage,
} from "@/lib/extract-listings";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  let body: { url?: string; notes?: string };
  try {
    body = (await request.json()) as { url?: string; notes?: string };
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const url = body.url?.trim() || "";
  const notes = body.notes?.trim() || "";
  if (!url && !notes) {
    return NextResponse.json(
      { error: "Paste a listing URL or the text from a listing." },
      { status: 400 }
    );
  }

  if (url) {
    try {
      new URL(url);
    } catch {
      return NextResponse.json({ error: "That URL is not valid." }, { status: 400 });
    }
  }

  const warnings: string[] = [];
  let html = "";
  const fetchState: {
    attempted: boolean;
    ok: boolean;
    status?: number;
    skipped?: string;
  } = { attempted: false, ok: false };

  const fragile = url ? fragileHostMessage(url) : null;
  if (fragile) warnings.push(fragile.message);

  if (url && !fragile?.skip) {
    fetchState.attempted = true;
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 12000);
      const res = await fetch(url, {
        signal: controller.signal,
        redirect: "follow",
        headers: {
          "User-Agent":
            "HouseHuntingTracker/1.1 (user-initiated listing import; public HTML only)",
          Accept: "text/html,application/xhtml+xml,application/ld+json;q=0.9",
          "Accept-Language": "en-IN,en;q=0.8",
        },
      });
      clearTimeout(timer);
      fetchState.status = res.status;
      fetchState.ok = res.ok;
      if (!res.ok) {
        warnings.push(
          `The page returned ${res.status}. Paste the listing text for a reliable import.`
        );
      } else {
        html = (await res.text()).slice(0, 500_000);
      }
    } catch {
      fetchState.ok = false;
      warnings.push(
        "Could not fetch that URL. Paste rent, area, and society from the listing instead."
      );
    }
  } else if (fragile?.skip) {
    fetchState.skipped = fragile.message;
  }

  const extracted = extractListingCandidates({ html, url, notes });
  const mergedWarnings = [...warnings, ...extracted.warnings];

  return NextResponse.json({
    candidates: extracted.candidates,
    warnings: mergedWarnings,
    fetch: fetchState,
  });
}
