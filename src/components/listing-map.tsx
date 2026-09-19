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

  useEffect(() => {
    onEditRef.current = onEdit;
  }, [onEdit]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    let cancelled = false;

    void (async () => {
      const leaflet = await import("leaflet");
      const L = leaflet.default;
      if (cancelled || mapRef.current) return;
      const map = L.map(el, { scrollWheelZoom: true }).setView(
        [SOUTH_BENGALURU.lat, SOUTH_BENGALURU.lng],
        13
      );
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution:
          '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      }).addTo(map);
      mapRef.current = map;
      setMapReady((n) => n + 1);
      requestAnimationFrame(() => map.invalidateSize());
    })();

    return () => {
      cancelled = true;
      mapRef.current?.remove();
      mapRef.current = null;
      markersRef.current = [];
    };
  }, []);

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
      const leaflet = await import("leaflet");
      const L = leaflet.default;
      if (cancelled || mapRef.current !== map) return;

      markersRef.current.forEach((m) => m.remove());
      markersRef.current = [];

      listings
        .filter((l) => l.lat != null && l.lng != null)
        .forEach((listing) => {
          const icon = L.divIcon({
            className: "hh-pin",
            html: `<span style="background:${STATUS_COLORS[listing.status]};width:16px;height:16px;border-radius:999px;display:block;border:2px solid white;box-shadow:0 1px 4px rgba(0,0,0,.4)"></span>`,
            iconSize: [16, 16],
            iconAnchor: [8, 8],
            popupAnchor: [0, -10],
          });
          const marker = L.marker([listing.lat as number, listing.lng as number], {
            icon,
          }).addTo(map);
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
    <div className="relative h-full w-full">
      <div ref={containerRef} className="h-full w-full rounded-xl" />
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
