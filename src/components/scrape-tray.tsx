"use client";

import { useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Overlay } from "@/components/overlay";
import { formatInr } from "@/lib/format";
import {
  CONFIDENCES,
  SCRAPE_SOURCES,
  SCRAPE_SOURCE_LABELS,
  type ScrapedListing,
} from "@/lib/scrape/types";
import {
  AREAS,
  FURNISHED,
  HOUSING_TYPES,
  type HousingType,
  type ListingDraft,
} from "@/lib/types";

import {
  EMPTY_FILTER,
  activeCount,
  matchesTrayFilter,
  sortRows,
  type TrayFilter,
} from "@/lib/scrape/tray-filter";

const HOUSING_LABELS: Record<HousingType, string> = {
  gated_society: "gated society",
  apartment: "apartment",
  service_apartment: "service apartment",
};

const CONFIDENCE_META = {
  high: { label: "High", className: "bg-emerald-600/15 text-emerald-800" },
  medium: { label: "Medium", className: "bg-amber-500/15 text-amber-800" },
  low: { label: "Filtered", className: "bg-muted text-muted-foreground" },
} as const;

function summary(draft: ListingDraft): string[] {
  return [
    draft.bhk ? `${draft.bhk} BHK` : null,
    draft.rent != null ? formatInr(draft.rent) : null,
    draft.deposit != null ? `${formatInr(draft.deposit)} dep` : null,
    draft.area,
    draft.furnished && draft.furnished !== "unknown" ? draft.furnished : null,
  ].filter(Boolean) as string[];
}

function CaptureRow({
  row,
  busy,
  onImport,
  onReject,
  onEdit,
}: {
  row: ScrapedListing;
  busy: boolean;
  onImport: () => void;
  onReject: () => void;
  onEdit: () => void;
}) {
  const meta = CONFIDENCE_META[row.confidence];
  const draft = row.draft as ListingDraft;
  const title =
    draft.society?.trim() ||
    draft.address?.trim() ||
    `${SCRAPE_SOURCE_LABELS[row.source]} listing`;

  return (
    <li className="rounded-lg border p-3">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate font-medium">{title}</p>
          {draft.address && draft.address !== title ? (
            <p className="truncate text-sm text-muted-foreground">{draft.address}</p>
          ) : null}
        </div>
        <Badge className={meta.className}>{meta.label}</Badge>
      </div>

      {draft.photoUrls?.length ? (
        <div className="mt-2 flex gap-1.5 overflow-x-auto">
          {draft.photoUrls.slice(0, 5).map((src) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              key={src}
              src={src}
              alt=""
              loading="lazy"
              className="h-16 w-20 shrink-0 rounded-md object-cover ring-1 ring-foreground/10"
              onError={(e) => {
                // A photo the source will not serve us is hidden, not left broken.
                e.currentTarget.style.display = "none";
              }}
            />
          ))}
        </div>
      ) : null}

      <p className="mt-2 text-sm">{summary(draft).join(" · ") || "Nothing read"}</p>

      {row.missing.length ? (
        <p className="mt-1 text-xs text-muted-foreground">
          Missing: {row.missing.join(", ")}
        </p>
      ) : null}
      {row.reasons.length ? (
        <p className="mt-1 text-xs text-muted-foreground">{row.reasons.join(" · ")}</p>
      ) : null}

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <Button type="button" size="sm" disabled={busy} onClick={onImport}>
          Import
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={busy}
          onClick={onEdit}
        >
          Edit in form
        </Button>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          disabled={busy}
          onClick={onReject}
        >
          Reject
        </Button>
        {row.url ? (
          <a
            href={row.url}
            target="_blank"
            rel="noreferrer noopener"
            className="ml-auto text-xs text-muted-foreground underline"
          >
            Open original
          </a>
        ) : null}
      </div>
    </li>
  );
}

function Select<T extends string>({
  label,
  value,
  options,
  onChange,
  render,
}: {
  label: string;
  value: T | "all";
  options: readonly T[];
  onChange: (v: T | "all") => void;
  render?: (v: T) => string;
}) {
  return (
    <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
      {label}
      <select
        value={value}
        onChange={(e) => onChange(e.target.value as T | "all")}
        className="h-8 rounded-md border bg-background px-2 text-sm text-foreground"
      >
        <option value="all">all</option>
        {options.map((o) => (
          <option key={o} value={o}>
            {render ? render(o) : o}
          </option>
        ))}
      </select>
    </label>
  );
}

