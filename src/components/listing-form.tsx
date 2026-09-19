"use client";

import { useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import {
  HOUSING_TYPE_LABELS,
  PARKING_LABELS,
  SOURCE_LABELS,
  STATUS_LABELS,
} from "@/lib/constants";
import {
  AREAS,
  emptyListing,
  FURNISHED,
  HOUSING_TYPES,
  PARKING,
  POWER_BACKUP,
  SOURCES,
  STATUSES,
  type Listing,
  type ListingDraft,
} from "@/lib/types";

const FURNISHED_LABELS = {
  unfurnished: "Unfurnished",
  semi: "Semi-furnished",
  fully: "Fully furnished",
  unknown: "Unknown",
} as const;

type FormState = {
  society: string;
  address: string;
  area: Listing["area"];
  rent: string;
  deposit: string;
  bhk: string;
  housingType: Listing["housingType"];
  parking: Listing["parking"];
  availableFrom: string;
  source: Listing["source"];
  url: string;
  contact: string;
  photoUrls: string;
  notes: string;
  furnished: Listing["furnished"];
  floor: string;
  powerBackup: Listing["powerBackup"];
  lat: string;
  lng: string;
  status: Listing["status"];
};

function listingToForm(listing: Listing): FormState {
  return {
    society: listing.society,
    address: listing.address,
    area: listing.area,
    rent: listing.rent == null ? "" : String(listing.rent),
    deposit: listing.deposit == null ? "" : String(listing.deposit),
    bhk: String(listing.bhk),
    housingType: listing.housingType,
    parking: listing.parking,
    availableFrom: listing.availableFrom,
    source: listing.source,
    url: listing.url,
    contact: listing.contact,
    photoUrls: listing.photoUrls.join("\n"),
    notes: listing.notes,
    furnished: listing.furnished,
    floor: listing.floor,
    powerBackup: listing.powerBackup,
    lat: listing.lat == null ? "" : String(listing.lat),
    lng: listing.lng == null ? "" : String(listing.lng),
    status: listing.status,
  };
}

function parseNum(value: string): number | null {
  const n = Number(value.replace(/[, ]/g, ""));
  return Number.isFinite(n) && value.trim() !== "" ? n : null;
}

export function ListingFormSheet({
  open,
  onOpenChange,
  listing,
  draft,
  onSave,
  onDelete,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  listing: Listing | null;
  draft: ListingDraft | null;
  onSave: (listing: Listing) => void;
  onDelete?: (id: string) => void;
}) {
  const formKey = `${listing?.id ?? "new"}-${open ? "open" : "closed"}-${draft?.society ?? ""}-${draft?.url ?? ""}`;
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      {open ? (
        <ListingFormBody
          key={formKey}
          listing={listing}
          draft={draft}
          onOpenChange={onOpenChange}
          onSave={onSave}
          onDelete={onDelete}
        />
      ) : null}
    </Sheet>
  );
}

