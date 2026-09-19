export const STATUSES = [
  "new",
  "contacted",
  "visit_booked",
  "visited",
  "shortlisted",
  "rejected",
] as const;

export type Status = (typeof STATUSES)[number];

export const AREAS = [
  "HSR",
  "Harlur",
  "Kudlu",
  "Koramangala",
  "BTM",
  "Nearby",
] as const;

export type Area = (typeof AREAS)[number];

export const HOUSING_TYPES = [
  "gated_society",
  "apartment",
  "service_apartment",
] as const;

export type HousingType = (typeof HOUSING_TYPES)[number];

export const PARKING = ["yes", "no", "unknown"] as const;
export type Parking = (typeof PARKING)[number];

export const SOURCES = [
  "NoBroker",
  "Facebook",
  "broker",
  "Housing",
  "99acres",
  "other",
] as const;

export type Source = (typeof SOURCES)[number];

export const FURNISHED = [
  "unfurnished",
  "semi",
  "fully",
  "unknown",
] as const;

export type Furnished = (typeof FURNISHED)[number];

export const POWER_BACKUP = ["yes", "no", "unknown"] as const;
export type PowerBackup = (typeof POWER_BACKUP)[number];

export type Listing = {
  id: string;
  society: string;
  address: string;
  area: Area;
  rent: number | null;
  deposit: number | null;
  bhk: number;
  housingType: HousingType;
  parking: Parking;
  availableFrom: string;
  source: Source;
  url: string;
  contact: string;
  photoUrls: string[];
  notes: string;
  furnished: Furnished;
  floor: string;
  powerBackup: PowerBackup;
  lat: number | null;
  lng: number | null;
  status: Status;
  createdAt: string;
  updatedAt: string;
};

export type ListingDraft = Partial<Listing>;

export type ExportFile = {
  version: 1;
  exportedAt: string;
  listings: Listing[];
};

export type Filters = {
  maxRent: number;
  parkingPreferred: boolean;
  areas: Area[];
  status: Status | "all";
  source: Source | "all";
};

export const DEFAULT_MAX_RENT = 30000;

export function emptyListing(overrides: ListingDraft = {}): Listing {
  const now = new Date().toISOString();
  return {
    id: crypto.randomUUID(),
    society: "",
    address: "",
    area: "HSR",
    rent: null,
    deposit: null,
    bhk: 2,
    housingType: "gated_society",
    parking: "unknown",
    availableFrom: "",
    source: "other",
    url: "",
    contact: "",
    photoUrls: [],
    notes: "",
    furnished: "unknown",
    floor: "",
    powerBackup: "unknown",
    lat: null,
    lng: null,
    status: "new",
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}