function NumberBox({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
      {label}
      <input
        type="number"
        min={0}
        step={1000}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="any"
        className="h-8 w-24 rounded-md border bg-background px-2 text-sm text-foreground"
      />
    </label>
  );
}

function TrayFilters({
  filter,
  onChange,
  showing,
  total,
}: {
  filter: TrayFilter;
  onChange: (next: TrayFilter) => void;
  showing: number;
  total: number;
}) {
  const [expanded, setExpanded] = useState(false);
  const active = activeCount(filter);
  const set = <K extends keyof TrayFilter>(key: K, value: TrayFilter[K]) =>
    onChange({ ...filter, [key]: value });

  const toggleBhk = (n: number) =>
    set(
      "bhk",
      filter.bhk.includes(n)
        ? filter.bhk.filter((x) => x !== n)
        : [...filter.bhk, n]
    );

  return (
    <div className="mb-4 rounded-lg border bg-muted/30 p-3">
      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => setExpanded((v) => !v)}
        >
          {expanded ? "Hide filters" : "Filters"}
          {active ? ` (${active})` : ""}
        </Button>
        <span className="text-xs text-muted-foreground">
          Showing {showing} of {total}
        </span>
        {active || filter.sort !== "captured" ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="ml-auto"
            onClick={() => onChange(EMPTY_FILTER)}
          >
            Clear
          </Button>
        ) : null}
      </div>

      {expanded ? (
        <div className="mt-3 flex flex-col gap-2.5 border-t pt-3">
          <input
            type="search"
            value={filter.q}
            onChange={(e) => set("q", e.target.value)}
            placeholder="Search society, address, notes…"
            className="h-8 w-full rounded-md border bg-background px-2 text-sm"
          />

          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs text-muted-foreground">BHK</span>
            {[1, 2, 3, 4].map((n) => (
              <button
                key={n}
                type="button"
                aria-pressed={filter.bhk.includes(n)}
                onClick={() => toggleBhk(n)}
                className={`rounded-full border px-2.5 py-1 text-xs transition-colors ${
                  filter.bhk.includes(n)
                    ? "border-transparent bg-primary text-primary-foreground"
                    : "bg-background hover:bg-accent"
                }`}
              >
                {n}
              </button>
            ))}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <NumberBox
              label="Rent ≥"
              value={filter.minRent}
              onChange={(v) => set("minRent", v)}
            />
            <NumberBox
              label="≤"
              value={filter.maxRent}
              onChange={(v) => set("maxRent", v)}
            />
            <NumberBox
              label="Deposit ≤"
              value={filter.maxDeposit}
              onChange={(v) => set("maxDeposit", v)}
            />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Select
              label="Area"
              value={filter.area}
              options={AREAS}
              onChange={(v) => set("area", v)}
            />
            <Select
              label="Source"
              value={filter.source}
              options={SCRAPE_SOURCES}
              onChange={(v) => set("source", v)}
              render={(v) => SCRAPE_SOURCE_LABELS[v]}
            />
            <Select
              label="Confidence"
              value={filter.confidence}
              options={CONFIDENCES}
              onChange={(v) => set("confidence", v)}
            />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Select
              label="Furnished"
              value={filter.furnished}
              options={FURNISHED}
              onChange={(v) => set("furnished", v)}
            />
            <Select
              label="Type"
              value={filter.housingType}
              options={HOUSING_TYPES}
              onChange={(v) => set("housingType", v)}
              render={(v) => HOUSING_LABELS[v]}
            />
            <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
              Sort
              <select
                value={filter.sort}
                onChange={(e) =>
                  set("sort", e.target.value as TrayFilter["sort"])
                }
                className="h-8 rounded-md border bg-background px-2 text-sm text-foreground"
              >
                <option value="captured">newest captured</option>
                <option value="rentAsc">rent: low to high</option>
                <option value="rentDesc">rent: high to low</option>
              </select>
            </label>
          </div>

          {positiveHint(filter) ? (
            <p className="text-xs text-muted-foreground">{positiveHint(filter)}</p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

/** Explains the one filter rule that is not obvious from the controls. */
function positiveHint(f: TrayFilter): string | null {
  const priced = f.minRent.trim() || f.maxRent.trim() || f.maxDeposit.trim();
  return priced
    ? "Listings with no readable rent or deposit are always shown — leases carry none."
    : null;
}

export function ScrapeTray({
  open,
  onOpenChange,
  pending,
  rejected,
  error,
  onImport,
  onReject,
  onRestore,
  onEdit,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  pending: ScrapedListing[];
  rejected: ScrapedListing[];
  error: string | null;
  onImport: (row: ScrapedListing) => Promise<void>;
  onReject: (row: ScrapedListing) => Promise<void>;
  onRestore: (row: ScrapedListing) => Promise<void>;
  onEdit: (row: ScrapedListing) => void;
}) {
  const [busyId, setBusyId] = useState<string | null>(null);
  const [showFiltered, setShowFiltered] = useState(false);
  const [showRejected, setShowRejected] = useState(false);
  const [filter, setFilter] = useState<TrayFilter>(EMPTY_FILTER);

  const visible = useMemo(
    () => sortRows(pending.filter((r) => matchesTrayFilter(r, filter)), filter.sort),
    [pending, filter]
  );
  const visibleRejected = useMemo(
    () => sortRows(rejected.filter((r) => matchesTrayFilter(r, filter)), filter.sort),
    [rejected, filter]
  );

  // Low-confidence captures stay collapsed unless the user filters for them.
  const { kept, lowConfidence } = useMemo(
    () => ({
      kept: visible.filter((r) => r.confidence !== "low"),
      lowConfidence: visible.filter((r) => r.confidence === "low"),
    }),
    [visible]
  );

  const run = async (row: ScrapedListing, fn: () => Promise<void>) => {
    setBusyId(row.id);
    try {
      await fn();
    } finally {
      setBusyId(null);
    }
  };

  const rowProps = (row: ScrapedListing) => ({
    row,
    busy: busyId === row.id,
    onImport: () => void run(row, () => onImport(row)),
    onReject: () => void run(row, () => onReject(row)),
    onEdit: () => onEdit(row),
  });

  return (
    <Overlay
      open={open}
      onClose={() => onOpenChange(false)}
      title="Captured listings"
      description="Harvested from your browser. Nothing reaches the board until you import it."
      variant="drawer"
    >
      <div className="min-h-0 flex-1 overflow-y-auto p-4">
        {error ? <p className="mb-3 text-sm text-destructive">{error}</p> : null}

        {pending.length === 0 && rejected.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Nothing waiting. Open a NoBroker or Facebook Marketplace search and
            click the import pill.
          </p>
        ) : (
          <TrayFilters
            filter={filter}
            onChange={setFilter}
            showing={visible.length}
            total={pending.length}
          />
        )}

        {pending.length > 0 && visible.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No captures match these filters.
          </p>
        ) : null}

        <ul className="flex flex-col gap-3">
          {kept.map((row) => (
            <CaptureRow key={row.id} {...rowProps(row)} />
          ))}
        </ul>

        {lowConfidence.length ? (
          <div className="mt-4">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setShowFiltered((v) => !v)}
            >
              {showFiltered
                ? "Hide low confidence"
                : `Show ${lowConfidence.length} low confidence`}
            </Button>
            {showFiltered ? (
              <ul className="mt-3 flex flex-col gap-3">
                {lowConfidence.map((row) => (
                  <CaptureRow key={row.id} {...rowProps(row)} />
                ))}
              </ul>
            ) : null}
          </div>
        ) : null}

        {visibleRejected.length ? (
          <div className="mt-6 border-t pt-4">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setShowRejected((v) => !v)}
            >
              {showRejected
                ? "Hide rejected"
                : `${visibleRejected.length} rejected — restore any`}
            </Button>
            {showRejected ? (
              <ul className="mt-3 flex flex-col gap-2">
                {visibleRejected.map((row) => {
                  const draft = row.draft as ListingDraft;
                  return (
                    <li
                      key={row.id}
                      className="flex items-center justify-between gap-3 rounded-lg border border-dashed p-2.5"
                    >
                      <div className="min-w-0 text-sm">
                        <p className="truncate text-muted-foreground">
                          {draft.society?.trim() || draft.address?.trim() || "Listing"}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {summary(draft).join(" · ") || "Nothing read"}
                        </p>
                      </div>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        disabled={busyId === row.id}
                        onClick={() => void run(row, () => onRestore(row))}
                      >
                        Restore
                      </Button>
                    </li>
                  );
                })}
              </ul>
            ) : null}
          </div>
        ) : null}
      </div>
    </Overlay>
  );
}
