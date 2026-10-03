"use client";

import { useEffect, useRef, useState } from "react";
import type { Map as LeafletMap, Marker as LeafletMarker } from "leaflet";
import {
  AREA_CENTERS,
  HOUSING_TYPE_LABELS,
  PARKING_LABELS,
  KCDC,
  SOUTH_BENGALURU,
  STATUS_COLORS,
  STATUS_LABELS,
} from "@/lib/constants";
import { formatInr, listingTitle } from "@/lib/format";
import { mapPositions } from "@/lib/map-position";
import { STATUSES, type Area, type Listing } from "@/lib/types";

export function ListingMap({
  listings,
  focusId,
  focusArea,
  onEdit,
}: {
  listings: Listing[];
  focusId: string | null;
  focusArea: Area | null;
  onEdit: (listing: Listing) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<LeafletMap | null>(null);
  const markersRef = useRef<LeafletMarker[]>([]);
  const onEditRef = useRef(onEdit);
  const [mapReady, setMapReady] = useState(0);
  const [mapError, setMapError] = useState<string | null>(null);

  useEffect(() => {
    onEditRef.current = onEdit;
  }, [onEdit]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    let cancelled = false;

    void (async () => {
      try {
        const leafletMod = await import("leaflet");
        const L = (leafletMod.default ?? leafletMod) as typeof import("leaflet");
        if (cancelled || mapRef.current || !el.isConnected) return;
        const map = L.map(el, { scrollWheelZoom: true }).setView(
          [SOUTH_BENGALURU.lat, SOUTH_BENGALURU.lng],
          13
        );
        L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: "&copy; OpenStreetMap",
      }).addTo(map);
        L.circle([KCDC.lat, KCDC.lng], {
          radius: KCDC.radiusM,
          color: "#e3a805",
          weight: 2,
          opacity: 0.9,
          fillColor: "#e3a805",
          fillOpacity: 0.1,
          interactive: false,
        }).addTo(map);
        mapRef.current = map;
        setMapError(null);
        setMapReady((n) => n + 1);
        requestAnimationFrame(() => map.invalidateSize());
      } catch (err) {
        setMapError(err instanceof Error ? err.message : "Map failed to load");
      }
    })();

    return () => {
      cancelled = true;
      mapRef.current?.remove();
      mapRef.current = null;
      markersRef.current = [];
    };
  }, []);

  // Leaflet caches the container size, so a map whose box changes -- a window
  // resize, the tray opening -- keeps drawing at the old size and goes grey.
  useEffect(() => {
    const el = containerRef.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(() => mapRef.current?.invalidateSize());
    observer.observe(el);
    return () => observer.disconnect();
  }, [mapReady]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const focused = listings.find((l) => l.id === focusId) ?? null;
    const areaCenter = focusArea ? AREA_CENTERS[focusArea] : null;
    if (focused?.lat != null && focused.lng != null) {
      map.flyTo([focused.lat, focused.lng], 16, { duration: 0.6 });
    } else if (areaCenter) {
      map.flyTo([areaCenter.lat, areaCenter.lng], areaCenter.zoom, {
        duration: 0.6,
      });
    }
  }, [focusId, focusArea, listings, mapReady]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    let cancelled = false;

    void (async () => {
      const leafletMod = await import("leaflet");
      const L = (leafletMod.default ?? leafletMod) as typeof import("leaflet");
      if (cancelled || mapRef.current !== map) return;

      markersRef.current.forEach((m) => m.remove());
      markersRef.current = [];

      const positions = mapPositions(listings);

      listings
        .filter((l) => positions.has(l.id))
        .forEach((listing) => {
          const pos = positions.get(listing.id)!;
          const colour = STATUS_COLORS[listing.status];
          const icon = L.divIcon({
            className: "hh-pin",
            html: pinMarkup(colour, pos.exact),
            iconSize: [26, 38],
            iconAnchor: [13, 37],
            popupAnchor: [0, -34],
          });
          const marker = L.marker([pos.lat, pos.lng], { icon }).addTo(map);
          const href = listingHref(listing.url);
          const listingLink = href
            ? `<a href="${escapeHtml(href)}" target="_blank" rel="noreferrer noopener" style="margin-left:8px">Listing</a>`
            : "";
          const notes = listing.notes
            ? `<p style="margin:4px 0 0;color:#525252;max-width:220px">${escapeHtml(listing.notes).slice(0, 180)}</p>`
            : "";
          marker.bindPopup(
            `<div style="min-width:180px;font-size:13px">
              <p style="font-weight:600;margin:0">${escapeHtml(listingTitle(listing))}</p>
              <p style="margin:4px 0 0">${escapeHtml(formatInr(listing.rent))} · ${listing.bhk} BHK · ${listing.area}</p>
              <p style="margin:4px 0 0">${escapeHtml(HOUSING_TYPE_LABELS[listing.housingType])} · ${escapeHtml(PARKING_LABELS[listing.parking])}</p>
              <p style="margin:4px 0 0">${escapeHtml(STATUS_LABELS[listing.status])} · ${escapeHtml(listing.source)}</p>
              ${
                listing.status === "contacted" && (listing.visitBooked || listing.visited)
                  ? `<p style="margin:4px 0 0">${[
                      listing.visitBooked
                        ? `Visit booked ${escapeHtml(formatVisitDate(listing.visitBooked))}`
                        : "",
                      listing.visited
                        ? `Visited${
                            listing.visitChecks.length
                              ? ` · ${listing.visitChecks.filter((check) => check.checked).length}/${listing.visitChecks.length} checks`
                              : ""
                          }`
                        : "",
                    ]
                      .filter(Boolean)
                      .join(" · ")}</p>`
                  : ""
              }
              ${notes}
              ${
                pos.exact
                  ? ""
                  : `<p style="margin:6px 0 0;color:#a16207">Approximate — placed in ${escapeHtml(listing.area)} because this listing has no coordinates. Import it from its own page to place it exactly.</p>`
              }
              <button type="button" data-edit="${listing.id}" style="margin-top:8px">Edit</button>${listingLink}
            </div>`
          );
          marker.on("popupopen", () => {
            const btn = document.querySelector(`[data-edit="${listing.id}"]`);
            btn?.addEventListener("click", () => onEditRef.current(listing));
          });
          markersRef.current.push(marker);
        });
    })();

    return () => {
      cancelled = true;
    };
  }, [listings, mapReady]);

  return (
    <div className="relative h-full min-h-[280px] w-full bg-[#e8e4d8]">
      <div ref={containerRef} className="h-full w-full rounded-xl" />
      <MapLegend />
      {mapError ? (
        <p className="absolute inset-x-3 bottom-3 rounded-md bg-card/90 p-2 text-xs text-destructive">
          Map error: {mapError}
        </p>
      ) : null}
    </div>
  );
}

