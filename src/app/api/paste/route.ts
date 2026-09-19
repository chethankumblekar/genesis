import { NextResponse } from "next/server";
import { extractHints, extractOpenGraph } from "@/lib/heuristics";

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
      { error: "Paste a listing URL or some notes." },
      { status: 400 }
    );
  }

  const warnings: string[] = [];
  let og: { title?: string; description?: string; image?: string } = {};

  if (url) {
    try {
      new URL(url);
    } catch {
      return NextResponse.json({ error: "That URL is not valid." }, { status: 400 });
    }

    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 8000);
      const res = await fetch(url, {
        signal: controller.signal,
        redirect: "follow",
        headers: {
          "User-Agent":
            "HouseHuntingTracker/1.0 (Open Graph metadata only; no listing scrape)",
          Accept: "text/html,application/xhtml+xml",
        },
      });
      clearTimeout(timer);
      if (!res.ok) {
        warnings.push(
          `Could not read public metadata (${res.status}). Fill the form by hand.`
        );
      } else {
        const html = await res.text();
        og = extractOpenGraph(html.slice(0, 250_000));
        if (!og.title && !og.description) {
          warnings.push(
            "No Open Graph tags found. Many Facebook and NoBroker pages block this — paste notes instead."
          );
        }
      }
    } catch {
      warnings.push(
        "This site blocked a metadata fetch. Paste title/rent/area into notes and try again, or fill the form manually."
      );
    }
  }

  const combined = [og.title, og.description, notes].filter(Boolean).join("\n");
  const hints = extractHints(combined, url || undefined);
  if (!hints.society && og.title) hints.society = og.title.slice(0, 80);
  if (og.image) hints.photoUrls = [og.image];
  if (notes) hints.notes = notes;

  return NextResponse.json({ og, hints, warnings });
}