function ListingFormBody({
  listing,
  draft,
  onOpenChange,
  onSave,
  onDelete,
}: {
  listing: Listing | null;
  draft: ListingDraft | null;
  onOpenChange: (open: boolean) => void;
  onSave: (listing: Listing) => void;
  onDelete?: (id: string) => void;
}) {
  const [form, setForm] = useState<FormState>(() =>
    listingToForm(listing ?? emptyListing(draft ?? {}))
  );
  const [geocoding, setGeocoding] = useState(false);
  const [geoMsg, setGeoMsg] = useState<string | null>(null);

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  async function locate() {
    const q = [form.address, form.society, form.area].filter(Boolean).join(", ");
    if (!q.trim()) {
      setGeoMsg("Add an address or landmark first.");
      return;
    }
    setGeocoding(true);
    setGeoMsg(null);
    try {
      const res = await fetch(`/api/geocode?q=${encodeURIComponent(q)}`);
      const data = (await res.json()) as { lat: number | null; lng: number | null };
      if (data.lat == null || data.lng == null) {
        setGeoMsg("No match. Drop a pin by typing lat/lng, or try a nearby landmark.");
        return;
      }
      setForm((f) => ({ ...f, lat: String(data.lat), lng: String(data.lng) }));
      setGeoMsg("Pinned from OpenStreetMap Nominatim.");
    } catch {
      setGeoMsg("Geocoding failed. You can still save without a pin.");
    } finally {
      setGeocoding(false);
    }
  }

  async function handleSave() {
    const base = listing ?? emptyListing(draft ?? {});
    let lat = parseNum(form.lat);
    let lng = parseNum(form.lng);
    if (lat == null || lng == null) {
      const q = [form.address, form.society, form.area, "Bengaluru"].filter(Boolean).join(", ");
      try {
        const res = await fetch(`/api/geocode?q=${encodeURIComponent(q)}`);
        const data = (await res.json()) as { lat: number | null; lng: number | null };
        if (data.lat != null && data.lng != null) {
          lat = data.lat;
          lng = data.lng;
        }
      } catch {
        /* keep null */
      }
    }
    const next: Listing = {
      ...base,
      society: form.society.trim(),
      address: form.address.trim(),
      area: form.area,
      rent: parseNum(form.rent),
      deposit: parseNum(form.deposit),
      bhk: parseNum(form.bhk) ?? 2,
      housingType: form.housingType,
      parking: form.parking,
      availableFrom: form.availableFrom,
      source: form.source,
      url: form.url.trim(),
      contact: form.contact.trim(),
      photoUrls: form.photoUrls
        .split(/[\n,]/)
        .map((s) => s.trim())
        .filter(Boolean),
      notes: form.notes.trim(),
      furnished: form.furnished,
      floor: form.floor.trim(),
      powerBackup: form.powerBackup,
      lat,
      lng,
      status: form.status,
      updatedAt: new Date().toISOString(),
    };
    onSave(next);
    onOpenChange(false);
  }

  return (
    <SheetContent
        side="right"
        className="w-full overflow-y-auto sm:max-w-lg"
        showCloseButton
      >
        <SheetHeader>
          <SheetTitle>{listing ? "Edit listing" : "Add listing"}</SheetTitle>
          <SheetDescription>
            2 BHK under ₹30k in South Bengaluru. Confirm details before they
            land on the board.
          </SheetDescription>
        </SheetHeader>
        <div className="grid gap-3 px-4 pb-4">
          <Field label="Society or building">
            <Input
              value={form.society}
              onChange={(e) => set("society", e.target.value)}
              placeholder="e.g. SNN Raj Serenity"
            />
          </Field>
          <Field label="Address or landmark">
            <Input
              value={form.address}
              onChange={(e) => set("address", e.target.value)}
              placeholder="Near Kudlu Gate, off Hosur Road"
            />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Area">
              <Select
                value={form.area}
                onValueChange={(v) => {
                  if (typeof v === "string") set("area", v as Listing["area"]);
                }}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {AREAS.map((a) => (
                    <SelectItem key={a} value={a}>
                      {a}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Status">
              <Select
                value={form.status}
                onValueChange={(v) => {
                  if (typeof v === "string") set("status", v as Listing["status"]);
                }}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {STATUSES.map((s) => (
                    <SelectItem key={s} value={s}>
                      {STATUS_LABELS[s]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <Field label="Rent (₹)">
              <Input
                inputMode="numeric"
                value={form.rent}
                onChange={(e) => set("rent", e.target.value)}
                placeholder="28000"
              />
            </Field>
            <Field label="Deposit (₹)">
              <Input
                inputMode="numeric"
                value={form.deposit}
                onChange={(e) => set("deposit", e.target.value)}
                placeholder="80000"
              />
            </Field>
            <Field label="BHK">
              <Input
                inputMode="decimal"
                value={form.bhk}
                onChange={(e) => set("bhk", e.target.value)}
              />
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Type">
              <Select
                value={form.housingType}
                onValueChange={(v) => {
                  if (typeof v === "string")
                    set("housingType", v as Listing["housingType"]);
                }}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {HOUSING_TYPES.map((t) => (
                    <SelectItem key={t} value={t}>
                      {HOUSING_TYPE_LABELS[t]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Parking">
              <Select
                value={form.parking}
                onValueChange={(v) => {
                  if (typeof v === "string") set("parking", v as Listing["parking"]);
                }}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PARKING.map((p) => (
                    <SelectItem key={p} value={p}>
                      {PARKING_LABELS[p]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Available from">
              <Input
                type="date"
                value={form.availableFrom}
                onChange={(e) => set("availableFrom", e.target.value)}
              />
            </Field>
            <Field label="Source">
              <Select
                value={form.source}
                onValueChange={(v) => {
                  if (typeof v === "string") set("source", v as Listing["source"]);
                }}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SOURCES.map((s) => (
                    <SelectItem key={s} value={s}>
                      {SOURCE_LABELS[s]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          </div>
          <Field label="Listing URL">
            <Input
              value={form.url}
              onChange={(e) => set("url", e.target.value)}
              placeholder="https://…"
            />
          </Field>
          <Field label="Broker / owner contact">
            <Input
              value={form.contact}
              onChange={(e) => set("contact", e.target.value)}
              placeholder="Name, phone, or WhatsApp"
            />
          </Field>
          <Field label="Photo URLs (one per line)">
            <Textarea
              value={form.photoUrls}
              onChange={(e) => set("photoUrls", e.target.value)}
              placeholder="https://…"
            />
          </Field>
          <Field label="Notes">
            <Textarea
              value={form.notes}
              onChange={(e) => set("notes", e.target.value)}
              placeholder="Power backup hours, broker vibe, visit slot…"
            />
          </Field>
          <div className="grid grid-cols-3 gap-3">
            <Field label="Furnished">
              <Select
                value={form.furnished}
                onValueChange={(v) => {
                  if (typeof v === "string")
                    set("furnished", v as Listing["furnished"]);
                }}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {FURNISHED.map((f) => (
                    <SelectItem key={f} value={f}>
                      {FURNISHED_LABELS[f]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Floor">
              <Input
                value={form.floor}
                onChange={(e) => set("floor", e.target.value)}
                placeholder="3 / 8"
              />
            </Field>
            <Field label="Power backup">
              <Select
                value={form.powerBackup}
                onValueChange={(v) => {
                  if (typeof v === "string")
                    set("powerBackup", v as Listing["powerBackup"]);
                }}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {POWER_BACKUP.map((p) => (
                    <SelectItem key={p} value={p}>
                      {p === "yes" ? "Yes" : p === "no" ? "No" : "Unknown"}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          </div>
          <div className="grid grid-cols-[1fr_1fr_auto] items-end gap-2">
            <Field label="Latitude">
              <Input
                value={form.lat}
                onChange={(e) => set("lat", e.target.value)}
              />
            </Field>
            <Field label="Longitude">
              <Input
                value={form.lng}
                onChange={(e) => set("lng", e.target.value)}
              />
            </Field>
            <Button
              type="button"
              variant="outline"
              className="mb-0.5"
              disabled={geocoding}
              onClick={locate}
            >
              {geocoding ? "Locating…" : "Locate"}
            </Button>
          </div>
          {geoMsg ? (
            <p className="text-xs text-muted-foreground">{geoMsg}</p>
          ) : null}
        </div>
        <SheetFooter className="flex-row justify-between gap-2">
          {listing && onDelete ? (
            <Button
              variant="destructive"
              onClick={() => {
                onDelete(listing.id);
                onOpenChange(false);
              }}
            >
              Delete
            </Button>
          ) : (
            <span />
          )}
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button onClick={handleSave}>Save listing</Button>
          </div>
        </SheetFooter>
      </SheetContent>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="grid gap-1.5">
      <Label>{label}</Label>
      {children}
    </div>
  );
}

export function ParkingPreferredToggle({
  checked,
  onChange,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="flex items-center gap-2 text-sm">
      <Checkbox
        checked={checked}
        onCheckedChange={(v) => onChange(v === true)}
      />
      Parking preferred
    </label>
  );
}
