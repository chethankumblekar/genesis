"use client";

import { useEffect } from "react";
import { MapContainer, Marker, Popup, TileLayer, useMap } from "react-leaflet";
import L from "leaflet";
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
import { Button } from "@/components/ui/button";

function pinIcon(color: string) {
  return L.divIcon({
    className: "hh-pin",
    html: `<span style="background:${color};width:16px;height:16px;border-radius:999px;display:block;border:2px solid white;box-shadow:0 1px 4px rgba(0,0,0,.4)"></span>`,
    iconSize: [16, 16],
    iconAnchor: [8, 8],
    popupAnchor: [0, -10],
  });
}

function FlyTo({
  center,
  zoom,
  listing,
}: {
  center: { lat: number; lng: number };
  zoom: number;
  listing?: Listing | null;
}) {
  const map = useMap();
  useEffect(() => {
    if (listing?.lat != null && listing.lng != null) {
      map.flyTo([listing.lat, listing.lng], 16, { duration: 0.6 });
      return;
    }
    map.flyTo([center.lat, center.lng], zoom, { duration: 0.6 });
  }, [center.lat, center.lng, zoom, listing, map]);
  return null;
}

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
  const focused = listings.find((l) => l.id === focusId) ?? null;
  const areaCenter = focusArea ? AREA_CENTERS[focusArea] : null;
  const center = focused?.lat != null && focused.lng != null
    ? { lat: focused.lat, lng: focused.lng }
    : areaCenter ?? SOUTH_BENGALURU;
  const zoom = focused ? 16 : areaCenter?.zoom ?? 13;

  const pinned = listings.filter((l) => l.lat != null && l.lng != null);

  return (
    <MapContainer
      center={[SOUTH_BENGALURU.lat, SOUTH_BENGALURU.lng]}
      zoom={13}
      className="h-full w-full rounded-xl"
      scrollWheelZoom
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <FlyTo center={center} zoom={zoom} listing={focused} />
      {pinned.map((listing) => (
        <Marker
          key={listing.id}
          position={[listing.lat as number, listing.lng as number]}
          icon={pinIcon(STATUS_COLORS[listing.status])}
        >
          <Popup>
            <div className="min-w-[180px] space-y-1 font-sans text-sm">
              <p className="font-medium">{listingTitle(listing)}</p>
              <p>
                {formatInr(listing.rent)} · {listing.bhk} BHK · {listing.area}
              </p>
              <p>
                {HOUSING_TYPE_LABELS[listing.housingType]} ·{" "}
                {PARKING_LABELS[listing.parking]}
              </p>
              <p>
                {STATUS_LABELS[listing.status]} · {listing.source}
              </p>
              {listing.notes ? (
                <p className="line-clamp-3 text-neutral-600">{listing.notes}</p>
              ) : null}
              <Button size="sm" className="mt-1" onClick={() => onEdit(listing)}>
                Edit
              </Button>
            </div>
          </Popup>
        </Marker>
      ))}
    </MapContainer>
  );
}
