"use client";

import { useEffect, useRef, useState } from "react";
import type { Map as LeafletMap, Marker as LeafletMarker } from "leaflet";
import {
  AREA_CENTERS,
  HOUSING_TYPE_LABELS,
  PARKING_LABELS,
  SOUTH_BENGALURU,
  STATUS_COLORS,
  STATUS_LABELS,
} from "@/lib/constants";
import { formatInr, listingTitle } from "@/lib/format";
import { mapPositions } from "@/lib/map-position";
import type { Area, Listing } from "@/lib/types";

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
          // An approximate pin is hollow and dashed, so it never reads as a
          // surveyed position -- it only says "somewhere in this area".
          const dot = pos.exact
            ? `background:${colour};border:2px solid white;box-shadow:0 1px 4px rgba(0,0,0,.4)`
            : `background:transparent;border:2px dashed ${colour};opacity:.85`;
          const icon = L.divIcon({
            className: "hh-pin",
            html: `<span style="${dot};width:16px;height:16px;border-radius:999px;display:block"></span>`,
            iconSize: [16, 16],
            iconAnchor: [8, 8],
            popupAnchor: [0, -10],
          });
          const marker = L.marker([pos.lat, pos.lng], { icon }).addTo(map);
          const notes = listing.notes
            ? `<p style="margin:4px 0 0;color:#525252;max-width:220px">${escapeHtml(listing.notes).slice(0, 180)}</p>`
            : "";
          marker.bindPopup(
            `<div style="min-width:180px;font-size:13px">
              <p style="font-weight:600;margin:0">${escapeHtml(listingTitle(listing))}</p>
              <p style="margin:4px 0 0">${escapeHtml(formatInr(listing.rent))} · ${listing.bhk} BHK · ${listing.area}</p>
              <p style="margin:4px 0 0">${escapeHtml(HOUSING_TYPE_LABELS[listing.housingType])} · ${escapeHtml(PARKING_LABELS[listing.parking])}</p>
              <p style="margin:4px 0 0">${escapeHtml(STATUS_LABELS[listing.status])} · ${escapeHtml(listing.source)}</p>
              ${notes}
              ${
                pos.exact
                  ? ""
                  : `<p style="margin:6px 0 0;color:#a16207">Approximate — placed in ${escapeHtml(listing.area)} because this listing has no coordinates. Import it from its own page to place it exactly.</p>`
              }
              <button type="button" data-edit="${listing.id}" style="margin-top:8px">Edit</button>
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
      {mapError ? (
        <p className="absolute inset-x-3 bottom-3 rounded-md bg-card/90 p-2 text-xs text-destructive">
          Map error: {mapError}
        </p>
      ) : null}
    </div>
  );
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
