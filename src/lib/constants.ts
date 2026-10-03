import type { Area, HousingType, Parking, Source, Status } from "./types";

export const SOUTH_BENGALURU = { lat: 12.9121, lng: 77.6386 };

// Karnataka Compost Development Centre, between HSR Layout and Kudlu.
// 12°54'N 77°39'E, the published site near Haralakunte.
export const KCDC = { lat: 12.9, lng: 77.65, radiusM: 1000 };

export const AREA_CENTERS: Record<Area, { lat: number; lng: number; zoom: number }> =
  {
    HSR: { lat: 12.9121, lng: 77.6386, zoom: 14 },
    Harlur: { lat: 12.9014, lng: 77.6621, zoom: 14 },
    Kudlu: { lat: 12.8894, lng: 77.6489, zoom: 14 },
    Koramangala: { lat: 12.9352, lng: 77.6245, zoom: 14 },
    BTM: { lat: 12.9166, lng: 77.6101, zoom: 14 },
    Nearby: { lat: 12.9121, lng: 77.655, zoom: 13 },
  };

export const STATUS_LABELS: Record<Status, string> = {
  new: "New",
  shortlisted: "Shortlisted",
  contacted: "Contacted",
  rejected: "Rejected",
};

export const STATUS_COLORS: Record<Status, string> = {
  new: "#2563eb",
  shortlisted: "#16a34a",
  contacted: "#ea580c",
  rejected: "#e11d48",
};

export const HOUSING_TYPE_LABELS: Record<HousingType, string> = {
  gated_society: "Gated society",
  apartment: "Apartment",
  service_apartment: "Service apartment",
};

export const PARKING_LABELS: Record<Parking, string> = {
  yes: "Parking",
  no: "No parking",
  unknown: "Parking unknown",
};

export const SOURCE_LABELS: Record<Source, string> = {
  NoBroker: "NoBroker",
  Facebook: "Facebook",
  broker: "Broker",
  Housing: "Housing",
  "99acres": "99acres",
  other: "Other",
};

export const STORAGE_KEY = "househunting.listings.v1";
