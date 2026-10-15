export const STATUSES = [
  "new",
  "shortlisted",
  "contacted",
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

export const VISIT_PHASES = ["primary", "secondary"] as const;
export type VisitPhase = (typeof VISIT_PHASES)[number];

export type VisitCheck = {
  id: string;
  label: string;
  checked: boolean;
  phase: VisitPhase;
};

/** A tick means the house passes, so the wording is the passing state. */
export const PRIMARY_VISIT_CHECKS = [
  "Big kitchen",
  "Attached bathroom",
  "Car parking",
  "Garbage collection",
  "Maid availability",
  "Ventilation and natural light",
  "Storage space",
  "Building maintenance and society rules",
  "Security (locks, grills, gate, intercom, guard, CCTV, entry times)",
  "No leaks, dampness, or mold",
  "Power backup",
  "Lift",
  "Mobile network and fiber",
  "Not the top floor",
] as const;

export const SECONDARY_VISIT_CHECKS = [
  "Water pressure and drainage",
  "Electrical outlets and switches",
  "Windows and doors",
  "Water heating and appliances",
  "Kitchen with exhaust",
  "Bathroom with exhaust",
  "Bedroom is not west facing",
  "Kaveri water supply",
  "Separate electricity meter",
  "Washing machine inlet",
] as const;

const LEGACY_VISIT_LABELS: Record<string, string> = {
  "Kitchen is big": "Big kitchen",
};

export function defaultVisitChecks(): VisitCheck[] {
  return [
    ...PRIMARY_VISIT_CHECKS.map((label) => visitCheck(label, "primary")),
    ...SECONDARY_VISIT_CHECKS.map((label) => visitCheck(label, "secondary")),
  ];
}

function visitCheck(label: string, phase: VisitPhase, checked = false): VisitCheck {
  return { id: `default:${label}`, label, checked, phase };
}

/** Defaults plus any checks added by hand. Saved ticks survive a renamed label. */
export function withDefaultVisitChecks(saved: VisitCheck[]): VisitCheck[] {
  const defaults = defaultVisitChecks();
  const used = new Set<string>();
  const merged = defaults.map((item) => {
    const hit = saved.find((check) => {
      if (used.has(check.id)) return false;
      const label = LEGACY_VISIT_LABELS[check.label] ?? check.label;
      return check.id === item.id || label === item.label;
    });
    if (!hit) return item;
    used.add(hit.id);
    return { ...item, checked: hit.checked };
  });
  const added = saved
    .filter((check) => !used.has(check.id))
    .map((check) => ({ ...check, phase: check.phase === "primary" ? "primary" : "secondary" }) as VisitCheck);
  return [...merged, ...added];
}

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
  visitBooked: string;
  visited: boolean;
  visitChecks: VisitCheck[];
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
    visitBooked: "",
    visited: false,
    visitChecks: [],
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}
