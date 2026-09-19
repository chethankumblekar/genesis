import { NextResponse } from "next/server";
import { AREA_CENTERS, SOUTH_BENGALURU } from "@/lib/constants";
import { AREAS, type Area } from "@/lib/types";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q")?.trim();
  if (!q) {
    return NextResponse.json({ error: "Missing q" }, { status: 400 });
  }

  const query = `${q}, Bengaluru, India`;
  const url = new URL("https://nominatim.openstreetmap.org/search");
  url.searchParams.set("q", query);
  url.searchParams.set("format", "json");
  url.searchParams.set("limit", "1");
  url.searchParams.set("viewbox", "77.50,13.02,77.76,12.82");
  url.searchParams.set("bounded", "0");

  try {
    const res = await fetch(url.toString(), {
      headers: {
        "User-Agent": "HouseHuntingTracker/1.0 (local couple house hunt)",
        Accept: "application/json",
      },
      next: { revalidate: 0 },
    });
    if (!res.ok) {
      return NextResponse.json(
        { lat: SOUTH_BENGALURU.lat, lng: SOUTH_BENGALURU.lng, fallback: true },
        { status: 200 }
      );
    }
    const data = (await res.json()) as { lat: string; lon: string }[];
    const hit = data[0];
    if (hit) {
      return NextResponse.json({
        lat: Number(hit.lat),
        lng: Number(hit.lon),
      });
    }
    const area = AREAS.find((a) => q.toLowerCase().includes(a.toLowerCase()));
    const fallback = area ? AREA_CENTERS[area as Area] : SOUTH_BENGALURU;
    return NextResponse.json({
      lat: fallback.lat,
      lng: fallback.lng,
      fallback: true,
    });
  } catch {
    return NextResponse.json(
      { lat: SOUTH_BENGALURU.lat, lng: SOUTH_BENGALURU.lng, fallback: true },
      { status: 200 }
    );
  }
}