function MapLegend() {
  return (
    <div className="pointer-events-none absolute bottom-2 left-2 z-10 max-w-[calc(100%-1rem)] rounded-lg bg-card/95 px-2.5 py-2 text-[11px] leading-none shadow-md ring-1 ring-foreground/10">
      <ul className="grid grid-cols-2 gap-x-3 gap-y-1.5 sm:grid-cols-3">
        {STATUSES.map((status) => (
          <li key={status} className="flex items-center gap-1.5">
            <PinGlyph colour={STATUS_COLORS[status]} exact />
            <span>{STATUS_LABELS[status]}</span>
          </li>
        ))}
      </ul>
      <ul className="mt-2 flex gap-3 border-t border-foreground/10 pt-2">
        <li className="flex items-center gap-1.5">
          <PinGlyph colour="#2563eb" exact />
          <span>Exact</span>
        </li>
        <li className="flex items-center gap-1.5">
          <PinGlyph colour="#2563eb" exact={false} />
          <span>Approximate</span>
        </li>
        <li className="flex items-center gap-1.5">
          <span
            className="size-3 shrink-0 rounded-full border border-[#e3a805]"
            style={{ background: "rgba(227, 168, 5, 0.35)" }}
          />
          <span>KCDC 1 km</span>
        </li>
      </ul>
    </div>
  );
}

function PinGlyph({ colour, exact }: { colour: string; exact: boolean }) {
  return (
    <svg
      className="hh-pin-svg h-[18px] w-[12px] shrink-0"
      viewBox="0 0 26 38"
      aria-hidden="true"
    >
      <path
        d="M13 36.2C13 36.2 2.2 22.4 2.2 13.5A10.8 10.8 0 1 1 23.8 13.5C23.8 22.4 13 36.2 13 36.2Z"
        fill={exact ? colour : "rgba(255,255,255,.72)"}
        stroke={exact ? "white" : colour}
        strokeWidth={exact ? 1.6 : 1.7}
        strokeDasharray={exact ? undefined : "3.2 2.1"}
        strokeLinejoin="round"
      />
      {exact ? (
        <circle cx="13" cy="13.5" r="4.25" fill="white" />
      ) : (
        <circle
          cx="13"
          cy="13.5"
          r="3.4"
          fill="none"
          stroke={colour}
          strokeWidth="1.6"
          strokeDasharray="2 1.6"
        />
      )}
    </svg>
  );
}

// Teardrop whose tip sits on the coordinate. An approximate pin is hollow
// and dashed, so it never reads as a surveyed position -- it only says
// "somewhere in this area".
function pinMarkup(colour: string, exact: boolean): string {
  const head = exact
    ? `<circle cx="13" cy="13.5" r="4.25" fill="white"/>`
    : `<circle cx="13" cy="13.5" r="3.4" fill="none" stroke="${colour}" stroke-width="1.6" stroke-dasharray="2 1.6"/>`;
  const body = exact
    ? `fill="${colour}" stroke="white" stroke-width="1.6"`
    : `fill="rgba(255,255,255,.72)" stroke="${colour}" stroke-width="1.7" stroke-dasharray="3.2 2.1" stroke-linejoin="round"`;
  return `<svg class="hh-pin-svg" width="26" height="38" viewBox="0 0 26 38" aria-hidden="true">
    <path ${body} d="M13 36.2C13 36.2 2.2 22.4 2.2 13.5A10.8 10.8 0 1 1 23.8 13.5C23.8 22.4 13 36.2 13 36.2Z"/>
    ${head}
  </svg>`;
}

function formatVisitDate(iso: string): string {
  const [year, month, day] = iso.split("-").map(Number);
  if (!year || !month || !day) return iso;
  return new Date(year, month - 1, day).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function listingHref(url: string): string | null {
  const trimmed = url.trim();
  if (!trimmed) return null;
  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return null;
    return parsed.href;
  } catch {
    return null;
  }
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
